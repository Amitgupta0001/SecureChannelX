/**
 * ✅ FIXED: SecureChannelX - Authentication API
 * ------------------------------------------------
 * User authentication, registration, and token management
 */

import axios from "axios";
import storage from "../utils/storage";

// ============================================================
//                   CONFIGURATION - FIXED
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const API_TIMEOUT = 30000; // 30 seconds

console.log('🔧 Auth API Configuration:');
console.log('   - Base URL:', API_BASE_URL);
console.log('   - Timeout:', API_TIMEOUT, 'ms');

// ✅ Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================
//                   TOKEN MANAGEMENT
// ============================================================

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

// ============================================================
//                   REQUEST INTERCEPTOR
// ============================================================

api.interceptors.request.use(
  async (config) => {
    // Auto-inject token from secure storage
    if (!config.headers.Authorization &&
      !config.url.includes("/auth/login") &&
      !config.url.includes("/auth/register") &&
      !config.url.includes("/check-username")) {
      const token = await storage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (import.meta.env.DEV) {
      console.log(`📤 [Auth API] ${config.method.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error("❌ [Auth API] Request error:", error);
    return Promise.reject(error);
  }
);

// ============================================================
//                   RESPONSE INTERCEPTOR
// ============================================================

api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`📥 [Auth API] Response:`, response.status, response.data);
    }
    return response;
  },
  async (error) => {
    const { config, response } = error;

    // Handle token refresh
    if (response?.status === 401 && !config._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            config.headers.Authorization = `Bearer ${token}`;
            resolve(api(config));
          });
        });
      }

      config._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await storage.getRefreshToken();

        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const result = await authApi.refreshToken(refreshToken);

        if (result.success) {
          const { access_token } = result;
          await storage.setToken(access_token);

          config.headers.Authorization = `Bearer ${access_token}`;
          onRefreshed(access_token);

          return api(config);
        }
      } catch (refreshError) {
        console.error("❌ Token refresh failed:", refreshError);
        await authApi.clearAuthData();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors
    if (response) {
      const { status, data } = response;
      console.error(`❌ [Auth API] Error (${status}):`, data);
    } else if (error.request) {
      console.error("❌ [Auth API] Network error - Server not responding");
    }

    return Promise.reject(error);
  }
);

// ============================================================
//                   VALIDATION HELPERS
// ============================================================

const validateEmail = (email) => {
  if (!email || typeof email !== "string") {
    throw new Error("Valid email is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  return true;
};

const validatePassword = (password) => {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  return true;
};

const validateUsername = (username) => {
  if (!username || typeof username !== "string") {
    throw new Error("Username is required");
  }

  if (username.length < 3 || username.length > 30) {
    throw new Error("Username must be between 3 and 30 characters");
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("Username can only contain letters, numbers, and underscores");
  }

  return true;
};

// ============================================================
//                   DEVICE INFO HELPER
// ============================================================

const getDeviceInfo = () => {
  try {
    const userAgent = navigator.userAgent;

    let os = "Unknown";
    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "macOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iOS")) os = "iOS";

    let browser = "Unknown";
    if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Safari")) browser = "Safari";
    else if (userAgent.includes("Edge")) browser = "Edge";
    else if (userAgent.includes("Opera")) browser = "Opera";

    return {
      device_name: `${browser} on ${os}`,
      device_type: "web",
      os,
      browser,
      user_agent: userAgent.substring(0, 200), // Limit length
    };
  } catch (error) {
    console.error("Failed to get device info:", error);
    return {
      device_name: "Unknown Device",
      device_type: "web",
      os: "Unknown",
      browser: "Unknown",
    };
  }
};

// ============================================================
//                   AUTH API
// ============================================================

const authApi = {
  // ============================================================
  //                   REGISTRATION
  // ============================================================

  async register(username, email, password, full_name = null) {
    try {
      console.log('📝 Registration attempt:', { username, email });

      validateUsername(username);
      validateEmail(email);
      validatePassword(password);

      const deviceInfo = getDeviceInfo();

      const response = await api.post("/api/auth/register", {
        username,
        email,
        password,
        full_name,
        ...deviceInfo,
      });

      const { data } = response;
      const { access_token, refresh_token, user } = data.data || data;

      // Store tokens
      if (access_token) await storage.setToken(access_token);
      if (refresh_token) await storage.setRefreshToken(refresh_token);
      if (user) await storage.setUser(user);

      console.log('✅ Registration successful:', username);

      return {
        success: true,
        user,
        tokens: { access_token, refresh_token },
        message: data.message || "Registration successful",
      };
    } catch (error) {
      console.error("❌ [Auth API] Register error:", error);

      const errorMessage = error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Registration failed";

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  // ============================================================
  //                   LOGIN
  // ============================================================

  async login(emailOrUsername, password, twoFactorCode = null) {
    try {
      console.log('🔐 Login attempt:', emailOrUsername);

      if (!emailOrUsername || !password) {
        throw new Error("Email/username and password are required");
      }

      const deviceInfo = getDeviceInfo();
      const isEmail = emailOrUsername.includes("@");

      const response = await api.post("/api/auth/login", {
        [isEmail ? "email" : "username"]: emailOrUsername,
        password,
        two_factor_code: twoFactorCode,
        ...deviceInfo,
      });

      const { data } = response;

      // Check if 2FA is required
      if (data.requires_2fa || data.data?.requires_2fa) {
        return {
          success: false,
          requires_2fa: true,
          message: "2FA code required",
          temp_token: data.temp_token || data.data?.temp_token,
        };
      }

      const { access_token, refresh_token, user } = data.data || data;

      // Store tokens and user data
      if (access_token) await storage.setToken(access_token);
      if (refresh_token) await storage.setRefreshToken(refresh_token);
      if (user) await storage.setUser(user);

      console.log('✅ Login successful:', user.username);

      return {
        success: true,
        user,
        tokens: { access_token, refresh_token },
        message: data.message || "Login successful",
      };
    } catch (error) {
      console.error("❌ [Auth API] Login error:", error);

      const errorMessage = error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Login failed";

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  // ============================================================
  //                   LOGOUT - FIXED
  // ============================================================

  async logout(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/auth/logout", {}, { headers });

      // Clear local storage - FIXED
      await storage.removeToken();
      await storage.setRefreshToken(null);
      await storage.removeUser();

      console.log('✅ Logged out successfully');

      return {
        success: true,
        message: "Logged out successfully",
      };
    } catch (error) {
      console.error("❌ [Auth API] Logout error:", error);

      // Clear storage anyway
      await storage.removeToken();
      await storage.setRefreshToken(null);
      await storage.removeUser();

      throw error;
    }
  },

  // ============================================================
  //                   TOKEN MANAGEMENT
  // ============================================================

  async refreshToken(refreshToken = null) {
    try {
      const token = refreshToken || await storage.getRefreshToken();

      if (!token) {
        throw new Error("No refresh token available");
      }

      const response = await api.post("/api/auth/refresh", {
        refresh_token: token,
      });

      const { data } = response;
      const { access_token, refresh_token: new_refresh_token } = data.data || data;

      // Update stored tokens
      if (access_token) await storage.setToken(access_token);
      if (new_refresh_token) await storage.setRefreshToken(new_refresh_token);

      return {
        success: true,
        access_token,
        refresh_token: new_refresh_token,
      };
    } catch (error) {
      console.error("❌ [Auth API] Refresh token error:", error);

      // Clear invalid tokens
      await storage.removeToken();
      await storage.setRefreshToken(null);

      throw error;
    }
  },

  async validateToken(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/auth/validate", { headers });

      return {
        valid: true,
        user: response.data.user,
        expires_at: response.data.expires_at,
      };
    } catch (error) {
      console.error("❌ [Auth API] Validate token error:", error);
      return {
        valid: false,
        user: null,
        expires_at: null,
      };
    }
  },

  // ============================================================
  //                   USER PROFILE
  // ============================================================

  async getCurrentUser(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/auth/me", { headers });

      const { data } = response;
      const user = data.data?.user || data.user || data;

      // Update stored user data
      await storage.setUser(user);

      return {
        success: true,
        user,
      };
    } catch (error) {
      console.error("❌ [Auth API] Get current user error:", error);
      throw error;
    }
  },

  // ============================================================
  //                   UTILITY METHODS - FIXED
  // ============================================================

  async isAuthenticated() {
    const token = await storage.getToken();
    const user = await storage.getUser();
    return !!(token && user);
  },

  async getStoredUser() {
    return await storage.getUser();
  },

  async getAccessToken() {
    return await storage.getToken();
  },

  async getRefreshToken() {
    return await storage.getRefreshToken();
  },

  async clearAuthData() {
    await storage.removeToken();
    await storage.setRefreshToken(null);
    await storage.removeUser();
    console.log('🧹 Auth data cleared');
  },

  validateFields(fields) {
    const errors = {};

    if (fields.username !== undefined) {
      try {
        validateUsername(fields.username);
      } catch (error) {
        errors.username = error.message;
      }
    }

    if (fields.email !== undefined) {
      try {
        validateEmail(fields.email);
      } catch (error) {
        errors.email = error.message;
      }
    }

    if (fields.password !== undefined) {
      try {
        validatePassword(fields.password);
      } catch (error) {
        errors.password = error.message;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  },
};

export default authApi;