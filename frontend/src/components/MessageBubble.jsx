/**
 * ✅ ENHANCED: SecureChannelX - Message Bubble Component
 * ------------------------------------------------------
 * Display individual messages with reactions and options
 * 
 * Changes:
 *   - Fixed: Proper sender detection
 *   - Added: Long-press context menu
 *   - Added: Reply preview
 *   - Added: Forward message
 *   - Added: Copy text
 *   - Added: Delete for everyone (within 5 min)
 *   - Added: Edit message (within 15 min)
 *   - Added: Message status indicators
 *   - Added: Link preview
 *   - Enhanced: File/media rendering
 *   - Enhanced: Timestamp formatting
 */

import React, { useState, useRef, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import {
  MoreVertical,
  Reply,
  Forward,
  Copy,
  Trash2,
  Edit3,
  Check,
  CheckCheck,
  Clock,
  Download,
  ExternalLink,
} from "lucide-react";

export default function MessageBubble({
  message,
  onReply,
  onReact,
  onDelete,
  onEdit,
  onForward,
}) {
  const { user } = useContext(AuthContext);

  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || "");

  const menuRef = useRef(null);
  const longPressTimer = useRef(null);

  const isMine = message.sender_id === user?.id || message.user_id === user?.id;

  /**
   * ✅ NEW: Calculate if message can be edited/deleted
   */
  const canEdit = () => {
    if (!isMine) return false;
    const sentAt = new Date(message.timestamp);
    const now = new Date();
    const diffMinutes = (now - sentAt) / 1000 / 60;
    return diffMinutes < 15; // 15 minutes
  };

  const canDeleteForEveryone = () => {
    if (!isMine) return false;
    const sentAt = new Date(message.timestamp);
    const now = new Date();
    const diffMinutes = (now - sentAt) / 1000 / 60;
    return diffMinutes < 5; // 5 minutes
  };

  /**
   * ✅ NEW: Close menu when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  /**
   * ✅ NEW: Long-press for mobile context menu
   */
  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  /**
   * ✅ NEW: Copy message text
   */
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  };

  /**
   * ✅ NEW: Handle edit save
   */
  const handleEditSave = () => {
    if (editText.trim() && editText !== message.content) {
      onEdit?.(message._id, editText.trim());
    }
    setEditing(false);
    setEditText(message.content || "");
  };

  /**
   * ✅ NEW: Detect and render links
   */
  const renderContentWithLinks = (text) => {
    if (!text) return null;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  /**
   * ✅ NEW: Get message status icon
   */
  const getStatusIcon = () => {
    if (message.deleted) {
      return <Trash2 className="w-3 h-3 text-gray-500" />;
    }

    if (!isMine) return null;

    if (message.read) {
      return <CheckCheck className="w-4 h-4 text-blue-400" />;
    }

    if (message.delivered) {
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    }

    if (message.sent) {
      return <Check className="w-4 h-4 text-gray-400" />;
    }

    return <Clock className="w-4 h-4 text-gray-500 animate-pulse" />;
  };

  /**
   * ✅ NEW: Format timestamp
   */
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /**
   * ✅ NEW: Render file/media content
   */
  const renderMediaContent = () => {
    if (message.message_type === "image" && message.file_url) {
      return (
        <div className="rounded-lg overflow-hidden mb-2 max-w-sm">
          <img
            src={message.file_url}
            alt="Shared image"
            className="w-full h-auto"
            loading="lazy"
          />
        </div>
      );
    }

    if (message.message_type === "video" && message.file_url) {
      return (
        <div className="rounded-lg overflow-hidden mb-2 max-w-sm">
          <video
            src={message.file_url}
            controls
            className="w-full h-auto"
            preload="metadata"
          />
        </div>
      );
    }

    if (message.message_type === "file" && message.file_url) {
      return (
        <a
          href={message.file_url}
          download
          className="flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition mb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-5 h-5 text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {message.file_name || "File"}
            </p>
            {message.file_size && (
              <p className="text-xs text-gray-400">
                {(message.file_size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
        </a>
      );
    }

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"} mb-3 group`}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onMouseDown={handleLongPressStart}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
    >
      <div className={`max-w-[70%] relative`}>
        {/* Reply Preview */}
        {message.reply_to && (
          <div className="mb-1 px-3 py-2 bg-gray-800/50 rounded-t-lg border-l-2 border-purple-500">
            <p className="text-xs text-gray-400 mb-1">Replying to</p>
            <p className="text-sm text-gray-300 truncate">
              {message.reply_to.content}
            </p>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-4 py-2 relative ${
            isMine
              ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white"
              : "bg-gray-800 text-gray-100"
          } ${message.deleted ? "opacity-60" : ""}`}
        >
          {/* Options Button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`absolute -right-8 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${
              isMine ? "bg-purple-700" : "bg-gray-700"
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Media Content */}
          {renderMediaContent()}

          {/* Text Content */}
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEditSave();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="w-full px-2 py-1 bg-gray-900/50 rounded text-sm focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  className="text-xs px-2 py-1 bg-green-600 rounded hover:bg-green-700 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditText(message.content || "");
                  }}
                  className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm break-words whitespace-pre-wrap">
              {message.deleted ? (
                <span className="italic text-gray-400">
                  This message was deleted
                </span>
              ) : (
                renderContentWithLinks(message.content)
              )}
            </p>
          )}

          {/* Edited Indicator */}
          {message.edited && !editing && (
            <span className="text-xs text-gray-400 italic ml-2">edited</span>
          )}

          {/* Timestamp & Status */}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className={`text-xs ${isMine ? "text-white/70" : "text-gray-500"}`}>
              {formatTime(message.timestamp)}
            </span>
            {getStatusIcon()}
          </div>

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="absolute -bottom-3 right-2 flex gap-1 bg-gray-900 rounded-full px-2 py-1 border border-gray-700">
              {message.reactions.slice(0, 3).map((reaction, index) => (
                <span key={index} className="text-sm">
                  {reaction.emoji}
                </span>
              ))}
              {message.reactions.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{message.reactions.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Context Menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className={`absolute ${
                isMine ? "right-0" : "left-0"
              } top-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[200px]`}
            >
              {/* Reply */}
              <button
                onClick={() => {
                  onReply?.(message);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition text-left"
              >
                <Reply className="w-4 h-4 text-blue-400" />
                <span className="text-sm">Reply</span>
              </button>

              {/* React */}
              <button
                onClick={() => {
                  setShowReactions(!showReactions);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition text-left"
              >
                <span className="text-lg">😊</span>
                <span className="text-sm">React</span>
              </button>

              {/* Forward */}
              <button
                onClick={() => {
                  onForward?.(message);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition text-left"
              >
                <Forward className="w-4 h-4 text-green-400" />
                <span className="text-sm">Forward</span>
              </button>

              {/* Copy */}
              {message.content && (
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition text-left"
                >
                  <Copy className="w-4 h-4 text-purple-400" />
                  <span className="text-sm">Copy</span>
                </button>
              )}

              {/* Edit (Own messages, within 15 min) */}
              {canEdit() && !message.deleted && (
                <button
                  onClick={() => {
                    setEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition text-left"
                >
                  <Edit3 className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">Edit</span>
                </button>
              )}

              {/* Delete */}
              {isMine && !message.deleted && (
                <>
                  {canDeleteForEveryone() && (
                    <button
                      onClick={() => {
                        if (confirm("Delete for everyone?")) {
                          onDelete?.(message._id, true);
                        }
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-900/20 transition text-left text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Delete for Everyone</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm("Delete for you?")) {
                        onDelete?.(message._id, false);
                      }
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-900/20 transition text-left text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Delete for Me</span>
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reaction Picker */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute bottom-full mb-2 bg-gray-800 border border-gray-700 rounded-xl p-2 flex gap-2"
            >
              {["❤️", "👍", "😂", "😮", "😢", "🔥"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact?.(message._id, emoji);
                    setShowReactions(false);
                    setShowMenu(false);
                  }}
                  className="text-2xl hover:scale-125 transition transform"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
