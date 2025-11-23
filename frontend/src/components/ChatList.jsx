// FILE: src/components/ChatList.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import NewChatModal from "./NewChatModal";

export default function ChatList({ chats, onSelect, activeChatId, onChatCreated }) {
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const handleChatCreated = (newChat) => {
    console.log("✅ New chat created:", newChat);
    if (onChatCreated) onChatCreated();
    setShowNewChatModal(false);
  };

  return (
    <div className="h-full w-full bg-[#0D1117] text-white overflow-y-auto select-none">
      {/* Header */}
      <div className="p-4 backdrop-blur-md sticky top-0 bg-[#0d1117cc] z-20 border-b border-[#1f2937] flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-wide">Chats</h2>
        <button
          onClick={() => setShowNewChatModal(true)}
          className="px-3 py-1.5 text-sm bg-[#1f6feb] rounded-lg hover:bg-[#2563eb] transition"
        >
          +
        </button>
      </div>

      {/* Chat List */}
      <div className="mt-2">
        {chats.length === 0 && (
          <div className="p-6 text-center text-gray-400">
            No chats yet. Start messaging!
          </div>
        )}

        {chats.map((chat, i) => {
          const isActive = activeChatId === chat._id;

          return (
            <motion.div
              key={chat._id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelect(chat)}
              className={`flex gap-3 px-4 py-3 cursor-pointer transition-all
              border-b border-[#1f2937] 
              ${isActive ? "bg-[#1e293b]" : "hover:bg-[#111827]"}
            `}
            >
              {/* Avatar */}
              <div className="w-12 h-12 bg-gradient-to-br from-[#1f6feb] to-[#3b82f6] rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                {(chat.title || "D")[0]}
              </div>

              {/* Text */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-[16px] truncate">
                    {chat.title || "Direct Chat"}
                  </h3>

                  {chat.last_message_at && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(chat.last_message_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-400 truncate mt-0.5">
                  {chat.last_message_preview || "No messages yet"}
                </p>
              </div>

              {/* Unread badge (optional static) */}
              {chat.unreadCount > 0 && (
                <div className="w-6 h-6 bg-[#1f6feb] rounded-full flex items-center justify-center text-xs font-semibold">
                  {chat.unreadCount}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onChatCreated={handleChatCreated}
      />
    </div>
  );
}
