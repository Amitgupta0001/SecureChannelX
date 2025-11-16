// frontend/src/components/admin/UserManagement.jsx
import React, { useEffect, useState } from "react";
import "../../styles/components/AdminDashboard.css";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const token = localStorage.getItem("access_token");

  // ---------------------------
  // LOAD USERS
  // ---------------------------
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);

        const response = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users);
        }
      } catch (error) {
        console.error("Error loading users:", error);
      }

      setLoading(false);
    };

    fetchUsers();
  }, [refresh]);

  // ---------------------------
  // USER ACTIONS
  // ---------------------------

  const toggleBan = async (userId, isBanned) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ banned: !isBanned }),
      });

      if (response.ok) {
        setRefresh((prev) => !prev);
      }
    } catch (error) {
      console.error("Ban action failed:", error);
    }
  };

  const toggleAdmin = async (userId, isAdmin) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_admin: !isAdmin }),
      });

      if (response.ok) {
        setRefresh((prev) => !prev);
      }
    } catch (error) {
      console.error("Role update failed:", error);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setRefresh((prev) => !prev);
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // ---------------------------
  // FILTER USERS
  // ---------------------------
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  // ---------------------------
  // VIEW USER DETAILS
  // ---------------------------
  const viewUserDetails = async (userId) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedUser(data);
      }
    } catch (err) {
      console.error("Error loading user details:", err);
    }
  };

  return (
    <div className="admin-dashboard">
      <h1>User Management</h1>

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search users by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading && <div className="loading">Loading users...</div>}

      {/* User Table */}
      {!loading && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Status</th>
              <th>Role</th>
              <th>Messages</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user._id}>
                <td>{user.username}</td>
                <td>{user.email}</td>

                <td className={user.banned ? "danger" : "success"}>
                  {user.banned ? "Banned" : "Active"}
                </td>

                <td>{user.is_admin ? "Admin" : "User"}</td>

                <td>{user.message_count || 0}</td>

                <td>
                  {user.last_active
                    ? new Date(user.last_active).toLocaleString()
                    : "N/A"}
                </td>

                <td className="actions">
                  {/* Ban / Unban */}
                  <button
                    className="btn-warning"
                    onClick={() => toggleBan(user._id, user.banned)}
                  >
                    {user.banned ? "Unban" : "Ban"}
                  </button>

                  {/* Promote / Demote Admin */}
                  <button
                    className="btn-secondary"
                    onClick={() => toggleAdmin(user._id, user.is_admin)}
                  >
                    {user.is_admin ? "Demote" : "Make Admin"}
                  </button>

                  {/* View Details */}
                  <button
                    className="btn-info"
                    onClick={() => viewUserDetails(user._id)}
                  >
                    View
                  </button>

                  {/* Delete */}
                  <button
                    className="btn-danger"
                    onClick={() => deleteUser(user._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>User Details</h2>
            <p><strong>Username:</strong> {selectedUser.username}</p>
            <p><strong>Email:</strong> {selectedUser.email}</p>
            <p><strong>Joined:</strong> {new Date(selectedUser.created_at).toLocaleString()}</p>
            <p><strong>Total Messages:</strong> {selectedUser.total_messages}</p>
            <p><strong>Last Active:</strong>  
              {selectedUser.last_active 
                ? new Date(selectedUser.last_active).toLocaleString() 
                : "N/A"}
            </p>

            <button className="btn-close" onClick={() => setSelectedUser(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
