// FILE: src/services/messageService.js

import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const http = axios.create({ baseURL: API, timeout: 10000 });

const auth = () => ({
  headers: { Authorization: "Bearer " + localStorage.getItem("access_token") },
});

/* ----------------------------------------------------
   FETCH MESSAGES
---------------------------------------------------- */
export async function fetchMessages(chatId, limit = 50) {
  try {
    const res = await http.get(`/messages/${chatId}`, {
      ...auth(),
      params: { limit },
    });
    return res.data;
  } catch (err) {
    console.error("fetchMessages error:", err.response?.data || err);
    return { error: "Failed to fetch messages" };
  }
}

/* ----------------------------------------------------
   SEND TEXT / SYSTEM / OTHER SIMPLE MESSAGES
---------------------------------------------------- */
export async function sendMessage(chatId, data) {
  try {
    const res = await http.post(`/messages/send`, { chat_id: chatId, ...data }, auth());
    return res.data;
  } catch (err) {
    console.error("sendMessage error:", err.response?.data || err);
    return { error: "Failed to send message" };
  }
}

/* ----------------------------------------------------
   SEND FILE MESSAGE
---------------------------------------------------- */
export async function sendFile(chatId, formData) {
  try {
    const res = await http.post(`/messages/upload`, formData, {
      ...auth(),
      params: { chat_id: chatId },
      headers: { ...auth().headers, "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (err) {
    console.error("sendFile error:", err.response?.data || err);
    return { error: "Failed to upload file" };
  }
}

/* ----------------------------------------------------
   SEND POLL MESSAGE
---------------------------------------------------- */
export async function sendPoll(chatId, pollData) {
  try {
    const res = await http.post(`/messages/poll`, { chat_id: chatId, ...pollData }, auth());
    return res.data;
  } catch (err) {
    console.error("sendPoll error:", err.response?.data || err);
    return { error: "Failed to send poll" };
  }
}

/* ----------------------------------------------------
   MARK A MESSAGE AS SEEN
---------------------------------------------------- */
export async function markSeen(messageId, chatId) {
  try {
    await http.post(`/reads/mark-seen`, { message_id: messageId, chat_id: chatId }, auth());
    return { success: true };
  } catch (err) {
    console.error("markSeen error:", err.response?.data || err);
    return { error: "Failed to mark seen" };
  }
}

/* ----------------------------------------------------
   ADD REACTION TO A MESSAGE
---------------------------------------------------- */
export async function addReaction(messageId, emoji) {
  try {
    const res = await http.post(`/reactions/add`, { message_id: messageId, emoji }, auth());
    return res.data;
  } catch (err) {
    console.error("addReaction error:", err.response?.data || err);
    return { error: "Failed to add reaction" };
  }
}

/* ----------------------------------------------------
   EDIT MESSAGE
---------------------------------------------------- */
export async function editMessage(messageId, content) {
  try {
    const res = await http.post(`/messages/edit`, { message_id: messageId, content }, auth());
    return res.data;
  } catch (err) {
    console.error("editMessage error:", err.response?.data || err);
    return { error: "Failed to edit message" };
  }
}

/* ----------------------------------------------------
   DELETE MESSAGE
---------------------------------------------------- */
export async function deleteMessage(messageId) {
  try {
    const res = await http.delete(`/messages/${messageId}`, auth());
    return res.data;
  } catch (err) {
    console.error("deleteMessage error:", err.response?.data || err);
    return { error: "Failed to delete message" };
  }
}

/* ----------------------------------------------------
   SEARCH MESSAGES
---------------------------------------------------- */
export async function searchMessages(chatId, query) {
  try {
    const res = await http.get(`/messages/search`, {
      ...auth(),
      params: { chat_id: chatId, q: query },
    });
    return res.data;
  } catch (err) {
    console.error("searchMessages error:", err.response?.data || err);
    return { error: "Failed to search messages" };
  }
}

const messageService = {
  fetchMessages,
  sendMessage,
  sendFile,
  sendPoll,
  markSeen,
  addReaction,
  editMessage,
  deleteMessage,
  searchMessages,
};

export default messageService;
