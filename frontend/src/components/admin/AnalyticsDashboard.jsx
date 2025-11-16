// frontend/src/components/AnalyticsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/components/AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [userActivity, setUserActivity] = useState([]);
  const [roomActivity, setRoomActivity] = useState([]);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadAnalytics();
    loadUserActivity();
    loadRoomActivity();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadUserActivity = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/analytics/user-activity', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserActivity(data.active_users);
      }
    } catch (error) {
      console.error('Error loading user activity:', error);
    }
  };

  const loadRoomActivity = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/analytics/room-activity', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoomActivity(data.room_activity);
      }
    } catch (error) {
      console.error('Error loading room activity:', error);
    }
  };

  if (!analytics) {
    return <div className="loading">Loading analytics...</div>;
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2>Analytics Dashboard</h2>
        <div className="time-range-selector">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Users</h3>
          <div className="metric-value">{analytics.total_users}</div>
        </div>
        
        <div className="metric-card">
          <h3>Total Messages</h3>
          <div className="metric-value">{analytics.total_messages}</div>
        </div>
        
        <div className="metric-card">
          <h3>Active Today</h3>
          <div className="metric-value">{analytics.active_today}</div>
        </div>
        
        <div className="metric-card">
          <h3>Messages Today</h3>
          <div className="metric-value">{analytics.messages_today}</div>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>User Growth</h3>
          <div className="user-growth-chart">
            {analytics.user_growth.map((day, index) => (
              <div key={index} className="growth-bar">
                <div 
                  className="bar-fill" 
                  style={{ height: `${(day.count / Math.max(...analytics.user_growth.map(d => d.count))) * 100}%` }}
                ></div>
                <span className="bar-label">{day.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Most Active Users</h3>
          <div className="active-users-list">
            {userActivity.map((user, index) => (
              <div key={index} className="user-activity-item">
                <span className="username">{user.username}</span>
                <span className="message-count">{user.message_count} messages</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="room-activity-section">
        <h3>Room Activity</h3>
        <div className="room-activity-list">
          {roomActivity.map((room, index) => (
            <div key={index} className="room-activity-item">
              <div className="room-info">
                <span className="room-name">#{room.room_id}</span>
                <span className="message-count">{room.message_count} messages</span>
              </div>
              <div className="last-activity">
                Last activity: {new Date(room.last_activity).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;