import React from "react";
import RoomSelector from "./RoomSelector";
import OnlineUsers from "./OnlineUsers";

const ChatSidebar = ({ rooms, currentRoom, onRoomChange, onlineUsers, user }) => {
  return (
    <aside className="chat-sidebar">
      <RoomSelector
        rooms={rooms}
        currentRoom={currentRoom}
        onRoomChange={onRoomChange}
      />

      <OnlineUsers onlineUsers={onlineUsers} currentUser={user} />
    </aside>
  );
};

export default ChatSidebar;
