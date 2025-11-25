import { toBase64, fromBase64 } from './primitives';
import { db } from '../db';

const STORAGE_PREFIX = 'scx_crypto_';

// Helper to serialize Uint8Arrays
const serialize = (data) => {
    return JSON.stringify(data, (k, v) => {
        if (v instanceof Uint8Array) {
            return { type: 'bytes', data: toBase64(v) };
        }
        return v;
    });
};

// Helper to deserialize Uint8Arrays
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
        console.error('Failed to deserialize key', e);
        return null;
    }
};

export const saveKey = async (userId, keyName, keyData) => {
    const id = `${STORAGE_PREFIX}${userId}_${keyName}`;
    const serialized = serialize(keyData);
    await db.keys.put(id, { value: serialized });
};

export const loadKey = async (userId, keyName) => {
    const id = `${STORAGE_PREFIX}${userId}_${keyName}`;

    // Migration check: Try LocalStorage first (one-time)
    const legacy = localStorage.getItem(id);
    if (legacy) {
        console.log(`Migrating key ${keyName} to IndexedDB`);
        await db.keys.put(id, { value: legacy });
        localStorage.removeItem(id);
        return deserialize(legacy);
    }

    const result = await db.keys.get(id);
    return result ? deserialize(result.value) : null;
};

export const saveSession = async (userId, chatId, sessionData) => {
    const id = `${userId}_${chatId}`;
    const serialized = serialize(sessionData);
    await db.sessions.put(id, { value: serialized });
};

export const loadSession = async (userId, chatId) => {
    const id = `${userId}_${chatId}`;
    const result = await db.sessions.get(id);
    return result ? deserialize(result.value) : null;
};

// --- Group Session Persistence ---

export const saveGroupSession = async (groupId, senderId, sessionData) => {
    const id = `group_${groupId}_${senderId}`;
    const serialized = serialize(sessionData);
    await db.sessions.put(id, { value: serialized });
};

export const loadGroupSession = async (groupId, senderId) => {
    const id = `group_${groupId}_${senderId}`;
    const result = await db.sessions.get(id);
    return result ? deserialize(result.value) : null;
};

export const saveMyGroupKey = async (groupId, keyData) => {
    const id = `my_group_key_${groupId}`;
    const serialized = serialize(keyData);
    await db.keys.put(id, { value: serialized });
};

export const loadMyGroupKey = async (groupId) => {
    const id = `my_group_key_${groupId}`;
    const result = await db.keys.get(id);
    return result ? deserialize(result.value) : null;
};

export const clearKeys = async (userId) => {
    console.warn("clearKeys not fully implemented for IDB");
};
