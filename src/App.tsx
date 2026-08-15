import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { PresenceProvider } from "./context/PresenceContext";
import { CallProvider } from "./context/CallContext";
import { CallOverlay } from "./components/call/CallOverlay";
import { MessageCacheBridge } from "./components/chat/MessageCacheBridge";
import { FriendshipCacheBridge } from "./components/chat/FriendshipCacheBridge";
import { UnreadBadgeBridge } from "./components/chat/UnreadBadgeBridge";
import { MentionSourcesBridge } from "./components/chat/MentionSourcesBridge";
import { WarningModal } from "./components/common/WarningModal";
import { AnnouncementModal } from "./components/common/AnnouncementModal";
import { useIdleAvailability } from "./hooks/useIdleAvailability";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { ProfileSetupPage } from "./pages/ProfileSetupPage";
import { PendingApprovalPage } from "./pages/PendingApprovalPage";
import { ChatPage } from "./pages/ChatPage";
import { InvitePage } from "./pages/InvitePage";
import { SettingsPage } from "./settings/SettingsPage";
import { isPendingWhitelist } from "./utils/auth/whitelist";
import { setNativeUnreadBadge } from "./utils/device/nativeUnreadBadge";
import { DesktopUpdateNotice } from "./components/common/DesktopUpdateNotice";
import { ToastProvider } from "./context/ToastContext";
import type { User } from "./types";

function postSetupPath(user: User): string {
  if (isPendingWhitelist(user)) return "/pending";
  return "/";
}

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
  if (user.profileSetup) return <Navigate to={postSetupPath(user)} replace />;
  return <>{children}</>;
}

function WhitelistRoute({ children }: { children: React.ReactNode }) {
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
  if (!isPendingWhitelist(user)) return <Navigate to="/" replace />;
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
  if (isPendingWhitelist(user)) return <Navigate to="/pending" replace />;
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
  if (user?.profileSetup) return <Navigate to={postSetupPath(user)} replace />;
  if (user && !user.profileSetup) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

/** Layout route: CallProvider survives Chat ↔ Settings ↔ Invite navigation. */
function AuthenticatedShell() {
  useIdleAvailability();
  return (
    <ProtectedRoute>
      <WebSocketProvider>
        <PresenceProvider>
          <CallProvider>
            <MessageCacheBridge />
            <FriendshipCacheBridge />
            <UnreadBadgeBridge />
            <MentionSourcesBridge />
            <Outlet />
            <CallOverlay />
            <WarningModal />
            <AnnouncementModal />
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
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route
        path="/setup"
        element={
          <AuthOnlyRoute>
            <ProfileSetupPage />
          </AuthOnlyRoute>
        }
      />
      <Route
        path="/pending"
        element={
          <WhitelistRoute>
            {/* No WebSocket — pending users are blocked from /ws; approval is polled. */}
            <PendingApprovalPage />
          </WhitelistRoute>
        }
      />
      <Route element={<AuthenticatedShell />}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/settings/:section?" element={<SettingsPage />} />
        <Route path="/invite/:inviteId" element={<InvitePage />} />
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
      const mod = await import("./utils/sync/unreadSync");
      unsub = mod.default.onChange((n: number) => {
        document.title = n > 0 ? `(${n}) ${baseTitle}` : baseTitle;
        setNativeUnreadBadge(n);
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);
  return (
    <ToastProvider>
      <AppRoutes />
      <DesktopUpdateNotice />
    </ToastProvider>
  );
}
