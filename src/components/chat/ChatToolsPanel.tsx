import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { getPinnedMessages, searchMessages } from "../../api/messages";
import { formatTime, userLabel } from "../../utils/user/format";
import { stripFormatting } from "../../utils/chat/messageFormat";
import type { ChatTarget, Message } from "../../types";
import "../../styles/chat/chattools.css";

type PanelMode = "pinned" | "search";

interface ChatToolsPanelProps {
  mode: PanelMode;
  target: ChatTarget;
  canPin: boolean;
  onClose: () => void;
  onUnpin?: (message: Message) => void;
  onJumpToMessage?: (messageId: string) => void;
}

export function ChatToolsPanel({
  mode,
  target,
  canPin,
  onClose,
  onUnpin,
  onJumpToMessage,
}: ChatToolsPanelProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const [pinned, setPinned] = useState<Message[]>([]);
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const messagePreview = useCallback(
    (message: Message): string => {
      if (message.messageType && message.messageType !== "TEXT") {
        return message.fileName ?? t("messages.attachment");
      }
      return stripFormatting(message.content);
    },
    [t],
  );

  const contextParams = useMemo(
    () =>
      target.type === "dm"
        ? { contactId: target.contact._id }
        : { channelId: target.channel._id },
    [target.type === "dm" ? target.contact._id : target.channel._id, target.type],
  );

  const loadPinned = useCallback(async () => {
    setLoading(true);
    try {
      const { messages } = await getPinnedMessages(contextParams);
      setPinned(messages);
    } catch {
      setPinned([]);
    } finally {
      setLoading(false);
    }
  }, [target.type === "dm" ? target.contact._id : target.channel._id]);

  useEffect(() => {
    if (mode === "pinned") {
      setFilter("");
      loadPinned();
    } else {
      setFilter("");
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
    }
  }, [mode, loadPinned]);

  useEffect(() => {
    if (mode !== "search") return;
    const q = filter.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const { messages } = await searchMessages({ query: q, ...contextParams });
        setSearchResults(messages);
        setHasSearched(true);
      } catch (err: unknown) {
        setSearchResults([]);
        setHasSearched(true);
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("chat.tools.searchFailed");
        setSearchError(msg);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [filter, mode, contextParams.contactId, contextParams.channelId, t]);

  const filteredPinned = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pinned;
    return pinned.filter((m) => messagePreview(m).toLowerCase().includes(q));
  }, [pinned, filter, messagePreview]);

  const title = mode === "pinned" ? t("chat.tools.pinnedShort") : t("chat.tools.searchTab");
  const list = mode === "pinned" ? filteredPinned : searchResults;

  return (
    <>
      <button
        type="button"
        className="chat-tools-backdrop"
        aria-label={t("common.closePanel")}
        onClick={onClose}
      />
      <div className="chat-tools-panel" role="dialog" aria-label={title}>
        <div className="chat-tools-header">
          <h4 className="chat-tools-title">{title}</h4>
          {mode === "search" && (
            <div className="chat-tools-search-wrap">
              <svg
                className="chat-tools-search-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="chat-tools-search-input"
                placeholder={t("chat.tools.searchPlaceholder")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="chat-tools-body">
          {loading && mode === "pinned" && (
            <p className="chat-tools-empty">{t("common.loading")}</p>
          )}

          {mode === "search" && !filter.trim() && (
            <p className="chat-tools-empty">
              {t("chat.tools.searchHint")}
            </p>
          )}

          {mode === "search" && filter.trim().length > 0 && filter.trim().length < 2 && (
            <p className="chat-tools-empty">{t("chat.tools.minChars")}</p>
          )}

          {searchError && <p className="chat-tools-empty chat-tools-error">{searchError}</p>}

          {mode === "search" && loading && filter.trim().length >= 2 && (
            <p className="chat-tools-empty">{t("chat.tools.searching")}</p>
          )}

          {mode === "search" &&
            hasSearched &&
            !loading &&
            !searchError &&
            list.length === 0 &&
            filter.trim().length >= 2 && (
              <p className="chat-tools-empty">{t("chat.tools.noResults")}</p>
            )}

          {mode === "pinned" && !loading && list.length === 0 && (
            <p className="chat-tools-empty">{t("chat.tools.noPinned")}</p>
          )}

          <ul className="chat-tools-list">
            {list.map((msg) => {
              const sender =
                typeof msg.sender === "object" ? msg.sender : { _id: String(msg.sender) };
              return (
                <li key={msg._id} className="chat-tools-item">
                  <button
                    type="button"
                    className="chat-tools-item-main"
                    onClick={() => onJumpToMessage?.(msg._id)}
                  >
                    <Avatar
                      displayName={sender.displayName}
                      username={sender.username}
                      image={sender.image}
                      color={sender.color}
                      size={32}
                    />
                    <div className="chat-tools-item-content">
                      <div className="chat-tools-item-meta">
                        <span className="chat-tools-item-author">{userLabel(sender)}</span>
                        <span className="chat-tools-item-time">{formatTime(msg.timestamp)}</span>
                      </div>
                      <p className="chat-tools-item-text">{messagePreview(msg)}</p>
                    </div>
                  </button>
                  {mode === "pinned" && canPin && onUnpin && (
                    <button
                      type="button"
                      className="chat-tools-unpin"
                      title={t("chat.tools.unpin")}
                      onClick={async () => {
                        await onUnpin(msg);
                        setPinned((prev) => prev.filter((m) => m._id !== msg._id));
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
