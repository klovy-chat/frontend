// DeleteMessage.tsx
// Dialog potwierdzenia usunięcia.
// Zakres:
//  - soft-delete po stronie serwera
//  - potwierdzenie; po OK ChatWindow patchuje cache i tip listy
// Po OK ChatWindow musi patch cache + preview listy.
// Przy zmianach: ChatWindow.tsx, model/messages.rs.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../../styles/chat/chat.css";

const PREVIEW_MAX_CHARS = 280;

interface DeleteMessageProps {
  isOpen: boolean;
  preview: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteMessage({
  isOpen,
  preview,
  onConfirm,
  onClose,
}: DeleteMessageProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);

  const formatDeletePreview = (raw: string): {
    text: string;
    isTruncated: boolean;
  } => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { text: t("messages.thisMessage"), isTruncated: false };
    }
    if (trimmed.length <= PREVIEW_MAX_CHARS) {
      return { text: trimmed, isTruncated: false };
    }
    return {
      text: `${trimmed.slice(0, PREVIEW_MAX_CHARS)}…`,
      isTruncated: true,
    };
  };

  const { text: previewText, isTruncated } = formatDeletePreview(preview);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  };

  useEffect(() => {
    if (isOpen) setClosing(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && !closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closing]);

  if (!isOpen && !closing) return null;

  return (
    <div
      className={`klovy-backdrop klovy-backdrop--high delete-msg-backdrop${closing ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-msg-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className={`delete-msg-modal klovy-shell${closing ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-msg-modal__header">
          <div>
            <h2 id="delete-msg-title" className="delete-msg-modal__title">
              {t("messages.delete.title")}
            </h2>
            <p className="delete-msg-modal__subtitle">
              {t("messages.delete.subtitle")}
            </p>
          </div>
          <button
            type="button"
            className="delete-msg-modal__close"
            aria-label={t("common.close")}
            onClick={requestClose}
          >
            ×
          </button>
        </div>

        <div className="delete-msg-modal__body">
          <div className="delete-msg-modal__warning">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p>
              {t("messages.delete.confirm")}
              {isTruncated && (
                <span className="delete-msg-modal__trunc-hint">
                  {" "}
                  {t("messages.delete.previewTruncated")}
                </span>
              )}
            </p>
          </div>

          <div className="delete-msg-modal__preview-label">{t("messages.delete.previewLabel")}</div>
          <div className="delete-msg-modal__preview">{previewText}</div>
        </div>

        <div className="delete-msg-modal__footer">
          <button
            type="button"
            className="delete-msg-modal__btn delete-msg-modal__btn--secondary"
            onClick={requestClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="delete-msg-modal__btn delete-msg-modal__btn--danger"
            onClick={() => {
              onConfirm();
              requestClose();
            }}
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
