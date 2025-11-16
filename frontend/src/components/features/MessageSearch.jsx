// frontend/src/components/MessageSearch.jsx
import React, { useState, useEffect } from 'react';
import '../styles/MessageSearch.css';

const MessageSearch = ({ roomId, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length > 2) {
      searchMessages();
    } else {
      setResults([]);
    }
  }, [query]);

  const searchMessages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}&room_id=${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error('Error searching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="message-search-overlay">
      <div className="message-search-modal">
        <div className="search-header">
          <h3>Search Messages</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <div className="search-input">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            autoFocus
          />
        </div>

        <div className="search-results">
          {loading && <div className="loading">Searching...</div>}
          
          {!loading && results.length === 0 && query.length > 2 && (
            <div className="no-results">No messages found</div>
          )}

          {results.map((message) => (
            <div key={message.id} className="search-result">
              <div className="result-content">
                <div className="result-header">
                  <span className="username">{message.username}</span>
                  <span className="timestamp">{formatDate(message.timestamp)}</span>
                </div>
                <div className="message-preview">{message.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MessageSearch;