// CallContext.tsx
// Stan rozmowy: outgoing/incoming/active, LiveKit, multi-tab Accept.
// Zakres:
//  - hangup.ts sync przy pagehide
//  - kanał głosowy vs DM (peer=null)
// Nowa kontrolka: CallView + event CALL_* na serwerze, nie tylko lokalny setState.
// Przy zmianach: IncomingCall.tsx, CallView.tsx, ws/handlers.rs, hangup.ts.

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
import { useWebSocket, useWebSocketConnected } from "./WebSocketContext";
import { WsType } from "../api/protocol";
import { useAuth } from "./AuthContext";
import { isAllowedLiveKitUrl } from "../utils/env/livekit";
import { applyAudioOutputDevice, loadVoiceSettings } from "../utils/media/voice";
import { requestVoiceToken, fetchActiveCall } from "../api/voice";
import { getFriends } from "../api/friends";
import {
  clearPersistedCall,
  loadPersistedCall,
  savePersistedCall,
} from "../utils/call/saved";
import {
  clearMatchingHangup,
  getPendingHangupGeneration,
  peekAllPendingHangups,
  queuePendingHangupSync,
  takePendingHangup,
  type PendingHangup,
} from "../utils/sync/hangup";
import { buildScreenShareCaptureOptions } from "../utils/call/screenShare";
import {
  readLocalCameraTrack,
  readLocalScreenShareTrack,
  readRemoteCameraTrack,
  readRemoteScreenShareTrack,
} from "../utils/call/tracks";

export type CallMode = "audio" | "video";

const CALL_TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function dmAcceptClaimKey(peerId: string): string {
  return `klovy:dm-call-accept:${peerId}`;
}

async function claimDmAcceptAsync(peerId: string): Promise<boolean> {
  const key = dmAcceptClaimKey(peerId);
  const payload = `${CALL_TAB_ID}:${Date.now()}`;
  const run = (): boolean => {
    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        const [tab, atRaw] = existing.split(":");
        const at = Number(atRaw) || 0;
        if (tab && tab !== CALL_TAB_ID && Date.now() - at < 15_000) {
          return false;
        }
      }
      localStorage.setItem(key, payload);
      return Boolean(localStorage.getItem(key)?.startsWith(`${CALL_TAB_ID}:`));
    } catch {
      return true;
    }
  };
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    try {
      const result = await locks.request(
        key,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) return false;
          return run();
        },
      );

      return result === true;
    } catch {
      return run();
    }
  }
  return run();
}

function thisTabOwnsDmAccept(peerId: string): boolean {
  try {
    return Boolean(
      localStorage.getItem(dmAcceptClaimKey(peerId))?.startsWith(`${CALL_TAB_ID}:`),
    );
  } catch {
    return true;
  }
}

function clearDmAcceptClaim(peerId: string): void {
  try {
    const key = dmAcceptClaimKey(peerId);
    if (localStorage.getItem(key)?.startsWith(`${CALL_TAB_ID}:`)) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

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

  startCall: (peer: CallPeer, mode: CallMode) => void;

  joinChannelVoice: (channel: CallChannel, mode?: CallMode) => void;

  leaveChannelVoice: () => void;

  toggleChannelVoice: (channel: CallChannel, mode?: CallMode) => void;

  requestChannelVoiceState: (channelId: string) => void;

  isChannelVoiceActive: (channelId: string) => boolean;

  isInChannelVoice: (channelId: string) => boolean;

  acceptCall: () => void;

  acceptInFlight: boolean;

  rejectCall: () => void;

  cancelCall: () => void;

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
  const wsConnected = useWebSocketConnected();
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
  const stateRef = useRef<CallState>("idle");
  const callKindRef = useRef<CallKind>("dm");
  const peerRef = useRef<CallPeer | null>(null);
  const channelRef = useRef<CallChannel | null>(null);

  const connectInFlightRef = useRef(false);

  const acceptedHereRef = useRef(false);

  const acceptInFlightRef = useRef(false);
  const [acceptInFlight, setAcceptInFlight] = useState(false);
  const setAcceptInFlightBoth = useCallback((v: boolean) => {
    acceptInFlightRef.current = v;
    setAcceptInFlight(v);
  }, []);
  const speakerVolumeRef = useRef(1);
  const micVolumeRef = useRef(1);
  const muteGenRef = useRef(0);
  const cameraGenRef = useRef(0);
  const screenShareGenRef = useRef(0);

  const voiceOpGenRef = useRef(0);
  const pushToTalkActiveRef = useRef(false);
  const pushToTalkMutedBeforeRef = useRef(true);
  const pushToTalkGenRef = useRef(0);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const acceptTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const acceptAbortGenRef = useRef(0);

  const connectGenRef = useRef(0);

  const audioElsRef = useRef<HTMLAudioElement[]>([]);

  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = undefined;
    }
  }, []);

  const clearAcceptTimeout = useCallback(() => {
    if (acceptTimeoutRef.current) {
      clearTimeout(acceptTimeoutRef.current);
      acceptTimeoutRef.current = undefined;
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
    clearAcceptTimeout();
    acceptAbortGenRef.current += 1;
    connectGenRef.current += 1;
    connectInFlightRef.current = false;
    cleanupRoom();
    clearPersistedCall();
    const peerId = peerRef.current?._id;
    if (peerId) clearDmAcceptClaim(peerId);
    acceptedHereRef.current = false;
    setAcceptInFlightBoth(false);

    stateRef.current = "idle";
    callKindRef.current = "dm";
    peerRef.current = null;
    channelRef.current = null;
    setState("idle");
    setCallKind("dm");
    setPeer(null);
    setChannel(null);
    setParticipantCount(1);
    setMode("audio");
    setIsMuted(false);
    muteGenRef.current += 1;
    cameraGenRef.current += 1;
    screenShareGenRef.current += 1;
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsPushToTalkActive(false);
    pushToTalkActiveRef.current = false;
    pushToTalkGenRef.current += 1;
    setSpeakerVolumeState(1);
    speakerVolumeRef.current = 1;
    micVolumeRef.current = 1;
    setStartedAt(null);
  }, [cleanupRoom, clearRingTimeout, clearAcceptTimeout, setAcceptInFlightBoth]);

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
    (track: RemoteTrack, _publication: RemoteTrackPublication) => {
      if (track.kind === Track.Kind.Video) {
        track.detach().forEach((el) => {
          (el as HTMLMediaElement).srcObject = null;
          el.remove();
        });

        refreshRemoteMediaTracks();
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
    [refreshRemoteMediaTracks],
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
      const connectGen = connectGenRef.current;
      if (connectInFlightRef.current || roomRef.current) {
        return;
      }
      connectInFlightRef.current = true;
      try {
        stateRef.current = "connecting";
        setState("connecting");
        const tokenParams =
          target.kind === "dm"
            ? { peerId: target.peerId }
            : { channelId: target.channelId };
        const { token, url } = await requestVoiceToken(tokenParams);
        if (connectGen !== connectGenRef.current) return;
        if (!isAllowedLiveKitUrl(url)) {
          throw new Error(t("call.invalidServerUrl"));
        }

        const room = new Room({ adaptiveStream: true, dynacast: true });
        if (connectGen !== connectGenRef.current) return;
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
          const state = stateRef.current;
          if (state !== "active" && state !== "connecting") return;

          const kind = callKindRef.current;
          const target = peerRef.current;
          const activeChannel = channelRef.current;
          if (ws && myId) {
            if (kind === "channel" && activeChannel) {
              const hangup = {
                kind: "channel_leave" as const,
                channelId: activeChannel._id,
              };
              queuePendingHangupSync(hangup);
              void ws
                .send(WsType.CHANNEL_VOICE_LEAVE, {
                  channelId: activeChannel._id,
                })
                .then((ok) => {
                  if (ok) clearMatchingHangup(hangup);
                });
            } else if (target) {
              const hangup = {
                kind: "call_end" as const,
                from: myId,
                to: target._id,
              };
              queuePendingHangupSync(hangup);
              void ws
                .send(WsType.CALL_END, { from: myId, to: target._id })
                .then((ok) => {
                  if (ok) clearMatchingHangup(hangup);
                });
            }
          }
          resetCall();
        });
        room.on(RoomEvent.ParticipantConnected, updateParticipantCount);
        room.on(RoomEvent.ParticipantDisconnected, updateParticipantCount);

        await room.connect(url, token);
        if (connectGen !== connectGenRef.current || roomRef.current !== room) {
          room.removeAllListeners();
          room.disconnect();
          return;
        }

        await room.localParticipant.setMicrophoneEnabled(true);
        if (connectGen !== connectGenRef.current || roomRef.current !== room) {
          room.removeAllListeners();
          room.disconnect();
          return;
        }
        applyMicVolume(micVolumeRef.current);
        const { inputDeviceId, outputDeviceId } = loadVoiceSettings();
        if (inputDeviceId) {
          await room.switchActiveDevice("audioinput", inputDeviceId).catch(() => {});
        }
        if (outputDeviceId) {
          await room.switchActiveDevice("audiooutput", outputDeviceId).catch(() => {});
        }
        if (connectGen !== connectGenRef.current || roomRef.current !== room) {
          room.removeAllListeners();
          room.disconnect();
          return;
        }
        try {
          if (callMode === "video") {
            await room.localParticipant.setCameraEnabled(true);
            if (connectGen !== connectGenRef.current || roomRef.current !== room) {
              room.removeAllListeners();
              room.disconnect();
              return;
            }
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
        if (connectGen !== connectGenRef.current || roomRef.current !== room) {
          room.removeAllListeners();
          room.disconnect();
          return;
        }

        refreshLocalMediaTracks();
        window.setTimeout(() => {
          if (connectGen === connectGenRef.current && roomRef.current === room) {
            refreshLocalMediaTracks();
          }
        }, 250);
        window.setTimeout(() => {
          if (connectGen === connectGenRef.current && roomRef.current === room) {
            refreshLocalMediaTracks();
          }
        }, 800);

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
        stateRef.current = "active";
        setState("active");
      } catch (err) {
        if (connectGen !== connectGenRef.current) return;
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
      } finally {
        connectInFlightRef.current = false;
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

  const startCall = useCallback(
    (target: CallPeer, callMode: CallMode) => {
      if (!ws || !myId || stateRef.current !== "idle") return;

      for (const pending of peekAllPendingHangups()) {
        if (
          pending.kind !== "channel_leave" &&
          (pending.to === target._id || pending.from === target._id)
        ) {
          clearMatchingHangup(pending);
        }
      }
      setError(null);
      callKindRef.current = "dm";
      channelRef.current = null;
      peerRef.current = target;
      stateRef.current = "outgoing";
      setCallKind("dm");
      setChannel(null);
      setPeer(target);
      setMode(callMode);
      setState("outgoing");
      void (async () => {
        try {
          const ok = await ws.send(WsType.CALL_INVITE, {
            from: myId,
            to: target._id,
            mode: callMode,
          });
          if (!ok) {
            if (
              stateRef.current === "outgoing" &&
              peerRef.current?._id === target._id
            ) {
              setError(t("call.connectFailed"));
              resetCall();
            }
            return;
          }
          if (
            stateRef.current !== "outgoing" ||
            peerRef.current?._id !== target._id
          ) {

            queuePendingHangupSync({
              kind: "call_cancel",
              from: myId,
              to: target._id,
            });
            void ws
              .send(WsType.CALL_CANCEL, {
                from: myId,
                to: target._id,
              })
              .then((ok) => {
                if (ok) {
                  clearMatchingHangup({
                    kind: "call_cancel",
                    from: myId,
                    to: target._id,
                  });
                }
              });
            return;
          }
          clearRingTimeout();

          ringTimeoutRef.current = setTimeout(() => {
            if (stateRef.current !== "outgoing") return;
            const peerId = peerRef.current?._id;
            if (ws && myId && peerId) {

              const hangup = {
                kind: "call_timeout" as const,
                from: myId,
                to: peerId,
              };
              queuePendingHangupSync(hangup);
              void ws
                .send(WsType.CALL_TIMEOUT, { from: myId, to: peerId })
                .then((ok) => {
                  if (ok) clearMatchingHangup(hangup);
                });
            }
            resetCall();
          }, 60_000);
        } catch {
          if (
            stateRef.current === "outgoing" &&
            peerRef.current?._id === target._id
          ) {
            setError(t("call.connectFailed"));
            resetCall();
          }
        }
      })();
    },
    [ws, myId, clearRingTimeout, resetCall, t],
  );

  const joinChannelVoice = useCallback(
    (targetChannel: CallChannel, callMode: CallMode = "audio") => {
      if (!ws || !myId || stateRef.current !== "idle") return;
      voiceOpGenRef.current += 1;

      for (const pending of peekAllPendingHangups()) {
        if (
          pending.kind === "channel_leave" &&
          pending.channelId === targetChannel._id
        ) {
          clearMatchingHangup(pending);
        }
      }
      setError(null);
      callKindRef.current = "channel";
      channelRef.current = targetChannel;
      peerRef.current = null;
      stateRef.current = "connecting";
      setState("connecting");
      setCallKind("channel");
      setChannel(targetChannel);
      setPeer(null);
      setMode(callMode);
      void (async () => {
        try {
          const ok = await ws.send(WsType.CHANNEL_VOICE_JOIN, {
            channelId: targetChannel._id,
          });
          if (!ok) {
            if (
              callKindRef.current === "channel" &&
              channelRef.current?._id === targetChannel._id
            ) {
              setError(t("call.connectFailed"));
              resetCall();
            }
            return;
          }
          if (
            callKindRef.current !== "channel" ||
            channelRef.current?._id !== targetChannel._id
          ) {
            const hangup = {
              kind: "channel_leave" as const,
              channelId: targetChannel._id,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CHANNEL_VOICE_LEAVE, {
                channelId: targetChannel._id,
              })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
            return;
          }
          void connectToRoom(
            { kind: "channel", channelId: targetChannel._id },
            callMode,
          );
        } catch {
          if (
            callKindRef.current === "channel" &&
            channelRef.current?._id === targetChannel._id
          ) {
            setError(t("call.connectFailed"));
            resetCall();
          }
        }
      })();
    },
    [ws, myId, connectToRoom, resetCall, t],
  );

  const leaveChannelVoice = useCallback(() => {
    const activeChannel = channelRef.current;
    const opGen = ++voiceOpGenRef.current;
    if (ws && myId && activeChannel && callKindRef.current === "channel") {
      const hangup = {
        kind: "channel_leave" as const,
        channelId: activeChannel._id,
      };
      queuePendingHangupSync(hangup);
      const hangupGen = getPendingHangupGeneration();
      void ws
        .send(WsType.CHANNEL_VOICE_LEAVE, { channelId: activeChannel._id })
        .then((ok) => {
          if (opGen !== voiceOpGenRef.current) return;
          if (hangupGen !== getPendingHangupGeneration()) return;
          if (ok) clearMatchingHangup(hangup);
          else setError(t("call.connectFailed"));
        });
    }
    resetCall();
  }, [ws, myId, resetCall, t]);

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
    if (acceptInFlightRef.current || acceptedHereRef.current) return;
    setAcceptInFlightBoth(true);
    const peerId = target._id;
    const abortGen = acceptAbortGenRef.current;
    void (async () => {
      const ok = await claimDmAcceptAsync(peerId);
      if (abortGen !== acceptAbortGenRef.current) {
        if (ok) clearDmAcceptClaim(peerId);
        setAcceptInFlightBoth(false);
        return;
      }
      if (!ok) {

        setAcceptInFlightBoth(false);
        return;
      }
      if (stateRef.current !== "incoming" || peerRef.current?._id !== peerId) {
        clearDmAcceptClaim(peerId);
        setAcceptInFlightBoth(false);
        return;
      }
      acceptedHereRef.current = true;
      const sent = await ws.send(WsType.CALL_ACCEPT, { from: myId, to: peerId });
      if (abortGen !== acceptAbortGenRef.current) {
        clearDmAcceptClaim(peerId);
        setAcceptInFlightBoth(false);
        acceptedHereRef.current = false;
        if (sent) {
          const hangup = {
            kind: "call_end" as const,
            from: myId,
            to: peerId,
          };
          queuePendingHangupSync(hangup);
          void ws.send(WsType.CALL_END, { from: myId, to: peerId }).then((ok) => {
            if (ok) clearMatchingHangup(hangup);
          });
        }
        return;
      }
      if (!sent) {
        clearDmAcceptClaim(peerId);
        setAcceptInFlightBoth(false);
        acceptedHereRef.current = false;
        return;
      }

      clearAcceptTimeout();
      acceptTimeoutRef.current = setTimeout(() => {
        acceptTimeoutRef.current = undefined;
        if (
          stateRef.current === "incoming" &&
          peerRef.current?._id === peerId &&
          (acceptInFlightRef.current || acceptedHereRef.current)
        ) {
          if (ws && myId) {
            const hangup = {
              kind: "call_end" as const,
              from: myId,
              to: peerId,
            };
            queuePendingHangupSync(hangup);
            void ws.send(WsType.CALL_END, { from: myId, to: peerId }).then((ok) => {
              if (ok) clearMatchingHangup(hangup);
            });
          }
          clearDmAcceptClaim(peerId);
          resetCall();
        }
      }, 15_000);
    })();
  }, [ws, myId, resetCall, clearAcceptTimeout, setAcceptInFlightBoth]);

  const rejectCall = useCallback(() => {
    const target = peerRef.current;
    if (ws && myId && target) {
      const hangup = {
        kind: "call_reject" as const,
        from: myId,
        to: target._id,
      };
      queuePendingHangupSync(hangup);
      const hangupGen = getPendingHangupGeneration();
      void ws.send(WsType.CALL_REJECT, { from: myId, to: target._id }).then(
        (ok) => {
          if (hangupGen !== getPendingHangupGeneration()) return;
          if (ok) clearMatchingHangup(hangup);
          else setError(t("call.connectFailed"));
        },
      );
    }
    resetCall();
  }, [ws, myId, resetCall, t]);

  const cancelCall = useCallback(() => {
    const target = peerRef.current;
    if (ws && myId && target) {
      const hangup = {
        kind: "call_cancel" as const,
        from: myId,
        to: target._id,
      };
      queuePendingHangupSync(hangup);
      const hangupGen = getPendingHangupGeneration();
      void ws.send(WsType.CALL_CANCEL, { from: myId, to: target._id }).then(
        (ok) => {
          if (hangupGen !== getPendingHangupGeneration()) return;
          if (ok) clearMatchingHangup(hangup);
          else setError(t("call.connectFailed"));
        },
      );
    }
    resetCall();
  }, [ws, myId, resetCall, t]);

  const endCall = useCallback(() => {
    const target = peerRef.current;
    const activeChannel = channelRef.current;
    if (ws && myId) {
      if (callKindRef.current === "channel" && activeChannel) {
        const opGen = ++voiceOpGenRef.current;
        const hangup = {
          kind: "channel_leave" as const,
          channelId: activeChannel._id,
        };
        queuePendingHangupSync(hangup);
        const hangupGen = getPendingHangupGeneration();
        void ws
          .send(WsType.CHANNEL_VOICE_LEAVE, {
            channelId: activeChannel._id,
          })
          .then((ok) => {
            if (opGen !== voiceOpGenRef.current) return;
            if (hangupGen !== getPendingHangupGeneration()) return;
            if (ok) clearMatchingHangup(hangup);
            else setError(t("call.connectFailed"));
          });
      } else if (target) {
        const hangup = {
          kind: "call_end" as const,
          from: myId,
          to: target._id,
        };
        queuePendingHangupSync(hangup);
        const hangupGen = getPendingHangupGeneration();
        void ws.send(WsType.CALL_END, { from: myId, to: target._id }).then(
          (ok) => {
            if (hangupGen !== getPendingHangupGeneration()) return;
            if (ok) clearMatchingHangup(hangup);
            else setError(t("call.connectFailed"));
          },
        );
      }
    }
    resetCall();
  }, [ws, myId, resetCall, t]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const gen = ++muteGenRef.current;
    const next = !isMuted;
    setIsMuted(next);
    void room.localParticipant.setMicrophoneEnabled(!next).then(
      () => {
        if (gen !== muteGenRef.current) return;
        if (!next) applyMicVolume(micVolumeRef.current);
      },
      () => {
        if (gen !== muteGenRef.current) return;
        setIsMuted(!next);
      },
    );
  }, [isMuted, applyMicVolume]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const gen = ++cameraGenRef.current;
    const next = !isCameraOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      if (gen !== cameraGenRef.current) return;
      setIsCameraOn(next);
      refreshLocalMediaTracks();
      window.setTimeout(() => refreshLocalMediaTracks(), 300);
    } catch (err) {
      if (gen !== cameraGenRef.current) return;
      if (import.meta.env.DEV) {
        console.error("toggleCamera failed:", err);
      }
      setError(t("call.cameraFailed"));
    }
  }, [isCameraOn, refreshLocalMediaTracks, t]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const gen = ++screenShareGenRef.current;
    const next = !isScreenSharing;
    try {
      await room.localParticipant.setScreenShareEnabled(
        next,
        next
          ? buildScreenShareCaptureOptions(loadVoiceSettings().screenShareQuality)
          : undefined,
      );
      if (gen !== screenShareGenRef.current) return;
      setIsScreenSharing(next);
      refreshLocalMediaTracks();
      window.setTimeout(() => refreshLocalMediaTracks(), 300);
    } catch (err) {
      if (gen !== screenShareGenRef.current) return;
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
    const gen = ++pushToTalkGenRef.current;
    pushToTalkMutedBeforeRef.current = isMuted;
    setIsPushToTalkActive(true);
    void room.localParticipant.setMicrophoneEnabled(true).then(
      () => {

        if (
          gen !== pushToTalkGenRef.current ||
          !pushToTalkActiveRef.current
        ) {
          return;
        }
        setIsMuted(false);
      },
      () => {
        if (gen !== pushToTalkGenRef.current) return;
        pushToTalkActiveRef.current = false;
        setIsPushToTalkActive(false);
      },
    );
  }, [isMuted]);

  const stopPushToTalk = useCallback(() => {
    const room = roomRef.current;
    if (!room || !pushToTalkActiveRef.current) return;
    pushToTalkActiveRef.current = false;
    pushToTalkGenRef.current += 1;
    setIsPushToTalkActive(false);
    const restoreMuted = pushToTalkMutedBeforeRef.current;
    void room.localParticipant.setMicrophoneEnabled(!restoreMuted).then(
      () => {
        setIsMuted(restoreMuted);
      },
      () => {

        const pub = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        );
        setIsMuted(!(pub?.isMuted === false));
        setError(t("call.connectFailed"));
      },
    );
  }, [t]);

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

    void (async () => {
      restoreAttemptedRef.current = true;
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
          if (!active.active || !active.peerId) {
            restoreAttemptedRef.current = false;
            return;
          }
          if (stateRef.current !== "idle") return;
          peerId = active.peerId;
          callMode = active.mode === "video" ? "video" : "audio";
          restorePeer = { _id: peerId };
          try {
            const { friends } = await getFriends();
            if (stateRef.current !== "idle") return;
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

          }
        } catch {
          restoreAttemptedRef.current = false;
          return;
        }
      }

      if (stateRef.current !== "idle" || !peerId || !restorePeer) {
        if (stateRef.current === "idle") restoreAttemptedRef.current = false;
        return;
      }

      peerRef.current = restorePeer;
      callKindRef.current = "dm";
      channelRef.current = null;
      setPeer(restorePeer);
      setCallKind("dm");
      setChannel(null);
      setMode(callMode);
      await connectToRoom({ kind: "dm", peerId }, callMode, {
        startedAt: restoreStartedAt,
        isRestore: true,
      });

      if (stateRef.current === "idle") {
        restoreAttemptedRef.current = false;
      }
    })();
  }, [ws, myId, connectToRoom]);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const connectToRoomRef = useRef(connectToRoom);
  connectToRoomRef.current = connectToRoom;
  const resetCallRef = useRef(resetCall);
  resetCallRef.current = resetCall;
  const clearRingTimeoutRef = useRef(clearRingTimeout);
  clearRingTimeoutRef.current = clearRingTimeout;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!ws) return;

    const onIncoming = (data: {
      from: string;
      mode?: CallMode;
      caller?: CallPeer;
    }) => {
      if (stateRef.current !== "idle") {
        if (myId) {
          const hangup = {
            kind: "call_reject" as const,
            from: myId,
            to: data.from,
          };
          queuePendingHangupSync(hangup);
          void ws
            .send(WsType.CALL_REJECT, { from: myId, to: data.from })
            .then((ok) => {
              if (ok) clearMatchingHangup(hangup);
            });
        }
        return;
      }
      setError(null);
      const nextPeer = data.caller ?? { _id: data.from };
      callKindRef.current = "dm";
      channelRef.current = null;
      peerRef.current = nextPeer;
      stateRef.current = "incoming";
      setCallKind("dm");
      setChannel(null);
      setPeer(nextPeer);
      setMode(data.mode === "video" ? "video" : "audio");
      setState("incoming");
    };

    const onAccepted = (data: { from: string }) => {
      const target = peerRef.current;
      if (!target) return;
      const peerId = target._id;
      clearRingTimeoutRef.current();
      clearAcceptTimeout();

      if (stateRef.current === "outgoing" && data.from === peerId) {
        connectToRoomRef.current({ kind: "dm", peerId }, modeRef.current);
        return;
      }
      if (stateRef.current === "incoming" && data.from === myId) {

        const mine =
          acceptedHereRef.current && thisTabOwnsDmAccept(peerId);
        acceptedHereRef.current = false;
        setAcceptInFlightBoth(false);
        if (mine) {
          clearDmAcceptClaim(peerId);
          connectToRoomRef.current({ kind: "dm", peerId }, modeRef.current);
        } else {
          resetCallRef.current();
        }
      }
    };

    const onRejected = (data: { from: string }) => {
      const target = peerRef.current;
      if (!target) return;

      if (
        (stateRef.current === "outgoing" && data.from === target._id) ||
        (stateRef.current === "incoming" && data.from === myId)
      ) {
        if (stateRef.current === "outgoing") {
          setError(tRef.current("call.rejected"));
        }
        resetCallRef.current();
      }
    };

    const onCancelled = (data: { from: string }) => {
      const target = peerRef.current;
      const state = stateRef.current;
      if (!target) return;

      if (
        (state === "incoming" || state === "outgoing") &&
        (data.from === target._id || data.from === myId)
      ) {
        resetCallRef.current();
      }
    };

    const onEnded = (data: { from: string }) => {

      if (callKindRef.current === "channel") return;
      const target = peerRef.current;
      if (!target || data.from === myId || data.from === target._id) {
        resetCallRef.current();
      }
    };

    const onUnavailable = (data: { reason?: string }) => {
      const state = stateRef.current;
      if (state === "outgoing") {
        setError(
          data.reason === "BUSY"
            ? tRef.current("call.peerBusy")
            : data.reason === "NOT_FRIENDS"
              ? tRef.current("call.unavailable")
              : tRef.current("call.unavailable"),
        );
        resetCallRef.current();
        return;
      }

      if (
        state === "incoming" ||
        state === "connecting" ||
        state === "active"
      ) {
        const kind = callKindRef.current;
        const target = peerRef.current;
        const activeChannel = channelRef.current;
        if (ws && myId) {
          if (kind === "channel" && activeChannel) {
            const hangup = {
              kind: "channel_leave" as const,
              channelId: activeChannel._id,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CHANNEL_VOICE_LEAVE, {
                channelId: activeChannel._id,
              })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
          } else if (target) {
            if (state === "incoming" && !acceptedHereRef.current) {
              const hangup = {
                kind: "call_reject" as const,
                from: myId,
                to: target._id,
              };
              queuePendingHangupSync(hangup);
              void ws
                .send(WsType.CALL_REJECT, {
                  from: myId,
                  to: target._id,
                })
                .then((ok) => {
                  if (ok) clearMatchingHangup(hangup);
                });
            } else {
              const hangup = {
                kind: "call_end" as const,
                from: myId,
                to: target._id,
              };
              queuePendingHangupSync(hangup);
              void ws
                .send(WsType.CALL_END, { from: myId, to: target._id })
                .then((ok) => {
                  if (ok) clearMatchingHangup(hangup);
                });
            }
          }
        }
        resetCallRef.current();
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
  }, [ws, myId, clearAcceptTimeout, setAcceptInFlightBoth]);

  useEffect(() => {
    if (!ws) return;
    const leaveIfActiveChannel = (channelId?: string) => {
      if (!channelId) return;
      if (
        callKindRef.current === "channel" &&
        channelRef.current?._id === channelId &&
        stateRef.current !== "idle"
      ) {
        leaveChannelVoice();
      }
      setChannelVoiceParticipants((prev) => {
        if (!(channelId in prev)) return prev;
        const next = { ...prev };
        delete next[channelId];
        return next;
      });
    };
    const unsubs = [
      ws.subscribe(WsType.CHANNEL_DELETED, (e: { channelId?: string }) =>
        leaveIfActiveChannel(e.channelId),
      ),
      ws.subscribe(WsType.CHANNEL_LEFT, (e: { channelId?: string }) =>
        leaveIfActiveChannel(e.channelId),
      ),
      ws.subscribe(
        WsType.CHANNEL_MEMBER_LEFT,
        (e: { channelId?: string; userId?: string }) => {
          if (!e.channelId) return;

          if (e.userId && myId && e.userId === myId) {
            leaveIfActiveChannel(e.channelId);
            return;
          }

          setChannelVoiceParticipants((prev) => {
            const list = prev[e.channelId!];
            if (!list || !e.userId) return prev;
            const nextList = list.filter((id) => id !== e.userId);
            if (nextList.length === list.length) return prev;
            return { ...prev, [e.channelId!]: nextList };
          });
        },
      ),
      ws.subscribe(WsType.FRIENDSHIP_REMOVED, (e: { userId?: string }) => {
        const peerId = e.userId;
        if (!peerId) return;
        if (
          callKindRef.current !== "dm" ||
          peerRef.current?._id !== peerId ||
          stateRef.current === "idle"
        ) {
          return;
        }
        const state = stateRef.current;
        if (ws && myId) {
          if (state === "outgoing") {
            const hangup = {
              kind: "call_cancel" as const,
              from: myId,
              to: peerId,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CALL_CANCEL, { from: myId, to: peerId })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
          } else if (
            state === "incoming" &&
            !acceptedHereRef.current &&
            !acceptInFlightRef.current
          ) {
            const hangup = {
              kind: "call_reject" as const,
              from: myId,
              to: peerId,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CALL_REJECT, { from: myId, to: peerId })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
          } else {
            const hangup = {
              kind: "call_end" as const,
              from: myId,
              to: peerId,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CALL_END, { from: myId, to: peerId })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
          }
        }
        resetCall();
      }),
      ws.subscribe(WsType.CONVERSATION_DELETED, (e: { contactId?: string }) => {
        const peerId = e.contactId;
        if (!peerId) return;
        if (
          callKindRef.current !== "dm" ||
          peerRef.current?._id !== peerId ||
          stateRef.current === "idle"
        ) {
          return;
        }
        const state = stateRef.current;
        if (ws && myId) {
          if (state === "outgoing") {
            const hangup = {
              kind: "call_cancel" as const,
              from: myId,
              to: peerId,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CALL_CANCEL, { from: myId, to: peerId })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
          } else if (
            state === "incoming" &&
            !acceptedHereRef.current &&
            !acceptInFlightRef.current
          ) {
            const hangup = {
              kind: "call_reject" as const,
              from: myId,
              to: peerId,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CALL_REJECT, { from: myId, to: peerId })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
          } else {
            const hangup = {
              kind: "call_end" as const,
              from: myId,
              to: peerId,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CALL_END, { from: myId, to: peerId })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
          }
        }
        resetCall();
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [ws, leaveChannelVoice, myId, resetCall]);

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

  useEffect(() => {
    if (!ws || !wsConnected) return;
    let cancelled = false;
    let attempt = 0;
    const flushOne = async (hangup: PendingHangup) => {
      if (hangup.kind === "channel_leave") {
        return ws.send(WsType.CHANNEL_VOICE_LEAVE, {
          channelId: hangup.channelId,
        });
      }
      if (hangup.kind === "call_cancel") {
        return ws.send(WsType.CALL_CANCEL, {
          from: hangup.from,
          to: hangup.to,
        });
      }
      if (hangup.kind === "call_timeout") {
        return ws.send(WsType.CALL_TIMEOUT, {
          from: hangup.from,
          to: hangup.to,
        });
      }
      if (hangup.kind === "call_reject") {
        return ws.send(WsType.CALL_REJECT, {
          from: hangup.from,
          to: hangup.to,
        });
      }
      return ws.send(WsType.CALL_END, {
        from: hangup.from,
        to: hangup.to,
      });
    };
    const flush = () => {
      if (cancelled) return;
      void (async () => {
        let anyFail = false;

        while (!cancelled) {
          const hangup = takePendingHangup();
          if (!hangup) break;
          const ok = await flushOne(hangup);
          if (cancelled) {
            if (!ok) queuePendingHangupSync(hangup);
            return;
          }
          if (ok) {
            continue;
          }
          queuePendingHangupSync(hangup);
          anyFail = true;
          break;
        }
        if (anyFail) {
          attempt += 1;
          if (attempt <= 5) {
            window.setTimeout(flush, Math.min(8_000, 500 * 2 ** (attempt - 1)));
          }
        }
      })();
    };
    flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        attempt = 0;
        flush();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ws, wsConnected]);

  const voiceWasConnectedRef = useRef(wsConnected);
  useEffect(() => {
    const was = voiceWasConnectedRef.current;
    voiceWasConnectedRef.current = wsConnected;
    if (!ws || !wsConnected || was) return;
    const activeChannelId = channelRef.current?._id;
    const inChannelVoice =
      callKindRef.current === "channel" &&
      activeChannelId &&
      stateRef.current !== "idle";
    if (inChannelVoice && activeChannelId) {
      ws.send(WsType.CHANNEL_VOICE_JOIN, { channelId: activeChannelId });
      ws.send(WsType.CHANNEL_VOICE_STATE, { channelId: activeChannelId });
    }
  }, [ws, wsConnected]);

  useEffect(() => {
    const hangUpFromRefs = () => {
      const state = stateRef.current;
      if (!ws || !myId || state === "idle") return;
      const kind = callKindRef.current;
      const target = peerRef.current;
      const activeChannel = channelRef.current;
      clearPersistedCall();

      if (state === "incoming") {
        if (acceptedHereRef.current || acceptInFlightRef.current) {
          if (target) {
            clearDmAcceptClaim(target._id);
            const hangup = {
              kind: "call_end" as const,
              from: myId,
              to: target._id,
            };
            queuePendingHangupSync(hangup);
            void ws
              .send(WsType.CALL_END, { from: myId, to: target._id })
              .then((ok) => {
                if (ok) clearMatchingHangup(hangup);
              });
          }
          resetCall();
        }
        return;
      }

      if (kind === "channel" && activeChannel) {
        const hangup = {
          kind: "channel_leave" as const,
          channelId: activeChannel._id,
        };
        queuePendingHangupSync(hangup);
        void ws
          .send(WsType.CHANNEL_VOICE_LEAVE, {
            channelId: activeChannel._id,
          })
          .then((ok) => {
            if (ok) clearMatchingHangup(hangup);
          });
        resetCall();
        return;
      }
      if (!target) {
        resetCall();
        return;
      }
      if (state === "outgoing") {
        const hangup = {
          kind: "call_cancel" as const,
          from: myId,
          to: target._id,
        };
        queuePendingHangupSync(hangup);
        void ws
          .send(WsType.CALL_CANCEL, { from: myId, to: target._id })
          .then((ok) => {
            if (ok) clearMatchingHangup(hangup);
          });
      } else if (state === "connecting" || state === "active") {
        const hangup = {
          kind: "call_end" as const,
          from: myId,
          to: target._id,
        };
        queuePendingHangupSync(hangup);
        void ws
          .send(WsType.CALL_END, { from: myId, to: target._id })
          .then((ok) => {
            if (ok) clearMatchingHangup(hangup);
          });
      }
      resetCall();
    };
    const hangUpOnUnload = () => {
      hangUpFromRefs();
    };
    window.addEventListener("pagehide", hangUpOnUnload);
    const unsubRevoked = ws
      ? ws.subscribe(WsType.SESSION_REVOKED, () => {
          hangUpFromRefs();
        })
      : () => {};
    return () => {
      window.removeEventListener("pagehide", hangUpOnUnload);
      unsubRevoked();

      hangUpFromRefs();
      cleanupRoom();
    };
  }, [ws, myId, cleanupRoom, resetCall]);

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
      acceptInFlight,
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
      acceptInFlight,
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
