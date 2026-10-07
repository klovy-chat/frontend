// Settings.tsx
// Route ustawień: slug → Panel, close wraca na /.
// Zakres:
//  - redirect gdy brak sekcji
//  - route /settings/:slug → Panel; close wraca na /
// Nowa zakładka zaczyna się od routes.ts, nie od JSX.
// Przy zmianach: settings/routes.ts, settings/Panel.tsx.

import { useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Nav } from "../components/layout/Nav";
import { Panel } from "./Panel";
import { BottomNav } from "../components/layout/BottomNav";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSection,
  settingsPath,
  type SettingsSection,
} from "./routes";
import "./settings.css";

export function Settings() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { section: sectionSlug } = useParams<{ section?: string }>();
  const section = parseSettingsSection(sectionSlug) ?? DEFAULT_SETTINGS_SECTION;

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
    <div className="app-shell app-shell--settings-tab settings-page">
      {!isMobile && <div className="app-shell__nav"><Nav
        settingsActive totalUnread={0}
        onOpenHome={() => navigate("/")}
        onOpenChats={() => navigate("/", { state: { workspaceTab: "chats" } })}
        onOpenCalls={() => navigate("/", { state: { workspaceTab: "calls" } })}
        onOpenProfile={() => navigate("/", { state: { workspaceTab: "profile" } })}
        onOpenContacts={() => navigate("/", { state: { workspaceTab: "contacts", openContacts: true } })}
        onOpenSettings={() => navigate(settingsPath(section))}
      /></div>}
      <Panel
        section={section}
        onSectionChange={handleSectionChange}
        onClose={handleClose}
      />
      {isMobile && (
        <BottomNav
          active="settings"
          onChats={() => navigate("/")}
          onContacts={() => navigate("/", { state: { openContacts: true } })}
          onSettings={() => navigate(settingsPath("konto"))}
        />
      )}
    </div>
  );
}
