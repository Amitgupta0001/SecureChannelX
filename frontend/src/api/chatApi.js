/**
 * ✅ ENHANCED: SecureChannelX - Chat API
 * --------------------------------------
 * General chat operations and room management
 * 
 * Changes:
 *   - Fixed: API URL to port 5050
 *   - Added: Axios instance with interceptors
 *   - Added: Comprehensive error handling
 *   - Added: Input validation
 *   - Added: Get all chats
 *   - Added: Create chat
 *   - Added: Delete chat
 *   - Added: Update chat settings
 *   - Added: Get chat members
 *   *   - Enhanced: Socket.IO event helpers
 * 
 * Compatibility:
 *   - Backend API: ✅ Port 5050
 *   - Socket.IO: ✅ Compatible events
 *   - E2EE: ✅ Compatible
 */

import axios from "axios";
import storage from "../utils/storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const API_TIMEOUT = 30000;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: API_TIMEOUT,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(
  async (config) => {
    if (!config.headers.Authorization) {
      const token = await storage.getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.removeToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ------------------------------------------------------------
// Chat API
// ------------------------------------------------------------
const chatApi = {
  async getAllChats(token = null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.get("/chats", { headers });
    const raw = response.data;
    const chats =
      raw?.data?.chats ||
      raw?.data ||
      raw?.chats ||
      (Array.isArray(raw) ? raw : []);
    return { success: true, chats };
  },

  async getChat(chatId, token = null) {
    if (!chatId) throw new Error("Chat ID is required");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.get(`/chats/${chatId}`, { headers });
    const chat = response.data?.chat || response.data?.data || null;
    return { success: true, chat };
  },

  async createChat(chatData, token = null) {
    if (!chatData?.chat_type) throw new Error("Chat type is required");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.post("/chats/create", chatData, { headers });
    return { success: true, chat: response.data.chat, message: response.data.message };
  },

  async updateChat(chatId, updates, token = null) {
    if (!chatId) throw new Error("Chat ID is required");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.put(`/chats/${chatId}`, updates, { headers });
    return { success: true, chat: response.data.chat, message: response.data.message };
  },

  async deleteChat(chatId, token = null) {
    if (!chatId) throw new Error("Chat ID is required");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.delete(`/chats/${chatId}`, { headers });
    return { success: true, message: response.data.message || "Chat deleted successfully" };
  },

  async getChatMembers(chatId, token = null) {
    if (!chatId) throw new Error("Chat ID is required");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.get(`/chats/${chatId}/members`, { headers });
    return { success: true, members: response.data.members || [] };
  },

  async addMember(chatId, userId, token = null) {
    if (!chatId || !userId) throw new Error("Chat ID and user ID are required");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.post(`/chats/${chatId}/members`, { user_id: userId }, { headers });
    return { success: true, message: response.data.message };
  },

  async removeMember(chatId, userId, token = null) {
    if (!chatId || !userId) throw new Error("Chat ID and user ID are required");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.delete(`/chats/${chatId}/members/${userId}`, { headers });
    return { success: true, message: response.data.message };
  },

  joinChatRoom(socket, chatId, userId) {
    if (!socket?.connected) return console.error("❌ Socket not connected");
    socket.emit("chat:join", { chat_id: chatId, user_id: userId });
  },
  leaveChatRoom(socket, chatId, userId) {
    if (!socket?.connected) return;
    socket.emit("chat:leave", { chat_id: chatId, user_id: userId });
  },
  sendTyping(socket, chatId, userId, isTyping) {
    if (!socket?.connected) return;
    socket.emit("typing", { chat_id: chatId, user_id: userId, is_typing: isTyping });
  },
  onChatCreated(socket, cb) { socket.on("chat:created", cb); },
  onChatUpdated(socket, cb) { socket.on("chat:updated", cb); },
  onChatDeleted(socket, cb) { socket.on("chat:deleted", cb); },
  onMemberAdded(socket, cb) { socket.on("member:added", cb); },
  onMemberRemoved(socket, cb) { socket.on("member:removed", cb); },
  onTyping(socket, cb) { socket.on("typing", cb); },
  offAllListeners(socket) {
    socket.off("chat:created");
    socket.off("chat:updated");
    socket.off("chat:deleted");
    socket.off("member:added");
    socket.off("member:removed");
    socket.off("typing");
  },
};

// ------------------------------------------------------------
// Exports (single source of truth)
// ------------------------------------------------------------
export default chatApi;
export const getAllChats = chatApi.getAllChats;
export const listUserChats = chatApi.getAllChats; // alias for legacy imports
export const getChatDetails = chatApi.getChat;
export const createChat = chatApi.createChat;
export const updateChat = chatApi.updateChat;
export const deleteChat = chatApi.deleteChat;
export const getChatMembers = chatApi.getChatMembers;
export const addMember = chatApi.addMember;
export const removeMember = chatApi.removeMember;
export async function markChatRead(chatId, token = null) {
  if (!chatId) throw new Error("Chat ID is required");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // Adjust the endpoint if your backend uses a different path
  const response = await api.post(`/chats/${chatId}/read`, {}, { headers });
  return { success: true, message: response.data?.message || "Marked as read" };
}
// keep aliases if other code relies on them
export const markChatAsRead = markChatRead;
