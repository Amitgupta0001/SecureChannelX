import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE } from "../utils/constants";
import { useAuth } from "../context/AuthContext";

export default function NewGroupModal({ isOpen, onClose, onGroupCreated }) {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupName, setGroupName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const token = localStorage.getItem("access_token");

    // Load users when modal opens
    useEffect(() => {
        if (isOpen) {
            loadUsers();
            setSelectedUsers([]);
            setGroupName("");
            setError(null);
        }
    }, [isOpen]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE}/api/users/list`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers((res.data.data.users || []).filter(u => u.id !== currentUser?.id));
        } catch (err) {
            console.error("Failed to load users:", err);
            setError("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (user) => {
        if (selectedUsers.find((u) => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            setError("Please enter a group name");
            return;
        }
        if (selectedUsers.length === 0) {
            setError("Please select at least one member");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const res = await axios.post(
                `${API_BASE}/api/groups/create`,
                {
                    title: groupName,
                    members: selectedUsers.map((u) => u.id),
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            console.log("✅ Group created:", res.data);
            if (onGroupCreated) onGroupCreated(res.data.data.chat_id); // Pass chat ID if available
            onClose();
        } catch (err) {
            console.error("Failed to create group:", err);
            setError(err.response?.data?.message || "Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#161B22] rounded-xl shadow-2xl w-full max-w-md mx-4 border border-[#30363D] flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-[#30363D]">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-white">New Group</h2>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition"
                            >
                                ✕
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Group Subject"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:border-[#1f6feb] outline-none transition"
                        />
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                        {loading && users.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                Loading users...
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
                                {error}
                            </div>
                        )}

                        {!loading && users.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                No users found
                            </div>
                        )}

                        {!loading && users.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-2">Select Members</p>
                                {users.map((user) => {
                                    const isSelected = !!selectedUsers.find((u) => u.id === user.id);
                                    return (
                                        <div
                                            key={user.id}
                                            onClick={() => toggleUser(user)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${isSelected
                                                ? "bg-[#1f6feb]/20 border border-[#1f6feb]"
                                                : "bg-[#0D1117] hover:bg-[#161B22] border border-transparent"
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            <div
                                                className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected
                                                    ? "bg-[#1f6feb] border-[#1f6feb]"
                                                    : "border-gray-600"
                                                    }`}
                                            >
                                                {isSelected && <span className="text-white text-xs">✓</span>}
                                            </div>

                                            {/* Avatar */}
                                            <div className="w-10 h-10 bg-gradient-to-br from-[#1f6feb] to-[#3b82f6] rounded-full flex items-center justify-center text-sm font-bold text-white">
                                                {user.username[0].toUpperCase()}
                                            </div>

                                            {/* Username */}
                                            <div className="flex-1">
                                                <p className={`font-medium ${isSelected ? "text-white" : "text-gray-300"}`}>
                                                    {user.username}
                                                </p>
                                                {user.email && (
                                                    <p className="text-xs opacity-70 text-gray-400">{user.email}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-[#30363D] flex flex-col gap-4">
                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedUsers.map(u => (
                                    <span key={u.id} className="text-xs bg-[#1f6feb] text-white px-2 py-1 rounded-full">
                                        {u.username} ✕
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-[#21262D] text-white rounded-lg hover:bg-[#30363D] transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || selectedUsers.length === 0 || loading}
                                className="flex-1 px-4 py-2 bg-[#1f6feb] text-white rounded-lg hover:bg-[#2563eb] transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Creating..." : `Create Group (${selectedUsers.length})`}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
