// FILE: src/services/chatService.js

import axios from "axios";
import { API_BASE as API } from "../utils/constants";

const http = axios.create({ baseURL: API, timeout: 10000 });

/** Auth header */
const auth = () => ({
  headers: { Authorization: "Bearer " + localStorage.getItem("access_token") },
});

/* ----------------------------------------------------
   FETCH USER'S CHAT LIST
---------------------------------------------------- */
export async function fetchChats() {
  try {
    const res = await http.get(`/chats/list`, auth());
    // normalize to always return data property
    return res.data?.data ?? res.data;
  } catch (err) {
    console.error("fetchChats error:", err.response?.data || err);
    return { error: "Failed to load chat list" };
  }
}

/* ----------------------------------------------------
   CREATE A NEW CHAT (DM or Group)
---------------------------------------------------- */
export async function createChat(data) {
  try {
    const res = await http.post(`/chats/create`, data, auth());
    return res.data?.data ?? res.data;
  } catch (err) {
    console.error("createChat error:", err.response?.data || err);
    return { error: "Failed to create chat" };
  }
}

/* ----------------------------------------------------
   OPEN A CHAT (PRIVATE OR GROUP)
---------------------------------------------------- */
export async function openChat(chatId) {
  try {
    const res = await http.get(`/chats/${chatId}`, auth());
    return res.data?.data ?? res.data;
  } catch (err) {
    console.error("openChat error:", err.response?.data || err);
    return { error: "Failed to open chat" };
  }
}

/* ----------------------------------------------------
   SEARCH CHATS
---------------------------------------------------- */
export async function searchChats(query) {
  try {
    const res = await http.get(`/chats/search`, {
      ...auth(),
      params: { q: query },
    });
    return res.data?.data ?? res.data;
  } catch (err) {
    console.error("searchChats error:", err.response?.data || err);
    return { error: "Search failed" };
  }
}

/* ----------------------------------------------------
   PIN OR UNPIN A CHAT
---------------------------------------------------- */
export async function pinChat(chatId, pin = true) {
  try {
    const res = await http.post(`/chats/${chatId}/pin`, { pin }, auth());
    return res.data?.data ?? res.data;
  } catch (err) {
    console.error("pinChat error:", err.response?.data || err);
    return { error: "Failed to pin chat" };
  }
}

/* ----------------------------------------------------
   RENAME CHAT (Group rename)
---------------------------------------------------- */
export async function renameChat(chatId, title) {
  try {
    const res = await http.post(`/chats/${chatId}/rename`, { title }, auth());
    return res.data?.data ?? res.data;
  } catch (err) {
    console.error("renameChat error:", err.response?.data || err);
    return { error: "Failed to rename chat" };
  }
}

/* ----------------------------------------------------
   DELETE CHAT (DM or Group)
---------------------------------------------------- */
export async function deleteChat(chatId) {
  try {
    const res = await http.delete(`/chats/${chatId}`, auth());
    return res.data?.data ?? res.data;
  } catch (err) {
    console.error("deleteChat error:", err.response?.data || err);
    return { error: "Failed to delete chat" };
  }
}

const chatService = {
  fetchChats,
  createChat,
  openChat,
  searchChats,
  pinChat,
  renameChat,
  deleteChat,
};

export default chatService;
