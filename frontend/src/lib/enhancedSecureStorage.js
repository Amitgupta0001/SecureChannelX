/**
 * SecureChannelX - Enhanced Secure Storage
 * -----------------------------------------
 * Advanced client-side encryption with secure key derivation
 * 
 * Features:
 * - PBKDF2 with 600,000 iterations (NIST 2024)
 * - Secure memory handling
 * - Key derivation from password
 * - Encrypted IndexedDB
 */

class EnhancedSecureStorage {
    constructor() {
        this.dbName = 'SecureChannelX';
        this.storeName = 'encrypted_data';
        this.db = null;
        this.masterKey = null;
        this.salt = null;
    }

    /**
     * Initialize secure storage with password
     */
    async initialize(password) {
        // Generate or retrieve salt
        this.salt = await this.getSalt();

        // Derive master key from password
        this.masterKey = await this.deriveKey(password, this.salt);

        // Open IndexedDB
        await this.openDatabase();

        console.log('✅ Secure storage initialized');
    }

    /**
     * Derive encryption key from password using PBKDF2
     * NIST 2024 recommendation: 600,000 iterations
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);

        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive AES-GCM key
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 600000, // NIST 2024 recommendation
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        // Clear password from memory
        this.secureClear(passwordBuffer);

        return key;
    }

    /**
     * Get or generate salt for key derivation
     */
    async getSalt() {
        const saltKey = 'encryption_salt';
        let salt = localStorage.getItem(saltKey);

        if (!salt) {
            // Generate new salt
            const saltBuffer = crypto.getRandomValues(new Uint8Array(32));
            salt = this.arrayBufferToBase64(saltBuffer);
            localStorage.setItem(saltKey, salt);
        }

        return this.base64ToArrayBuffer(salt);
    }

    /**
     * Encrypt data with master key
     */
    async encrypt(data) {
        if (!this.masterKey) {
            throw new Error('Storage not initialized');
        }

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));

        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Encrypt
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            this.masterKey,
            dataBuffer
        );

        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        // Clear sensitive data
        this.secureClear(dataBuffer);

        return this.arrayBufferToBase64(combined);
    }

    /**
     * Decrypt data with master key
     */
    async decrypt(encryptedData) {
        if (!this.masterKey) {
            throw new Error('Storage not initialized');
        }

        const combined = this.base64ToArrayBuffer(encryptedData);

        // Extract IV and ciphertext
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            this.masterKey,
            ciphertext
        );

        const decoder = new TextDecoder();
        const jsonString = decoder.decode(decrypted);
        const data = JSON.parse(jsonString);

        // Clear decrypted buffer
        this.secureClear(new Uint8Array(decrypted));

        return data;
    }

    /**
     * Secure memory clearing
     * Overwrites sensitive data before deletion
     */
    secureClear(buffer) {
        if (buffer instanceof Uint8Array || buffer instanceof ArrayBuffer) {
            const view = buffer instanceof ArrayBuffer
                ? new Uint8Array(buffer)
                : buffer;

            // Overwrite with random data
            crypto.getRandomValues(view);

            // Zero out
            view.fill(0);
        }
    }

    /**
     * Open IndexedDB
     */
    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Store encrypted data
     */
    async setItem(key, value) {
        const encrypted = await this.encrypt(value);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ id: key, data: encrypted });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieve and decrypt data
     */
    async getItem(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = async () => {
                if (request.result) {
                    const decrypted = await this.decrypt(request.result.data);
                    resolve(decrypted);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove item
     */
    async removeItem(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all data
     */
    async clear() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Helper: ArrayBuffer to Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Helper: Base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Export master key (for backup)
     */
    async exportMasterKey() {
        if (!this.masterKey) {
            throw new Error('No master key available');
        }

        const exported = await crypto.subtle.exportKey('raw', this.masterKey);
        return this.arrayBufferToBase64(exported);
    }

    /**
     * Import master key (from backup)
     */
    async importMasterKey(keyData) {
        const keyBuffer = this.base64ToArrayBuffer(keyData);

        this.masterKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        // Clear key buffer
        this.secureClear(keyBuffer);
    }
}

// Export singleton instance
export const secureStorage = new EnhancedSecureStorage();

export default EnhancedSecureStorage;
