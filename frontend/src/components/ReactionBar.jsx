/**
 * ✅ ENHANCED: SecureChannelX - Reaction Bar Component
 * ----------------------------------------------------
 * Add emoji reactions to messages
 * 
 * Changes:
 *   - Fixed: Token validation and error handling
 *   - Fixed: Prevent duplicate reactions from same user
 *   - Added: Remove reaction on re-click
 *   - Added: Reaction count tooltip
 *   - Added: Animation on add/remove
 *   - Added: More emoji options
 *   - Enhanced: Visual feedback
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import messageApi from "../api/messageApi";
import { useSocket } from "../context/SocketContext";

const EMOJIS = [
  "👍", "❤️", "😂", "🔥", "😢", "👏",
  "😮", "🎉", "💯", "🙏", "👀", "💪"
];

export default function ReactionBar({
  messageId,
  chatId,
  token,
  currentUserId,
  existingReactions = [],
  onReact,
}) {
  const { safeEmit } = useSocket();
  const [open, setOpen] = useState(false);
  const [reacting, setReacting] = useState(false);
  const ref = useRef(null);

  /**
   * ✅ NEW: Close picker when clicking outside
   */
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  /**
   * ✅ ENHANCED: Group reactions by emoji with user info
   */
  const groupedReactions = useMemo(() => {
    const groups = {};

    existingReactions.forEach((reaction) => {
      const emoji = reaction.emoji;
      if (!groups[emoji]) {
        groups[emoji] = {
          count: 0,
          users: [],
          hasCurrentUser: false,
        };
      }

      groups[emoji].count += 1;
      groups[emoji].users.push(reaction.user_id || reaction.userId);

      if (
        reaction.user_id === currentUserId ||
        reaction.userId === currentUserId
      ) {
        groups[emoji].hasCurrentUser = true;
      }
    });

    return groups;
  }, [existingReactions, currentUserId]);

  /**
   * ✅ ENHANCED: Add or remove reaction
   */
  const handleReaction = async (emoji) => {
    if (!token) {
      console.error("❌ No token provided for reaction");
      return;
    }

    if (reacting) return;

    setOpen(false);
    setReacting(true);

    try {
      // Check if user already reacted with this emoji
      const existingReaction = groupedReactions[emoji];
      const hasReacted = existingReaction?.hasCurrentUser;

      if (hasReacted) {
        // Remove reaction
        await messageApi.removeReaction(messageId, emoji, token);
        console.log("🗑️ Reaction removed:", emoji);

        if (onReact) {
          onReact({ emoji, action: "remove" });
        }

        // Emit socket event
        safeEmit("reaction:remove", {
          message_id: messageId,
          emoji,
          user_id: currentUserId,
          chat_id: chatId,
        });
      } else {
        // Add reaction
        await messageApi.addReaction(messageId, emoji, token);
        console.log("✅ Reaction added:", emoji);

        if (onReact) {
          onReact({ emoji, action: "add" });
        }

        // Emit socket event
        safeEmit("reaction:add", {
          message_id: messageId,
          emoji,
          user_id: currentUserId,
          chat_id: chatId,
        });
      }
    } catch (error) {
      console.error("❌ Failed to react:", error);
      alert(
        error.response?.data?.message ||
        "Failed to add reaction. Please try again."
      );
    } finally {
      setReacting(false);
    }
  };

  /**
   * ✅ NEW: Get tooltip text for reaction
   */
  const getTooltip = (emoji) => {
    const group = groupedReactions[emoji];
    if (!group) return null;

    if (group.count === 1) {
      return group.hasCurrentUser ? "You reacted" : "1 reaction";
    }

    if (group.hasCurrentUser) {
      return `You and ${group.count - 1} other${group.count > 2 ? "s" : ""}`;
    }

    return `${group.count} reactions`;
  };

  return (
    <div
      className="relative flex items-center gap-2 mt-1 select-none"
      ref={ref}
    >
      {/* Existing Reaction Bubbles */}
      <div className="flex flex-wrap gap-1">
        <AnimatePresence>
          {Object.entries(groupedReactions).map(([emoji, data]) => (
            <motion.button
              key={emoji}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleReaction(emoji)}
              disabled={reacting}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition ${data.hasCurrentUser
                  ? "bg-purple-900/30 border-2 border-purple-500"
                  : "bg-gray-800 border border-gray-700 hover:bg-gray-700"
                }`}
              title={getTooltip(emoji)}
            >
              <span className="text-base">{emoji}</span>
              <span
                className={`text-xs font-medium ${data.hasCurrentUser ? "text-purple-300" : "text-gray-400"
                  }`}
              >
                {data.count}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Reaction Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        disabled={reacting}
        className="text-xl px-2 py-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-full transition"
        title="Add reaction"
      >
        {reacting ? "⏳" : "😊"}
      </button>

      {/* Reaction Picker Popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 bg-gray-900 border border-gray-700 p-2 rounded-xl shadow-2xl flex flex-wrap gap-2 z-50"
            style={{ maxWidth: "240px" }}
          >
            {EMOJIS.map((emoji) => {
              const hasReacted = groupedReactions[emoji]?.hasCurrentUser;

              return (
                <motion.button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  disabled={reacting}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  className={`text-2xl transition transform hover:rotate-12 ${hasReacted
                      ? "opacity-100 scale-110"
                      : "opacity-70 hover:opacity-100"
                    }`}
                  title={hasReacted ? "Remove reaction" : "Add reaction"}
                >
                  {emoji}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
