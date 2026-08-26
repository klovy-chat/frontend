// PendingApproval.tsx
// Oczekiwanie na whitelist (polling /me, bez WS).
// Zakres:
//  - po akceptacji router wpuszcza na czat
//  - polling /me; bez WebSocket
// Nie podłączaj tu WebSocket — handshake i tak odrzuci pending usera.
// Przy zmianach: App.tsx, utils/auth/whitelist.ts.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { isPendingWhitelist } from "../utils/auth/whitelist";
import { Announcements } from "../components/common/Announcements";
import { AuthLayout } from "../components/auth/AuthLayout";
import "../styles/auth/auth.css";

export function PendingApproval() {
  const { t } = useTranslation();
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (!isPendingWhitelist(user)) {
      navigate("/", { replace: true });
      return;
    }

    const interval = setInterval(() => {
      refreshUser().catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [user?.id, navigate, refreshUser]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <AuthLayout>
        <div className="al-card" style={{ gridTemplateColumns: "1fr", maxWidth: 480 }}>
          <div className="al-left" style={{ borderRight: "none" }}>
            <h1 className="al-title">{t("auth.pending.title")}</h1>
            <p style={{ color: "#9ca3af", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              {t("auth.pending.body", { username: user?.username ?? "" })}
            </p>
            <p style={{ color: "#6b7280", marginBottom: "2rem", fontSize: "0.9rem" }}>
              {t("auth.pending.hint")}
            </p>
            <button type="button" className="al-btn-submit" onClick={handleLogout}>
              {t("auth.pending.logout")}
            </button>
          </div>
        </div>
      </AuthLayout>
      <Announcements />
    </>
  );
}
