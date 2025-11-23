// FILE: src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5050";

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
        console.error("Invalid user_data in localStorage");
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
    console.log("🟢 saveSession called:", {
      jwt: jwt?.substring(0, 20) + "...",
      user: userData,
    });

    localStorage.setItem("access_token", jwt);
    localStorage.setItem("user_data", JSON.stringify(userData));

    setToken(jwt);
    setUser(userData);

    console.log("🟢 User state updated:", userData);
  };

  /* -------------------------------------------------------
       LOGIN (FULLY FIXED)
  -------------------------------------------------------- */
  const login = async (username, password) => {
    try {
      console.log("🟢 AuthContext.login called", { username, API });

      const res = await axios.post(`${API}/api/auth/login`, {
        username,
        password,
      });

      console.log("🟢 Login API response:", res.data);

      const data = res.data.data;
      console.log("🟢 Response data:", data);

      // 2FA check
      if (data.two_factor_required) {
        setRequires2FA(true);
        setTempToken(data.temp_token);
        return { requires2FA: true };
      }

      // Extract fields from actual backend response
      const access_token = data.access_token;
      const user_id = data.user_id;
      const user_name = data.username;  // Renamed to avoid shadowing parameter

      if (!access_token || !user_id || !user_name) {
        console.error("🔴 Invalid server response:", data);
        return { error: "Invalid server response" };
      }

      // Construct user object for frontend
      const userObj = {
        id: user_id,
        username: user_name
      };

      console.log("🟢 Saving session with user:", userObj);

      saveSession(access_token, userObj);

      return { success: true };
    } catch (err) {
      console.error("🔴 Login API error:", err);
      return { error: err.response?.data?.error || "Login failed" };
    }
  };

  /* -------------------------------------------------------
       VERIFY 2FA
  -------------------------------------------------------- */
  const verify2FA = async (code) => {
    try {
      const res = await axios.post(`${API}/api/security/verify-2fa`, {
        temp_token: tempToken,
        code,
      });

      const data = res.data.data;
      saveSession(data.access_token, data.user);

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
      const res = await axios.post(`${API}/api/auth/register`, {
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
          `${API}/api/security/logout`,
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
