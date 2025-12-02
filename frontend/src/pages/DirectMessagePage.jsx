// FILE: src/pages/DirectMessagePage.jsx

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";

import { useChat } from "../context/ChatContext";
import { useSocket } from "../context/SocketContext";
import useMessages from "../hooks/useMessages";
import ChatWindow from "../components/ChatWindow";
import useChats from "../hooks/useChats";

export default function DirectMessagePage() {
  const { userId } = useParams(); // /dm/:userId

  const { safeEmit } = useSocket();
  const { openChat, activeChatId } = useChat();
  const { getChatByParticipant } = useChats();

  const [loading, setLoading] = useState(true);

  /* ---------------------------------------------------------
      OPEN (OR CREATE) DIRECT MESSAGE ROOM
  --------------------------------------------------------- */
  useEffect(() => {
    if (!userId) return;

    // Inform backend via socket
    safeEmit("dm:open", { peer_id: userId });

    // Get or create DM chat via REST
    const token = localStorage.getItem("access_token");
    fetch(`${import.meta.env.VITE_API_BASE}/dm/open/${userId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((r) => r.json())
      .then((data) => {
        const id = data?.chat?._id || data?.chat?.id;
        if (id) openChat(id);
      })
      .finally(() => setLoading(false));
  }, [userId, safeEmit, openChat]);

  const activeChat = useMemo(() => {
    if (!userId) return null;
    const chat = getChatByParticipant(userId);
    return chat || null;
  }, [userId, getChatByParticipant]);

  const {
    messages,
    sendMessage,
    reactToMessage,
    removeReaction,
    deleteMessage,
    loadMore,
  } = useMessages(activeChatId);

  /* ---------------------------------------------------------
      LOADING STATE
  --------------------------------------------------------- */
  if (loading || !activeChatId) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-gray-400 bg-[#0D1117]">
        Opening chat…
      </div>
    );
  }

  /* ---------------------------------------------------------
      MAIN DM CHAT UI
  --------------------------------------------------------- */
  return (
    <div className="h-screen w-full bg-[#0D1117] text-white">
      <ChatWindow
        chat={activeChat}
        messages={messages}
        onSendMessage={(text) => sendMessage(text)}
        sendReaction={(messageId, emoji) => reactToMessage(messageId, emoji)}
        removeReaction={(messageId, emoji) => removeReaction(messageId, emoji)}
        onDeleteMessage={(messageId) => deleteMessage(messageId, true)}
        onLoadMore={() => loadMore()}
      />
    </div>
  );
}
