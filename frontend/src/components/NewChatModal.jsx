// FILE: src/components/NewChatModal.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE } from "../utils/constants";

export default function NewChatModal({ isOpen, onClose, onChatCreated }) {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const token = localStorage.getItem("access_token");

    // Load users when modal opens
    useEffect(() => {
        if (isOpen) {
            loadUsers();
        }
    }, [isOpen]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE}/api/users/list`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(res.data.data.users || []);
        } catch (err) {
            console.error("Failed to load users:", err);
            setError("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateChat = async () => {
        if (!selectedUser) {
            setError("Please select a user");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const res = await axios.post(
                `${API_BASE}/api/chats/create`,
                {
                    chat_type: "private",
                    participants: [selectedUser.id],
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            console.log("✅ Chat created:", res.data);
            onChatCreated(res.data.data.chat);
            onClose();
            setSelectedUser(null);
        } catch (err) {
            console.error("Failed to create chat:", err);
            setError(err.response?.data?.message || "Failed to create chat");
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
                    className="bg-[#161B22] rounded-xl shadow-2xl w-full max-w-md mx-4 border border-[#30363D]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-[#30363D]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-white">New Chat</h2>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6 max-h-96 overflow-y-auto">
                        {loading && (
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
                                {users.map((user) => (
                                    <div
                                        key={user.id}
                                        onClick={() => setSelectedUser(user)}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${selectedUser?.id === user.id
                                                ? "bg-[#1f6feb] text-white"
                                                : "bg-[#0D1117] hover:bg-[#161B22] text-gray-300"
                                            }`}
                                    >
                                        {/* Avatar */}
                                        <div className="w-10 h-10 bg-gradient-to-br from-[#1f6feb] to-[#3b82f6] rounded-full flex items-center justify-center text-sm font-bold">
                                            {user.username[0].toUpperCase()}
                                        </div>

                                        {/* Username */}
                                        <div className="flex-1">
                                            <p className="font-medium">{user.username}</p>
                                            {user.email && (
                                                <p className="text-xs opacity-70">{user.email}</p>
                                            )}
                                        </div>

                                        {/* Selected indicator */}
                                        {selectedUser?.id === user.id && (
                                            <div className="text-white">✓</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-[#30363D] flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-[#21262D] text-white rounded-lg hover:bg-[#30363D] transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateChat}
                            disabled={!selectedUser || loading}
                            className="flex-1 px-4 py-2 bg-[#1f6feb] text-white rounded-lg hover:bg-[#2563eb] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Creating..." : "Create Chat"}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
