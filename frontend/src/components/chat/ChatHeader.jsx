const ChatHeader = ({ roomName = "SecureChannelX" }) => {
  return (
    <div className="chat-header">
      <h2>{roomName}</h2>
      <p className="chat-subtitle">End-to-End Encrypted</p>
    </div>
  );
};

export default ChatHeader;
