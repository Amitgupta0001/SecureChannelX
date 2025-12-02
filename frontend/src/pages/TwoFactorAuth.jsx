// FILE: src/pages/TwoFactorAuth.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TwoFactorAuth() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { verify2FA, requires2FA, tempToken, user, resend2FA } = useAuth();
  const navigate = useNavigate();

  /* -------------------------------------------------------
      If user is already logged in → redirect
  -------------------------------------------------------- */
  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  /* -------------------------------------------------------
      If no 2FA required → kick back to login
  -------------------------------------------------------- */
  useEffect(() => {
    if (!requires2FA || !tempToken) {
      navigate("/login");
    }
  }, [requires2FA, tempToken, navigate]);

  /* -------------------------------------------------------
      SUBMIT CODE
  -------------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (code.length !== 6) {
      setError("Enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const res = await verify2FA(code);
      if (res?.success) navigate("/");
      else setError(res?.error || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await resend2FA?.();
    } catch {
      setError("Failed to resend code.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-white px-4">
      <div className="bg-[#111827] p-8 rounded-2xl w-full max-w-md border border-[#1f2937] shadow-xl">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
          <p className="text-gray-400 text-sm">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-red-600/20 text-red-400 border border-red-600/30">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm mb-1" htmlFor="code">
              Verification Code
            </label>
            <input
              type="text"
              id="code"
              inputMode="numeric"
              maxLength={6}
              className="w-full px-4 py-2 bg-[#0D1117] border border-[#1f2937] rounded-lg text-center text-xl tracking-widest focus:ring-1 focus:ring-blue-500 outline-none"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              required
              autoComplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition active:scale-95 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        {/* Resend Code */}
        <div className="mt-4 text-xs text-gray-400 flex justify-between">
          <button className="text-blue-400 hover:underline" onClick={handleResend}>
            Resend code
          </button>
          <span>Time-based OTP (TOTP)</span>
        </div>

      </div>
    </div>
  );
}
