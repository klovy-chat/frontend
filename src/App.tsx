// App.tsx
// Trasy publiczne i chronione + powłoka zalogowanego użytkownika.
// Zakres:
//  - login/signup/setup/chat/invite/settings
//  - WS, presence, call, cache wiadomości przeżywają Chat↔Settings
// Przy zmianach: pages/*, context/*, settings/Settings.tsx.

import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { PresenceProvider } from "./context/PresenceContext";
import { CallProvider } from "./context/CallContext";
import { CallOverlay } from "./components/call/CallOverlay";
import { MessageCache } from "./components/chat/MessageCache";
import { FriendsCache } from "./components/chat/FriendsCache";
import { UnreadSync } from "./components/chat/UnreadSync";
import { Mentions } from "./components/chat/Mentions";
import { Warning } from "./components/common/Warning";
import { Announcements } from "./components/common/Announcements";
import { useIdle } from "./hooks/useIdle";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ProfileSetup } from "./pages/ProfileSetup";
import { Chat } from "./pages/Chat";
import { Invite } from "./pages/Invite";
import { Settings } from "./settings/Settings";
import { setAppBadge } from "./utils/device/appBadge";
import { UpdateNotice } from "./components/common/UpdateNotice";
import { ToastProvider } from "./context/ToastContext";

function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.profileSetup) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.profileSetup) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    );
  }
  if (user?.profileSetup) return <Navigate to="/" replace />;
  if (user && !user.profileSetup) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

function AuthenticatedShell() {
  useIdle();
  return (
    <ProtectedRoute>
      <WebSocketProvider>
        <PresenceProvider>
          <CallProvider>
            <MessageCache />
            <FriendsCache />
            <UnreadSync />
            <Mentions />
            <Outlet />
            <CallOverlay />
            <Warning />
            <Announcements />
          </CallProvider>
        </PresenceProvider>
      </WebSocketProvider>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/setup"
        element={
          <AuthOnlyRoute>
            <ProfileSetup />
          </AuthOnlyRoute>
        }
      />
      <Route element={<AuthenticatedShell />}>
        <Route path="/" element={<Chat />} />
        <Route path="/settings/:section?" element={<Settings />} />
        <Route path="/invite/:inviteId" element={<Invite />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    let baseTitle = document.title || "Klovy Chat";
    try { baseTitle = baseTitle.replace(/^[()0-9]+\s*/, "").trim() || "Klovy Chat"; } catch { baseTitle = "Klovy Chat"; }
    let unsub: (() => void) | null = null;
    (async () => {
      const mod = await import("./utils/sync/unread");
      unsub = mod.default.onChange((n: number) => {
        document.title = n > 0 ? `(${n}) ${baseTitle}` : baseTitle;
        setAppBadge(n);
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);
  return (
    <ToastProvider>
      <AppRoutes />
      <UpdateNotice />
    </ToastProvider>
  );
}
