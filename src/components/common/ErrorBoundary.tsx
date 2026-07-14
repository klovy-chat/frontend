import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../../i18n/config";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Przechwytuje nieobsłużone błędy renderowania i wyświetla ekran awaryjny
 * zamiast białego ekranu, dając użytkownikowi możliwość odświeżenia aplikacji.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <h1 className="error-boundary-title">{i18n.t("errors.boundary.title")}</h1>
          <p className="error-boundary-message">{i18n.t("errors.boundary.message")}</p>
          <button
            type="button"
            className="error-boundary-reload"
            onClick={this.handleReload}
          >
            {i18n.t("errors.boundary.reload")}
          </button>
        </div>
      </div>
    );
  }
}
