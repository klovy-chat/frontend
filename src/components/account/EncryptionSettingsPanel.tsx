import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { e2eService } from "../../crypto/e2e/e2eService";
import { EncryptionSettingsModal } from "./EncryptionSettingsModal";

type E2eUiStatus = "disabled" | "generating" | "active";

export function EncryptionSettingsPanel() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [clearOnLogout, setClearOnLogout] = useState(true);

  const uiStatus: E2eUiStatus = busy
    ? "generating"
    : enabled && hasKeys
      ? "active"
      : "disabled";

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      e2eService.setCurrentUserId(user.id);
      const status = await e2eService.refreshStatus();
      setEnabled(status.enabled);
      setHasKeys(status.hasKeys);
      setFingerprint(status.fingerprint ?? null);
      const clearKeys = await e2eService.getClearKeysOnLogout();
      setClearOnLogout(clearKeys);
      if (user.e2eEnabled !== status.enabled) {
        updateUser({ ...user, e2eEnabled: status.enabled });
      }
    } catch {
      toast.error(t("settings.encryption.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast, updateUser, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = async (next: boolean) => {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      if (next) {
        await e2eService.enable(user.id);
        setEnabled(true);
        setHasKeys(true);
        setFingerprint(e2eService.getFingerprint());
        updateUser({ ...user, e2eEnabled: true });
        toast.success(t("settings.encryption.enabledToast"));
      } else {
        await e2eService.disable();
        setEnabled(false);
        updateUser({ ...user, e2eEnabled: false });
        toast.success(t("settings.encryption.disabledToast"));
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("settings.encryption.toggleFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResetKeys = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      await e2eService.resetKeys();
      setEnabled(false);
      setHasKeys(false);
      setFingerprint(null);
      updateUser({ ...user, e2eEnabled: false });
      setResetConfirmOpen(false);
      toast.success(t("settings.encryption.resetDone"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t("settings.encryption.resetFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="as-section-title">{t("settings.encryption.title")}</h2>
      <p className="as-hint">{t("settings.encryption.panelLead")}</p>

      <button
        type="button"
        className="as-action-row e2e-settings-entry"
        disabled={loading}
        onClick={() => setModalOpen(true)}
      >
        <span className="as-action-row-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <span className="as-action-row-copy">
          <strong>{t("settings.encryption.manage")}</strong>
          <span>{t(`settings.encryption.status.${uiStatus}`)}</span>
        </span>
        <span
          className={`as-status-pill e2e-settings-entry__pill${
            uiStatus === "active"
              ? " as-status-pill--success"
              : uiStatus === "generating"
                ? " e2e-settings-status-pill--busy"
                : " as-status-pill--warn"
          }`}
        >
          {t(`settings.encryption.statusShort.${uiStatus}`)}
        </span>
        <span className="as-action-row-chevron" aria-hidden>›</span>
      </button>

      <EncryptionSettingsModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setResetConfirmOpen(false);
        }}
        loading={loading}
        busy={busy}
        enabled={enabled}
        hasKeys={hasKeys}
        fingerprint={fingerprint}
        clearOnLogout={clearOnLogout}
        resetConfirmOpen={resetConfirmOpen}
        uiStatus={uiStatus}
        onToggle={(next) => void handleToggle(next)}
        onClearOnLogoutChange={(next) => {
          setClearOnLogout(next);
          void e2eService.setClearKeysOnLogout(next);
        }}
        onResetClick={() => setResetConfirmOpen(true)}
        onResetConfirm={() => void handleResetKeys()}
        onResetCancel={() => setResetConfirmOpen(false)}
      />
    </>
  );
}
