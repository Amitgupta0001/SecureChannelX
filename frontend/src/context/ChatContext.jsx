// FILE: src/context/ChatContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { useSocket } from "./SocketContext";
import chatApi from "../api/chatApi";
import messageApi from "../api/messageApi";

import registerChatHandlers, { ChatEmit } from "../sockets/chatHandlers";
import registerTypingHandlers, { TypingEmit } from "../sockets/typingHandlers";

import { useAuth } from "./AuthContext";

const ChatContext = createContext();
export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  /* -------------------------------------------------------
       STATE
  -------------------------------------------------------- */
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const { socket, safeEmit } = useSocket();
  const { user } = useAuth();

  const token =
    user?.access_token ||
    localStorage.getItem("access_token") ||
    null;

  /* -------------------------------------------------------
       LOAD CHATS
  -------------------------------------------------------- */
  const loadChats = useCallback(async () => {
    try {
      console.log("🟦 ChatContext.loadChats called, token:", token?.substring(0, 20) + "...");
      if (!token) return console.warn("No token available to load chats");

      const res = await chatApi.getAllChats(token);
      console.log("🟦 ChatContext.loadChats response:", res);

      // Backend returns res.data.data.chats, but chatApi.getAllChats already unwraps to res.data
      // So we expect res to be the data object: {chats: [...]}
      const chatsList = res?.chats || res || [];
      console.log("🟦 ChatContext setting chats:", chatsList);

      setChats(chatsList);
    } catch (err) {
      console.error("🔴 Failed to load chats:", err);
      console.error("🔴 Error response:", err.response?.data);
    }
  }, [token]);

  /* -------------------------------------------------------
       LOAD CHAT MESSAGES
  -------------------------------------------------------- */
  const loadMessages = useCallback(
    async (chatId) => {
      setLoadingMessages(true);
      try {
        if (!token) return;
        const res = await messageApi.getMessages(chatId, token);
        setMessages(res.messages || []);
      } finally {
        setLoadingMessages(false);
      }
    },
    [token]
  );

  /* -------------------------------------------------------
       OPEN CHAT + JOIN ROOM
  -------------------------------------------------------- */
  const openChat = useCallback(
    (chatId) => {
      setActiveChatId(chatId);
      loadMessages(chatId);

      if (socket) {
        safeEmit("join_chat", {
          chat_id: chatId,
          user_id: user?.id,
        });
      }
    },
    [socket, user, loadMessages, safeEmit]
  );

  /* -------------------------------------------------------
       SEND MESSAGE
  -------------------------------------------------------- */
  const sendMessage = async (chatId, data) => {
    try {
      if (!token) return console.error("Missing token for sendMessage");
      const res = await messageApi.sendMessage(chatId, data, token);

      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
      }
    } catch (err) {
      console.error("Send message failed:", err);
    }
  };

  /* -------------------------------------------------------
       HANDLE NEW MESSAGE
  -------------------------------------------------------- */
  const handleNewMessage = (msg) => {
    if (msg.chat_id === activeChatId) {
      setMessages((prev) => [...prev, msg]);
    }
    loadChats(); // update sidebar previews
  };

  /* -------------------------------------------------------
       HANDLE REACTION
  -------------------------------------------------------- */
  const handleReactionAdded = ({ message_id, emoji, user_id }) => {
    setMessages((prev) =>
      prev.map((m) =>
        m._id === message_id
          ? { ...m, reactions: [...(m.reactions || []), { emoji, user_id }] }
          : m
      )
    );
  };

  /* -------------------------------------------------------
       HANDLE MESSAGE SEEN
  -------------------------------------------------------- */
  const handleMessageSeen = ({ message_id, user_id }) => {
    setMessages((prev) =>
      prev.map((m) =>
        m._id === message_id
          ? { ...m, seen_by: [...new Set([...(m.seen_by || []), user_id])] }
          : m
      )
    );
  };

  /* -------------------------------------------------------
       HANDLE TYPING START/STOP
  -------------------------------------------------------- */
  const handleTypingStart = ({ chat_id, user_id }) => {
    if (chat_id !== activeChatId) return;
    setTypingUsers((prev) =>
      prev.includes(user_id) ? prev : [...prev, user_id]
    );
  };

  const handleTypingStop = ({ chat_id, user_id }) => {
    if (chat_id !== activeChatId) return;
    setTypingUsers((prev) => prev.filter((id) => id !== user_id));
  };

  /* -------------------------------------------------------
       REGISTER SOCKET HANDLERS
  -------------------------------------------------------- */
  useEffect(() => {
    if (!socket) return;

    registerChatHandlers(socket, {
      onNewMessage: handleNewMessage,
      onTypingStart: handleTypingStart,
      onTypingStop: handleTypingStop,
      onMessageSeen: handleMessageSeen,
      onReactionAdded: handleReactionAdded,
    });

    registerTypingHandlers(socket, {
      onTypingStart: handleTypingStart,
      onTypingStop: handleTypingStop,
    });
  }, [socket, activeChatId]);

  /* -------------------------------------------------------
       INITIAL LOAD
  -------------------------------------------------------- */
  const { access_token } = useAuth();

  useEffect(() => {
    if (!token) return; // do NOT fetch chats until logged in
    loadChats();
  }, [token, loadChats]);


  /* -------------------------------------------------------
       PROVIDER
  -------------------------------------------------------- */
  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        messages,
        typingUsers,
        loadingMessages,

        openChat,
        sendMessage,
        reloadChats: loadChats,

        TypingEmit,
        ChatEmit,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
