// frontend/src/utils/encryption.js
import CryptoJS from 'crypto-js';

export class ClientSideEncryption {
    static generateKey() {
        return CryptoJS.lib.WordArray.random(32).toString();
    }

    static encryptMessage(message, key) {
        const encrypted = CryptoJS.AES.encrypt(message, key).toString();
        return encrypted;
    }

    static decryptMessage(encryptedMessage, key) {
        try {
            const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key);
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            throw new Error('Failed to decrypt message');
        }
    }

    static deriveKey(password, salt) {
        return CryptoJS.PBKDF2(password, salt, {
            keySize: 256 / 32,
            iterations: 100000
        }).toString();
    }
}