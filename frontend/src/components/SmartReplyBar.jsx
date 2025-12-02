/**
 * ✅ ENHANCED: SecureChannelX - Smart Reply Bar
 * ---------------------------------------------
 * AI-powered quick reply suggestions
 * 
 * Changes:
 *   - Fixed: Error handling for API failures
 *   - Fixed: Debounce suggestion generation
 *   - Added: Loading skeleton
 *   - Added: Retry mechanism
 *   - Added: Context-aware suggestions
 *   - Enhanced: Visual design with animations
 *   - Enhanced: Accessibility
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import advancedChatApi from "../api/advancedchatApi";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

export default function SmartReplyBar({
  contextMessages = [],
  token,
  onSelectReply,
  enabled = true,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * ✅ ENHANCED: Generate suggestions with debounce
   */
  const generateSuggestions = useCallback(async () => {
    if (!contextMessages || contextMessages.length === 0 || !enabled) {
      setSuggestions([]);
      return;
    }

    // Extract last 5 messages
    const lastMessages = contextMessages
      .slice(-5)
      .map((m) => m.content)
      .filter(Boolean);

    if (lastMessages.length === 0) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await advancedChatApi.getSmartReplies(lastMessages, token);

      if (res.suggestions && Array.isArray(res.suggestions)) {
        // Remove duplicates and limit to 5
        const unique = [...new Set(res.suggestions)].slice(0, 5);
        setSuggestions(unique);
        console.log("✅ Smart replies generated:", unique.length);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error("❌ Failed to generate smart replies:", err);
      setError("Failed to load suggestions");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [contextMessages, token, enabled]);

  /**
   * ✅ EFFECT: Generate suggestions when context changes
   */
  useEffect(() => {
    const debounce = setTimeout(() => {
      generateSuggestions();
    }, 500); // Wait 500ms after last message

    return () => clearTimeout(debounce);
  }, [generateSuggestions]);

  /**
   * ✅ NEW: Retry generation
   */
  const handleRetry = () => {
    generateSuggestions();
  };

  /**
   * ✅ NEW: Handle suggestion click
   */
  const handleSelect = (suggestion) => {
    if (onSelectReply) {
      onSelectReply(suggestion);
    }
    // Optionally clear suggestions after selection
    // setSuggestions([]);
  };

  // Don't render if disabled or no content
  if (!enabled || (!loading && !error && suggestions.length === 0)) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-t border-gray-800 overflow-x-auto scrollbar-thin"
      >
        {/* Icon */}
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-gray-400 font-medium">Quick:</span>
        </div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            <span className="text-xs text-gray-400 italic">
              Generating suggestions...
            </span>
          </motion.div>
        )}

        {/* Error State */}
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <span className="text-xs text-red-400">{error}</span>
            <button
              onClick={handleRetry}
              className="p-1 hover:bg-gray-800 rounded transition"
              title="Retry"
            >
              <RefreshCw className="w-3 h-3 text-gray-400" />
            </button>
          </motion.div>
        )}

        {/* Suggestions */}
        {!loading && !error && suggestions.length > 0 && (
          <div className="flex gap-2 flex-1 overflow-x-auto">
            {suggestions.map((suggestion, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelect(suggestion)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-500/50 text-gray-200 text-sm rounded-full transition whitespace-nowrap shrink-0 active:bg-gray-600"
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
