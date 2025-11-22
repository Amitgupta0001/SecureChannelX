// FILE: src/components/TypingIndicator.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TypingIndicator({ isTyping }) {
  return (
    <AnimatePresence>
      {isTyping && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1 px-3 py-2 my-1 ml-3 w-fit rounded-xl bg-[#111827] border border-[#1f2937] shadow text-gray-300"
        >
          {/* Animated dots */}
          <motion.span
            className="w-2 h-2 rounded-full bg-gray-400"
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 0.6, delay: 0.0 }}
          />
          <motion.span
            className="w-2 h-2 rounded-full bg-gray-400"
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
          />
          <motion.span
            className="w-2 h-2 rounded-full bg-gray-400"
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
