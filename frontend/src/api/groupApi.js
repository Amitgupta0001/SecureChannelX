/**
 * ✅ ENHANCED: SecureChannelX - Group API
 * ---------------------------------------
 * Group chat management
 * 
 * Changes:
 *   - Fixed: API URL to port 5050
 *   - Added: Axios instance with interceptors
 *   - Added: Comprehensive error handling
 *   - Added: Remove member
 *   - Added: Update group details
 *   - Added: Leave group
 *   - Added: Get group details
 * 
 * Compatibility:
 *   - Backend API: ✅ Port 5050
 *   - Socket.IO: ✅ Compatible events
 */

import axios from "axios";
import storage from "../utils/storage";

// ============================================================
//                   CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
const API_TIMEOUT = 30000;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/groups`,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================
//                   INTERCEPTORS
// ============================================================

api.interceptors.request.use(
  async (config) => {
    if (!config.headers.Authorization) {
      const token = await storage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.removeToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ============================================================
//                   GROUP API
// ============================================================

const groupApi = {
  /**
   * ✅ ENHANCED: Create group
   */
  async createGroup(title, members, token = null, description = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/create",
        { title, members, description },
        { headers }
      );

      return {
        success: true,
        group: response.data.group || response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error("[Group API] Create error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ ENHANCED: Add member
   */
  async addMember(groupId, memberId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        `/${groupId}/add`,
        { member_id: memberId },
        { headers }
      );

      return {
        success: true,
        message: response.data.message || response.data.data,
      };
    } catch (error) {
      console.error("[Group API] Add member error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Remove member
   */
  async removeMember(groupId, memberId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        `/${groupId}/remove`,
        { member_id: memberId },
        { headers }
      );

      return {
        success: true,
        message: response.data.message,
      };
    } catch (error) {
      console.error("[Group API] Remove member error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ ENHANCED: Get all user groups
   */
  async getAllGroups(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/list", { headers });

      return {
        success: true,
        groups: response.data.groups || response.data.data || [],
      };
    } catch (error) {
      console.error("[Group API] Get groups error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get group details
   */
  async getGroup(groupId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get(`/${groupId}`, { headers });

      return {
        success: true,
        group: response.data.group,
      };
    } catch (error) {
      console.error("[Group API] Get group error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Update group details
   */
  async updateGroup(groupId, updates, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.put(`/${groupId}`, updates, { headers });

      return {
        success: true,
        group: response.data.group,
        message: response.data.message,
      };
    } catch (error) {
      console.error("[Group API] Update group error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Leave group
   */
  async leaveGroup(groupId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(`/${groupId}/leave`, {}, { headers });

      return {
        success: true,
        message: response.data.message,
      };
    } catch (error) {
      console.error("[Group API] Leave group error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Delete group
   */
  async deleteGroup(groupId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete(`/${groupId}`, { headers });

      return {
        success: true,
        message: response.data.message,
      };
    } catch (error) {
      console.error("[Group API] Delete group error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   SOCKET HELPERS
  // ============================================================

  joinGroupRoom(socket, chatId, userId) {
    if (!socket?.connected) {
      console.error("❌ Socket not connected");
      return;
    }
    socket.emit("join_chat", { chat_id: chatId, user_id: userId });
  },

  leaveGroupRoom(socket, chatId, userId) {
    if (!socket?.connected) return;
    socket.emit("leave_chat", { chat_id: chatId, user_id: userId });
  },

  createGroupViaSocket(socket, title, members, createdBy, description = "") {
    if (!socket?.connected) return;
    socket.emit("group:create", {
      title,
      members,
      created_by: createdBy,
      description,
    });
  },

  addMemberViaSocket(socket, groupId, memberId, addedBy) {
    if (!socket?.connected) return;
    socket.emit("group:add_member", {
      group_id: groupId,
      member_id: memberId,
      added_by: addedBy,
    });
  },

  onGroupCreated(socket, callback) {
    socket.on("group:created", callback);
  },

  onGroupInvited(socket, callback) {
    socket.on("group:invited", callback);
  },

  onGroupMemberAdded(socket, callback) {
    socket.on("group:member_added", callback);
  },

  onGroupMemberRemoved(socket, callback) {
    socket.on("group:member_removed", callback);
  },

  onGroupUpdated(socket, callback) {
    socket.on("group:updated", callback);
  },
};

export default groupApi;
