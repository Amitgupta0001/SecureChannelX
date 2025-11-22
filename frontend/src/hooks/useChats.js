// FILE: src/hooks/useChats.js
import { useMemo } from "react";
import { useChat } from "../context/ChatContext";
import { useGroups } from "../context/GroupContext";

export default function useChats() {
  const {
    chats,
    activeChatId,
    messages,
    loadingMessages,
    openChat,
    sendMessage,
    reloadChats,
    typingUsers,
  } = useChat();

  const { groups } = useGroups();

  /* -----------------------------------------------------
       SORT CHATS BY NEWEST MESSAGE
  ------------------------------------------------------ */
  const sortedChats = useMemo(() => {
    if (!chats) return [];

    return [...chats].sort((a, b) => {
      const tA = new Date(a.last_message?.timestamp || 0).getTime();
      const tB = new Date(b.last_message?.timestamp || 0).getTime();
      return tB - tA;
    });
  }, [chats]);

  /* -----------------------------------------------------
       GET ACTIVE CHAT OBJECT
  ------------------------------------------------------ */
  const activeChat = useMemo(() => {
    return chats.find((c) => c._id === activeChatId) || null;
  }, [chats, activeChatId]);

  /* -----------------------------------------------------
       MERGE GROUPS + CHATS FOR SIDEBAR (optional)
  ------------------------------------------------------ */
  const sidebarChats = useMemo(() => {
    return sortedChats.map((chat) => {
      const groupData =
        chat.is_group && groups.find((g) => g._id === chat._id);

      return {
        ...chat,
        group: groupData || null,
      };
    });
  }, [sortedChats, groups]);

  /* -----------------------------------------------------
       UNREAD COUNT FOR EACH CHAT
  ------------------------------------------------------ */
  const unreadCount = (chatId) => {
    const chat = chats.find((c) => c._id === chatId);
    return chat?.unread_count || 0;
  };

  /* -----------------------------------------------------
       LAST MESSAGE HELPERS
  ------------------------------------------------------ */
  const lastMessageText = (chat) => {
    if (!chat?.last_message) return "No messages yet";

    const msg = chat.last_message;

    if (msg.message_type === "file") return "📎 File";
    if (msg.message_type === "image") return "🖼️ Image";
    if (msg.message_type === "audio") return "🎵 Audio";
    if (msg.message_type === "video") return "🎬 Video";
    if (msg.message_type === "poll") return "📊 Poll";

    if (msg.encrypted_content && !msg.content) return "🔒 Encrypted message";

    return msg.content || "Unsupported message";
  };

  /* -----------------------------------------------------
       TYPING STATUS
  ------------------------------------------------------ */
  const isTyping = (chatId) => {
    return typingUsers.length > 0 && activeChatId === chatId;
  };

  /* -----------------------------------------------------
       SIDEBAR FRIENDLY DATA
  ------------------------------------------------------ */
  const sidebarFormatted = useMemo(() => {
    return sidebarChats.map((chat) => ({
      ...chat,
      unread: unreadCount(chat._id),
      lastMessage: lastMessageText(chat),
      typing: isTyping(chat._id),
    }));
  }, [sidebarChats, unreadCount, isTyping]);

  return {
    chats,
    sidebarChats: sidebarFormatted,
    sortedChats,

    activeChat,
    activeChatId,
    messages,
    loadingMessages,

    openChat,
    sendMessage,
    reloadChats,

    typingUsers,
    unreadCount,
  };
}
