// FILE: src/components/SmartReplyBar.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import advancedChatApi from "../api/advancedchatApi";

export default function SmartReplyBar({
  contextMessages = [],
  token,
  onSelectReply,  // callback to send reply text back to ChatWindow
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch smart replies when context changes
  useEffect(() => {
    if (!contextMessages || contextMessages.length === 0) return;

    const lastMessagesText = contextMessages
      .slice(-5)           // last few messages only
      .map((m) => m.content)
      .filter(Boolean);

    if (lastMessagesText.length === 0) return;

    setLoading(true);

    advancedChatApi
      .getSmartReplies(lastMessagesText, token)
      .then((res) => {
        setSuggestions(res.suggestions || []);
        setLoading(false);
      })
      .catch(() => {
        setSuggestions([]);
        setLoading(false);
      });
  }, [contextMessages, token]);

  if (!suggestions.length && !loading) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.15 }}
        className="flex gap-2 px-3 py-2 bg-[#0d1117] border-t border-[#1f2937] overflow-x-auto scrollbar-thin"
      >
        {loading ? (
          <div className="text-gray-400 text-sm italic">Thinking…</div>
        ) : (
          suggestions.map((s, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.92 }}
              className="px-4 py-1.5 bg-[#111827] text-gray-200 text-sm rounded-full border border-[#1f2937] hover:bg-[#1f2937] transition whitespace-nowrap"
              onClick={() => onSelectReply(s)}
            >
              {s}
            </motion.button>
          ))
        )}
      </motion.div>
    </AnimatePresence>
  );
}
