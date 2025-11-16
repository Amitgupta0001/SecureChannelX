import React from "react";

const OnlineUsers = ({ onlineUsers = [], currentUser }) => {
  return (
    <div className="online-users">
      <h3 className="sidebar-title">Online Users</h3>

      {onlineUsers.length === 0 && <p>No users online</p>}

      <ul>
        {onlineUsers.map((u) => (
          <li key={u.user_id} className="online-user-item">
            {u.username}
            {currentUser?._id === u.user_id && " (You)"}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OnlineUsers;
