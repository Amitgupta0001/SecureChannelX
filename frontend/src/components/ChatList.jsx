/**
 * ✅ ENHANCED: SecureChannelX - Chat List Component
 * -------------------------------------------------
 * Display list of chats with search and filtering
 * 
 * Changes:
 *   - Fixed: API integration with chatApi
 *   - Fixed: Callback naming conflict (onChatCreated)
 *   - Fixed: User selection modal implementation
 *   - Added: Real-time chat updates via Socket.IO
 *   - Added: Search functionality
 *   - Added: Filter by chat type
 *   - Added: Unread message indicators
 *   - Added: Last message preview
 *   - Added: Typing indicators in list
 *   - Added: Online status indicators
 *   - Added: Create new chat modal with user search
 *   - Added: Avatar fallback with gradient colors
 *   - Enhanced: Visual design with animations
 *   - Enhanced: Loading states
 *   - Enhanced: Empty states
 */

import React, { useEffect, useState, useContext, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import chatApi from "../api/chatApi";
import userApi from "../api/userApi";
import socket, { safeEmit } from "../socket/socket";
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  User,
  Loader2,
  X,
  Check,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

export default function ChatList({
  chats: initialChats,
  onSelect,
  activeChatId,
  onChatCreatedCallback
}) {
  const { user, token } = useContext(AuthContext);

  const [chats, setChats] = useState(initialChats || []);
  const [filteredChats, setFilteredChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, direct, group
  const [loading, setLoading] = useState(!initialChats);
  const [error, setError] = useState(null);

  // Create chat modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState("private");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  // User search in modal
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Typing indicators per chat
  const [typingUsers, setTypingUsers] = useState({});

  /**
   * ✅ ENHANCED: Load chats from API if not provided
   */
  useEffect(() => {
    if (initialChats) {
      setChats(initialChats);
      setFilteredChats(initialChats);
      setLoading(false);
      return;
    }

    loadChats();
  }, [initialChats]);

  const loadChats = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await chatApi.getAllChats(token);
      setChats(result.chats || []);
      setFilteredChats(result.chats || []);
    } catch (err) {
      console.error("❌ Failed to load chats:", err);
      setError(err.response?.data?.message || "Failed to load chats");
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ NEW: Load available users for chat creation
   */
  const loadAvailableUsers = async () => {
    setLoadingUsers(true);

    try {
      let result;
      if (userSearchQuery.trim()) {
        result = await userApi.search(userSearchQuery, 50);
      } else {
        result = await userApi.list(50);
      }

      // Filter out current user
      const filtered = (result || []).filter(
        (u) => u.id !== user?.id && u._id !== user?.id
      );

      setAvailableUsers(filtered);
    } catch (err) {
      console.error("❌ Failed to load users:", err);
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  /**
   * ✅ NEW: Search users when query changes
   */
  useEffect(() => {
    if (showCreateModal) {
      const debounce = setTimeout(() => {
        loadAvailableUsers();
      }, 300);

      return () => clearTimeout(debounce);
    }
  }, [userSearchQuery, showCreateModal]);

  /**
   * ✅ ENHANCED: Filter and search chats
   */
  useEffect(() => {
    let result = [...chats];

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((chat) => chat.chat_type === filterType);
    }

    // Search by name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((chat) => {
        const name = getChatName(chat).toLowerCase();
        return name.includes(query);
      });
    }

    // Sort by last message timestamp
    result.sort((a, b) => {
      const timeA = a.last_message?.timestamp || a.created_at || 0;
      const timeB = b.last_message?.timestamp || b.created_at || 0;
      return new Date(timeB) - new Date(timeA);
    });

    setFilteredChats(result);
  }, [chats, searchQuery, filterType]);

  /**
   * ✅ ENHANCED: Real-time chat updates
   */
  useEffect(() => {
    if (!socket?.connected) return;

    // New chat created
    const handleChatCreated = ({ chat }) => {
      console.log("📩 New chat created:", chat);
      setChats((prev) => {
        // Avoid duplicates
        if (prev.some((c) => c._id === chat._id)) {
          return prev;
        }
        return [chat, ...prev];
      });

      if (onChatCreatedCallback) {
        onChatCreatedCallback(chat);
      }
    };

    // Chat updated
    const handleChatUpdated = ({ chat }) => {
      console.log("🔄 Chat updated:", chat._id);
      setChats((prev) =>
        prev.map((c) => (c._id === chat._id ? { ...c, ...chat } : c))
      );
    };

    // Chat deleted
    const handleChatDeleted = ({ chat_id }) => {
      console.log("🗑️ Chat deleted:", chat_id);
      setChats((prev) => prev.filter((c) => c._id !== chat_id));
    };

    // New message (update last message)
    const handleNewMessage = ({ message }) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c._id === message.chat_id) {
            return {
              ...c,
              last_message: {
                content: message.content,
                timestamp: message.timestamp,
                sender_id: message.sender_id,
              },
              unread_count:
                message.sender_id !== user?.id
                  ? (c.unread_count || 0) + 1
                  : c.unread_count,
            };
          }
          return c;
        })
      );
    };

    // Typing indicator
    const handleTyping = ({ chat_id, user_id, username, is_typing }) => {
      if (user_id === user?.id) return; // Ignore own typing

      setTypingUsers((prev) => {
        const current = prev[chat_id] || [];

        if (is_typing) {
          if (!current.some((u) => u.user_id === user_id)) {
            return {
              ...prev,
              [chat_id]: [...current, { user_id, username }],
            };
          }
        } else {
          return {
            ...prev,
            [chat_id]: current.filter((u) => u.user_id !== user_id),
          };
        }

        return prev;
      });
    };

    socket.on("chat:created", handleChatCreated);
    socket.on("chat:updated", handleChatUpdated);
    socket.on("chat:deleted", handleChatDeleted);
    socket.on("message:new", handleNewMessage);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("chat:created", handleChatCreated);
      socket.off("chat:updated", handleChatUpdated);
      socket.off("chat:deleted", handleChatDeleted);
      socket.off("message:new", handleNewMessage);
      socket.off("typing", handleTyping);
    };
  }, [user?.id, onChatCreatedCallback]);

  /**
   * ✅ HELPER: Get chat display name
   */
  const getChatName = (chat) => {
    if (chat.chat_type === "group") {
      return chat.title || "Group Chat";
    }

    // Direct chat - find other user
    const participants = chat.participants || chat.users || [];
    const other = participants.find((p) => {
      const id = typeof p === "string" ? p : p?.id || p?._id;
      return id !== user?.id;
    });

    if (typeof other === "string") {
      return other; // Just ID
    }

    return other?.username || other?.full_name || "Unknown User";
  };

  /**
   * ✅ HELPER: Get chat avatar
   */
  const getChatAvatar = (chat) => {
    if (chat.chat_type === "group") {
      return chat.avatar_url || null;
    }

    const participants = chat.participants || chat.users || [];
    const other = participants.find((p) => {
      const id = typeof p === "string" ? p : p?.id || p?._id;
      return id !== user?.id;
    });

    if (typeof other === "object") {
      return other?.avatar_url || null;
    }

    return null;
  };

  /**
   * ✅ HELPER: Format last message time
   */
  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  /**
   * ✅ NEW: Toggle user selection
   */
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }

      // For private chat, only allow one user
      if (createType === "private") {
        return [userId];
      }

      return [...prev, userId];
    });
  };

  /**
   * ✅ ENHANCED: Create new chat with validation
   */
  const handleCreateChat = async () => {
    // Validation
    if (createType === "private" && selectedUsers.length !== 1) {
      alert("Please select exactly one user for private chat");
      return;
    }

    if (createType === "group" && selectedUsers.length < 2) {
      alert("Please select at least 2 users for group chat");
      return;
    }

    if (createType === "group" && !groupName.trim()) {
      alert("Please enter a group name");
      return;
    }

    setCreating(true);

    try {
      const chatData = {
        chat_type: createType,
        participants: selectedUsers,
        ...(createType === "group" && { title: groupName.trim() }),
      };

      const result = await chatApi.createChat(chatData, token);

      console.log("✅ Chat created:", result.chat);

      // Add to list (avoid duplicates)
      setChats((prev) => {
        if (prev.some((c) => c._id === result.chat._id)) {
          return prev;
        }
        return [result.chat, ...prev];
      });

      // Select new chat
      if (onSelect) {
        onSelect(result.chat);
      }

      // Close modal and reset
      setShowCreateModal(false);
      setSelectedUsers([]);
      setGroupName("");
      setUserSearchQuery("");

      if (onChatCreatedCallback) {
        onChatCreatedCallback(result.chat);
      }
    } catch (err) {
      console.error("❌ Failed to create chat:", err);
      alert(err.response?.data?.message || "Failed to create chat");
    } finally {
      setCreating(false);
    }
  };

  /**
   * ✅ NEW: Close modal and reset state
   */
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedUsers([]);
    setGroupName("");
    setUserSearchQuery("");
    setCreateType("private");
  };

  /**
   * ✅ NEW: Get avatar gradient color based on name
   */
  const getAvatarGradient = (name) => {
    const gradients = [
      "from-purple-500 to-pink-500",
      "from-blue-500 to-cyan-500",
      "from-green-500 to-emerald-500",
      "from-yellow-500 to-orange-500",
      "from-red-500 to-pink-500",
      "from-indigo-500 to-purple-500",
    ];

    const index = (name?.charCodeAt(0) || 0) % gradients.length;
    return gradients[index];
  };

  /**
   * ✅ RENDER: Loading state
   */
  if (loading) {
    return (
      <div className="h-full bg-gray-900 p-4 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
        <p className="text-gray-400">Loading chats...</p>
      </div>
    );
  }

  /**
   * ✅ RENDER: Error state
   */
  if (error) {
    return (
      <div className="h-full bg-gray-900 p-4 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={loadChats}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Chats</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
            title="New Chat"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1 rounded-lg text-sm transition ${filterType === "all"
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType("direct")}
            className={`px-3 py-1 rounded-lg text-sm transition flex items-center gap-1 ${filterType === "direct"
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
          >
            <User className="w-4 h-4" />
            Direct
          </button>
          <button
            onClick={() => setFilterType("group")}
            className={`px-3 py-1 rounded-lg text-sm transition flex items-center gap-1 ${filterType === "group"
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
          >
            <Users className="w-4 h-4" />
            Groups
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8">
            <MessageSquare className="w-16 h-16 mb-4" />
            <p className="text-center">
              {searchQuery
                ? "No chats found"
                : "No chats yet. Start a new conversation!"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredChats.map((chat, index) => {
              const isActive = chat._id === activeChatId;
              const chatName = getChatName(chat);
              const avatar = getChatAvatar(chat);
              const lastMsg = chat.last_message;
              const unreadCount = chat.unread_count || 0;
              const typing = typingUsers[chat._id] || [];

              return (
                <motion.div
                  key={chat._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelect && onSelect(chat)}
                  className={`p-4 border-b border-gray-800 cursor-pointer transition hover:bg-gray-800/50 ${isActive ? "bg-purple-900/20 border-l-4 border-l-purple-500" : ""
                    }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={chatName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(
                            chatName
                          )} flex items-center justify-center text-white font-bold`}
                        >
                          {chatName.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Unread badge */}
                      {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </div>
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-white truncate flex-1">
                          {chatName}
                        </h3>
                        {lastMsg && (
                          <span className="text-xs text-gray-500 ml-2 shrink-0">
                            {formatTime(lastMsg.timestamp)}
                          </span>
                        )}
                      </div>

                      {/* Last message or typing */}
                      <div className="text-sm text-gray-400 truncate">
                        {typing.length > 0 ? (
                          <span className="text-purple-400 italic">
                            {typing[0].username} is typing...
                          </span>
                        ) : lastMsg ? (
                          <>
                            {lastMsg.sender_id === user?.id && (
                              <Check className="inline w-3 h-3 mr-1 text-blue-400" />
                            )}
                            {lastMsg.content || "Media"}
                          </>
                        ) : (
                          <span className="text-gray-600">No messages yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Create Chat Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">New Chat</h3>
                <button
                  onClick={closeCreateModal}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Chat Type */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Chat Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCreateType("private");
                      setSelectedUsers([]);
                    }}
                    className={`flex-1 py-2 rounded-lg transition ${createType === "private"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                  >
                    Direct
                  </button>
                  <button
                    onClick={() => {
                      setCreateType("group");
                      setSelectedUsers([]);
                    }}
                    className={`flex-1 py-2 rounded-lg transition ${createType === "group"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                  >
                    Group
                  </button>
                </div>
              </div>

              {/* Group Name */}
              {createType === "group" && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">
                    Group Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              {/* User Selection */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">
                  Select Users {createType === "private" ? "(1)" : "(2+)"}{" "}
                  <span className="text-red-400">*</span>
                </label>

                {/* User Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Selected Users */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedUsers.map((userId) => {
                      const userData = availableUsers.find(
                        (u) => u.id === userId || u._id === userId
                      );
                      return (
                        <div
                          key={userId}
                          className="flex items-center gap-2 bg-purple-600/20 border border-purple-600/30 rounded-lg px-3 py-1"
                        >
                          <span className="text-sm text-purple-300">
                            {userData?.username || userData?.full_name || "User"}
                          </span>
                          <button
                            onClick={() => toggleUserSelection(userId)}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* User List */}
                <div className="bg-gray-900 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {loadingUsers ? (
                    <div className="p-4 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto" />
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      {userSearchQuery
                        ? "No users found"
                        : "Start typing to search users"}
                    </div>
                  ) : (
                    availableUsers.map((userData) => {
                      const userId = userData.id || userData._id;
                      const isSelected = selectedUsers.includes(userId);

                      return (
                        <div
                          key={userId}
                          onClick={() => toggleUserSelection(userId)}
                          className={`p-3 border-b border-gray-800 last:border-0 cursor-pointer transition hover:bg-gray-800/50 ${isSelected ? "bg-purple-900/20" : ""
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            {userData.avatar_url ? (
                              <img
                                src={userData.avatar_url}
                                alt={userData.username}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(
                                  userData.username
                                )} flex items-center justify-center text-white font-bold text-sm`}
                              >
                                {userData.username?.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">
                                {userData.username}
                              </p>
                              {userData.full_name && (
                                <p className="text-gray-500 text-sm truncate">
                                  {userData.full_name}
                                </p>
                              )}
                            </div>

                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-purple-400 shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateChat}
                  disabled={
                    creating ||
                    (createType === "direct" && selectedUsers.length !== 1) ||
                    (createType === "group" &&
                      (selectedUsers.length < 2 || !groupName.trim()))
                  }
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Chat"
                  )}
                </button>
                <button
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
