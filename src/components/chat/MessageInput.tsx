import { FormEvent, KeyboardEvent, MouseEvent, useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { EmojiPicker } from "./pickers/EmojiPicker";
import { GifPicker } from "./pickers/GifPicker";
import { StickerPicker } from "./pickers/StickerPicker";
import { Avatar } from "../common/Avatar";
import { getMessagePreview, getQuotedAuthorLabel } from "../../utils/chat/messages";
import { getCaretCoordinates } from "../../utils/chat/caretPosition";
import { userLabel } from "../../utils/user/format";
import type { Message, MentionCandidate } from "../../types";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  assertAttachmentType,
  formatUploadLimitMb,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "../../constants/upload";
import { MAX_MESSAGE_LENGTH } from "../../constants/messages";
import { isAllowedGifMediaUrl } from "../../utils/media/mediaAllowlist";
import {
  formatVoiceDuration,
  useVoiceRecorder,
} from "../../hooks/useVoiceRecorder";
import { useLocale } from "../../context/LocaleContext";
import "../../styles/chat/messageinput.css";

const ALLOWED_FILE_EXTENSIONS = [...ALLOWED_ATTACHMENT_EXTENSIONS];
const FILE_ACCEPT = ALLOWED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

interface MessageInputProps {
  onSend: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onFile?: (file: File) => void | Promise<void>;
  onVoiceNote?: (file: File, durationMs: number) => void | Promise<void>;
  onGif?: (gifUrl: string, gifTitle: string) => void;
  onSticker?: (stickerUrl: string, stickerTitle: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialText?: string;
  isEditing?: boolean;
  onCancelEdit?: () => void;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  mentionCandidates?: MentionCandidate[];
  allowMentionEveryone?: boolean;
}

type MentionItem =
  | { kind: "user"; candidate: MentionCandidate }
  | { kind: "special"; value: "everyone" | "here" };

interface MentionState {
  query: string;
  start: number;
}

export function MessageInput({
  onSend,
  onTyping,
  onFile,
  onVoiceNote,
  onGif,
  onSticker,
  disabled,
  placeholder,
  initialText = "",
  isEditing = false,
  onCancelEdit,
  replyTo = null,
  onCancelReply,
  mentionCandidates = [],
  allowMentionEveryone = false,
}: MessageInputProps) {
  const { t } = useTranslation();
  const { dateLocale } = useLocale();
  const resolvedPlaceholder = placeholder ?? t("chat.input.defaultPlaceholder");

  const specialMentionMeta = useMemo(
    () => ({
      everyone: {
        label: t("chat.mentions.everyone.label"),
        desc: t("chat.mentions.everyone.desc"),
      },
      here: {
        label: t("chat.mentions.here.label"),
        desc: t("chat.mentions.here.desc"),
      },
    }),
    [t],
  );

  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [formatBar, setFormatBar] = useState<{ top: number; left: number } | null>(null);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();
  const {
    isRecording,
    durationMs: recordingDurationMs,
    error: voiceError,
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    setError: setVoiceError,
  } = useVoiceRecorder();

  const mentionItems = useMemo<MentionItem[]>(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const specials: MentionItem[] = [];
    if (allowMentionEveryone) {
      (["everyone", "here"] as const).forEach((value) => {
        if (!q || value.startsWith(q)) specials.push({ kind: "special", value });
      });
    }
    const users: MentionItem[] = mentionCandidates
      .filter((c) => {
        if (!c.username) return false;
        if (!q) return true;
        const uname = c.username.toLowerCase();
        const label = userLabel(c).toLowerCase();
        return uname.includes(q) || label.includes(q);
      })
      .slice(0, 8)
      .map((candidate) => ({ kind: "user", candidate }));
    return [...specials, ...users];
  }, [mention, mentionCandidates, allowMentionEveryone]);

  const mentionOpen = Boolean(mention) && mentionItems.length > 0;
  const activeMentionIndex = Math.min(mentionIndex, Math.max(mentionItems.length - 1, 0));

  const closeMention = () => {
    setMention(null);
    setMentionPos(null);
  };

  const detectMention = (value: string, caret: number) => {
    if (disabled) {
      closeMention();
      return;
    }
    if (mentionCandidates.length === 0 && !allowMentionEveryone) {
      closeMention();
      return;
    }
    const upToCaret = value.slice(0, caret);
    const match = /(?:^|\s)@([A-Za-z0-9_]*)$/.exec(upToCaret);
    if (!match) {
      closeMention();
      return;
    }
    const query = match[1];
    const start = caret - query.length - 1;
    setMention({ query, start });
    setMentionIndex(0);

    const ta = textareaRef.current;
    const form = formRef.current;
    if (ta && form) {
      const caretCoords = getCaretCoordinates(ta, start);
      const taRect = ta.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      setMentionPos({
        top: taRect.top - formRect.top + caretCoords.top,
        left: taRect.left - formRect.left + caretCoords.left,
      });
    }
  };

  const applyMention = (item: MentionItem) => {
    const ta = textareaRef.current;
    if (!ta || !mention) return;
    const token = item.kind === "user" ? item.candidate.username : item.value;
    const caret = ta.selectionStart;
    const before = text.slice(0, mention.start);
    const after = text.slice(caret);
    const insert = `@${token} `;
    const newText = before + insert + after;
    const nextCaret = before.length + insert.length;

    setText(newText);
    closeMention();
    notifyTyping(newText.trim().length > 0);

    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = nextCaret;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }, 0);
  };

  const notifyTyping = (isTyping: boolean) => {
    onTyping?.(isTyping);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (isTyping) {
      typingTimeout.current = setTimeout(() => onTyping?.(false), 2000);
    }
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const newH = Math.min(ta.scrollHeight, 200);
    ta.style.height = `${newH}px`;
  }, [text]);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled || uploading) return;
    const trimmed = text.trim();
    if (!trimmed && !attachedFile) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setUploadError(
        t("messages.errors.tooLong", {
          max: MAX_MESSAGE_LENGTH.toLocaleString(dateLocale),
        }),
      );
      return;
    }

    if (attachedFile && onFile) {
      setUploading(true);
      setUploadError(null);
      try {
        await onFile(attachedFile);
      } catch {
        setUploadError(t("upload.failed"));
        setUploading(false);
        return;
      }
      setUploading(false);
      setAttachedFile(null);
    }

    if (trimmed) onSend(trimmed);

    setText("");
    setFormatBar(null);
    closeMention();
    notifyTyping(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const updateFormatBar = () => {
    const ta = textareaRef.current;
    const form = formRef.current;
    if (!ta || !form || disabled) {
      setFormatBar(null);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      setFormatBar(null);
      return;
    }
    const caret = getCaretCoordinates(ta, start);
    const taRect = ta.getBoundingClientRect();
    const barRect = form.getBoundingClientRect();
    const top = taRect.top - barRect.top + caret.top;
    let left = taRect.left - barRect.left + caret.left;
    const margin = 96;
    left = Math.max(margin, Math.min(left, barRect.width - margin));
    setFormatBar({ top, left });
  };

  const applyFormat = (prefix: string, suffix: string = prefix) => {
    const ta = textareaRef.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    const before = text.slice(0, start);
    const after = text.slice(end);

    const wrappedAlready =
      before.endsWith(prefix) && after.startsWith(suffix);

    let newText: string;
    let nextStart: number;
    let nextEnd: number;

    if (wrappedAlready) {
      newText =
        before.slice(0, before.length - prefix.length) +
        selected +
        after.slice(suffix.length);
      nextStart = start - prefix.length;
      nextEnd = end - prefix.length;
    } else {
      newText = `${before}${prefix}${selected}${suffix}${after}`;
      nextStart = start + prefix.length;
      nextEnd = end + prefix.length;
    }

    setText(newText);
    notifyTyping(newText.trim().length > 0);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = nextStart;
      ta.selectionEnd = nextEnd;
      updateFormatBar();
    }, 0);
  };

  const handleFormatMouseDown = (
    e: MouseEvent<HTMLButtonElement>,
    prefix: string,
    suffix?: string,
  ) => {
    // Zachowaj zaznaczenie/focus w textarei – nie pozwól przyciskowi przejąć focusu.
    e.preventDefault();
    applyFormat(prefix, suffix ?? prefix);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionItems.length) % mentionItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyMention(mentionItems[activeMentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (e.shiftKey) {
        if (key === "x") {
          e.preventDefault();
          applyFormat("~~");
          return;
        }
        if (key === "c") {
          e.preventDefault();
          applyFormat("```\n", "\n```");
          return;
        }
      } else {
        if (key === "b") {
          e.preventDefault();
          applyFormat("**");
          return;
        }
        if (key === "i") {
          e.preventDefault();
          applyFormat("*");
          return;
        }
        if (key === "e") {
          e.preventDefault();
          applyFormat("`");
          return;
        }
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e as unknown as FormEvent);
    }
  };

  const handleFile = (file: File) => {
    try {
      assertAttachmentType(file);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : t("upload.invalidType", { extensions: "" }),
      );
      setAttachedFile(null);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !ALLOWED_ATTACHMENT_EXTENSIONS.includes(
        ext as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number],
      )
    ) {
      setUploadError(
        t("upload.invalidType", { extensions: ALLOWED_FILE_EXTENSIONS.join(", ") }),
      );
      setAttachedFile(null);
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setUploadError(
        t("upload.attachmentTooLarge", {
          limit: formatUploadLimitMb(MAX_ATTACHMENT_SIZE_BYTES),
        }),
      );
      setAttachedFile(null);
      return;
    }
    setUploadError(null);
    setAttachedFile(file);
  };

  const handleEmojiSelect = (emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    setShowEmojiPicker(false);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + emoji.length;
      ta.focus();
    }, 0);
  };

  const handleGifSelect = (gifUrl: string, gifTitle: string) => {
    setShowGifPicker(false);
    if (!isAllowedGifMediaUrl(gifUrl)) return;
    onGif?.(gifUrl, gifTitle);
  };

  const handleStickerSelect = (stickerUrl: string, stickerTitle: string) => {
    setShowStickerPicker(false);
    if (!isAllowedGifMediaUrl(stickerUrl)) return;
    onSticker?.(stickerUrl, stickerTitle);
  };

  const handleStartRecording = async () => {
    if (disabled || uploading || isEditing || !onVoiceNote) return;
    setVoiceError(null);
    await startRecording();
  };

  const handleCancelRecording = () => {
    cancelRecording();
  };

  const handleSendRecording = async () => {
    if (!onVoiceNote || !isRecording || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await stopRecording();
      if (!result) {
        setUploadError(t("voice.tooShort"));
        return;
      }
      if (result.file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setUploadError(
          t("voice.tooLarge", {
            limit: formatUploadLimitMb(MAX_ATTACHMENT_SIZE_BYTES),
          }),
        );
        return;
      }
      await onVoiceNote(result.file, result.durationMs);
    } catch {
      setUploadError(t("voice.sendFailed"));
    } finally {
      setUploading(false);
    }
  };


  return (
    <form
      ref={formRef}
      className={[
        "mi-bar",
        isFocused ? "mi-bar--focused" : "",
        disabled ? "mi-bar--disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={submit}
    >
      {formatBar && (
        <div
          className="mi-format-float"
          style={{ top: formatBar.top, left: formatBar.left }}
        >
          <button
            type="button"
            className="mi-fmt-btn mi-fmt-btn--bold"
            onMouseDown={(e) => handleFormatMouseDown(e, "**")}
            title={t("chat.input.formatting.bold")}
          >
            B
          </button>
          <button
            type="button"
            className="mi-fmt-btn mi-fmt-btn--italic"
            onMouseDown={(e) => handleFormatMouseDown(e, "*")}
            title={t("chat.input.formatting.italic")}
          >
            I
          </button>
          <button
            type="button"
            className="mi-fmt-btn mi-fmt-btn--strike"
            onMouseDown={(e) => handleFormatMouseDown(e, "~~")}
            title={t("chat.input.formatting.strikethrough")}
          >
            S
          </button>
          <span className="mi-fmt-sep" />
          <button
            type="button"
            className="mi-fmt-btn"
            onMouseDown={(e) => handleFormatMouseDown(e, "`")}
            title={t("chat.input.formatting.inlineCode")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <button
            type="button"
            className="mi-fmt-btn"
            onMouseDown={(e) => handleFormatMouseDown(e, "```\n", "\n```")}
            title={t("chat.input.formatting.codeBlock")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <polyline points="9 9 7 12 9 15" />
              <polyline points="15 9 17 12 15 15" />
            </svg>
          </button>
        </div>
      )}

      {mentionOpen && mentionPos && (
        <div
          className="mi-mention-pop"
          style={{ top: mentionPos.top, left: mentionPos.left }}
          role="listbox"
        >
          <div className="mi-mention-head">{t("chat.input.mentionsHeader")}</div>
          {mentionItems.map((item, idx) => {
            const active = idx === activeMentionIndex;
            if (item.kind === "special") {
              const meta = specialMentionMeta[item.value];
              return (
                <button
                  type="button"
                  key={`special-${item.value}`}
                  role="option"
                  aria-selected={active}
                  className={`mi-mention-item${active ? " mi-mention-item--active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMention(item);
                  }}
                  onMouseEnter={() => setMentionIndex(idx)}
                >
                  <span className="mi-mention-special-icon">@</span>
                  <span className="mi-mention-text">
                    <span className="mi-mention-name">{meta.label}</span>
                    <span className="mi-mention-sub">{meta.desc}</span>
                  </span>
                </button>
              );
            }
            const c = item.candidate;
            return (
              <button
                type="button"
                key={c.id}
                role="option"
                aria-selected={active}
                className={`mi-mention-item${active ? " mi-mention-item--active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyMention(item);
                }}
                onMouseEnter={() => setMentionIndex(idx)}
              >
                <Avatar
                  displayName={c.displayName}
                  username={c.username}
                  image={c.image}
                  color={c.color}
                  size={26}
                />
                <span className="mi-mention-text">
                  <span className="mi-mention-name">{userLabel(c)}</span>
                  <span className="mi-mention-sub">@{c.username}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {showGifPicker && (
        <GifPicker
          onGifSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {showStickerPicker && onSticker && (
        <StickerPicker
          onStickerSelect={handleStickerSelect}
          onClose={() => setShowStickerPicker(false)}
        />
      )}

      {isEditing && (
        <div className="mi-edit-banner">
          <span>{t("chat.input.editingBanner")}</span>
          <button type="button" className="mi-edit-cancel" onClick={onCancelEdit}>
            {t("common.cancel")}
          </button>
        </div>
      )}

      {replyTo && !isEditing && (
        <div className="mi-reply-banner">
          <div className="mi-reply-banner__content">
            <span className="mi-reply-banner__label">
              {t("chat.input.replyBanner", { author: getQuotedAuthorLabel(replyTo) })}
            </span>
            <span className="mi-reply-banner__preview">{getMessagePreview(replyTo)}</span>
          </div>
          <button type="button" className="mi-reply-cancel" onClick={onCancelReply}>
            {t("common.cancel")}
          </button>
        </div>
      )}
      {uploadError && (
        <div className="mi-attachment mi-attachment--error">
          <span>{uploadError}</span>
          <button
            type="button"
            className="mi-attachment__remove"
            onClick={() => setUploadError(null)}
            title={t("common.close")}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {voiceError && (
        <div className="mi-attachment mi-attachment--error">
          <span>{voiceError}</span>
          <button
            type="button"
            className="mi-attachment__remove"
            onClick={() => setVoiceError(null)}
            title={t("common.close")}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {isRecording && (
        <div className="mi-voice-recording">
          <span className="mi-voice-recording__dot" aria-hidden="true" />
          <span className="mi-voice-recording__label">{t("voice.recording")}</span>
          <span className="mi-voice-recording__time">
            {formatVoiceDuration(recordingDurationMs)}
          </span>
          <div className="mi-voice-recording__actions">
            <button
              type="button"
              className="mi-voice-recording__btn mi-voice-recording__btn--cancel"
              onClick={handleCancelRecording}
              disabled={uploading}
              title={t("common.cancel")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              className="mi-voice-recording__btn mi-voice-recording__btn--send"
              onClick={() => void handleSendRecording()}
              disabled={uploading}
              title={t("voice.sendVoice")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {attachedFile && (
        <div className="mi-attachment">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <span>{attachedFile.name}</span>
          {uploading && <span className="mi-attachment__status">{t("common.uploading")}</span>}
          {!uploading && (
            <button
              type="button"
              className="mi-attachment__remove"
              onClick={() => setAttachedFile(null)}
              title={t("upload.removeFile")}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="mi-row">
        {onFile && (
          <>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={FILE_ACCEPT}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="mi-icon-btn mi-attach"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              title={t("upload.attachFile")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </>
        )}

        <textarea
          ref={textareaRef}
          className="mi-textarea"
          value={text}
          onChange={(e) => {
            const next =
              e.target.value.length > MAX_MESSAGE_LENGTH
                ? e.target.value.slice(0, MAX_MESSAGE_LENGTH)
                : e.target.value;
            setText(next);
            notifyTyping(next.length > 0);
            detectMention(next, e.target.selectionStart);
          }}
          onKeyDown={handleKeyDown}
          onSelect={(e) => {
            updateFormatBar();
            detectMention(e.currentTarget.value, e.currentTarget.selectionStart);
          }}
          onScroll={updateFormatBar}
          onFocus={() => {
            if (blurTimeout.current) clearTimeout(blurTimeout.current);
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            blurTimeout.current = setTimeout(() => {
              setFormatBar(null);
              closeMention();
            }, 150);
          }}
          placeholder={resolvedPlaceholder}
          disabled={disabled || isRecording}
          rows={1}
        />

        <div className="mi-actions">
          {onVoiceNote && !isEditing && (
            <button
              type="button"
              className={[
                "mi-icon-btn",
                "mi-voice",
                isRecording ? "mi-voice--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => void handleStartRecording()}
              disabled={disabled || uploading || isRecording}
              title={t("voice.recordMessage")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}

          {!isEditing && (
            <>
              {onGif && (
                <button
                  type="button"
                  className="mi-icon-btn mi-gif"
                  onClick={() => {
                    setShowEmojiPicker(false);
                    setShowStickerPicker(false);
                    setShowGifPicker((v) => !v);
                  }}
                  disabled={disabled}
                  title={t("chat.input.actions.attachGif")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
              )}
              {onSticker && (
                <button
                  type="button"
                  className="mi-icon-btn mi-sticker"
                  onClick={() => {
                    setShowEmojiPicker(false);
                    setShowGifPicker(false);
                    setShowStickerPicker((v) => !v);
                  }}
                  disabled={disabled}
                  title={t("chat.input.actions.attachSticker")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9l7-7V5a2 2 0 0 0-2-2z" />
                    <path d="M14 21v-5a2 2 0 0 1 2-2h5" />
                    <path d="M8.5 9.5s.75 1 1.5 1 1.5-1 1.5-1" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="mi-icon-btn mi-emoji"
                onClick={() => {
                  setShowGifPicker(false);
                  setShowStickerPicker(false);
                  setShowEmojiPicker((v) => !v);
                }}
                disabled={disabled}
                title={t("chat.input.actions.attachEmoji")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}