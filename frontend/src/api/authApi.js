// FILE: src/api/authApi.js
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

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
    return res.data;
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
      `${API}/logout`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
    /*
      { message: "Logged out successfully" }
    */
  },
};
