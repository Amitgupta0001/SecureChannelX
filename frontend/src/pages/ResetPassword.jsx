import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import authApi from "../api/authApi";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState({
    password: { valid: false, message: "", strength: 0, checks: {} },
  });

  /**
   * ✅ Password validation - FIXED
   */
  useEffect(() => {
    const { password } = { password };

    if (!password) {
      setValidation((prev) => ({
        ...prev,
        password: { valid: false, message: "", strength: 0, checks: {} },
      }));
      return;
    }

    const { strength, checks } = calculatePasswordStrength(password);

    let message = "";
    let valid = false;

    if (strength < 40) {
      message = "Weak password";
      valid = false;
    } else if (strength < 60) {
      message = "Fair password";
      valid = false;
    } else if (strength < 80) {
      message = "Good password";
      valid = true;
    } else {
      message = "Strong password";
      valid = true;
    }

    setValidation((prev) => ({
      ...prev,
      password: {
        valid,
        message,
        strength,
        checks,
      },
    }));
  }, [password]);

  const validate = () => {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) return setError(msg);

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await authApi.resetPassword(token, password);
      if (res.success) {
        setMessage("Password reset successfully! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError(res.message || "Failed to reset password");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-white p-4">
      <div className="w-full max-w-md bg-[#111827] rounded-lg shadow-xl p-8 border border-[#1f2937]">
        <h2 className="text-3xl font-bold text-center mb-6">Reset Password</h2>

        {message && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500 text-green-200 rounded text-center">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-200 rounded text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition active:scale-95 disabled:opacity-60"
          >
            {loading ? "Resetting..." : "Reset Password"}
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

/**
 * Calculate password strength
 * @param {string} password
 * @returns {Object} strength, checks
 */
function calculatePasswordStrength(password) {
  let strength = 0;
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    symbols: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  strength += checks.length ? 20 : 0;
  strength += checks.uppercase ? 20 : 0;
  strength += checks.lowercase ? 20 : 0;
  strength += checks.numbers ? 20 : 0;
  strength += checks.symbols ? 20 : 0;

  return { strength, checks };
}
