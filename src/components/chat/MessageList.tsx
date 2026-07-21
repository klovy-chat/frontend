import { useCallback, useLayoutEffect, useRef, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "../../types";
import { formatMessageDateSeparator, isSameLocalDay } from "../../utils/user/format";
import { isMessageGrouped } from "../../utils/chat/messageGrouping";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isChannel?: boolean;
  typingUserId?: string | null;
  highlightMessageId?: string | null;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
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

const NEAR_BOTTOM_THRESHOLD_PX = 96;
const LOAD_OLDER_THRESHOLD_PX = 80;

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
}

export function MessageList({
  messages,
  currentUserId,
  isChannel = false,
  typingUserId,
  highlightMessageId,
  hasMore = false,
  loadingOlder = false,
  onLoadOlder,
  canReact = false,
  onReact,
  canReply = false,
  onReply,
  onJumpToMessage,
  onImageClick,
  showReadReceipt = false,
  onEdit,
  onDelete,
  canPin,
  onPin,
  onUnpin,
}: MessageListProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const prevFirstIdRef = useRef<string | null>(null);
  const anchorHeightRef = useRef(0);
  const anchorTopRef = useRef(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isNearBottomRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    isNearBottomRef.current = isNearBottom(el);
    if (el.scrollTop <= LOAD_OLDER_THRESHOLD_PX && hasMore && !loadingOlder && onLoadOlder) {
      anchorHeightRef.current = el.scrollHeight;
      anchorTopRef.current = el.scrollTop;
      onLoadOlder();
    }
  }, [hasMore, loadingOlder, onLoadOlder]);

  const handleLoadOlderClick = useCallback(() => {
    const el = listRef.current;
    if (el) {
      anchorHeightRef.current = el.scrollHeight;
      anchorTopRef.current = el.scrollTop;
    }
    onLoadOlder?.();
  }, [onLoadOlder]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const prevCount = prevCountRef.current;
    const firstId = messages[0]?._id ?? null;
    const prevFirstId = prevFirstIdRef.current;
    prevCountRef.current = messages.length;
    prevFirstIdRef.current = firstId;

    const isInitialLoad = prevCount === 0 && messages.length > 0;
    if (isInitialLoad) {
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }

    // Doładowano starsze wiadomości (prepend) — zachowaj pozycję widoku.
    const isPrepend =
      messages.length > prevCount && prevFirstId !== null && firstId !== prevFirstId;
    if (isPrepend) {
      const added = el.scrollHeight - anchorHeightRef.current;
      if (added > 0) el.scrollTop = anchorTopRef.current + added;
      return;
    }

    const isNewMessage = messages.length > prevCount;
    if ((isNewMessage || typingUserId) && isNearBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
  }, [messages, typingUserId, scrollToBottom]);

  const hasContent = messages.length > 0 || Boolean(typingUserId);

  return (
    <div ref={listRef} className="message-list" onScroll={handleScroll}>
      {hasMore && (
        <div className="message-list-load-older">
          <button
            type="button"
            className="message-list-load-older-btn"
            onClick={handleLoadOlderClick}
            disabled={loadingOlder}
          >
            {loadingOlder ? t("chat.loadingOlder") : t("chat.loadOlder")}
          </button>
        </div>
      )}
      {hasContent && <div className="message-list-spacer" aria-hidden />}
      {messages.length === 0 && !typingUserId ? (
        <p className="empty-chat"></p>
      ) : (
        messages.map((msg, index) => {
          const prev = messages[index - 1];
          const showDateSeparator =
            index === 0 || !isSameLocalDay(msg.timestamp, prev.timestamp);
          const grouped = !showDateSeparator && isMessageGrouped(prev, msg);

          return (
            <Fragment key={msg._id}>
              {showDateSeparator ? (
                <div className="message-list-date">
                  {formatMessageDateSeparator(msg.timestamp)}
                </div>
              ) : null}
              <MessageBubble
                message={msg}
                currentUserId={currentUserId}
                isChannel={isChannel}
                isGrouped={grouped}
                highlighted={highlightMessageId === msg._id}
                canReact={canReact}
                onReact={onReact}
                canReply={canReply}
                onReply={onReply}
                onJumpToMessage={onJumpToMessage}
                onImageClick={onImageClick}
                showReadReceipt={showReadReceipt}
                onEdit={onEdit}
                onDelete={onDelete}
                canPin={canPin}
                onPin={onPin}
                onUnpin={onUnpin}
              />
            </Fragment>
          );
        })
      )}
      {typingUserId && typingUserId !== currentUserId && (
        <p className="typing-indicator">{t("chat.typing")}</p>
      )}
    </div>
  );
}
