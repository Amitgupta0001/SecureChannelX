// FILE: src/sockets/socket.js
// Centralized Socket.IO client for SecureChannelX

import { io } from "socket.io-client";

let socket = null;

/* -------------------------------------------------------
   SOCKET MESSAGE QUEUE (prevent lost emits)
------------------------------------------------------- */
let emitQueue = [];
let queueInterval = null;

function startQueueProcessor() {
  if (queueInterval) return;

  queueInterval = setInterval(() => {
    if (!socket || !socket.connected) return;

    while (emitQueue.length > 0) {
      const { event, data } = emitQueue.shift();
      socket.emit(event, data);
    }
  }, 300);
}

/* -------------------------------------------------------
   CONNECT TO SOCKET SERVER
------------------------------------------------------- */
export function connectSocket() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    console.warn("Socket skipped: No auth token");
    return null;
  }

  // Prevent duplicate connections
  if (socket && socket.connected) return socket;

  const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_BASE ||
    "http://localhost:5050";

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 800,
    timeout: 10000,
  });

  /* ------------------------- CONNECTED ------------------------- */
  socket.on("connect", () => {
    console.log(`🔌 Connected to socket: ${socket.id}`);
    startQueueProcessor();
  });

  /* ----------------------- DISCONNECTED ------------------------ */
  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
  });

  /* ----------------------- CONNECTION ERROR ---------------------- */
  socket.on("connect_error", (err) => {
    console.error("⚠ Socket connection error:", err.message || err);
  });

  /* ---------------------- HEARTBEAT MONITOR ---------------------- */
  socket.on("ping", () => {
    console.log("💓 socket ping");
  });

  return socket;
}

/* -------------------------------------------------------
   SAFE EMIT — QUEUES IF OFFLINE
------------------------------------------------------- */
export function safeEmit(event, data = {}) {
  if (!socket || !socket.connected) {
    console.warn(`⚠ Socket offline → queued event: ${event}`);
    emitQueue.push({ event, data });
    return;
  }

  socket.emit(event, data);
}

/* -------------------------------------------------------
   DISCONNECT SOCKET CLEANLY
------------------------------------------------------- */
export function disconnectSocket() {
  if (socket) {
    try {
      socket.disconnect();
      console.log("🔌 Socket disconnected manually.");
    } catch {}
  }
  socket = null;
}

/* -------------------------------------------------------
   GET SOCKET INSTANCE
------------------------------------------------------- */
export function getSocket() {
  return socket;
}

export default socket;
