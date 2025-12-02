/**
 * ✅ ENHANCED: SecureChannelX - Messages Hook
 * -------------------------------------------
 * Manages messages for a specific chat
 * 
 * Changes:
 *   - Fixed: Message loading and caching
 *   - Fixed: Real-time message handling
 *   - Fixed: Duplicate prevention
 *   - Added: Pagination support
 *   - Added: Message search
 *   - Added: Message reactions
 *   - Added: Message editing/deletion
 *   - Added: Read receipts
 *   - Enhanced: Performance optimization
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useEncryption } from "../context/EncryptionContext";
import messageApi from "../api/messageApi";

export default function useMessages(chatId) {
  const { user, token } = useAuth();
  const { socket, isConnected, safeEmit } = useSocket();
  const { decrypt, encrypt } = useEncryption();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMessages, setFilteredMessages] = useState([]);

  const messageSetRef = useRef(new Set()); // Track message IDs
  const decryptionCacheRef = useRef(new Map()); // Cache decrypted messages
  const chatIdRef = useRef(chatId);

  /**
   * ✅ HELPER: Get user ID
   */
  const getUserId = useCallback(() => {
    return user?.id || user?.user_id || user?._id;
  }, [user]);

  /**
   * ✅ HELPER: Decrypt message with caching
   */
  const decryptMessageContent = useCallback(
    async (message) => {
      if (!message.is_encrypted || !message.ciphertext) {
        return message.content || message.text;
      }

      // Check cache
      if (decryptionCacheRef.current.has(message._id)) {
        return decryptionCacheRef.current.get(message._id);
      }

      try {
        const decrypted = await decrypt({
          ciphertext: message.ciphertext,
          iv: message.iv,
          sender_id: message.sender_id,
        });

        // Cache result
        decryptionCacheRef.current.set(message._id, decrypted);
        
        return decrypted;
      } catch (err) {
        console.error("❌ Decryption failed for message:", message._id, err);
        return "[🔒 Encrypted message - decryption failed]";
      }
    },
    [decrypt]
  );

  /**
   * ✅ ENHANCED: Load messages with pagination
   */
  const loadMessages = useCallback(
    async (pageNum = 1, limit = 50) => {
      if (!chatId || !token) {
        console.warn("⚠️ Cannot load messages: Missing chatId or token");
        return;
      }

      setLoading(true);

      try {
        console.log(`📥 Loading messages for chat ${chatId}, page ${pageNum}`);

        const response = await messageApi.getMessages(chatId, token, {
          page: pageNum,
          limit,
        });

        const newMessages = response?.messages || response?.data?.messages || [];

        // Decrypt messages
        const decryptedMessages = await Promise.all(
          newMessages.map(async (msg) => ({
            ...msg,
            decryptedContent: await decryptMessageContent(msg),
          }))
        );

        if (pageNum === 1) {
          // First page - replace messages
          setMessages(decryptedMessages);
          messageSetRef.current = new Set(decryptedMessages.map((m) => m._id));
        } else {
          // Subsequent pages - prepend messages
          setMessages((prev) => {
            const uniqueMessages = decryptedMessages.filter(
              (msg) => !messageSetRef.current.has(msg._id)
            );

            uniqueMessages.forEach((msg) => messageSetRef.current.add(msg._id));

            return [...uniqueMessages, ...prev];
          });
        }

        setHasMore(newMessages.length === limit);
        setPage(pageNum);

        console.log(`✅ Loaded ${newMessages.length} messages`);
      } catch (err) {
        console.error("❌ Failed to load messages:", err);
        
        if (pageNum === 1) {
          setMessages([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [chatId, token, decryptMessageContent]
  );

  /**
   * ✅ NEW: Load more messages (infinite scroll)
   */
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    loadMessages(page + 1);
  }, [hasMore, loading, page, loadMessages]);

  /**
   * ✅ ENHANCED: Send message with encryption
   */
  const sendMessage = useCallback(
    async (content, options = {}) => {
      if (!chatId || !token || !content?.trim()) {
        console.warn("⚠️ Cannot send message: Missing data");
        return null;
      }

      setSending(true);

      try {
        console.log("📤 Sending message...");

        // Get recipient ID from chat or options
        const recipientId = options.recipient_id || chatId;

        // Encrypt message
        const encrypted = await encrypt(content.trim(), recipientId);

        // Create message payload
        const payload = {
          content: content.trim(),
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          is_encrypted: true,
          type: options.type || "text",
          reply_to: options.reply_to,
          attachments: options.attachments || [],
        };

        // Optimistic update
        const optimisticMessage = {
          _id: `temp-${Date.now()}`,
          chat_id: chatId,
          sender_id: getUserId(),
          content: content.trim(),
          decryptedContent: content.trim(),
          timestamp: new Date().toISOString(),
          status: "sending",
          is_encrypted: true,
          ...options,
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        // Send to server
        const response = await messageApi.sendMessage(chatId, payload, token);

        if (response?.message) {
          // Decrypt the message
          const decrypted = await decryptMessageContent(response.message);

          const finalMessage = {
            ...response.message,
            decryptedContent: decrypted,
          };

          // Replace optimistic message
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === optimisticMessage._id ? finalMessage : msg
            )
          );

          messageSetRef.current.add(finalMessage._id);

          console.log("✅ Message sent:", finalMessage._id);
          return finalMessage;
        }
      } catch (err) {
        console.error("❌ Failed to send message:", err);

        // Mark as failed
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === `temp-${Date.now()}`
              ? { ...msg, status: "failed" }
              : msg
          )
        );

        throw err;
      } finally {
        setSending(false);
      }
    },
    [chatId, token, encrypt, decryptMessageContent, getUserId]
  );

  /**
   * ✅ NEW: Edit message
   */
  const editMessage = useCallback(
    async (messageId, newContent) => {
      if (!token || !messageId || !newContent?.trim()) return;

      try {
        console.log(`✏️ Editing message ${messageId}`);

        // Encrypt new content
        const recipientId = messages.find((m) => m._id === messageId)?.recipient_id;
        const encrypted = await encrypt(newContent.trim(), recipientId);

        const response = await messageApi.editMessage(
          messageId,
          {
            content: newContent.trim(),
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
          },
          token
        );

        if (response?.success) {
          // Update local message
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === messageId
                ? {
                    ...msg,
                    content: newContent.trim(),
                    decryptedContent: newContent.trim(),
                    edited: true,
                    edited_at: new Date().toISOString(),
                  }
                : msg
            )
          );

          // Emit socket event
          if (socket && isConnected) {
            safeEmit("message_edited", {
              message_id: messageId,
              chat_id: chatId,
              new_content: encrypted.ciphertext,
            });
          }

          console.log("✅ Message edited");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to edit message:", err);
        throw err;
      }
    },
    [token, messages, encrypt, socket, isConnected, safeEmit, chatId]
  );

  /**
   * ✅ NEW: Delete message
   */
  const deleteMessage = useCallback(
    async (messageId, deleteForEveryone = false) => {
      if (!token || !messageId) return;

      try {
        console.log(`🗑️ Deleting message ${messageId}`);

        const response = await messageApi.deleteMessage(
          messageId,
          deleteForEveryone,
          token
        );

        if (response?.success) {
          if (deleteForEveryone) {
            // Remove from list
            setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
            messageSetRef.current.delete(messageId);
          } else {
            // Mark as deleted for user
            setMessages((prev) =>
              prev.map((msg) =>
                msg._id === messageId
                  ? { ...msg, deleted_for_me: true }
                  : msg
              )
            );
          }

          // Emit socket event
          if (socket && isConnected) {
            safeEmit("message_deleted", {
              message_id: messageId,
              chat_id: chatId,
              for_everyone: deleteForEveryone,
            });
          }

          console.log("✅ Message deleted");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to delete message:", err);
        throw err;
      }
    },
    [token, socket, isConnected, safeEmit, chatId]
  );

  /**
   * ✅ NEW: React to message
   */
  const reactToMessage = useCallback(
    async (messageId, emoji) => {
      if (!token || !messageId || !emoji) return;

      try {
        console.log(`👍 Reacting to message ${messageId} with ${emoji}`);

        const response = await messageApi.addReaction(messageId, emoji, token);

        if (response?.success) {
          // Update local message
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === messageId
                ? {
                    ...msg,
                    reactions: [
                      ...(msg.reactions || []),
                      { emoji, user_id: getUserId() },
                    ],
                  }
                : msg
            )
          );

          // Emit socket event
          if (socket && isConnected) {
            safeEmit("reaction_added", {
              message_id: messageId,
              chat_id: chatId,
              emoji,
              user_id: getUserId(),
            });
          }

          console.log("✅ Reaction added");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to add reaction:", err);
        throw err;
      }
    },
    [token, socket, isConnected, safeEmit, chatId, getUserId]
  );

  /**
   * ✅ NEW: Remove reaction
   */
  const removeReaction = useCallback(
    async (messageId, emoji) => {
      if (!token || !messageId || !emoji) return;

      try {
        console.log(`👎 Removing reaction ${emoji} from message ${messageId}`);

        const response = await messageApi.removeReaction(messageId, emoji, token);

        if (response?.success) {
          const userId = getUserId();

          // Update local message
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === messageId
                ? {
                    ...msg,
                    reactions: (msg.reactions || []).filter(
                      (r) => !(r.emoji === emoji && r.user_id === userId)
                    ),
                  }
                : msg
            )
          );

          // Emit socket event
          if (socket && isConnected) {
            safeEmit("reaction_removed", {
              message_id: messageId,
              chat_id: chatId,
              emoji,
              user_id: userId,
            });
          }

          console.log("✅ Reaction removed");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to remove reaction:", err);
        throw err;
      }
    },
    [token, socket, isConnected, safeEmit, chatId, getUserId]
  );

  /**
   * ✅ NEW: Mark message as seen
   */
  const markAsSeen = useCallback(
    async (messageId) => {
      if (!token || !messageId) return;

      try {
        const response = await messageApi.markAsSeen(messageId, token);

        if (response?.success) {
          const userId = getUserId();

          // Update local message
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === messageId
                ? {
                    ...msg,
                    seen_by: [...new Set([...(msg.seen_by || []), userId])],
                  }
                : msg
            )
          );

          // Emit socket event
          if (socket && isConnected) {
            safeEmit("message_seen", {
              message_id: messageId,
              chat_id: chatId,
              user_id: userId,
            });
          }
        }
      } catch (err) {
        console.error("❌ Failed to mark as seen:", err);
      }
    },
    [token, socket, isConnected, safeEmit, chatId, getUserId]
  );

  /**
   * ✅ NEW: Search messages
   */
  const searchMessages = useCallback(
    (query) => {
      setSearchQuery(query);

      if (!query.trim()) {
        setFilteredMessages([]);
        return;
      }

      const lowerQuery = query.toLowerCase();

      const results = messages.filter((msg) => {
        const content = msg.decryptedContent || msg.content || "";
        return content.toLowerCase().includes(lowerQuery);
      });

      setFilteredMessages(results);
      console.log(`🔍 Found ${results.length} messages matching "${query}"`);
    },
    [messages]
  );

  /**
   * ✅ NEW: Clear search
   */
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setFilteredMessages([]);
  }, []);

  /**
   * ✅ ENHANCED: Handle incoming messages
   */
  const handleNewMessage = useCallback(
    async (msg) => {
      if (!msg || !msg._id) return;

      // Prevent duplicates
      if (messageSetRef.current.has(msg._id)) {
        console.log("⚠️ Duplicate message ignored:", msg._id);
        return;
      }

      // Only process messages for current chat
      if (msg.chat_id !== chatId) {
        return;
      }

      console.log("📨 New message received:", msg._id);

      // Decrypt message
      const decrypted = await decryptMessageContent(msg);

      const finalMessage = {
        ...msg,
        decryptedContent: decrypted,
      };

      setMessages((prev) => [...prev, finalMessage]);
      messageSetRef.current.add(msg._id);

      // Mark as seen if chat is active
      if (document.hasFocus()) {
        setTimeout(() => markAsSeen(msg._id), 1000);
      }
    },
    [chatId, decryptMessageContent, markAsSeen]
  );

  /**
   * ✅ EFFECT: Register socket event handlers
   */
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;

    console.log("📡 Registering message socket handlers");

    const handlers = {
      message: handleNewMessage,
      new_message: handleNewMessage,
      "message:new": handleNewMessage,

      message_edited: ({ message_id, new_content }) => {
        console.log("✏️ Message edited:", message_id);
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === message_id
              ? { ...msg, content: new_content, edited: true }
              : msg
          )
        );
      },

      message_deleted: ({ message_id, for_everyone }) => {
        console.log("🗑️ Message deleted:", message_id);
        
        if (for_everyone) {
          setMessages((prev) => prev.filter((msg) => msg._id !== message_id));
          messageSetRef.current.delete(message_id);
        }
      },

      reaction_added: ({ message_id, emoji, user_id }) => {
        console.log("👍 Reaction added:", emoji);
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === message_id
              ? {
                  ...msg,
                  reactions: [...(msg.reactions || []), { emoji, user_id }],
                }
              : msg
          )
        );
      },

      reaction_removed: ({ message_id, emoji, user_id }) => {
        console.log("👎 Reaction removed:", emoji);
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === message_id
              ? {
                  ...msg,
                  reactions: (msg.reactions || []).filter(
                    (r) => !(r.emoji === emoji && r.user_id === user_id)
                  ),
                }
              : msg
          )
        );
      },

      message_seen: ({ message_id, user_id }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === message_id
              ? {
                  ...msg,
                  seen_by: [...new Set([...(msg.seen_by || []), user_id])],
                }
              : msg
          )
        );
      },
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup
    return () => {
      console.log("📡 Unregistering message socket handlers");
      
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, isConnected, chatId, handleNewMessage]);

  /**
   * ✅ EFFECT: Load messages when chatId changes
   */
  useEffect(() => {
    if (chatId && chatId !== chatIdRef.current) {
      console.log("🔄 Chat changed, loading messages...");
      
      chatIdRef.current = chatId;
      setMessages([]);
      setPage(1);
      setHasMore(true);
      messageSetRef.current.clear();
      decryptionCacheRef.current.clear();
      
      loadMessages(1);
    }
  }, [chatId, loadMessages]);

  /**
   * ✅ EFFECT: Auto-scroll to bottom on new message
   */
  useEffect(() => {
    // Trigger scroll event for parent component
    const event = new CustomEvent("messages:updated", {
      detail: { count: messages.length },
    });
    window.dispatchEvent(event);
  }, [messages.length]);

  return {
    // Message data
    messages: searchQuery ? filteredMessages : messages,
    allMessages: messages,
    loading,
    sending,
    hasMore,
    page,

    // Search
    searchQuery,
    searchResults: filteredMessages,

    // Actions
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    removeReaction,
    markAsSeen,
    loadMore,
    reload: () => loadMessages(1),

    // Search actions
    searchMessages,
    clearSearch,

    // Computed
    messageCount: messages.length,
    isEmpty: messages.length === 0 && !loading,
    unreadCount: messages.filter(
      (m) =>
        m.sender_id !== getUserId() &&
        !(m.seen_by || []).includes(getUserId())
    ).length,
  };
}
