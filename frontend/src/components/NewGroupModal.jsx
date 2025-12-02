/**
 * ✅ ENHANCED: SecureChannelX - New Group Modal
 * ---------------------------------------------
 * Create new group chats with members
 * 
 * Changes:
 *   - Fixed: Duplicate API calls on modal open
 *   - Fixed: Input validation (group name, members)
 *   - Added: Search/filter users
 *   - Added: Select all/clear all buttons
 *   - Added: Loading states for API calls
 *   - Added: Better error messages
 *   - Enhanced: Visual design
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE } from "../utils/constants";
import { useAuth } from "../context/AuthContext";
import { Search, Users, X, Loader2, CheckCircle } from "lucide-react";

export default function NewGroupModal({ isOpen, onClose, onGroupCreated }) {
  const { user: currentUser } = useAuth();
  const token = localStorage.getItem("access_token");

  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  /**
   * ✅ FIXED: Load users only once when modal opens
   */
  useEffect(() => {
    if (isOpen) {
      loadUsers();
      // Reset state
      setSelectedUsers([]);
      setGroupName("");
      setSearchQuery("");
      setError(null);
    }
  }, [isOpen]);

  /**
   * ✅ ENHANCED: Load users with error handling
   */
  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`${API_BASE}/api/users/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const allUsers = res.data.data?.users || res.data.users || [];
      
      // Filter out current user
      const filteredUsers = allUsers.filter(
        (u) => u.id !== currentUser?.id && u._id !== currentUser?.id
      );

      setUsers(filteredUsers);
      console.log(`✅ Loaded ${filteredUsers.length} users`);
    } catch (err) {
      console.error("❌ Failed to load users:", err);
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ NEW: Filter users by search query
   */
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  /**
   * ✅ ENHANCED: Toggle user selection
   */
  const toggleUser = (user) => {
    const userId = user.id || user._id;

    setSelectedUsers((prev) => {
      const isSelected = prev.some(
        (u) => (u.id || u._id) === userId
      );

      if (isSelected) {
        return prev.filter((u) => (u.id || u._id) !== userId);
      }

      return [...prev, user];
    });
  };

  /**
   * ✅ NEW: Select all filtered users
   */
  const selectAll = () => {
    setSelectedUsers(filteredUsers);
  };

  /**
   * ✅ NEW: Clear all selections
   */
  const clearAll = () => {
    setSelectedUsers([]);
  };

  /**
   * ✅ ENHANCED: Create group with validation
   */
  const handleCreateGroup = async () => {
    // Validation
    if (!groupName.trim()) {
      setError("Please enter a group name");
      return;
    }

    if (groupName.trim().length < 3) {
      setError("Group name must be at least 3 characters");
      return;
    }

    if (selectedUsers.length === 0) {
      setError("Please select at least one member");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const memberIds = selectedUsers.map((u) => u.id || u._id);

      const res = await axios.post(
        `${API_BASE}/api/groups/create`,
        {
          title: groupName.trim(),
          members: memberIds,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log("✅ Group created:", res.data);

      const chatId = res.data.data?.chat_id || res.data.chat_id;

      if (onGroupCreated) {
        onGroupCreated(chatId);
      }

      onClose();
    } catch (err) {
      console.error("❌ Failed to create group:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to create group"
      );
    } finally {
      setCreating(false);
    }
  };

  /**
   * ✅ NEW: Check if user is selected
   */
  const isUserSelected = (user) => {
    const userId = user.id || user._id;
    return selectedUsers.some((u) => (u.id || u._id) === userId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">New Group</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition p-2 hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Group Name Input */}
            <input
              type="text"
              placeholder="Group Subject"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError(null);
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
              maxLength={50}
            />
            {groupName && (
              <p className="text-xs text-gray-500 mt-1 text-right">
                {groupName.length}/50
              </p>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Search & Actions */}
            <div className="p-4 border-b border-gray-800 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
                />
              </div>

              {/* Quick Actions */}
              {filteredUsers.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    {selectedUsers.length} of {filteredUsers.length} selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-purple-400 hover:text-purple-300 transition"
                    >
                      Select All
                    </button>
                    {selectedUsers.length > 0 && (
                      <button
                        onClick={clearAll}
                        className="text-xs text-red-400 hover:text-red-300 transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
                  <p className="text-gray-400 text-sm">Loading users...</p>
                </div>
              )}

              {/* Error */}
              {error && !creating && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              {/* Empty State */}
              {!loading && filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">
                    {searchQuery ? "No users found" : "No users available"}
                  </p>
                </div>
              )}

              {/* Users */}
              {!loading && filteredUsers.length > 0 && (
                <div className="space-y-2">
                  {filteredUsers.map((user) => {
                    const isSelected = isUserSelected(user);

                    return (
                      <motion.div
                        key={user.id || user._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => toggleUser(user)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${
                          isSelected
                            ? "bg-purple-900/30 border-2 border-purple-500"
                            : "bg-gray-800 hover:bg-gray-750 border-2 border-transparent"
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                            isSelected
                              ? "bg-purple-600 border-purple-600"
                              : "border-gray-600"
                          }`}
                        >
                          {isSelected && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {(user.username || "U")[0].toUpperCase()}
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium truncate ${
                              isSelected ? "text-white" : "text-gray-300"
                            }`}
                          >
                            {user.username}
                          </p>
                          {user.email && (
                            <p className="text-xs text-gray-500 truncate">
                              {user.email}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-800 space-y-4">
            {/* Selected Users Pills */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto custom-scrollbar">
                {selectedUsers.map((u) => (
                  <motion.span
                    key={u.id || u._id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-1 text-xs bg-purple-600/20 border border-purple-600/30 text-purple-300 px-2 py-1 rounded-full"
                  >
                    {u.username}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleUser(u);
                      }}
                      className="hover:text-white transition"
                    >
                      ✕
                    </button>
                  </motion.span>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={creating}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-xl transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={
                  creating ||
                  !groupName.trim() ||
                  groupName.trim().length < 3 ||
                  selectedUsers.length === 0
                }
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition font-medium flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create Group (${selectedUsers.length})`
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
