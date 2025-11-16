import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TwoFactorSetup from './TwoFactorSetup';
import '../../styles/components/SecurityDashboard.css';

const SecurityDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [auditLogs, setAuditLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [sessionKeys, setSessionKeys] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    } else if (activeTab === 'devices') {
      loadDevices();
    } else if (activeTab === 'sessions') {
      loadSessionKeys();
    }
  }, [activeTab]);

  const loadAuditLogs = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/security/audit-logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.audit_logs);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  const loadDevices = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/security/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const loadSessionKeys = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/security/session-keys', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSessionKeys(data.session_keys);
      }
    } catch (error) {
      console.error('Error loading session keys:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const removeDevice = async (deviceId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/security/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setDevices(devices.filter(device => device.id !== deviceId));
      }
    } catch (error) {
      console.error('Error removing device:', error);
    }
  };

  return (
    <div className="security-dashboard">
      <div className="dashboard-header">
        <h1>Security Center</h1>
        <p>Manage your account security and privacy settings</p>
      </div>

      <div className="security-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          🔒 Overview
        </button>
        <button 
          className={`tab-button ${activeTab === '2fa' ? 'active' : ''}`}
          onClick={() => setActiveTab('2fa')}
        >
          🛡️ Two-Factor Auth
        </button>
        <button 
          className={`tab-button ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          📱 Devices
        </button>
        <button 
          className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          📊 Audit Logs
        </button>
        <button 
          className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          🔑 Sessions
        </button>
      </div>

      <div className="security-content">
        {activeTab === 'overview' && (
          <div className="security-overview">
            <div className="security-status">
              <h3>Security Status</h3>
              <div className="status-grid">
                <div className="status-item">
                  <div className="status-icon">🔒</div>
                  <div className="status-info">
                    <span className="status-label">Account Protection</span>
                    <span className="status-value">Active</span>
                  </div>
                </div>
                <div className="status-item">
                  <div className="status-icon">🛡️</div>
                  <div className="status-info">
                    <span className="status-label">Two-Factor Auth</span>
                    <span className="status-value">Not Enabled</span>
                    <button 
                      onClick={() => setActiveTab('2fa')}
                      className="enable-button"
                    >
                      Enable
                    </button>
                  </div>
                </div>
                <div className="status-item">
                  <div className="status-icon">📱</div>
                  <div className="status-info">
                    <span className="status-label">Active Devices</span>
                    <span className="status-value">1 device</span>
                  </div>
                </div>
                <div className="status-item">
                  <div className="status-icon">🔑</div>
                  <div className="status-info">
                    <span className="status-label">Encryption</span>
                    <span className="status-value">End-to-End</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="security-tips">
              <h3>Security Tips</h3>
              <div className="tips-list">
                <div className="tip">
                  <span className="tip-icon">✅</span>
                  <span>Enable two-factor authentication for extra security</span>
                </div>
                <div className="tip">
                  <span className="tip-icon">✅</span>
                  <span>Use a strong, unique password</span>
                </div>
                <div className="tip">
                  <span className="tip-icon">✅</span>
                  <span>Regularly review your active devices</span>
                </div>
                <div className="tip">
                  <span className="tip-icon">✅</span>
                  <span>Monitor your account activity</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === '2fa' && <TwoFactorSetup />}

        {activeTab === 'devices' && (
          <div className="devices-management">
            <h3>Your Devices</h3>
            <p>Manage devices that have access to your account</p>
            
            <div className="devices-list">
              {devices.map((device) => (
                <div key={device.id} className="device-card">
                  <div className="device-info">
                    <div className="device-icon">📱</div>
                    <div className="device-details">
                      <span className="device-name">{device.device_name || 'Unknown Device'}</span>
                      <span className="device-last-active">
                        Last active: {formatDate(device.last_active)}
                      </span>
                    </div>
                  </div>
                  <div className="device-actions">
                    {device.is_active && (
                      <span className="active-badge">Active</span>
                    )}
                    <button 
                      onClick={() => removeDevice(device.id)}
                      className="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="audit-logs">
            <h3>Recent Activity</h3>
            <p>Review your account activity and security events</p>
            
            <div className="logs-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="log-entry">
                  <div className="log-main">
                    <span className="log-action">{log.action}</span>
                    <span className="log-timestamp">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="log-details">
                    <span>IP: {log.ip_address}</span>
                    <span className={`status ${log.status}`}>{log.status}</span>
                    {log.details && <span>Details: {log.details}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="session-keys">
            <h3>Recent Session Keys</h3>
            <p>Your recent encryption session keys (truncated for security)</p>
            
            <div className="keys-list">
              {sessionKeys.map((key) => (
                <div key={key.id} className="key-entry">
                  <div className="key-info">
                    <span className="key-value">{key.session_key}</span>
                    <span className="key-date">Created: {formatDate(key.created_at)}</span>
                  </div>
                  <div className="key-status">
                    <span className={`status ${key.is_active ? 'active' : 'inactive'}`}>
                      {key.is_active ? 'Active' : 'Expired'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityDashboard;