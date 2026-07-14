import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAdminSession } from "../../api/admin";
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
  | { status: "denied"; reason: "not_logged_in" | "forbidden" | "not_configured" };

export function AdminPanelModal({ isOpen, isClosing, onClose }: AdminPanelModalProps) {
  const { t } = useTranslation();
  const [access, setAccess] = useState<AdminAccessState>({ status: "loading" });

  const refreshAccess = () => {
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
        setAccess({ status: "denied", reason: "not_logged_in" });
      });
  };

  useEffect(() => {
    if (!isOpen || isClosing) return;
    refreshAccess();
  }, [isOpen, isClosing]);

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

  if (!isOpen && !isClosing) return null;

  return (
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
          <AdminAccessGate reason={access.reason} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
