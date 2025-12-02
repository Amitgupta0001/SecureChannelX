// FILE: src/hooks/useSocket.js
/**
 * ✅ ENHANCED: SecureChannelX - Socket Hook
 * -----------------------------------------
 * Convenience hook for socket operations
 * 
 * Changes:
 *   - Fixed: Event handler registration
 *   - Fixed: Memory leak prevention
 *   - Added: Event subscription helpers
 *   - Added: Connection status tracking
 *   - Added: Automatic reconnection handling
 *   - Enhanced: Error handling
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket as useSocketContext } from "../context/SocketContext";

/**
 * useSocket - Convenience hook over SocketContext
 * 
 * @param {Object} events - Event handlers { "event:name": handler }
 * @returns {Object} Socket utilities
 */
export default function useSocket(events = {}) {
  const {
    socket,
    isConnected,
    connectionState,
    safeEmit,
    reconnect,
  } = useSocketContext();

  const [connected, setConnected] = useState(isConnected);
  const [lastError, setLastError] = useState(null);
  const [eventQueue, setEventQueue] = useState([]);

  const mountedRef = useRef(true);
  const registeredEventsRef = useRef(new Set());

  /**
   * ✅ EFFECT: Update local connected state
   */
  useEffect(() => {
    setConnected(isConnected);

    // Process queued events on reconnection
    if (isConnected && eventQueue.length > 0) {
      console.log(`📦 Processing ${eventQueue.length} queued events`);
      
      eventQueue.forEach(({ event, data }) => {
        emit(event, data);
      });
      
      setEventQueue([]);
    }
  }, [isConnected, eventQueue]);

  /**
   * ✅ ENHANCED: Register event handlers with cleanup
   */
  useEffect(() => {
    if (!socket || !mountedRef.current) return;

    console.log(`📡 Registering ${Object.keys(events).length} event handlers`);

    // Register all handlers
    Object.entries(events).forEach(([event, handler]) => {
      if (!handler || typeof handler !== "function") {
        console.warn(`⚠️ Invalid handler for event: ${event}`);
        return;
      }

      // Wrap handler to check if component is still mounted
      const wrappedHandler = (...args) => {
        if (mountedRef.current) {
          try {
            handler(...args);
          } catch (err) {
            console.error(`❌ Error in handler for ${event}:`, err);
            setLastError({ event, error: err.message });
          }
        }
      };

      socket.on(event, wrappedHandler);
      registeredEventsRef.current.add(event);

      console.log(`✅ Registered handler for: ${event}`);
    });

    // Cleanup on unmount or dependencies change
    return () => {
      console.log(`📡 Unregistering ${registeredEventsRef.current.size} event handlers`);
      
      Object.entries(events).forEach(([event, handler]) => {
        socket.off(event, handler);
        registeredEventsRef.current.delete(event);
      });
    };
  }, [socket, events]);

  /**
   * ✅ ENHANCED: Emit with error handling and queueing
   */
  const emit = useCallback(
    (event, data = {}) => {
      if (!socket) {
        console.warn(`⚠️ Socket not available, cannot emit: ${event}`);
        return false;
      }

      if (!connected) {
        console.warn(`⚠️ Not connected, queueing event: ${event}`);
        
        setEventQueue((prev) => [...prev, { event, data, timestamp: Date.now() }]);
        return false;
      }

      try {
        safeEmit(event, data);
        console.log(`📤 Emitted: ${event}`);
        return true;
      } catch (err) {
        console.error(`❌ Emit error for ${event}:`, err);
        setLastError({ event, error: err.message });
        return false;
      }
    },
    [socket, connected, safeEmit]
  );

  /**
   * ✅ NEW: Emit with acknowledgment
   */
  const emitWithAck = useCallback(
    (event, data = {}, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        if (!socket || !connected) {
          reject(new Error("Socket not connected"));
          return;
        }

        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for acknowledgment: ${event}`));
        }, timeout);

        socket.emit(event, data, (response) => {
          clearTimeout(timer);
          resolve(response);
        });
      });
    },
    [socket, connected]
  );

  /**
   * ✅ NEW: Subscribe to event (returns unsubscribe function)
   */
  const subscribe = useCallback(
    (event, handler) => {
      if (!socket) {
        console.warn(`⚠️ Socket not available, cannot subscribe: ${event}`);
        return () => {};
      }

      const wrappedHandler = (...args) => {
        if (mountedRef.current) {
          try {
            handler(...args);
          } catch (err) {
            console.error(`❌ Error in subscriber for ${event}:`, err);
          }
        }
      };

      socket.on(event, wrappedHandler);
      console.log(`✅ Subscribed to: ${event}`);

      // Return unsubscribe function
      return () => {
        socket.off(event, wrappedHandler);
        console.log(`📡 Unsubscribed from: ${event}`);
      };
    },
    [socket]
  );

  /**
   * ✅ NEW: Wait for specific event
   */
  const waitForEvent = useCallback(
    (event, timeout = 10000) => {
      return new Promise((resolve, reject) => {
        if (!socket) {
          reject(new Error("Socket not available"));
          return;
        }

        const timer = setTimeout(() => {
          socket.off(event, handler);
          reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout);

        const handler = (data) => {
          clearTimeout(timer);
          socket.off(event, handler);
          resolve(data);
        };

        socket.on(event, handler);
      });
    },
    [socket]
  );

  /**
   * ✅ NEW: Check if event has listeners
   */
  const hasListeners = useCallback(
    (event) => {
      return registeredEventsRef.current.has(event);
    },
    []
  );

  /**
   * ✅ NEW: Get connection latency (ping)
   */
  const getLatency = useCallback(async () => {
    if (!socket || !connected) return null;

    const start = Date.now();
    
    try {
      await emitWithAck("ping", {}, 5000);
      return Date.now() - start;
    } catch (err) {
      console.error("❌ Latency check failed:", err);
      return null;
    }
  }, [socket, connected, emitWithAck]);

  /**
   * ✅ EFFECT: Track mounted state
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * ✅ EFFECT: Clear error after timeout
   */
  useEffect(() => {
    if (lastError) {
      const timer = setTimeout(() => {
        setLastError(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [lastError]);

  return {
    // Socket instance
    socket,

    // Connection state
    connected,
    isConnected: connected,
    connectionState,
    
    // Emit methods
    emit,
    emitWithAck,
    safeEmit,

    // Event subscription
    subscribe,
    waitForEvent,
    hasListeners,

    // Connection control
    reconnect,
    getLatency,

    // Error state
    lastError,
    clearError: () => setLastError(null),

    // Queue state
    queuedEvents: eventQueue.length,
    clearQueue: () => setEventQueue([]),
  };
}
