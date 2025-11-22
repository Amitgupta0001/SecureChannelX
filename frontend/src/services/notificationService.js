// FILE: src/services/notificationService.js

import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Correct auth header
const auth = () => ({
  headers: { Authorization: "Bearer " + localStorage.getItem("access_token") }
});

/* ----------------------------------------------------
   REGISTER DEVICE PUSH TOKEN (Web Push)
---------------------------------------------------- */
export async function registerPushToken(pushToken) {
  try {
    const res = await axios.post(
      `${API}/notifications/register-token`,
      { token: pushToken },
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("registerPushToken error:", err.response?.data || err);
    return { error: "Failed to register push token" };
  }
}

/* ----------------------------------------------------
   SEND TEST NOTIFICATION (Admin / Developer Only)
---------------------------------------------------- */
export async function sendTestNotification(data) {
  try {
    const res = await axios.post(
      `${API}/notifications/send-test`,
      data,
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("sendTestNotification error:", err.response?.data || err);
    return { error: "Failed to send test notification" };
  }
}

/* ----------------------------------------------------
   SEND USER NOTIFICATION (Server → Specific user)
---------------------------------------------------- */
export async function sendUserNotification(userId, payload) {
  try {
    const res = await axios.post(
      `${API}/notifications/send`,
      { user_id: userId, ...payload },
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("sendUserNotification error:", err.response?.data || err);
    return { error: "Failed to send notification" };
  }
}
