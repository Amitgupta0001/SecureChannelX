// FILE: src/context/SocketContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
};

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionKey, setSessionKey] = useState(null);

  /* ===========================================================
     SAFE EMIT (Prevents crashes, ensures backend compatibility)
  ============================================================ */
  const safeEmit = useCallback(
    (event, payload = {}) => {
      if (!socket || !isConnected) {
        console.warn("Emit skipped — socket not ready:", event);
        return;
      }

      try {
        socket.emit(event, payload);
      } catch (err) {
        console.error("safeEmit error:", event, payload, err);
      }
    },
    [socket, isConnected]
  );

  /* ===========================================================
     CONNECT TO BACKEND SOCKET
  ============================================================ */
  useEffect(() => {
    if (!user || !token) {
      if (socket) socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const newSocket = io(import.meta.env.VITE_WS_URL || "http://localhost:5050", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 800,
      timeout: 20000,
    });

    /* --- CONNECTION EVENTS --- */
    newSocket.on("connect", () => {
      console.log("🔌 SecureChannelX WebSocket Connected");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket Disconnected");
      setIsConnected(false);
    });

    /* --- SECURITY EVENTS --- */
    newSocket.on("error", (err) => {
      console.error("⚠️ Socket Error:", err);
    });

    newSocket.on("unauthorized", () => {
      console.error("❌ Invalid token - forcing logout");
    });

    newSocket.on("session_key", ({ key }) => {
      console.log("🔑 Session key received");
      setSessionKey(key);
    });

    newSocket.on("session_key_rotated", ({ new_key }) => {
      console.log("♻️ Session key rotated");
      setSessionKey(new_key);
    });

    setSocket(newSocket);

    /* --- CLEANUP --- */
    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, sessionKey, safeEmit }}>
      {children}
    </SocketContext.Provider>
  );
};
