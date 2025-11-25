import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { EncryptionProvider } from "./context/EncryptionContext";
import { ChatProvider } from "./context/ChatContext";
import { GroupProvider } from "./context/GroupContext";
import { CallProvider } from "./context/CallContext";
import { NotificationProvider } from "./context/NotificationContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import TwoFactorAuth from "./pages/TwoFactorAuth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import ChatRoom from "./pages/ChatRoom";
import DirectMessagePage from "./pages/DirectMessagePage";
import GroupPage from "./pages/GroupPage";
import CallsPage from "./pages/CallsPage";

import Profile from "./pages/Profile";
import Devices from "./pages/Devices";

import LoadingSpinner from "./components/LoadingSpinner";

import "./styles/App.css";

/* -----------------------------------------------------
   ROUTE GUARDS
----------------------------------------------------- */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  console.log("🟣 ProtectedRoute check - loading:", loading, "user:", user);
  if (loading) return <LoadingSpinner />;
  if (!user) {
    console.log("🔴 No user, redirecting to /login");
    return <Navigate to="/login" replace />;
  }
  console.log("✅ User authenticated, rendering protected content");
  return children;
};

/* -----------------------------------------------------
   APP ROOT
----------------------------------------------------- */
export default function App() {
  return (
    <AuthProvider>
      <EncryptionProvider>
        <SocketProvider>
          <NotificationProvider>
            <ChatProvider>
              <GroupProvider>
                <CallProvider>
                  <Router>
                    <Routes>

                      {/* PUBLIC AUTH ROUTES */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/2fa" element={<TwoFactorAuth />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password/:token" element={<ResetPassword />} />

                      {/* MAIN APP ROUTES */}
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <ChatRoom />
                          </ProtectedRoute>
                        }
                      />

                      {/* DIRECT MESSAGE */}
                      <Route
                        path="/dm/:userId"
                        element={
                          <ProtectedRoute>
                            <DirectMessagePage />
                          </ProtectedRoute>
                        }
                      />

                      {/* GROUP CHAT */}
                      <Route
                        path="/group/:groupId"
                        element={
                          <ProtectedRoute>
                            <GroupPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* CALLS */}
                      <Route
                        path="/calls/:chatId"
                        element={
                          <ProtectedRoute>
                            <CallsPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* USER PROFILE */}
                      <Route
                        path="/profile"
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />

                      {/* ACTIVE DEVICES */}
                      <Route
                        path="/devices"
                        element={
                          <ProtectedRoute>
                            <Devices />
                          </ProtectedRoute>
                        }
                      />

                      {/* FALLBACK */}
                      <Route path="*" element={<Navigate to="/" replace />} />

                    </Routes>
                  </Router>
                </CallProvider>
              </GroupProvider>
            </ChatProvider>
          </NotificationProvider>
        </SocketProvider>
      </EncryptionProvider>
    </AuthProvider>
  );
}
