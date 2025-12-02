// FILE: primitives.js
// Crypto primitives for SecureChannelX

import { x25519 } from '@noble/curves/ed25519.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';

// ---- Random ----
export const getRandomBytes = (len) => {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
};

// ---- X25519 ----
export const generateKeyPairX25519 = () => {
  const priv = getRandomBytes(32);
  const pub = x25519.getPublicKey(priv);
  return { priv, pub };
};

export const sharedSecretX25519 = (privKey, pubKey) => {
  return x25519.getSharedSecret(privKey, pubKey);
};

// ---- HKDF ----
export const hkdfSha256 = (ikm, salt, info, len = 32) => {
  return hkdf(sha256, ikm, salt, info, len);
};

// ---- AES-GCM ----
export const encryptAesGcm = async (key, plaintext, aad = new Uint8Array()) => {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = getRandomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    cryptoKey,
    plaintext
  );
  return { ciphertext: new Uint8Array(ciphertext), nonce: iv };
};

export const decryptAesGcm = async (key, ciphertext, nonce, aad = new Uint8Array()) => {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad },
    cryptoKey,
    ciphertext
  );
  return new Uint8Array(plaintext);
};

// ---- Kyber fallback (X25519-based placeholder) ----
// Encapsulate: generate ephemeral ePriv/ePub, derive sharedSecret = X25519(ePriv, recipientPub)
// Return ePub as "ciphertext" so receiver can derive same secret
export const generateKeyPairKyber = async () => generateKeyPairX25519();

export const encapsulateKyber = async (recipientPub) => {
  const ePriv = getRandomBytes(32);
  const ePub = x25519.getPublicKey(ePriv);
  const sharedSecret = x25519.getSharedSecret(ePriv, recipientPub);
  return { ciphertext: ePub, sharedSecret };
};

export const decapsulateKyber = async (ciphertext, recipientPriv) => {
  // ciphertext is sender's ephemeral public key
  return x25519.getSharedSecret(recipientPriv, ciphertext);
};

// ---- Utilities ----
export const toBase64 = (buf) => {
  if (!buf) {
    console.error('toBase64: received null/undefined');
    return '';
  }
  if (!(buf instanceof Uint8Array)) {
    if (ArrayBuffer.isView(buf)) {
      buf = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } else if (buf instanceof ArrayBuffer) {
      buf = new Uint8Array(buf);
    } else if (Array.isArray(buf)) {
      buf = new Uint8Array(buf);
    } else {
      console.error('toBase64: invalid buffer type', typeof buf, buf);
      throw new TypeError(`toBase64: expected Uint8Array, got ${typeof buf}`);
    }
  }
  return btoa(String.fromCharCode(...buf));
};

export const fromBase64 = (str) => {
  if (!str || typeof str !== 'string') {
    console.error('fromBase64: invalid input', typeof str);
    return new Uint8Array(0);
  }
  try {
    return new Uint8Array(atob(str).split('').map((c) => c.charCodeAt(0)));
  } catch (e) {
    console.error('fromBase64: decode failed', e);
    return new Uint8Array(0);
  }
};

export const toHex = (buf) => Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');

export { sha256, sha512 };
