import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppNavRail } from "../components/layout/AppNavRail";
import { MobileShellBar, type ShellOverlay } from "../components/layout/MobileShellBar";
import { getContactsForList } from "../api/contacts";
import { getUserChannels } from "../api/channels";
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

  const [shellOverlay, setShellOverlay] = useState<ShellOverlay>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [spotifyOauthError, setSpotifyOauthError] = useState<string | null>(null);
  const [spotifyOauthConnected, setSpotifyOauthConnected] = useState(false);

  useSpotifyListeningSync();

  const refreshUnread = useCallback(async () => {
    try {
      const [contactsRes, channelsRes] = await Promise.all([
        getContactsForList(),
        getUserChannels(),
      ]);
      const unread =
        contactsRes.contacts.reduce(
          (sum, c) => sum + (c.isMuted ? 0 : (c.unreadCount ?? 0)),
          0,
        )
        + channelsRes.channels.reduce(
          (sum, ch) => sum + (ch.isMuted ? 0 : (ch.unreadCount ?? 0)),
          0,
        );
      setTotalUnread(unread);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

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
      setShellOverlay(null);
      navigate(settingsPath(nextSection));
    },
    [navigate],
  );

  const handleClose = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const overlayClass = useMemo(() => {
    if (shellOverlay === "nav") return " app-shell--overlay-nav";
    if (shellOverlay === "settings-nav") return " app-shell--overlay-settings-nav";
    return "";
  }, [shellOverlay]);

  if (!sectionSlug) {
    return <Navigate to={settingsPath(DEFAULT_SETTINGS_SECTION)} replace />;
  }

  if (!parseSettingsSection(sectionSlug)) {
    return <Navigate to={settingsPath(DEFAULT_SETTINGS_SECTION)} replace />;
  }

  return (
    <div className={`app-shell app-shell--settings-standalone settings-page${overlayClass}`}>
      <button
        type="button"
        className="mobile-shell-scrim settings-page__mobile-only"
        aria-label={t("common.closePanel")}
        onClick={() => setShellOverlay(null)}
      />
      <div className="app-shell__nav settings-page__mobile-only">
        <AppNavRail
          settingsActive
          totalUnread={totalUnread}
          onOpenChats={() => navigate("/")}
          onOpenSettings={() => navigate(settingsPath(section))}
          onOpenContacts={() => navigate("/")}
          onOpenAdmin={() => navigate("/")}
        />
      </div>
      <div className="settings-page__shell">
        <div className="settings-page__mobile-only">
          <MobileShellBar
            variant="settings"
            title={t("nav.items.settings")}
            overlay={shellOverlay}
            onOverlayChange={setShellOverlay}
            onClose={handleClose}
            showList={false}
          />
        </div>
        <SettingsView
          section={section}
          onSectionChange={handleSectionChange}
          onClose={handleClose}
          spotifyOauthError={spotifyOauthError}
          spotifyOauthConnected={spotifyOauthConnected}
          onSpotifyOauthHandled={() => setSpotifyOauthConnected(false)}
        />
      </div>
    </div>
  );
}
