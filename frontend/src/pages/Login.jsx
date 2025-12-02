// FILE: src/pages/Login.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, User, Lock, Loader2, AlertCircle } from "lucide-react";
import EncryptedDB from "../lib/encryptedDB";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await login(username.trim(), password);
      
      // Initialize encrypted IndexedDB after successful login
      if (res?.success) {
        try {
          await EncryptedDB.initializeMasterKey(password);
          console.log('[SECURITY] Encrypted IndexedDB initialized');
        } catch (dbError) {
          console.warn('[SECURITY] Failed to initialize encrypted DB:', dbError);
          // Don't block login if DB initialization fails
        }
        return navigate("/");
      }
      
      if (res?.requires2FA) return navigate("/2fa");
      setError(res?.error || "Invalid username or password.");
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#1f2937] to-[#0f172a] p-4">

      <div className="w-full max-w-md bg-white/15 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-3xl p-8">

        {/* App Icon / Title */}
        <div className="text-center mb-6">
          <ShieldCheck className="h-14 w-14 text-indigo-400 drop-shadow-lg mx-auto" />
          <h1 className="text-3xl font-bold text-gray-100 mt-2">SecureChannelX</h1>
          <p className="text-sm text-gray-300">Encrypted Messaging</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30">
            <AlertCircle className="h-5 w-5 text-red-300" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Username */}
          <div className="space-y-1">
            <label className="text-sm text-gray-200">Username</label>
            <div className="relative">
              <User className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                className="w-full pl-12 pr-3 py-2.5 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl outline-none text-sm text-white placeholder-gray-300 focus:ring-2 focus:ring-indigo-400/60"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-sm text-gray-200">Password</label>
            <div className="relative">
              <Lock className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="password"
                className="w-full pl-12 pr-3 py-2.5 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl outline-none text-sm text-white placeholder-gray-300 focus:ring-2 focus:ring-indigo-400/60"
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
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl text-white font-semibold text-sm shadow-xl hover:shadow-2xl hover:scale-[1.01] transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Logging in...
              </span>
            ) : (
              "Log In"
            )}
          </button>
        </form>

        {/* Links */}
        <div className="mt-5 flex justify-between items-center text-xs text-gray-300">
          <Link to="/forgot-password" className="hover:text-indigo-300">
            Forgot Password?
          </Link>
          <Link to="/register" className="font-medium text-indigo-300 hover:underline">
            Create Account →
          </Link>
        </div>

      </div>
    </div>
  );
}
