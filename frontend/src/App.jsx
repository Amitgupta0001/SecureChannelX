import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { EncryptionProvider } from "./context/EncryptionContext";
import { ChatProvider } from "./context/ChatContext";
import { GroupProvider } from "./context/GroupContext";
import { CallProvider } from "./context/CallContext";
import { NotificationProvider } from "./context/NotificationContext";
import { WebRTCProvider } from "./context/WebRTCContext"; // Newly Added

// Eager-loaded components (authentication)
import Login from "./pages/Login";
import Register from "./pages/Register";
import TwoFactorAuth from "./pages/TwoFactorAuth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// Lazy-loaded components (main app)
const ChatRoom = lazy(() => import("./pages/ChatRoom"));
const DirectMessagePage = lazy(() => import("./pages/DirectMessagePage"));
const GroupPage = lazy(() => import("./pages/GroupPage"));
const CallsPage = lazy(() => import("./pages/CallsPage"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Devices = lazy(() => import("./pages/Devices"));

import LoadingSpinner from "./components/LoadingSpinner";
import NotFound from "./pages/NotFound";
import CallModal from "./components/CallModal"; // Newly Added

import "./styles/App.css";

/* ========================================
   ROUTE GUARDS
======================================== */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", height: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}>
        <LoadingSpinner message="Authenticating..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ height: "100vh" }}><LoadingSpinner /></div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/* ========================================
   LOADING FALLBACK
======================================== */
const SuspenseFallback = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#111b21" }}>
    <LoadingSpinner message="Loading..." />
  </div>
);

/* ========================================
   CONTEXT WRAPPER
======================================== */
const AppProviders = ({ children }) => (
  <AuthProvider>
    <EncryptionProvider>
      <SocketProvider>
        <NotificationProvider>
          <ChatProvider>
            <GroupProvider>
              <CallProvider>
                <WebRTCProvider> {/* Integrated WebRTC */}
                  {children}
                </WebRTCProvider>
              </CallProvider>
            </GroupProvider>
          </ChatProvider>
        </NotificationProvider>
      </SocketProvider>
    </EncryptionProvider>
  </AuthProvider>
);

/* ========================================
   APP ROUTES
======================================== */
const AppRoutes = () => (
  <Routes>
    {/* ==================== PUBLIC ROUTES ==================== */}
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
    <Route path="/2fa" element={<TwoFactorAuth />} />
    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
    <Route path="/reset-password" element={<ResetPassword />} />

    {/* ==================== PROTECTED ROUTES ==================== */}
    <Route path="/" element={
      <ProtectedRoute>
        <Suspense fallback={<SuspenseFallback />}>
          <ChatRoom />
        </Suspense>
      </ProtectedRoute>
    } />

    {/* DIRECT MESSAGE */}
    <Route path="/dm/:userId" element={
      <ProtectedRoute>
        <Suspense fallback={<SuspenseFallback />}>
          <DirectMessagePage />
        </Suspense>
      </ProtectedRoute>
    } />

    {/* GROUP CHAT */}
    <Route path="/group/:groupId" element={
      <ProtectedRoute>
        <Suspense fallback={<SuspenseFallback />}>
          <GroupPage />
        </Suspense>
      </ProtectedRoute>
    } />

    {/* CALLS */}
    <Route path="/calls/:chatId?" element={
      <ProtectedRoute>
        <Suspense fallback={<SuspenseFallback />}>
          <CallsPage />
        </Suspense>
      </ProtectedRoute>
    } />

    {/* USER PROFILE */}
    <Route path="/profile/:userId?" element={
      <ProtectedRoute>
        <Suspense fallback={<SuspenseFallback />}>
          <Profile />
        </Suspense>
      </ProtectedRoute>
    } />

    {/* SETTINGS */}
    <Route path="/settings" element={
      <ProtectedRoute>
        <Suspense fallback={<SuspenseFallback />}>
          <Settings />
        </Suspense>
      </ProtectedRoute>
    } />

    {/* DEVICES */}
    <Route path="/devices" element={
      <ProtectedRoute>
        <Suspense fallback={<SuspenseFallback />}>
          <Devices />
        </Suspense>
      </ProtectedRoute>
    } />

    {/* ==================== ERROR ROUTES ==================== */}
    <Route path="/404" element={<NotFound />} />
    <Route path="*" element={<Navigate to="/404" replace />} />
  </Routes>
);

/* ========================================
   APP ROOT
======================================== */
export default function App() {
  return (
    <AppProviders>
      <Router>
        <CallModal /> {/* Calls Overlay */}
        <AppRoutes />
      </Router>
    </AppProviders>
  );
}
