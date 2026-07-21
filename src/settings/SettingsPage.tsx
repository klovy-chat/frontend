import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSpotifyListeningSync } from "../hooks/useSpotifyListeningSync";
import { notifySpotifyConnectionChanged } from "../utils/sync/spotifyConnectionSync";
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

  const [spotifyOauthError, setSpotifyOauthError] = useState<string | null>(null);
  const [spotifyOauthConnected, setSpotifyOauthConnected] = useState(false);

  useSpotifyListeningSync();

  useEffect(() => {
    const spotify = searchParams.get("spotify");
    if (spotify !== "connected" && spotify !== "error") return;

    if (spotify === "connected") {
      setSpotifyOauthConnected(true);
      setSpotifyOauthError(null);
      notifySpotifyConnectionChanged();
    } else {
      const raw = searchParams.get("message");
      setSpotifyOauthError(raw ? decodeURIComponent(raw) : t("sidebar.toast.spotifyFailed"));
      setSpotifyOauthConnected(false);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("spotify");
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
        spotifyOauthError={spotifyOauthError}
        spotifyOauthConnected={spotifyOauthConnected}
      />
    </div>
  );
}
