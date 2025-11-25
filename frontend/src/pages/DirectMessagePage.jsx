// FILE: src/pages/DirectMessagePage.jsx

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useChat } from "../context/ChatContext";
import { useSocket } from "../context/SocketContext";

import ChatWindow from "../components/ChatWindow";  
import useChats from "../hooks/useChats";

export default function DirectMessagePage() {
  const { userId } = useParams(); // /dm/:userId

  const { socket, safeEmit } = useSocket();
  const { activeChatId, openChat } = useChat();
  const { activeChat } = useChats();

  const [loading, setLoading] = useState(true);

  /* ---------------------------------------------------------
      OPEN (OR CREATE) DIRECT MESSAGE ROOM
  --------------------------------------------------------- */
  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem("access_token");

    // 1. Tell backend we want to open a DM
    safeEmit("dm:open", { peer_id: userId });

    // 2. REST: get or create DM chat
    fetch(`${import.meta.env.VITE_API_BASE}/dm/open/${userId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.chat?._id) {
          openChat(data.chat._id);
        }
      })
      .finally(() => setLoading(false));
  }, [userId, safeEmit, openChat]);

  /* ---------------------------------------------------------
      LOADING STATE
  --------------------------------------------------------- */
  if (loading || !activeChatId) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-gray-400">
        Opening chat…
      </div>
    );
  }

  /* ---------------------------------------------------------
      MAIN DM CHAT UI
  --------------------------------------------------------- */
  return (
    <div className="h-screen w-full bg-[#0D1117] text-white">
      <ChatWindow chat={activeChat} />
    </div>
  );
}
