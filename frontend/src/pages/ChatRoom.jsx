// FILE: src/pages/ChatRoom.jsx

import React, { useState, useEffect } from "react";
import useChats from "../hooks/useChats";
import useMessages from "../hooks/useMessages";
import { useSocket } from "../context/SocketContext";

import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import MessageSearch from "../components/MessageSearch";
import FileUpload from "../components/FileUpload";

export default function ChatRoom() {
  const {
    sidebarChats,
    activeChat,
    activeChatId,
    openChat,
    reloadChats,
    messages,
    typingUsers,
  } = useChats();

  const { socket, emit } = useSocket();

  const {
    decryptedMessages,
    sendText,
    sendFile,
    sendPoll,
    sendReaction,
    markAsSeen,
  } = useMessages(activeChatId);

  const [showSearch, setShowSearch] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  /* -----------------------------------------------------
       AUTO MARK MESSAGES AS SEEN WHEN CHAT OPENS
  ------------------------------------------------------ */
  useEffect(() => {
    if (activeChatId) {
      markAsSeen();
    }
  }, [activeChatId, messages]);

  /* -----------------------------------------------------
       MOBILE SIDEBAR HANDLING
  ------------------------------------------------------ */
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleChatSelect = (chatId) => {
    openChat(chatId);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#0D1117] text-white">
      {/* ---------------- SIDEBAR ---------------- */}
      <div
        className={`${
          sidebarOpen ? "w-80" : "w-0 lg:w-80"
        } transition-all bg-[#111827] border-r border-[#1f2937] overflow-hidden`}
      >
        <ChatList
          chats={sidebarChats}
          activeChatId={activeChatId}
          onSelect={handleChatSelect}
        />
      </div>

      {/* ---------------- MAIN CHAT WINDOW ---------------- */}
      <div className="flex-1 relative">
        {activeChat ? (
          <ChatWindow
            chat={activeChat}
            messages={decryptedMessages}
            onSendMessage={sendText}
            onSendFile={() => setShowUpload(true)}
            onSearch={() => setShowSearch(true)}
            typingUsers={typingUsers}
            sendReaction={sendReaction}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            ← Select a chat to start messaging
          </div>
        )}
      </div>

      {/* ---------------- SEARCH MODAL ---------------- */}
      {showSearch && activeChat && (
        <MessageSearch
          roomId={activeChatId}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* ---------------- FILE UPLOAD MODAL ---------------- */}
      {showUpload && activeChat && (
        <FileUpload
          roomId={activeChatId}
          onClose={() => setShowUpload(false)}
          onSend={(file) => {
            sendFile(file);
            setShowUpload(false);
          }}
        />
      )}
    </div>
  );
}
