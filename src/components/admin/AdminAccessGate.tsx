import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { AdminSessionReason } from "../../api/admin";
import { elevateAdminSession } from "../../api/admin";
import { ApiError } from "../../api/client";
import { AdminBrand } from "./AdminBrand";
import "../../styles/admin/admin.css";

interface AdminAccessGateProps {
  reason: AdminSessionReason | null;
  onClose: () => void;
  onAccessGranted?: () => void;
}

export function AdminAccessGate({ reason, onClose, onAccessGranted }: AdminAccessGateProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [adminSecret, setAdminSecret] = useState("");
  const [elevating, setElevating] = useState(false);
  const [elevateError, setElevateError] = useState("");

  const title =
    reason === "not_configured"
      ? t("admin.gate.notConfigured")
      : reason === "ip_not_allowed"
        ? t("admin.gate.ipNotAllowed")
        : reason === "elevation_required"
          ? t("admin.gate.elevationRequired")
          : reason === "forbidden"
            ? t("admin.gate.forbidden")
            : t("admin.gate.loginRequired");

  const message =
    reason === "not_configured"
      ? t("admin.gate.notConfiguredMsg")
      : reason === "ip_not_allowed"
        ? t("admin.gate.ipNotAllowedMsg")
        : reason === "elevation_required"
          ? t("admin.gate.elevationRequiredMsg")
          : reason === "forbidden"
            ? user
              ? t("admin.gate.forbiddenMsg", { username: user.username })
              : t("admin.gate.forbiddenGeneric")
            : t("admin.gate.loginMsg");

  const handleElevate = async (e: FormEvent) => {
    e.preventDefault();
    setElevateError("");
    const secret = adminSecret.trim();
    if (!secret) {
      setElevateError(t("admin.gate.elevationSecretRequired"));
      return;
    }

    setElevating(true);
    try {
      await elevateAdminSession(secret);
      setAdminSecret("");
      onAccessGranted?.();
    } catch (err) {
      setElevateError(
        err instanceof ApiError ? err.message : t("admin.gate.elevationFailed"),
      );
    } finally {
      setElevating(false);
    }
  };

  return (
    <div className="adm-login-view adm-login-view--gate">
      <button
        type="button"
        className="adm-view-close"
        onClick={onClose}
        title={t("common.close")}
        aria-label={t("common.close")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="adm-login-form adm-access-gate">
        <AdminBrand />
        <h1>{title}</h1>
        <p className="adm-lead">{message}</p>

        {reason === "elevation_required" ? (
          <form className="adm-access-gate__elevate" onSubmit={handleElevate}>
            <label htmlFor="admin-elevation-secret">{t("admin.gate.elevationSecretLabel")}</label>
            <input
              id="admin-elevation-secret"
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              autoComplete="off"
              placeholder={t("admin.gate.elevationSecretPlaceholder")}
              disabled={elevating}
            />
            {elevateError ? <p className="adm-access-gate__error">{elevateError}</p> : null}
            <button type="submit" className="adm-submit-btn" disabled={elevating}>
              {elevating ? t("admin.gate.elevationSubmitting") : t("admin.gate.elevationSubmit")}
            </button>
          </form>
        ) : reason === "not_logged_in" ? (
          <Link to="/login" className="adm-submit-btn adm-access-gate__link" onClick={onClose}>
            {t("common.goToLogin")}
            <svg className="adm-submit-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        ) : (
          <button type="button" className="adm-submit-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        )}
      </div>
    </div>
  );
}
