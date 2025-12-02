/**
 * ✅ ENHANCED: SecureChannelX - Security API
 * ------------------------------------------
 * Security features: 2FA, audit logs, device management, session keys
 * 
 * Changes:
 *   - Fixed: API URL to port 5050
 *   - Fixed: API endpoint paths (removed duplicate /api prefix)
 *   - Added: Axios instance with interceptors
 *   - Added: Automatic token injection
 *   - Added: Comprehensive error handling
 *   - Added: Input validation
 *   - Added: Disable 2FA method
 *   - Added: Backup codes management
 *   - Added: Session revocation
 *   - Added: Security settings
 *   - Added: Password change
 *   - Added: Export security data
 *   - Enhanced: Device trust management
 *   - Enhanced: Audit log filtering
 * 
 * Compatibility:
 *   - Backend API: ✅ Port 5050
 *   - Authentication: ✅ JWT Bearer tokens
 *   - 2FA: ✅ TOTP compatible
 *   - Audit Logs: ✅ Comprehensive tracking
 */

import axios from "axios";

// ============================================================
//                   CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
const API_TIMEOUT = 30000; // 30 seconds

// ✅ ENHANCEMENT: Create axios instance with proper config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================
//                   REQUEST INTERCEPTOR
// ============================================================

api.interceptors.request.use(
  (config) => {
    // Auto-inject token from localStorage if not provided
    if (!config.headers.Authorization) {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`[Security API] ${config.method.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error("[Security API] Request error:", error);
    return Promise.reject(error);
  }
);

// ============================================================
//                   RESPONSE INTERCEPTOR
// ============================================================

api.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`[Security API] Response:`, response.data);
    }
    return response;
  },
  async (error) => {
    const { response, config } = error;

    // Handle specific error cases
    if (response) {
      const { status, data } = response;

      switch (status) {
        case 401:
          console.error("❌ [Security API] Unauthorized: Invalid or expired token");
          // Optionally trigger logout
          if (typeof window !== "undefined") {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/login";
          }
          break;

        case 403:
          console.error("❌ [Security API] Forbidden:", data.message);
          break;

        case 404:
          console.error("❌ [Security API] Not found:", data.message);
          break;

        case 429:
          console.error("❌ [Security API] Rate limited");
          break;

        case 500:
          console.error("❌ [Security API] Server error:", data.message);
          break;

        default:
          console.error(`❌ [Security API] Error (${status}):`, data.message || error.message);
      }
    } else if (error.request) {
      console.error("❌ [Security API] Network error: No response from server");
    } else {
      console.error("❌ [Security API] Request setup error:", error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================================
//                   VALIDATION HELPERS
// ============================================================

const validate2FACode = (code) => {
  if (!code || typeof code !== "string") {
    throw new Error("2FA code must be a string");
  }

  const cleanCode = code.replace(/\s/g, "");
  
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error("2FA code must be 6 digits");
  }

  return cleanCode;
};

const validateDeviceId = (deviceId) => {
  if (!deviceId || typeof deviceId !== "string") {
    throw new Error("Valid device ID is required");
  }
  return true;
};

// ============================================================
//                   SECURITY API
// ============================================================

const securityApi = {
  // ============================================================
  //                   TWO-FACTOR AUTHENTICATION (2FA)
  // ============================================================

  /**
   * ✅ ENHANCED: Setup 2FA for user account
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, qr_code, secret, backup_codes }
   */
  async setup2FA(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post("/api/security/setup-2fa", {}, { headers });

      return {
        success: true,
        qr_code: response.data.qr_code || response.data.data?.qr_code,
        secret: response.data.secret || response.data.data?.secret,
        backup_codes: response.data.backup_codes || response.data.data?.backup_codes || [],
        message: response.data.message || "2FA setup initiated successfully",
      };
    } catch (error) {
      console.error("[Security API] Setup 2FA error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ ENHANCED: Verify 2FA code to enable 2FA
   * 
   * @param {string} code - 6-digit TOTP code
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message, backup_codes }
   */
  async verify2FA(code, token = null) {
    try {
      const cleanCode = validate2FACode(code);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/security/verify-2fa",
        { code: cleanCode },
        { headers }
      );

      return {
        success: true,
        message: response.data.message || "2FA enabled successfully",
        backup_codes: response.data.backup_codes || [],
        is_enabled: response.data.is_enabled !== false,
      };
    } catch (error) {
      console.error("[Security API] Verify 2FA error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Disable 2FA for user account
   * 
   * @param {string} code - 6-digit TOTP code or backup code
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async disable2FA(code, token = null) {
    try {
      const cleanCode = validate2FACode(code);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/security/disable-2fa",
        { code: cleanCode },
        { headers }
      );

      return {
        success: true,
        message: response.data.message || "2FA disabled successfully",
      };
    } catch (error) {
      console.error("[Security API] Disable 2FA error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get 2FA status
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, is_enabled, has_backup_codes }
   */
  async get2FAStatus(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/security/2fa-status", { headers });

      return {
        success: true,
        is_enabled: response.data.is_enabled || false,
        has_backup_codes: response.data.has_backup_codes || false,
        setup_date: response.data.setup_date,
      };
    } catch (error) {
      console.error("[Security API] Get 2FA status error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Generate new backup codes
   * 
   * @param {string} code - Current 2FA code for verification
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, backup_codes }
   */
  async regenerateBackupCodes(code, token = null) {
    try {
      const cleanCode = validate2FACode(code);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/security/regenerate-backup-codes",
        { code: cleanCode },
        { headers }
      );

      return {
        success: true,
        backup_codes: response.data.backup_codes || [],
        message: response.data.message || "Backup codes regenerated successfully",
      };
    } catch (error) {
      console.error("[Security API] Regenerate backup codes error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   AUDIT LOGS
  // ============================================================

  /**
   * ✅ ENHANCED: Get security audit logs
   * 
   * @param {object} [options] - Filter options
   * @param {number} [options.limit=50] - Number of logs to fetch
   * @param {number} [options.skip=0] - Number to skip (pagination)
   * @param {string} [options.action_type] - Filter by action type
   * @param {string} [options.date_from] - Start date (ISO string)
   * @param {string} [options.date_to] - End date (ISO string)
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, logs, total_count }
   */
  async getAuditLogs(options = {}, token = null) {
    try {
      const {
        limit = 50,
        skip = 0,
        action_type,
        date_from,
        date_to,
      } = options;

      // Validate pagination
      if (limit < 1 || limit > 100) {
        throw new Error("Limit must be between 1 and 100");
      }

      if (skip < 0) {
        throw new Error("Skip must be non-negative");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Build query parameters
      const params = new URLSearchParams({
        limit: limit.toString(),
        skip: skip.toString(),
        ...(action_type && { action_type }),
        ...(date_from && { date_from }),
        ...(date_to && { date_to }),
      });

      const response = await api.get(`/api/security/audit-logs?${params}`, { headers });

      return {
        success: true,
        logs: response.data.logs || response.data.data?.logs || [],
        total_count: response.data.total_count || 0,
        has_more: response.data.has_more || false,
      };
    } catch (error) {
      console.error("[Security API] Get audit logs error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Export audit logs
   * 
   * @param {string} [format="json"] - Export format (json, csv)
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<Blob>} - File blob
   */
  async exportAuditLogs(format = "json", token = null) {
    try {
      const validFormats = ["json", "csv"];
      if (!validFormats.includes(format)) {
        throw new Error(`Invalid format. Must be one of: ${validFormats.join(", ")}`);
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get(`/api/security/audit-logs/export?format=${format}`, {
        headers,
        responseType: "blob",
      });

      return response.data;
    } catch (error) {
      console.error("[Security API] Export audit logs error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   DEVICE MANAGEMENT
  // ============================================================

  /**
   * ✅ ENHANCED: Get all registered devices
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, devices }
   */
  async getDevices(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/users/devices", { headers });

      return {
        success: true,
        devices: response.data.devices || response.data.data?.devices || [],
        current_device_id: response.data.current_device_id,
      };
    } catch (error) {
      console.error("[Security API] Get devices error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ ENHANCED: Remove a device
   * 
   * @param {string} deviceId - Device ID to remove
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async removeDevice(deviceId, token = null) {
    try {
      validateDeviceId(deviceId);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete(`/api/users/devices/${deviceId}`, { headers });

      return {
        success: true,
        message: response.data.message || "Device removed successfully",
      };
    } catch (error) {
      console.error("[Security API] Remove device error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Trust a device
   * 
   * @param {string} deviceId - Device ID to trust
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async trustDevice(deviceId, token = null) {
    try {
      validateDeviceId(deviceId);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        `/api/users/devices/${deviceId}/trust`,
        {},
        { headers }
      );

      return {
        success: true,
        message: response.data.message || "Device trusted successfully",
      };
    } catch (error) {
      console.error("[Security API] Trust device error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Untrust a device
   * 
   * @param {string} deviceId - Device ID to untrust
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async untrustDevice(deviceId, token = null) {
    try {
      validateDeviceId(deviceId);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete(`/api/users/devices/${deviceId}/trust`, { headers });

      return {
        success: true,
        message: response.data.message || "Device untrusted successfully",
      };
    } catch (error) {
      console.error("[Security API] Untrust device error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Remove all devices except current
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message, removed_count }
   */
  async removeAllOtherDevices(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete("/api/users/devices/remove-others", { headers });

      return {
        success: true,
        message: response.data.message || "All other devices removed",
        removed_count: response.data.removed_count || 0,
      };
    } catch (error) {
      console.error("[Security API] Remove all devices error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   SESSION MANAGEMENT
  // ============================================================

  /**
   * ✅ ENHANCED: Get active session keys
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, session_keys }
   */
  async getSessionKeys(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/security/session-keys", { headers });

      return {
        success: true,
        session_keys: response.data.session_keys || response.data.data?.session_keys || [],
      };
    } catch (error) {
      console.error("[Security API] Get session keys error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get all active sessions
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, sessions }
   */
  async getActiveSessions(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/security/sessions", { headers });

      return {
        success: true,
        sessions: response.data.sessions || [],
        current_session_id: response.data.current_session_id,
      };
    } catch (error) {
      console.error("[Security API] Get sessions error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Revoke a session
   * 
   * @param {string} sessionId - Session ID to revoke
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async revokeSession(sessionId, token = null) {
    try {
      if (!sessionId) {
        throw new Error("Session ID is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete(`/api/security/sessions/${sessionId}`, { headers });

      return {
        success: true,
        message: response.data.message || "Session revoked successfully",
      };
    } catch (error) {
      console.error("[Security API] Revoke session error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Revoke all sessions except current
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message, revoked_count }
   */
  async revokeAllOtherSessions(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete("/api/security/sessions/revoke-others", { headers });

      return {
        success: true,
        message: response.data.message || "All other sessions revoked",
        revoked_count: response.data.revoked_count || 0,
      };
    } catch (error) {
      console.error("[Security API] Revoke all sessions error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   PASSWORD MANAGEMENT
  // ============================================================

  /**
   * ✅ NEW: Change password
   * 
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async changePassword(currentPassword, newPassword, token = null) {
    try {
      if (!currentPassword || !newPassword) {
        throw new Error("Current and new passwords are required");
      }

      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/security/change-password",
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        { headers }
      );

      return {
        success: true,
        message: response.data.message || "Password changed successfully",
      };
    } catch (error) {
      console.error("[Security API] Change password error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Validate password strength
   * 
   * @param {string} password - Password to validate
   * @returns {object} - { valid, strength, suggestions }
   */
  validatePasswordStrength(password) {
    const suggestions = [];
    let strength = 0;

    if (!password || password.length === 0) {
      return {
        valid: false,
        strength: 0,
        suggestions: ["Password cannot be empty"],
      };
    }

    // Length check
    if (password.length < 8) {
      suggestions.push("Password should be at least 8 characters");
    } else {
      strength += 1;
    }

    // Uppercase check
    if (!/[A-Z]/.test(password)) {
      suggestions.push("Add at least one uppercase letter");
    } else {
      strength += 1;
    }

    // Lowercase check
    if (!/[a-z]/.test(password)) {
      suggestions.push("Add at least one lowercase letter");
    } else {
      strength += 1;
    }

    // Number check
    if (!/\d/.test(password)) {
      suggestions.push("Add at least one number");
    } else {
      strength += 1;
    }

    // Special character check
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      suggestions.push("Add at least one special character");
    } else {
      strength += 1;
    }

    const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];

    return {
      valid: strength >= 4,
      strength,
      strength_label: strengthLabels[strength],
      suggestions,
    };
  },

  // ============================================================
  //                   SECURITY SETTINGS
  // ============================================================

  /**
   * ✅ NEW: Get security settings
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, settings }
   */
  async getSecuritySettings(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/security/settings", { headers });

      return {
        success: true,
        settings: response.data.settings || {},
      };
    } catch (error) {
      console.error("[Security API] Get settings error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Update security settings
   * 
   * @param {object} settings - Security settings to update
   * @param {boolean} [settings.require_2fa_for_sensitive_actions]
   * @param {boolean} [settings.enable_login_alerts]
   * @param {boolean} [settings.enable_device_verification]
   * @param {number} [settings.session_timeout_minutes]
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, settings, message }
   */
  async updateSecuritySettings(settings, token = null) {
    try {
      if (!settings || typeof settings !== "object") {
        throw new Error("Valid settings object is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.put("/api/security/settings", settings, { headers });

      return {
        success: true,
        settings: response.data.settings,
        message: response.data.message || "Security settings updated successfully",
      };
    } catch (error) {
      console.error("[Security API] Update settings error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   UTILITY METHODS
  // ============================================================

  /**
   * ✅ NEW: Format audit log action for display
   * 
   * @param {string} action - Action type
   * @returns {object} - { label, icon, color }
   */
  formatAuditAction(action) {
    const actionMap = {
      login: { label: "Login", icon: "🔑", color: "green" },
      logout: { label: "Logout", icon: "🚪", color: "blue" },
      "2fa_enabled": { label: "2FA Enabled", icon: "🔒", color: "green" },
      "2fa_disabled": { label: "2FA Disabled", icon: "🔓", color: "orange" },
      password_changed: { label: "Password Changed", icon: "🔐", color: "blue" },
      device_added: { label: "Device Added", icon: "📱", color: "green" },
      device_removed: { label: "Device Removed", icon: "❌", color: "red" },
      session_revoked: { label: "Session Revoked", icon: "⛔", color: "red" },
      failed_login: { label: "Failed Login", icon: "⚠️", color: "red" },
    };

    return actionMap[action] || { label: action, icon: "ℹ️", color: "gray" };
  },

  /**
   * ✅ NEW: Format device info for display
   * 
   * @param {object} device - Device object
   * @returns {object} - Formatted device info
   */
  formatDeviceInfo(device) {
    if (!device) return null;

    return {
      id: device.device_id || device.id,
      name: device.device_name || "Unknown Device",
      type: device.device_type || "unknown",
      os: device.os || "Unknown OS",
      browser: device.browser || "Unknown Browser",
      is_current: device.is_current || false,
      is_trusted: device.is_trusted || false,
      last_active: device.last_active,
      created_at: device.created_at,
    };
  },

  /**
   * ✅ NEW: Check if action requires 2FA verification
   * 
   * @param {string} action - Action to check
   * @returns {boolean} - True if 2FA required
   */
  requires2FA(action) {
    const sensitiveActions = [
      "disable_2fa",
      "change_password",
      "remove_all_devices",
      "revoke_all_sessions",
      "delete_account",
    ];

    return sensitiveActions.includes(action);
  },
};

// ============================================================
//                   EXPORT
// ============================================================

export default securityApi;
