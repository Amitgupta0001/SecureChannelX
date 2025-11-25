// FILE: src/hooks/useSocket.js
import { useEffect, useState, useCallback } from "react";
import { useSocket as useSocketContext } from "../context/SocketContext";

/**
 * useSocket()
 * A convenience hook over SocketContext providing:
 * - socket instance
 * - isConnected flag
 * - safeEmit wrapper
 * - connection status tracking
 * - event subscription helpers
 */
export default function useSocket(events = {}) {
  const { socket, isConnected, safeEmit } = useSocketContext();
  const [connected, setConnected] = useState(isConnected);

  /* ----------------------------------------------------
     UPDATE LOCAL CONNECTED STATE
  ----------------------------------------------------- */
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected]);

  /* ----------------------------------------------------
     REGISTER PROVIDED EVENT HANDLERS
     events = { "message:new": fn, "typing:started": fn }
  ----------------------------------------------------- */
  useEffect(() => {
    if (!socket) return;

    // register all handlers
    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      // cleanup all handlers
      Object.entries(events).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, events]);

  /* ----------------------------------------------------
     WRAPPED EMIT
  ----------------------------------------------------- */
  const emit = useCallback(
    (event, data = {}) => {
      if (!socket || !connected) {
        console.warn(`emit skipped (socket unavailable): ${event}`);
        return;
      }

      try {
        safeEmit(event, data);
      } catch (err) {
        console.error("emit error:", err);
      }
    },
    [socket, connected, safeEmit]
  );

  /* ----------------------------------------------------
     HOOK RETURN OBJECT
  ----------------------------------------------------- */
  return {
    socket,
    emit,
    connected,
    isConnected: connected,
  };
}
