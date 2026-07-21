import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from "livekit-client";
import { useWebSocket } from "./WebSocketContext";
import { WsType } from "../api/wsProtocol";
import { useAuth } from "./AuthContext";
import { isAllowedLiveKitUrl } from "../utils/env/livekitAllowlist";
import { applyAudioOutputDevice, loadVoiceSettings } from "../utils/media/voiceSettings";
import { requestVoiceToken, fetchActiveCall } from "../api/voice";
import { getFriends } from "../api/friends";
import {
  clearPersistedCall,
  loadPersistedCall,
  savePersistedCall,
} from "../utils/call/callPersistence";
import { buildScreenShareCaptureOptions } from "../utils/call/screenShareQuality";
import {
  readLocalCameraTrack,
  readLocalScreenShareTrack,
  readRemoteCameraTrack,
  readRemoteScreenShareTrack,
} from "../utils/call/callMediaTracks";

export type CallMode = "audio" | "video";

export type CallKind = "dm" | "channel";

export type CallState =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "active";

export interface CallPeer {
  _id: string;
  username?: string;
  displayName?: string | null;
  image?: string | null;
  color?: number | null;
}

export interface CallChannel {
  _id: string;
  name: string;
  image?: string | null;
}

type ConnectTarget =
  | { kind: "dm"; peerId: string }
  | { kind: "channel"; channelId: string };

interface CallContextValue {
  state: CallState;
  callKind: CallKind;
  mode: CallMode;
  peer: CallPeer | null;
  channel: CallChannel | null;
  participantCount: number;
  channelVoiceParticipants: Record<string, string[]>;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isPushToTalkActive: boolean;
  speakerVolume: number;
  error: string | null;
  startedAt: number | null;
  localVideoTrack: Track | null;
  localScreenShareTrack: Track | null;
  remoteVideoTrack: Track | null;
  remoteScreenShareTrack: Track | null;
  /** Rozpoczyna połączenie wychodzące do kontaktu. */
  startCall: (peer: CallPeer, mode: CallMode) => void;
  /** Dołącza do kanału głosowego (bez dzwonienia). */
  joinChannelVoice: (channel: CallChannel, mode?: CallMode) => void;
  /** Opuszcza kanał głosowy, jeśli jesteś na nim. */
  leaveChannelVoice: () => void;
  /** Przełącza udział w kanale głosowym. */
  toggleChannelVoice: (channel: CallChannel, mode?: CallMode) => void;
  /** Odświeża listę uczestników kanału głosowego. */
  requestChannelVoiceState: (channelId: string) => void;
  /** Sprawdza, czy kanał ma aktywnych uczestników głosu. */
  isChannelVoiceActive: (channelId: string) => boolean;
  /** Czy użytkownik jest obecnie na kanale głosowym. */
  isInChannelVoice: (channelId: string) => boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isPushToTalkActive: boolean;
  speakerVolume: number;
  error: string | null;
  startedAt: number | null;
  localVideoTrack: Track | null;
  localScreenShareTrack: Track | null;
  remoteVideoTrack: Track | null;
  remoteScreenShareTrack: Track | null;
  /** Rozpoczyna połączenie wychodzące do kontaktu. */
  startCall: (peer: CallPeer, mode: CallMode) => void;
  /** Odbiera połączenie przychodzące. */
  acceptCall: () => void;
  /** Odrzuca połączenie przychodzące. */
  rejectCall: () => void;
  /** Anuluje połączenie wychodzące zanim zostanie odebrane. */
  cancelCall: () => void;
  /** Kończy aktywne połączenie. */
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  startPushToTalk: () => void;
  stopPushToTalk: () => void;
  setSpeakerVolume: (value: number) => void;
  clearError: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const ws = useWebSocket();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const [state, setState] = useState<CallState>("idle");
  const [callKind, setCallKind] = useState<CallKind>("dm");
  const [mode, setMode] = useState<CallMode>("audio");
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [channel, setChannel] = useState<CallChannel | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [channelVoiceParticipants, setChannelVoiceParticipants] = useState<
    Record<string, string[]>
  >({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [speakerVolume, setSpeakerVolumeState] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<Track | null>(null);
  const [localScreenShareTrack, setLocalScreenShareTrack] = useState<Track | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<Track | null>(null);
  const [remoteScreenShareTrack, setRemoteScreenShareTrack] = useState<Track | null>(null);

  const roomRef = useRef<Room | null>(null);
  const stateRef = useRef<CallState>(state);
  stateRef.current = state;
  const callKindRef = useRef<CallKind>(callKind);
  callKindRef.current = callKind;
  const peerRef = useRef<CallPeer | null>(peer);
  peerRef.current = peer;
  const channelRef = useRef<CallChannel | null>(channel);
  channelRef.current = channel;
  const speakerVolumeRef = useRef(1);
  const micVolumeRef = useRef(1);
  const pushToTalkActiveRef = useRef(false);
  const pushToTalkMutedBeforeRef = useRef(true);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  // Ukryte elementy <audio> dla zdalnych ścieżek dźwięku.
  const audioElsRef = useRef<HTMLAudioElement[]>([]);

  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = undefined;
    }
  }, []);

  const applySpeakerVolume = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    speakerVolumeRef.current = clamped;
    audioElsRef.current.forEach((el) => {
      el.volume = clamped;
    });
  }, []);

  const applyMicVolume = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    micVolumeRef.current = clamped;
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track;
    if (track && "setVolume" in track && typeof track.setVolume === "function") {
      track.setVolume(clamped);
    }
  }, []);

  const cleanupRoom = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
    }
    audioElsRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElsRef.current = [];
    setLocalVideoTrack(null);
    setLocalScreenShareTrack(null);
    setRemoteVideoTrack(null);
    setRemoteScreenShareTrack(null);
  }, []);

  const resetCall = useCallback(() => {
    clearRingTimeout();
    cleanupRoom();
    clearPersistedCall();
    setState("idle");
    setCallKind("dm");
    setPeer(null);
    setChannel(null);
    setParticipantCount(1);
    setMode("audio");
    setIsMuted(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsPushToTalkActive(false);
    pushToTalkActiveRef.current = false;
    setSpeakerVolumeState(1);
    speakerVolumeRef.current = 1;
    micVolumeRef.current = 1;
    setStartedAt(null);
  }, [cleanupRoom, clearRingTimeout]);

  const refreshLocalMediaTracks = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    setLocalVideoTrack(readLocalCameraTrack(room.localParticipant));
    setLocalScreenShareTrack(readLocalScreenShareTrack(room.localParticipant));
    setIsScreenSharing(Boolean(readLocalScreenShareTrack(room.localParticipant)));
  }, []);

  const refreshRemoteMediaTracks = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    let camera: Track | null = null;
    let screen: Track | null = null;
    room.remoteParticipants.forEach((participant) => {
      if (!camera) camera = readRemoteCameraTrack(participant);
      if (!screen) screen = readRemoteScreenShareTrack(participant);
    });
    setRemoteVideoTrack(camera);
    setRemoteScreenShareTrack(screen);
  }, []);

  const attachRemoteTrack = useCallback(
    (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
    ) => {
      if (track.kind === Track.Kind.Video) {
        if (publication.source === Track.Source.ScreenShare) {
          setRemoteScreenShareTrack(track);
        } else {
          setRemoteVideoTrack(track);
        }
        return;
      }
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach() as HTMLAudioElement;
        el.style.display = "none";
        el.autoplay = true;
        el.volume = speakerVolumeRef.current;
        document.body.appendChild(el);
        void applyAudioOutputDevice(el);
        audioElsRef.current.push(el);
      }
    },
    [],
  );

  const detachRemoteTrack = useCallback(
    (track: RemoteTrack, publication: RemoteTrackPublication) => {
      if (track.kind === Track.Kind.Video) {
        if (publication.source === Track.Source.ScreenShare) {
          setRemoteScreenShareTrack(null);
        } else {
          setRemoteVideoTrack(null);
        }
        track.detach().forEach((el) => {
          (el as HTMLMediaElement).srcObject = null;
          el.remove();
        });
        return;
      }
      if (track.kind === Track.Kind.Audio) {
        track.detach().forEach((el) => {
          (el as HTMLMediaElement).srcObject = null;
          el.remove();
        });
        audioElsRef.current = audioElsRef.current.filter(
          (el) => el.isConnected,
        );
      }
    },
    [],
  );

  const updateParticipantCount = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipantCount(1);
      return;
    }
    setParticipantCount(room.remoteParticipants.size + 1);
  }, []);

  const connectToRoom = useCallback(
    async (
      target: ConnectTarget,
      callMode: CallMode,
      options?: { startedAt?: number; isRestore?: boolean },
    ) => {
      try {
        setState("connecting");
        const tokenParams =
          target.kind === "dm"
            ? { peerId: target.peerId }
            : { channelId: target.channelId };
        const { token, url } = await requestVoiceToken(tokenParams);
        if (!isAllowedLiveKitUrl(url)) {
          throw new Error(t("call.invalidServerUrl"));
        }

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(
          RoomEvent.TrackSubscribed,
          (
            track: RemoteTrack,
            publication: RemoteTrackPublication,
            _participant: RemoteParticipant,
          ) => attachRemoteTrack(track, publication),
        );
        room.on(
          RoomEvent.TrackUnsubscribed,
          (track: RemoteTrack, publication: RemoteTrackPublication) =>
            detachRemoteTrack(track, publication),
        );
        room.on(RoomEvent.LocalTrackPublished, () => {
          refreshLocalMediaTracks();
        });
        room.on(
          RoomEvent.LocalTrackUnpublished,
          (publication: LocalTrackPublication) => {
            if (publication.source === Track.Source.ScreenShare) {
              setIsScreenSharing(false);
            }
            refreshLocalMediaTracks();
          },
        );
        room.on(RoomEvent.Disconnected, () => {
          if (stateRef.current === "active") {
            resetCall();
          }
        });
        room.on(RoomEvent.ParticipantConnected, updateParticipantCount);
        room.on(RoomEvent.ParticipantDisconnected, updateParticipantCount);

        await room.connect(url, token);

        await room.localParticipant.setMicrophoneEnabled(true);
        applyMicVolume(micVolumeRef.current);
        const { inputDeviceId, outputDeviceId } = loadVoiceSettings();
        if (inputDeviceId) {
          await room.switchActiveDevice("audioinput", inputDeviceId).catch(() => {});
        }
        if (outputDeviceId) {
          await room.switchActiveDevice("audiooutput", outputDeviceId).catch(() => {});
        }
        try {
          if (callMode === "video") {
            await room.localParticipant.setCameraEnabled(true);
            setIsCameraOn(true);
          } else {
            setIsCameraOn(false);
          }
        } catch (camErr) {
          if (import.meta.env.DEV) {
            console.error("Camera enable failed:", camErr);
          }
          setIsCameraOn(false);
          setError(t("call.cameraFailed"));
        }
        // Track may publish slightly after setCameraEnabled resolves.
        refreshLocalMediaTracks();
        window.setTimeout(() => refreshLocalMediaTracks(), 250);
        window.setTimeout(() => refreshLocalMediaTracks(), 800);

        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.track) {
              attachRemoteTrack(pub.track as RemoteTrack, pub);
            }
          });
        });
        refreshRemoteMediaTracks();
        updateParticipantCount();

        setIsMuted(false);
        setStartedAt(options?.startedAt ?? Date.now());
        setState("active");
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to connect to call room:", err);
        }
        setError(t("call.connectFailed"));
        const other = peerRef.current?._id;
        const activeChannel = channelRef.current;
        if (
          !options?.isRestore &&
          ws &&
          myId &&
          callKindRef.current === "dm" &&
          other
        ) {
          ws.send(WsType.CALL_END, { from: myId, to: other });
        }
        if (
          !options?.isRestore &&
          ws &&
          myId &&
          callKindRef.current === "channel" &&
          activeChannel
        ) {
          ws.send(WsType.CHANNEL_VOICE_LEAVE, { channelId: activeChannel._id });
        }
        resetCall();
      }
    },
    [
      attachRemoteTrack,
      detachRemoteTrack,
      refreshLocalMediaTracks,
      refreshRemoteMediaTracks,
      updateParticipantCount,
      applyMicVolume,
      resetCall,
      ws,
      myId,
      t,
    ],
  );

  /* ── Akcje publiczne ─────────────────────────────────────────────── */

  const startCall = useCallback(
    (target: CallPeer, callMode: CallMode) => {
      if (!ws || !myId || stateRef.current !== "idle") return;
      setError(null);
      setCallKind("dm");
      setChannel(null);
      setPeer(target);
      setMode(callMode);
      setState("outgoing");
      ws.send(WsType.CALL_INVITE, {
        from: myId,
        to: target._id,
        mode: callMode,
      });
      clearRingTimeout();
      // Match server RINGING_TTL (60s) — unanswered → missed call log.
      ringTimeoutRef.current = setTimeout(() => {
        if (stateRef.current !== "outgoing") return;
        const peerId = peerRef.current?._id;
        if (ws && myId && peerId) {
          ws.send(WsType.CALL_TIMEOUT, { from: myId, to: peerId });
        }
        resetCall();
      }, 60_000);
    },
    [ws, myId, clearRingTimeout, resetCall],
  );

  const joinChannelVoice = useCallback(
    (targetChannel: CallChannel, callMode: CallMode = "audio") => {
      if (!ws || !myId || stateRef.current !== "idle") return;
      setError(null);
      setCallKind("channel");
      setChannel(targetChannel);
      setPeer(null);
      setMode(callMode);
      ws.send(WsType.CHANNEL_VOICE_JOIN, { channelId: targetChannel._id });
      void connectToRoom(
        { kind: "channel", channelId: targetChannel._id },
        callMode,
      );
    },
    [ws, myId, connectToRoom],
  );

  const leaveChannelVoice = useCallback(() => {
    const activeChannel = channelRef.current;
    if (ws && myId && activeChannel && callKindRef.current === "channel") {
      ws.send(WsType.CHANNEL_VOICE_LEAVE, { channelId: activeChannel._id });
    }
    resetCall();
  }, [ws, myId, resetCall]);

  const toggleChannelVoice = useCallback(
    (targetChannel: CallChannel, callMode: CallMode = "audio") => {
      if (
        callKindRef.current === "channel" &&
        channelRef.current?._id === targetChannel._id &&
        stateRef.current !== "idle"
      ) {
        leaveChannelVoice();
        return;
      }
      if (stateRef.current !== "idle") return;
      joinChannelVoice(targetChannel, callMode);
    },
    [joinChannelVoice, leaveChannelVoice],
  );

  const requestChannelVoiceState = useCallback(
    (channelId: string) => {
      if (!ws || !channelId.trim()) return;
      ws.send(WsType.CHANNEL_VOICE_STATE, { channelId });
    },
    [ws],
  );

  const isChannelVoiceActive = useCallback(
    (channelId: string) =>
      (channelVoiceParticipants[channelId]?.length ?? 0) > 0,
    [channelVoiceParticipants],
  );

  const isInChannelVoice = useCallback(
    (channelId: string) =>
      callKind === "channel" &&
      channel?._id === channelId &&
      (state === "connecting" || state === "active"),
    [callKind, channel, state],
  );

  const acceptCall = useCallback(() => {
    const target = peerRef.current;
    if (!ws || !myId || !target || stateRef.current !== "incoming") return;
    ws.send(WsType.CALL_ACCEPT, { from: myId, to: target._id });
  }, [ws, myId]);

  const rejectCall = useCallback(() => {
    const target = peerRef.current;
    if (ws && myId && target) {
      ws.send(WsType.CALL_REJECT, { from: myId, to: target._id });
    }
    resetCall();
  }, [ws, myId, resetCall]);

  const cancelCall = useCallback(() => {
    const target = peerRef.current;
    if (ws && myId && target) {
      ws.send(WsType.CALL_CANCEL, { from: myId, to: target._id });
    }
    resetCall();
  }, [ws, myId, resetCall]);

  const endCall = useCallback(() => {
    const target = peerRef.current;
    const activeChannel = channelRef.current;
    if (ws && myId) {
      if (callKindRef.current === "channel" && activeChannel) {
        ws.send(WsType.CHANNEL_VOICE_LEAVE, { channelId: activeChannel._id });
      } else if (target) {
        ws.send(WsType.CALL_END, { from: myId, to: target._id });
      }
    }
    resetCall();
  }, [ws, myId, resetCall]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isMuted;
    void room.localParticipant.setMicrophoneEnabled(!next).then(() => {
      if (!next) applyMicVolume(micVolumeRef.current);
    });
    setIsMuted(next);
  }, [isMuted, applyMicVolume]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isCameraOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setIsCameraOn(next);
      refreshLocalMediaTracks();
      window.setTimeout(() => refreshLocalMediaTracks(), 300);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("toggleCamera failed:", err);
      }
      setError(t("call.cameraFailed"));
    }
  }, [isCameraOn, refreshLocalMediaTracks, t]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isScreenSharing;
    try {
      await room.localParticipant.setScreenShareEnabled(
        next,
        next
          ? buildScreenShareCaptureOptions(loadVoiceSettings().screenShareQuality)
          : undefined,
      );
      setIsScreenSharing(next);
      refreshLocalMediaTracks();
      window.setTimeout(() => refreshLocalMediaTracks(), 300);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("toggleScreenShare failed:", err);
      }
      setError(t("call.screenShareFailed"));
    }
  }, [isScreenSharing, refreshLocalMediaTracks, t]);

  const startPushToTalk = useCallback(() => {
    const room = roomRef.current;
    if (!room || pushToTalkActiveRef.current) return;
    pushToTalkActiveRef.current = true;
    pushToTalkMutedBeforeRef.current = isMuted;
    setIsPushToTalkActive(true);
    void room.localParticipant.setMicrophoneEnabled(true).then(() => {
      setIsMuted(false);
    });
  }, [isMuted]);

  const stopPushToTalk = useCallback(() => {
    const room = roomRef.current;
    if (!room || !pushToTalkActiveRef.current) return;
    pushToTalkActiveRef.current = false;
    setIsPushToTalkActive(false);
    const restoreMuted = pushToTalkMutedBeforeRef.current;
    void room.localParticipant.setMicrophoneEnabled(!restoreMuted).then(() => {
      setIsMuted(restoreMuted);
    });
  }, []);

  const setSpeakerVolume = useCallback(
    (value: number) => {
      const clamped = Math.min(1, Math.max(0, value));
      setSpeakerVolumeState(clamped);
      applySpeakerVolume(clamped);
    },
    [applySpeakerVolume],
  );

  useEffect(() => {
    if (!isPushToTalkActive) return;
    const stop = () => stopPushToTalk();
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
    };
  }, [isPushToTalkActive, stopPushToTalk]);

  const clearError = useCallback(() => setError(null), []);

  /* ── Trwałość aktywnej rozmowy (odświeżenie strony) ─────────────── */

  const prevStateRef = useRef<CallState | null>(null);

  useEffect(() => {
    if (state === "active" && peer && myId && startedAt) {
      savePersistedCall({ userId: myId, peer, mode, startedAt });
    } else if (
      state === "idle" &&
      prevStateRef.current !== null &&
      prevStateRef.current !== "idle"
    ) {
      clearPersistedCall();
    }
    prevStateRef.current = state;
  }, [state, peer, mode, startedAt, myId]);

  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    if (!ws || !myId || restoreAttemptedRef.current) return;
    if (stateRef.current !== "idle") return;

    restoreAttemptedRef.current = true;

    void (async () => {
      const saved = loadPersistedCall();
      let peerId: string | null = null;
      let callMode: CallMode = "audio";
      let restoreStartedAt: number | undefined;
      let restorePeer: CallPeer | null = null;

      if (saved && saved.userId === myId) {
        peerId = saved.peer._id;
        callMode = saved.mode;
        restoreStartedAt = saved.startedAt;
        restorePeer = saved.peer;
      } else {
        if (saved) clearPersistedCall();
        try {
          const active = await fetchActiveCall();
          if (!active.active || !active.peerId) return;
          peerId = active.peerId;
          callMode = active.mode === "video" ? "video" : "audio";
          restorePeer = { _id: peerId };
          try {
            const { friends } = await getFriends();
            const friend = friends.find((f) => f._id === peerId);
            if (friend) {
              restorePeer = {
                _id: friend._id,
                username: friend.username,
                displayName: friend.displayName,
                image: friend.image,
                color: friend.color ?? null,
              };
            }
          } catch {
            // Profil peera opcjonalny — wystarczy samo ID.
          }
        } catch {
          return;
        }
      }

      setPeer(restorePeer);
      setCallKind("dm");
      setChannel(null);
      setMode(callMode);
      await connectToRoom({ kind: "dm", peerId }, callMode, {
        startedAt: restoreStartedAt,
        isRestore: true,
      });
    })();
  }, [ws, myId, connectToRoom]);

  /* ── Nasłuch sygnalizacji WebSocket ──────────────────────────────── */

  useEffect(() => {
    if (!ws) return;

    const onIncoming = (data: {
      from: string;
      mode?: CallMode;
      caller?: CallPeer;
    }) => {
      if (stateRef.current !== "idle") {
        ws.send(WsType.CALL_REJECT, { from: myId, to: data.from });
        return;
      }
      setError(null);
      setCallKind("dm");
      setChannel(null);
      setPeer(data.caller ?? { _id: data.from });
      setMode(data.mode === "video" ? "video" : "audio");
      setState("incoming");
    };

    const onAccepted = (data: { from: string }) => {
      const target = peerRef.current;
      if (!target) return;
      const peerId = target._id;
      clearRingTimeout();

      if (stateRef.current === "outgoing" && data.from === peerId) {
        connectToRoom({ kind: "dm", peerId }, mode);
        return;
      }
      if (stateRef.current === "incoming" && data.from === myId) {
        connectToRoom({ kind: "dm", peerId }, mode);
      }
    };

    const onRejected = (data: { from: string }) => {
      const target = peerRef.current;
      if (
        stateRef.current === "outgoing" &&
        target &&
        data.from === target._id
      ) {
        setError(t("call.rejected"));
        resetCall();
      }
    };

    const onCancelled = (data: { from: string }) => {
      const target = peerRef.current;
      if (
        stateRef.current === "incoming" &&
        target &&
        data.from === target._id
      ) {
        resetCall();
      }
    };

    const onEnded = (data: { from: string }) => {
      const target = peerRef.current;
      if (!target || data.from === myId || data.from === target._id) {
        resetCall();
      }
    };

    const onUnavailable = (data: { reason?: string }) => {
      if (stateRef.current === "outgoing") {
        setError(
          data.reason === "BUSY"
            ? t("call.peerBusy")
            : data.reason === "NOT_FRIENDS"
              ? t("call.unavailable")
              : t("call.unavailable"),
        );
        resetCall();
      }
    };

    const unsubs = [
      ws.subscribe(WsType.CALL_INCOMING, onIncoming),
      ws.subscribe(WsType.CALL_ACCEPTED, onAccepted),
      ws.subscribe(WsType.CALL_REJECTED, onRejected),
      ws.subscribe(WsType.CALL_CANCELLED, onCancelled),
      ws.subscribe(WsType.CALL_ENDED, onEnded),
      ws.subscribe(WsType.CALL_UNAVAILABLE, onUnavailable),
    ];

    return () => unsubs.forEach((u) => u());
  }, [ws, myId, mode, connectToRoom, resetCall, clearRingTimeout, t]);

  useEffect(() => {
    if (!ws) return;
    return ws.subscribe(
      WsType.CHANNEL_VOICE_STATE,
      (data: { channelId?: string; participants?: string[] }) => {
        const channelId = data.channelId?.trim();
        if (!channelId) return;
        setChannelVoiceParticipants((prev) => ({
          ...prev,
          [channelId]: Array.isArray(data.participants) ? data.participants : [],
        }));
      },
    );
  }, [ws]);

  // Sprzątanie przy odmontowaniu (np. wylogowanie).
  useEffect(() => {
    return () => cleanupRoom();
  }, [cleanupRoom]);

  const value = useMemo<CallContextValue>(
    () => ({
      state,
      callKind,
      mode,
      peer,
      channel,
      participantCount,
      channelVoiceParticipants,
      isMuted,
      isCameraOn,
      isScreenSharing,
      isPushToTalkActive,
      speakerVolume,
      error,
      startedAt,
      localVideoTrack,
      localScreenShareTrack,
      remoteVideoTrack,
      remoteScreenShareTrack,
      startCall,
      joinChannelVoice,
      leaveChannelVoice,
      toggleChannelVoice,
      requestChannelVoiceState,
      isChannelVoiceActive,
      isInChannelVoice,
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      startPushToTalk,
      stopPushToTalk,
      setSpeakerVolume,
      clearError,
    }),
    [
      state,
      callKind,
      mode,
      peer,
      channel,
      participantCount,
      channelVoiceParticipants,
      isMuted,
      isCameraOn,
      isScreenSharing,
      isPushToTalkActive,
      speakerVolume,
      error,
      startedAt,
      localVideoTrack,
      localScreenShareTrack,
      remoteVideoTrack,
      remoteScreenShareTrack,
      startCall,
      joinChannelVoice,
      leaveChannelVoice,
      toggleChannelVoice,
      requestChannelVoiceState,
      isChannelVoiceActive,
      isInChannelVoice,
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      startPushToTalk,
      stopPushToTalk,
      setSpeakerVolume,
      clearError,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
