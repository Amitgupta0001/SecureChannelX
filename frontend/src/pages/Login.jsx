// FILE: src/pages/Login.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, requires2FA, user } = useAuth();
  const navigate = useNavigate();

  /* -------------------------------------------------------
      REDIRECT IF USER ALREADY LOGGED IN
  -------------------------------------------------------- */
  useEffect(() => {
    console.log("🔵 Login.jsx useEffect - user:", user);
    if (user) {
      console.log("🔵 User is logged in, navigating to /");
      navigate("/");
    }
  }, [user, navigate]);

  /* -------------------------------------------------------
      FORM SUBMIT
  -------------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🔵 Login form submitted", { username, password: "***" });
    setError("");
    setLoading(true);

    try {
      console.log("🔵 Calling login function...");
      const res = await login(username, password);
      console.log("🔵 Login response:", res);

      if (res?.requires2FA) {
        console.log("🔵 2FA required, redirecting to /2fa");
        return navigate("/2fa");
      }
      if (res?.success) {
        console.log("🔵 Login successful, redirecting to /");
        return navigate("/");
      }

      console.log("🔴 Login failed:", res.error);
      setError(res.error || "Invalid username or password.");
    } catch (err) {
      console.error("🔴 Login error:", err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center gradient-bg px-4 relative overflow-hidden">

      {/* Animated Background Orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>

      {/* Login Card */}
      <div className="glass-strong p-6 rounded-2xl w-full max-w-md shadow-2xl shadow-blue-500/10 animate-slide-up relative z-10">

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-block mb-3">
            <div className="w-12 h-12 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-glow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-1">
            SecureChannelX
          </h1>
          <p className="text-gray-400 text-xs">Military-Grade Encrypted Messaging</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 backdrop-blur-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Username Input */}
          <div className="group">
            <label className="block text-xs font-medium mb-1.5 text-gray-300">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg 
                         focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 
                         outline-none transition-all duration-300 text-sm text-white placeholder-gray-500"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="group">
            <label className="block text-xs font-medium mb-1.5 text-gray-300">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type="password"
                className="w-full pl-9 pr-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg 
                         focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 
                         outline-none transition-all duration-300 text-sm text-white placeholder-gray-500"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                     rounded-lg font-semibold text-sm text-white shadow-lg shadow-blue-500/30
                     transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]
                     btn-ripple relative overflow-hidden"
          >
            <span className="relative z-10">{loading ? "Logging in..." : "Log In"}</span>
          </button>

        </form>

        {/* Links */}
        <div className="mt-5 flex justify-between items-center text-xs">
          <Link
            to="/forgot-password"
            className="text-blue-400 hover:text-blue-300 transition-colors hover-lift"
          >
            Forgot Password?
          </Link>

          <Link
            to="/register"
            className="text-blue-400 hover:text-blue-300 transition-colors hover-lift font-medium"
          >
            Create Account →
          </Link>
        </div>

        {/* Security Features */}
        <div className="mt-6 pt-5 border-t border-gray-700/50">
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2.5 text-xs text-gray-400 hover:text-gray-300 transition-colors group">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <span className="text-base">🔒</span>
              </div>
              <span>End-to-End Encryption</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-gray-400 hover:text-gray-300 transition-colors group">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <span className="text-base">⚡</span>
              </div>
              <span>Real-time Messaging</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-gray-400 hover:text-gray-300 transition-colors group">
              <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <span className="text-base">🛡️</span>
              </div>
              <span>Military-Grade Security</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
