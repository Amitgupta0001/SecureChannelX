/**
 * ✅ ENHANCED: SecureChannelX - Key Management API
 * ------------------------------------------------
 * E2EE key bundle management
 * 
 * Changes:
 *   - Fixed: API URL to port 5050
 *   - Added: Axios instance with interceptors
 *   - Added: Automatic token injection
 *   - Added: Comprehensive error handling
 *   - Added: Input validation
 *   - Added: Key rotation support
 *   - Added: Multiple bundle retrieval
 * 
 * Compatibility:
 *   - Backend API: ✅ Port 5050
 *   - E2EE: ✅ Signal Protocol compatible
 */

import axios from "axios";

// ============================================================
//                   CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
const API_TIMEOUT = 30000;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/keys`,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================
//                   INTERCEPTORS
// ============================================================

api.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization) {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ============================================================
//                   KEY API
// ============================================================

const keyApi = {
  /**
   * ✅ ENHANCED: Upload key bundle
   */
  async uploadBundle(bundle, token = null) {
    try {
      if (!bundle || typeof bundle !== "object") {
        throw new Error("Valid key bundle is required");
      }

      // Validate bundle structure
      const requiredKeys = ["identity_key", "signed_pre_key", "pre_key_signature"];
      for (const key of requiredKeys) {
        if (!bundle[key]) {
          throw new Error(`Missing required key: ${key}`);
        }
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post("/bundle", bundle, { headers });

      return {
        success: true,
        message: response.data.message || "Key bundle uploaded successfully",
        bundle_id: response.data.bundle_id,
      };
    } catch (error) {
      console.error("[Key API] Upload bundle error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ ENHANCED: Get key bundle for a user
   */
  async getBundle(userId, token = null) {
    try {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get(`/bundle/${userId}`, { headers });

      return {
        success: true,
        bundle: response.data.bundle || response.data.data,
      };
    } catch (error) {
      console.error("[Key API] Get bundle error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get bundles for multiple users
   */
  async getBundles(userIds, token = null) {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new Error("Array of user IDs is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/bundles",
        { user_ids: userIds },
        { headers }
      );

      return {
        success: true,
        bundles: response.data.bundles || {},
      };
    } catch (error) {
      console.error("[Key API] Get bundles error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Rotate pre-keys
   */
  async rotatePreKeys(newPreKeys, token = null) {
    try {
      if (!Array.isArray(newPreKeys) || newPreKeys.length === 0) {
        throw new Error("Array of new pre-keys is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/rotate",
        { pre_keys: newPreKeys },
        { headers }
      );

      return {
        success: true,
        message: response.data.message || "Pre-keys rotated successfully",
      };
    } catch (error) {
      console.error("[Key API] Rotate keys error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Delete key bundle (logout/reset)
   */
  async deleteBundle(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete("/bundle", { headers });

      return {
        success: true,
        message: response.data.message || "Key bundle deleted successfully",
      };
    } catch (error) {
      console.error("[Key API] Delete bundle error:", error.message);
      throw error;
    }
  },
};

export default keyApi;
