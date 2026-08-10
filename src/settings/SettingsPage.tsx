import { useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { SettingsView } from "./SettingsView";
import {
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSection,
  settingsPath,
  type SettingsSection,
} from "./routes";
import "./settings-page.css";

export function SettingsPage() {
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
      <SettingsView
        section={section}
        onSectionChange={handleSectionChange}
        onClose={handleClose}
      />
    </div>
  );
}
