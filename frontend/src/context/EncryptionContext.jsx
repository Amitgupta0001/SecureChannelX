// FILE: src/context/EncryptionContext.jsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

import { useAuth } from "./AuthContext";

// ---------------------
// CREATE CONTEXT
// ---------------------
export const EncryptionContext = createContext(null);

// Hook to consume it
export const useEncryption = () => {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error("useEncryption must be used inside EncryptionProvider");
  return ctx;
};

// ---------------------
// Helper functions
// ---------------------

async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "X25519" },
    true,
    ["deriveKey"]
  );
}

async function deriveAESKey(privateKey, peerPublicKey) {
  return await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function aesEncrypt(key, text) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function aesDecrypt(key, encrypted, ivBase64) {
  const decoder = new TextDecoder();
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return decoder.decode(plaintext);
}

// ---------------------
// Provider
// ---------------------
export const EncryptionProvider = ({ children }) => {
  const { user } = useAuth();

  const [keys, setKeys] = useState({ privateKey: null, publicKey: null });
  const [sessionKeys, setSessionKeys] = useState({});
  const [ready, setReady] = useState(false);

  // Load or create keypair
  useEffect(() => {
    if (!user) {
      setKeys({ privateKey: null, publicKey: null });
      setSessionKeys({});
      setReady(false);
      return;
    }

    (async () => {
      let stored = localStorage.getItem(`scx_keypair_${user.id}`);

      if (!stored) {
        const kp = await generateKeyPair();
        const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
        const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);

        localStorage.setItem(
          `scx_keypair_${user.id}`,
          JSON.stringify({ pub, priv })
        );

        setKeys({ privateKey: kp.privateKey, publicKey: kp.publicKey });
      } else {
        const parsed = JSON.parse(stored);

        const privateKey = await crypto.subtle.importKey(
          "jwk",
          parsed.priv,
          { name: "ECDH", namedCurve: "X25519" },
          true,
          ["deriveKey"]
        );

        const publicKey = await crypto.subtle.importKey(
          "jwk",
          parsed.pub,
          { name: "ECDH", namedCurve: "X25519" },
          true,
          []
        );

        setKeys({ privateKey, publicKey });
      }

      setReady(true);
    })();
  }, [user]);

  // Create session key per chat
  const initChatSession = async (chatId, peerPublicKeyJWK) => {
    if (!keys.privateKey) return;

    const peerPubKey = await crypto.subtle.importKey(
      "jwk",
      peerPublicKeyJWK,
      { name: "ECDH", namedCurve: "X25519" },
      true,
      []
    );

    const aes = await deriveAESKey(keys.privateKey, peerPubKey);

    setSessionKeys((prev) => ({
      ...prev,
      [chatId]: aes,
    }));
  };

  const encrypt = async (chatId, text) => {
    const aes = sessionKeys[chatId];
    if (!aes) throw new Error("Chat session key not initialized");
    return await aesEncrypt(aes, text);
  };

  const decrypt = async (chatId, enc) => {
    const aes = sessionKeys[chatId];
    if (!aes) throw new Error("Chat session key not initialized");
    return await aesDecrypt(aes, enc.ciphertext, enc.iv);
  };

  return (
    <EncryptionContext.Provider
      value={{
        ready,
        publicKey: keys.publicKey,
        initChatSession,
        encrypt,
        decrypt,
        sessionKeys,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
};

// Default export for safety
export default EncryptionContext;
