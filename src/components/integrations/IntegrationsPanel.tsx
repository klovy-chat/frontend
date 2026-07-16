import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  connectSpotify,
  disconnectSpotify,
  getSpotifyStatus,
  syncSpotifyListening,
  updateShareListening,
} from "../../api/integrations";
import { notifySpotifyConnectionChanged } from "../../utils/sync/spotifyConnectionSync";
import { getClientInstanceId } from "../../utils/env/clientInstanceId";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

interface IntegrationsPanelProps {
  spotifyOauthError?: string | null;
  spotifyOauthConnected?: boolean;
}

export function IntegrationsPanel({
  spotifyOauthError = null,
  spotifyOauthConnected = false,
}: IntegrationsPanelProps) {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [shareListening, setShareListening] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (spotifyOauthError) {
      setError(spotifyOauthError);
      toast.error(spotifyOauthError);
    }
  }, [spotifyOauthError, toast]);

  const refreshStatus = () => {
    setLoading(true);
    return getSpotifyStatus()
      .then((status) => {
        setConnected(status.connected);
        setEnabled(status.enabled);
        setShareListening(status.shareListening);
        if (user) {
          updateUser({
            ...user,
            shareListening: status.shareListening,
            spotifyConnected: status.connected,
          });
        }
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
      if (!status) return;
      if (status.connected) {
        setError("");
        toast.success(t("modals.integrations.spotify.toastConnected"));
      } else {
        setError(t("modals.integrations.spotify.authIncomplete"));
      }
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
      if (user) {
        updateUser({ ...user, listeningActivity: null, shareListening });
      }
      toast.success(t("modals.integrations.spotify.toastDisconnected"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modals.integrations.spotify.disconnectFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleTestSync = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const result = await syncSpotifyListening({
        clientType: "web",
        clientInstanceId: getClientInstanceId(),
      });
      updateUser({
        ...user,
        shareListening: result.shareListening,
        listeningActivity: result.listeningActivity,
      });
      if (result.listeningActivity?.isPlaying && result.listeningActivity.trackTitle) {
        const artist = result.listeningActivity.artist
          ? ` — ${result.listeningActivity.artist}`
          : "";
        toast.success(
          t("modals.integrations.spotify.syncDetected", {
            track: result.listeningActivity.trackTitle,
            artist,
          }),
        );
      } else if (!result.shareListening) {
        setError(t("modals.integrations.spotify.shareRequired"));
      } else {
        setError(t("modals.integrations.spotify.noPlayback"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modals.integrations.spotify.syncFailed"));
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

      <div className="as-card">
        <span className="as-card-label">{t("modals.integrations.spotify.title")}</span>
        <p className="as-hint">{t("modals.integrations.spotify.intro")}</p>
        <p className="as-hint" style={{ marginTop: 8 }}>
          {t("modals.integrations.spotify.apiPrivacyNote")}
        </p>
        <p className="as-hint" style={{ marginTop: 8 }}>
          {t("modals.integrations.spotify.reconnectNote")}
        </p>

        {loading ? (
          <p className="as-hint">{t("common.loading")}</p>
        ) : !enabled ? (
          <p className="as-hint">{t("modals.integrations.spotify.notConfigured")}</p>
        ) : (
          <>
            <div className="as-session-row">
              <div>
                <strong>
                  {connected
                    ? t("modals.integrations.spotify.connected")
                    : t("modals.integrations.spotify.notConnected")}
                </strong>
                <p className="as-hint" style={{ margin: "4px 0 0" }}>
                  {connected
                    ? t("modals.integrations.spotify.connectedHint")
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

            {connected ? (
              <>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 16,
                    fontSize: "0.88rem",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={shareListening}
                    disabled={busy}
                    onChange={(e) => void handleShareToggle(e.target.checked)}
                  />
                  <span>{t("modals.integrations.spotify.shareListening")}</span>
                </label>
                <button
                  type="button"
                  className="as-btn-ghost"
                  disabled={busy}
                  style={{ marginTop: 12 }}
                  onClick={() => void handleTestSync()}
                >
                  {busy ? t("common.checking") : t("modals.integrations.spotify.syncNow")}
                </button>
              </>
            ) : null}
          </>
        )}

        {error ? <p className="as-error">{error}</p> : null}
      </div>
    </>
  );
}
