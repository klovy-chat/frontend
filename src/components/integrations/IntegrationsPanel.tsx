import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  connectSpotify,
  disconnectSpotify,
  getSpotifyStatus,
  updateShareListening,
} from "../../api/integrations";
import { notifySpotifyConnectionChanged } from "../../utils/sync/spotifyConnectionSync";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { IntegrationProviderIcon } from "../profile/IntegrationProviderIcon";
import type { ConnectedAccount } from "../../types";

interface IntegrationsPanelProps {
  spotifyOauthError?: string | null;
  spotifyOauthConnected?: boolean;
  onSpotifyOauthHandled?: () => void;
}

export function IntegrationsPanel({
  spotifyOauthError = null,
  spotifyOauthConnected = false,
  onSpotifyOauthHandled,
}: IntegrationsPanelProps) {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [shareListening, setShareListening] = useState(true);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (spotifyOauthError) {
      setError(spotifyOauthError);
      toast.error(spotifyOauthError);
    }
  }, [spotifyOauthError, toast]);

  const applyStatusToUser = (
    statusConnected: boolean,
    statusShareListening: boolean,
    nextAccountName: string | null,
    nextProfileUrl: string | null,
  ) => {
    if (!user) return;
    const connectedAccounts: ConnectedAccount[] =
      statusConnected && nextAccountName && nextProfileUrl
        ? [
            {
              provider: "spotify",
              accountName: nextAccountName,
              profileUrl: nextProfileUrl,
            },
          ]
        : [];

    updateUser({
      ...user,
      shareListening: statusShareListening,
      spotifyConnected: statusConnected,
      connectedAccounts,
      listeningActivity: statusConnected ? user.listeningActivity : null,
    });
  };

  const refreshStatus = () => {
    setLoading(true);
    return getSpotifyStatus()
      .then((status) => {
        setConnected(status.connected);
        setEnabled(status.enabled);
        setShareListening(status.shareListening);
        setAccountName(status.accountName ?? null);
        applyStatusToUser(
          status.connected,
          status.shareListening,
          status.accountName ?? null,
          status.profileUrl ?? null,
        );
        if (status.connected) {
          notifySpotifyConnectionChanged();
        }
        return status;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("modals.integrations.spotify.loadFailed"));
        return null;
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!spotifyOauthConnected) return;
    void refreshStatus().then((status) => {
      if (!status) {
        onSpotifyOauthHandled?.();
        return;
      }
      if (status.connected) {
        setError("");
        toast.success(t("modals.integrations.spotify.toastConnected"));
      } else {
        setError(t("modals.integrations.spotify.authIncomplete"));
      }
      onSpotifyOauthHandled?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyOauthConnected]);

  const handleConnect = async () => {
    setError("");
    setBusy(true);
    try {
      await connectSpotify();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modals.integrations.spotify.loginFailed"));
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError("");
    try {
      await disconnectSpotify();
      setConnected(false);
      setAccountName(null);
      applyStatusToUser(false, shareListening, null, null);
      toast.success(t("modals.integrations.spotify.toastDisconnected"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modals.integrations.spotify.disconnectFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleShareToggle = async (next: boolean) => {
    setBusy(true);
    setError("");
    const prev = shareListening;
    setShareListening(next);
    try {
      const res = await updateShareListening(next);
      setShareListening(res.shareListening);
      if (user) {
        updateUser({
          ...user,
          shareListening: res.shareListening,
          listeningActivity: res.shareListening ? user.listeningActivity : null,
        });
      }
      toast.success(
        res.shareListening
          ? t("modals.integrations.spotify.shareOn")
          : t("modals.integrations.spotify.shareOff"),
      );
    } catch (err) {
      setShareListening(prev);
      setError(err instanceof Error ? err.message : t("modals.integrations.spotify.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="as-section-title">{t("modals.integrations.title")}</h2>
      <p className="as-group-label as-group-label--language">
        {t("modals.integrations.subtitle")}
      </p>

      <div className="as-integration-list">
        {loading ? (
          <p className="as-hint">{t("common.loading")}</p>
        ) : !enabled ? (
          <p className="as-hint">{t("modals.integrations.spotify.notConfigured")}</p>
        ) : (
          <div className="as-integration-row">
            <IntegrationProviderIcon provider="spotify" className="as-integration-icon" />
            <div className="as-integration-copy">
              <strong>{t("modals.integrations.spotify.title")}</strong>
              <p className="as-hint">
                {connected && accountName
                  ? accountName
                  : t("modals.integrations.spotify.notConnectedHint")}
              </p>
            </div>
            {connected ? (
              <button
                type="button"
                className="as-btn-ghost"
                disabled={busy}
                onClick={() => void handleDisconnect()}
              >
                {t("modals.integrations.spotify.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="as-btn-primary"
                disabled={busy}
                onClick={() => void handleConnect()}
              >
                {busy ? t("common.connecting") : t("modals.integrations.spotify.connect")}
              </button>
            )}
          </div>
        )}
      </div>

      {connected ? (
        <label className="al-checkbox-wrap as-integration-share-toggle">
          <input
            type="checkbox"
            checked={shareListening}
            disabled={busy || loading}
            onChange={(e) => void handleShareToggle(e.target.checked)}
          />
          <span className="al-checkbox-box">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <span className="al-checkbox-text">
            {t("modals.integrations.spotify.shareListening")}
          </span>
        </label>
      ) : null}

      {error ? <p className="as-error">{error}</p> : null}
    </>
  );
}
