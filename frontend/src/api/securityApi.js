// FILE: src/api/securityApi.js
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

export default {
  // ----------------------------------------
  // 2FA SETUP
  // POST /security/setup-2fa
  // ----------------------------------------
  async setup2FA() {
    const res = await axios.post(
      `${API}/security/setup-2fa`,
      {},
      { headers: authHeader() }
    );
    return res.data;
  },

  // ----------------------------------------
  // 2FA VERIFY
  // POST /security/verify-2fa
  // ----------------------------------------
  async verify2FA(code) {
    const res = await axios.post(
      `${API}/security/verify-2fa`,
      { code },
      { headers: authHeader() }
    );
    return res.data;
  },

  // ----------------------------------------
  // GET AUDIT LOGS
  // GET /security/audit-logs
  // ----------------------------------------
  async getAuditLogs() {
    const res = await axios.get(`${API}/security/audit-logs`, {
      headers: authHeader(),
    });
    return res.data;
  },

  // ----------------------------------------
  // GET DEVICES
  // GET /api/users/devices
  // ----------------------------------------
  async getDevices() {
    const res = await axios.get(`${API}/api/users/devices`, {
      headers: authHeader(),
    });
    return res.data;
  },

  // ----------------------------------------
  // REMOVE DEVICE
  // DELETE /api/users/devices/:id
  // ----------------------------------------
  async removeDevice(deviceId) {
    const res = await axios.delete(`${API}/api/users/devices/${deviceId}`, {
      headers: authHeader(),
    });
    return res.data;
  },

  // ----------------------------------------
  // GET SESSION KEYS
  // GET /security/session-keys
  // ----------------------------------------
  async getSessionKeys() {
    const res = await axios.get(`${API}/security/session-keys`, {
      headers: authHeader(),
    });
    return res.data;
  },
};
