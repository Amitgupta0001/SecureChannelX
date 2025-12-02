/**
 * ✅ ENHANCED: SecureChannelX - Notifications API
 * -----------------------------------------------
 * Push notifications and in-app notification management
 * 
 * Changes:
 *   - Fixed: API URL to port 5050
 *   - Added: Axios instance with interceptors
 *   - Added: Automatic token injection
 *   - Added: Comprehensive error handling
 *   - Added: Input validation
 *   - Added: Get all notifications
 *   - Added: Mark notification as read
 *   - Added: Delete notification
 *   - Added: Clear all notifications
 *   - Added: Notification preferences
 *   - Enhanced: Push subscription handling
 * 
 * Compatibility:
 *   - Backend API: ✅ Port 5050
 *   - Authentication: ✅ JWT Bearer tokens
 *   - Web Push: ✅ VAPID support
 *   - Service Worker: ✅ Compatible
 */

import axios from "axios";

// ============================================================
//                   CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
const API_TIMEOUT = 30000; // 30 seconds

// ✅ ENHANCEMENT: Create axios instance
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
    if (!config.headers.Authorization) {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[Notifications API] ${config.method.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error("[Notifications API] Request error:", error);
    return Promise.reject(error);
  }
);

// ============================================================
//                   RESPONSE INTERCEPTOR
// ============================================================

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response } = error;

    if (response) {
      const { status, data } = response;

      switch (status) {
        case 401:
          console.error("❌ [Notifications API] Unauthorized");
          if (typeof window !== "undefined") {
            localStorage.removeItem("access_token");
            window.location.href = "/login";
          }
          break;

        case 403:
          console.error("❌ [Notifications API] Forbidden:", data.message);
          break;

        case 404:
          console.error("❌ [Notifications API] Not found:", data.message);
          break;

        case 429:
          console.error("❌ [Notifications API] Rate limited");
          break;

        case 500:
          console.error("❌ [Notifications API] Server error:", data.message);
          break;

        default:
          console.error(`❌ [Notifications API] Error (${status}):`, data.message);
      }
    } else if (error.request) {
      console.error("❌ [Notifications API] Network error");
    } else {
      console.error("❌ [Notifications API] Request error:", error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================================
//                   VALIDATION HELPERS
// ============================================================

const validatePushToken = (token) => {
  if (!token || typeof token !== "string") {
    throw new Error("Valid push token is required");
  }
  return true;
};

const validateNotificationId = (notificationId) => {
  if (!notificationId || typeof notificationId !== "string") {
    throw new Error("Valid notification ID is required");
  }
  return true;
};

// ============================================================
//                   NOTIFICATIONS API
// ============================================================

const notificationsApi = {
  // ============================================================
  //                   PUSH TOKEN MANAGEMENT
  // ============================================================

  /**
   * ✅ ENHANCED: Register push notification token
   * 
   * @param {string} pushToken - FCM/VAPID push token
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async registerPushToken(pushToken, token = null) {
    try {
      validatePushToken(pushToken);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/notifications/register_token",
        { token: pushToken },
        { headers }
      );

      return {
        success: true,
        message: response.data.message || "Push token registered successfully",
      };
    } catch (error) {
      console.error("[Notifications API] Register token error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Unregister push notification token
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async unregisterPushToken(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete("/api/notifications/register_token", { headers });

      return {
        success: true,
        message: response.data.message || "Push token unregistered successfully",
      };
    } catch (error) {
      console.error("[Notifications API] Unregister token error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   NOTIFICATION MANAGEMENT
  // ============================================================

  /**
   * ✅ NEW: Get all notifications for current user
   * 
   * @param {object} [options] - Query options
   * @param {number} [options.limit=50] - Number of notifications
   * @param {number} [options.skip=0] - Number to skip
   * @param {boolean} [options.unreadOnly=false] - Get only unread
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, notifications, unread_count }
   */
  async getNotifications(options = {}, token = null) {
    try {
      const { limit = 50, skip = 0, unreadOnly = false } = options;

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams({
        limit: limit.toString(),
        skip: skip.toString(),
        ...(unreadOnly && { unread_only: "true" }),
      });

      const response = await api.get(`/api/notifications?${params}`, { headers });

      return {
        success: true,
        notifications: response.data.notifications || [],
        unread_count: response.data.unread_count || 0,
        has_more: response.data.has_more || false,
      };
    } catch (error) {
      console.error("[Notifications API] Get notifications error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Mark notification as read
   * 
   * @param {string} notificationId - Notification ID
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async markAsRead(notificationId, token = null) {
    try {
      validateNotificationId(notificationId);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.patch(
        `/api/notifications/${notificationId}/read`,
        {},
        { headers }
      );

      return {
        success: true,
        message: response.data.message || "Notification marked as read",
      };
    } catch (error) {
      console.error("[Notifications API] Mark as read error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Mark all notifications as read
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message, marked_count }
   */
  async markAllAsRead(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post("/api/notifications/read_all", {}, { headers });

      return {
        success: true,
        message: response.data.message || "All notifications marked as read",
        marked_count: response.data.marked_count || 0,
      };
    } catch (error) {
      console.error("[Notifications API] Mark all as read error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Delete a notification
   * 
   * @param {string} notificationId - Notification ID
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async deleteNotification(notificationId, token = null) {
    try {
      validateNotificationId(notificationId);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete(`/api/notifications/${notificationId}`, { headers });

      return {
        success: true,
        message: response.data.message || "Notification deleted",
      };
    } catch (error) {
      console.error("[Notifications API] Delete notification error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Clear all notifications
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message, deleted_count }
   */
  async clearAll(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete("/api/notifications/clear_all", { headers });

      return {
        success: true,
        message: response.data.message || "All notifications cleared",
        deleted_count: response.data.deleted_count || 0,
      };
    } catch (error) {
      console.error("[Notifications API] Clear all error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   ADMIN FUNCTIONS
  // ============================================================

  /**
   * ✅ ENHANCED: Send notification (admin/dev only)
   * 
   * @param {string} userId - Target user ID
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {object} [data] - Additional data
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, message }
   */
  async sendNotification(userId, title, body, data = {}, token = null) {
    try {
      if (!userId || !title || !body) {
        throw new Error("User ID, title, and body are required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/notifications/send",
        {
          user_id: userId,
          title,
          body,
          data,
        },
        { headers }
      );

      return {
        success: true,
        message: response.data.message || "Notification sent successfully",
      };
    } catch (error) {
      console.error("[Notifications API] Send notification error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   NOTIFICATION PREFERENCES
  // ============================================================

  /**
   * ✅ NEW: Get notification preferences
   * 
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, preferences }
   */
  async getPreferences(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/notifications/preferences", { headers });

      return {
        success: true,
        preferences: response.data.preferences || {},
      };
    } catch (error) {
      console.error("[Notifications API] Get preferences error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Update notification preferences
   * 
   * @param {object} preferences - Notification preferences
   * @param {boolean} [preferences.message_notifications] - Message notifications
   * @param {boolean} [preferences.mention_notifications] - Mention notifications
   * @param {boolean} [preferences.group_notifications] - Group notifications
   * @param {boolean} [preferences.call_notifications] - Call notifications
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { success, preferences }
   */
  async updatePreferences(preferences, token = null) {
    try {
      if (!preferences || typeof preferences !== "object") {
        throw new Error("Valid preferences object is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.put(
        "/api/notifications/preferences",
        preferences,
        { headers }
      );

      return {
        success: true,
        preferences: response.data.preferences,
        message: response.data.message || "Preferences updated successfully",
      };
    } catch (error) {
      console.error("[Notifications API] Update preferences error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   WEB PUSH HELPERS
  // ============================================================

  /**
   * ✅ ENHANCED: Subscribe to push notifications
   * 
   * @param {ServiceWorkerRegistration} serviceWorkerReg - Service worker registration
   * @returns {Promise<PushSubscription|null>} - Push subscription or null
   */
  async subscribeToPushNotifications(serviceWorkerReg) {
    try {
      if (!("PushManager" in window)) {
        console.warn("⚠️ Push notifications are not supported in this browser");
        return null;
      }

      if (!serviceWorkerReg) {
        console.error("❌ Service worker registration is required");
        return null;
      }

      // Get VAPID public key from environment
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        console.error("❌ VAPID public key not configured");
        return null;
      }

      console.log("🔔 Subscribing to push notifications...");

      // Check if already subscribed
      const existingSubscription = await serviceWorkerReg.pushManager.getSubscription();
      if (existingSubscription) {
        console.log("✅ Already subscribed to push notifications");
        return existingSubscription;
      }

      // Subscribe to push notifications
      const subscription = await serviceWorkerReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      console.log("✅ Push notification subscription successful");

      // Register subscription with backend
      await this.registerPushToken(JSON.stringify(subscription));

      return subscription;
    } catch (error) {
      console.error("❌ Push subscription failed:", error);
      return null;
    }
  },

  /**
   * ✅ NEW: Unsubscribe from push notifications
   * 
   * @param {ServiceWorkerRegistration} serviceWorkerReg - Service worker registration
   * @returns {Promise<boolean>} - Success status
   */
  async unsubscribeFromPushNotifications(serviceWorkerReg) {
    try {
      if (!("PushManager" in window) || !serviceWorkerReg) {
        return false;
      }

      const subscription = await serviceWorkerReg.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await this.unregisterPushToken();
        console.log("✅ Unsubscribed from push notifications");
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Unsubscribe failed:", error);
      return false;
    }
  },

  /**
   * ✅ NEW: Check if push notifications are supported
   * 
   * @returns {boolean} - True if supported
   */
  isPushSupported() {
    return "PushManager" in window && "serviceWorker" in navigator;
  },

  /**
   * ✅ NEW: Check push notification permission
   * 
   * @returns {NotificationPermission} - "granted", "denied", or "default"
   */
  getPermissionState() {
    if (!("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  },

  /**
   * ✅ NEW: Request push notification permission
   * 
   * @returns {Promise<NotificationPermission>} - Permission result
   */
  async requestPermission() {
    try {
      if (!("Notification" in window)) {
        console.warn("⚠️ Notifications not supported");
        return "denied";
      }

      if (Notification.permission === "granted") {
        return "granted";
      }

      if (Notification.permission === "denied") {
        console.warn("⚠️ Notification permission denied");
        return "denied";
      }

      const permission = await Notification.requestPermission();
      console.log(`🔔 Notification permission: ${permission}`);
      return permission;
    } catch (error) {
      console.error("❌ Permission request failed:", error);
      return "denied";
    }
  },

  // ============================================================
  //                   UTILITY METHODS
  // ============================================================

  /**
   * ✅ HELPER: Convert VAPID key from base64 to Uint8Array
   * 
   * @param {string} base64String - Base64 encoded VAPID key
   * @returns {Uint8Array} - Uint8Array for push subscription
   */
  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  },

  /**
   * ✅ NEW: Format notification for display
   * 
   * @param {object} notification - Notification object
   * @returns {object} - Formatted notification
   */
  formatNotification(notification) {
    if (!notification) return null;

    return {
      id: notification.notification_id || notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type || "info",
      is_read: notification.is_read || false,
      created_at: notification.created_at,
      data: notification.data || {},
    };
  },

  /**
   * ✅ NEW: Get notification icon based on type
   * 
   * @param {string} type - Notification type
   * @returns {string} - Icon emoji or path
   */
  getNotificationIcon(type) {
    const icons = {
      message: "💬",
      mention: "🔔",
      call: "📞",
      group: "👥",
      system: "⚙️",
      warning: "⚠️",
      error: "❌",
      success: "✅",
      info: "ℹ️",
    };

    return icons[type] || icons.info;
  },
};

// ============================================================
//                   EXPORT
// ============================================================

export default notificationsApi;
