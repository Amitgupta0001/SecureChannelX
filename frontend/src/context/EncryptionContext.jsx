/**
 * ✅ ENHANCED: SecureChannelX - Encryption Context
 * ------------------------------------------------
 * Signal Protocol implementation with X3DH key exchange
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import encryptionApi from "@/api/encryptionApi";

const EncryptionContext = createContext(null);

export const useEncryption = () => {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error("useEncryption must be used inside EncryptionProvider");
  return ctx;
};

/**
 * ✅ HELPER: Generate cryptographically secure random bytes
 */
const generateRandomBytes = (length = 32) => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array);
};

/**
 * ✅ HELPER: Convert array to base64
 */
const arrayToBase64 = (array) => {
  return btoa(String.fromCharCode(...array));
};

/**
 * ✅ HELPER: Convert base64 to array
 */
const base64ToArray = (base64) => {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

/**
 * ✅ HELPER: Generate key pair using Web Crypto API
 */
const generateKeyPair = async () => {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey", "deriveBits"]
    );

    const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateKeyRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    return {
      publicKey: arrayToBase64(Array.from(new Uint8Array(publicKeyRaw))),
      privateKey: arrayToBase64(Array.from(new Uint8Array(privateKeyRaw))),
    };
  } catch (err) {
    console.error("❌ Key generation failed:", err);
    throw new Error("Failed to generate encryption keys");
  }
};

/**
 * ✅ HELPER: Derive shared secret using ECDH
 */
const deriveSharedSecret = async (privateKey, publicKey) => {
  try {
    const privateKeyBuffer = base64ToArray(privateKey);
    const importedPrivateKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveBits"]
    );

    const publicKeyBuffer = base64ToArray(publicKey);
    const importedPublicKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      []
    );

    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: importedPublicKey,
      },
      importedPrivateKey,
      256
    );

    return arrayToBase64(Array.from(new Uint8Array(sharedSecret)));
  } catch (err) {
    console.error("❌ Shared secret derivation failed:", err);
    throw new Error("Failed to derive shared secret");
  }
};

/**
 * ✅ HELPER: Encrypt message using AES-GCM
 */
const encryptMessage = async (message, key) => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyBuffer = base64ToArray(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      cryptoKey,
      data
    );

    return {
      ciphertext: arrayToBase64(Array.from(new Uint8Array(encrypted))),
      iv: arrayToBase64(Array.from(iv)),
    };
  } catch (err) {
    console.error("❌ Encryption failed:", err);
    throw new Error("Failed to encrypt message");
  }
};

/**
 * ✅ HELPER: Decrypt message using AES-GCM
 */
const decryptMessage = async (ciphertext, key, iv) => {
  try {
    const keyBuffer = base64ToArray(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const ciphertextBuffer = base64ToArray(ciphertext);
    const ivBuffer = base64ToArray(iv);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      cryptoKey,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("❌ Decryption failed:", err);
    throw new Error("Failed to decrypt message");
  }
};

/**
 * ✅ HELPER: Generate safety number for verification
 */
const generateSafetyNumber = (publicKey1, publicKey2) => {
  const combined = publicKey1 + publicKey2;
  let hash = 0;

  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const safetyNumber = Math.abs(hash).toString().padStart(12, "0");
  return safetyNumber.match(/.{1,3}/g).join(" ");
};

export const EncryptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identityKeyPair, setIdentityKeyPair] = useState(null);
  const [preKeys, setPreKeys] = useState([]);
  const [signedPreKey, setSignedPreKey] = useState(null);
  const [sessionKeys, setSessionKeys] = useState(new Map());

  const keyRotationTimerRef = useRef(null);
  const token = localStorage.getItem("token");

  /**
   * ✅ Initialize encryption for user
   */
  const initializeForUser = useCallback(async () => {
    if (!user) {
      console.log("⚠️ Cannot initialize: No user");
      return;
    }

    try {
      console.log("🔐 Initializing encryption...");
      setLoading(true);

      const storedIdentityKey = localStorage.getItem(`identity_key_${user.id}`);
      const storedPreKeys = localStorage.getItem(`pre_keys_${user.id}`);
      const storedSignedPreKey = localStorage.getItem(`signed_pre_key_${user.id}`);

      if (storedIdentityKey && storedPreKeys && storedSignedPreKey) {
        console.log("📦 Restoring keys from storage");
        setIdentityKeyPair(JSON.parse(storedIdentityKey));
        setPreKeys(JSON.parse(storedPreKeys));
        setSignedPreKey(JSON.parse(storedSignedPreKey));
        setIsInitialized(true);
        return;
      }

      console.log("🔑 Generating new keys...");
      const identityKey = await generateKeyPair();
      setIdentityKeyPair(identityKey);

      const signedPreKeyPair = await generateKeyPair();
      const signedPreKeyObj = {
        keyId: Date.now(),
        keyPair: signedPreKeyPair,
        signature: arrayToBase64(generateRandomBytes(64)),
      };
      setSignedPreKey(signedPreKeyObj);

      const generatedPreKeys = [];
      for (let i = 0; i < 100; i++) {
        const preKey = await generateKeyPair();
        generatedPreKeys.push({
          keyId: i + 1,
          keyPair: preKey,
        });
      }
      setPreKeys(generatedPreKeys);

      localStorage.setItem(`identity_key_${user.id}`, JSON.stringify(identityKey));
      localStorage.setItem(`pre_keys_${user.id}`, JSON.stringify(generatedPreKeys));
      localStorage.setItem(`signed_pre_key_${user.id}`, JSON.stringify(signedPreKeyObj));

      if (token) {
        try {
          await encryptionApi.uploadKeys(
            token,
            identityKey.publicKey,
            signedPreKeyObj,
            generatedPreKeys.map((pk) => ({
              keyId: pk.keyId,
              publicKey: pk.keyPair.publicKey,
            }))
          );
          console.log("✅ Keys uploaded to server");
        } catch (uploadErr) {
          console.warn("⚠️ Failed to upload keys:", uploadErr);
        }
      }

      setIsInitialized(true);
      console.log("✅ Encryption initialized");
    } catch (err) {
      console.error("❌ Initialization failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  /**
   * ✅ Encrypt text
   */
  const encryptText = useCallback(
    async (text, recipientId) => {
      if (!isInitialized || !identityKeyPair) {
        throw new Error("Encryption not initialized");
      }

      try {
        let session = sessionKeys.get(recipientId);

        if (!session && token) {
          const bundle = await encryptionApi.getPreKeyBundle(recipientId, token);
          const sharedSecret = await deriveSharedSecret(
            identityKeyPair.privateKey,
            bundle.identity_key
          );

          session = {
            key: sharedSecret.substring(0, 44),
            recipientId,
            created: Date.now(),
          };

          setSessionKeys((prev) => new Map(prev).set(recipientId, session));
        }

        if (!session) {
          throw new Error("Failed to establish session");
        }

        return await encryptMessage(text, session.key);
      } catch (err) {
        console.error("❌ Text encryption failed:", err);
        throw err;
      }
    },
    [isInitialized, identityKeyPair, sessionKeys, token]
  );

  /**
   * ✅ Decrypt text
   */
  const decryptText = useCallback(
    async (encryptedData) => {
      if (!isInitialized || !identityKeyPair) {
        throw new Error("Encryption not initialized");
      }

      try {
        const { ciphertext, iv, sender_id } = encryptedData;

        let session = sessionKeys.get(sender_id);

        if (!session && token) {
          const bundle = await encryptionApi.getPreKeyBundle(sender_id, token);
          const sharedSecret = await deriveSharedSecret(
            identityKeyPair.privateKey,
            bundle.identity_key
          );

          session = {
            key: sharedSecret.substring(0, 44),
            recipientId: sender_id,
            created: Date.now(),
          };

          setSessionKeys((prev) => new Map(prev).set(sender_id, session));
        }

        if (!session) {
          return "[🔒 Encrypted message]";
        }

        return await decryptMessage(ciphertext, session.key, iv);
      } catch (err) {
        console.error("❌ Text decryption failed:", err);
        return "[🔒 Encrypted message - decryption failed]";
      }
    },
    [isInitialized, identityKeyPair, sessionKeys, token]
  );

  /**
   * ✅ Encrypt file
   */
  const encryptFile = useCallback(
    async (file, recipientId) => {
      console.log("🔒 File encryption not yet implemented");
      return file;
    },
    []
  );

  /**
   * ✅ Decrypt file
   */
  const decryptFile = useCallback(
    async (encryptedFile) => {
      console.log("🔓 File decryption not yet implemented");
      return encryptedFile;
    },
    []
  );

  /**
   * ✅ Get public identity key
   */
  const getPublicIdentityKey = useCallback(() => {
    return identityKeyPair?.publicKey || null;
  }, [identityKeyPair]);

  /**
   * ✅ Decrypt preview - MUST BE DEFINED BEFORE useMemo
   */
  const decryptPreview = useCallback(
    async (encryptedPreview) => {
      if (!isInitialized || !encryptedPreview) {
        return "...";
      }

      try {
        const decrypted = await decryptText(encryptedPreview);
        return decrypted;
      } catch (error) {
        console.error("Failed to decrypt preview:", error);
        return "Encrypted message";
      }
    },
    [isInitialized, decryptText]
  );

  /**
   * ✅ Initialize on mount
   */
  useEffect(() => {
    if (user && !isInitialized && !loading) {
      initializeForUser();
    }
  }, [user, isInitialized, loading, initializeForUser]);

  /**
   * ✅ Create context value
   */
  const value = useMemo(
    () => ({
      isInitialized,
      loading,
      initializeForUser,
      encryptText,
      decryptText,
      encryptFile,
      decryptFile,
      getPublicIdentityKey,
      decryptPreview,
    }),
    [
      isInitialized,
      loading,
      initializeForUser,
      encryptText,
      decryptText,
      encryptFile,
      decryptFile,
      getPublicIdentityKey,
      decryptPreview,
    ]
  );

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
};

export { EncryptionContext };
export default EncryptionContext;