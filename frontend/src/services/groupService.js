// FILE: src/services/groupService.js

import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Use the correct token key
const auth = () => ({
  headers: {
    Authorization: "Bearer " + localStorage.getItem("access_token")
  }
});

/* ----------------------------------------------------
   GET ALL GROUPS FOR USER
---------------------------------------------------- */
export async function fetchGroups() {
  try {
    const res = await axios.get(`${API}/groups/list`, auth());
    return res.data;
  } catch (err) {
    console.error("fetchGroups error:", err.response?.data || err);
    return { error: "Failed to load groups." };
  }
}

/* ----------------------------------------------------
   CREATE GROUP
---------------------------------------------------- */
export async function createGroup(data) {
  try {
    const res = await axios.post(`${API}/groups/create`, data, auth());
    return res.data;
  } catch (err) {
    console.error("createGroup error:", err.response?.data || err);
    return { error: "Failed to create group." };
  }
}

/* ----------------------------------------------------
   ADD MEMBER TO GROUP
---------------------------------------------------- */
export async function addMember(groupId, userId) {
  try {
    const res = await axios.post(
      `${API}/groups/${groupId}/add-member`,
      { user_id: userId },
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("addMember error:", err.response?.data || err);
    return { error: "Failed to add member." };
  }
}

/* ----------------------------------------------------
   REMOVE MEMBER FROM GROUP
---------------------------------------------------- */
export async function removeMember(groupId, userId) {
  try {
    const res = await axios.post(
      `${API}/groups/${groupId}/remove-member`,
      { user_id: userId },
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("removeMember error:", err.response?.data || err);
    return { error: "Failed to remove member." };
  }
}

/* ----------------------------------------------------
   GET GROUP DETAILS
---------------------------------------------------- */
export async function getGroup(groupId) {
  try {
    const res = await axios.get(`${API}/groups/${groupId}`, auth());
    return res.data;
  } catch (err) {
    console.error("getGroup error:", err.response?.data || err);
    return { error: "Failed to load group." };
  }
}

/* ----------------------------------------------------
   UPDATE GROUP INFO (rename, description, settings)
---------------------------------------------------- */
export async function updateGroup(groupId, data) {
  try {
    const res = await axios.post(
      `${API}/groups/${groupId}/update`,
      data,
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("updateGroup error:", err.response?.data || err);
    return { error: "Failed to update group." };
  }
}

/* ----------------------------------------------------
   DELETE GROUP
---------------------------------------------------- */
export async function deleteGroup(groupId) {
  try {
    const res = await axios.delete(`${API}/groups/${groupId}`, auth());
    return res.data;
  } catch (err) {
    console.error("deleteGroup error:", err.response?.data || err);
    return { error: "Failed to delete group." };
  }
}
