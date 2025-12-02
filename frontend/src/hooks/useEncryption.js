// FILE: src/hooks/useEncryption.js
/**
 * ✅ ENHANCED: SecureChannelX - Encryption Hook
 * ---------------------------------------------
 * Convenience hook for encryption operations
 * 
 * Changes:
 *   - Fixed: Context integration
 *   - Added: Batch encryption/decryption
 *   - Added: File encryption support
 *   - Added: Key verification helpers
 *   - Added: Safety number generation
 *   - Enhanced: Error handling
 *   - Enhanced: Performance optimization
 */

import { useCallback, useState, useEffect, useRef } from "react";
import { useEncryption as useEncryptionContext } from "../context/EncryptionContext";
import { useAuth } from "../context/AuthContext";

export default function useEncryption() {
  const {
    isInitialized,
    loading,
    identityKeyPair,
    signedPreKey,
    preKeys,
    sessionKeys,
    encrypt: contextEncrypt,
    decrypt: contextDecrypt,
    getSessionKey,
    getSafetyNumber,
    rotatePreKeys,
    clearSessions,
    exportKeys,
    importKeys,
    initializeKeys,
  } = useEncryptionContext();

  const { user } = useAuth();

  const [encryptionStatus, setEncryptionStatus] = useState("idle"); // idle, encrypting, decrypting
  const [lastError, setLastError] = useState(null);

  const encryptionQueueRef = useRef([]);
  const decryptionQueueRef = useRef([]);
  const processingRef = useRef(false);

  /**
   * ✅ HELPER: Get user ID
   */
  const getUserId = useCallback(() => {
    return user?.id || user?.user_id || user?._id;
  }, [user]);

  /**
   * ✅ ENHANCED: Encrypt message with error handling
   */
  const encrypt = useCallback(
    async (message, recipientId) => {
      if (!isInitialized) {
        const error = new Error("Encryption not initialized");
        setLastError(error);
        throw error;
      }

      if (!message || typeof message !== "string") {
        const error = new Error("Invalid message format");
        setLastError(error);
        throw error;
      }

      if (!recipientId) {
        const error = new Error("Recipient ID required");
        setLastError(error);
        throw error;
      }

      try {
        setEncryptionStatus("encrypting");
        console.log(`🔒 Encrypting message for recipient ${recipientId}`);

        const encrypted = await contextEncrypt(message, recipientId);

        console.log("✅ Message encrypted successfully");
        setLastError(null);
        
        return encrypted;
      } catch (err) {
        console.error("❌ Encryption failed:", err);
        setLastError(err);
        throw err;
      } finally {
        setEncryptionStatus("idle");
      }
    },
    [isInitialized, contextEncrypt]
  );

  /**
   * ✅ ENHANCED: Decrypt message with error handling
   */
  const decrypt = useCallback(
    async (encryptedData) => {
      if (!isInitialized) {
        const error = new Error("Encryption not initialized");
        setLastError(error);
        throw error;
      }

      if (!encryptedData || !encryptedData.ciphertext) {
        const error = new Error("Invalid encrypted data");
        setLastError(error);
        throw error;
      }

      try {
        setEncryptionStatus("decrypting");
        console.log("🔓 Decrypting message...");

        const decrypted = await contextDecrypt(encryptedData);

        console.log("✅ Message decrypted successfully");
        setLastError(null);
        
        return decrypted;
      } catch (err) {
        console.error("❌ Decryption failed:", err);
        setLastError(err);
        
        // Return fallback message
        return "[🔒 Encrypted message - decryption failed]";
      } finally {
        setEncryptionStatus("idle");
      }
    },
    [isInitialized, contextDecrypt]
  );

  /**
   * ✅ NEW: Batch encrypt multiple messages
   */
  const batchEncrypt = useCallback(
    async (messages, recipientId) => {
      if (!isInitialized || !messages || messages.length === 0) {
        return [];
      }

      console.log(`🔒 Batch encrypting ${messages.length} messages`);

      try {
        setEncryptionStatus("encrypting");

        const encrypted = await Promise.all(
          messages.map((msg) => encrypt(msg, recipientId).catch((err) => {
            console.error("❌ Failed to encrypt message:", err);
            return null;
          }))
        );

        const successful = encrypted.filter((e) => e !== null);
        console.log(`✅ Encrypted ${successful.length}/${messages.length} messages`);

        return successful;
      } catch (err) {
        console.error("❌ Batch encryption failed:", err);
        return [];
      } finally {
        setEncryptionStatus("idle");
      }
    },
    [isInitialized, encrypt]
  );

  /**
   * ✅ NEW: Batch decrypt multiple messages
   */
  const batchDecrypt = useCallback(
    async (encryptedMessages) => {
      if (!isInitialized || !encryptedMessages || encryptedMessages.length === 0) {
        return [];
      }

      console.log(`🔓 Batch decrypting ${encryptedMessages.length} messages`);

      try {
        setEncryptionStatus("decrypting");

        const decrypted = await Promise.all(
          encryptedMessages.map((msg) => decrypt(msg).catch((err) => {
            console.error("❌ Failed to decrypt message:", err);
            return "[🔒 Encrypted message]";
          }))
        );

        console.log(`✅ Decrypted ${decrypted.length} messages`);
        return decrypted;
      } catch (err) {
        console.error("❌ Batch decryption failed:", err);
        return encryptedMessages.map(() => "[🔒 Encrypted message]");
      } finally {
        setEncryptionStatus("idle");
      }
    },
    [isInitialized, decrypt]
  );

  /**
   * ✅ NEW: Encrypt file (for attachments)
   */
  const encryptFile = useCallback(
    async (file, recipientId) => {
      if (!isInitialized || !file) {
        throw new Error("Cannot encrypt file");
      }

      try {
        console.log(`🔒 Encrypting file: ${file.name}`);
        setEncryptionStatus("encrypting");

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Convert to base64
        const base64 = btoa(String.fromCharCode(...uint8Array));

        // Encrypt base64 data
        const encrypted = await encrypt(base64, recipientId);

        console.log("✅ File encrypted successfully");

        return {
          ...encrypted,
          filename: file.name,
          mimetype: file.type,
          size: file.size,
        };
      } catch (err) {
        console.error("❌ File encryption failed:", err);
        throw err;
      } finally {
        setEncryptionStatus("idle");
      }
    },
    [isInitialized, encrypt]
  );

  /**
   * ✅ NEW: Decrypt file
   */
  const decryptFile = useCallback(
    async (encryptedFile) => {
      if (!isInitialized || !encryptedFile) {
        throw new Error("Cannot decrypt file");
      }

      try {
        console.log("🔓 Decrypting file...");
        setEncryptionStatus("decrypting");

        // Decrypt base64 data
        const base64 = await decrypt(encryptedFile);

        // Convert base64 to Blob
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: encryptedFile.mimetype });
        const file = new File([blob], encryptedFile.filename, {
          type: encryptedFile.mimetype,
        });

        console.log("✅ File decrypted successfully");
        return file;
      } catch (err) {
        console.error("❌ File decryption failed:", err);
        throw err;
      } finally {
        setEncryptionStatus("idle");
      }
    },
    [isInitialized, decrypt]
  );

  /**
   * ✅ NEW: Generate safety number with recipient
   */
  const generateSafetyNumber = useCallback(
    async (recipientId) => {
      if (!isInitialized || !identityKeyPair) {
        throw new Error("Encryption not initialized");
      }

      try {
        console.log(`🔢 Generating safety number with ${recipientId}`);

        // Fetch recipient's public key (this should come from your API)
        // For now, we'll use a placeholder
        const recipientPublicKey = await getSessionKey(recipientId);
        
        if (!recipientPublicKey) {
          throw new Error("Cannot get recipient's public key");
        }

        const safetyNumber = getSafetyNumber(recipientPublicKey);
        
        console.log("✅ Safety number generated:", safetyNumber);
        return safetyNumber;
      } catch (err) {
        console.error("❌ Safety number generation failed:", err);
        throw err;
      }
    },
    [isInitialized, identityKeyPair, getSessionKey, getSafetyNumber]
  );

  /**
   * ✅ NEW: Verify safety number
   */
  const verifySafetyNumber = useCallback(
    async (recipientId, providedSafetyNumber) => {
      try {
        const actualSafetyNumber = await generateSafetyNumber(recipientId);
        const isValid = actualSafetyNumber === providedSafetyNumber;

        console.log(
          isValid
            ? "✅ Safety number verified"
            : "❌ Safety number mismatch"
        );

        return isValid;
      } catch (err) {
        console.error("❌ Safety number verification failed:", err);
        return false;
      }
    },
    [generateSafetyNumber]
  );

  /**
   * ✅ NEW: Check if session exists with recipient
   */
  const hasSession = useCallback(
    (recipientId) => {
      return sessionKeys.some(([id]) => id === recipientId);
    },
    [sessionKeys]
  );

  /**
   * ✅ NEW: Get session info with recipient
   */
  const getSessionInfo = useCallback(
    (recipientId) => {
      const session = sessionKeys.find(([id]) => id === recipientId);
      
      if (!session) return null;

      const [id, sessionData] = session;
      
      return {
        recipientId: id,
        created: sessionData.created,
        age: Date.now() - sessionData.created,
        isExpired: Date.now() - sessionData.created > 7 * 24 * 60 * 60 * 1000, // 7 days
      };
    },
    [sessionKeys]
  );

  /**
   * ✅ NEW: Clear session with specific recipient
   */
  const clearSession = useCallback(
    (recipientId) => {
      console.log(`🗑️ Clearing session with ${recipientId}`);
      // This would need to be implemented in EncryptionContext
      // For now, clear all sessions
      clearSessions();
    },
    [clearSessions]
  );

  /**
   * ✅ NEW: Backup encryption keys
   */
  const backupKeys = useCallback(async () => {
    if (!isInitialized) {
      throw new Error("Encryption not initialized");
    }

    try {
      console.log("💾 Backing up encryption keys...");

      const backup = exportKeys();

      if (!backup) {
        throw new Error("Failed to export keys");
      }

      // Convert to JSON and download
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `securechannelx-keys-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("✅ Keys backed up successfully");
      return true;
    } catch (err) {
      console.error("❌ Key backup failed:", err);
      throw err;
    }
  }, [isInitialized, exportKeys]);

  /**
   * ✅ NEW: Restore keys from backup
   */
  const restoreKeys = useCallback(
    async (backupFile) => {
      try {
        console.log("📥 Restoring keys from backup...");

        const text = await backupFile.text();
        const backup = JSON.parse(text);

        if (!backup || !backup.identityKey) {
          throw new Error("Invalid backup file");
        }

        importKeys(backup);

        console.log("✅ Keys restored successfully");
        return true;
      } catch (err) {
        console.error("❌ Key restoration failed:", err);
        throw err;
      }
    },
    [importKeys]
  );

  /**
   * ✅ NEW: Get encryption statistics
   */
  const getStats = useCallback(() => {
    return {
      isInitialized,
      hasIdentityKey: !!identityKeyPair,
      hasSignedPreKey: !!signedPreKey,
      preKeyCount: preKeys.length,
      sessionCount: sessionKeys.length,
      status: encryptionStatus,
      lastError: lastError?.message || null,
    };
  }, [
    isInitialized,
    identityKeyPair,
    signedPreKey,
    preKeys,
    sessionKeys,
    encryptionStatus,
    lastError,
  ]);

  /**
   * ✅ EFFECT: Process encryption queue
   */
  useEffect(() => {
    const processQueue = async () => {
      if (processingRef.current || encryptionQueueRef.current.length === 0) {
        return;
      }

      processingRef.current = true;

      while (encryptionQueueRef.current.length > 0) {
        const { message, recipientId, resolve, reject } = encryptionQueueRef.current.shift();

        try {
          const encrypted = await encrypt(message, recipientId);
          resolve(encrypted);
        } catch (err) {
          reject(err);
        }
      }

      processingRef.current = false;
    };

    processQueue();
  }, [encrypt]);

  /**
   * ✅ EFFECT: Clear error after timeout
   */
  useEffect(() => {
    if (lastError) {
      const timer = setTimeout(() => {
        setLastError(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [lastError]);

  /**
   * ✅ EFFECT: Initialize encryption on mount
   */
  useEffect(() => {
    if (!isInitialized && !loading && user) {
      console.log("🔐 Initializing encryption...");
      initializeKeys();
    }
  }, [isInitialized, loading, user, initializeKeys]);

  /**
   * ✅ EFFECT: Rotate keys weekly
   */
  useEffect(() => {
    if (!isInitialized) return;

    // Check if keys need rotation (weekly)
    const lastRotation = localStorage.getItem(`last_key_rotation_${getUserId()}`);
    
    if (lastRotation) {
      const daysSinceRotation = (Date.now() - parseInt(lastRotation, 10)) / (1000 * 60 * 60 * 24);
      
      if (daysSinceRotation >= 7) {
        console.log("🔄 Keys are due for rotation");
        rotatePreKeys().then(() => {
          localStorage.setItem(`last_key_rotation_${getUserId()}`, Date.now().toString());
        });
      }
    } else {
      localStorage.setItem(`last_key_rotation_${getUserId()}`, Date.now().toString());
    }
  }, [isInitialized, rotatePreKeys, getUserId]);

  return {
    // State
    isInitialized,
    loading,
    status: encryptionStatus,
    lastError,

    // Keys info
    identityKeyPair,
    signedPreKey,
    preKeys,
    sessionKeys,

    // Core operations
    encrypt,
    decrypt,
    batchEncrypt,
    batchDecrypt,

    // File operations
    encryptFile,
    decryptFile,

    // Session management
    getSessionKey,
    hasSession,
    getSessionInfo,
    clearSession,
    clearSessions,

    // Verification
    generateSafetyNumber,
    verifySafetyNumber,
    getSafetyNumber,

    // Key management
    rotatePreKeys,
    backupKeys,
    restoreKeys,
    exportKeys,
    importKeys,
    initializeKeys,

    // Stats
    getStats,

    // Error handling
    clearError: () => setLastError(null),

    // Computed
    canEncrypt: isInitialized && !loading,
    sessionCount: sessionKeys.length,
    preKeyCount: preKeys.length,
  };
}
