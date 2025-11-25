// FILE: src/hooks/useChats.js
import { useMemo } from "react";
import { useChat } from "../context/ChatContext";
import { useGroups } from "../context/GroupContext";
import { useAuth } from "../context/AuthContext"; // Import useAuth

export default function useChats() {
  const { user } = useAuth(); // Get current user
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
  /* -----------------------------------------------------
       MERGE GROUPS + CHATS FOR SIDEBAR
  ------------------------------------------------------ */
  const sidebarChats = useMemo(() => {
    return sortedChats.map((chat) => {
      const groupData =
        chat.is_group && groups.find((g) => g._id === chat._id);

      // Calculate Title if missing (for private chats)
      let displayTitle = chat.title;

      // If title is missing or generic "Direct Chat", try to find the other user
      if ((!displayTitle || displayTitle === "Direct Chat") && Array.isArray(chat.participants)) {
        const other = chat.participants.find(p => {
          // Handle both string IDs and object participants
          const pid = typeof p === 'string' ? p : p.id;
          return pid !== user?.id;
        });

        if (other) {
          displayTitle = typeof other === 'string' ? "Unknown User" : other.username;
        }
      }

      return {
        ...chat,
        title: displayTitle || "Chat",
        group: groupData || null,
      };
    });
  }, [sortedChats, groups, user]);

  /* -----------------------------------------------------
       GET ACTIVE CHAT OBJECT
  ------------------------------------------------------ */
  const activeChat = useMemo(() => {
    return sidebarChats.find((c) => c._id === activeChatId) || null;
  }, [sidebarChats, activeChatId]);



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
