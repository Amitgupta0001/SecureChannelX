// FILE: primitives.js
// ✔ Works with your installed @noble/curves version
// ✔ Compatible with Vite 7 strict scanner
// ✔ Clean and simple SecureChannelX crypto primitives

// ---- Noble imports ----
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
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    const iv = getRandomBytes(12);

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        cryptoKey,
        plaintext
    );

    return { ciphertext: new Uint8Array(ciphertext), nonce: iv };
};

export const decryptAesGcm = async (key, ciphertext, nonce, aad = new Uint8Array()) => {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce, additionalData: aad },
        cryptoKey,
        ciphertext
    );

    return new Uint8Array(plaintext);
};

// ---- Kyber fallback (X25519 only) ----
export const generateKeyPairKyber = async () => generateKeyPairX25519();

export const encapsulateKyber = async (pub) => {
    const priv = getRandomBytes(32);
    const sharedSecret = x25519.getSharedSecret(priv, pub);
    return { ciphertext: pub, sharedSecret };
};

export const decapsulateKyber = async (cipher, priv) => {
    return x25519.getSharedSecret(priv, cipher);
};

// ---- Utilities ----
export const toBase64 = (buf) => btoa(String.fromCharCode(...buf));
export const fromBase64 = (str) =>
    new Uint8Array(atob(str).split("").map(c => c.charCodeAt(0)));

export const toHex = (buf) =>
    Array.from(buf)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

export { sha256, sha512 };
