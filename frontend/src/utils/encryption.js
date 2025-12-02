import { ENCRYPTION } from "./constants";

/**
 * Military-Grade Encryption using Web Crypto API (AES-256-GCM)
 * @module utils/encryption
 */

/* ========================================
   KEY GENERATION
======================================== */
export async function generateAESKey() {
  try {
    const key = await crypto.subtle.generateKey(
      {
        name: ENCRYPTION.ALGORITHM,
        length: ENCRYPTION.KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );
    return key;
  } catch (err) {
    console.error("Failed to generate AES key:", err);
    throw new Error("Key generation failed");
  }
}

export async function generateRSAKeyPair() {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: ENCRYPTION.HASH,
      },
      true,
      ["encrypt", "decrypt"]
    );
    return keyPair;
  } catch (err) {
    console.error("Failed to generate RSA key pair:", err);
    throw new Error("RSA key generation failed");
  }
}

/* ========================================
   KEY IMPORT/EXPORT
======================================== */
export async function exportKey(key) {
  try {
    const exported = await crypto.subtle.exportKey("jwk", key);
    return JSON.stringify(exported);
  } catch (err) {
    console.error("Failed to export key:", err);
    throw new Error("Key export failed");
  }
}

export async function importKey(keyData, algorithm = ENCRYPTION.ALGORITHM, usage = ["encrypt", "decrypt"]) {
  try {
    const keyObj = JSON.parse(keyData);

    const algoConfig = algorithm === ENCRYPTION.ALGORITHM
      ? { name: ENCRYPTION.ALGORITHM, length: ENCRYPTION.KEY_LENGTH }
      : { name: "RSA-OAEP", hash: ENCRYPTION.HASH };

    const key = await crypto.subtle.importKey("jwk", keyObj, algoConfig, true, usage);
    return key;
  } catch (err) {
    console.error("Failed to import key:", err);
    throw new Error("Key import failed");
  }
}

/* ========================================
   AES ENCRYPTION/DECRYPTION
======================================== */
export async function encryptAES(plaintext, key) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION.IV_LENGTH));
    const encodedText = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION.ALGORITHM,
        iv,
        tagLength: ENCRYPTION.TAG_LENGTH,
      },
      key,
      encodedText
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return arrayBufferToBase64(combined);
  } catch (err) {
    console.error("AES encryption failed:", err);
    throw new Error("Encryption failed");
  }
}

export async function decryptAES(encryptedData, key) {
  try {
    const combined = base64ToArrayBuffer(encryptedData);

    const iv = combined.slice(0, ENCRYPTION.IV_LENGTH);
    const ciphertext = combined.slice(ENCRYPTION.IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION.ALGORITHM,
        iv,
        tagLength: ENCRYPTION.TAG_LENGTH,
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("AES decryption failed:", err);
    throw new Error("Decryption failed");
  }
}

/* ========================================
   RSA ENCRYPTION/DECRYPTION
======================================== */
export async function encryptRSA(plaintext, publicKey) {
  try {
    const encodedText = new TextEncoder().encode(plaintext);

    const encrypted = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      encodedText
    );

    return arrayBufferToBase64(encrypted);
  } catch (err) {
    console.error("RSA encryption failed:", err);
    throw new Error("RSA encryption failed");
  }
}

export async function decryptRSA(encryptedData, privateKey) {
  try {
    const ciphertext = base64ToArrayBuffer(encryptedData);

    const decrypted = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("RSA decryption failed:", err);
    throw new Error("RSA decryption failed");
  }
}

/* ========================================
   PASSWORD-BASED KEY DERIVATION (PBKDF2)
======================================== */
export async function deriveKeyFromPassword(password, salt) {
  try {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const saltBuffer = salt || crypto.getRandomValues(new Uint8Array(ENCRYPTION.SALT_LENGTH));

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: ENCRYPTION.ITERATIONS,
        hash: ENCRYPTION.HASH,
      },
      keyMaterial,
      {
        name: ENCRYPTION.ALGORITHM,
        length: ENCRYPTION.KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );

    return { key, salt: arrayBufferToBase64(saltBuffer) };
  } catch (err) {
    console.error("Key derivation failed:", err);
    throw new Error("Key derivation failed");
  }
}

/* ========================================
   HASHING
======================================== */
export async function hashSHA256(data) {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const hashBuffer = await crypto.subtle.digest(ENCRYPTION.HASH, dataBuffer);

    return arrayBufferToBase64(hashBuffer);
  } catch (err) {
    console.error("Hashing failed:", err);
    throw new Error("Hashing failed");
  }
}

/* ========================================
   RANDOM GENERATION
======================================== */
export function generateRandomBytes(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return arrayBufferToBase64(bytes);
}

export function generateRandomString(length = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((byte) => chars[byte % chars.length])
    .join("");
}

/* ========================================
   ENCODING UTILITIES
======================================== */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function stringToArrayBuffer(str) {
  return new TextEncoder().encode(str);
}

export function arrayBufferToString(buffer) {
  return new TextDecoder().decode(buffer);
}

/* ========================================
   VERIFICATION
======================================== */
export async function verifyIntegrity(data, hash) {
  const computedHash = await hashSHA256(data);
  return computedHash === hash;
}

/* ========================================
   HIGH-LEVEL MESSAGE ENCRYPTION
======================================== */
export async function encryptMessage(message, sessionKey) {
  if (!message || !sessionKey) {
    throw new Error("Invalid message or session key");
  }

  try {
    const encrypted = await encryptAES(message, sessionKey);
    const hash = await hashSHA256(message);

    return {
      ciphertext: encrypted,
      hash,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error("Message encryption failed:", err);
    throw err;
  }
}

export async function decryptMessage(encryptedMessage, sessionKey) {
  if (!encryptedMessage?.ciphertext || !sessionKey) {
    throw new Error("Invalid encrypted message or session key");
  }

  try {
    const decrypted = await decryptAES(encryptedMessage.ciphertext, sessionKey);

    // Verify integrity if hash is present
    if (encryptedMessage.hash) {
      const valid = await verifyIntegrity(decrypted, encryptedMessage.hash);
      if (!valid) {
        throw new Error("Message integrity check failed");
      }
    }

    return decrypted;
  } catch (err) {
    console.error("Message decryption failed:", err);
    throw err;
  }
}

/* ========================================
   SESSION KEY MANAGEMENT
======================================== */
export async function generateSessionKey() {
  return await generateAESKey();
}

export async function wrapSessionKey(sessionKey, publicKey) {
  try {
    const exportedKey = await exportKey(sessionKey);
    return await encryptRSA(exportedKey, publicKey);
  } catch (err) {
    console.error("Session key wrapping failed:", err);
    throw new Error("Key wrapping failed");
  }
}

export async function unwrapSessionKey(wrappedKey, privateKey) {
  try {
    const exportedKey = await decryptRSA(wrappedKey, privateKey);
    return await importKey(exportedKey, ENCRYPTION.ALGORITHM, ["encrypt", "decrypt"]);
  } catch (err) {
    console.error("Session key unwrapping failed:", err);
    throw new Error("Key unwrapping failed");
  }
}

/* ========================================
   SECURE STORAGE ENCRYPTION
======================================== */
export async function deriveStorageKey(password, salt) {
  try {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = salt ? base64ToArrayBuffer(salt) : crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );

    return {
      key,
      salt: arrayBufferToBase64(saltBuffer)
    };
  } catch (err) {
    console.error("Storage key derivation failed:", err);
    throw new Error("Storage key derivation failed");
  }
}

export async function encryptStorageData(data, key) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encodedData
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return arrayBufferToBase64(combined);
  } catch (err) {
    console.error("Storage encryption failed:", err);
    throw err;
  }
}

export async function decryptStorageData(encryptedString, key) {
  try {
    const combined = base64ToArrayBuffer(encryptedString);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext
    );

    const decoded = new TextDecoder().decode(decrypted);
    return JSON.parse(decoded);
  } catch (err) {
    // If decryption fails, it might be plaintext (legacy data)
    // We try to parse it as JSON directly just in case, or return null
    try {
      // For military-grade security, we DO NOT fallback to plaintext
      // If decryption fails, the data is considered compromised or invalid
      console.error("Storage decryption failed - refusing to return plaintext fallback");
      throw new Error("Decryption failed - Integrity check");
    } catch (e) {
      console.error("Storage decryption failed:", err);
      throw new Error("Decryption failed");
    }
  }
}
