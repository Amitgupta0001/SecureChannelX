// FILE: src/api/chatApi.js
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default {
  // ---------------------------------------------------------
  // CREATE CHAT
  // POST /chats/create
  // ---------------------------------------------------------
  async createChat(chatType, participants, title, token) {
    const body = {
      chat_type: chatType, // "private" | "group"
      participants,
    };

    if (chatType === "group" && title) {
      body.title = title;
    }

    const res = await axios.post(`${API}/chats/create`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.data;
    /*
      {
        chat: {
          _id, chat_type, participants, title, ...
        }
      }
    */
  },

  // ---------------------------------------------------------
  // LIST USER CHATS
  // GET /chats/list
  // ---------------------------------------------------------
  async listChats(token) {
    const res = await axios.get(`${API}/chats/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.data;
    /*
      { chats: [ ... ] }
    */
  },

  // ---------------------------------------------------------
  // GET CHAT INFO
  // GET /chats/:chat_id
  // ---------------------------------------------------------
  async getChat(chatId, token) {
    const res = await axios.get(`${API}/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.data;
    /*
      { chat: { ...chatData } }
    */
  },

  // ---------------------------------------------------------
  // SOCKET HELPERS (Not backend REST but required for chat)
  // ---------------------------------------------------------

  // JOIN CHAT ROOM (maps to socket event: "join_chat")
  joinChat(socket, chatId, userId) {
    socket.emit("join_chat", {
      chat_id: chatId,
      user_id: userId,
    });
  },

  // LEAVE CHAT ROOM
  leaveChat(socket, chatId, userId) {
    socket.emit("leave_chat", {
      chat_id: chatId,
      user_id: userId,
    });
  },

  // SEND MESSAGE (real-time)
  sendMessage(socket, chatId, senderId, content, messageType = "text", extra = {}) {
    socket.emit("message:send", {
      chat_id: chatId,
      message: {
        sender_id: senderId,
        content,
        message_type: messageType,
        extra,
      },
    });
  },

  // MARK MESSAGE AS SEEN (REST)
  async markSeen(messageId, chatId, token) {
    const res = await axios.post(
      `${API}/mark_seen`,
      {
        message_id: messageId,
        chat_id: chatId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data; // { ok: true }
  },
};
