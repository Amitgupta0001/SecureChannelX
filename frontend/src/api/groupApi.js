// FILE: src/api/groupApi.js
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default {
  // -------------------------------------------------------
  // 1️⃣ CREATE GROUP
  // POST /groups/create
  // Body: { title, members }
  // -------------------------------------------------------
  async createGroup(title, members, token, description = null) {
    const res = await axios.post(
      `${API}/groups/create`,
      {
        title,
        members,
        description,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data;
    /*
      {
        group: {...},
        chat_id: "<linked_chat_id>"
      }
    */
  },

  // -------------------------------------------------------
  // 2️⃣ ADD MEMBER TO GROUP
  // POST /groups/:group_id/add
  // Body: { member_id }
  // -------------------------------------------------------
  async addMember(groupId, memberId, token) {
    const res = await axios.post(
      `${API}/groups/${groupId}/add`,
      {
        member_id: memberId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data; // { ok: true }
  },

  // -------------------------------------------------------
  // 3️⃣ SOCKET HELPERS (Join/Leave Group Room)
  // Groups use chat rooms: "chat:<chat_id>"
  // -------------------------------------------------------

  joinGroupRoom(socket, chatId, userId) {
    socket.emit("join_chat", {
      chat_id: chatId,
      user_id: userId,
    });
  },

  leaveGroupRoom(socket, chatId, userId) {
    socket.emit("leave_chat", {
      chat_id: chatId,
      user_id: userId,
    });
  },

  // -------------------------------------------------------
  // 4️⃣ CREATE GROUP ANNOUNCEMENT
  // Uses socket event: "group:create"
  // Defined in backend/socket/group_events.py
  // -------------------------------------------------------
  createGroupViaSocket(socket, title, members, createdBy, description = "") {
    socket.emit("group:create", {
      title,
      members,
      created_by: createdBy,
      description,
    });
  },

  // -------------------------------------------------------
  // 5️⃣ ADD MEMBER VIA SOCKET
  // Uses event: "group:add_member"
  // -------------------------------------------------------
  addMemberViaSocket(socket, groupId, memberId, addedBy) {
    socket.emit("group:add_member", {
      group_id: groupId,
      member_id: memberId,
      added_by: addedBy,
    });
  },

  // -------------------------------------------------------
  // 6️⃣ LISTENING HELPERS (Frontend)
  // Backend emits:
  //  - "group:created"
  //  - "group:invited"
  //  - "group:member_added"
  // -------------------------------------------------------
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
