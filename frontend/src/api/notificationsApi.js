// FILE: src/api/notificationsApi.js
import axios from "axios";
import { API_BASE } from "../utils/constants";

const API = API_BASE;

export default {
  // -------------------------------------------------------
  // 1️⃣ REGISTER PUSH TOKEN
  // POST /notifications/register_token
  // Body: { token }
  // -------------------------------------------------------
  async registerPushToken(pushToken, token) {
    const res = await axios.post(
      `${API}/api/notifications/register_token`,
      { token: pushToken },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data;
    /*
      { ok: true }
    */
  },

  // -------------------------------------------------------
  // 2️⃣ SEND NOTIFICATION (ADMIN / DEV ONLY)
  // POST /notifications/send
  // Body: { user_id, title, body }
  // -------------------------------------------------------
  async sendNotification(userId, title, body, token) {
    const res = await axios.post(
      `${API}/api/notifications/send`,
      {
        user_id: userId,
        title,
        body,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data;
    /*
      { ok: true }
    */
  },

  // -------------------------------------------------------
  // 3️⃣ FRONTEND SERVICE WORKER SUBSCRIPTION HELPER
  // (You will call this after SW registers push subscription)
  // -------------------------------------------------------
  async subscribeToPushNotifications(serviceWorkerReg) {
    if (!("PushManager" in window)) {
      console.warn("Push notifications are not supported");
      return null;
    }

    // For Web Push you would insert the server's VAPID public key:
    const vapidPublicKey = import.meta.env.VITE_VAPID_KEY;

    try {
      const sub = await serviceWorkerReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      return sub;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return null;
    }
  },
};
