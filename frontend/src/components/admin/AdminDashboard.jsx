// frontend/src/components/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";  // Fixed path
import "../../styles/components/AdminDashboard.css";  // Fixed path

const AdminDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        messageCount: 0
    });

    useEffect(() => {
        fetchAdminStats();
    }, []);

    const fetchAdminStats = async () => {
        // Add stats fetching logic here
    };

    return (
        <div className="admin-dashboard">
            <h1>Admin Dashboard</h1>
            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Total Users</h3>
                    <p>{stats.totalUsers}</p>
                </div>
                <div className="stat-card">
                    <h3>Active Users</h3>
                    <p>{stats.activeUsers}</p>
                </div>
                <div className="stat-card">
                    <h3>Messages Today</h3>
                    <p>{stats.messageCount}</p>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;