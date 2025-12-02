// FILE: src/socket/socket.js
// FINAL FIXED VERSION FOR SECURECHANNELX

import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5050";

// Get token safely
const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

// Reuse existing socket if HMR re-evaluates the module
const existingSocket = typeof window !== "undefined" ? window.__SCX_SOCKET : null;

export const socket = existingSocket || io(SOCKET_URL, {
  withCredentials: true,
  auth: { token: getToken() },
  transports: ["polling", "websocket"],
});

if (!existingSocket && typeof window !== "undefined") {
  window.__SCX_SOCKET = socket;
}

export function safeEmit(event, payload) {
  if (socket?.connected) {
    socket.emit(event, payload);
    return true;
  }
  console.warn(`⚠️ Socket not connected, cannot emit: ${event}`);
  return false;
}

export function closeSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
  if (typeof window !== "undefined" && window.__SCX_SOCKET) {
    delete window.__SCX_SOCKET;
  }
}

export function reconnectSocket() {
  if (socket && !socket.connected) {
    socket.connect();
  }
}

// Default export
export default socket;

// ❌ REMOVED THE CIRCULAR IMPORT:
// import socket, { safeEmit } from "@/socket/socket";