import React, { useState, useRef, useCallback } from "react";
import EmojiPicker from "../features/EmojiPicker.jsx";
import FileUpload from "../features/FileUpload.jsx";
import PollCreator from "../features/PollCreator.jsx";
import "../../styles/components/MessageInput.css";

const MessageInput = ({ onSendMessage, onTyping, disabled }) => {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);

  const typingTimeoutRef = useRef(null);

  // --- Message sending ---
  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message, "text");
      setMessage("");
      handleStopTyping();
    }
  };

  // --- Typing logic ---
  const handleInputChange = (e) => {
    setMessage(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = useCallback(() => {
    setIsTyping(false);
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [onTyping]);

  // --- Enter key send ---
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // --- Add emoji to text ---
  const addEmoji = (emoji) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // --- Handle file send ---
  const handleFileSend = (file) => {
    onSendMessage(file, "file");
  };

  // --- Handle poll creation ---
  const handlePollCreate = (poll) => {
    onSendMessage(poll, "poll");
  };

  return (
    <>
      {/* EMOJI MODAL */}
      {showEmojiPicker && (
        <EmojiPicker onSelect={addEmoji} onClose={() => setShowEmojiPicker(false)} />
      )}

      {/* FILE UPLOAD MODAL */}
      {showFileUpload && (
        <FileUpload
          onSend={handleFileSend}
          onClose={() => setShowFileUpload(false)}
        />
      )}

      {/* POLL CREATOR MODAL */}
      {showPollCreator && (
        <PollCreator
          onCreate={handlePollCreate}
          onClose={() => setShowPollCreator(false)}
        />
      )}

      <form className="message-input-form" onSubmit={handleSubmit}>
        <div className="message-input-container">
          
          <div className="input-wrapper">
            <textarea
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={
                disabled ? "Connecting to secure server..." : "Type your encrypted message..."
              }
              disabled={disabled}
              rows={1}
              className="message-textarea"
            />

            <div className="input-actions">
              {/* File Upload */}
              <button
                type="button"
                className="attachment-btn"
                title="Attach file"
                onClick={() => setShowFileUpload(true)}
              >
                📎
              </button>

              {/* Emoji Picker */}
              <button
                type="button"
                className="emoji-btn"
                title="Choose emoji"
                onClick={() => setShowEmojiPicker(true)}
              >
                😊
              </button>

              {/* Poll Creator */}
              <button
                type="button"
                className="poll-btn"
                title="Create poll"
                onClick={() => setShowPollCreator(true)}
              >
                📊
              </button>
            </div>
          </div>

          {/* SEND BUTTON */}
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="send-button"
            title="Send encrypted message"
          >
            <span className="send-icon">🚀</span>
            Send
          </button>
        </div>

        <div className="encryption-notice">
          <span>🔒</span>
          <span>Your message will be end-to-end encrypted</span>
        </div>
      </form>
    </>
  );
};

export default MessageInput;
