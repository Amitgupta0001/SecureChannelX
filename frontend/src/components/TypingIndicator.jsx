/**
 * ✅ ENHANCED: SecureChannelX - Typing Indicator Component
 * --------------------------------------------------------
 * Show when users are typing in real-time
 * 
 * Changes:
 *   - Added: Show user names when typing
 *   - Added: Multiple users typing support
 *   - Enhanced: Animation timing
 *   - Enhanced: Visual design
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TypingIndicator({ 
  isTyping, 
  typingUsers = [],  // Array of { user_id, username }
  showUsernames = true 
}) {
  return (
    <AnimatePresence>
      {isTyping && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex items-center gap-2 px-4 py-2 my-2 ml-3 w-fit rounded-2xl bg-gray-800/80 backdrop-blur-sm border border-gray-700 shadow-lg"
        >
          {/* Animated dots */}
          <div className="flex items-center gap-1">
            <motion.span
              className="w-2 h-2 rounded-full bg-purple-400"
              animate={{ y: [0, -4, 0] }}
              transition={{ 
                repeat: Infinity, 
                duration: 0.6, 
                delay: 0.0,
                ease: "easeInOut" 
              }}
            />
            <motion.span
              className="w-2 h-2 rounded-full bg-purple-400"
              animate={{ y: [0, -4, 0] }}
              transition={{ 
                repeat: Infinity, 
                duration: 0.6, 
                delay: 0.15,
                ease: "easeInOut" 
              }}
            />
            <motion.span
              className="w-2 h-2 rounded-full bg-purple-400"
              animate={{ y: [0, -4, 0] }}
              transition={{ 
                repeat: Infinity, 
                duration: 0.6, 
                delay: 0.3,
                ease: "easeInOut" 
              }}
            />
          </div>

          {/* Username(s) */}
          {showUsernames && typingUsers.length > 0 && (
            <span className="text-sm text-gray-300">
              {typingUsers.length === 1 ? (
                <span className="font-medium text-purple-300">
                  {typingUsers[0].username}
                </span>
              ) : typingUsers.length === 2 ? (
                <>
                  <span className="font-medium text-purple-300">
                    {typingUsers[0].username}
                  </span>
                  {" and "}
                  <span className="font-medium text-purple-300">
                    {typingUsers[1].username}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-purple-300">
                    {typingUsers[0].username}
                  </span>
                  {` and ${typingUsers.length - 1} others`}
                </>
              )}{" "}
              {typingUsers.length === 1 ? "is" : "are"} typing...
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
