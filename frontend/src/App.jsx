// FILE: src/App.jsx

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { EncryptionProvider } from "./context/EncryptionContext";
import { ChatProvider } from "./context/ChatContext";
import { GroupProvider } from "./context/GroupContext";
import { CallProvider } from "./context/CallContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import TwoFactorAuth from "./pages/TwoFactorAuth";

import ChatRoom from "./pages/ChatRoom";
import DirectMessagePage from "./pages/DirectMessagePage";
import GroupPage from "./pages/GroupPage";
import CallsPage from "./pages/CallsPage";

import Profile from "./pages/Profile";
// import SecurityDashboard from "./pages/SecurityDashboard";
import Devices from "./pages/Devices";

// import AdminDashboard from "./pages/AdminDashboard";

import LoadingSpinner from "./components/LoadingSpinner";

import "./styles/App.css";

/* -----------------------------------------------------
   ROUTE GUARDS
----------------------------------------------------- */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;

  // In production → check user.role === "admin"
  if (user && user.is_admin) return children;

  return <Navigate to="/" replace />;
};

/* -----------------------------------------------------
   APP ROOT
----------------------------------------------------- */
export default function App() {
  return (
    <AuthProvider>
      <EncryptionProvider>
        <SocketProvider>
          <ChatProvider>
            <GroupProvider>
              <CallProvider>
                <Router>
                  <Routes>

                    {/* PUBLIC AUTH ROUTES */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/2fa" element={<TwoFactorAuth />} />

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

                    {/* SECURITY CENTER */}
                    <Route
                      path="/security"
                      element={
                        <ProtectedRoute>
                          <SecurityDashboard />
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

                    {/* ADMIN */}
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <AdminDashboard />
                        </AdminRoute>
                      }
                    />

                    {/* FALLBACK */}
                    <Route path="*" element={<Navigate to="/" replace />} />

                  </Routes>
                </Router>
              </CallProvider>
            </GroupProvider>
          </ChatProvider>
        </SocketProvider>
      </EncryptionProvider>
    </AuthProvider>
  );
}
