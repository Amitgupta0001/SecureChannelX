// FILE: src/utils/errorLogger.js

import axios from "axios";

/**
 * Error logging and reporting utilities
 * @module utils/errorLogger
 */

const isDevelopment = import.meta.env.DEV;
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

/* ========================================
   ERROR SEVERITY LEVELS
======================================== */
export const ERROR_SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

/* ========================================
   ERROR CATEGORIES
======================================== */
export const ERROR_CATEGORY = {
  NETWORK: "network",
  API: "api",
  SOCKET: "socket",
  CRYPTO: "crypto",
  WEBRTC: "webrtc",
  VALIDATION: "validation",
  AUTHENTICATION: "authentication",
  STORAGE: "storage",
  MEDIA: "media",
  UNKNOWN: "unknown",
};

/* ========================================
   ERROR LOGGER CLASS
======================================== */
class ErrorLogger {
  constructor() {
    this.errors = [];
    this.maxErrors = 100;
    this.listeners = new Set();
    this.reportQueue = [];
    this.isReporting = false;
    this.reportInterval = null;

    if (!isDevelopment) {
      this.startBackgroundReporting();
    }
  }

  /* ========================================
     LOGGING METHODS
  ======================================== */
  log(error, context = {}) {
    const errorEntry = this.createErrorEntry(error, context);

    this.errors.unshift(errorEntry);

    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    this.logToConsole(errorEntry);
    this.notifyListeners(errorEntry);

    if (!isDevelopment && this.shouldReport(errorEntry)) {
      this.queueForReporting(errorEntry);
    }

    return errorEntry;
  }

  createErrorEntry(error, context = {}) {
    const timestamp = new Date().toISOString();
    const id = this.generateErrorId();

    const severity = context.severity || this.determineSeverity(error, context);
    const category = context.category || this.determineCategory(context);

    return {
      id,
      timestamp,
      message: this.extractMessage(error),
      stack: this.extractStack(error),
      name: error?.name || "Error",
      category,
      severity,
      context: this.sanitizeContext(context),
      environment: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        online: navigator.onLine,
      },
      user: this.getUserInfo(),
    };
  }

  extractMessage(error) {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    if (error?.toString) return error.toString();
    return "Unknown error";
  }

  extractStack(error) {
    if (!error) return null;

    if (error.stack) {
      return error.stack
        .split("\n")
        .filter(line => !line.includes("node_modules"))
        .slice(0, 10)
        .join("\n");
    }

    return null;
  }

  determineSeverity(error, context) {
    if (context.type === "authentication" || context.type === "crypto" || error?.name === "SecurityError") {
      return ERROR_SEVERITY.CRITICAL;
    }

    if ((context.type === "api" && context.status >= 500) || context.type === "webrtc" || error?.name === "TypeError") {
      return ERROR_SEVERITY.HIGH;
    }

    if ((context.type === "api" && context.status >= 400) || context.type === "socket" || context.type === "validation") {
      return ERROR_SEVERITY.MEDIUM;
    }

    return ERROR_SEVERITY.LOW;
  }

  determineCategory(context) {
    const typeMap = {
      api: ERROR_CATEGORY.API,
      socket: ERROR_CATEGORY.SOCKET,
      crypto: ERROR_CATEGORY.CRYPTO,
      webrtc: ERROR_CATEGORY.WEBRTC,
      validation: ERROR_CATEGORY.VALIDATION,
      authentication: ERROR_CATEGORY.AUTHENTICATION,
      storage: ERROR_CATEGORY.STORAGE,
      media: ERROR_CATEGORY.MEDIA,
    };

    return typeMap[context.type] || ERROR_CATEGORY.UNKNOWN;
  }

  sanitizeContext(context) {
    const sanitized = { ...context };
    const sensitiveKeys = ["password", "token", "key", "secret", "credentials"];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  getUserInfo() {
    try {
      const userId = localStorage.getItem("uid");
      const username = localStorage.getItem("username");

      return {
        id: userId || "anonymous",
        username: username || "anonymous",
      };
    } catch {
      return { id: "anonymous", username: "anonymous" };
    }
  }

  shouldReport(errorEntry) {
    if (errorEntry.severity === ERROR_SEVERITY.LOW) return false;

    const oneMinuteAgo = Date.now() - 60000;
    const duplicate = this.errors
      .filter(e => new Date(e.timestamp).getTime() > oneMinuteAgo)
      .find(e =>
        e.id !== errorEntry.id &&
        e.message === errorEntry.message &&
        e.category === errorEntry.category
      );

    return !duplicate;
  }

  logToConsole(errorEntry) {
    if (!isDevelopment) return;

    const severityEmojis = {
      low: "ℹ️",
      medium: "⚠️",
      high: "🔴",
      critical: "🚨",
    };

    const emoji = severityEmojis[errorEntry.severity] || "❌";

    console.group(`${emoji} Error [${errorEntry.severity.toUpperCase()}] - ${errorEntry.category}`);
    console.error("Message:", errorEntry.message);
    console.log("ID:", errorEntry.id);
    console.log("Timestamp:", errorEntry.timestamp);
    if (errorEntry.stack) console.log("Stack:", errorEntry.stack);
    if (Object.keys(errorEntry.context).length > 0) console.log("Context:", errorEntry.context);
    console.groupEnd();
  }

  notifyListeners(errorEntry) {
    this.listeners.forEach(listener => {
      try {
        listener(errorEntry);
      } catch (err) {
        console.error("Listener error:", err);
      }
    });
  }

  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /* ========================================
     BACKGROUND REPORTING
  ======================================== */
  startBackgroundReporting() {
    this.reportInterval = setInterval(() => {
      this.flushReportQueue();
    }, 30000);

    console.log("📊 Background error reporting started");
  }

  queueForReporting(e) {
    this.reportQueue.push(e);

    if (e.severity === ERROR_SEVERITY.CRITICAL) this.flushReportQueue();
    if (this.reportQueue.length >= 10) this.flushReportQueue();
  }

  async flushReportQueue() {
    if (this.isReporting || this.reportQueue.length === 0) return;

    this.isReporting = true;

    try {
      const batch = [...this.reportQueue];
      this.reportQueue = [];

      await this.sendToBackend(batch);
      console.log(`📤 Reported ${batch.length} error(s)`);
    } catch (err) {
      console.error("Reporting failed:", err);
      this.reportQueue.unshift(...batch);
    } finally {
      this.isReporting = false;
    }
  }

  async sendToBackend(errors) {
    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_BASE}/errors/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ errors }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    } catch (err) {
      console.error("Backend report error:", err);
      return false;
    }
  }

  /* ========================================
     RETRIEVAL
  ======================================== */
  getErrors(filters = {}) {
    let filtered = [...this.errors];

    if (filters.category) filtered = filtered.filter(e => e.category === filters.category);
    if (filters.severity) filtered = filtered.filter(e => e.severity === filters.severity);
    if (filters.startDate) filtered = filtered.filter(e => new Date(e.timestamp) >= new Date(filters.startDate));
    if (filters.endDate) filtered = filtered.filter(e => new Date(e.timestamp) <= new Date(filters.endDate));
    if (filters.limit) filtered = filtered.slice(0, filters.limit);

    return filtered;
  }

  getErrorById(id) {
    return this.errors.find(e => e.id === id);
  }

  clearErrors() {
    const count = this.errors.length;
    this.errors = [];
    console.log(`🧹 Cleared ${count} errors`);
  }

  clearOldErrors(maxAge = 7 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    const before = this.errors.length;

    this.errors = this.errors.filter(e => new Date(e.timestamp).getTime() > cutoff);

    const removed = before - this.errors.length;
    if (removed > 0) console.log(`🧹 Removed ${removed} old errors`);
  }

  /* ========================================
     STATISTICS
  ======================================== */
  getStatistics() {
    const stats = {
      total: this.errors.length,
      bySeverity: {},
      byCategory: {},
      recent: {
        lastHour: 0,
        lastDay: 0,
        lastWeek: 0,
      },
    };

    const now = Date.now();
    const hour = 3600000;
    const day = hour * 24;
    const week = day * 7;

    this.errors.forEach(e => {
      stats.bySeverity[e.severity] = (stats.bySeverity[e.severity] || 0) + 1;
      stats.byCategory[e.category] = (stats.byCategory[e.category] || 0) + 1;

      const age = now - new Date(e.timestamp).getTime();
      if (age < hour) stats.recent.lastHour++;
      if (age < day) stats.recent.lastDay++;
      if (age < week) stats.recent.lastWeek++;
    });

    return stats;
  }

  /* ========================================
     EXPORT
  ======================================== */
  getErrorReport(filters = {}) {
    return {
      generatedAt: new Date().toISOString(),
      totalErrors: this.errors.length,
      statistics: this.getStatistics(),
      errors: this.getErrors(filters),
      environment: {
        isDevelopment,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      },
    };
  }

  exportErrors(filters = {}, filename) {
    const report = this.getErrorReport(filters);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `error-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    console.log(`📥 Exported ${report.totalErrors} errors`);
  }

  exportAsCsv(filters = {}, filename) {
    const errors = this.getErrors(filters);
    if (errors.length === 0) return console.warn("No errors to export");

    const headers = ["Timestamp", "Severity", "Category", "Message", "URL"];
    const rows = errors.map(e => [
      e.timestamp,
      e.severity,
      e.category,
      `"${e.message.replace(/"/g, '""')}"`,
      e.environment.url,
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `errors-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    console.log(`📥 Exported ${errors.length} errors as CSV`);
  }

  /* ========================================
     SUBSCRIPTIONS
  ======================================== */
  subscribe(listener, filters = {}) {
    if (typeof listener !== "function") throw new Error("Listener must be a function");

    const wrapped = (entry) => {
      if (filters.category && entry.category !== filters.category) return;
      if (filters.severity && entry.severity !== filters.severity) return;

      if (filters.minSeverity) {
        const order = ["low", "medium", "high", "critical"];
        if (order.indexOf(entry.severity) < order.indexOf(filters.minSeverity)) {
          return;
        }
      }

      listener(entry);
    };

    this.listeners.add(wrapped);
    return () => this.listeners.delete(wrapped);
  }

  /* ========================================
     CLEANUP
  ======================================== */
  destroy() {
    if (this.reportInterval) clearInterval(this.reportInterval);
    this.flushReportQueue();
    this.listeners.clear();
    console.log("🧹 ErrorLogger destroyed");
  }
}

/* ========================================
   SINGLETON
======================================== */
const logger = new ErrorLogger();

/* ========================================
   CONVENIENCE EXPORTS
======================================== */
export function logError(error, context) {
  return logger.log(error, context);
}

export function logApiError(error, endpoint, method = "GET") {
  return logger.log(error, {
    category: ERROR_CATEGORY.API,
    type: "api",
    endpoint,
    method,
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
  });
}

export function logSocketError(error, event) {
  return logger.log(error, {
    category: ERROR_CATEGORY.SOCKET,
    type: "socket",
    event,
  });
}

export function logCryptoError(error, operation) {
  return logger.log(error, {
    category: ERROR_CATEGORY.CRYPTO,
    type: "crypto",
    operation,
    severity: ERROR_SEVERITY.CRITICAL,
  });
}

export function logWebRTCError(error, operation) {
  return logger.log(error, {
    category: ERROR_CATEGORY.WEBRTC,
    type: "webrtc",
    operation,
    severity: ERROR_SEVERITY.HIGH,
  });
}

export function logValidationError(error, field, value) {
  return logger.log(error, {
    category: ERROR_CATEGORY.VALIDATION,
    type: "validation",
    field,
    value: typeof value === "string" ? value : JSON.stringify(value),
    severity: ERROR_SEVERITY.LOW,
  });
}

export function logAuthError(error, operation) {
  return logger.log(error, {
    category: ERROR_CATEGORY.AUTHENTICATION,
    type: "authentication",
    operation,
    severity: ERROR_SEVERITY.CRITICAL,
  });
}

export function logStorageError(error, key, operation) {
  return logger.log(error, {
    category: ERROR_CATEGORY.STORAGE,
    type: "storage",
    key,
    operation,
  });
}

export function logMediaError(error, device) {
  return logger.log(error, {
    category: ERROR_CATEGORY.MEDIA,
    type: "media",
    device,
    severity: ERROR_SEVERITY.MEDIUM,
  });
}

/* ========================================
   RETRIEVAL + EXPORT API
======================================== */
export const getErrorLogs = (filters) => logger.getErrors(filters);
export const getErrorById = (id) => logger.getErrorById(id);
export const getErrorStatistics = () => logger.getStatistics();
export const clearErrorLogs = () => logger.clearErrors();
export const clearOldErrorLogs = (maxAge) => logger.clearOldErrors(maxAge);
export const exportErrorReport = (filters, filename) => logger.exportErrors(filters, filename);
export const exportErrorsAsCsv = (filters, filename) => logger.exportAsCsv(filters, filename);
export const getErrorReport = (filters) => logger.getErrorReport(filters);

export const subscribeToErrors = (callback, filters) =>
  logger.subscribe(callback, filters);

/* ========================================
   GLOBAL HANDLERS
======================================== */
export function setupGlobalErrorHandlers() {
  window.addEventListener("unhandledrejection", (event) => {
    logError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
      category: ERROR_CATEGORY.UNKNOWN,
      type: "unhandledRejection",
      reason: event.reason,
      promise: event.promise,
      severity: ERROR_SEVERITY.HIGH,
    });

    if (!isDevelopment) event.preventDefault();
  });

  window.addEventListener("error", (event) => {
    logError(event.error || new Error(event.message), {
      category: ERROR_CATEGORY.UNKNOWN,
      type: "globalError",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      severity: ERROR_SEVERITY.HIGH,
    });

    if (!isDevelopment) event.preventDefault();
  });

  if (!isDevelopment) {
    const originalError = console.error;
    console.error = (...args) => {
      logError(new Error(args.join(" ")), {
        category: ERROR_CATEGORY.UNKNOWN,
        type: "consoleError",
        severity: ERROR_SEVERITY.LOW,
      });
      originalError.apply(console, args);
    };
  }

  window.addEventListener("visibilitychange", () => {
    if (document.hidden) logger.flushReportQueue();
  });

  window.addEventListener("beforeunload", () => {
    logger.flushReportQueue();
  });

  console.log("✅ Global error handlers initialized");
}

export function destroyErrorLogger() {
  logger.destroy();
}

/* ========================================
   DEFAULT EXPORT (IMPORTANT)
======================================== */
export default logger;
