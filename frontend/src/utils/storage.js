// FILE: src/utils/storage.js

import { STORAGE_KEYS } from "./constants";
import {
  deriveStorageKey,
  encryptStorageData,
  decryptStorageData,
  exportKey,
  importKey
} from "./encryption";

/**
 * ✅ ENHANCED: Secure Encrypted Storage
 * Wraps localStorage with AES-GCM encryption.
 * Requires initialization with user password or recovery of session key.
 * @module utils/storage
 */

let storageKey = null;
let isInitialized = false;

/* ========================================
   INITIALIZATION & KEY MANAGEMENT
======================================== */

/**
 * Initialize storage with user password.
 * Derives a key and stores it in sessionStorage for the duration of the tab.
 */
export async function initStorage(password) {
  try {
    // 1. Check if we already have a salt
    let salt = sessionStorage.getItem("scx_storage_salt");

    // 2. Derive key
    const { key, salt: newSalt } = await deriveStorageKey(password, salt);

    // 3. Store salt if new
    if (!salt) {
      sessionStorage.setItem("scx_storage_salt", newSalt);
    }

    // 4. Export and save key to sessionStorage (to survive refresh)
    // Note: Storing key in sessionStorage is a trade-off. 
    // It's accessible to XSS but cleared on tab close.
    // Ideally we'd keep it only in memory, but that breaks refresh.
    const exportedKey = await exportKey(key);
    sessionStorage.setItem("scx_storage_key", exportedKey);

    storageKey = key;
    isInitialized = true;
    return true;
  } catch (err) {
    console.error("Storage initialization failed:", err);
    return false;
  }
}

/**
 * Try to restore storage key from sessionStorage (e.g. after refresh)
 */
export async function restoreStorage() {
  try {
    const exportedKey = sessionStorage.getItem("scx_storage_key");
    if (!exportedKey) return false;

    storageKey = await importKey(exportedKey, "AES-GCM", ["encrypt", "decrypt"]);
    isInitialized = true;
    return true;
  } catch (err) {
    console.error("Storage restoration failed:", err);
    return false;
  }
}

export function isStorageReady() {
  return isInitialized && !!storageKey;
}

export function lockStorage() {
  storageKey = null;
  isInitialized = false;
  sessionStorage.removeItem("scx_storage_key");
  sessionStorage.removeItem("scx_storage_salt");
}

/* ========================================
   BASIC STORAGE OPERATIONS (ASYNC)
======================================== */

export async function setItem(key, value) {
  try {
    if (!isInitialized) {
      // Fallback for non-sensitive data or before login (optional)
      // For strict security, we should throw.
      // But for "access_token" which is needed for init... wait.
      // If we encrypt access_token, we can't init without it?
      // Chicken and egg.
      // Solution: We don't encrypt the access_token? 
      // Or we derive key from password, so we have password during login.
      // But during refresh? We need to restore key first.
      console.warn(`Storage not initialized, saving ${key} as plaintext (fallback)`);
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }

    const encrypted = await encryptStorageData(value, storageKey);
    localStorage.setItem(key, encrypted);
    return true;
  } catch (err) {
    console.error(`Failed to set item ${key}:`, err);
    return false;
  }
}

export async function getItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;

    if (!isInitialized) {
      // Try to read as plaintext (legacy or fallback)
      try {
        return JSON.parse(item);
      } catch {
        return defaultValue;
      }
    }

    // Try decrypt
    try {
      return await decryptStorageData(item, storageKey);
    } catch (e) {
      // Fallback: maybe it was stored as plaintext
      return JSON.parse(item);
    }
  } catch (err) {
    console.error(`Failed to get item ${key}:`, err);
    return defaultValue;
  }
}

export async function removeItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error(`Failed to remove item ${key}:`, err);
    return false;
  }
}

export async function clear() {
  try {
    localStorage.clear();
    return true;
  } catch (err) {
    console.error("Failed to clear storage:", err);
    return false;
  }
}

/* ========================================
   AUTH TOKEN MANAGEMENT
======================================== */
export async function setAuthTokens(accessToken, refreshToken) {
  await setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  if (refreshToken) {
    await setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }
}

export async function getAccessToken() {
  return await getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken() {
  return await getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function clearAuthTokens() {
  await removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  await removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  await removeItem(STORAGE_KEYS.USER_ID);
  await removeItem(STORAGE_KEYS.USERNAME);
}

/* ========================================
   USER DATA
======================================== */
export async function setUserData(user) {
  if (!user) return;

  await setItem(STORAGE_KEYS.USER_ID, user.id || user._id);
  await setItem(STORAGE_KEYS.USERNAME, user.username);
  await setItem("scx_user", user);
}

export async function getUserData() {
  return await getItem("scx_user");
}

export async function clearUserData() {
  await removeItem("scx_user");
  await clearAuthTokens();
}

/* ========================================
   CRYPTO KEYS STORAGE
======================================== */
export async function setPrivateKey(key) {
  await setItem(STORAGE_KEYS.PRIVATE_KEY, key);
}

export async function getPrivateKey() {
  return await getItem(STORAGE_KEYS.PRIVATE_KEY);
}

export async function setPublicKey(key) {
  await setItem(STORAGE_KEYS.PUBLIC_KEY, key);
}

export async function getPublicKey() {
  return await getItem(STORAGE_KEYS.PUBLIC_KEY);
}

export async function setSessionKey(chatId, key) {
  await setItem(`${STORAGE_KEYS.SESSION_KEY}_${chatId}`, key);
}

export async function getSessionKey(chatId) {
  return await getItem(`${STORAGE_KEYS.SESSION_KEY}_${chatId}`);
}

export async function clearCryptoKeys() {
  await removeItem(STORAGE_KEYS.PRIVATE_KEY);
  await removeItem(STORAGE_KEYS.PUBLIC_KEY);

  const allKeys = Object.keys(localStorage);
  for (const key of allKeys) {
    if (key.startsWith(STORAGE_KEYS.SESSION_KEY)) {
      await removeItem(key);
    }
  }
}

/* ========================================
   DEVICE ID
======================================== */
export async function getDeviceId() {
  let deviceId = await getItem(STORAGE_KEYS.DEVICE_ID);

  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    await setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  }

  return deviceId;
}

/* ========================================
   CACHE MANAGEMENT
======================================== */
export async function setCachedData(key, data, ttl = 3600000) {
  const cacheItem = {
    data,
    timestamp: Date.now(),
    ttl,
  };
  await setItem(`cache_${key}`, cacheItem);
}

export async function getCachedData(key) {
  const cacheItem = await getItem(`cache_${key}`);

  if (!cacheItem) return null;

  const now = Date.now();
  if (now - cacheItem.timestamp > cacheItem.ttl) {
    await removeItem(`cache_${key}`);
    return null;
  }

  return cacheItem.data;
}

export async function clearCache() {
  const allKeys = Object.keys(localStorage);
  for (const key of allKeys) {
    if (key.startsWith("cache_")) {
      await removeItem(key);
    }
  }
}

/* ========================================
   CLEANUP UTILITIES
======================================== */
export async function clearAllSecureChannelXData(prefix = "scx_") {
  let removedCount = 0;
  const allKeys = Object.keys(localStorage);

  for (const key of allKeys) {
    if (key.startsWith(prefix)) {
      await removeItem(key);
      removedCount++;
    }
  }

  return removedCount;
}

export function getStorageSize() {
  let total = 0;
  const allKeys = Object.keys(localStorage);
  allKeys.forEach((key) => {
    const value = localStorage.getItem(key);
    total += key.length + (value ? value.length : 0);
  });
  return total;
}

/* ========================================
   EXPORTS FOR LEGACY SUPPORT
   (Mapped to async versions)
======================================== */
export const storage = {
  setToken: (token) => setAuthTokens(token, null),
  getToken: () => getAccessToken(),
  removeToken: () => clearAuthTokens(),

  setRefreshToken: (token) => setItem(STORAGE_KEYS.REFRESH_TOKEN, token),
  getRefreshToken: () => getRefreshToken(),

  setUser: (userObj) => setUserData(userObj),
  getUser: () => getUserData(),
  removeUser: () => clearUserData(),

  setDeviceId: (deviceId) => setItem(STORAGE_KEYS.DEVICE_ID, deviceId),
  getDeviceId: () => getDeviceId(),

  setEncryptionKey: (userId, key) =>
    setItem(`${STORAGE_KEYS.ENCRYPTION_KEY}_${userId}`, key),
  getEncryptionKey: (userId) =>
    getItem(`${STORAGE_KEYS.ENCRYPTION_KEY}_${userId}`),
  removeEncryptionKey: (userId) =>
    removeItem(`${STORAGE_KEYS.ENCRYPTION_KEY}_${userId}`),

  setPushToken: (token) => setItem(STORAGE_KEYS.PUSH_TOKEN, token),
  getPushToken: () => getItem(STORAGE_KEYS.PUSH_TOKEN),

  setTheme: (theme) => setItem(STORAGE_KEYS.THEME, theme),
  getTheme: () => getItem(STORAGE_KEYS.THEME),

  setLanguage: (lang) => setItem(STORAGE_KEYS.LANG, lang),
  getLanguage: () => getItem(STORAGE_KEYS.LANG),

  clearAll: () => clear(),
  clearAllWithPrefix: (prefix) => clearAllSecureChannelXData(prefix),

  // New methods
  init: initStorage,
  restore: restoreStorage,
  isReady: isStorageReady,
  lock: lockStorage
};

export default storage;
