// FILE: src/api/messageApi.js
import axios from "axios";
import { API_BASE as API } from "../utils/constants";

export default {
  // -------------------------------------------------------
  // 1️⃣ FETCH ENCRYPTED MESSAGES
  // GET /api/messages/:room_id
  // -------------------------------------------------------
  async getMessages(roomId, token, page = 1, perPage = 50) {
    const res = await axios.get(
      `${API}/api/messages/${roomId}?page=${page}&per_page=${perPage}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data.data;
    /*
      {
        messages: [...],
        page,
        total_pages,
        e2e_encrypted: true
      }
    */
  },

  // -------------------------------------------------------
  // 2️⃣ SEARCH MESSAGES
  // GET /api/messages/search?q=...&room_id=...
  // -------------------------------------------------------
  async searchMessages(query, roomId, token) {
    const res = await axios.get(`${API}/api/messages/search`, {
      params: { q: query, room_id: roomId },
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.data.data;
    /*
      { results: [...] }
    */
  },

  // -------------------------------------------------------
  // 3️⃣ EDIT MESSAGE
  // PUT /api/messages/:message_id
  // -------------------------------------------------------
  async editMessage(messageId, newContent, token) {
    const res = await axios.put(
      `${API}/api/messages/${messageId}`,
      { content: newContent },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data.data;
    /*
      { message: "Message updated successfully" }
    */
  },

  // -------------------------------------------------------
  // 4️⃣ DELETE MESSAGE (soft delete)
  // DELETE /api/messages/:message_id
  // -------------------------------------------------------
  async deleteMessage(messageId, token) {
    const res = await axios.delete(`${API}/api/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.data.data;
    /*
      { message: "Message deleted successfully" }
    */
  },

  // -------------------------------------------------------
  // 5️⃣ CREATE THREAD REPLY
  // POST /api/messages/:message_id/thread
  // -------------------------------------------------------
  async createThreadMessage(parentMessageId, content, token) {
    const res = await axios.post(
      `${API}/api/messages/${parentMessageId}/thread`,
      { content },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data.data;
    /*
      { message: "...", thread_id: "..." }
    */
  },

  // -------------------------------------------------------
  // 6️⃣ GET THREAD MESSAGES
  // GET /api/messages/:message_id/thread
  // -------------------------------------------------------
  async getThreadMessages(parentMessageId, token) {
    const res = await axios.get(
      `${API}/api/messages/${parentMessageId}/thread`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data.data;
    /*
      { thread: [...] }
    */
  },

  // -------------------------------------------------------
  // 7️⃣ ADD REACTION
  // POST /add
  // -------------------------------------------------------
  async addReaction(messageId, emoji, token) {
    const res = await axios.post(
      `${API}/api/reactions/add`,
      { message_id: messageId, emoji },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data.data; // { ok: true }
  },

  // -------------------------------------------------------
  // 8️⃣ MARK MESSAGE AS SEEN
  // POST /mark_seen
  // -------------------------------------------------------
  async markSeen(messageId, chatId, token) {
    const res = await axios.post(
      `${API}/api/read/mark_seen`,
      {
        message_id: messageId,
        chat_id: chatId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data.data; // { ok: true }
  },

  // -------------------------------------------------------
  // 9️⃣ SOCKET HELPERS (REALTIME)
  // -------------------------------------------------------
  sendMessageSocket(socket, chatId, senderId, content, messageType = "text", extra = {}) {
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

  onMessageNew(socket, callback) {
    socket.on("message:new", callback);
  },

  onMessageEdited(socket, callback) {
    socket.on("message_edited", callback);
  },

  onMessageDeleted(socket, callback) {
    socket.on("message_deleted", callback);
  },

  onThreadMessage(socket, callback) {
    socket.on("thread_message", callback);
  },

  onReactionAdded(socket, callback) {
    socket.on("reaction:added", callback);
  },
};
