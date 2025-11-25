// FILE: src/utils/encryption.js
// Military-Grade Encryption using Web Crypto API (AES-256-GCM)

/**
 * ClientSideEncryption - Proper AES-GCM implementation using Web Crypto API
 * This provides REAL authenticated encryption with integrity protection
 */
export class ClientSideEncryption {
  /* -------------------------------------------------------
     Generate 256-bit AES key (cryptographically secure)
  -------------------------------------------------------- */
  static generateKey() {
    // Generate 32 random bytes (256 bits)
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    return this.arrayBufferToHex(keyBytes);
  }

  /* -------------------------------------------------------
     AES-256-GCM ENCRYPTION (REAL military-grade)
     Returns Base64 JSON: { iv, ciphertext, authTag }
  -------------------------------------------------------- */
  static async encryptMessage(message, hexKey) {
    try {
      // Convert hex key to bytes
      const keyBytes = this.hexToArrayBuffer(hexKey);

      // Import key for AES-GCM
      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      // Generate 96-bit IV (12 bytes) - recommended for GCM
      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);

      // Encode message to bytes
      const messageBytes = new TextEncoder().encode(message);

      // Encrypt with AES-256-GCM (includes authentication tag)
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128 // 128-bit authentication tag
        },
        key,
        messageBytes
      );

      // Return as Base64 JSON
      return btoa(JSON.stringify({
        iv: this.arrayBufferToHex(iv),
        ciphertext: this.arrayBufferToBase64(ciphertext)
      }));
    } catch (e) {
      console.error('E2E encryption failed:', e);
      throw new Error('Failed to encrypt message');
    }
  }

  /* -------------------------------------------------------
     AES-256-GCM DECRYPTION (REAL military-grade)
     Expects Base64 JSON: { iv, ciphertext }
  -------------------------------------------------------- */
  static async decryptMessage(encryptedMessage, hexKey) {
    try {
      // Parse encrypted data
      const data = JSON.parse(atob(encryptedMessage));

      // Convert hex key to bytes
      const keyBytes = this.hexToArrayBuffer(hexKey);

      // Import key for AES-GCM
      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Convert IV and ciphertext from hex/base64
      const iv = this.hexToArrayBuffer(data.iv);
      const ciphertext = this.base64ToArrayBuffer(data.ciphertext);

      // Decrypt with AES-256-GCM (verifies authentication tag)
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        key,
        ciphertext
      );

      // Decode bytes to string
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('E2E decryption failed:', e);
      // Return error object for better UI handling
      throw {
        type: 'DECRYPTION_ERROR',
        message: 'Failed to decrypt message. The message may be corrupted or the key is incorrect.',
        originalError: e.message
      };
    }
  }

  /* -------------------------------------------------------
     Derive AES-256 key from password + salt (PBKDF2)
     Updated to 600,000 iterations (OWASP recommendation)
  -------------------------------------------------------- */
  static async deriveKey(password, saltHex) {
    try {
      // Convert password to bytes
      const passwordBytes = new TextEncoder().encode(password);

      // Import password as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBytes,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      // Convert salt from hex
      const salt = this.hexToArrayBuffer(saltHex);

      // Derive 256-bit key using PBKDF2
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 600000, // OWASP 2023 recommendation (up from 150,000)
          hash: 'SHA-256'
        },
        keyMaterial,
        256 // 256 bits
      );

      return this.arrayBufferToHex(derivedBits);
    } catch (e) {
      console.error('Key derivation failed:', e);
      throw new Error('Failed to derive encryption key');
    }
  }

  /* -------------------------------------------------------
     Generate random salt for PBKDF2
  -------------------------------------------------------- */
  static generateSalt() {
    const salt = new Uint8Array(16); // 128 bits
    crypto.getRandomValues(salt);
    return this.arrayBufferToHex(salt);
  }

  /* -------------------------------------------------------
     Utility: ArrayBuffer to Hex string
  -------------------------------------------------------- */
  static arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* -------------------------------------------------------
     Utility: Hex string to ArrayBuffer
  -------------------------------------------------------- */
  static hexToArrayBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
  }

  /* -------------------------------------------------------
     Utility: ArrayBuffer to Base64
  -------------------------------------------------------- */
  static arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /* -------------------------------------------------------
     Utility: Base64 to ArrayBuffer
  -------------------------------------------------------- */
  static base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /* -------------------------------------------------------
     Encrypt file (for file uploads)
  -------------------------------------------------------- */
  static async encryptFile(fileArrayBuffer, hexKey) {
    try {
      const keyBytes = this.hexToArrayBuffer(hexKey);

      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        key,
        fileArrayBuffer
      );

      return {
        iv: this.arrayBufferToHex(iv),
        data: encrypted
      };
    } catch (e) {
      console.error('File encryption failed:', e);
      throw new Error('Failed to encrypt file');
    }
  }

  /* -------------------------------------------------------
     Decrypt file (for file downloads)
  -------------------------------------------------------- */
  static async decryptFile(encryptedData, ivHex, hexKey) {
    try {
      const keyBytes = this.hexToArrayBuffer(hexKey);

      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const iv = this.hexToArrayBuffer(ivHex);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        key,
        encryptedData
      );

      return decrypted;
    } catch (e) {
      console.error('File decryption failed:', e);
      throw new Error('Failed to decrypt file');
    }
  }
}

// Export for backward compatibility
export default ClientSideEncryption;
