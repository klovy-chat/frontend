import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "../../types";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
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
const ESTIMATED_MESSAGE_HEIGHT_PX = 88;
/** Below this count, keep the simple flex layout (spacer pins short chats to bottom). */
const VIRTUALIZE_AFTER = 40;
const OVERSCAN = 8;

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
}

export function MessageList({
  messages,
  currentUserId,
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
  const virtualListRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const prevFirstIdRef = useRef<string | null>(null);
  const anchorHeightRef = useRef(0);
  const anchorTopRef = useRef(0);
  const [scrollMargin, setScrollMargin] = useState(0);

  const useVirtual = messages.length >= VIRTUALIZE_AFTER;

  const virtualizer = useVirtualizer({
    count: useVirtual ? messages.length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: () => ESTIMATED_MESSAGE_HEIGHT_PX,
    overscan: OVERSCAN,
    getItemKey: (index) => messages[index]?._id ?? index,
    scrollMargin,
  });

  useLayoutEffect(() => {
    if (!useVirtual) {
      setScrollMargin(0);
      return;
    }
    const list = listRef.current;
    const virt = virtualListRef.current;
    if (!list || !virt) return;
    setScrollMargin(virt.offsetTop);
  }, [useVirtual, hasMore, loadingOlder, messages.length, typingUserId]);

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

  useEffect(() => {
    if (!highlightMessageId || !useVirtual) return;
    const index = messages.findIndex((m) => m._id === highlightMessageId);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: "center", behavior: "smooth" });
    }
  }, [highlightMessageId, messages, useVirtual, virtualizer]);

  const hasContent = messages.length > 0 || Boolean(typingUserId);

  const bubbleProps = useMemo(
    () => ({
      currentUserId,
      canReact,
      onReact,
      canReply,
      onReply,
      onJumpToMessage,
      onImageClick,
      showReadReceipt,
      onEdit,
      onDelete,
      canPin,
      onPin,
      onUnpin,
    }),
    [
      currentUserId,
      canReact,
      onReact,
      canReply,
      onReply,
      onJumpToMessage,
      onImageClick,
      showReadReceipt,
      onEdit,
      onDelete,
      canPin,
      onPin,
      onUnpin,
    ],
  );

  return (
    <div
      ref={listRef}
      className={`message-list${useVirtual ? " message-list--virtual" : ""}`}
      onScroll={handleScroll}
    >
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
      {hasContent && (
        <div className="message-list-date">{t("common.today")}</div>
      )}
      {hasContent && !useVirtual && (
        <div className="message-list-spacer" aria-hidden />
      )}

      {messages.length === 0 && !typingUserId ? (
        <p className="empty-chat"></p>
      ) : useVirtual ? (
        <div
          ref={virtualListRef}
          className="message-list-virtual"
          style={{
            height: Math.max(0, virtualizer.getTotalSize() - scrollMargin),
            width: "100%",
            position: "relative",
            flexShrink: 0,
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const msg = messages[item.index];
            if (!msg) return null;
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="message-list-virtual-item"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${item.start - scrollMargin}px)`,
                }}
              >
                <MessageBubble
                  message={msg}
                  highlighted={highlightMessageId === msg._id}
                  {...bubbleProps}
                />
              </div>
            );
          })}
        </div>
      ) : (
        messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            message={msg}
            highlighted={highlightMessageId === msg._id}
            {...bubbleProps}
          />
        ))
      )}

      {typingUserId && typingUserId !== currentUserId && (
        <p className="typing-indicator">{t("chat.typing")}</p>
      )}
    </div>
  );
}
