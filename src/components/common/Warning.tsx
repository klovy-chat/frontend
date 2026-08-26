// Warning.tsx
// Baner ostrzeżeń konta (acknowledge = przeczytane).
// Zakres:
//  - GET/POST warnings w api/auth
//  - baner ostrzeżeń; acknowledge = przeczytane
// Wejście w zakładkę Ostrzeżenia w Panel też acknowledge'uje.
// Przy zmianach: Panel.tsx, model/warnings.rs.

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import {
  acknowledgeMyWarnings,
  getMyWarnings,
  type OwnWarning,
} from "../../api/auth";
import { useWebSocket } from "../../context/WebSocketContext";
import { useLocale } from "../../context/LocaleContext";
import { WsType } from "../../api/protocol";
import { warningSeverityLabel } from "../../utils/user/format";
import "../../styles/account/warnings.css";

export function Warning() {
  const { t } = useTranslation();
  const { dateLocale } = useLocale();
  const ws = useWebSocket();
  const [warnings, setWarnings] = useState<OwnWarning[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const formatDate = useCallback(
    (value: string | null): string => {
      if (!value) return "";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(dateLocale);
    },
    [dateLocale],
  );

  const load = useCallback(async () => {
    try {
      const res = await getMyWarnings();
      const unack = res.warnings.filter((w) => !w.acknowledged);
      if (unack.length > 0) {
        setWarnings(unack);
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ws) return;
    const unsubWarned = ws.subscribe(
      WsType.USER_WARNED,
      (data: { warning?: OwnWarning }) => {
        const warning = data?.warning;
        if (!warning || !warning.id) return;
        setWarnings((prev) =>
          prev.some((w) => w.id === warning.id) ? prev : [warning, ...prev],
        );
        setOpen(true);
      },
    );
    const unsubRevoked = ws.subscribe(
      WsType.USER_WARNING_REVOKED,
      (data: { warningId?: string; id?: string }) => {
        const id = data?.warningId ?? data?.id;
        if (!id) {
          void load();
          return;
        }
        setWarnings((prev) => {
          const next = prev.filter((w) => w.id !== id);
          if (next.length === 0) setOpen(false);
          return next;
        });
      },
    );
    return () => {
      unsubWarned();
      unsubRevoked();
    };
  }, [ws, load]);

  const acknowledge = async () => {
    setSubmitting(true);
    setError("");
    try {
      await acknowledgeMyWarnings();
      setOpen(false);
      setWarnings([]);
    } catch {
      setError(t("warnings.acknowledgeFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || warnings.length === 0) return null;

  return (
    <div className="warn-overlay">
      <div className="warn-card" role="alertdialog" aria-modal="true">
        <div className="warn-icon">
          <AlertTriangle size={30} strokeWidth={2.2} />
        </div>
        <h2 className="warn-title">
          {t("warnings.title", { count: warnings.length })}
        </h2>
        <p className="warn-lead">{t("warnings.lead")}</p>

        <div className="warn-list">
          {warnings.map((w) => (
            <div key={w.id} className="warn-item">
              <div className="warn-item-head">
                <span className={`warn-sev warn-sev-${w.severity}`}>
                  {warningSeverityLabel(w.severity)}
                </span>
                <span className="warn-item-date">{formatDate(w.createdAt)}</span>
              </div>
              <div className="warn-item-reason">{w.reason}</div>
            </div>
          ))}
        </div>

        {error ? <div className="warn-error">{error}</div> : null}

        <button
          type="button"
          className="warn-btn"
          disabled={submitting}
          onClick={acknowledge}
        >
          {submitting ? t("common.processing") : t("warnings.accept")}
        </button>
      </div>
    </div>
  );
}
