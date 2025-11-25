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

  // Mark messages as seen when chat becomes active
  useEffect(() => {
    if (activeChatId) {
      markAsSeen();
    }
  }, [activeChatId, messages]);

  // Mobile sidebar handling
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /**  
   * FIX: This must ALWAYS forward the chat ID,
   * even if ChatList mistakenly sends the full chat object.  
   */
  const handleChatSelect = (chat) => {
    const chatId =
      typeof chat === "string" ? chat : chat?._id || chat?.id;

    if (!chatId) {
      console.error("Invalid chat selected:", chat);
      return;
    }

    openChat(chatId);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#0b141a] text-[#e9edef] overflow-hidden">
      {/* ---------------- SIDEBAR ---------------- */}
      <div
        className={`${sidebarOpen ? "w-full md:w-[30%] md:min-w-[340px] md:max-w-[450px]" : "hidden md:flex md:w-[30%] md:min-w-[340px] md:max-w-[450px]"
          } flex flex-col h-full bg-[#111b21] border-r border-[#202c33] z-20`}
      >
        <ChatList
          chats={sidebarChats}
          activeChatId={activeChatId}
          onSelect={handleChatSelect}
          onChatCreated={reloadChats}
        />
      </div>

      {/* ---------------- MAIN CHAT WINDOW ---------------- */}
      <div className={`flex-1 relative h-full bg-[#0b141a] ${!sidebarOpen ? "block" : "hidden md:block"}`}>
        {activeChat ? (
          <ChatWindow
            chat={activeChat}
            messages={decryptedMessages}
            onSendMessage={sendText}
            onSendFile={() => setShowUpload(true)}
            onSearch={() => setShowSearch(true)}
            typingUsers={typingUsers}
            sendReaction={sendReaction}
            onBack={() => setSidebarOpen(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#8696a0] bg-[#222e35] border-b-[6px] border-[#00a884]">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-light text-[#e9edef]">SecureChannelX for Web</h1>
              <p className="text-sm">Send and receive messages without keeping your phone online.<br />Use SecureChannelX on up to 4 linked devices and 1 phone.</p>
              <div className="flex items-center justify-center gap-2 text-xs mt-8">
                <span className="text-[#667781]">🔒 End-to-end encrypted</span>
              </div>
            </div>
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
