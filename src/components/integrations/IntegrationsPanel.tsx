import { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  connectIntegration,
  disconnectIntegration,
  getIntegrationsCatalog,
  getIntegrationStatus,
  mergeConnectedAccount,
  updateShareListening,
  type IntegrationCatalogItem,
} from "../../api/integrations";
import { notifyListeningConnectionChanged } from "../../utils/sync/listeningConnectionSync";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { IntegrationProviderIcon } from "../profile/IntegrationProviderIcon";

interface IntegrationsPanelProps {
  integrationOauthProvider?: string | null;
  integrationOauthStatus?: "connected" | "error" | null;
  integrationOauthError?: string | null;
  onOauthHandled?: () => void;
}

type ProviderState = {
  connected: boolean;
  enabled: boolean;
  oauthSupported: boolean;
  accountName: string | null;
  profileUrl: string | null;
};

export function IntegrationsPanel({
  integrationOauthProvider = null,
  integrationOauthStatus = null,
  integrationOauthError = null,
  onOauthHandled,
}: IntegrationsPanelProps) {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [catalog, setCatalog] = useState<IntegrationCatalogItem[]>([]);
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});
  const [shareListening, setShareListening] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (integrationOauthError) {
      setError(integrationOauthError);
      toast.error(integrationOauthError);
    }
  }, [integrationOauthError, toast]);

  const patchUserAccounts = (
    provider: string,
    connected: boolean,
    accountName: string | null,
    profileUrl: string | null,
    extra?: Partial<{ shareListening: boolean; listeningActivity: null }>,
  ) => {
    if (!user) return;
    const connectedAccounts = mergeConnectedAccount(
      user.connectedAccounts,
      provider,
      connected && accountName && profileUrl ? { accountName, profileUrl } : null,
    );
    updateUser({
      ...user,
      connectedAccounts,
      ...(provider === "spotify"
        ? {
            spotifyConnected: connected,
            shareListening: extra?.shareListening ?? user.shareListening,
            listeningActivity: connected ? user.listeningActivity : null,
          }
        : {}),
      ...extra,
    });
  };

  const refreshProvider = async (provider: IntegrationCatalogItem) => {
    const status = await getIntegrationStatus(provider.id);
    setProviderStates((prev) => ({
      ...prev,
      [provider.id]: {
        connected: status.connected,
        enabled: status.enabled,
        oauthSupported: status.oauthSupported,
        accountName: status.accountName ?? null,
        profileUrl: status.profileUrl ?? null,
      },
    }));
    if (provider.id === "spotify" && status.shareListening !== undefined) {
      setShareListening(status.shareListening);
    }
    patchUserAccounts(
      provider.id,
      status.connected,
      status.accountName ?? null,
      status.profileUrl ?? null,
      provider.id === "spotify" ? { shareListening: status.shareListening } : undefined,
    );
    if (provider.id === "spotify" && status.connected) {
      notifyListeningConnectionChanged();
    }
    return status;
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");
    try {
      const { providers } = await getIntegrationsCatalog();
      setCatalog(providers);
      await Promise.all(providers.map((p) => refreshProvider(p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modals.integrations.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!integrationOauthProvider || !integrationOauthStatus) return;
    if (integrationOauthStatus === "connected") {
      void refreshAll().then(() => {
        if (integrationOauthProvider === "spotify") {
          notifyListeningConnectionChanged();
          toast.success(t("modals.integrations.spotify.toastConnected"));
        } else {
          toast.success(
            t("modals.integrations.connected", {
              provider: integrationOauthProvider,
              defaultValue: "Konto połączone.",
            }),
          );
        }
        onOauthHandled?.();
      });
    } else {
      onOauthHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationOauthProvider, integrationOauthStatus]);

  const handleConnect = async (providerId: string) => {
    setBusyProvider(providerId);
    setError("");
    try {
      await connectIntegration(providerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modals.integrations.connectFailed"));
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    setBusyProvider(providerId);
    setError("");
    try {
      await disconnectIntegration(providerId);
      setProviderStates((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          connected: false,
          accountName: null,
          profileUrl: null,
        },
      }));
      patchUserAccounts(providerId, false, null, null);
      toast.success(
        providerId === "spotify"
          ? t("modals.integrations.spotify.toastDisconnected")
          : t("modals.integrations.disconnected"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modals.integrations.disconnectFailed"));
    } finally {
      setBusyProvider(null);
    }
  };

  const handleShareToggle = async (next: boolean) => {
    setBusyProvider("spotify-share");
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
      setBusyProvider(null);
    }
  };

  const renderRow = (
    providerId: string,
    title: string,
    state: ProviderState | undefined,
    hintConnected: string | null,
  ) => {
    const connected = state?.connected ?? false;
    const enabled = state?.enabled ?? false;
    const oauthSupported = state?.oauthSupported ?? true;
    const busy = busyProvider === providerId;

    return (
      <div className="as-integration-row">
        <IntegrationProviderIcon provider={providerId} className="as-integration-icon" />
        <div className="as-integration-copy">
          <strong>{title}</strong>
          <p className="as-hint">
            {!oauthSupported
              ? t("modals.integrations.noPublicApi")
              : !enabled
                ? t("modals.integrations.notConfigured")
                : connected && hintConnected
                  ? hintConnected
                  : t("modals.integrations.notConnectedHint")}
          </p>
        </div>
        {connected ? (
          <button
            type="button"
            className="as-btn-ghost"
            disabled={Boolean(busyProvider)}
            onClick={() => void handleDisconnect(providerId)}
          >
            {t("modals.integrations.disconnect")}
          </button>
        ) : (
          <button
            type="button"
            className="as-btn-primary"
            disabled={Boolean(busyProvider) || !enabled || !oauthSupported}
            onClick={() => void handleConnect(providerId)}
          >
            {busy ? t("common.connecting") : t("modals.integrations.connect")}
          </button>
        )}
      </div>
    );
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
        ) : (
          catalog.map((provider) => {
            const state =
              providerStates[provider.id] ?? {
                connected: false,
                enabled: provider.enabled,
                oauthSupported: provider.oauthSupported,
                accountName: null,
                profileUrl: null,
              };
            const connected = state.connected;

            return (
              <Fragment key={provider.id}>
                {renderRow(
                  provider.id,
                  provider.id === "spotify"
                    ? t("modals.integrations.spotify.title")
                    : provider.name,
                  state,
                  state.accountName,
                )}
                {provider.listeningSync && connected ? (
                  <label className="al-checkbox-wrap as-integration-share-toggle">
                    <input
                      type="checkbox"
                      checked={shareListening}
                      disabled={Boolean(busyProvider) || loading}
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
              </Fragment>
            );
          })
        )}
      </div>

      {error ? <p className="as-error">{error}</p> : null}
    </>
  );
}
