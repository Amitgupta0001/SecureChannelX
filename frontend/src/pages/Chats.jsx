// FILE: src/pages/Chats.jsx

import React from "react";
import useChats from "../hooks/useChats";
import { useNavigate } from "react-router-dom";

export default function Chats() {
  const {
    chats,
    getFilteredChats,
    markAsRead,
  } = useChats();

  const navigate = useNavigate();

  const sidebarChats = getFilteredChats().map((c) => ({
    _id: c._id || c.id,
    title: c.name || c.participant_name || "Unknown",
    unread: c.unread_count || c.unread || 0,
    lastMessage: c.last_message?.content || c.lastMessage || "",
    typing: !!c.is_typing,
  }));

  const handleSelect = (chat) => {
    const id = chat._id;
    if (!id) return;
    markAsRead(id);
    navigate(`/chat/${id}`);
  };

  return (
    <div className="h-screen w-full bg-[#0D1117] text-white p-4 overflow-y-auto">
      <h2 className="text-2xl font-bold mb-4">Chats</h2>

      {sidebarChats.length === 0 ? (
        <div className="text-gray-400 mt-12 text-center">
          No chats yet. Start a conversation!
        </div>
      ) : (
        <div className="space-y-3">
          {sidebarChats.map((chat) => (
            <div
              key={chat._id}
              onClick={() => handleSelect(chat)}
              className={`p-4 rounded-xl cursor-pointer border border-[#1f2937] bg-[#111827] hover:bg-[#1f2937] transition`}
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-lg font-semibold">
                  {chat.title?.[0] || "?"}
                </div>

                <div className="flex-1">
                  {/* Title */}
                  <div className="flex justify-between">
                    <h3 className="font-semibold text-lg">{chat.title}</h3>

                    {/* Unread badge */}
                    {chat.unread > 0 && (
                      <span className="px-3 py-1 text-xs bg-blue-600 rounded-full">
                        {chat.unread}
                      </span>
                    )}
                  </div>

                  {/* Last message / typing indicator */}
                  <p className="text-gray-400 text-sm mt-1">
                    {chat.typing ? "Someone is typing..." : chat.lastMessage || "No messages yet"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
