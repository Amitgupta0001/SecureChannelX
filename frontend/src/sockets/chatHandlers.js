// FILE: src/sockets/chatHandlers.js
// Centralized Socket.IO Chat Event Handlers
// Matches backend: chats.py, chat_events.py, message_events.py,
//                  typing_events.py, read_receipts.py, reactions.py

export default function registerChatHandlers(
  socket,
  {
    onNewMessage,
    onTypingStart,
    onTypingStop,
    onMessageSeen,
    onReactionAdded,
    onChatCreated,
    onChatUpdated,
    onChatDeleted,
    onGroupMemberAdded,
    onGroupMemberRemoved
  }
) {
  if (!socket) return;

  /* ---------------------------------------------------------
      🔵 NEW MESSAGE
  --------------------------------------------------------- */
  socket.on("message:new", (data) => {
    console.log("📩 message:new", data);
    onNewMessage && onNewMessage(data.message);
  });

  /* ---------------------------------------------------------
      ✍️ TYPING STARTED
  --------------------------------------------------------- */
  socket.on("typing:started", (data) => {
    console.log("✏ typing:started", data);
    onTypingStart && onTypingStart(data);
  });

  /* ---------------------------------------------------------
      🧹 TYPING STOPPED
  --------------------------------------------------------- */
  socket.on("typing:stopped", (data) => {
    console.log("🛑 typing:stopped", data);
    onTypingStop && onTypingStop(data);
  });

  /* ---------------------------------------------------------
      👁 MESSAGE SEEN
  --------------------------------------------------------- */
  socket.on("message:seen", (data) => {
    console.log("👁 message:seen", data);
    onMessageSeen && onMessageSeen(data);
  });

  /* ---------------------------------------------------------
      😀 REACTION ADDED
  --------------------------------------------------------- */
  socket.on("reaction:added", (data) => {
    console.log("😀 reaction:added", data);
    onReactionAdded && onReactionAdded(data);
  });

  /* ---------------------------------------------------------
      ➕ CHAT CREATED (DM or GROUP)
  --------------------------------------------------------- */
  socket.on("chat:created", (data) => {
    console.log("🆕 chat:created", data);
    onChatCreated && onChatCreated(data.chat);
  });

  /* ---------------------------------------------------------
      🔄 CHAT UPDATED (rename, pinned, metadata update)
  --------------------------------------------------------- */
  socket.on("chat:updated", (data) => {
    console.log("🔄 chat:updated", data);
    onChatUpdated && onChatUpdated(data.chat);
  });

  /* ---------------------------------------------------------
      ❌ CHAT DELETED
  --------------------------------------------------------- */
  socket.on("chat:deleted", (data) => {
    console.log("🗑 chat:deleted", data);
    onChatDeleted && onChatDeleted(data.chat_id);
  });

  /* ---------------------------------------------------------
      👥 GROUP MEMBER ADDED
  --------------------------------------------------------- */
  socket.on("group:member_added", (data) => {
    console.log("👤 group:member_added", data);
    onGroupMemberAdded && onGroupMemberAdded(data);
  });

  /* ---------------------------------------------------------
      ❌ GROUP MEMBER REMOVED
  --------------------------------------------------------- */
  socket.on("group:member_removed", (data) => {
    console.log("🚫 group:member_removed", data);
    onGroupMemberRemoved && onGroupMemberRemoved(data);
  });
}


/* -------------------------------------------------------------
   🔥 CLIENT → SERVER EMITTERS
   These match your backend exactly
------------------------------------------------------------- */

export const ChatEmit = {
  /* Send a message */
  sendMessage(socket, payload) {
    socket.emit("message:send", payload);
  },

  /* Send typing started */
  startTyping(socket, chat_id, user_id) {
    socket.emit("typing:start", { chat_id, user_id });
  },

  /* Send typing stopped */
  stopTyping(socket, chat_id, user_id) {
    socket.emit("typing:stop", { chat_id, user_id });
  },

  /* Mark message seen */
  markSeen(socket, chat_id, message_id, user_id) {
    socket.emit("message:mark_seen", { chat_id, message_id, user_id });
  },

  /* Add reaction */
  addReaction(socket, message_id, emoji, user_id) {
    socket.emit("reaction:add", { message_id, emoji, user_id });
  },

  /* Join a chat room */
  joinChat(socket, chat_id, user_id) {
    socket.emit("join_chat", { chat_id, user_id });
  }
};
