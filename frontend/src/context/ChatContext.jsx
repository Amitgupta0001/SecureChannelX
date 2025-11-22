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

  /* -------------------------------------------------------
       LOAD CHATS
  -------------------------------------------------------- */
  const loadChats = useCallback(async () => {
    try {
      const res = await chatApi.getAllChats();
      setChats(res.chats || []);
    } catch (err) {
      console.warn("Failed to load chats:", err);
    }
  }, []);

  /* -------------------------------------------------------
       LOAD CHAT MESSAGES
  -------------------------------------------------------- */
  const loadMessages = useCallback(async (chatId) => {
    setLoadingMessages(true);
    try {
      const res = await messageApi.getMessages(chatId);
      setMessages(res.messages || []);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

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
      const res = await messageApi.sendMessage(chatId, data);

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
       HANDLE TYPING START
  -------------------------------------------------------- */
  const handleTypingStart = ({ chat_id, user_id }) => {
    if (chat_id !== activeChatId) return;

    setTypingUsers((prev) =>
      prev.includes(user_id) ? prev : [...prev, user_id]
    );
  };

  /* -------------------------------------------------------
       HANDLE TYPING STOP
  -------------------------------------------------------- */
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
  useEffect(() => {
    loadChats();
  }, [loadChats]);

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
