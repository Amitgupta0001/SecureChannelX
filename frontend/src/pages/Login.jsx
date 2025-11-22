// FILE: src/pages/Login.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");      // FIXED: using email
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { login, requires2FA, user } = useAuth();
  const navigate = useNavigate();

  /* -------------------------------------------------------
      REDIRECT IF USER ALREADY LOGGED IN
  -------------------------------------------------------- */
  useEffect(() => {
    if (user) navigate("/chat");
  }, [user, navigate]);

  /* -------------------------------------------------------
      FORM SUBMIT
  -------------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const res = await login(email, password);

    // 2FA REQUIRED
    if (res?.requires2FA) {
      return navigate("/2fa-verify");
    }

    // LOGIN SUCCESS
    if (res?.success) {
      return navigate("/chat");
    }

    // OTHERWISE → ERROR MESSAGE
    setError(res.error || "Invalid email or password.");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0D1117] text-white px-4">

      <div className="bg-[#111827] border border-[#1f2937] p-8 rounded-2xl w-full max-w-md shadow-xl">

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">SecureChannelX</h1>
          <p className="text-gray-400 text-sm">Secure Encrypted Messaging</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-red-600/20 text-red-400 border border-red-600/30">
            {error}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition active:scale-95"
          >
            Log In
          </button>

        </form>

        {/* Links */}
        <div className="mt-6 flex justify-between text-sm">
          <Link to="/forgot-password" className="text-blue-400 hover:underline">
            Forgot Password?
          </Link>

          <Link to="/register" className="text-blue-400 hover:underline">
            Create Account
          </Link>
        </div>

        {/* Features */}
        <div className="mt-8 space-y-1 text-sm text-gray-400">
          <div className="flex items-center gap-2"><span>🔒</span> End-to-End Encryption</div>
          <div className="flex items-center gap-2"><span>⚡</span> Real-time Messaging</div>
          <div className="flex items-center gap-2"><span>🛡️</span> Military-grade Security</div>
        </div>

      </div>
    </div>
  );
}
