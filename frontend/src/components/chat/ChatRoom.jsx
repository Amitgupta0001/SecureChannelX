import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useEncryption } from '../../contexts/EncryptionContext';
import '../../styles/components/ChatRoom.css';
import RoomSelector from "./RoomSelector";
import OnlineUsers from "./OnlineUsers";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";


const ChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rooms, setRooms] = useState(['general', 'random', 'support']);
  const { socket, isConnected } = useSocket();
  const { user, logout } = useAuth();
  const { isInitialized } = useEncryption();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (socket && isConnected && isInitialized) {
      // Join current room
      socket.emit('join_room', { room_id: currentRoom });

      // Load message history
      loadMessages(currentRoom);

      // Socket event listeners
      socket.on('new_message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('user_online', (userData) => {
        setOnlineUsers(prev => {
          if (!prev.find(u => u.user_id === userData.user_id)) {
            return [...prev, userData];
          }
          return prev;
        });
      });

      socket.on('user_offline', (userData) => {
        setOnlineUsers(prev => prev.filter(u => u.user_id !== userData.user_id));
      });

      socket.on('user_typing', (typingData) => {
        setTypingUsers(prev => {
          if (!prev.find(u => u.user_id === typingData.user_id)) {
            return [...prev, typingData];
          }
          return prev;
        });
      });

      socket.on('user_stop_typing', (typingData) => {
        setTypingUsers(prev => prev.filter(u => u.user_id !== typingData.user_id));
      });

      socket.on('message_deleted', (data) => {
        setMessages(prev => prev.filter(msg => msg.id !== data.message_id));
      });

      socket.on('user_joined_room', (data) => {
        console.log(`${data.username} joined room ${data.room_id}`);
      });

      return () => {
        socket.off('new_message');
        socket.off('user_online');
        socket.off('user_offline');
        socket.off('user_typing');
        socket.off('user_stop_typing');
        socket.off('message_deleted');
        socket.off('user_joined_room');
      };
    }
  }, [socket, isConnected, currentRoom, isInitialized]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async (roomId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/messages/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRoomChange = (roomId) => {
    setCurrentRoom(roomId);
    setMessages([]);
    if (socket) {
      socket.emit('join_room', { room_id: roomId });
    }
  };

  const handleSendMessage = async (content, type = 'text') => {
    if (socket && content.trim() && isInitialized) {
      socket.emit('send_message', {
        content: content.trim(),
        room_id: currentRoom,
        type: type
      });
    }
  };

  const handleTyping = (isTyping) => {
    if (socket) {
      if (isTyping) {
        socket.emit('typing', { room_id: currentRoom });
      } else {
        socket.emit('stop_typing', { room_id: currentRoom });
      }
    }
  };

  if (!isInitialized) {
    return (
      <div className="chat-room">
        <div className="encryption-initializing">
          <div className="spinner"></div>
          <p>Initializing encryption...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-room">
      <div className="chat-header">
        <div className="header-left">
          <h1>SecureChannelX</h1>
          <span className="encryption-badge">🔒 End-to-End Encrypted</span>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span>Welcome, {user?.username}</span>
            <div className="connection-status">
              <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={() => window.location.href = '/security'} className="security-btn">
              Security
            </button>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
      </div>

      <div className="chat-container">
        <div className="sidebar">
          <RoomSelector
            rooms={rooms}
            currentRoom={currentRoom}
            onRoomChange={handleRoomChange}
          />
          <OnlineUsers
            onlineUsers={onlineUsers}
            currentUser={user}
          />
        </div>

        <div className="chat-main">
          <div className="room-header">
            <h2>#{currentRoom}</h2>
            <div className="room-info">
              <span className="user-count">{onlineUsers.length} users online</span>
            </div>
          </div>

          <MessageList
            messages={messages}
            currentUser={user}
            typingUsers={typingUsers}
          />

          <MessageInput
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            disabled={!isConnected}
          />
        </div>
      </div>
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatRoom;