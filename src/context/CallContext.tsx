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
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from "livekit-client";
import { useWebSocket } from "./WebSocketContext";
import { WsType } from "../api/wsProtocol";
import { useAuth } from "./AuthContext";
import { isAllowedLiveKitUrl } from "../utils/env/livekitAllowlist";
import { applyAudioOutputDevice, loadVoiceSettings } from "../utils/media/voiceSettings";
import { requestVoiceToken } from "../api/voice";

export type CallMode = "audio" | "video";

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

interface CallContextValue {
  state: CallState;
  mode: CallMode;
  peer: CallPeer | null;
  isMuted: boolean;
  isCameraOn: boolean;
  error: string | null;
  startedAt: number | null;
  localVideoTrack: Track | null;
  remoteVideoTrack: Track | null;
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
  clearError: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const ws = useWebSocket();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const [state, setState] = useState<CallState>("idle");
  const [mode, setMode] = useState<CallMode>("audio");
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<Track | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<Track | null>(null);

  const roomRef = useRef<Room | null>(null);
  const stateRef = useRef<CallState>(state);
  stateRef.current = state;
  const peerRef = useRef<CallPeer | null>(peer);
  peerRef.current = peer;
  // Ukryte elementy <audio> dla zdalnych ścieżek dźwięku.
  const audioElsRef = useRef<HTMLAudioElement[]>([]);

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
    setRemoteVideoTrack(null);
  }, []);

  const resetCall = useCallback(() => {
    cleanupRoom();
    setState("idle");
    setPeer(null);
    setMode("audio");
    setIsMuted(false);
    setIsCameraOn(false);
    setStartedAt(null);
  }, [cleanupRoom]);

  const attachRemoteTrack = useCallback(
    (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack(track);
      } else if (track.kind === Track.Kind.Audio) {
        const el = track.attach() as HTMLAudioElement;
        el.style.display = "none";
        el.autoplay = true;
        document.body.appendChild(el);
        void applyAudioOutputDevice(el);
        audioElsRef.current.push(el);
      }
    },
    [],
  );

  const detachRemoteTrack = useCallback((track: RemoteTrack) => {
    if (track.kind === Track.Kind.Video) {
      setRemoteVideoTrack(null);
    } else if (track.kind === Track.Kind.Audio) {
      track.detach().forEach((el) => {
        (el as HTMLMediaElement).srcObject = null;
        el.remove();
      });
      audioElsRef.current = audioElsRef.current.filter(
        (el) => el.isConnected,
      );
    }
  }, []);

  const refreshLocalVideoTrack = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(
      Track.Source.Camera,
    );
    setLocalVideoTrack(pub?.track ?? null);
  }, []);

  const connectToRoom = useCallback(
    async (peerId: string, callMode: CallMode) => {
      try {
        setState("connecting");
        const { token, url } = await requestVoiceToken(peerId);
        if (!isAllowedLiveKitUrl(url)) {
          throw new Error(t("call.invalidServerUrl"));
        }

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(
          RoomEvent.TrackSubscribed,
          (
            track: RemoteTrack,
            _pub: RemoteTrackPublication,
            _participant: RemoteParticipant,
          ) => attachRemoteTrack(track),
        );
        room.on(
          RoomEvent.TrackUnsubscribed,
          (track: RemoteTrack) => detachRemoteTrack(track),
        );
        room.on(RoomEvent.Disconnected, () => {
          // Rozłączenie zainicjowane lokalnie obsługujemy w endCall;
          // tutaj reagujemy tylko na nieoczekiwane rozłączenie.
          if (stateRef.current === "active") {
            resetCall();
          }
        });

        await room.connect(url, token);

        await room.localParticipant.setMicrophoneEnabled(true);
        const { inputDeviceId, outputDeviceId } = loadVoiceSettings();
        if (inputDeviceId) {
          await room.switchActiveDevice("audioinput", inputDeviceId).catch(() => {});
        }
        if (outputDeviceId) {
          await room.switchActiveDevice("audiooutput", outputDeviceId).catch(() => {});
        }
        if (callMode === "video") {
          await room.localParticipant.setCameraEnabled(true);
          setIsCameraOn(true);
        } else {
          setIsCameraOn(false);
        }
        refreshLocalVideoTrack();

        // Podłącz już istniejące zdalne ścieżki (gdyby druga strona
        // dołączyła wcześniej).
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.track) attachRemoteTrack(pub.track as RemoteTrack);
          });
        });

        setIsMuted(false);
        setStartedAt(Date.now());
        setState("active");
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to connect to call room:", err);
        }
        setError(t("call.connectFailed"));
        const other = peerRef.current?._id;
        if (ws && other && myId) {
          ws.send(WsType.CALL_END, { from: myId, to: other });
        }
        resetCall();
      }
    },
    [
      attachRemoteTrack,
      detachRemoteTrack,
      refreshLocalVideoTrack,
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
      setPeer(target);
      setMode(callMode);
      setState("outgoing");
      ws.send(WsType.CALL_INVITE, {
        from: myId,
        to: target._id,
        mode: callMode,
      });
    },
    [ws, myId],
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
    if (ws && myId && target) {
      ws.send(WsType.CALL_END, { from: myId, to: target._id });
    }
    resetCall();
  }, [ws, myId, resetCall]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isMuted;
    room.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isCameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setIsCameraOn(next);
    refreshLocalVideoTrack();
  }, [isCameraOn, refreshLocalVideoTrack]);

  const clearError = useCallback(() => setError(null), []);

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
      setPeer(data.caller ?? { _id: data.from });
      setMode(data.mode === "video" ? "video" : "audio");
      setState("incoming");
    };

    const onAccepted = (data: { from: string }) => {
      const target = peerRef.current;
      if (!target) return;
      const peerId = target._id;

      if (stateRef.current === "outgoing" && data.from === peerId) {
        connectToRoom(peerId, mode);
        return;
      }
      if (stateRef.current === "incoming" && data.from === myId) {
        connectToRoom(peerId, mode);
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
          data.reason === "OFFLINE"
            ? t("call.peerOffline")
            : data.reason === "BUSY"
              ? t("call.peerBusy")
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
  }, [ws, myId, mode, connectToRoom, resetCall, t]);

  // Sprzątanie przy odmontowaniu (np. wylogowanie).
  useEffect(() => {
    return () => cleanupRoom();
  }, [cleanupRoom]);

  const value = useMemo<CallContextValue>(
    () => ({
      state,
      mode,
      peer,
      isMuted,
      isCameraOn,
      error,
      startedAt,
      localVideoTrack,
      remoteVideoTrack,
      startCall,
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
      toggleMute,
      toggleCamera,
      clearError,
    }),
    [
      state,
      mode,
      peer,
      isMuted,
      isCameraOn,
      error,
      startedAt,
      localVideoTrack,
      remoteVideoTrack,
      startCall,
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
      toggleMute,
      toggleCamera,
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
