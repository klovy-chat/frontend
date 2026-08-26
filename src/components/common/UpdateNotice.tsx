// UpdateNotice.tsx
// Baner starego desktopu bez IPC badge.
// Zakres:
//  - snooze w oldDesktop.ts
//  - baner starego Tauri; snooze w oldDesktop.ts
// Nowa fala update: zmień warunek isLegacy, nie tylko CSS.
// Przy zmianach: oldDesktop.ts, isDesktop.ts.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, X } from "lucide-react";
import {
  desktopDownloadUrl,
  isLegacyDesktopNoticeSnoozed,
  needsLegacyDesktopDownload,
  snoozeLegacyDesktopNotice,
} from "../../utils/device/oldDesktop";
import "../../styles/common/update-notice.css";

export function UpdateNotice() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void needsLegacyDesktopDownload().then((needs) => {
      if (cancelled || !needs || isLegacyDesktopNoticeSnoozed()) return;
      setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const close = () => {
    snoozeLegacyDesktopNotice();
    setOpen(false);
  };

  return (
    <aside
      className="desk-upd"
      role="dialog"
      aria-labelledby="desk-upd-title"
      aria-describedby="desk-upd-body"
    >
      <button
        type="button"
        className="desk-upd__x"
        aria-label={t("desktopUpdate.later")}
        onClick={close}
      >
        <X size={16} />
      </button>
      <div className="desk-upd__icon">
        <Download size={20} strokeWidth={2.2} />
      </div>
      <h2 id="desk-upd-title" className="desk-upd__title">
        {t("desktopUpdate.title")}
      </h2>
      <p id="desk-upd-body" className="desk-upd__body">
        {t("desktopUpdate.body")}
      </p>
      <div className="desk-upd__actions">
        <a
          className="desk-upd__btn desk-upd__btn--primary"
          href={desktopDownloadUrl()}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("desktopUpdate.download")}
        </a>
        <button type="button" className="desk-upd__btn desk-upd__btn--ghost" onClick={close}>
          {t("desktopUpdate.later")}
        </button>
      </div>
    </aside>
  );
}
