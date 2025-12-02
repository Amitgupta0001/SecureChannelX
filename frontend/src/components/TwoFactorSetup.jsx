/**
 * ✅ ENHANCED: SecureChannelX - Two-Factor Authentication Setup
 * ------------------------------------------------------------
 * Guide users through 2FA enrollment with QR code
 * 
 * Changes:
 *   - Fixed: Token validation (6 digits only)
 *   - Fixed: Error handling with user-friendly messages
 *   - Added: Auto-focus on token input
 *   - Added: Backup codes generation after setup
 *   - Added: Copy secret key to clipboard
 *   - Added: Keyboard shortcuts (Enter to submit)
 *   - Enhanced: Visual design with better spacing
 *   - Enhanced: Loading states
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import securityApi from "../api/securityApi";
import { 
  Shield, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Download,
  Eye,
  EyeOff
} from "lucide-react";

export default function TwoFactorSetup({ onComplete, standalone = true }) {
  const [step, setStep] = useState(1);
  const [secret, setSecret] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [provisioningUrl, setProvisioningUrl] = useState("");
  const [token, setToken] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const tokenInputRef = useRef(null);

  /**
   * ✅ STEP 1: Generate 2FA secret and QR code
   */
  const setup2FA = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await securityApi.setup2FA();
      
      if (!res.secret || !res.qr_code) {
        throw new Error("Invalid response from server");
      }

      setSecret(res.secret);
      setProvisioningUrl(res.provisioning_url || "");
      setQrCode(res.qr_code);
      setStep(2);

      console.log("✅ 2FA setup initiated");
    } catch (err) {
      console.error("❌ 2FA setup failed:", err);
      setError(
        err?.response?.data?.error || 
        err?.response?.data?.message ||
        "Failed to generate 2FA secret. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ STEP 2: Verify OTP token
   */
  const verify2FA = async () => {
    if (token.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await securityApi.verify2FA(token);
      
      if (res.success) {
        // Generate backup codes
        if (res.backup_codes && res.backup_codes.length > 0) {
          setBackupCodes(res.backup_codes);
        }
        
        setStep(3);
        console.log("✅ 2FA verified successfully");
      } else {
        setError(res.error || "Invalid verification code");
      }
    } catch (err) {
      console.error("❌ 2FA verification failed:", err);
      setError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Verification failed. Please check your code."
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ NEW: Auto-focus token input
   */
  useEffect(() => {
    if (step === 2 && tokenInputRef.current) {
      tokenInputRef.current.focus();
    }
  }, [step]);

  /**
   * ✅ NEW: Copy secret to clipboard
   */
  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  /**
   * ✅ NEW: Download backup codes
   */
  const downloadBackupCodes = () => {
    const text = backupCodes.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "securechannelx-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * ✅ NEW: Handle token input (numbers only)
   */
  const handleTokenChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setToken(value);
    setError("");
  };

  /**
   * ✅ NEW: Keyboard shortcuts
   */
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (step === 1) {
        setup2FA();
      } else if (step === 2 && token.length === 6) {
        verify2FA();
      }
    }
  };

  const containerClass = standalone 
    ? "min-h-screen bg-gray-950 flex items-center justify-center px-4"
    : "w-full";

  return (
    <div className={containerClass} onKeyDown={handleKeyDown}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl text-gray-200"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Two-Factor Authentication</h2>
            <p className="text-gray-400 text-sm">
              Add an extra layer of security to your account
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/30 rounded-xl"
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}

        {/* STEP 1: Introduction */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h3 className="text-lg font-semibold mb-4">Enable 2FA</h3>
            <p className="text-gray-400 text-sm mb-6">
              Use Google Authenticator, Authy, Microsoft Authenticator, or any TOTP-compatible app.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
                <div className="text-2xl">🔒</div>
                <div>
                  <p className="font-medium text-sm">Enhanced Security</p>
                  <p className="text-xs text-gray-400">
                    Protect your account from unauthorized access
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
                <div className="text-2xl">🛡</div>
                <div>
                  <p className="font-medium text-sm">Two-Layer Verification</p>
                  <p className="text-xs text-gray-400">
                    Password + authenticator code required
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
                <div className="text-2xl">📱</div>
                <div>
                  <p className="font-medium text-sm">Universal Compatibility</p>
                  <p className="text-xs text-gray-400">
                    Works with all major authenticator apps
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={setup2FA}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 py-3 rounded-xl text-white font-medium transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating QR Code...
                </>
              ) : (
                "Enable Two-Factor Authentication"
              )}
            </button>
          </motion.div>
        )}

        {/* STEP 2: Scan QR & Verify */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h3 className="text-lg font-semibold mb-4">Scan QR Code</h3>

            {/* QR Code Display */}
            <div className="flex flex-col items-center mb-6">
              <div className="p-4 bg-white rounded-xl mb-4">
                {qrCode ? (
                  <img
                    src={qrCode}
                    alt="2FA QR Code"
                    className="w-56 h-56"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-gray-800 rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                )}
              </div>

              {/* Manual Entry Code */}
              <div className="w-full">
                <p className="text-sm text-gray-400 mb-2 text-center">
                  Can't scan? Enter this code manually:
                </p>
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-3">
                  <code className="flex-1 text-center text-purple-400 font-mono text-sm tracking-wider">
                    {secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="p-2 hover:bg-gray-700 rounded-lg transition"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Token Input */}
            <div className="mb-6">
              <label className="text-sm text-gray-300 mb-2 block font-medium">
                Enter 6-digit code from your app:
              </label>
              <input
                ref={tokenInputRef}
                value={token}
                type="text"
                inputMode="numeric"
                maxLength={6}
                onChange={handleTokenChange}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-center text-2xl tracking-widest font-mono focus:border-purple-500 focus:outline-none transition"
                placeholder="000000"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Code refreshes every 30 seconds
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                disabled={loading}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-xl transition text-white"
              >
                Back
              </button>
              <button
                onClick={verify2FA}
                disabled={loading || token.length !== 6}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl text-white font-medium transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Enable"
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Success & Backup Codes */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            {/* Success Icon */}
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-green-500/20 rounded-full">
                <CheckCircle className="w-16 h-16 text-green-400" />
              </div>
            </div>

            <h3 className="text-2xl font-bold mb-3 text-green-400">
              2FA Successfully Enabled!
            </h3>

            <p className="text-gray-400 mb-6">
              Your account is now protected with two-factor authentication
            </p>

            {/* Backup Codes */}
            {backupCodes.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold">Backup Codes</h4>
                  <button
                    onClick={() => setShowBackupCodes(!showBackupCodes)}
                    className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    {showBackupCodes ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        Show
                      </>
                    )}
                  </button>
                </div>

                <p className="text-sm text-gray-400 mb-3">
                  Save these codes in a secure place. Each can be used once if you
                  lose access to your authenticator.
                </p>

                {showBackupCodes && (
                  <div className="grid grid-cols-2 gap-2 mb-4 p-4 bg-gray-800 border border-gray-700 rounded-xl">
                    {backupCodes.map((code, i) => (
                      <code
                        key={i}
                        className="text-sm font-mono text-purple-400 text-center py-1"
                      >
                        {code}
                      </code>
                    ))}
                  </div>
                )}

                <button
                  onClick={downloadBackupCodes}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
                >
                  <Download className="w-4 h-4" />
                  Download Backup Codes
                </button>
              </div>
            )}

            {/* Security Tips */}
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4 mb-6 text-left">
              <h4 className="font-semibold mb-2 text-blue-400">Important:</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• You'll need a code for every login</li>
                <li>• Save backup codes in a secure location</li>
                <li>• Keep your authenticator app backed up</li>
                <li>• Don't share your codes with anyone</li>
              </ul>
            </div>

            {/* Continue Button */}
            <button
              onClick={() => {
                if (onComplete) {
                  onComplete();
                } else if (standalone) {
                  window.location.href = "/";
                }
              }}
              className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-xl text-white font-medium transition"
            >
              Continue to App
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
