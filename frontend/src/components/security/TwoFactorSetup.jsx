import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/components/TwoFactorSetup.css";

const TwoFactorSetup = () => {
  const [step, setStep] = useState(1);
  const [secret, setSecret] = useState("");
  const [provisioningUrl, setProvisioningUrl] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, enable2FA } = useAuth();

  const setup2FA = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch("/api/security/setup-2fa", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSecret(data.secret);
        setProvisioningUrl(data.provisioning_url);
        setQrCode(data.qr_code);
        setStep(2);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to setup 2FA");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    try {
      const response = await enable2FA(token);
      if (response.success) {
        setStep(3);
      }
    } catch (error) {
      console.error("2FA setup failed:", error);
    }
  };

  return (
    <div className="two-factor-setup">
      <h3>Two-Factor Authentication</h3>
      <p>Add an extra layer of security to your account</p>

      {step === 1 && (
        <div className="setup-step">
          <div className="step-info">
            <h4>Enable Two-Factor Authentication</h4>
            <p>
              Two-factor authentication adds an additional layer of security to
              your account by requiring more than just a password to sign in.
            </p>
            <ul className="benefits-list">
              <li>🔒 Protect your account from unauthorized access</li>
              <li>🛡️ Prevent password-based attacks</li>
              <li>📱 Use authenticator apps like Google Authenticator or Authy</li>
            </ul>
          </div>
          <button
            onClick={setup2FA}
            disabled={loading}
            className="setup-button"
          >
            {loading ? "Setting up..." : "Enable 2FA"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="setup-step">
          <h4>Scan QR Code</h4>
          <p>Scan this QR code with your authenticator app</p>

          {error && <div className="error-message">{error}</div>}

          <div className="qr-container">
            {qrCode ? (
              <img src={qrCode} alt="QR Code" className="qr-code" />
            ) : (
              <div className="qr-placeholder">Loading QR code...</div>
            )}
          </div>

          <div className="manual-setup">
            <p>Can't scan the QR code? Enter this code manually:</p>
            <code className="secret-code">{secret}</code>
          </div>

          <div className="token-input">
            <label>Enter verification code from your app:</label>
            <input
              type="text"
              value={token}
              onChange={(e) =>
                setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              maxLength={6}
              className="token-field"
            />
            <button
              onClick={handleSetup}
              disabled={loading || token.length !== 6}
              className="verify-button"
            >
              {loading ? "Verifying..." : "Verify & Enable"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="setup-step success">
          <div className="success-icon">✅</div>
          <h4>Two-Factor Authentication Enabled!</h4>
          <p>Your account is now protected with two-factor authentication.</p>
          <div className="success-tips">
            <p>
              <strong>Important:</strong>
            </p>
            <ul>
              <li>You'll need to enter a verification code each time you sign in</li>
              <li>Save your backup codes in a secure location</li>
              <li>Make sure your authenticator app is backed up</li>
            </ul>
          </div>
          <button
            onClick={() => (window.location.href = "/")}
            className="continue-button"
          >
            Continue to Chat
          </button>
        </div>
      )}
    </div>
  );
};

export default TwoFactorSetup;