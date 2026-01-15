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

import { Link } from "react-router-dom";

// ... (existing imports)

export default function ChatList({
  // ... props
}) {
  // ... existing code ...

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link to="/settings" title="Settings" className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden hover:opacity-80 transition block">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold bg-[#00a884]">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </Link>
            <h2 className="text-xl font-bold text-white">Chats</h2>
          </div>

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
