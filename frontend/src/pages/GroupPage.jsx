// FILE: src/pages/GroupPage.jsx

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useGroups } from "../context/GroupContext";
import { useChat } from "../context/ChatContext";
import useChats from "../hooks/useChats";

import ChatWindow from "../components/ChatWindow";

export default function GroupPage() {
  const { groupId } = useParams();   // /group/:groupId

  const { groups } = useGroups();
  const { activeChat } = useChats();
  const { openChat, activeChatId, messages } = useChat();

  const [loading, setLoading] = useState(true);

  const group = groups.find((g) => g._id === groupId);

  /* -------------------------------------------------------
      LOAD GROUP → OPEN CHAT
  -------------------------------------------------------- */
  useEffect(() => {
    if (!groupId) return;

    // Open the group chat in ChatContext
    openChat(groupId);

    // slight delay to prevent “loading flicker”
    setTimeout(() => setLoading(false), 150);
  }, [groupId, openChat]);

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
      <ChatWindow chat={activeChat} />
    </div>
  );
}
