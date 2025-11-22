// FILE: src/components/ReactionBar.jsx
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import messageApi from "../api/messageApi";
import socket from "../sockets/socket";

const EMOJIS = ["👍", "❤️", "😂", "🔥", "😢", "👏", "😮"];

export default function ReactionBar({
  messageId,
  chatId,
  token,
  currentUserId,
  existingReactions = [],
  onReact,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Click outside to close picker
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Submit reaction
  const addReaction = async (emoji) => {
    setOpen(false);

    await messageApi.addReaction(messageId, emoji, token);

    if (onReact) onReact(emoji);

    socket.emit("reaction:add", {
      message_id: messageId,
      emoji,
      user_id: currentUserId,
      chat_id: chatId,
    });
  };

  // Count reactions (emoji => count)
  const grouped = {};
  existingReactions.forEach((r) => {
    if (!grouped[r.emoji]) grouped[r.emoji] = 0;
    grouped[r.emoji] += 1;
  });

  return (
    <div className="relative flex items-center gap-2 mt-1 select-none" ref={ref}>
      {/* Existing reaction bubbles */}
      <div className="flex gap-1">
        {Object.entries(grouped).map(([emoji, count]) => (
          <motion.div
            key={emoji}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0b1220] border border-[#1f2937] text-sm shadow"
          >
            {emoji}
            <span className="text-xs opacity-70">{count}</span>
          </motion.div>
        ))}
      </div>

      {/* Reaction picker button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-gray-400 hover:text-white px-2"
      >
        🙂
      </button>

      {/* Popup reaction picker */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-8 left-0 bg-[#0d1117] border border-[#1f2937] p-2 rounded-xl shadow-xl flex gap-2"
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => addReaction(emoji)}
                className="text-xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
