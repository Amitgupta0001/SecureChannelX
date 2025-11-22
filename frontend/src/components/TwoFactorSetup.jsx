// FILE: src/components/TwoFactorSetup.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import securityApi from "../api/securityApi";   // <— NEW API FILE (we generate below)

export default function TwoFactorSetup() {
  const [step, setStep] = useState(1);
  const [secret, setSecret] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [provisioningUrl, setProvisioningUrl] = useState("");
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /** STEP 1 → Generate secret + QR */
  const setup2FA = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await securityApi.setup2FA();
      setSecret(res.secret);
      setProvisioningUrl(res.provisioning_url);
      setQrCode(res.qr_code);
      setStep(2);
    } catch (err) {
      setError(
        err?.response?.data?.error || "Failed to generate 2FA secret."
      );
    }

    setLoading(false);
  };

  /** STEP 2 → Verify OTP */
  const verify2FA = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await securityApi.verify2FA(token);
      if (res.success) {
        setStep(3);
      } else {
        setError(res.error || "Invalid verification code.");
      }
    } catch (err) {
      setError("Verification failed.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-[#111827] p-8 rounded-2xl border border-[#1f2937] shadow-xl text-gray-200"
      >
        <h2 className="text-2xl font-semibold mb-2">Two-Factor Authentication</h2>
        <p className="text-gray-400 mb-6">
          Add an extra layer of security to your account.
        </p>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Enable 2FA</h3>
            <p className="text-gray-400 text-sm mb-4">
              Use Google Authenticator, Authy, Microsoft Authenticator or any TOTP app.
            </p>

            <ul className="space-y-2 mb-6 text-sm">
              <li>🔒 Protect your account from unauthorized logins</li>
              <li>🛡 Adds a second verification layer</li>
              <li>📱 Works with all authenticator apps</li>
            </ul>

            <button
              onClick={setup2FA}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-xl text-white"
            >
              {loading ? "Generating QR…" : "Enable Two-Factor Authentication"}
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Scan QR Code</h3>

            {error && (
              <div className="text-red-400 bg-red-500/10 p-2 rounded-lg mb-3">
                {error}
              </div>
            )}

            <div className="flex justify-center mb-4">
              {qrCode ? (
                <img
                  src={qrCode}
                  alt="2FA QR Code"
                  className="w-48 h-48 shadow-lg rounded-xl"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-[#1f2937] rounded-xl">
                  Loading…
                </div>
              )}
            </div>

            <p className="text-sm text-gray-400 mb-2">
              Can't scan the QR? Use this code:
            </p>
            <code className="block bg-[#1f2937] p-3 rounded-lg mb-4 text-center text-blue-400">
              {secret}
            </code>

            <label className="text-sm text-gray-300">Enter 6-digit code:</label>
            <input
              value={token}
              type="text"
              maxLength={6}
              onChange={(e) =>
                setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="w-full mt-1 px-3 py-2 bg-[#0D1117] border border-[#1f2937] rounded-lg focus:border-blue-500 outline-none mb-4"
              placeholder="123456"
            />

            <button
              onClick={verify2FA}
              disabled={loading || token.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 py-2 rounded-xl"
            >
              {loading ? "Verifying…" : "Verify & Enable"}
            </button>
          </div>
        )}

        {/* STEP 3 → Success */}
        {step === 3 && (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-semibold mb-3">
              Two-Factor Authentication Enabled!
            </h3>

            <p className="text-gray-400 mb-4 text-sm">
              Your account is now protected with secure 2FA.
            </p>

            <ul className="text-left text-gray-400 text-sm mb-6 space-y-2">
              <li>• You’ll need a code on every login</li>
              <li>• Save your backup codes somewhere safe</li>
              <li>• Make sure your authenticator app is backed up</li>
            </ul>

            <button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-xl"
            >
              Continue
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
