// FILE: src/pages/CallsPage.jsx

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useCall } from "../context/CallContext";
import callApi from "../services/callService";        // correct API path
import useChats from "../hooks/useChats";

import VideoCallUI from "../components/VideoCallUI";
import VoiceCallUI from "../components/VoiceCallUI";

export default function CallsPage() {
  const { chatId } = useParams();
  const { activeChat } = useChats();

  const { inCall, callInfo, startCall, endCall } = useCall();

  const [history, setHistory] = useState([]);

  /* --------------------------------------------------------
        LOAD CALL HISTORY
  -------------------------------------------------------- */
  useEffect(() => {
    const loadHistory = async () => {
      const res = await callApi.getCallHistory(chatId);
      if (res?.calls) setHistory(res.calls);
    };
    loadHistory();
  }, [chatId]);

  /* --------------------------------------------------------
        FIND OTHER USER (private chats only)
  -------------------------------------------------------- */
  const loggedInUser = localStorage.getItem("uid");

  const receiverId =
    activeChat &&
    activeChat.chat_type === "private"
      ? activeChat.participants?.find((u) => u !== loggedInUser)
      : null;

  /* --------------------------------------------------------
        IF IN CALL → SHOW CALL UI
  -------------------------------------------------------- */
  if (inCall) {
    return callInfo?.call_type === "video" ? (
      <VideoCallUI endCall={endCall} />
    ) : (
      <VoiceCallUI endCall={endCall} />
    );
  }

  /* --------------------------------------------------------
        CALL HISTORY DISPLAY
  -------------------------------------------------------- */
  return (
    <div className="w-full px-6 py-6 text-white bg-[#0D1117] h-screen overflow-y-auto">
      <h2 className="text-2xl font-bold mb-4">Calls</h2>

      {/* ===== CALL ACTION BUTTONS ===== */}
      {!receiverId && (
        <p className="text-red-400 mb-4">
          Cannot start a call — this is a group chat.
        </p>
      )}

      <div className="flex gap-4 mb-6">
        <button
          disabled={!receiverId}
          onClick={() => startCall(chatId, receiverId, "video")}
          className="px-5 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
        >
          Start Video Call
        </button>

        <button
          disabled={!receiverId}
          onClick={() => startCall(chatId, receiverId, "audio")}
          className="px-5 py-2 bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40"
        >
          Start Voice Call
        </button>
      </div>

      <h3 className="text-lg font-semibold mb-3">Call History</h3>

      {history.length === 0 ? (
        <p className="text-gray-400">No call history available.</p>
      ) : (
        <ul className="space-y-3">
          {history.map((c) => {
            const start = c.started_at ? new Date(c.started_at) : null;
            const end = c.ended_at ? new Date(c.ended_at) : null;

            return (
              <li
                key={c.id}
                className="p-3 bg-[#111827] border border-[#1f2937] rounded-lg"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-semibold capitalize">
                    {c.call_type} call
                  </span>
                  <span className="text-xs opacity-70">
                    {start ? start.toLocaleString() : "Unknown time"}
                  </span>
                </div>

                <p className="text-gray-400">Status: {c.status}</p>

                {c.duration_seconds && (
                  <p className="text-gray-500 mt-1">
                    Duration: {Math.floor(c.duration_seconds / 60)}m{" "}
                    {c.duration_seconds % 60}s
                  </p>
                )}

                {end && (
                  <p className="text-gray-600 text-xs mt-1">
                    Ended at: {end.toLocaleString()}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
