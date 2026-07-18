import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Maximize2,
  Minimize2,
  X,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
} from "lucide-react";
import { Avatar } from "../common/Avatar";
import { userLabel } from "../../utils/user/format";
import { useCall } from "../../context/CallContext";
import "../../styles/call/call-view.css";

type CallLayout = "expanded" | "minimized" | "fullscreen";

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
  disabled = false,
  className: extraClassName,
  children,
}: {
  onClick?: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const className = [
    "call-view__btn",
    active && "call-view__btn--active",
    danger && "call-view__btn--danger",
    extraClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={className}
      disabled={disabled}
    >
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
    isScreenSharing,
    isPushToTalkActive,
    speakerVolume,
    startedAt,
    localVideoTrack,
    remoteVideoTrack,
    remoteScreenShareTrack,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    startPushToTalk,
    setSpeakerVolume,
    endCall,
    cancelCall,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [layout, setLayout] = useState<CallLayout>("expanded");
  const [mainPortalTarget, setMainPortalTarget] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const mainRemoteTrack = remoteScreenShareTrack ?? remoteVideoTrack;

  useEffect(() => {
    setMainPortalTarget(
      document.querySelector(".app-shell__main") as HTMLElement | null,
    );
  }, []);

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
    if (el && mainRemoteTrack) {
      mainRemoteTrack.attach(el);
      return () => {
        mainRemoteTrack.detach(el);
      };
    }
  }, [mainRemoteTrack]);

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

  useEffect(() => {
    if (state === "idle") {
      setLayout("expanded");
      setPos(null);
    }
  }, [state]);

  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (layout !== "minimized") return;
    if ((e.target as HTMLElement).closest("button, input, label")) return;
    const panel = e.currentTarget;
    const rect = panel.getBoundingClientRect();
    const next = pos ?? { x: rect.left, y: rect.top };
    if (!pos) setPos(next);
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - next.x,
      offsetY: e.clientY - next.y,
    };
    panel.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const panel = e.currentTarget;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    setPos({
      x: Math.min(maxX, Math.max(8, e.clientX - drag.offsetX)),
      y: Math.min(maxY, Math.max(8, e.clientY - drag.offsetY)),
    });
  };

  const onDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const handleMinimizedClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (layout !== "minimized") return;
    if ((event.target as HTMLElement).closest("button, input, label")) return;
    setLayout("fullscreen");
    setPos(null);
  };

  const handlePushToTalkStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (state !== "active") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startPushToTalk();
  };

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

  const showRemoteVideo = state === "active" && Boolean(mainRemoteTrack);
  const showLocalVideo = isCameraOn && Boolean(localVideoTrack);
  const isVideoCall = mode === "video";
  const controlsLive = state === "active";
  const isLargeLayout = layout === "expanded" || layout === "fullscreen";

  const style =
    layout === "minimized" && pos != null
      ? ({ left: pos.x, top: pos.y, right: "auto", bottom: "auto" } as const)
      : undefined;

  const panel = (
    <div
      className={[
        "call-view",
        isVideoCall && "call-view--video",
        layout === "expanded" && "call-view--expanded",
        layout === "minimized" && "call-view--minimized",
        layout === "fullscreen" && "call-view--fullscreen",
        layout === "minimized" && pos && "call-view--dragged",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onClick={handleMinimizedClick}
      role={layout === "minimized" ? "button" : undefined}
      tabIndex={layout === "minimized" ? 0 : undefined}
      onKeyDown={(event) => {
        if (layout !== "minimized") return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setLayout("fullscreen");
          setPos(null);
        }
      }}
      aria-label={
        layout === "minimized"
          ? t("call.layout.openFullscreen", { name })
          : undefined
      }
    >
      <header className="call-view__header">
        <div className="call-view__header-main">
          {layout === "minimized" ? (
            <Avatar
              displayName={peer.displayName}
              username={peer.username}
              image={peer.image}
              color={peer.color}
              size={36}
            />
          ) : null}
          <div className="call-view__header-text">
            <div className="call-view__name">{name}</div>
            <div className="call-view__status">{statusText}</div>
          </div>
        </div>

        <div className="call-view__header-actions">
          {layout === "expanded" && (
            <button
              type="button"
              className="call-view__icon-btn"
              title={t("call.controls.fullscreen")}
              aria-label={t("call.controls.fullscreen")}
              onClick={() => setLayout("fullscreen")}
            >
              <Maximize2 size={18} strokeWidth={2} />
            </button>
          )}
          {layout === "fullscreen" && (
            <button
              type="button"
              className="call-view__icon-btn"
              title={t("call.controls.restore")}
              aria-label={t("call.controls.restore")}
              onClick={() => setLayout("expanded")}
            >
              <Minimize2 size={18} strokeWidth={2} />
            </button>
          )}
          {isLargeLayout && (
            <button
              type="button"
              className="call-view__icon-btn"
              title={t("call.controls.minimize")}
              aria-label={t("call.controls.minimize")}
              onClick={() => setLayout("minimized")}
            >
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      {layout !== "minimized" && (
        <div className="call-view__stage">
          {showRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={[
                "call-view__remote",
                remoteScreenShareTrack && "call-view__remote--screen",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          ) : (
            <div className="call-view__avatar-wrap">
              <Avatar
                displayName={peer.displayName}
                username={peer.username}
                image={peer.image}
                color={peer.color}
                size={isLargeLayout ? 112 : 72}
              />
              {!showRemoteVideo && state === "active" && (
                <p className="call-view__stage-label">{name}</p>
              )}
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
      )}

      {controlsLive && isLargeLayout && (
        <div className="call-view__levels">
          <label className="call-view__level">
            <span>{t("call.controls.speakerLevel")}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(speakerVolume * 100)}
              onChange={(e) => setSpeakerVolume(Number(e.target.value) / 100)}
            />
          </label>
        </div>
      )}

      <div className="call-view__controls">
        {layout !== "minimized" && (
          <>
            <CtrlButton
              title={isMuted ? t("call.controls.unmuteMic") : t("call.controls.muteMic")}
              active={isMuted}
              disabled={!controlsLive}
              onClick={toggleMute}
            >
              {isMuted ? <MicOff size={20} strokeWidth={2} /> : <Mic size={20} strokeWidth={2} />}
            </CtrlButton>

            <button
              type="button"
              className={[
                "call-view__btn",
                "call-view__btn--ptt",
                isPushToTalkActive && "call-view__btn--active",
              ]
                .filter(Boolean)
                .join(" ")}
              title={t("call.controls.pushToTalk")}
              aria-label={t("call.controls.pushToTalk")}
              disabled={!controlsLive}
              onPointerDown={handlePushToTalkStart}
            >
              <span className="call-view__ptt-label">{t("call.controls.pushToTalkShort")}</span>
            </button>

            <CtrlButton
              title={
                isScreenSharing
                  ? t("call.controls.stopShareScreen")
                  : t("call.controls.shareScreen")
              }
              active={isScreenSharing}
              disabled={!controlsLive}
              onClick={() => void toggleScreenShare()}
            >
              {isScreenSharing ? (
                <MonitorOff size={20} strokeWidth={2} />
              ) : (
                <Monitor size={20} strokeWidth={2} />
              )}
            </CtrlButton>

            <CtrlButton
              title={isCameraOn ? t("call.controls.disableCamera") : t("call.controls.enableCamera")}
              active={!isCameraOn}
              disabled={!controlsLive}
              onClick={() => void toggleCamera()}
            >
              {isCameraOn ? (
                <Video size={20} strokeWidth={2} />
              ) : (
                <VideoOff size={20} strokeWidth={2} />
              )}
            </CtrlButton>
          </>
        )}

        <CtrlButton
          title={t("call.controls.end")}
          danger
          onClick={state === "outgoing" ? cancelCall : endCall}
        >
          <PhoneOff size={20} strokeWidth={2} />
        </CtrlButton>
      </div>
    </div>
  );

  if (layout === "expanded" && mainPortalTarget) {
    return createPortal(panel, mainPortalTarget);
  }

  return panel;
}
