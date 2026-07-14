import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Megaphone, X } from "lucide-react";
import {
  dismissAnnouncements,
  getMyAnnouncements,
  type AnnouncementItem,
} from "../../api/auth";
import { useWebSocket } from "../../context/WebSocketContext";
import { useLocale } from "../../context/LocaleContext";
import { WsType } from "../../api/wsProtocol";
import "../../styles/common/announcements.css";

function mergeAnnouncements(
  prev: AnnouncementItem[],
  incoming: AnnouncementItem[],
): AnnouncementItem[] {
  const map = new Map<string, AnnouncementItem>();
  for (const item of prev) {
    if (item.id) map.set(item.id, item);
  }
  for (const item of incoming) {
    if (item.id) map.set(item.id, item);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
}

export function AnnouncementModal() {
  const { t } = useTranslation();
  const { dateLocale } = useLocale();
  const ws = useWebSocket();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
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
      const res = await getMyAnnouncements();
      if (res.announcements.length > 0) {
        setAnnouncements(res.announcements);
        setOpen(true);
      }
    } catch {
      /* brak połączenia nie powinien blokować UI */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ws) return;
    const unsub = ws.subscribe(
      WsType.ANNOUNCEMENT_PUBLISHED,
      (data: { announcement?: AnnouncementItem }) => {
        const announcement = data?.announcement;
        if (!announcement?.id) return;
        setAnnouncements((prev) => mergeAnnouncements(prev, [announcement]));
        setOpen(true);
      },
    );
    return unsub;
  }, [ws]);

  const dismissIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      await dismissAnnouncements(ids);
      setAnnouncements((prev) => prev.filter((a) => !ids.includes(a.id ?? "")));
    } catch {
      setError(t("announcements.dismissFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const dismissOne = (id: string) => {
    void dismissIds([id]);
  };

  const dismissAll = () => {
    const ids = announcements.map((a) => a.id).filter(Boolean) as string[];
    void dismissIds(ids);
  };

  useEffect(() => {
    if (announcements.length === 0) {
      setOpen(false);
    }
  }, [announcements.length]);

  if (!open || announcements.length === 0) return null;

  return (
    <div className="ann-overlay">
      <div className="ann-card" role="dialog" aria-modal="true" aria-labelledby="ann-title">
        <div className="ann-icon">
          <Megaphone size={28} strokeWidth={2.2} />
        </div>
        <h2 id="ann-title" className="ann-title">
          {t("announcements.title")}
        </h2>
        <p className="ann-lead">{t("announcements.lead")}</p>

        <div className="ann-list">
          {announcements.map((item) => (
            <article key={item.id} className="ann-item">
              <div className="ann-item-head">
                <h3>{item.title}</h3>
                {announcements.length > 1 ? (
                  <button
                    type="button"
                    className="ann-item-close"
                    aria-label={t("announcements.dismissOne")}
                    disabled={submitting}
                    onClick={() => item.id && dismissOne(item.id)}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
              {item.createdAt ? (
                <div className="ann-item-date">{formatDate(item.createdAt)}</div>
              ) : null}
              <div className="ann-item-body">{item.body}</div>
            </article>
          ))}
        </div>

        {error ? <div className="ann-error">{error}</div> : null}

        <div
          className={`ann-actions${
            announcements.length === 1 ? " ann-actions--single" : ""
          }`}
        >
          {announcements.length > 1 ? (
            <button
              type="button"
              className="ann-btn ann-btn--primary ann-btn--full"
              disabled={submitting}
              onClick={dismissAll}
            >
              {submitting ? t("common.processing") : t("announcements.dismissAll")}
            </button>
          ) : announcements[0]?.id ? (
            <button
              type="button"
              className="ann-btn ann-btn--primary ann-btn--full"
              disabled={submitting}
              onClick={() => dismissOne(announcements[0].id!)}
            >
              {submitting ? t("common.processing") : t("announcements.gotIt")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
