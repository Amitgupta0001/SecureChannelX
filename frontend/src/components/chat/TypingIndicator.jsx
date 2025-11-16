import React from "react";
import "../../styles/components/MessageList.css"; // optional if your dots are styled there

const TypingIndicator = ({ users = [] }) => {
  if (!users.length) return null;

  // Convert users array → readable names
  const names = users.map(u => u.username);

  let typingText = "";
  if (names.length === 1) typingText = `${names[0]} is typing...`;
  else if (names.length === 2) typingText = `${names[0]} and ${names[1]} are typing...`;
  else typingText = `${names.length} people are typing...`;

  return (
    <div className="typing-indicator-container">
      <div className="typing-text">{typingText}</div>

      <div className="typing-dots">
        <span className="dot dot1"></span>
        <span className="dot dot2"></span>
        <span className="dot dot3"></span>
      </div>
    </div>
  );
};

export default TypingIndicator;
