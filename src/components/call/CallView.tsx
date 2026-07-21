import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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

type CallLayout = "floating" | "minimized" | "fullscreen";

function getDefaultFloatingPosition(isVideoCall: boolean) {
  const panelW = Math.min(isVideoCall ? 360 : 300, window.innerWidth - 24);
  const panelH = isVideoCall ? 420 : 380;
  return {
    x: Math.max(8, window.innerWidth - panelW - 20),
    y: Math.max(8, window.innerHeight - panelH - 28),
  };
}

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
    callKind,
    mode,
    peer,
    channel,
    participantCount,
    isMuted,
    isCameraOn,
    isScreenSharing,
    isPushToTalkActive,
    speakerVolume,
    startedAt,
    localVideoTrack,
    localScreenShareTrack,
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
  const localScreenShareRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [layout, setLayout] = useState<CallLayout>("floating");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const autoFloatedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (state === "idle") {
      setLayout("floating");
      setPos(null);
      autoFloatedRef.current = false;
    }
  }, [state]);

  useEffect(() => {
    if (state !== "outgoing" && state !== "connecting" && state !== "active") return;
    if (autoFloatedRef.current) return;
    autoFloatedRef.current = true;
    setLayout("floating");
    setPos(getDefaultFloatingPosition(mode === "video"));
  }, [state, mode]);

  const isDraggableLayout = layout === "floating" || layout === "minimized";

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
    const el = localScreenShareRef.current;
    if (el && localScreenShareTrack) {
      localScreenShareTrack.attach(el);
      return () => {
        localScreenShareTrack.detach(el);
      };
    }
  }, [localScreenShareTrack]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    const track = remoteScreenShareTrack ?? remoteVideoTrack;
    if (el && track) {
      track.attach(el);
      return () => {
        track.detach(el);
      };
    }
  }, [remoteScreenShareTrack, remoteVideoTrack]);

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

  const clampPanelPosition = (
    x: number,
    y: number,
    panel: HTMLElement,
  ): { x: number; y: number } => {
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return {
      x: Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(8, y)),
    };
  };

  const onDragStart = (e: ReactPointerEvent<HTMLElement>) => {
    if (!isDraggableLayout) return;
    if ((e.target as HTMLElement).closest("button, input, label")) return;
    const panel = e.currentTarget.closest(".call-view") as HTMLDivElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const next = pos ?? { x: rect.left, y: rect.top };
    if (!pos) setPos(next);
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - next.x,
      offsetY: e.clientY - next.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const panel = e.currentTarget.closest(".call-view") as HTMLDivElement | null;
    if (!panel) return;
    const nextX = e.clientX - drag.offsetX;
    const nextY = e.clientY - drag.offsetY;
    if (Math.abs(nextX - (pos?.x ?? nextX)) > 4 || Math.abs(nextY - (pos?.y ?? nextY)) > 4) {
      drag.moved = true;
    }
    setPos(clampPanelPosition(nextX, nextY, panel));
  };

  const onDragEnd = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const openFullscreen = () => {
    setLayout("fullscreen");
    setPos(null);
  };

  const restoreFloating = () => {
    setLayout("floating");
    setPos((current) => current ?? getDefaultFloatingPosition(mode === "video"));
  };

  const minimizeWithPosition = () => {
    setPos((current) => current ?? getDefaultFloatingPosition(mode === "video"));
    setLayout("minimized");
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
  if (!peer && !channel) return null;

  const isChannelCall = callKind === "channel" && channel;
  const name = isChannelCall ? `#${channel.name}` : peer ? userLabel(peer) : "";
  const statusText =
    state === "outgoing"
      ? t("call.status.calling")
      : state === "connecting"
        ? t("call.status.connecting")
        : isChannelCall
          ? t("call.channel.participants", { count: participantCount })
          : formatDuration(elapsed);

  const mainRemoteTrack = remoteScreenShareTrack ?? remoteVideoTrack;
  const showRemoteVideo = state === "active" && Boolean(mainRemoteTrack);
  const showLocalScreenPreview =
    state === "active" && isScreenSharing && Boolean(localScreenShareTrack);
  const showLocalScreenInMain = showLocalScreenPreview && !showRemoteVideo;
  const showLocalVideo = isCameraOn && Boolean(localVideoTrack);
  const showLocalPip = showLocalVideo && (showRemoteVideo || showLocalScreenInMain || !showLocalScreenPreview);
  const isVideoCall = mode === "video";
  const controlsLive = state === "active";
  const isLargeLayout = layout === "floating" || layout === "fullscreen";

  const style =
    isDraggableLayout && pos != null
      ? ({ left: pos.x, top: pos.y, right: "auto", bottom: "auto" } as const)
      : undefined;

  const panel = (
    <div
      className={[
        "call-view",
        isVideoCall && "call-view--video",
        layout === "floating" && "call-view--floating",
        layout === "minimized" && "call-view--minimized",
        layout === "fullscreen" && "call-view--fullscreen",
        isDraggableLayout && pos && "call-view--dragged",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <header
        className={[
          "call-view__header",
          isDraggableLayout && "call-view__header--draggable",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="call-view__header-main">
          {layout === "minimized" ? (
            isChannelCall ? (
              <Avatar
                displayName={channel.name}
                username={channel.name}
                image={channel.image}
                size={36}
              />
            ) : peer ? (
              <Avatar
                displayName={peer.displayName}
                username={peer.username}
                image={peer.image}
                color={peer.color}
                size={36}
              />
            ) : null
          ) : null}
          <div className="call-view__header-text">
            <div className="call-view__name">{name}</div>
            <div className="call-view__status">{statusText}</div>
          </div>
        </div>

        <div className="call-view__header-actions">
          {layout === "minimized" && (
            <button
              type="button"
              className="call-view__icon-btn"
              title={t("call.controls.restore")}
              aria-label={t("call.controls.restore")}
              onClick={restoreFloating}
            >
              <Maximize2 size={16} strokeWidth={2} />
            </button>
          )}
          {layout === "floating" && (
            <button
              type="button"
              className="call-view__icon-btn"
              title={t("call.controls.fullscreen")}
              aria-label={t("call.controls.fullscreen")}
              onClick={openFullscreen}
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
              onClick={restoreFloating}
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
              onClick={minimizeWithPosition}
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
          ) : showLocalScreenInMain ? (
            <video
              ref={localScreenShareRef}
              autoPlay
              playsInline
              muted
              className="call-view__remote call-view__remote--screen call-view__remote--local-preview"
            />
          ) : (
            <div className="call-view__avatar-wrap">
              {isChannelCall ? (
                <Avatar
                  displayName={channel.name}
                  username={channel.name}
                  image={channel.image}
                  size={isLargeLayout ? 112 : 72}
                />
              ) : peer ? (
                <Avatar
                  displayName={peer.displayName}
                  username={peer.username}
                  image={peer.image}
                  color={peer.color}
                  size={isLargeLayout ? 112 : 72}
                />
              ) : null}
              {!showRemoteVideo && !showLocalScreenInMain && state === "active" && (
                <p className="call-view__stage-label">{name}</p>
              )}
            </div>
          )}

          {showLocalPip && (
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
          onClick={
            state === "outgoing"
              ? cancelCall
              : endCall
          }
        >
          <PhoneOff size={20} strokeWidth={2} />
        </CtrlButton>
      </div>
    </div>
  );

  return panel;
}
