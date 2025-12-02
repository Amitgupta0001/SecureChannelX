// FILE: src/socket/chatHandlers.js
// Centralized Socket.IO Chat Event Handlers
// Matches backend: chats.py, chat_events.py, message_events.py,
//                  typing_events.py, read_receipts.py, reactions.py

export default function registerChatHandlers(socket, callbacks = {}) {
  if (!socket) {
    console.warn("⚠ registerChatHandlers: socket is null");
    return;
  }

  const {
    onNewMessage,
    onTypingStart,
    onTypingStop,
    onMessageSeen,
    onReactionAdded,
    onChatCreated,
    onChatUpdated,
    onChatDeleted,
    onGroupMemberAdded,
    onGroupMemberRemoved,
  } = callbacks;

  const safeCall = (fn, data, eventName) => {
    try {
      fn?.(data);
    } catch (err) {
      console.error(`❌ Error in ${eventName} handler:`, err);
    }
  };

  /* ---------------------------------------------------------
      📩 NEW MESSAGE
  --------------------------------------------------------- */
  socket.on("message:new", (data) => {
    console.log("📩 message:new", data);
    safeCall(onNewMessage, data?.message, "message:new");
  });

  /* ---------------------------------------------------------
      ✍️ TYPING STARTED
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

  /* ---------------------------------------------------------
      👁 MESSAGE SEEN
  --------------------------------------------------------- */
  socket.on("message:seen", (data) => {
    console.log("👁 message:seen", data);
    safeCall(onMessageSeen, data, "message:seen");
  });

  /* ---------------------------------------------------------
      😀 REACTION ADDED
  --------------------------------------------------------- */
  socket.on("reaction:added", (data) => {
    console.log("😀 reaction:added", data);
    safeCall(onReactionAdded, data, "reaction:added");
  });

  /* ---------------------------------------------------------
      🆕 CHAT CREATED
  --------------------------------------------------------- */
  socket.on("chat:created", (data) => {
    console.log("🆕 chat:created", data);
    safeCall(onChatCreated, data?.chat, "chat:created");
  });

  /* ---------------------------------------------------------
      🔄 CHAT UPDATED
  --------------------------------------------------------- */
  socket.on("chat:updated", (data) => {
    console.log("🔄 chat:updated", data);
    safeCall(onChatUpdated, data?.chat, "chat:updated");
  });

  /* ---------------------------------------------------------
      🗑 CHAT DELETED
  --------------------------------------------------------- */
  socket.on("chat:deleted", (data) => {
    console.log("🗑 chat:deleted", data);
    safeCall(onChatDeleted, data?.chat_id, "chat:deleted");
  });

  /* ---------------------------------------------------------
      👥 GROUP MEMBER ADDED
  --------------------------------------------------------- */
  socket.on("group:member_added", (data) => {
    console.log("👤 group:member_added", data);
    safeCall(onGroupMemberAdded, data, "group:member_added");
  });

  /* ---------------------------------------------------------
      ❌ GROUP MEMBER REMOVED
  --------------------------------------------------------- */
  socket.on("group:member_removed", (data) => {
    console.log("🚫 group:member_removed", data);
    safeCall(onGroupMemberRemoved, data, "group:member_removed");
  });
}

/* -------------------------------------------------------------
   🔥 CLIENT → SERVER EMITTERS
------------------------------------------------------------- */
export const ChatEmit = {
  sendMessage(socket, payload) {
    if (!socket?.connected) return console.warn("⚠ Socket offline: sendMessage");
    socket.emit("message:send", payload);
  },

  startTyping(socket, chat_id, user_id) {
    if (!socket?.connected || !chat_id || !user_id) return;
    socket.emit("typing:start", { chat_id, user_id });
  },

  stopTyping(socket, chat_id, user_id) {
    if (!socket?.connected || !chat_id || !user_id) return;
    socket.emit("typing:stop", { chat_id, user_id });
  },

  markSeen(socket, chat_id, message_id, user_id) {
    if (!socket?.connected) return;
    socket.emit("message:mark_seen", { chat_id, message_id, user_id });
  },

  addReaction(socket, message_id, emoji, user_id) {
    if (!socket?.connected) return;
    socket.emit("reaction:add", { message_id, emoji, user_id });
  },

  joinChat(socket, chat_id, user_id) {
    if (!socket?.connected || !chat_id) return;
    socket.emit("join_chat", { chat_id, user_id });
  },
};
