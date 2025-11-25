// FILE: src/components/MessageSearch.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import messageApi from "../api/messageApi";

export default function MessageSearch({ messages, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Trigger search when query > 2 chars
  useEffect(() => {
    if (query.length > 2) {
      doSearch();
    } else {
      setResults([]);
    }
  }, [query, messages]);

  const doSearch = () => {
    setLoading(true);
    // Client-side search on decrypted messages
    const hits = messages.filter(m =>
      m.content &&
      typeof m.content === 'string' &&
      m.content.toLowerCase().includes(query.toLowerCase())
    );
    setResults(hits);
    setLoading(false);
  };

  const highlightMatch = (text) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }}
          transition={{ duration: 0.2 }}
          className="w-[90%] max-w-xl bg-[#0d1117] border border-[#1f2937] rounded-2xl shadow-xl p-5 text-white"
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b border-[#1f2937] pb-3 mb-4">
            <h3 className="text-xl font-semibold">Search Messages</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Search input */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            autoFocus
            className="w-full px-4 py-2 rounded-xl bg-[#111827] border border-[#1f2937] focus:ring-1 focus:ring-[#2563eb] text-gray-200 mb-4 outline-none"
          />

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
            {loading && (
              <div className="text-center text-gray-400 py-4">Searching…</div>
            )}

            {!loading && results.length === 0 && query.length > 2 && (
              <div className="text-center text-gray-500 py-4">
                No messages found
              </div>
            )}

            {results.map((msg, i) => (
              <motion.div
                key={msg.id || i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-xl bg-[#111827] border border-[#1f2937] shadow-sm hover:bg-[#1a2333] transition cursor-pointer"
              >
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{msg.username}</span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Highlight matches safely */}
                <div
                  className="text-gray-200 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: highlightMatch(msg.content),
                  }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
