// FILE: src/utils/errorLogger.js

import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5050";

/* ---------------------------------------------------------
   DEVICE + CONTEXT INFO
--------------------------------------------------------- */
const getDeviceInfo = () => {
  const connection = navigator.connection || navigator.webkitConnection || null;

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    online: navigator.onLine,
    connection: connection
      ? {
          type: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
        }
      : null,
  };
};

/* ---------------------------------------------------------
   SAFELY STRINGIFY ERROR OBJECT
--------------------------------------------------------- */
const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
};

/* ---------------------------------------------------------
   ERROR LOGGER MODULE
--------------------------------------------------------- */

let cooldownActive = false; // prevents spamming server

export default {
  /* MAIN LOGGER */
  async logError(errorData) {
    if (cooldownActive) return; // avoid server spam from loops

    try {
      cooldownActive = true;
      setTimeout(() => (cooldownActive = false), 3000); // 3s cooldown

      const payload = {
        ...errorData,
        timestamp: new Date().toISOString(),
        device: getDeviceInfo(),
      };

      await axios.post(`${API}/security/log-client-error`, payload, {
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("access_token")
            ? { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
            : {}),
        },
      });
    } catch (err) {
      console.warn("Client error logging failed:", err?.message || err);
    }
  },

  /* CAUGHT EXCEPTIONS */
  async logException(error, extra = {}) {
    await this.logError({
      type: "exception",
      message: error?.message,
      stack: error?.stack,
      raw: safeStringify(error),
      ...extra,
    });
  },

  /* UNHANDLED REJECTIONS */
  async logPromiseRejection(reason) {
    await this.logError({
      type: "unhandled_rejection",
      reason:
        reason instanceof Error ? reason.message : safeStringify(reason),
      stack: reason?.stack,
    });
  },

  /* OPTIONAL: ATTACH GLOBAL LISTENERS */
  attachGlobalHandlers() {
    window.onerror = (msg, src, line, col, error) => {
      this.logException(error || msg, {
        source: src,
        line,
        col,
      });
    };

    window.onunhandledrejection = (event) => {
      this.logPromiseRejection(event.reason);
    };
  },
};
