import React from "react";
import UserAvatar from "./UserAvatar";

const MessageBubble = ({ message, isOwn }) => {
  return (
    <div className={`message-row ${isOwn ? "own" : "other"}`}>
      {!isOwn && <UserAvatar username={message.username} />}

      <div className={`message-bubble ${isOwn ? "bubble-own" : "bubble-other"}`}>
        {message.encrypted_content || "[Empty message]"}
      </div>
    </div>
  );
};

export default MessageBubble;
