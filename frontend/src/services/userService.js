// FILE: src/services/userService.js

import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Correct Authorization header
const auth = () => ({
  headers: {
    Authorization: "Bearer " + localStorage.getItem("access_token")
  }
});

/* ----------------------------------------------------
   GET CURRENT USER PROFILE
---------------------------------------------------- */
export async function getUserProfile() {
  try {
    const res = await axios.get(`${API}/users/me`, auth());
    return res.data;
  } catch (err) {
    console.error("getUserProfile error:", err.response?.data || err);
    return { error: "Failed to load profile" };
  }
}

/* ----------------------------------------------------
   UPDATE USER PROFILE
---------------------------------------------------- */
export async function updateProfile(data) {
  try {
    const res = await axios.put(`${API}/users/update`, data, auth());
    return res.data;
  } catch (err) {
    console.error("updateProfile error:", err.response?.data || err);
    return { error: "Failed to update profile" };
  }
}

/* ----------------------------------------------------
   SEARCH USERS BY USERNAME OR EMAIL
---------------------------------------------------- */
export async function searchUsers(query) {
  try {
    const res = await axios.get(
      `${API}/users/search?q=${encodeURIComponent(query)}`,
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("searchUsers error:", err.response?.data || err);
    return { error: "Failed to search users" };
  }
}

/* ----------------------------------------------------
   GET PUBLIC PROFILE (For DM Profile View)
---------------------------------------------------- */
export async function getPublicProfile(userId) {
  try {
    const res = await axios.get(`${API}/users/${userId}`, auth());
    return res.data;
  } catch (err) {
    console.error("getPublicProfile error:", err.response?.data || err);
    return { error: "Failed to load public profile" };
  }
}

/* ----------------------------------------------------
   CHANGE PASSWORD
---------------------------------------------------- */
export async function changePassword(oldPassword, newPassword) {
  try {
    const res = await axios.post(
      `${API}/users/change-password`,
      { old_password: oldPassword, new_password: newPassword },
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("changePassword error:", err.response?.data || err);
    return { error: "Failed to change password" };
  }
}

/* ----------------------------------------------------
   UPLOAD AVATAR IMAGE
---------------------------------------------------- */
export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);

  try {
    const res = await axios.post(`${API}/users/avatar`, formData, {
      ...auth(),
      headers: {
        ...auth().headers,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  } catch (err) {
    console.error("uploadAvatar error:", err.response?.data || err);
    return { error: "Failed to upload avatar" };
  }
}
