// FILE: src/components/ThreadView.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import messageApi from "../api/messageApi";
import { AuthContext } from "../context/AuthContext";

export default function ThreadView({
  parentMessage,
  token,
  isOpen,
  onClose,
  socket,
}) {
  const { user } = useContext(AuthContext);

  const [threadMessages, setThreadMessages] = useState([]);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  // Fetch thread messages when opening
  useEffect(() => {
    if (!isOpen || !parentMessage) return;

    (async () => {
      const data = await messageApi.getThreadMessages(
        parentMessage._id || parentMessage.id,
        token
      );
      setThreadMessages(data.thread || []);
      scrollToBottom();
    })();
  }, [isOpen, parentMessage, token]);

  // Live thread updates
  useEffect(() => {
    const handler = (payload) => {
      if (payload.parent_id === parentMessage._id) {
        setThreadMessages((prev) => [...prev, payload.message]);
        scrollToBottom();
      }
    };

    socket.on("thread_message", handler);

    return () => socket.off("thread_message", handler);
  }, [socket, parentMessage]);

  // Send thread message
  const sendThreadMessage = async () => {
    if (!text.trim()) return;

    const parentId = parentMessage._id || parentMessage.id;

    const res = await messageApi.createThreadMessage(parentId, text, token);

    // socket event already updates frontend; optimistic update still helpful
    setThreadMessages((prev) => [
      ...prev,
      {
        id: res.thread_id,
        content: text,
        username: user.username,
        user_id: user.user_id,
        timestamp: new Date().toISOString(),
      },
    ]);

    setText("");
    scrollToBottom();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="thread-panel"
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute top-0 right-0 w-[360px] h-full bg-[#0D1117] border-l border-[#1f2937] shadow-lg z-50 flex flex-col"
      >
        {/* HEADER */}
        <div className="p-4 border-b border-[#1f2937] flex justify-between items-center bg-[#0d1117b3] backdrop-blur-md">
          <div>
            <h2 className="text-white text-lg font-semibold">Thread</h2>
            <p className="text-gray-400 text-xs truncate max-w-[260px]">
              Replying to: {parentMessage.content?.slice(0, 40)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Parent message bubble */}
        <div className="p-4 border-b border-[#1f2937] bg-[#111827] text-gray-300">
          <div className="text-sm font-medium">{parentMessage.username}</div>
          <div className="mt-1">{parentMessage.content}</div>
        </div>

        {/* THREAD MESSAGE LIST */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0D1117]"
        >
          {threadMessages.map((msg, i) => {
            const mine = msg.user_id === user.user_id;

            return (
              <motion.div
                key={msg.id || i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[85%] px-3 py-2 rounded-xl shadow 
                  ${mine ? "bg-[#1f6feb] text-white ml-auto" : "bg-[#111827] text-gray-200"}
                `}
              >
                <div className="text-xs opacity-80 mb-1">{msg.username}</div>
                <div>{msg.content}</div>
                <div className="text-[10px] opacity-50 text-right mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* INPUT AREA */}
        <div className="p-3 border-t border-[#1f2937] bg-[#0d1117bb] backdrop-blur-md flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendThreadMessage()}
            placeholder="Reply to thread…"
            className="flex-1 px-4 py-2 bg-[#111827] border border-[#1f2937] rounded-full text-sm text-gray-200 focus:ring-1 focus:ring-[#2563eb] outline-none"
          />

          <button
            onClick={sendThreadMessage}
            className="px-4 py-2 bg-[#1f6feb] rounded-full hover:bg-[#2563eb] transition active:scale-95"
          >
            Send
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
