import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../../styles/chat/chat.css";

interface RevokeSessionConfirmModalProps {
  isOpen: boolean;
  deviceLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function RevokeSessionConfirmModal({
  isOpen,
  deviceLabel,
  busy = false,
  onConfirm,
  onClose,
}: RevokeSessionConfirmModalProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);

  const requestClose = () => {
    if (closing || busy) return;
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
  }, [isOpen, closing, busy]);

  if (!isOpen && !closing) return null;

  return (
    <div
      className={`klovy-backdrop klovy-backdrop--high delete-msg-backdrop${closing ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-revoke-title"
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
            <h2 id="session-revoke-title" className="delete-msg-modal__title">
              {t("session.revokeDeviceModal.title")}
            </h2>
            <p className="delete-msg-modal__subtitle">
              {t("session.revokeDeviceModal.subtitle")}
            </p>
          </div>
          <button
            type="button"
            className="delete-msg-modal__close"
            aria-label={t("common.close")}
            disabled={busy}
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <p>
              {t("session.revokeDeviceModal.confirmWithDevice", { device: deviceLabel })}
            </p>
          </div>
        </div>

        <div className="delete-msg-modal__footer">
          <button
            type="button"
            className="delete-msg-modal__btn delete-msg-modal__btn--secondary"
            disabled={busy}
            onClick={requestClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="delete-msg-modal__btn delete-msg-modal__btn--danger"
            disabled={busy}
            onClick={() => {
              onConfirm();
              requestClose();
            }}
          >
            {busy ? t("common.loggingOut") : t("session.revokeDeviceModal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
