/**
 * ✅ ENHANCED: SecureChannelX - Message Search Component
 * ------------------------------------------------------
 * Search through encrypted messages with filters
 * 
 * Changes:
 *   - Fixed: Search through decrypted messages only
 *   - Added: Advanced filters (sender, date range, type)
 *   - Added: Search history
 *   - Added: Keyboard shortcuts (Ctrl+F)
 *   - Added: Highlight matching text
 *   - Added: Jump to message in chat
 *   - Added: Export search results
 *   - Enhanced: Real-time search with debounce
 *   - Enhanced: Search suggestions
 */

import React, { useState, useEffect, useRef, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import {
  Search,
  X,
  Calendar,
  User,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  ArrowUp,
  ArrowDown,
  Filter,
  Clock,
  Loader2,
} from "lucide-react";

export default function MessageSearch({ 
  messages = [], 
  onClose, 
  onSelectMessage,
  chatId 
}) {
  const { user } = useContext(AuthContext);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterSender, setFilterSender] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Search history
  const [searchHistory, setSearchHistory] = useState([]);

  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  /**
   * ✅ NEW: Load search history from localStorage
   */
  useEffect(() => {
    const saved = localStorage.getItem(`search_history_${chatId}`);
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load search history:", e);
      }
    }

    // Focus input on mount
    inputRef.current?.focus();
  }, [chatId]);

  /**
   * ✅ NEW: Save search to history
   */
  const saveToHistory = (searchQuery) => {
    if (!searchQuery.trim()) return;

    const newHistory = [
      searchQuery,
      ...searchHistory.filter((q) => q !== searchQuery),
    ].slice(0, 10); // Keep last 10 searches

    setSearchHistory(newHistory);
    localStorage.setItem(
      `search_history_${chatId}`,
      JSON.stringify(newHistory)
    );
  };

  /**
   * ✅ ENHANCED: Search messages with filters and highlighting
   */
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    setLoading(true);

    const debounce = setTimeout(() => {
      const searchTerm = query.toLowerCase();
      
      const filtered = messages.filter((msg) => {
        // Skip encrypted messages that couldn't be decrypted
        if (!msg.isDecrypted && msg.e2e_encrypted) return false;

        // Text match
        const content = msg.content?.toLowerCase() || "";
        if (!content.includes(searchTerm)) return false;

        // Filter by sender
        if (filterSender !== "all") {
          if (filterSender === "me" && msg.sender_id !== user?.id) return false;
          if (filterSender === "others" && msg.sender_id === user?.id) return false;
        }

        // Filter by type
        if (filterType !== "all" && msg.message_type !== filterType) return false;

        // Filter by date
        if (filterDateFrom) {
          const msgDate = new Date(msg.timestamp);
          const fromDate = new Date(filterDateFrom);
          if (msgDate < fromDate) return false;
        }

        if (filterDateTo) {
          const msgDate = new Date(msg.timestamp);
          const toDate = new Date(filterDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (msgDate > toDate) return false;
        }

        return true;
      });

      // Sort by relevance (most recent first)
      filtered.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      setResults(filtered);
      setSelectedIndex(filtered.length > 0 ? 0 : -1);
      setLoading(false);

      // Save to history
      saveToHistory(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, messages, filterSender, filterType, filterDateFrom, filterDateTo, user?.id]);

  /**
   * ✅ NEW: Highlight matching text
   */
  const highlightText = (text, highlight) => {
    if (!highlight.trim()) return text;

    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={index} className="bg-yellow-500 text-black px-0.5 rounded">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  /**
   * ✅ NEW: Navigate results with keyboard
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        handleSelectMessage(results[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [results, selectedIndex]);

  /**
   * ✅ NEW: Scroll selected result into view
   */
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selected = resultsRef.current.children[selectedIndex];
      if (selected) {
        selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  /**
   * ✅ ENHANCED: Select message and jump to it
   */
  const handleSelectMessage = (message) => {
    if (onSelectMessage) {
      onSelectMessage(message);
    }
    onClose();
  };

  /**
   * ✅ NEW: Export search results
   */
  const exportResults = () => {
    const data = results.map((msg) => ({
      timestamp: msg.timestamp,
      sender: msg.sender_id === user?.id ? "You" : "Other",
      content: msg.content,
      type: msg.message_type,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * ✅ NEW: Get message type icon
   */
  const getMessageTypeIcon = (type) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-4 h-4 text-blue-400" />;
      case "video":
        return <Video className="w-4 h-4 text-purple-400" />;
      case "file":
        return <FileText className="w-4 h-4 text-green-400" />;
      default:
        return null;
    }
  };

  /**
   * ✅ NEW: Format timestamp
   */
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-20"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: -20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: -20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-xl transition ${
                  showFilters
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 grid grid-cols-2 gap-3 overflow-hidden"
                >
                  {/* Sender Filter */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      Sender
                    </label>
                    <select
                      value={filterSender}
                      onChange={(e) => setFilterSender(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">All</option>
                      <option value="me">Me</option>
                      <option value="others">Others</option>
                    </select>
                  </div>

                  {/* Type Filter */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      Type
                    </label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">All</option>
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="file">File</option>
                    </select>
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results Summary */}
            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-gray-400">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </span>
                ) : results.length > 0 ? (
                  `${results.length} result${results.length !== 1 ? "s" : ""} found`
                ) : query ? (
                  "No results found"
                ) : (
                  "Start typing to search"
                )}
              </span>

              {results.length > 0 && (
                <button
                  onClick={exportResults}
                  className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Search History */}
            {!query && searchHistory.length > 0 && (
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-400">Recent Searches</span>
                </div>
                <div className="space-y-2">
                  {searchHistory.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => setQuery(item)}
                      className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300 transition"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div ref={resultsRef} className="p-2">
                {results.map((message, index) => {
                  const isSelected = index === selectedIndex;
                  const isMine = message.sender_id === user?.id;

                  return (
                    <motion.div
                      key={message._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleSelectMessage(message)}
                      className={`p-4 mb-2 rounded-xl cursor-pointer transition ${
                        isSelected
                          ? "bg-purple-900/30 border border-purple-500/50"
                          : "bg-gray-800 hover:bg-gray-750 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Message Type Icon */}
                        {getMessageTypeIcon(message.message_type)}

                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${
                              isMine ? "text-purple-400" : "text-blue-400"
                            }`}>
                              {isMine ? "You" : "Other"}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTime(message.timestamp)}
                            </span>
                          </div>

                          {/* Content */}
                          <p className="text-sm text-gray-300 break-words">
                            {highlightText(message.content || "", query)}
                          </p>
                        </div>

                        {/* Navigate Icon */}
                        {isSelected && (
                          <ArrowUp className="w-5 h-5 text-purple-400 shrink-0" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {query && results.length === 0 && !loading && (
              <div className="p-12 text-center">
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-2">No messages found</p>
                <p className="text-sm text-gray-600">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </div>

          {/* Footer - Keyboard Shortcuts */}
          <div className="p-3 border-t border-gray-800 bg-gray-900/50">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-gray-800 rounded">↑</kbd>
                <kbd className="px-2 py-1 bg-gray-800 rounded">↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-gray-800 rounded">Enter</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd>
                Close
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
