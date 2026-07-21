import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { ReactionPicker } from "./pickers/ReactionPicker";
import { QuotedMessageBlock } from "./QuotedMessageBlock";
import { ReadReceipt } from "./ReadReceipt";
import { formatTime, getUserId, userLabel } from "../../utils/user/format";
import { avatarColor } from "../../utils/media/avatar";
import { renderFormattedText } from "../../utils/chat/messageFormat";
import { getReactionEntries, hasUserReacted } from "../../utils/chat/reactions";
import { MediaImage } from "../common/MediaImage";
import { resolveChatImagePreviewUrl, resolveMediaUrl } from "../../utils/media/media";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
import { VideoMessagePlayer } from "./VideoMessagePlayer";
import { MessageLinkEmbeds } from "./MessageLinkEmbeds";
import {
  MessageExternalMedia,
  shouldHideTextForExternalMedia,
} from "./MessageExternalMedia";
import { isVideoAttachment, isVoiceAttachment } from "../../utils/media/attachments";
import type { Message, MessageUser } from "../../types";
import "../../styles/chat/messagebubble.css";

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  isChannel?: boolean;
  isGrouped?: boolean;
  highlighted?: boolean;
  canReact?: boolean;
  onReact?: (messageId: string, emoji: string) => void;
  canReply?: boolean;
  onReply?: (message: Message) => void;
  onJumpToMessage?: (messageId: string) => void;
  onImageClick?: (message: Message) => void;
  showReadReceipt?: boolean;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  canPin?: boolean;
  onPin?: (message: Message) => void;
  onUnpin?: (message: Message) => void;
}

function resolveSender(sender: MessageUser | string): MessageUser {
  if (typeof sender === "string") return { _id: sender };
  return sender;
}

function formatCallDuration(totalSecs: number): string {
  const s = Math.max(0, Math.round(totalSecs));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

export function MessageBubble({
  message,
  currentUserId,
  isChannel = false,
  isGrouped = false,
  highlighted = false,
  canReact = false,
  onReact,
  canReply = false,
  onReply,
  onJumpToMessage,
  onImageClick,
  showReadReceipt = false,
  onEdit,
  onDelete,
  canPin = false,
  onPin,
  onUnpin,
}: MessageBubbleProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactButtonRef = useRef<HTMLButtonElement>(null);
  const dotsButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyles, setDropdownStyles] = useState<React.CSSProperties>({});
  const [reactionPickerStyles, setReactionPickerStyles] = useState<React.CSSProperties>({});
  const [dropdownPlacement, setDropdownPlacement] = useState<"left" | "right">("right");
  const sender = resolveSender(message.sender);
  const senderId = getUserId(sender);
  const isOwn = senderId === currentUserId;
  const isChannel = Boolean(message.channel || message.channelId);
  const mentionsMe =
    !isOwn &&
    ((isChannel && Boolean(message.mentionsEveryone)) ||
      (message.mentions ?? []).some(
        (u) => getUserId(u) === currentUserId,
      ));
  const isVoice = isVoiceAttachment(message);
  const isVideo = isVideoAttachment(message);
  const isSticker = message.messageType === "STICKER";
  const isFile = message.messageType && message.messageType !== "TEXT";
  const senderName = userLabel(sender);
  const senderColor = avatarColor(
    sender.color,
    sender.username ?? sender.displayName ?? senderId,
  );
  const showSenderName =
    isChannel && !isGrouped && senderName !== t("format.userLabel");
  const showAvatar = !isGrouped && (!isOwn || isChannel);
  const showHeader = !isGrouped && isChannel;
  const showCompactTime = isGrouped || !isChannel;
  const canPinAction = canPin && (onPin || onUnpin);
  const hasActions = (isOwn && (onEdit || onDelete)) || canPinAction;
  const canReplyAction = canReply && Boolean(onReply);
  const showMenu = hasActions || canReplyAction;
  const reactionEntries = getReactionEntries(message.reactions);
  const showToolbar = canReact || showMenu;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (menuWrapRef.current && menuWrapRef.current.contains(target)) ||
        (menuRef.current && menuRef.current.contains(target))
      ) {
        return;
      }
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !menuRef.current || !dotsButtonRef.current) return;

    const updatePosition = () => {
      const buttonRect = dotsButtonRef.current!.getBoundingClientRect();
      const menuRect = menuRef.current!.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spaceLeft = buttonRect.left - 12;
      const spaceRight = viewportWidth - buttonRect.right - 12;
      const spaceAbove = buttonRect.top - 12;
      const spaceBelow = viewportHeight - buttonRect.bottom - 12;
      const contentLength = String(message.content ?? message.fileName ?? "").length;

      let placement: "left" | "right" = isOwn ? "left" : "right";
      if (spaceRight < menuRect.width && spaceLeft >= menuRect.width) {
        placement = "left";
      } else if (spaceLeft < menuRect.width && spaceRight >= menuRect.width) {
        placement = "right";
      } else if (!isOwn && contentLength > 100 && spaceLeft >= menuRect.width) {
        placement = "left";
      }

      const openBelow = spaceBelow >= menuRect.height || spaceBelow >= spaceAbove;
      setDropdownPlacement(placement);
      setDropdownStyles({
        position: "fixed",
        left: placement === "right" ? buttonRect.left : undefined,
        right: placement === "left" ? viewportWidth - buttonRect.right : undefined,
        top: openBelow ? buttonRect.bottom + 8 : undefined,
        bottom: openBelow ? undefined : viewportHeight - buttonRect.top + 8,
        minWidth: menuRect.width,
        maxWidth: viewportWidth - 24,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuOpen, message.content, message.fileName, isOwn]);

  useLayoutEffect(() => {
    if (!reactionPickerOpen || !reactButtonRef.current) return;

    const updatePosition = () => {
      const buttonRect = reactButtonRef.current!.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const pickerWidth = 280;
      const pickerHeight = 260;

      let left = isOwn ? buttonRect.right - pickerWidth : buttonRect.left;
      left = Math.max(12, Math.min(left, viewportWidth - pickerWidth - 12));

      const openAbove =
        buttonRect.bottom + pickerHeight + 12 > viewportHeight &&
        buttonRect.top - pickerHeight - 12 > 0;

      setReactionPickerStyles({
        left,
        top: openAbove ? undefined : buttonRect.bottom + 8,
        bottom: openAbove ? viewportHeight - buttonRect.top + 8 : undefined,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [reactionPickerOpen, isOwn]);

  const handleReactionSelect = (emoji: string) => {
    onReact?.(message._id, emoji);
    setReactionPickerOpen(false);
  };

  const handleReactionChipClick = (emoji: string) => {
    if (!canReact) return;
    onReact?.(message._id, emoji);
  };

  if (message.messageType === "CALL") {
    const durationMs = message.durationMs ?? 0;
    const isMissed = durationMs <= 0;
    const label = isMissed
      ? t("chat.missedCall")
      : t("chat.callLog", { duration: formatCallDuration(durationMs / 1000) });
    return (
      <div className="message-row message-row--system" data-message-id={message._id}>
        <div className="message-call-log">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "message-row",
        isOwn ? "own" : "other",
        isGrouped ? "message-row--grouped" : "message-row--start",
        isChannel ? "message-row--channel" : "message-row--dm",
        highlighted ? "message-row--highlight" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-message-id={message._id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <div className="message-row__avatar-col">
        {showAvatar ? (
          <Avatar
            displayName={sender.displayName}
            username={sender.username}
            image={sender.image}
            color={sender.color}
            size={40}
          />
        ) : (
          <span className="message-row__avatar-spacer" aria-hidden />
        )}
      </div>

      <div className="message-row__body">
        {showCompactTime && (
          <span className="message-time message-time--compact">
            {formatTime(message.timestamp)}
          </span>
        )}

        {showHeader && (
          <div className="message-row__header">
            {showSenderName && (
              <span
                className="message-sender-name"
                style={{ color: senderColor }}
              >
                {senderName}
              </span>
            )}
            <span className="message-time message-time--header">
              {formatTime(message.timestamp)}
            </span>
            {message.edited && (
              <span className="message-edited">
                ({t("chat.bubble.edited")})
              </span>
            )}
            {isOwn && showReadReceipt && (
              <ReadReceipt read={message.read} />
            )}
          </div>
        )}

        {showToolbar && (
          <div className="message-toolbar">
            {canReact && onReact && (
              <div className="message-react-wrap">
                <button
                  ref={reactButtonRef}
                  type="button"
                  className={`message-react-btn${hovered || reactionPickerOpen ? " message-react-btn--visible" : ""}${reactionPickerOpen ? " message-react-btn--active" : ""}`}
                  onClick={() => {
                    setMenuOpen(false);
                    setReactionPickerOpen((value) => !value);
                  }}
                  title={t("messages.actions.addReaction")}
                  aria-label={t("messages.actions.addReaction")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>

                {reactionPickerOpen && (
                  <ReactionPicker
                    onSelect={handleReactionSelect}
                    onClose={() => setReactionPickerOpen(false)}
                    style={reactionPickerStyles}
                  />
                )}
              </div>
            )}

            {showMenu && (
              <div
                ref={menuWrapRef}
                className="message-dots-wrap"
              >
                <button
                  ref={dotsButtonRef}
                  type="button"
                  className={`message-dots-btn${hovered || menuOpen ? " message-dots-btn--visible" : ""}`}
                  onClick={() => {
                    setReactionPickerOpen(false);
                    setMenuOpen((value) => !value);
                  }}
                  title={t("chat.bubble.options")}
                >
                  <span />
                  <span />
                  <span />
                </button>

                {menuOpen && (
                  <div
                    ref={menuRef}
                    className={`message-dropdown message-dropdown--${dropdownPlacement}`}
                    style={dropdownStyles}
                  >
                    {canReplyAction && (
                      <button
                        type="button"
                        className="message-dropdown-item"
                        onClick={() => {
                          onReply?.(message);
                          setMenuOpen(false);
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 17 4 12 9 7" />
                          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                        </svg>
                        {t("messages.actions.reply")}
                      </button>
                    )}
                    {isOwn && onEdit && !isVoice && (
                      <button
                        type="button"
                        className="message-dropdown-item"
                        onClick={() => { onEdit(message); setMenuOpen(false); }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        {t("messages.actions.edit")}
                      </button>
                    )}
                    {isOwn && onDelete && (
                      <button
                        type="button"
                        className="message-dropdown-item message-dropdown-item--danger"
                        onClick={() => { onDelete(message); setMenuOpen(false); }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                        {t("messages.actions.delete")}
                      </button>
                    )}
                    {canPinAction && (
                      <button
                        type="button"
                        className="message-dropdown-item"
                        onClick={() => {
                          if (message.pinned) {
                            onUnpin?.(message);
                          } else {
                            onPin?.(message);
                          }
                          setMenuOpen(false);
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="17" x2="12" y2="22" />
                          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
                        </svg>
                        {message.pinned ? t("messages.actions.unpin") : t("messages.actions.pin")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={[
            "message-content",
            mentionsMe ? "message-content--mention" : "",
            isSticker ? "message-content--sticker" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
            <QuotedMessageBlock
              quotedMessage={message.quotedMessage}
              isOwn={isOwn}
              onJumpToMessage={onJumpToMessage}
            />

            {isFile && message.fileUrl ? (
              <>
                {isSticker ? (
                  (() => {
                    return (
                      <MediaImage
                        fileUrl={message.fileUrl}
                        alt={message.fileName ?? message.content ?? t("messages.sticker")}
                        className="message-sticker"
                        loading="lazy"
                        decoding="async"
                      />
                    );
                  })()
                ) : message.messageType === "IMAGE" ? (
                  (() => {
                    return (
                      <button
                        type="button"
                        className="message-image-container"
                        onClick={() => onImageClick?.(message)}
                        aria-label={t("messages.actions.openPreview", { name: message.fileName ?? t("messages.image") })}
                      >
                        <MediaImage
                          fileUrl={resolveChatImagePreviewUrl(message.fileUrl)}
                          fallbackFileUrl={message.fileUrl}
                          alt={message.fileName ?? t("messages.image")}
                          className="message-image"
                          decoding="async"
                        />
                      </button>
                    );
                  })()
                ) : isVideo ? (
                  <VideoMessagePlayer
                    src={message.fileUrl}
                    fileName={message.fileName}
                    fileType={message.fileType}
                  />
                ) : isVoice ? (
                  <VoiceMessagePlayer
                    src={message.fileUrl}
                    durationMs={message.durationMs}
                    isOwn={isOwn}
                  />
                ) : (
                  (() => {
                    const mediaUrl = resolveMediaUrl(message.fileUrl);
                    if (!mediaUrl) return null;
                    return (
                      <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="message-file-link"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                        </svg>
                        {message.fileName ?? t("chat.bubble.file")}
                      </a>
                    );
                  })()
                )}
              </>
            ) : (
              <>
                {!shouldHideTextForExternalMedia(message.content) && (
                  <p className="message-text">
                    {renderFormattedText(message.content, {
                      mentions: message.mentions,
                      currentUserId,
                      allowEveryone: isChannel,
                    })}
                  </p>
                )}
                <MessageExternalMedia
                  content={message.content}
                  onImageClick={(url, fileName) =>
                    onImageClick?.({
                      ...message,
                      messageType: "IMAGE",
                      fileUrl: url,
                      fileName,
                    })
                  }
                />
                <MessageLinkEmbeds content={message.content} />
              </>
            )}

          {!showHeader && isOwn && showReadReceipt && (
            <div className="message-meta message-meta--inline">
              <ReadReceipt read={message.read} />
            </div>
          )}
        </div>

        {reactionEntries.length > 0 && (
          <div className="message-reactions">
            {reactionEntries.map(([emoji, users]) => {
              const isActive = hasUserReacted(message.reactions, emoji, currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  className={`message-reaction-chip${isActive ? " message-reaction-chip--active" : ""}`}
                  onClick={() => handleReactionChipClick(emoji)}
                  disabled={!canReact}
                  title={`${emoji} · ${users.length}`}
                >
                  <span className="message-reaction-emoji">{emoji}</span>
                  <span className="message-reaction-count">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
