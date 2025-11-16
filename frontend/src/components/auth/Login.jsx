import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import "../../styles/components/Login.css";

const Login = () => {
  const [username, setUsername] = useState("");   // FIXED: login via username
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/chat"); 
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await login(username, password);   // FIXED
      navigate("/");
    } catch (err) {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        
        <div className="login-header">
          <h1>SecureChannelX</h1>
          <p>Secure Encrypted Messaging</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label> {/* FIXED */}
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-button">
            Log In
          </button>
        </form>

        <div className="login-links">
          <Link to="/forgot-password">Forgot Password?</Link>
          <Link to="/register">Create Account</Link>
        </div>

        <div className="security-features">
          <div className="feature">
            <span className="icon">🔒</span>
            <span>End-to-End Encryption</span>
          </div>
          <div className="feature">
            <span className="icon">⚡</span>
            <span>Real-time Messaging</span>
          </div>
          <div className="feature">
            <span className="icon">🛡️</span>
            <span>Military-grade Security</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
