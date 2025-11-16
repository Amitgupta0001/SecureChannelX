import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "../../styles/components/Login.css";

const TwoFactorAuth = () => {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("Enter the 6-digit verification code");

  const { verify2FA, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("OTP must be 6 digits.");
      return;
    }

    try {
      const success = await verify2FA(otp);
      if (success) {
        navigate("/chat");
      } else {
        setError("Invalid OTP. Try again.");
      }
    } catch (err) {
      console.log(err);
      setError("Verification failed.");
    }
  };

  const resendOTP = async () => {
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (res.ok) {
        setInfo("A new OTP has been sent to your email.");
      } else {
        setError("Failed to resend OTP.");
      }
    } catch (e) {
      setError("Error sending OTP.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">

        <div className="login-header">
          <h1>Two-Factor Authentication</h1>
          <p>{info}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="otp">Verification Code</label>
            <input
              type="text"
              id="otp"
              value={otp}
              maxLength={6}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit code"
              required
            />
          </div>

          <button type="submit" className="login-button">
            Verify
          </button>
        </form>

        <div className="login-links">
          <button className="link-btn" onClick={resendOTP}>
            Resend Code
          </button>
        </div>

        <div className="security-features">
          <div className="feature">
            <span className="icon">🔒</span>
            <span>Extra Layer of Security</span>
          </div>
          <div className="feature">
            <span className="icon">📩</span>
            <span>Email or Authenticator App</span>
          </div>
          <div className="feature">
            <span className="icon">🛡️</span>
            <span>Zero-Knowledge Handling</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TwoFactorAuth;
