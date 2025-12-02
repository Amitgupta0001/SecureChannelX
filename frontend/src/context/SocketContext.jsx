// FILE: src/context/SocketContext.jsx
// FINAL FIXED VERSION — SecureChannelX

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import io from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
};

export const SocketProvider = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const socketRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const eventQueueRef = useRef([]);

  /* ============================================================
     SAFE EMIT + QUEUE
  ============================================================ */
  const safeEmit = useCallback(
    (event, payload = {}) => {
      if (!socketRef.current || !socketRef.current.connected) {
        console.warn(`📮 Queueing offline event: ${event}`);
        eventQueueRef.current.push({ event, payload });
        return false;
      }

      try {
        socketRef.current.emit(event, payload);
        return true;
      } catch (err) {
        console.error(`❌ Emit error (${event}):`, err);
        return false;
      }
    },
    []
  );

  const processEventQueue = useCallback(() => {
    if (!socketRef.current?.connected) return;
    if (eventQueueRef.current.length === 0) return;

    console.log(`📦 Processing ${eventQueueRef.current.length} queued events`);

    const queue = [...eventQueueRef.current];
    eventQueueRef.current = [];

    queue.forEach(({ event, payload }) => {
      safeEmit(event, payload);
    });
  }, [safeEmit]);

  /* ============================================================
     HEARTBEAT
  ============================================================ */
  const startHeartbeat = useCallback(() => {
    clearInterval(heartbeatIntervalRef.current);

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("ping", { timestamp: Date.now() });
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    clearInterval(heartbeatIntervalRef.current);
  }, []);

  /* ============================================================
     CREATE SOCKET — FIXED (removed duplicate assignments)
  ============================================================ */
  const createSocket = useCallback(() => {
    if (!isAuthenticated || !token) {
      console.log("⚠️ Not authenticated — socket not created");
      return null;
    }

    try {
      const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5050";
      const socket = io(SOCKET_URL, {
        withCredentials: true,
        auth: { token: localStorage.getItem("token") },
        transports: ["polling","websocket"],
      });

      /* ------------------ CONNECTION EVENTS ------------------ */

      socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
        socketRef.current = socket;
        setSocket(socket);
        setIsConnected(true);
        setConnectionState("connected");
        setReconnectAttempt(0);
        startHeartbeat();
        processEventQueue();
      });

      socket.on("disconnect", (reason) => {
        console.log("🔌 Disconnected:", reason);
        setIsConnected(false);
        setConnectionState("disconnected");
        stopHeartbeat();
      });

      socket.on("connect_error", (err) => {
        console.error("❌ Socket connect error:", err?.message);
        setConnectionState("reconnecting");
      });

      socket.on("reconnect_attempt", (n) => {
        console.log("🔄 Reconnect attempt:", n);
        setReconnectAttempt(n);
        setConnectionState("reconnecting");
      });

      socket.on("reconnect", () => {
        console.log("🟢 Reconnected");
        setConnectionState("connected");
        processEventQueue();
      });

      socket.on("pong", (data) => {
        const latency = Date.now() - data.timestamp;
        console.log(`💓 Heartbeat latency: ${latency}ms`);
      });

      return socket;
    } catch (error) {
      console.error("❌ Failed to create socket:", error);
      return null;
    }
  }, [token, isAuthenticated, startHeartbeat, processEventQueue, stopHeartbeat]);

  /* ============================================================
     INITIALIZE SOCKET — FIXED with better duplicate prevention
  ============================================================ */
  const initializeSocket = useCallback(() => {
    // prevents double initialization with better checks
    if (socketRef.current && (socketRef.current.connected || socketRef.current.connecting)) {
      console.log("⚠️ Socket already initialized and active");
      return;
    }
    
    // Clean up any existing socket before creating new one
    if (socketRef.current) {
      console.log("🧹 Cleaning up existing socket before reinitialization");
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
    
    createSocket();
  }, [createSocket]);

  /* ============================================================
     NETWORK STATUS
  ============================================================ */
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (!socketRef.current) initializeSocket();
    };

    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [initializeSocket]);

  /* ============================================================
     AUTH CHANGE → INITIALIZE SOCKET with proper cleanup
  ============================================================ */
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Clean up socket if user logs out
      if (socketRef.current) {
        console.log("🚪 User logged out - cleaning up socket");
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        stopHeartbeat();
      }
      return;
    }

    const timer = setTimeout(() => {
      initializeSocket();
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthenticated, user, initializeSocket, stopHeartbeat]);

  /* ============================================================
     CLEANUP ON UNMOUNT
  ============================================================ */
  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      if (socketRef.current) {
        console.log("🧹 SocketProvider unmounting - cleanup");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  /* ============================================================
     MANUAL CONTROLS
  ============================================================ */
  const reconnect = () => {
    if (socketRef.current) socketRef.current.connect();
    else initializeSocket();
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    setIsConnected(false);
  };

  /* ============================================================
     PROVIDER
  ============================================================ */
  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionState,
        reconnectAttempt,
        isOnline,
        safeEmit,
        reconnect,
        disconnect,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;