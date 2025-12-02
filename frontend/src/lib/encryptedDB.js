/**
 * Encrypted IndexedDB Wrapper
 * Provides client-side encryption for all data stored in IndexedDB
 */



const DB_NAME = 'SecureChannelX_Encrypted';
const DB_VERSION = 2;
const STORES = {
    KEYS: 'encryption_keys',
    MESSAGES: 'encrypted_messages',
    SESSIONS: 'encrypted_sessions',
    METADATA: 'encrypted_metadata',
};

// Master encryption key for IndexedDB (derived from user password)
let masterKey = null;

/**
 * Initialize master encryption key
 */
export const initializeMasterKey = async (userPassword) => {
    try {
        // Derive key from user password
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(userPassword);

        // Import password as key material
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            passwordData,
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive AES-GCM key
        const salt = new Uint8Array(16); // In production, store this securely
        window.crypto.getRandomValues(salt);

        masterKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 600000, // NIST recommendation
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        console.info('[ENCRYPTED-DB] Master key initialized');
        return true;
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to initialize master key:', error);
        throw error;
    }
};

/**
 * Generate a random master key (for first-time setup)
 */
export const generateMasterKey = async () => {
    try {
        masterKey = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true, // extractable
            ['encrypt', 'decrypt']
        );

        console.info('[ENCRYPTED-DB] Master key generated');
        return masterKey;
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to generate master key:', error);
        throw error;
    }
};

/**
 * Encrypt data before storing
 */
const encryptForStorage = async (data) => {
    if (!masterKey) {
        throw new Error('Master key not initialized');
    }

    try {
        const jsonData = JSON.stringify(data);
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(jsonData);

        // Generate random IV
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        // Encrypt
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            masterKey,
            dataBuffer
        );

        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encryptedBuffer), iv.length);

        // Convert to base64 for storage
        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        console.error('[ENCRYPTED-DB] Encryption failed:', error);
        throw error;
    }
};

/**
 * Decrypt data after retrieval
 */
const decryptFromStorage = async (encryptedData) => {
    if (!masterKey) {
        throw new Error('Master key not initialized');
    }

    try {
        // Convert from base64
        const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encryptedBuffer = combined.slice(12);

        // Decrypt
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            masterKey,
            encryptedBuffer
        );

        // Convert back to string and parse JSON
        const decoder = new TextDecoder();
        const jsonData = decoder.decode(decryptedBuffer);
        return JSON.parse(jsonData);
    } catch (error) {
        console.error('[ENCRYPTED-DB] Decryption failed:', error);
        throw error;
    }
};

/**
 * Open encrypted IndexedDB
 */
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create object stores if they don't exist
            Object.values(STORES).forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }
            });

            console.info('[ENCRYPTED-DB] Database upgraded to version', DB_VERSION);
        };
    });
};

/**
 * Store encrypted data
 */
export const setEncryptedItem = async (storeName, key, value) => {
    try {
        const db = await openDB();
        const encrypted = await encryptForStorage(value);

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const data = {
            key: key,
            value: encrypted,
            timestamp: Date.now(),
            type: typeof value,
        };

        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to store item:', error);
        throw error;
    }
};

/**
 * Retrieve and decrypt data
 */
export const getEncryptedItem = async (storeName, key) => {
    try {
        const db = await openDB();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.get(key);

            request.onsuccess = async () => {
                if (request.result) {
                    try {
                        const decrypted = await decryptFromStorage(request.result.value);
                        resolve(decrypted);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to retrieve item:', error);
        throw error;
    }
};

/**
 * Delete encrypted data
 */
export const deleteEncryptedItem = async (storeName, key) => {
    try {
        const db = await openDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to delete item:', error);
        throw error;
    }
};

/**
 * Clear all encrypted data
 */
export const clearEncryptedStore = async (storeName) => {
    try {
        const db = await openDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to clear store:', error);
        throw error;
    }
};

/**
 * Get all items from encrypted store
 */
export const getAllEncryptedItems = async (storeName) => {
    try {
        const db = await openDB();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.getAll();

            request.onsuccess = async () => {
                try {
                    const decryptedItems = await Promise.all(
                        request.result.map(async (item) => {
                            const decrypted = await decryptFromStorage(item.value);
                            return { ...item, value: decrypted };
                        })
                    );
                    resolve(decryptedItems);
                } catch (error) {
                    reject(error);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to get all items:', error);
        throw error;
    }
};

/**
 * Export master key (for backup)
 */
export const exportMasterKey = async () => {
    if (!masterKey) {
        throw new Error('Master key not initialized');
    }

    try {
        const exported = await window.crypto.subtle.exportKey('raw', masterKey);
        const exportedArray = new Uint8Array(exported);
        return btoa(String.fromCharCode(...exportedArray));
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to export master key:', error);
        throw error;
    }
};

/**
 * Import master key (from backup)
 */
export const importMasterKey = async (base64Key) => {
    try {
        const keyArray = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));

        masterKey = await window.crypto.subtle.importKey(
            'raw',
            keyArray,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        console.info('[ENCRYPTED-DB] Master key imported');
        return true;
    } catch (error) {
        console.error('[ENCRYPTED-DB] Failed to import master key:', error);
        throw error;
    }
};

export default {
    STORES,
    initializeMasterKey,
    generateMasterKey,
    setEncryptedItem,
    getEncryptedItem,
    deleteEncryptedItem,
    clearEncryptedStore,
    getAllEncryptedItems,
    exportMasterKey,
    importMasterKey,
};
