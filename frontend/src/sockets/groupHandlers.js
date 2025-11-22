// FILE: src/sockets/groupHandlers.js
// Centralized handlers for all group-related socket.io events.
// Matches backend: group_events.py, chats.py, message_events.py

export default function registerGroupHandlers(
  socket,
  {
    onGroupCreated,
    onGroupUpdated,
    onGroupDeleted,
    onMemberAdded,
    onMemberRemoved
  }
) {
  if (!socket) return;

  /* ---------------------------------------------------------
      🆕 GROUP CREATED
      (Admin creates new group)
  --------------------------------------------------------- */
  socket.on("group:created", (data) => {
    console.log("📢 group:created", data);
    onGroupCreated && onGroupCreated(data.group);
  });

  /* ---------------------------------------------------------
      📝 GROUP UPDATED
      (name, icon, settings updated)
  --------------------------------------------------------- */
  socket.on("group:updated", (data) => {
    console.log("🔄 group:updated", data);
    onGroupUpdated && onGroupUpdated(data.group);
  });

  /* ---------------------------------------------------------
      ❌ GROUP DELETED
  --------------------------------------------------------- */
  socket.on("group:deleted", (data) => {
    console.log("🗑 group:deleted", data);
    onGroupDeleted && onGroupDeleted(data.group_id);
  });

  /* ---------------------------------------------------------
      ➕ MEMBER ADDED TO GROUP
  --------------------------------------------------------- */
  socket.on("group:member_added", (data) => {
    console.log("👤 group:member_added", data);
    onMemberAdded && onMemberAdded(data);
  });

  /* ---------------------------------------------------------
      ➖ MEMBER REMOVED FROM GROUP
  --------------------------------------------------------- */
  socket.on("group:member_removed", (data) => {
    console.log("🚫 group:member_removed", data);
    onMemberRemoved && onMemberRemoved(data);
  });
}


/* -------------------------------------------------------------
   🔥 CLIENT → SERVER GROUP EMITTERS
   EXACT match to backend events in group_events.py
------------------------------------------------------------- */

export const GroupEmit = {
  /** Create a new group */
  createGroup(socket, payload) {
    socket.emit("group:create", payload);
  },

  /** Update group metadata */
  updateGroup(socket, group_id, updates) {
    socket.emit("group:update", { group_id, updates });
  },

  /** Add member to group */
  addMember(socket, group_id, user_id) {
    socket.emit("group:add_member", { group_id, user_id });
  },

  /** Remove member from group */
  removeMember(socket, group_id, user_id) {
    socket.emit("group:remove_member", { group_id, user_id });
  },

  /** Delete group (admin only) */
  deleteGroup(socket, group_id) {
    socket.emit("group:delete", { group_id });
  }
};
