// FILE: src/utils/constants.js
// Global constants used across SecureChannelX frontend.

/* ---------------------------------------------------------
   BASE URLs (API + SOCKET)
--------------------------------------------------------- */
export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:5050";

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:5050";

/* ---------------------------------------------------------
   STORAGE KEYS (localStorage)
--------------------------------------------------------- */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "access_token",
  USER_DATA: "user_data",
  DEVICE_ID: "device_id",
  ENCRYPTION_KEY: "encryption_key",
  PUSH_TOKEN: "push_token",
};

/* ---------------------------------------------------------
   MESSAGE TYPES
--------------------------------------------------------- */
export const MESSAGE_TYPES = {
  TEXT: "text",
  FILE: "file",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  POLL: "poll",
  SYSTEM: "system",
  ENCRYPTED: "encrypted",
};

/* ---------------------------------------------------------
   REACTIONS SUPPORTED
--------------------------------------------------------- */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "😢", "👏"];

/* ---------------------------------------------------------
   TYPING INDICATOR CONFIG
--------------------------------------------------------- */
export const TYPING = {
  TIMEOUT: 1500, // stop typing after 1.5s inactivity
  DEBOUNCE: 300, // delay before sending typing:start
};

/* ---------------------------------------------------------
   MESSAGE PAGINATION
--------------------------------------------------------- */
export const MESSAGE_LIMIT = 50;

/* ---------------------------------------------------------
   WEBRTC CONFIGURATION
--------------------------------------------------------- */
export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: import.meta.env.VITE_TURN_SERVER || "",
      username: import.meta.env.VITE_TURN_USERNAME || "",
      credential: import.meta.env.VITE_TURN_PASSWORD || "",
    },
  ],
};

/* ---------------------------------------------------------
   E2E ENCRYPTION CONSTANTS
--------------------------------------------------------- */
export const E2E = {
  KEY_SIZE: 32, // AES-256
  IV_SIZE: 12,  // AES-GCM recommended size
  ROTATE_INTERVAL: 3600000, // rotate every 1 hour
};

/* ---------------------------------------------------------
   SYSTEM EVENT CODES (these match backend)
--------------------------------------------------------- */
export const SYSTEM_EVENTS = {
  USER_ADDED: "user_added",
  USER_REMOVED: "user_removed",
  GROUP_CREATED: "group_created",
  GROUP_UPDATED: "group_updated",
  GROUP_DELETED: "group_deleted",
};
