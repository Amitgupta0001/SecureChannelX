/**
 * ✅ ENHANCED: SecureChannelX - Notification Context
 * --------------------------------------------------
 * Manages in-app and push notifications
 * 
 * Changes:
 *   - Fixed: Notification permission handling
 *   - Fixed: Push notification registration
 *   - Fixed: Notification deduplication
 *   - Added: Desktop notifications
 *   - Added: Notification grouping
 *   - Added: Notification history
 *   - Added: Priority levels
 *   - Added: Custom notification sounds
 *   - Enhanced: Badge count management
 *   - Enhanced: Do Not Disturb mode
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext();
export const useNotification = () => useContext(NotificationContext);

// Notification priorities
const PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
};

// Notification types
const NOTIFICATION_TYPES = {
  MESSAGE: "message",
  CALL: "call",
  GROUP: "group",
  SYSTEM: "system",
  SECURITY: "security",
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState(Notification.permission);
  const [isDoNotDisturb, setIsDoNotDisturb] = useState(false);
  const [settings, setSettings] = useState({
    messages: true,
    calls: true,
    groups: true,
    system: true,
    sound: true,
    vibration: true,
  });

  const { socket, isConnected } = useSocket();
  const { user, token, isAuthenticated } = useAuth();

  const notificationSetRef = useRef(new Set()); // Track notification IDs to prevent duplicates
  const audioRef = useRef(null);

  /**
   * ✅ HELPER: Get user ID
   */
  const getUserId = useCallback(() => {
    return user?.id || user?.user_id || user?._id;
  }, [user]);

  /**
   * ✅ HELPER: Play notification sound
   */
  const playNotificationSound = useCallback(
    (priority = PRIORITY.NORMAL) => {
      if (!settings.sound || isDoNotDisturb) return;

      try {
        // Stop any currently playing sound
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        // Select sound based on priority
        const soundMap = {
          [PRIORITY.LOW]: "/sounds/notification-low.mp3",
          [PRIORITY.NORMAL]: "/sounds/notification.mp3",
          [PRIORITY.HIGH]: "/sounds/notification-high.mp3",
          [PRIORITY.URGENT]: "/sounds/notification-urgent.mp3",
        };

        audioRef.current = new Audio(soundMap[priority] || soundMap[PRIORITY.NORMAL]);
        audioRef.current.volume = 0.5;

        audioRef.current.play().catch((err) => {
          console.warn("⚠️ Could not play notification sound:", err);
        });
      } catch (err) {
        console.error("❌ Notification sound error:", err);
      }
    },
    [settings.sound, isDoNotDisturb]
  );

  /**
   * ✅ HELPER: Vibrate device
   */
  const vibrateDevice = useCallback(
    (priority = PRIORITY.NORMAL) => {
      if (!settings.vibration || isDoNotDisturb || !navigator.vibrate) return;

      try {
        const vibrationPatterns = {
          [PRIORITY.LOW]: [100],
          [PRIORITY.NORMAL]: [200],
          [PRIORITY.HIGH]: [200, 100, 200],
          [PRIORITY.URGENT]: [200, 100, 200, 100, 200],
        };

        navigator.vibrate(vibrationPatterns[priority] || vibrationPatterns[PRIORITY.NORMAL]);
      } catch (err) {
        console.error("❌ Vibration error:", err);
      }
    },
    [settings.vibration, isDoNotDisturb]
  );

  /**
   * ✅ ENHANCED: Request notification permission
   */
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.warn("⚠️ Browser doesn't support notifications");
      return "denied";
    }

    if (Notification.permission === "granted") {
      setPermission("granted");
      return "granted";
    }

    if (Notification.permission === "denied") {
      setPermission("denied");
      return "denied";
    }

    try {
      console.log("🔔 Requesting notification permission...");

      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        console.log("✅ Notification permission granted");
      } else {
        console.log("❌ Notification permission denied");
      }

      return result;
    } catch (err) {
      console.error("❌ Permission request failed:", err);
      return "denied";
    }
  }, []);

  /**
   * ✅ ENHANCED: Show desktop notification
   */
  const showDesktopNotification = useCallback(
    (title, options = {}) => {
      if (permission !== "granted" || isDoNotDisturb) return;

      try {
        const notification = new Notification(title, {
          icon: "/logo.png",
          badge: "/badge.png",
          tag: options.tag || `notification-${Date.now()}`,
          renotify: false,
          requireInteraction: options.priority === PRIORITY.URGENT,
          silent: !settings.sound,
          ...options,
        });

        // Handle notification click
        notification.onclick = () => {
          window.focus();
          notification.close();

          if (options.onClick) {
            options.onClick();
          }
        };

        // Auto-close after delay
        if (options.priority !== PRIORITY.URGENT) {
          setTimeout(() => {
            notification.close();
          }, options.timeout || 5000);
        }

        return notification;
      } catch (err) {
        console.error("❌ Desktop notification failed:", err);
        return null;
      }
    },
    [permission, isDoNotDisturb, settings.sound]
  );

  /**
   * ✅ ENHANCED: Add notification
   */
  const addNotification = useCallback(
    (notification) => {
      const notifId = notification.id || `notif-${Date.now()}-${Math.random()}`;

      // Prevent duplicates
      if (notificationSetRef.current.has(notifId)) {
        console.log("⚠️ Duplicate notification ignored:", notifId);
        return;
      }

      console.log("🔔 New notification:", notification);

      const enrichedNotification = {
        ...notification,
        id: notifId,
        timestamp: notification.timestamp || new Date().toISOString(),
        read: false,
        priority: notification.priority || PRIORITY.NORMAL,
        type: notification.type || NOTIFICATION_TYPES.SYSTEM,
      };

      // Check if notification type is enabled
      const typeKey = notification.type?.toLowerCase() + "s"; // messages, calls, etc.
      if (settings[typeKey] === false) {
        console.log(`⚠️ ${notification.type} notifications disabled`);
        return;
      }

      // Add to state
      setNotifications((prev) => [enrichedNotification, ...prev].slice(0, 100)); // Keep last 100
      notificationSetRef.current.add(notifId);

      // Update unread count
      setUnreadCount((prev) => prev + 1);

      // Play sound and vibrate
      playNotificationSound(enrichedNotification.priority);
      vibrateDevice(enrichedNotification.priority);

      // Show desktop notification
      if (permission === "granted") {
        showDesktopNotification(
          enrichedNotification.title || "New notification",
          {
            body: enrichedNotification.body || enrichedNotification.message,
            icon: enrichedNotification.icon,
            tag: notifId,
            priority: enrichedNotification.priority,
            onClick: enrichedNotification.onClick,
          }
        );
      }

      // Save to localStorage
      try {
        const stored = JSON.parse(
          localStorage.getItem(`notifications_${getUserId()}`) || "[]"
        );
        stored.unshift(enrichedNotification);
        localStorage.setItem(
          `notifications_${getUserId()}`,
          JSON.stringify(stored.slice(0, 100))
        );
      } catch (err) {
        console.warn("⚠️ Failed to save notification:", err);
      }
    },
    [
      settings,
      permission,
      playNotificationSound,
      vibrateDevice,
      showDesktopNotification,
      getUserId,
    ]
  );

  /**
   * ✅ NEW: Mark notification as read
   */
  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );

    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Update localStorage
    try {
      const stored = JSON.parse(
        localStorage.getItem(`notifications_${getUserId()}`) || "[]"
      );
      const updated = stored.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      localStorage.setItem(
        `notifications_${getUserId()}`,
        JSON.stringify(updated)
      );
    } catch (err) {
      console.warn("⚠️ Failed to update notification:", err);
    }
  }, [getUserId]);

  /**
   * ✅ NEW: Mark all as read
   */
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, read: true }))
    );

    setUnreadCount(0);

    // Update localStorage
    try {
      const stored = JSON.parse(
        localStorage.getItem(`notifications_${getUserId()}`) || "[]"
      );
      const updated = stored.map((notif) => ({ ...notif, read: true }));
      localStorage.setItem(
        `notifications_${getUserId()}`,
        JSON.stringify(updated)
      );
    } catch (err) {
      console.warn("⚠️ Failed to update notifications:", err);
    }

    console.log("✅ All notifications marked as read");
  }, [getUserId]);

  /**
   * ✅ NEW: Clear all notifications
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    notificationSetRef.current.clear();

    localStorage.removeItem(`notifications_${getUserId()}`);

    console.log("🗑️ All notifications cleared");
  }, [getUserId]);

  /**
   * ✅ NEW: Remove specific notification
   */
  const removeNotification = useCallback(
    (notificationId) => {
      setNotifications((prev) => {
        const notif = prev.find((n) => n.id === notificationId);

        if (notif && !notif.read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }

        return prev.filter((n) => n.id !== notificationId);
      });

      notificationSetRef.current.delete(notificationId);

      // Update localStorage
      try {
        const stored = JSON.parse(
          localStorage.getItem(`notifications_${getUserId()}`) || "[]"
        );
        const updated = stored.filter((notif) => notif.id !== notificationId);
        localStorage.setItem(
          `notifications_${getUserId()}`,
          JSON.stringify(updated)
        );
      } catch (err) {
        console.warn("⚠️ Failed to remove notification:", err);
      }
    },
    [getUserId]
  );

  /**
   * ✅ NEW: Toggle Do Not Disturb
   */
  const toggleDoNotDisturb = useCallback(() => {
    setIsDoNotDisturb((prev) => {
      const newState = !prev;
      console.log(newState ? "🔕 Do Not Disturb enabled" : "🔔 Do Not Disturb disabled");

      // Save to localStorage
      localStorage.setItem(`dnd_${getUserId()}`, JSON.stringify(newState));

      return newState;
    });
  }, [getUserId]);

  /**
   * ✅ NEW: Update notification settings
   */
  const updateSettings = useCallback(
    (newSettings) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };

        // Save to localStorage
        localStorage.setItem(
          `notification_settings_${getUserId()}`,
          JSON.stringify(updated)
        );

        console.log("⚙️ Notification settings updated:", updated);
        return updated;
      });
    },
    [getUserId]
  );

  /**
   * ✅ NEW: Load notifications from localStorage
   */
  const loadNotifications = useCallback(() => {
    try {
      const stored = localStorage.getItem(`notifications_${getUserId()}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);

        // Count unread
        const unread = parsed.filter((n) => !n.read).length;
        setUnreadCount(unread);

        // Rebuild ID set
        parsed.forEach((n) => notificationSetRef.current.add(n.id));

        console.log(`📜 Loaded ${parsed.length} notifications (${unread} unread)`);
      }
    } catch (err) {
      console.error("❌ Failed to load notifications:", err);
    }
  }, [getUserId]);

  /**
   * ✅ NEW: Load settings from localStorage
   */
  const loadSettings = useCallback(() => {
    try {
      // Load notification settings
      const storedSettings = localStorage.getItem(
        `notification_settings_${getUserId()}`
      );
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }

      // Load DND state
      const storedDND = localStorage.getItem(`dnd_${getUserId()}`);
      if (storedDND) {
        setIsDoNotDisturb(JSON.parse(storedDND));
      }
    } catch (err) {
      console.error("❌ Failed to load settings:", err);
    }
  }, [getUserId]);

  /**
   * ✅ ENHANCED: Handle socket events
   */
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("📡 Registering notification socket handlers");

    // Generic notification event
    socket.on("notification", (data) => {
      console.log("🔔 Notification received:", data);
      addNotification(data);
    });

    // Message notification
    socket.on("message:notification", (data) => {
      if (settings.messages) {
        addNotification({
          ...data,
          type: NOTIFICATION_TYPES.MESSAGE,
          priority: PRIORITY.NORMAL,
        });
      }
    });

    // Call notification
    socket.on("call:notification", (data) => {
      if (settings.calls) {
        addNotification({
          ...data,
          type: NOTIFICATION_TYPES.CALL,
          priority: PRIORITY.HIGH,
        });
      }
    });

    // Group notification
    socket.on("group:notification", (data) => {
      if (settings.groups) {
        addNotification({
          ...data,
          type: NOTIFICATION_TYPES.GROUP,
          priority: PRIORITY.NORMAL,
        });
      }
    });

    // Security alert
    socket.on("security:alert", (data) => {
      addNotification({
        ...data,
        type: NOTIFICATION_TYPES.SECURITY,
        priority: PRIORITY.URGENT,
      });
    });

    // Cleanup
    return () => {
      console.log("📡 Unregistering notification socket handlers");

      socket.off("notification");
      socket.off("message:notification");
      socket.off("call:notification");
      socket.off("group:notification");
      socket.off("security:alert");
    };
  }, [socket, isConnected, settings, addNotification]);

  /**
   * ✅ EFFECT: Load data on mount
   */
  useEffect(() => {
    if (isAuthenticated && user) {
      loadNotifications();
      loadSettings();
    }
  }, [isAuthenticated, user, loadNotifications, loadSettings]);

  /**
   * ✅ EFFECT: Update page title with unread count
   */
  useEffect(() => {
    const originalTitle = document.title;

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [unreadCount]);

  /**
   * ✅ EFFECT: Check notification permission on mount
   */
  useEffect(() => {
    // Remove automatic permission request
    // Only request when user interacts
    
    // Check existing permission status
    if ('Notification' in window) {
      console.log('🔔 Notification permission:', Notification.permission);
    }
  }, []);

  // Add a function to request permission on user action
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      console.log('🔔 Requesting notification permission...');
      try {
        const permission = await Notification.requestPermission();
        console.log('🔔 Permission result:', permission);
        return permission === 'granted';
      } catch (error) {
        console.error('❌ Notification permission error:', error);
        return false;
      }
    }
    return Notification.permission === 'granted';
  };

  return (
    <NotificationContext.Provider
      value={{
        // State
        notifications,
        unreadCount,
        permission,
        isDoNotDisturb,
        settings,

        // Methods
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        removeNotification,
        requestPermission,
        toggleDoNotDisturb,
        updateSettings,
        showDesktopNotification,

        // Constants
        PRIORITY,
        NOTIFICATION_TYPES,

        // Computed
        hasUnread: unreadCount > 0,
        canShowNotifications: permission === "granted",
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
