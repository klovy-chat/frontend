import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useIntegrationListeningPoll } from "../hooks/useIntegrationListeningPoll";
import { notifyListeningConnectionChanged } from "../utils/sync/listeningConnectionSync";
import { SettingsView } from "./SettingsView";
import {
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSection,
  settingsPath,
  type SettingsSection,
} from "./routes";
import "./settings-page.css";

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { section: sectionSlug } = useParams<{ section?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = parseSettingsSection(sectionSlug) ?? DEFAULT_SETTINGS_SECTION;

  const [integrationOauthProvider, setIntegrationOauthProvider] = useState<string | null>(null);
  const [integrationOauthStatus, setIntegrationOauthStatus] = useState<"connected" | "error" | null>(
    null,
  );
  const [integrationOauthError, setIntegrationOauthError] = useState<string | null>(null);

  useIntegrationListeningPoll();

  useEffect(() => {
    const spotify = searchParams.get("spotify");
    if (spotify === "connected" || spotify === "error") {
      setIntegrationOauthProvider("spotify");
      setIntegrationOauthStatus(spotify === "connected" ? "connected" : "error");
      if (spotify === "connected") {
        setIntegrationOauthError(null);
        notifyListeningConnectionChanged();
      } else {
        const raw = searchParams.get("message");
        setIntegrationOauthError(raw ? decodeURIComponent(raw) : t("sidebar.toast.spotifyFailed"));
      }
      const next = new URLSearchParams(searchParams);
      next.delete("spotify");
      next.delete("message");
      setSearchParams(next, { replace: true });
      return;
    }

    const integration = searchParams.get("integration");
    const status = searchParams.get("status");
    if (!integration || (status !== "connected" && status !== "error")) return;

    setIntegrationOauthProvider(integration);
    setIntegrationOauthStatus(status);
    if (status === "error") {
      const raw = searchParams.get("message");
      setIntegrationOauthError(raw ? decodeURIComponent(raw) : t("modals.integrations.connectFailed"));
    } else {
      setIntegrationOauthError(null);
      if (integration === "spotify") {
        notifyListeningConnectionChanged();
      }
    }

    const next = new URLSearchParams(searchParams);
    next.delete("integration");
    next.delete("status");
    next.delete("message");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t]);

  const handleSectionChange = useCallback(
    (nextSection: SettingsSection) => {
      navigate(settingsPath(nextSection));
    },
    [navigate],
  );

  const handleClose = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (!sectionSlug) {
    return <Navigate to={settingsPath(DEFAULT_SETTINGS_SECTION)} replace />;
  }

  if (!parseSettingsSection(sectionSlug)) {
    return <Navigate to={settingsPath(DEFAULT_SETTINGS_SECTION)} replace />;
  }

  return (
    <div className="app-shell app-shell--settings-standalone settings-page">
      <SettingsView
        section={section}
        onSectionChange={handleSectionChange}
        onClose={handleClose}
        integrationOauthProvider={integrationOauthProvider}
        integrationOauthStatus={integrationOauthStatus}
        integrationOauthError={integrationOauthError}
        onIntegrationOauthHandled={() => {
          setIntegrationOauthProvider(null);
          setIntegrationOauthStatus(null);
          setIntegrationOauthError(null);
        }}
      />
    </div>
  );
}
