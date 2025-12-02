/**
 * Global constants for SecureChannelX frontend
 * @module utils/constants
 */

/* ========================================
   API CONFIGURATION
======================================== */
export const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5050";
export const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:5050";

/* ========================================
   APP METADATA
======================================== */
export const APP_NAME = import.meta.env.VITE_APP_NAME || "SecureChannelX";
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0";

/* ========================================
   STORAGE KEYS
======================================== */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  USER_ID: "uid",
  USERNAME: "username",
  PRIVATE_KEY: "scx_private_key",
  PUBLIC_KEY: "scx_public_key",
  SESSION_KEY: "scx_session_key",
  DEVICE_ID: "scx_device_id",
  THEME: "scx_theme",
  LAST_SYNC: "scx_last_sync",
};

/* ========================================
   ENCRYPTION CONFIGURATION
======================================== */
export const ENCRYPTION = {
  ALGORITHM: "AES-GCM",
  KEY_LENGTH: 256,
  IV_LENGTH: 12,
  TAG_LENGTH: 128,
  SALT_LENGTH: 16,
  ITERATIONS: 100000,
  HASH: "SHA-256",
};

/* ========================================
   WEBRTC CONFIGURATION
======================================== */
export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    {
      urls: import.meta.env.VITE_TURN_SERVER || "turn:turn.example.com:3478",
      username: import.meta.env.VITE_TURN_USERNAME || "",
      credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

/* ========================================
   MEDIA CONSTRAINTS
======================================== */
export const MEDIA_CONSTRAINTS = {
  VIDEO: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: "user",
  },
  AUDIO: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
  },
  SCREEN_SHARE: {
    video: {
      cursor: "always",
      displaySurface: "monitor",
    },
    audio: false,
  },
};

/* ========================================
   FILE UPLOAD LIMITS
======================================== */
export const FILE_LIMITS = {
  MAX_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_SIZE_IMAGE: 10 * 1024 * 1024, // 10 MB
  MAX_SIZE_VIDEO: 100 * 1024 * 1024, // 100 MB
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  ALLOWED_VIDEO_TYPES: ["video/mp4", "video/webm", "video/quicktime"],
  ALLOWED_AUDIO_TYPES: ["audio/mpeg", "audio/wav", "audio/ogg"],
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
};

/* ========================================
   MESSAGE TYPES
======================================== */
export const MESSAGE_TYPE = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  FILE: "file",
  LOCATION: "location",
  CONTACT: "contact",
  POLL: "poll",
  SYSTEM: "system",
  DELETED: "deleted",
};

/* ========================================
   CHAT TYPES
======================================== */
export const CHAT_TYPE = {
  PRIVATE: "private",
  GROUP: "group",
  CHANNEL: "channel",
};

/* ========================================
   CALL TYPES
======================================== */
export const CALL_TYPE = {
  AUDIO: "audio",
  VIDEO: "video",
};

/* ========================================
   USER STATUS
======================================== */
export const USER_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  AWAY: "away",
  BUSY: "busy",
};

/* ========================================
   NOTIFICATION TYPES
======================================== */
export const NOTIFICATION_TYPE = {
  MESSAGE: "message",
  CALL: "call",
  FRIEND_REQUEST: "friend_request",
  GROUP_INVITE: "group_invite",
  SYSTEM: "system",
};

/* ========================================
   SOCKET EVENTS
======================================== */
export const SOCKET_EVENTS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  ERROR: "error",
  
  MESSAGE_NEW: "message:new",
  MESSAGE_SEEN: "message:seen",
  MESSAGE_DELETED: "message:deleted",
  MESSAGE_EDITED: "message:edited",
  
  TYPING_START: "typing:started",
  TYPING_STOP: "typing:stopped",
  
  CALL_INCOMING: "call:incoming",
  CALL_OFFER: "call:offer",
  CALL_ANSWER: "call:answer",
  CALL_ICE: "call:ice",
  CALL_ENDED: "call:ended",
  
  CHAT_CREATED: "chat:created",
  CHAT_UPDATED: "chat:updated",
  CHAT_DELETED: "chat:deleted",
  
  USER_ONLINE: "user:online",
  USER_OFFLINE: "user:offline",
};

/* ========================================
   REGEX PATTERNS
======================================== */
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
};

/* ========================================
   TIMEOUTS & INTERVALS
======================================== */
export const TIMEOUTS = {
  API_TIMEOUT: 10000, // 10s
  SOCKET_TIMEOUT: 12000, // 12s
  TYPING_INDICATOR: 3000, // 3s
  DEBOUNCE: 300, // 300ms
  THROTTLE: 500, // 500ms
  TOAST_DURATION: 3000, // 3s
};

/* ========================================
   PAGINATION
======================================== */
export const PAGINATION = {
  MESSAGES_PER_PAGE: 50,
  CHATS_PER_PAGE: 20,
  USERS_PER_PAGE: 30,
  SEARCH_RESULTS: 20,
};

/* ========================================
   ERROR CODES
======================================== */
export const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500,
  NETWORK_ERROR: 0,
};

/* ========================================
   FEATURE FLAGS
======================================== */
export const FEATURES = {
  E2E_ENCRYPTION: true,
  VIDEO_CALLS: true,
  VOICE_CALLS: true,
  FILE_SHARING: true,
  SCREEN_SHARING: true,
  POLLS: true,
  REACTIONS: true,
  MESSAGE_EDITING: true,
  MESSAGE_DELETION: true,
  READ_RECEIPTS: true,
  TYPING_INDICATORS: true,
};

/* ========================================
   EMOJI SETS
======================================== */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

export const STATUS_EMOJIS = {
  AVAILABLE: "🟢",
  BUSY: "🔴",
  AWAY: "🟡",
  OFFLINE: "⚫",
};
