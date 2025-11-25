// FILE: src/api/chatApi.js
import axios from "axios";
import { API_BASE as API } from "../utils/constants";

export default {

  // ---------------------------------------------------------
  // CREATE CHAT
  // POST http://localhost:5050/api/chats/create
  // ---------------------------------------------------------
  async createChat(chatType, participants, title, token) {
    const body = {
      chat_type: chatType,
      participants,
    };

    if (chatType === "group" && title) {
      body.title = title;
    }

    const res = await axios.post(`${API}/api/chats/create`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.data.data;
  },

  // ---------------------------------------------------------
  // LIST USER CHATS
  // GET http://localhost:5050/api/chats/list
  // ---------------------------------------------------------
  async listChats(token) {
    const res = await axios.get(`${API}/api/chats/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.data;
  },

  // For ChatContext compatibility
  async getAllChats(token) {
    return await this.listChats(token);
  },

  // ---------------------------------------------------------
  // GET CHAT INFO
  // GET http://localhost:5050/api/chats/:chat_id
  // ---------------------------------------------------------
  async getChat(chatId, token) {
    const res = await axios.get(`${API}/api/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.data;
  },

  // ---------------------------------------------------------
  // SOCKET HELPERS
  // ---------------------------------------------------------
  joinChat(socket, chatId, userId) {
    socket.emit("join_chat", {
      chat_id: chatId,
      user_id: userId,
    });
  },

  leaveChat(socket, chatId, userId) {
    socket.emit("leave_chat", {
      chat_id: chatId,
      user_id: userId,
    });
  },

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

  // ---------------------------------------------------------
  // MARK SEEN
  // POST http://localhost:5050/api/chats/mark_seen
  // ---------------------------------------------------------
  async markSeen(messageId, chatId, token) {
    const res = await axios.post(
      `${API}/api/chats/mark_seen`,
      {
        message_id: messageId,
        chat_id: chatId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data.data;
  },
};
