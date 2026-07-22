import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAnimatedModal } from "../../hooks/useAnimatedModal";
import "../../styles/chat/chat.css";
import "../../styles/account/account.css";

type E2eUiStatus = "disabled" | "generating" | "active";

function formatFingerprint(value: string | null): string {
  if (!value) return "—";
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += 4) {
    chunks.push(value.slice(i, i + 4));
  }
  return chunks.join(" ");
}

function SettingsSwitch({
  checked,
  disabled,
  compact,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  compact?: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={`e2e-settings-toggle${compact ? " e2e-settings-toggle--compact" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="e2e-settings-toggle__track"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(!checked)}
      />
      <div className="e2e-settings-toggle__copy">{children}</div>
    </div>
  );
}

interface EncryptionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  busy: boolean;
  enabled: boolean;
  hasKeys: boolean;
  fingerprint: string | null;
  clearOnLogout: boolean;
  resetConfirmOpen: boolean;
  uiStatus: E2eUiStatus;
  onToggle: (next: boolean) => void;
  onClearOnLogoutChange: (next: boolean) => void;
  onResetClick: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
}

export function EncryptionSettingsModal({
  isOpen,
  onClose,
  loading,
  busy,
  enabled,
  hasKeys,
  fingerprint,
  clearOnLogout,
  resetConfirmOpen,
  uiStatus,
  onToggle,
  onClearOnLogoutChange,
  onResetClick,
  onResetConfirm,
  onResetCancel,
}: EncryptionSettingsModalProps) {
  const { t } = useTranslation();
  const { closing, visible, requestClose } = useAnimatedModal(isOpen, onClose);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, busy, requestClose]);

  if (!visible) return null;

  return createPortal(
    <div
      className={`klovy-backdrop klovy-backdrop--high e2e-settings-backdrop delete-msg-backdrop${closing ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="e2e-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) requestClose();
      }}
    >
      <div
        className={`delete-msg-modal e2e-settings-modal klovy-shell${closing ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="delete-msg-modal__header">
          <div>
            <h2 id="e2e-settings-title" className="delete-msg-modal__title">
              {t("settings.encryption.title")}
            </h2>
            <p className="delete-msg-modal__subtitle">
              {t("settings.encryption.subtitle")}
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

        <div className="delete-msg-modal__body e2e-settings-modal__body">
          <section className="e2e-settings-block">
            <div className="e2e-settings-block__head">
              <span className="e2e-settings-block__label">
                {t("settings.encryption.toggle")}
              </span>
              <span
                className={`as-status-pill e2e-settings-status-pill${
                  uiStatus === "active"
                    ? " as-status-pill--success"
                    : uiStatus === "generating"
                      ? " e2e-settings-status-pill--busy"
                      : " as-status-pill--warn"
                }`}
              >
                {t(`settings.encryption.statusShort.${uiStatus}`)}
              </span>
            </div>

            <SettingsSwitch
              checked={enabled && hasKeys}
              disabled={loading || busy}
              onChange={onToggle}
            >
              <strong>{t("settings.encryption.toggle")}</strong>
              <span>{t(`settings.encryption.status.${uiStatus}`)}</span>
            </SettingsSwitch>
          </section>

          <section className="e2e-settings-block">
            <p className="e2e-settings-block__label">
              {t("settings.encryption.fingerprintLabel")}
            </p>
            <div className="e2e-settings-fingerprint" aria-live="polite">
              {formatFingerprint(fingerprint)}
            </div>
            <p className="e2e-settings-hint">
              {t("settings.encryption.fingerprintHint")}
            </p>
          </section>

          <section className="e2e-settings-block">
            <p className="e2e-settings-block__label">
              {t("settings.encryption.limitationsTitle")}
            </p>
            <ul className="e2e-settings-limitations">
              <li>{t("settings.encryption.limitations.search")}</li>
              <li>{t("settings.encryption.limitations.preview")}</li>
              <li>{t("settings.encryption.limitations.attachments")}</li>
              <li>{t("settings.encryption.limitations.metadata")}</li>
              <li>{t("settings.encryption.limitations.deviceLoss")}</li>
              <li>{t("settings.encryption.limitations.plaintextHistory")}</li>
            </ul>
          </section>

          <section className="e2e-settings-block e2e-settings-block--compact">
            <SettingsSwitch
              checked={clearOnLogout}
              disabled={loading || busy}
              compact
              onChange={onClearOnLogoutChange}
            >
              <strong>{t("settings.encryption.clearOnLogout")}</strong>
              <span>{t("settings.encryption.clearOnLogoutHint")}</span>
            </SettingsSwitch>
          </section>
        </div>

        {hasKeys ? (
          <div className="delete-msg-modal__footer e2e-settings-modal__footer">
            {!resetConfirmOpen ? (
              <button
                type="button"
                className="delete-msg-modal__btn delete-msg-modal__btn--danger"
                disabled={loading || busy}
                onClick={onResetClick}
              >
                {t("settings.encryption.resetKeys")}
              </button>
            ) : (
              <>
                <p className="e2e-settings-reset-warning">
                  {t("settings.encryption.resetConfirm")}
                </p>
                <div className="e2e-settings-reset-actions">
                  <button
                    type="button"
                    className="delete-msg-modal__btn delete-msg-modal__btn--secondary"
                    disabled={busy}
                    onClick={onResetCancel}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    className="delete-msg-modal__btn delete-msg-modal__btn--danger"
                    disabled={busy}
                    onClick={onResetConfirm}
                  >
                    {t("settings.encryption.resetConfirmAction")}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
