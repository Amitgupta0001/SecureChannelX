import { toBase64, fromBase64 } from './primitives';
import { db } from '../db';

const STORAGE_PREFIX = 'scx_crypto_';

// Serialize Uint8Array inside arbitrary objects
const serialize = (data) =>
  JSON.stringify(data, (k, v) => {
    if (v instanceof Uint8Array) {
      return { type: 'bytes', data: toBase64(v) };
    }
    return v;
  });

const deserialize = (jsonString) => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString, (k, v) => {
      if (v && v.type === 'bytes' && typeof v.data === 'string') {
        return fromBase64(v.data);
      }
      return v;
    });
  } catch (e) {
    console.error('Failed to deserialize', e);
    return null;
  }
};

// ---- Key storage (per-user namespaced) ----
export const saveKey = async (userId, keyName, keyData) => {
  const id = `${STORAGE_PREFIX}${userId}_${keyName}`;
  const value = serialize(keyData);
  await db.keys.put(id, { value });
};

export const loadKey = async (userId, keyName) => {
  const id = `${STORAGE_PREFIX}${userId}_${keyName}`;

  // One-time migration from localStorage if present
  const legacy = localStorage.getItem(id);
  if (legacy) {
    console.log(`Migrating key ${keyName} to IndexedDB`);
    await db.keys.put(id, { value: legacy });
    localStorage.removeItem(id);
    return deserialize(legacy);
  }

  const res = await db.keys.get(id);
  return res ? deserialize(res.value) : null;
};

// ---- Direct/session storage ----
export const saveSession = async (userId, chatId, sessionData) => {
  const id = `${userId}_${chatId}`;
  const value = serialize(sessionData);
  await db.sessions.put(id, { value });
};

export const loadSession = async (userId, chatId) => {
  const id = `${userId}_${chatId}`;
  const res = await db.sessions.get(id);
  return res ? deserialize(res.value) : null;
};

export const deleteSession = async (userId, chatId) => {
  const id = `${userId}_${chatId}`;
  return db.sessions.delete(id);
};

// ---- Group session storage ----
export const saveGroupSession = async (groupId, senderId, sessionData) => {
  const id = `group_${groupId}_${senderId}`;
  const value = serialize(sessionData);
  await db.sessions.put(id, { value });
};

export const loadGroupSession = async (groupId, senderId) => {
  const id = `group_${groupId}_${senderId}`;
  const res = await db.sessions.get(id);
  return res ? deserialize(res.value) : null;
};

export const deleteGroupSession = async (groupId, senderId) => {
  const id = `group_${groupId}_${senderId}`;
  return db.sessions.delete(id);
};

// ---- My group key (sender key material) ----
export const saveMyGroupKey = async (groupId, keyData) => {
  const id = `my_group_key_${groupId}`;
  const value = serialize(keyData);
  await db.keys.put(id, { value });
};

export const loadMyGroupKey = async (groupId) => {
  const id = `my_group_key_${groupId}`;
  const res = await db.keys.get(id);
  return res ? deserialize(res.value) : null;
};

export const deleteMyGroupKey = async (groupId) => {
  const id = `my_group_key_${groupId}`;
  return db.keys.delete(id);
};

// ---- Sender keys (per group/user) ----
export const saveSenderKeyState = async (groupId, senderId, data) => {
  const id = `sender_${groupId}_${senderId}`;
  const value = serialize(data);
  await db.senderKeys.put(id, { value });
};

export const loadSenderKeyState = async (groupId, senderId) => {
  const id = `sender_${groupId}_${senderId}`;
  const res = await db.senderKeys.get(id);
  return res ? deserialize(res.value) : null;
};

export const deleteSenderKeyState = async (groupId, senderId) => {
  const id = `sender_${groupId}_${senderId}`;
  return db.senderKeys.delete(id);
};

// ---- Maintenance helpers ----
export const clearKeys = async (userId) => {
  // Remove keys belonging to userId (prefix match)
  const prefix = `${STORAGE_PREFIX}${userId}_`;
  const all = (await db.keys.getAll()) || [];
  let removed = 0;

  for (const item of all) {
    if (item?.id?.startsWith(prefix)) {
      await db.keys.delete(item.id);
      removed++;
    }
  }
  console.warn(`Cleared ${removed} keys for user ${userId}`);
  return removed;
};

export const clearAllCryptoStores = async () => {
  await Promise.all([db.keys.clear(), db.sessions.clear(), db.senderKeys.clear()]);
};
