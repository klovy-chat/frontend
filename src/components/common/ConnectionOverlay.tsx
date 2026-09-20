import { useTranslation } from "react-i18next";
import { useWebSocketConnected } from "../../context/WebSocketContext";
import "../../styles/common/connection-overlay.css";

export function ConnectionOverlay() {
  const { t } = useTranslation();
  const connected = useWebSocketConnected();

  if (connected) return null;

  return (
    <div className="connection-overlay" role="status" aria-live="polite">
      <div className="connection-overlay__card">
        <span className="connection-overlay__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 16.5a5 5 0 0 1 0-9" />
            <path d="M15.5 7.5a5 5 0 0 1 0 9" />
            <path d="m8.5 4.5 0 3-3-1.5" />
            <path d="m15.5 19.5 0-3 3 1.5" />
          </svg>
          <span className="connection-overlay__dot" />
        </span>
        <strong>{t("errors.ws.connectionLost")}</strong>
        <span>{t("errors.ws.reconnecting")}</span>
        <span className="connection-overlay__loader" aria-hidden="true" />
      </div>
    </div>
  );
}