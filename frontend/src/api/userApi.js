import axios from "axios";
import storage from "../utils/storage";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000
});

const withAuth = async () => {
  const token = await storage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const userApi = {
  // Get current logged-in user
  async me() {
    const headers = await withAuth();
    const { data } = await api.get(`/auth/me`, { headers });
    return data.data?.user || data.user || data;
  },

  // Search users with better error handling
  async search(query, limit = 10) {
    try {
      const headers = await withAuth();
      const { data } = await api.get(`/users/search`, {
        params: { q: query, limit },
        headers,
      });
      return data.data?.users || data.users || data.data || data.results || [];
    } catch (e) {
      if (e.response?.status === 404) return [];
      console.error("Search users error:", e);
      throw e;
    }
  },

  // List all users
  async list(limit = 50, skip = 0) {
    try {
      const headers = await withAuth();
      const { data } = await api.get(`/users/list`, {
        params: { limit, skip },
        headers,
      });
      return data.data?.users || data.users || [];
    } catch (e) {
      console.error("List users error:", e);
      return [];
    }
  },

  // Contacts list
  async contacts() {
    try {
      const headers = await withAuth();
      const { data } = await api.get(`/users/contacts`, { headers });
      return data.data || data.contacts || [];
    } catch (e) {
      if (e.response?.status === 404) return [];
      throw e;
    }
  },

  // Get user profile
  async profile(idOrUsername) {
    const headers = await withAuth();
    const { data } = await api.get(`/users/${idOrUsername}`, { headers });
    return data.data || data.user || data;
  },

  // Get user by ID (alias for profile)
  async getById(userId) {
    return this.profile(userId);
  },

  // Update user profile
  async updateProfile(updates) {
    const headers = await withAuth();
    const { data } = await api.put(`/users/profile`, updates, { headers });
    return data.data || data.user || data;
  }
};

export default userApi;