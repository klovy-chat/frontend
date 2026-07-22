import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getAdminSession, type AdminSessionReason } from "../../api/admin";
import { useAuth } from "../../context/AuthContext";
import { AdminPanel } from "../../pages/AdminPanelPage";
import { AdminAccessGate } from "./AdminAccessGate";
import "../../styles/admin/admin.css";

interface AdminPanelModalProps {
  isOpen: boolean;
  isClosing: boolean;
  onClose: () => void;
}

type AdminAccessState =
  | { status: "loading" }
  | { status: "ok" }
  | { status: "denied"; reason: AdminSessionReason };

export function AdminPanelModal({ isOpen, isClosing, onClose }: AdminPanelModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [access, setAccess] = useState<AdminAccessState>({ status: "loading" });

  const refreshAccess = () => {
    if (!user?.isPanelAdmin) {
      setAccess({ status: "denied", reason: "forbidden" });
      return;
    }

    setAccess({ status: "loading" });
    getAdminSession()
      .then((session) => {
        if (session.authenticated) {
          setAccess({ status: "ok" });
          return;
        }
        const reason = session.reason ?? "not_logged_in";
        setAccess({ status: "denied", reason });
      })
      .catch(() => {
        setAccess({ status: "denied", reason: "forbidden" });
      });
  };

  useEffect(() => {
    if (!isOpen || isClosing) return;
    if (!user?.isPanelAdmin) {
      onClose();
      return;
    }
    refreshAccess();
  }, [isOpen, isClosing, user?.isPanelAdmin, onClose]);

  useEffect(() => {
    if (!isOpen || isClosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isClosing, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if ((!isOpen && !isClosing) || !user?.isPanelAdmin) return null;

  return createPortal(
    <div
      className={`adm-backdrop klovy-backdrop klovy-backdrop--high${isClosing ? " closing" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.modal.ariaLabel")}
    >
      <div className={`adm-modal-wrap${isClosing ? " closing" : ""}`}>
        {access.status === "loading" ? (
          <div className="adm-loading-card">
            <div className="adm-loading-text">{t("admin.modal.checkingPermissions")}</div>
          </div>
        ) : access.status === "ok" ? (
          <AdminPanel onClose={onClose} />
        ) : (
          <AdminAccessGate reason={access.reason} onClose={onClose} onAccessGranted={refreshAccess} />
        )}
      </div>
    </div>,
    document.body,
  );
}
