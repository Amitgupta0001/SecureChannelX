// FILE: src/services/notificationService.js

import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const http = axios.create({ baseURL: API, timeout: 10000 });

const auth = () => ({
  headers: { Authorization: "Bearer " + localStorage.getItem("access_token") },
});

/* ----------------------------------------------------
   REGISTER DEVICE PUSH TOKEN (Web Push)
---------------------------------------------------- */
export async function registerPushToken(pushToken) {
  try {
    const res = await http.post(
      `/notifications/register-token`,
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
    const res = await http.post(`/notifications/send-test`, data, auth());
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
    const res = await http.post(
      `/notifications/send`,
      { user_id: userId, ...payload },
      auth()
    );
    return res.data;
  } catch (err) {
    console.error("sendUserNotification error:", err.response?.data || err);
    return { error: "Failed to send notification" };
  }
}

const notificationService = {
  registerPushToken,
  sendTestNotification,
  sendUserNotification,
};

export default notificationService;
