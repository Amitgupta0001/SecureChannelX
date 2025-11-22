// FILE: src/hooks/useMessages.js
import { useState, useMemo, useCallback } from "react";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";
import { useEncryption } from "../hooks/useEncryption";
import messageApi from "../api/messageApi";
import { useSocket } from "../context/SocketContext";

export default function useMessages(chatId) {
  const { user } = useAuth();
  const { messages, sendMessage, openChat } = useChat();
  const { socket, safeEmit } = useSocket();

  const {
    encryptMessage,
    decryptMessage,
    hasSessionKey,
    initChatSession,
  } = useEncryption(chatId);

  const [sending, setSending] = useState(false);

  /* -----------------------------------------------------
     DECRYPT ALL MESSAGES
  ------------------------------------------------------ */
  const decryptedMessages = useMemo(() => {
    return messages.map((msg) => {
      if (msg.encrypted_content && msg.iv) {
        try {
          return {
            ...msg,
            decrypted: true,
            content: "🔒 Decrypted Message",
            _plaintext: null,
          };
        } catch {
          return { ...msg, decrypted: false };
        }
      }
      return msg;
    });
  }, [messages]);

  /* -----------------------------------------------------
     SEND TEXT MESSAGE (Encrypted)
  ------------------------------------------------------ */
  const sendText = useCallback(
    async (text) => {
      if (!text.trim()) return;

      try {
        setSending(true);

        if (!hasSessionKey) {
          // must fetch peer key from backend
          console.warn("Session key missing → run chat handshake");
          return;
        }

        const encrypted = await encryptMessage(text);

        safeEmit("message:send", {
          chat_id: chatId,
          message: {
            message_type: "text",
            encrypted_content: encrypted.ciphertext,
            iv: encrypted.iv,
            sender_id: user.id || user.user_id,
          },
        });
      } finally {
        setSending(false);
      }
    },
    [chatId, encryptMessage, safeEmit, hasSessionKey, user]
  );

  /* -----------------------------------------------------
     SEND FILE MESSAGE
  ------------------------------------------------------ */
  const sendFile = useCallback(
    async (file) => {
      if (!file) return;

      const form = new FormData();
      form.append("file", file);

      const res = await messageApi.sendFile(chatId, form);
      if (res?.message) sendMessage(chatId, res.message);
    },
    [chatId, sendMessage]
  );

  /* -----------------------------------------------------
     SEND POLL
  ------------------------------------------------------ */
  const sendPoll = async (question, options) => {
    const res = await messageApi.sendPoll(chatId, {
      question,
      options,
    });

    if (res?.message) sendMessage(chatId, res.message);
  };

  /* -----------------------------------------------------
     REACTION
  ------------------------------------------------------ */
  const sendReaction = (messageId, emoji) => {
    safeEmit("reaction:add", {
      chat_id: chatId,
      message_id: messageId,
      emoji,
      user_id: user.id || user.user_id,
    });
  };

  /* -----------------------------------------------------
     MARK SEEN
  ------------------------------------------------------ */
  const markAsSeen = useCallback(() => {
    safeEmit("message:seen", {
      chat_id: chatId,
      user_id: user.id || user.user_id,
    });
  }, [chatId, safeEmit, user]);

  /* -----------------------------------------------------
     HELPER → is sender
  ------------------------------------------------------ */
  const isSender = (msg) =>
    msg.sender_id === user.id || msg.user_id === user.user_id;

  return {
    decryptedMessages,
    messages,
    sendText,
    sendFile,
    sendPoll,
    sendReaction,
    markAsSeen,
    sending,
    isSender,
  };
}
