// FILE: src/pages/ChatRoom.jsx
import React, { useState, useEffect, useCallback } from "react";
import { getChatDetails, listUserChats, markChatRead } from '../api/chatApi';
import { useParams, Link } from "react-router-dom";

import useMessages from "../hooks/useMessages";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";

import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import MessageSearch from "../components/MessageSearch";
import FileUpload from "../components/FileUpload";

export default function ChatRoom() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ skip: 0, limit: 20, total: 0 });

  const { activeChatId, openChat: openChatContext } = useChat();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const { roomId, userId } = useParams();

  // Use enhanced useMessages API
  const {
    messages,
    sendMessage,
    deleteMessage,
    reactToMessage,
    removeReaction,
    markAsSeen,
    loadMore,
  } = useMessages(activeChatId);

  const [showSearch, setShowSearch] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const typingHandler = (data) => {
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.user_id !== data.user_id);
        return [...filtered, data];
      });
    };
    const stopTypingHandler = (data) => {
      setTypingUsers((prev) => prev.filter((u) => u.user_id !== data.user_id));
    };

    socket.on("user:typing", typingHandler);
    socket.on("user:stopped-typing", stopTypingHandler);

    return () => {
      socket.off("user:typing", typingHandler);
      socket.off("user:stopped-typing", stopTypingHandler);
    };
  }, [socket]);

  useEffect(() => {
    if (activeChatId) {
      markAsSeen(activeChatId);
    }
  }, [activeChatId, markAsSeen]);

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  const handleChatSelect = (chat) => {
    const chatId = typeof chat === "string" ? chat : (chat?._id || chat?.id);
    if (!chatId) {
      console.error("❌ Invalid chat selected:", chat);
      return;
    }
    openChatContext(chatId);
    setSidebarOpen(false);
  };

  const loadChats = useCallback(async (skip = 0) => {
    try {
      setLoading(true);
      const response = await listUserChats(skip, 20);
      const list = Array.isArray(response?.chats) ? response.chats : [];
      setChats(list);
      setPagination({
        skip,
        limit: response?.limit || 20,
        total: response?.total || list.length,
      });
    } catch (error) {
      console.error("❌ Failed to load chats:", error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChatCreated = useCallback(() => {
    loadChats();
  }, [loadChats]);

  const activeChat =
    selectedChat || chats.find((c) => c.id === activeChatId || c._id === activeChatId);

  const sidebarChats = chats.map((chat) => ({
    ...chat,
    id: chat._id || chat.id,
    chatId: chat._id || chat.id,
    _id: chat._id || chat.id,
  }));

  const id = roomId || userId;

  return (
    <div className="flex h-screen bg-[#0b141a] text-[#e9edef] overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`${
          sidebarOpen
            ? "w-full md:w-[30%] md:min-w-[340px] md:max-w-[450px]"
            : "hidden md:flex md:w-[30%] md:min-w-[340px] md:max-w-[450px]"
        } flex flex-col h-full bg-[#111b21] border-r border-[#202c33] z-20`}
      >
        <ChatList
          chats={sidebarChats}
          activeChatId={activeChatId}
          onSelect={handleChatSelect}
          onChatCreated={handleChatCreated}
          loading={loading}
        />
      </div>

      {/* MAIN CHAT WINDOW */}
      <div
        className={`flex-1 relative h-full bg-[#0b141a] ${
          !sidebarOpen ? "block" : "hidden md:block"
        }`}
      >
        {activeChat && activeChatId ? (
          <ChatWindow
            chat={activeChat}
            messages={messages || []}
            onSendMessage={(text) => sendMessage(text)}
            onSendFile={() => setShowUpload(true)}
            onSearch={() => setShowSearch(true)}
            typingUsers={typingUsers}
            sendReaction={(messageId, emoji) => reactToMessage(messageId, emoji)}
            removeReaction={(messageId, emoji) => removeReaction(messageId, emoji)}
            onDeleteMessage={(messageId) => deleteMessage(messageId, true)}
            onBack={() => setSidebarOpen(true)}
            loading={loading}
            onLoadMore={() => loadMore()}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#8696a0] bg-[#222e35] border-b-[6px] border-[#00a884]">
            <div className="text-center space-y-4 px-4">
              <h1 className="text-3xl font-light text-[#e9edef]">
                SecureChannelX for Web
              </h1>
              <p className="text-sm">
                Send and receive messages without keeping your phone online.
                <br />
                Use SecureChannelX on up to 4 linked devices and 1 phone.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs mt-8">
                <span className="text-[#667781]">🔒 End-to-end encrypted</span>
              </div>

              <div className={`mt-4 text-xs ${isConnected ? "text-[#31a24c]" : "text-[#e53935]"}`}>
                {isConnected ? "✅ Connected" : "❌ Disconnected"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEARCH MODAL */}
      {showSearch && activeChat && activeChatId && (
        <MessageSearch roomId={activeChatId} onClose={() => setShowSearch(false)} />
      )}

      {/* FILE UPLOAD MODAL */}
      {showUpload && activeChat && activeChatId && (
        <FileUpload
          roomId={activeChatId}
          onClose={() => setShowUpload(false)}
          onSend={(file) => {
            // Optional: hook could expose encryptFile then sendMessage with attachment metadata
            sendMessage("[File sent]", { type: "file", attachments: [file] });
            setShowUpload(false);
          }}
        />
      )}

      <div className="p-6">
        <h1 className="text-2xl font-semibold">Chat Room</h1>
        <p className="text-gray-600 mt-2">Room/User ID: {id || "(none)"}</p>
        <div className="mt-4">
          <Link className="text-indigo-600 underline" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
