// FILE: src/pages/GroupPage.jsx

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";

import { useGroups } from "../context/GroupContext";
import { useChat } from "../context/ChatContext";
import useMessages from "../hooks/useMessages";
import ChatWindow from "../components/ChatWindow";

export default function GroupPage() {
  const { groupId } = useParams();   // /group/:groupId

  const { groups } = useGroups();
  const { openChat, activeChatId } = useChat();

  const group = useMemo(() => groups.find((g) => (g._id || g.id) === groupId), [groups, groupId]);
  const [loading, setLoading] = useState(true);

  /* -------------------------------------------------------
      LOAD GROUP → OPEN CHAT
  -------------------------------------------------------- */
  useEffect(() => {
    if (!groupId) return;

    // Open the group chat in ChatContext
    openChat(groupId);

    // slight delay to prevent “loading flicker”
    const t = setTimeout(() => setLoading(false), 150);
    return () => clearTimeout(t);
  }, [groupId, openChat]);

  const {
    messages,
    sendMessage,
    reactToMessage,
    removeReaction,
    deleteMessage,
    loadMore,
  } = useMessages(activeChatId);

  /* -------------------------------------------------------
      LOADING STATE
  -------------------------------------------------------- */
  if (loading || !group) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-gray-400 bg-[#0D1117]">
        Loading group…
      </div>
    );
  }

  /* -------------------------------------------------------
      MAIN GROUP CHAT UI
  -------------------------------------------------------- */
  return (
    <div className="h-screen w-full bg-[#0D1117] text-white">
      <ChatWindow
        chat={group}
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
