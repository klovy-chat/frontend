// Settings.tsx
// Route ustawień: slug → Panel, close wraca na /.
// Zakres:
//  - redirect gdy brak sekcji
//  - route /settings/:slug → Panel; close wraca na /
// Nowa zakładka zaczyna się od routes.ts, nie od JSX.
// Przy zmianach: settings/routes.ts, settings/Panel.tsx.

import { useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Panel } from "./Panel";
import {
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSection,
  settingsPath,
  type SettingsSection,
} from "./routes";
import "./settings.css";

export function Settings() {
  const navigate = useNavigate();
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
    <div className="app-shell app-shell--settings-standalone settings-page">
      <Panel
        section={section}
        onSectionChange={handleSectionChange}
        onClose={handleClose}
      />
    </div>
  );
}
