// main.tsx
// Bootstrap SPA: React root, router, i18n, ErrorBoundary, DesktopOnly.
// Zakres:
//  - AuthProvider i LocaleProvider
//  - global CSS
//  - preload clientInfo przed requestami
// Globalne rzeczy „zawsze włączone” montuj tu; realtime — w App AuthenticatedShell.
// Przy zmianach: App.tsx, context/AuthContext.tsx.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { DesktopOnly } from "./components/common/DesktopOnly";
import { AuthProvider } from "./context/AuthContext";
import { LocaleProvider } from "./context/LocaleContext";
import i18n from "./i18n/config";
import "./styles/base/global.css";
import "./styles/base/layout.css";
import "./styles/common/toast.css";
import { preloadClientInfo } from "./utils/device/clientInfo";

void preloadClientInfo();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <LocaleProvider>
            <DesktopOnly>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </DesktopOnly>
          </LocaleProvider>
        </AuthProvider>
      </I18nextProvider>
    </ErrorBoundary>
  </StrictMode>,
);
