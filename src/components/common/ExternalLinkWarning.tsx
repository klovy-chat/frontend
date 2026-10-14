import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, TriangleAlert, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import "../../styles/common/external-link-warning.css";

const TRUSTED_HOSTS_KEY = "klovy-trusted-external-hosts";

interface PendingExternalLink {
  url: string;
  hostname: string;
  openInNewTab: boolean;
}

function readTrustedHosts(): Set<string> {
  const stored = window.localStorage.getItem(TRUSTED_HOSTS_KEY);
  if (!stored) return new Set();

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || parsed.some((host) => typeof host !== "string")) {
    throw new Error("Invalid trusted external hosts");
  }
  return new Set(parsed.map((host: string) => host.toLowerCase()));
}

export function ExternalLinkWarning() {
  const { t } = useTranslation();
  const toast = useToast();
  const [pendingLink, setPendingLink] = useState<PendingExternalLink | null>(null);
  const [trustHost, setTrustHost] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const interceptExternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.type === "click" && event.button !== 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (
        (destination.protocol !== "http:" && destination.protocol !== "https:") ||
        destination.origin === window.location.origin
      ) {
        return;
      }

      let trustedHosts: Set<string>;
      try {
        trustedHosts = readTrustedHosts();
      } catch {
        toast.error(t("modals.externalLinkWarning.storageFailed"));
        trustedHosts = new Set();
      }
      const hostname = destination.hostname.toLowerCase();
      if (trustedHosts.has(hostname)) return;

      event.preventDefault();
      event.stopPropagation();
      triggerRef.current = anchor;
      setTrustHost(false);
      setPendingLink({
        url: destination.href,
        hostname,
        openInNewTab:
          event.type === "auxclick" ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          (anchor.target !== "" && anchor.target.toLowerCase() !== "_self"),
      });
    };

    document.addEventListener("click", interceptExternalLink, true);
    document.addEventListener("auxclick", interceptExternalLink, true);
    return () => {
      document.removeEventListener("click", interceptExternalLink, true);
      document.removeEventListener("auxclick", interceptExternalLink, true);
    };
  }, [t, toast]);

  useEffect(() => {
    if (!pendingLink) return;
    cancelButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWarning();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [pendingLink]);

  function closeWarning() {
    setPendingLink(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function continueToLink() {
    if (!pendingLink) return;

    if (trustHost) {
      try {
        const trustedHosts = readTrustedHosts();
        trustedHosts.add(pendingLink.hostname);
        window.localStorage.setItem(
          TRUSTED_HOSTS_KEY,
          JSON.stringify([...trustedHosts]),
        );
      } catch {
        toast.error(t("modals.externalLinkWarning.storageFailed"));
      }
    }

    if (pendingLink.openInNewTab) {
      window.open(pendingLink.url, "_blank", "noopener,noreferrer");
      closeWarning();
      return;
    }
    window.location.assign(pendingLink.url);
  }

  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!pendingLink) return null;

  return createPortal(
    <div
      className="klovy-backdrop klovy-backdrop--high external-link-warning-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeWarning();
      }}
    >
      <section
        ref={dialogRef}
        className="klovy-shell external-link-warning"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="external-link-warning-title"
        aria-describedby="external-link-warning-description"
        onKeyDown={trapFocus}
      >
        <header className="external-link-warning__header">
          <h2 id="external-link-warning-title">
            {t("modals.externalLinkWarning.title")}
          </h2>
          <button
            type="button"
            className="external-link-warning__close"
            aria-label={t("common.close")}
            onClick={closeWarning}
          >
            <X size={24} />
          </button>
        </header>

        <div className="external-link-warning__intro">
          <span className="external-link-warning__icon" aria-hidden="true">
            <TriangleAlert size={21} />
          </span>
          <div>
            <h3>{t("modals.externalLinkWarning.leavingTitle")}</h3>
            <p id="external-link-warning-description">
              {t("modals.externalLinkWarning.message")}
            </p>
          </div>
        </div>

        <div className="external-link-warning__destination">
          <strong>{t("modals.externalLinkWarning.destination")}</strong>
          <code>{pendingLink.url}</code>
        </div>

        <label className="external-link-warning__trust">
          <input
            type="checkbox"
            checked={trustHost}
            onChange={(event) => setTrustHost(event.target.checked)}
          />
          <span>
            {t("modals.externalLinkWarning.trustDomain", {
              domain: pendingLink.hostname,
            })}
          </span>
        </label>

        <footer className="external-link-warning__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="external-link-warning__button external-link-warning__button--secondary"
            onClick={closeWarning}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="external-link-warning__button external-link-warning__button--primary"
            onClick={continueToLink}
          >
            {t("modals.externalLinkWarning.visit")}
            <ArrowUpRight size={19} />
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
