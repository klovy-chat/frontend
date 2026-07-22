import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { e2eService } from "../../crypto/e2e/e2eService";

type E2eUiStatus = "disabled" | "generating" | "active";

function formatFingerprint(value: string | null): string {
  if (!value) return "—";
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += 4) {
    chunks.push(value.slice(i, i + 4));
  }
  return chunks.join(" ");
}

export function EncryptionSettingsPanel() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const toast = useToast();
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
      <p className="as-group-label">{t("settings.encryption.subtitle")}</p>

      <div style={{ marginBottom: 20 }}>
        <label className="al-checkbox-wrap as-integration-share-toggle">
          <input
            type="checkbox"
            checked={enabled && hasKeys}
            disabled={loading || busy}
            onChange={(e) => void handleToggle(e.target.checked)}
          />
          <span className="al-checkbox-box">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <span className="al-checkbox-text">{t("settings.encryption.toggle")}</span>
        </label>

        <p className="as-group-label as-group-label--language">
          {t(`settings.encryption.status.${uiStatus}`)}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p className="as-group-label">{t("settings.encryption.fingerprintLabel")}</p>
        <p
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
            wordBreak: "break-all",
            margin: "8px 0",
          }}
        >
          {formatFingerprint(fingerprint)}
        </p>
        <p className="as-group-label as-group-label--language">
          {t("settings.encryption.fingerprintHint")}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p className="as-group-label">{t("settings.encryption.limitationsTitle")}</p>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
          <li>{t("settings.encryption.limitations.search")}</li>
          <li>{t("settings.encryption.limitations.preview")}</li>
          <li>{t("settings.encryption.limitations.attachments")}</li>
          <li>{t("settings.encryption.limitations.deviceLoss")}</li>
          <li>{t("settings.encryption.limitations.plaintextHistory")}</li>
        </ul>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label className="al-checkbox-wrap as-integration-share-toggle">
          <input
            type="checkbox"
            checked={clearOnLogout}
            disabled={loading || busy}
            onChange={(e) => {
              const next = e.target.checked;
              setClearOnLogout(next);
              void e2eService.setClearKeysOnLogout(next);
            }}
          />
          <span className="al-checkbox-box">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <span className="al-checkbox-text">{t("settings.encryption.clearOnLogout")}</span>
        </label>
        <p className="as-group-label as-group-label--language">
          {t("settings.encryption.clearOnLogoutHint")}
        </p>
      </div>

      {hasKeys ? (
        <div style={{ marginTop: 8 }}>
          {!resetConfirmOpen ? (
            <button
              type="button"
              className="as-btn-danger"
              disabled={loading || busy}
              onClick={() => setResetConfirmOpen(true)}
            >
              {t("settings.encryption.resetKeys")}
            </button>
          ) : (
            <div>
              <p className="as-error" style={{ marginBottom: 12 }}>
                {t("settings.encryption.resetConfirm")}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="as-btn-danger"
                disabled={busy}
                onClick={() => void handleResetKeys()}
              >
                {t("settings.encryption.resetConfirmAction")}
              </button>
              <button
                type="button"
                className="as-btn-ghost"
                disabled={busy}
                onClick={() => setResetConfirmOpen(false)}
              >
                {t("common.cancel")}
              </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
