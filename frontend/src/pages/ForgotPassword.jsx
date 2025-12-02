import React, { useState } from "react";
import { Link } from "react-router-dom";
import authApi from "../api/authApi";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await authApi.forgotPassword(email.trim());
      if (res?.success) {
        setMessage(res.message || "Reset link sent.");
      } else {
        setError(res?.message || "Failed to send reset link.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-white p-4">
      <div className="w-full max-w-md bg-[#111827] rounded-lg shadow-xl p-8 border border-[#1f2937]">
        <h2 className="text-3xl font-bold text-center mb-6">Forgot Password</h2>

        {message && (
          <div
            className="mb-4 p-3 bg-green-500/20 border border-green-500 text-green-200 rounded text-center"
            role="status"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-200 rounded text-center"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition active:scale-95 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-blue-400 hover:text-white transition-colors text-sm"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
