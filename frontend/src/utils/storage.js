// FILE: src/utils/storage.js

import { STORAGE_KEYS } from "./constants";

/* ---------------------------------------------------------
   SAFE GETTERS / SETTERS FOR LOCAL STORAGE
--------------------------------------------------------- */

export const storage = {
  /* ------------------------------
      TOKEN MANAGEMENT
  ------------------------------ */
  setToken(token) {
    if (!token) return;
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  },

  getToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || null;
  },

  removeToken() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  /* ------------------------------
      USER DATA (JSON)
  ------------------------------ */
  setUser(userObj) {
    if (!userObj) return;
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userObj));
  },

  getUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Failed to parse stored user:", e);
      return null;
    }
  },

  removeUser() {
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  },

  /* ------------------------------
      DEVICE ID (for encryption / push)
  ------------------------------ */
  setDeviceId(deviceId) {
    if (!deviceId) return;
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  },

  getDeviceId() {
    return localStorage.getItem(STORAGE_KEYS.DEVICE_ID) || null;
  },

  /* ------------------------------
      ENCRYPTION KEYS (E2E)
  ------------------------------ */
  setEncryptionKey(userId, key) {
    if (!userId || !key) return;
    localStorage.setItem(`${STORAGE_KEYS.ENCRYPTION_KEY}_${userId}`, key);
  },

  getEncryptionKey(userId) {
    if (!userId) return null;
    return localStorage.getItem(`${STORAGE_KEYS.ENCRYPTION_KEY}_${userId}`);
  },

  removeEncryptionKey(userId) {
    if (!userId) return;
    localStorage.removeItem(`${STORAGE_KEYS.ENCRYPTION_KEY}_${userId}`);
  },

  /* ------------------------------
      PUSH NOTIFICATION TOKEN
  ------------------------------ */
  setPushToken(token) {
    if (!token) return;
    localStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
  },

  getPushToken() {
    return localStorage.getItem(STORAGE_KEYS.PUSH_TOKEN) || null;
  },

  /* ------------------------------
      CLEAR ALL (LOGOUT)
  ------------------------------ */
  clearAll() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
    // encryption keys remain unless explicitly removed
  }
};
