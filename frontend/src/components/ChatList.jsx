// FILE: src/components/ChatList.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, MoreVertical, MessageSquarePlus, Users } from "lucide-react";
import NewChatModal from "./NewChatModal";
import NewGroupModal from "./NewGroupModal";

import { EncryptionContext } from "../context/EncryptionContext";
import { useAuth } from "../context/AuthContext";

export default function ChatList({ chats, onSelect, activeChatId, onChatCreated }) {
  const { user } = useAuth();
  const { decryptPreview } = React.useContext(EncryptionContext);
  const [previews, setPreviews] = useState({}); // Map<chatId, previewText>
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Decrypt previews when chats change
  React.useEffect(() => {
    chats.forEach(async (chat) => {
      if (chat.last_message_preview === "Encrypted Message" || !chat.last_message_preview) {
        if (chat.last_message_encrypted) {
          const decrypted = await decryptPreview(chat._id, chat.last_message_encrypted);
          setPreviews(prev => ({ ...prev, [chat._id]: decrypted }));
        }
      } else {
        setPreviews(prev => ({ ...prev, [chat._id]: chat.last_message_preview }));
      }
    });
  }, [chats, decryptPreview]);

  const handleChatCreated = (newChat) => {
    console.log("✅ New chat created:", newChat);
    if (onChatCreated) onChatCreated();
    setShowNewChatModal(false);
    setShowNewGroupModal(false);
  };

  const filteredChats = chats.filter(chat =>
    (chat.title || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#111b21] text-[#e9edef]">
      {/* Header */}
      <div className="px-4 py-3 bg-[#202c33] flex items-center justify-between shrink-0">
        <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden cursor-pointer">
          {/* Placeholder Avatar */}
          <div className="w-full h-full flex items-center justify-center bg-[#6a7175] text-white font-bold">
            {user?.username?.[0]?.toUpperCase() || "U"}
          </div>
        </div>

        <div className="flex items-center gap-4 text-[#aebac1]">
          <button
            title="Create Group"
            className="hover:text-white transition"
            onClick={() => setShowNewGroupModal(true)}
          >
            <Users size={20} />
          </button>
          <button
            onClick={() => setShowNewChatModal(true)}
            title="New Chat"
            className="hover:text-white transition"
          >
            <MessageSquarePlus size={20} />
          </button>
          <button title="Menu" className="hover:text-white transition">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 bg-[#111b21] border-b border-[#202c33]">
        <div className="relative flex items-center bg-[#202c33] rounded-lg h-9 px-3">
          <Search size={18} className="text-[#aebac1] mr-4" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-[#e9edef] placeholder-[#8696a0] w-full"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredChats.length === 0 && (
          <div className="p-8 text-center text-[#8696a0] text-sm">
            No chats found.
          </div>
        )}

        {filteredChats.map((chat, i) => {
          const isActive = activeChatId === chat._id;
          const preview = previews[chat._id] || chat.last_message_preview || "";

          return (
            <div
              key={chat._id}
              onClick={() => onSelect(chat._id)}
              className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors group
              ${isActive ? "bg-[#2a3942]" : "hover:bg-[#202c33]"}
            `}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gray-600 shrink-0 overflow-hidden">
                <div className="w-full h-full flex items-center justify-center bg-[#6a7175] text-white text-lg font-medium">
                  {(chat.title || "D")[0]}
                </div>
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-center border-b border-[#222d34] group-hover:border-transparent pb-3 pt-1 h-full ml-1">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="text-[17px] text-[#e9edef] font-normal truncate">
                    {chat.title || "Direct Chat"}
                  </h3>
                  {chat.last_message_at && (
                    <span className={`text-xs ${chat.unreadCount > 0 ? "text-[#00a884] font-medium" : "text-[#8696a0]"}`}>
                      {new Date(chat.last_message_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                      })}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-[14px] text-[#8696a0] truncate max-w-[90%]">
                    {preview}
                  </p>

                  {chat.unreadCount > 0 && (
                    <div className="w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center text-[#111b21] text-xs font-bold shrink-0">
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onChatCreated={handleChatCreated}
      />

      <NewGroupModal
        isOpen={showNewGroupModal}
        onClose={() => setShowNewGroupModal(false)}
        onGroupCreated={handleChatCreated}
      />
    </div>
  );
}
