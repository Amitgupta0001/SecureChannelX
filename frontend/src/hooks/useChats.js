/**
 * ✅ ENHANCED: SecureChannelX - Chats Hook
 * ----------------------------------------
 * Manages chat list and operations
 * 
 * Changes:
 *   - Fixed: Chat loading and caching
 *   - Fixed: Real-time updates
 *   - Added: Chat search
 *   - Added: Chat filtering
 *   - Added: Chat sorting
 *   - Added: Unread count tracking
 *   - Enhanced: Performance optimization
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import chatApi from "../api/chatApi";

export default function useChats() {
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, unread, groups, direct
  const [sortBy, setSortBy] = useState("recent"); // recent, unread, name

  const chatsLoadedRef = useRef(false);

  /**
   * ✅ HELPER: Get user ID
   */
  const getUserId = useCallback(() => {
    return user?.id || user?.user_id || user?._id;
  }, [user]);

  /**
   * ✅ ENHANCED: Load all chats
   */
  const loadChats = useCallback(async () => {
    if (!token) {
      console.warn("⚠️ Cannot load chats: Not authenticated");
      return;
    }

    setLoading(true);

    try {
      console.log("📥 Loading chats...");

      const response = await chatApi.getAllChats(token);
      const chatsList = response?.chats || response?.data?.chats || response || [];

      setChats(chatsList);
      chatsLoadedRef.current = true;

      console.log(`✅ Loaded ${chatsList.length} chats`);
    } catch (err) {
      console.error("❌ Failed to load chats:", err);

      // Don't clear chats on error
      if (err.response?.status !== 401) {
        console.log("⚠️ Keeping existing chats due to error");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * ✅ NEW: Create new chat
   */
  const createChat = useCallback(
    async (participantId, message = null) => {
      if (!token || !participantId) return null;

      try {
        console.log(`➕ Creating chat with user ${participantId}`);

        const response = await chatApi.createChat(
          { participant_id: participantId, initial_message: message },
          token
        );

        if (response?.chat) {
          setChats((prev) => [response.chat, ...prev]);
          console.log("✅ Chat created:", response.chat.id);
          return response.chat;
        }
      } catch (err) {
        console.error("❌ Failed to create chat:", err);
        throw err;
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Delete chat
   */
  const deleteChat = useCallback(
    async (chatId) => {
      if (!token || !chatId) return;

      try {
        console.log(`🗑️ Deleting chat ${chatId}`);

        const response = await chatApi.deleteChat(chatId, token);

        if (response?.success) {
          setChats((prev) => prev.filter((c) => c.id !== chatId && c._id !== chatId));
          console.log("✅ Chat deleted");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to delete chat:", err);
        throw err;
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Clear chat history
   */
  const clearChat = useCallback(
    async (chatId) => {
      if (!token || !chatId) return;

      try {
        console.log(`🧹 Clearing chat ${chatId}`);

        const response = await chatApi.clearChat(chatId, token);

        if (response?.success) {
          // Update local chat to show empty state
          setChats((prev) =>
            prev.map((c) =>
              (c.id === chatId || c._id === chatId)
                ? { ...c, last_message: null, unread_count: 0 }
                : c
            )
          );

          console.log("✅ Chat cleared");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to clear chat:", err);
        throw err;
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Mute/unmute chat
   */
  const toggleMute = useCallback(
    async (chatId, mute = true) => {
      if (!token || !chatId) return;

      try {
        console.log(`${mute ? "🔇" : "🔊"} ${mute ? "Muting" : "Unmuting"} chat ${chatId}`);

        const response = await chatApi.muteChat(chatId, mute, token);

        if (response?.success) {
          setChats((prev) =>
            prev.map((c) =>
              (c.id === chatId || c._id === chatId) ? { ...c, is_muted: mute } : c
            )
          );

          console.log(`✅ Chat ${mute ? "muted" : "unmuted"}`);
          return true;
        }
      } catch (err) {
        console.error(`❌ Failed to ${mute ? "mute" : "unmute"} chat:`, err);
        throw err;
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Pin/unpin chat
   */
  const togglePin = useCallback(
    async (chatId, pin = true) => {
      if (!token || !chatId) return;

      try {
        console.log(`${pin ? "📌" : "📍"} ${pin ? "Pinning" : "Unpinning"} chat ${chatId}`);

        const response = await chatApi.pinChat(chatId, pin, token);

        if (response?.success) {
          setChats((prev) =>
            prev.map((c) =>
              (c.id === chatId || c._id === chatId) ? { ...c, is_pinned: pin } : c
            )
          );

          console.log(`✅ Chat ${pin ? "pinned" : "unpinned"}`);
          return true;
        }
      } catch (err) {
        console.error(`❌ Failed to ${pin ? "pin" : "unpin"} chat:`, err);
        throw err;
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Mark chat as read
   */
  const markAsRead = useCallback(
    async (chatId) => {
      if (!token || !chatId) return;

      try {
        const response = await chatApi.markAsRead(chatId, token);

        if (response?.success) {
          setChats((prev) =>
            prev.map((c) =>
              (c.id === chatId || c._id === chatId) ? { ...c, unread_count: 0 } : c
            )
          );

          console.log("✅ Chat marked as read");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to mark as read:", err);
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Get chat by ID
   */
  const getChatById = useCallback(
    (chatId) => {
      return chats.find((c) => c.id === chatId || c._id === chatId);
    },
    [chats]
  );

  /**
   * ✅ NEW: Get chat by participant
   */
  const getChatByParticipant = useCallback(
    (participantId) => {
      return chats.find((c) =>
        c.participants?.some(
          (p) =>
            (p.id === participantId || p._id === participantId || p.user_id === participantId)
        )
      );
    },
    [chats]
  );

  /**
   * ✅ ENHANCED: Filter and sort chats
   */
  const getFilteredChats = useCallback(() => {
    let filtered = [...chats];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      
      filtered = filtered.filter((chat) => {
        const name = chat.name || chat.participant_name || "";
        const lastMessage = chat.last_message?.content || "";
        
        return (
          name.toLowerCase().includes(query) ||
          lastMessage.toLowerCase().includes(query)
        );
      });
    }

    // Apply type filter
    switch (filterType) {
      case "unread":
        filtered = filtered.filter((c) => c.unread_count > 0);
        break;
      case "groups":
        filtered = filtered.filter((c) => c.is_group || c.type === "group");
        break;
      case "direct":
        filtered = filtered.filter((c) => !c.is_group && c.type !== "group");
        break;
      default:
        break;
    }

    // Apply sorting
    switch (sortBy) {
      case "unread":
        filtered.sort((a, b) => (b.unread_count || 0) - (a.unread_count || 0));
        break;
      case "name":
        filtered.sort((a, b) => {
          const nameA = (a.name || a.participant_name || "").toLowerCase();
          const nameB = (b.name || b.participant_name || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
      case "recent":
      default:
        filtered.sort((a, b) => {
          const timeA = new Date(a.last_message?.timestamp || a.updated_at || 0);
          const timeB = new Date(b.last_message?.timestamp || b.updated_at || 0);
          return timeB - timeA;
        });
        break;
    }

    // Pinned chats always on top
    const pinned = filtered.filter((c) => c.is_pinned);
    const unpinned = filtered.filter((c) => !c.is_pinned);

    return [...pinned, ...unpinned];
  }, [chats, searchQuery, filterType, sortBy]);

  /**
   * ✅ NEW: Get total unread count
   */
  const getTotalUnreadCount = useCallback(() => {
    return chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
  }, [chats]);

  /**
   * ✅ ENHANCED: Handle socket events
   */
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("📡 Registering chat socket handlers");

    const handlers = {
      new_message: (data) => {
        console.log("📨 New message in chat:", data.chat_id);

        // Update chat's last message and unread count
        setChats((prev) =>
          prev.map((c) => {
            const chatId = c.id || c._id;
            
            if (chatId === data.chat_id) {
              return {
                ...c,
                last_message: data.message,
                unread_count: (c.unread_count || 0) + 1,
                updated_at: data.message.timestamp,
              };
            }
            
            return c;
          })
        );
      },

      chat_updated: (data) => {
        console.log("📢 Chat updated:", data.chat_id);

        setChats((prev) =>
          prev.map((c) =>
            (c.id === data.chat_id || c._id === data.chat_id)
              ? { ...c, ...data.updates }
              : c
          )
        );
      },

      chat_deleted: (data) => {
        console.log("🗑️ Chat deleted:", data.chat_id);

        setChats((prev) =>
          prev.filter((c) => c.id !== data.chat_id && c._id !== data.chat_id)
        );
      },

      typing_start: (data) => {
        if (data.chat_id) {
          setChats((prev) =>
            prev.map((c) =>
              (c.id === data.chat_id || c._id === data.chat_id)
                ? { ...c, is_typing: true, typing_user: data.username }
                : c
            )
          );
        }
      },

      typing_stop: (data) => {
        if (data.chat_id) {
          setChats((prev) =>
            prev.map((c) =>
              (c.id === data.chat_id || c._id === data.chat_id)
                ? { ...c, is_typing: false, typing_user: null }
                : c
            )
          );
        }
      },
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup
    return () => {
      console.log("📡 Unregistering chat socket handlers");
      
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, isConnected]);

  /**
   * ✅ EFFECT: Load chats on mount
   */
  useEffect(() => {
    if (user && token && !chatsLoadedRef.current) {
      loadChats();
    }
  }, [user, token, loadChats]);

  return {
    // Chat data
    chats: getFilteredChats(),
    allChats: chats,
    loading,

    // Search and filter
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    sortBy,
    setSortBy,

    // Actions
    loadChats,
    createChat,
    deleteChat,
    clearChat,
    toggleMute,
    togglePin,
    markAsRead,

    // Queries
    getChatById,
    getChatByParticipant,
    getTotalUnreadCount,

    // Computed
    chatCount: chats.length,
    unreadCount: getTotalUnreadCount(),
    hasUnread: getTotalUnreadCount() > 0,
  };
}
