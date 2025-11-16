import React, { useState } from "react";
import "../../styles/components/EmojiPicker.css";

const emojis = [
  "😀","😁","😂","🤣","😊","😍","😎","😢","😡","🎉","❤️","🔥","👍","🙏"
];

const EmojiPicker = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState("");

  const filteredEmojis = emojis.filter(e =>
    e.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="emoji-overlay">
      <div className="emoji-modal">
        
        <div className="emoji-header">
          <h3>Pick an Emoji</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="emoji-search-input">
          <input
            type="text"
            placeholder="Search emoji..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="emoji-grid">
          {filteredEmojis.length === 0 && (
            <div className="no-results">No emoji found</div>
          )}

          {filteredEmojis.map((emoji, index) => (
            <button
              key={index}
              className="emoji-item"
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};

export default EmojiPicker;
