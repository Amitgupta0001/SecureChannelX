import React from "react";

const RoomSelector = ({ rooms, currentRoom, onRoomChange }) => {
  return (
    <div className="room-selector">
      <h3 className="sidebar-title">Rooms</h3>
      <ul>
        {rooms.map((room) => (
          <li
            key={room}
            className={`room-item ${currentRoom === room ? "active" : ""}`}
            onClick={() => onRoomChange(room)}
          >
            #{room}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RoomSelector;
