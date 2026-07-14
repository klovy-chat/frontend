import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { userLabel } from "../../utils/user/format";
import { useCall } from "../../context/CallContext";
import "../../styles/call/call-view.css";

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function CtrlButton({
  onClick,
  title,
  active = false,
  danger = false,
  children,
}: {
  onClick?: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const className = [
    "call-view__btn",
    active && "call-view__btn--active",
    danger && "call-view__btn--danger",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" title={title} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function CallView() {
  const { t } = useTranslation();
  const {
    state,
    mode,
    peer,
    isMuted,
    isCameraOn,
    startedAt,
    localVideoTrack,
    remoteVideoTrack,
    toggleMute,
    toggleCamera,
    endCall,
    cancelCall,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localVideoTrack) {
      localVideoTrack.attach(el);
      return () => {
        localVideoTrack.detach(el);
      };
    }
  }, [localVideoTrack]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el && remoteVideoTrack) {
      remoteVideoTrack.attach(el);
      return () => {
        remoteVideoTrack.detach(el);
      };
    }
  }, [remoteVideoTrack]);

  useEffect(() => {
    if (state !== "active" || !startedAt) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - startedAt);
    const id = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, startedAt]);

  if (state !== "outgoing" && state !== "connecting" && state !== "active") {
    return null;
  }
  if (!peer) return null;

  const name = userLabel(peer);
  const statusText =
    state === "outgoing"
      ? t("call.status.calling")
      : state === "connecting"
        ? t("call.status.connecting")
        : formatDuration(elapsed);

  const showRemoteVideo = state === "active" && Boolean(remoteVideoTrack);
  const showLocalVideo = isCameraOn && Boolean(localVideoTrack);
  const isVideoCall = mode === "video";

  return (
    <div className={`call-view${isVideoCall ? " call-view--video" : ""}`}>
      <div className="call-view__stage">
        {showRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="call-view__remote"
          />
        ) : (
          <div className="call-view__avatar-wrap">
            <Avatar
              displayName={peer.displayName}
              username={peer.username}
              image={peer.image}
              color={peer.color}
              size={72}
            />
          </div>
        )}

        {showLocalVideo && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="call-view__local"
          />
        )}
      </div>

      <div className="call-view__info">
        <div className="call-view__name">{name}</div>
        <div className="call-view__status">{statusText}</div>
      </div>

      <div className="call-view__controls">
        <CtrlButton
          title={isMuted ? t("call.controls.unmuteMic") : t("call.controls.muteMic")}
          active={isMuted}
          onClick={toggleMute}
        >
          {isMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          )}
        </CtrlButton>

        {isVideoCall && (
          <CtrlButton
            title={isCameraOn ? t("call.controls.disableCamera") : t("call.controls.enableCamera")}
            active={!isCameraOn}
            onClick={toggleCamera}
          >
            {isCameraOn ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </CtrlButton>
        )}

        <CtrlButton
          title={t("call.controls.end")}
          danger
          onClick={state === "outgoing" ? cancelCall : endCall}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(135deg)" }}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l1.14-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </CtrlButton>
      </div>
    </div>
  );
}
