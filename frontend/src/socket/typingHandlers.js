// FILE: src/socket/typingHandlers.js
// Dedicated typing indicator socket handlers
// Matches backend typing_events.py exactly.

export default function registerTypingHandlers(socket, callbacks = {}) {
  if (!socket) {
    console.warn("⚠ registerTypingHandlers: socket is null");
    return;
  }

  const { onTypingStart, onTypingStop } = callbacks;

  const safeCall = (fn, data, eventName) => {
    try {
      fn?.(data);
    } catch (err) {
      console.error(`❌ Error in ${eventName} handler:`, err);
    }
  };

  /* ---------------------------------------------------------
      ✏️ TYPING STARTED
  --------------------------------------------------------- */
  socket.on("typing:started", (data) => {
    console.log("✏️ typing:started", data);
    safeCall(onTypingStart, data, "typing:started");
  });

  /* ---------------------------------------------------------
      🛑 TYPING STOPPED
  --------------------------------------------------------- */
  socket.on("typing:stopped", (data) => {
    console.log("🛑 typing:stopped", data);
    safeCall(onTypingStop, data, "typing:stopped");
  });
}

/* -------------------------------------------------------------
   🔥 CLIENT → SERVER EMITTERS
------------------------------------------------------------- */
export const TypingEmit = {
  startTyping(socket, chat_id, user_id) {
    if (!socket?.connected || !chat_id || !user_id) return;
    socket.emit("typing:start", { chat_id, user_id });
  },

  stopTyping(socket, chat_id, user_id) {
    if (!socket?.connected || !chat_id || !user_id) return;
    socket.emit("typing:stop", { chat_id, user_id });
  },
};
