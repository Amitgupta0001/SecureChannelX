// FILE: src/pages/Register.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [username, setUsername] = useState("");  
  const [email, setEmail] = useState("");        
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, user } = useAuth();
  const navigate = useNavigate();

  /* -----------------------------------------------------
      REDIRECT IF ALREADY LOGGED IN
  ----------------------------------------------------- */
  useEffect(() => {
    if (user) navigate("/chat");
  }, [user, navigate]);

  /* -----------------------------------------------------
      HANDLE REGISTRATION
  ----------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const res = await register(username, email, password);

    setLoading(false);

    if (res?.success) {
      navigate("/login");
    } else {
      setError(res?.error || "Registration failed.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-white px-4">
      <div className="bg-[#111827] p-8 rounded-2xl w-full max-w-md border border-[#1f2937] shadow-xl">
        
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-gray-400">Join SecureChannelX</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-red-600/20 text-red-400 border border-red-600/30">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Username */}
          <div>
            <label className="block text-sm mb-1" htmlFor="username">
              Username
            </label>
            <input
              type="text"
              id="username"
              placeholder="Choose a username"
              className="w-full px-4 py-2 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm mb-1" htmlFor="email">
              Email address
            </label>
            <input
              type="email"
              id="email"
              placeholder="your@email.com"
              className="w-full px-4 py-2 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm mb-1" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              placeholder="Enter a strong password"
              className="w-full px-4 py-2 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm mb-1" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              type="password"
              id="confirmPassword"
              placeholder="Re-enter your password"
              className="w-full px-4 py-2 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold active:scale-95 transition"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {/* Footer Links */}
        <div className="mt-6 flex justify-between text-sm text-gray-400">
          <span>Already have an account?</span>
          <Link to="/login" className="text-blue-400 hover:underline">
            Login
          </Link>
        </div>

        {/* Security Features */}
        <div className="mt-8 space-y-1 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            🔒 Secure password hashing
          </div>
          <div className="flex items-center gap-2">
            ⚙️ End-to-end encryption built-in
          </div>
          <div className="flex items-center gap-2">
            🛡️ Zero-knowledge user data design
          </div>
        </div>

      </div>
    </div>
  );
}
