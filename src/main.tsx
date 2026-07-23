import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { DesktopOnlyGate } from "./components/common/DesktopOnlyGate";
import { AuthProvider } from "./context/AuthContext";
import { LocaleProvider } from "./context/LocaleContext";
import i18n from "./i18n/config";
import "./styles/base/global.css";
import "./styles/base/layout.css";
import "./styles/common/toast.css";
import { preloadClientEnvironment } from "./utils/device/clientEnvironment";

void preloadClientEnvironment();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <LocaleProvider>
            <DesktopOnlyGate>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </DesktopOnlyGate>
          </LocaleProvider>
        </AuthProvider>
      </I18nextProvider>
    </ErrorBoundary>
  </StrictMode>,
);
