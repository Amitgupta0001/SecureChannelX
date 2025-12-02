/**
 * ✅ ENHANCED: SecureChannelX - Authentication Context
 * ---------------------------------------------------
 * Manages user authentication, session, and 2FA
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import storage from "../utils/storage";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);

  /**
   * ✅ HELPER: Safe localStorage check
   */
  const isLocalStorageAvailable = () => {
    try {
      if (typeof window === 'undefined') return false;
      if (!window.localStorage) return false;
      
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('⚠️ localStorage not available:', e);
      return false;
    }
  };

  /**
   * ✅ HELPER: Decode JWT to get expiry time
   */
  const getTokenExpiry = (jwt) => {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch (err) {
      console.error("Failed to decode token:", err);
      return null;
    }
  };

  /**
   * ✅ HELPER: Check if token is expired
   */
  const isTokenExpired = (jwt) => {
    const expiry = getTokenExpiry(jwt);
    if (!expiry) return true;
    return Date.now() >= expiry;
  };

  /**
   * ✅ HELPER: Get device fingerprint
   */
  const getDeviceFingerprint = () => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("SecureChannelX", 2, 2);

      return {
        device_name: navigator.userAgent.substring(0, 50),
        screen: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        fingerprint: canvas.toDataURL().substring(0, 32),
      };
    } catch (e) {
      console.warn('⚠️ Fingerprint generation failed:', e);
      return {
        device_name: 'Unknown Device',
        screen: '0x0',
        timezone: 'UTC',
        language: 'en-US',
        fingerprint: 'unknown',
      };
    }
  };

  /**
   * ✅ HELPER: Normalize user object
   */
  const normalizeUser = (userData) => {
    if (!userData) return null;
    
    const userId = userData.id || userData.user_id || userData._id;

    return {
      ...userData,
      id: userId,
      user_id: userId,
      _id: userId,
      email_verified: userData.email_verified || false,
      two_factor_enabled: userData.two_factor_enabled || false,
      is_active: userData.is_active !== false,
    };
  };

  /**
   * ✅ HELPER: Clear session data
   */
  const clearSession = async () => {
    try {
      await storage.removeToken();
      await storage.setRefreshToken(null);
      await storage.removeUser();
      
      if (isLocalStorageAvailable()) {
        localStorage.removeItem("token_expiry");
      }
      
      storage.lock();

      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setSessionExpiry(null);
      setRequires2FA(false);
      setTempToken(null);

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);

      console.log("🧹 Session cleared");
    } catch (error) {
      console.error("❌ Error clearing session:", error);
    }
  };

  /**
   * ✅ ENHANCED: Save session with expiry tracking
   */
  const saveSession = useCallback(async (jwt, userData, refreshToken = null) => {
    try {
      console.log("💾 Saving session:", {
        token: jwt?.substring(0, 20) + "...",
        user: userData?.username,
        has_refresh: !!refreshToken,
      });

      const normalizedUser = normalizeUser(userData);
      const expiry = getTokenExpiry(jwt);

      await storage.setToken(jwt);
      await storage.setUser(normalizedUser);

      if (refreshToken) {
        await storage.setRefreshToken(refreshToken);
      }

      if (expiry && isLocalStorageAvailable()) {
        localStorage.setItem("token_expiry", expiry.toString());
      }

      setToken(jwt);
      setUser(normalizedUser);
      setIsAuthenticated(true);
      setSessionExpiry(expiry);

      console.log("✅ Session saved successfully");
    } catch (error) {
      console.error("❌ Failed to save session:", error);
    }
  }, []);

  /**
   * ✅ Validate and restore session on mount
   */
  useEffect(() => {
    const validateSession = async () => {
      try {
        console.log("🔍 Validating session...");

        if (!isLocalStorageAvailable()) {
          console.warn('⚠️ localStorage not available');
          setIsAuthenticated(false);
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          await storage.restore();
        } catch (e) {
          console.warn('⚠️ Storage restore failed:', e);
        }

        const storedToken = await storage.getToken();
        const storedUser = await storage.getUser();

        if (!storedToken || !storedUser) {
          console.log("ℹ️ No stored session found");
          setIsAuthenticated(false);
          setUser(null);
          setLoading(false);
          return;
        }

        if (isTokenExpired(storedToken)) {
          console.log("⏰ Token expired, clearing session...");
          await clearSession();
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
          timeout: 10000,
        });

        const userData = normalizeUser(response.data.data?.user || response.data.user);

        setToken(storedToken);
        setUser(userData);
        setIsAuthenticated(true);

        console.log("✅ Session restored:", userData?.username);
      } catch (error) {
        console.log("🔴 Session validation failed:", error.message);
        await clearSession();
      } finally {
        setLoading(false);
      }
    };

    validateSession().catch(err => {
      console.error("❌ validateSession failed:", err);
      setLoading(false);
    });

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, []);

  /**
   * ✅ Login
   */
  const login = async (username, password) => {
    try {
      console.log('🔐 Attempting login for:', username);

      const initSuccess = await storage.init(password);
      if (!initSuccess) {
        console.warn("⚠️ Storage init failed, proceeding with fallback");
      }

      const deviceInfo = getDeviceFingerprint();

      const response = await axios.post(
        `${API}/api/auth/login`,
        {
          username,
          password,
          ...deviceInfo,
        },
        { timeout: 15000 }
      );

      console.log('📬 Login response received');

      const { data } = response.data;

      if (data.requires_2fa) {
        setRequires2FA(true);
        setTempToken(data.temp_token);

        return {
          success: true,
          requires2FA: true,
          message: "Please enter your 2FA code",
        };
      }

      const { access_token, refresh_token, user: userData } = data;

      await saveSession(access_token, userData, refresh_token);

      console.log('✅ Login successful');

      return {
        success: true,
        requires2FA: false,
        user: normalizeUser(userData),
      };
    } catch (error) {
      console.error("❌ Login error:", error);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        (error.code === "ECONNABORTED"
          ? "Connection timeout. Please try again."
          : "Login failed. Please check your credentials.");

      return {
        success: false,
        message,
      };
    }
  };

  /**
   * ✅ Verify 2FA
   */
  const verify2FA = async (code) => {
    if (!tempToken) {
      return { success: false, error: "No 2FA session found" };
    }

    try {
      const response = await axios.post(
        `${API}/api/security/verify-2fa`,
        {
          temp_token: tempToken,
          code: code.toString(),
        },
        { timeout: 10000 }
      );

      const { access_token, refresh_token, user: userData } = response.data.data;

      await saveSession(access_token, userData, refresh_token);

      setRequires2FA(false);
      setTempToken(null);

      return {
        success: true,
        user: normalizeUser(userData),
      };
    } catch (err) {
      console.error("❌ 2FA verification failed:", err);

      return {
        success: false,
        error: err.response?.data?.error || err.response?.data?.message || "Invalid code",
      };
    }
  };

  /**
   * ✅ Register
   */
  const register = async (username, email, password) => {
    try {
      console.log('📝 Attempting registration for:', username);

      const deviceInfo = getDeviceFingerprint();

      const response = await axios.post(
        `${API}/api/auth/register`,
        {
          username,
          email,
          password,
          device_name: deviceInfo.device_name,
        },
        { timeout: 15000 }
      );

      console.log('✅ Registration successful');

      return {
        success: true,
        message: response.data.message || "Registration successful! Please log in.",
      };
    } catch (err) {
      console.error("❌ Registration error:", err);

      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Registration failed. Please try again.";

      return {
        success: false,
        error: message,
      };
    }
  };

  /**
   * ✅ Logout
   */
  const logout = async () => {
    try {
      console.log("👋 Logging out...");

      const currentToken = token || await storage.getToken();

      if (currentToken) {
        try {
          await axios.post(
            `${API}/api/auth/logout`,
            {},
            {
              headers: { Authorization: `Bearer ${currentToken}` },
              timeout: 5000,
            }
          );
        } catch (e) {
          console.warn("⚠️ Server logout notification failed:", e.message);
        }
      }

      await clearSession();

      console.log("✅ Logged out successfully");
    } catch (error) {
      console.error("❌ Logout error:", error);
      await clearSession();
    }
  };

  /**
   * ✅ Refresh access token
   */
  const refreshAccessToken = async () => {
    if (isRefreshing) {
      console.log("⏳ Token refresh already in progress");
      return;
    }

    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) {
      console.log("❌ No refresh token available");
      logout();
      return;
    }

    setIsRefreshing(true);

    try {
      console.log("🔄 Refreshing access token...");

      const response = await axios.post(
        `${API}/api/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: 10000 }
      );

      const { access_token, user: userData } = response.data.data;

      await saveSession(access_token, userData, refreshToken);
      console.log("✅ Token refreshed successfully");

      return access_token;
    } catch (err) {
      console.error("❌ Token refresh failed:", err);
      logout();
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  const contextValue = {
    user,
    token,
    loading,
    isAuthenticated,
    requires2FA,
    login,
    verify2FA,
    register,
    logout,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
