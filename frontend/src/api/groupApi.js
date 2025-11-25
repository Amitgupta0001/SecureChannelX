// FILE: src/api/groupApi.js
import axios from "axios";
import { API_BASE as API } from "../utils/constants";

export default {

  // -------------------------------------------------------
  // CREATE GROUP
  // POST http://localhost:5050/api/groups/create
  // -------------------------------------------------------
  async createGroup(title, members, token, description = null) {
    const res = await axios.post(
      `${API}/api/groups/create`,
      { title, members, description },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data.data;
  },

  // -------------------------------------------------------
  // ADD MEMBER
  // POST http://localhost:5050/api/groups/:group_id/add
  // -------------------------------------------------------
  async addMember(groupId, memberId, token) {
    const res = await axios.post(
      `${API}/api/groups/${groupId}/add`,
      { member_id: memberId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data.data;
  },

  // -------------------------------------------------------
  // LIST USER GROUPS
  // GET http://localhost:5050/api/groups/list
  // -------------------------------------------------------
  async getAllGroups(token) {
    const res = await axios.get(`${API}/api/groups/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.data;
  },

  // -------------------------------------------------------
  // SOCKET HELPERS
  // -------------------------------------------------------
  joinGroupRoom(socket, chatId, userId) {
    socket.emit("join_chat", { chat_id: chatId, user_id: userId });
  },

  leaveGroupRoom(socket, chatId, userId) {
    socket.emit("leave_chat", { chat_id: chatId, user_id: userId });
  },

  createGroupViaSocket(socket, title, members, createdBy, description = "") {
    socket.emit("group:create", {
      title,
      members,
      created_by: createdBy,
      description,
    });
  },

  addMemberViaSocket(socket, groupId, memberId, addedBy) {
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
};
