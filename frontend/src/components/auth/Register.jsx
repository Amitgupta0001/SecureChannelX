import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import "../../styles/components/Login.css";

const Register = () => {
  const [username, setUsername] = useState("");  // backend requires username
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const { register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/chat");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await register(username, email, password);  // Correct field order
      navigate("/login");
    } catch (err) {
      console.error(err);
      setError("Registration failed. Username or email may already exist.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        
        <div className="login-header">
          <h1>Create Account</h1>
          <p>Join SecureChannelX</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              placeholder="Choose a username"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              placeholder="your@email.com"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              placeholder="Enter a strong password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              type="password"
              placeholder="Re-enter password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-button">
            Create Account
          </button>

        </form>

        <div className="login-links">
          <span>Already have an account?</span>
          <Link to="/login">Login</Link>
        </div>

        <div className="security-features">
          <div className="feature">
            <span className="icon">🔒</span>
            <span>Secure password hashing</span>
          </div>
          <div className="feature">
            <span className="icon">⚙️</span>
            <span>End-to-end encryption enabled</span>
          </div>
          <div className="feature">
            <span className="icon">🛡️</span>
            <span>Zero-knowledge architecture</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Register;
