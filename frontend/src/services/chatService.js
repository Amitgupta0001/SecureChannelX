// FILE: src/services/chatService.js

import axios from "axios";
import { API_BASE as API } from "../utils/constants";

/** Auth header */
const auth = () => ({
  headers: { Authorization: "Bearer " + localStorage.getItem("access_token") }
});

/* ----------------------------------------------------
   FETCH USER'S CHAT LIST
---------------------------------------------------- */
export async function fetchChats() {
  try {
    const res = await axios.get(`${API}/chats/list`, auth());
    return res.data.data;
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
    const res = await axios.post(`${API}/chats/create`, data, auth());
    return res.data.data;
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
    const res = await axios.get(`${API}/chats/${chatId}`, auth());
    return res.data.data;
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
    const res = await axios.get(
      `${API}/chats/search?q=${encodeURIComponent(query)}`,
      auth()
    );
    return res.data.data;
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
    const res = await axios.post(
      `${API}/chats/${chatId}/pin`,
      { pin },
      auth()
    );
    return res.data.data;
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
    const res = await axios.post(
      `${API}/chats/${chatId}/rename`,
      { title },
      auth()
    );
    return res.data.data;
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
    const res = await axios.delete(`${API}/chats/${chatId}`, auth());
    return res.data.data;
  } catch (err) {
    console.error("deleteChat error:", err.response?.data || err);
    return { error: "Failed to delete chat" };
  }
}
