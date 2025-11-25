// FILE: src/sockets/typingHandlers.js
// Dedicated typing indicator socket handlers
// Matches backend typing_events.py exactly.

export default function registerTypingHandlers(
  socket,
  { onTypingStart, onTypingStop }
) {
  if (!socket) return;

  /* ---------------------------------------------------------
      ✏️ TYPING STARTED (server → client)
  --------------------------------------------------------- */
  socket.on("typing:started", (data) => {
    console.log("✏ typing:started", data);
    onTypingStart && onTypingStart(data);
  });

  /* ---------------------------------------------------------
      🛑 TYPING STOPPED (server → client)
  --------------------------------------------------------- */
  socket.on("typing:stopped", (data) => {
    console.log("🛑 typing:stopped", data);
    onTypingStop && onTypingStop(data);
  });
}

/* -------------------------------------------------------------
   🔥 CLIENT → SERVER EMITTERS
   Calling these from components or ChatContext
------------------------------------------------------------- */
export const TypingEmit = {
  /* BEGIN typing */
  startTyping(socket, chat_id, user_id) {
    socket.emit("typing:start", { chat_id, user_id });
  },

  /* END typing */
  stopTyping(socket, chat_id, user_id) {
    socket.emit("typing:stop", { chat_id, user_id });
  }
};
