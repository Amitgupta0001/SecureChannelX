// FILE: src/hooks/useEncryption.js
import { useEncryption as useEncryptionContext } from "../context/EncryptionContext";

/**
 * A lightweight hook wrapper around EncryptionContext.
 * Provides encrypt(), decrypt(), initChatSession(), and session status.
 */

// ✅ FIX: Provide BOTH default and named export
export function useEncryption(chatId) {
  const {
    ready,
    encrypt,
    decrypt,
    initChatSession,
    sessionKeys,
    publicKey,
  } = useEncryptionContext();

  return {
    ready,
    encryptMessage: (text) => encrypt(chatId, text),
    decryptMessage: (encObj) => decrypt(chatId, encObj),
    initChatSession,
    hasSessionKey: !!(sessionKeys && sessionKeys[chatId]),
    publicKey,
  };
}

// Keep backward compatibility:
export default useEncryption;
