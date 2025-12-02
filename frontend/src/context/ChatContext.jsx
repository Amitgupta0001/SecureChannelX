// FILE: src/context/ChatContext.jsx

/**
 * ✅ ENHANCED: SecureChannelX - Chat Context
 * ------------------------------------------
 * Manages chat rooms, messages, and real-time events
 * 
 * Changes:
 *   - Fixed: Chat loading with proper error handling
 *   - Fixed: Room joining with connection check
 *   - Fixed: Message deduplication
 *   - Added: Pagination support
 *   - Added: Optimistic updates
 *   - Added: Read receipts tracking
 *   - Enhanced: Typing indicators
 *   - Enhanced: Performance optimization
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSocket } from "./SocketContext";
import chatApi from "../api/chatApi";
import messageApi from "../api/messageApi";
import { useAuth } from "./AuthContext";

const ChatContext = createContext();
export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const { socket, isConnected, safeEmit } = useSocket();
  const { user, token, isAuthenticated } = useAuth();

  const messageSetRef = useRef(new Set()); // Track message IDs to prevent duplicates
  const typingTimeoutRef = useRef({});
  const currentRoomRef = useRef(null);

  /**
   * ✅ HELPER: Normalize user ID
   */
  const getUserId = useCallback(() => {
    return user?.id || user?.user_id || user?._id;
  }, [user]);

  /**
   * ✅ ENHANCED: Load chats with error handling
   */
  const loadChats = useCallback(async () => {
    if (!token || !isAuthenticated) {
      console.warn("⛔ Cannot load chats: Not authenticated");
      return;
    }

    setLoadingChats(true);

    try {
      console.log("📥 Loading chats...");
      
      const response = await chatApi.getAllChats(token);
      
      // Handle different response formats
      const chatsList = response?.chats || response?.data?.chats || response || [];
      
      console.log(`✅ Loaded ${chatsList.length} chats`);
      setChats(chatsList);

    } catch (err) {
      console.error("❌ Failed to load chats:", err);
      
      // Don't clear chats on error - keep existing data
      if (err.response?.status === 401) {
        console.log("🔐 Unauthorized - token may be expired");
      }
    } finally {
      setLoadingChats(false);
    }
  }, [token, isAuthenticated]);

  /**
   * ✅ ENHANCED: Load messages with pagination
   */
  const loadMessages = useCallback(
    async (chatId, pageNum = 1) => {
      if (!token || !chatId) return;

      setLoadingMessages(true);

      try {
        console.log(`📥 Loading messages for chat ${chatId}, page ${pageNum}`);

        const response = await messageApi.getMessages(chatId, token, {
          page: pageNum,
          limit: 50,
        });

        const newMessages = response?.messages || [];

        if (pageNum === 1) {
          // First page - replace messages
          setMessages(newMessages);
          messageSetRef.current = new Set(newMessages.map((m) => m._id));
        } else {
          // Subsequent pages - prepend messages
          setMessages((prev) => {
            const uniqueMessages = newMessages.filter(
              (msg) => !messageSetRef.current.has(msg._id)
            );
            
            uniqueMessages.forEach((msg) => messageSetRef.current.add(msg._id));
            
            return [...uniqueMessages, ...prev];
          });
        }

        setHasMore(newMessages.length === 50);
        setPage(pageNum);

        console.log(`✅ Loaded ${newMessages.length} messages`);
      } catch (err) {
        console.error("❌ Failed to load messages:", err);
        
        if (pageNum === 1) {
          setMessages([]);
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Load more messages (pagination)
   */
  const loadMoreMessages = useCallback(() => {
    if (!hasMore || loadingMessages || !activeChatId) return;
    loadMessages(activeChatId, page + 1);
  }, [hasMore, loadingMessages, activeChatId, page, loadMessages]);

  /**
   * ✅ ENHANCED: Open chat and join room
   */
  const openChat = useCallback(
    (chatId) => {
      if (!chatId) return;

      console.log(`📂 Opening chat: ${chatId}`);

      // Leave current room
      if (currentRoomRef.current && socket && isConnected) {
        console.log(`🚪 Leaving room: ${currentRoomRef.current}`);
        socket.emit("leave_chat", { chat_id: currentRoomRef.current });
      }

      setActiveChatId(chatId);
      setPage(1);
      setHasMore(true);
      messageSetRef.current.clear();
      
      loadMessages(chatId, 1);

      // Join new room
      if (socket && isConnected) {
        const userId = getUserId();
        
        console.log(`🚪 Joining room: ${chatId}`);
        socket.emit("join_chat", {
          chat_id: chatId,
          user_id: userId,
        });

        currentRoomRef.current = chatId;
      } else {
        console.warn("⚠️ Socket not connected, cannot join room");
      }
    },
    [socket, isConnected, loadMessages, getUserId]
  );

  /**
   * ✅ ENHANCED: Send message with optimistic update
   */
  const sendMessage = useCallback(
    async (chatId, data) => {
      if (!token || !chatId) {
        console.error("❌ Missing token or chatId for sendMessage");
        return null;
      }

      // Create optimistic message
      const optimisticMessage = {
        _id: `temp-${Date.now()}`,
        chat_id: chatId,
        sender_id: getUserId(),
        content: data.content || data.text,
        timestamp: new Date().toISOString(),
        status: "sending",
        is_encrypted: true,
        ...data,
      };

      // Add to UI immediately
      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const response = await messageApi.sendMessage(chatId, data, token);

        if (response?.message) {
          // Replace optimistic message with real one
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === optimisticMessage._id ? response.message : msg
            )
          );

          messageSetRef.current.add(response.message._id);

          // Update chat preview
          loadChats();

          return response.message;
        }
      } catch (err) {
        console.error("❌ Send message failed:", err);

        // Mark message as failed
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === optimisticMessage._id
              ? { ...msg, status: "failed" }
              : msg
          )
        );

        throw err;
      }
    },
    [token, getUserId, loadChats]
  );

  /**
   * ✅ ENHANCED: Handle new message with deduplication
   */
  const handleNewMessage = useCallback(
    (msg) => {
      if (!msg || !msg._id || !msg.chat_id) {
        console.warn("⚠️ Received invalid message:", msg);
        return;
      }

      // Prevent duplicates
      if (messageSetRef.current.has(msg._id)) {
        console.log("⚠️ Duplicate message ignored:", msg._id);
        return;
      }

      console.log("📨 New message received:", msg._id);

      // Add to active chat if it matches
      if (msg.chat_id === activeChatId) {
        setMessages((prev) => [...prev, msg]);
        messageSetRef.current.add(msg._id);

        // Mark as seen if chat is active
        if (socket && isConnected) {
          socket.emit("mark_seen", {
            message_id: msg._id,
            chat_id: msg.chat_id,
          });
        }
      }

      // Update chat list
      loadChats();
    },
    [activeChatId, socket, isConnected, loadChats]
  );

  /**
   * ✅ ENHANCED: Handle typing start
   */
  const handleTypingStart = useCallback(
    ({ chat_id, user_id, username }) => {
      if (!chat_id || !user_id || chat_id !== activeChatId) return;
      if (user_id === getUserId()) return; // Don't show own typing

      console.log(`⌨️ ${username || user_id} is typing in ${chat_id}`);

      setTypingUsers((prev) => {
        if (prev.find((u) => u.user_id === user_id)) return prev;
        return [...prev, { user_id, username }];
      });

      // Auto-clear after 5 seconds
      if (typingTimeoutRef.current[user_id]) {
        clearTimeout(typingTimeoutRef.current[user_id]);
      }

      typingTimeoutRef.current[user_id] = setTimeout(() => {
        handleTypingStop({ chat_id, user_id });
      }, 5000);
    },
    [activeChatId, getUserId]
  );

  /**
   * ✅ ENHANCED: Handle typing stop
   */
  const handleTypingStop = useCallback(
    ({ chat_id, user_id }) => {
      if (!chat_id || !user_id || chat_id !== activeChatId) return;

      console.log(`⌨️ ${user_id} stopped typing`);

      setTypingUsers((prev) => prev.filter((u) => u.user_id !== user_id));

      if (typingTimeoutRef.current[user_id]) {
        clearTimeout(typingTimeoutRef.current[user_id]);
        delete typingTimeoutRef.current[user_id];
      }
    },
    [activeChatId]
  );

  /**
   * ✅ NEW: Emit typing indicator
   */
  const emitTyping = useCallback(
    (chatId, isTyping) => {
      if (!socket || !isConnected || !chatId) return;

      safeEmit(isTyping ? "typing_start" : "typing_stop", {
        chat_id: chatId,
        user_id: getUserId(),
        username: user?.username,
      });
    },
    [socket, isConnected, safeEmit, getUserId, user]
  );

  /**
   * ✅ ENHANCED: Handle message seen
   */
  const handleMessageSeen = useCallback(({ message_id, user_id }) => {
    setMessages((prev) =>
      prev.map((m) =>
        m._id === message_id
          ? { ...m, seen_by: [...new Set([...(m.seen_by || []), user_id])] }
          : m
      )
    );
  }, []);

  /**
   * ✅ ENHANCED: Handle reaction added
   */
  const handleReactionAdded = useCallback(({ message_id, emoji, user_id }) => {
    setMessages((prev) =>
      prev.map((m) =>
        m._id === message_id
          ? {
              ...m,
              reactions: [...(m.reactions || []), { emoji, user_id }],
            }
          : m
      )
    );
  }, []);

  /**
   * ✅ EFFECT: Register socket event handlers
   */
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("📡 Registering chat socket handlers");

    // Message events
    socket.on("message:new", handleNewMessage);
    socket.on("new_message", handleNewMessage); // Backward compatibility

    // Typing events
    socket.on("typing_start", handleTypingStart);
    socket.on("typing_stop", handleTypingStop);

    // Read receipts
    socket.on("message_seen", handleMessageSeen);

    // Reactions
    socket.on("reaction_added", handleReactionAdded);

    // Cleanup
    return () => {
      console.log("📡 Unregistering chat socket handlers");
      
      socket.off("message:new", handleNewMessage);
      socket.off("new_message", handleNewMessage);
      socket.off("typing_start", handleTypingStart);
      socket.off("typing_stop", handleTypingStop);
      socket.off("message_seen", handleMessageSeen);
      socket.off("reaction_added", handleReactionAdded);
    };
  }, [
    socket,
    isConnected,
    handleNewMessage,
    handleTypingStart,
    handleTypingStop,
    handleMessageSeen,
    handleReactionAdded,
  ]);

  /**
   * ✅ EFFECT: Load chats on mount
   */
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    loadChats();
  }, [isAuthenticated, token, loadChats]);

  /**
   * ✅ EFFECT: Rejoin room on reconnection
   */
  useEffect(() => {
    if (isConnected && activeChatId) {
      console.log(`🔄 Rejoining room after reconnection: ${activeChatId}`);
      
      socket.emit("join_chat", {
        chat_id: activeChatId,
        user_id: getUserId(),
      });
    }
  }, [isConnected, activeChatId, socket, getUserId]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        messages,
        typingUsers,
        loadingMessages,
        loadingChats,
        hasMore,
        page,

        // Methods
        openChat,
        sendMessage,
        reloadChats: loadChats,
        loadMoreMessages,
        emitTyping,

        // State setters (for external use)
        setMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
