// FILE: src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// ✅ FIX: Export AuthContext so other components can import it
export const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState(null);

  /* -------------------------------------------------------
       LOAD SESSION ON PAGE REFRESH
  -------------------------------------------------------- */
  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("user_data");

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Invalid user_data");
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_data");
      }
    }

    setLoading(false);
  }, []);

  /* -------------------------------------------------------
       SAVE SESSION
  -------------------------------------------------------- */
  const saveSession = (jwt, userData) => {
    localStorage.setItem("access_token", jwt);
    localStorage.setItem("user_data", JSON.stringify(userData));

    setToken(jwt);
    setUser(userData);
  };

  /* -------------------------------------------------------
       LOGIN (Step 1)
  -------------------------------------------------------- */
  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });

      if (res.data.two_factor_required) {
        setRequires2FA(true);
        setTempToken(res.data.temp_token);
        return { requires2FA: true };
      }

      saveSession(res.data.access_token, res.data.user);
      return { success: true };
    } catch (err) {
      return { error: err.response?.data?.error || "Login failed" };
    }
  };

  /* -------------------------------------------------------
       VERIFY 2FA (Step 2)
  -------------------------------------------------------- */
  const verify2FA = async (code) => {
    try {
      const res = await axios.post(`${API}/security/verify-2fa`, {
        temp_token: tempToken,
        code,
      });

      saveSession(res.data.access_token, res.data.user);

      setRequires2FA(false);
      setTempToken(null);

      return { success: true };
    } catch (err) {
      return { error: err.response?.data?.error || "Invalid code" };
    }
  };

  /* -------------------------------------------------------
       REGISTER
  -------------------------------------------------------- */
  const register = async (username, email, password) => {
    try {
      const res = await axios.post(`${API}/auth/register`, {
        username,
        email,
        password,
      });
      return { success: true, message: res.data.message };
    } catch (err) {
      return { error: err.response?.data?.error || "Registration failed" };
    }
  };

  /* -------------------------------------------------------
       LOGOUT
  -------------------------------------------------------- */
  const logout = async () => {
    try {
      if (token) {
        await axios.post(
          `${API}/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_data");
      setUser(null);
      setToken(null);
      setRequires2FA(false);
      setTempToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        verify2FA,
        register,
        logout,
        requires2FA,
        tempToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
