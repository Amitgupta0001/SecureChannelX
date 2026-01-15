import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Calendar, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MessageSearch = ({ isOpen, onClose, onSelectMessage }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    contact: null,
    startDate: '',
    endDate: ''
  });

  const handleSearch = async () => {
    if (!query && !filters.contact && !filters.startDate) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        q: query,
        limit: 20
      });

      if (filters.contact) params.append('contact_id', filters.contact);
      if (filters.startDate) params.append('start_date', new Date(filters.startDate).toISOString());
      if (filters.endDate) params.append('end_date', new Date(filters.endDate).toISOString());

      const res = await axios.get(`http://localhost:5050/api/search/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setResults(res.data.messages);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) handleSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [query, filters]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="bg-gray-800 w-full max-w-2xl rounded-xl shadow-2xl border border-gray-700 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search Header */}
          <div className="p-4 border-b border-gray-700 flex items-center gap-4">
            <Search className="text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages..."
              className="bg-transparent border-none focus:ring-0 text-white flex-1 text-lg placeholder-gray-500"
              autoFocus
            />
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="w-4 h-4" />
              <input
                type="date"
                className="bg-transparent border-none text-gray-300 focus:ring-0 p-0 text-sm"
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            {/* Add more filters here if needed */}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Searching...</div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-gray-700">
                {results.map((msg) => (
                  <div
                    key={msg.id || msg._id}
                    className="p-4 hover:bg-gray-700/50 cursor-pointer transition-colors"
                    onClick={() => {
                      onSelectMessage(msg);
                      onClose();
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-blue-400">
                        {msg.sender_id === localStorage.getItem('user_id') ? 'You' : 'Contact'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm line-clamp-2">
                      {/* Note: Content is encrypted, so we'd normally decrypt here. 
                            For now showing placeholder or raw if unencrypted for specific types */}
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <div className="p-8 text-center text-gray-500">No messages found</div>
            ) : (
              <div className="p-8 text-center text-gray-500">Type to search history</div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MessageSearch;
