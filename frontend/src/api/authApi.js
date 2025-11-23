// FILE: src/api/authApi.js
import axios from "axios";
import { API_BASE } from "../utils/constants";

const API = `${API_BASE}/api/auth`;

export default {
  // -------------------------------
  // REGISTER
  // POST /api/register
  // -------------------------------
  async register({ username, email, password }) {
    const res = await axios.post(`${API}/register`, {
      username,
      email,
      password,
    });
    return res.data;
    /*
      {
        message: "User registered successfully",
        user_id: "<id>"
      }
    */
  },

  // -------------------------------
  // LOGIN
  // POST /api/login
  // -------------------------------
  async login(username, password) {
    const res = await axios.post(`${API}/login`, {
      username,
      password,
    });
    return res.data;
    /*
      {
        access_token: "...",
        user_id: "...",
        username: "..."
      }
    */
  },

  // -------------------------------
  // GET PROFILE
  // GET /api/profile
  // Requires JWT
  // -------------------------------
  async getProfile(token) {
    const res = await axios.get(`${API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.data;
    /*
      {
        user_id: "...",
        username: "...",
        email: "..."
      }
    */
  },

  // -------------------------------
  // LOGOUT
  // POST /api/logout
  // Requires JWT
  // -------------------------------
  async logout(token) {
    const res = await axios.post(
      `${API_BASE}/api/security/logout`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
    /*
      { message: "Logged out successfully" }
    */
    return res.data.data;
    /*
      { message: "Logged out successfully" }
    */
  },

  // -------------------------------
  // FORGOT PASSWORD
  // POST /api/forgot-password
  // -------------------------------
  async forgotPassword(email) {
    const res = await axios.post(`${API}/forgot-password`, { email });
    return res.data; // { success: true, message: "..." }
  },

  // -------------------------------
  // RESET PASSWORD
  // POST /api/reset-password
  // -------------------------------
  async resetPassword(token, password) {
    const res = await axios.post(`${API}/reset-password`, {
      token,
      password,
    });
    return res.data; // { success: true, message: "..." }
  },
};
