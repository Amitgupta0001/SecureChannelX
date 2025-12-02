// FILE: src/socket/groupHandlers.js
// Centralized handlers for all group-related socket.io events.
// Matches backend: group_events.py, chats.py, message_events.py

export default function registerGroupHandlers(socket, callbacks = {}) {
  if (!socket) {
    console.warn("⚠ registerGroupHandlers: socket is null");
    return;
  }

  const {
    onGroupCreated,
    onGroupUpdated,
    onGroupDeleted,
    onMemberAdded,
    onMemberRemoved,
  } = callbacks;

  const safeCall = (fn, data, eventName) => {
    try {
      fn?.(data);
    } catch (err) {
      console.error(`❌ Error in ${eventName} handler:`, err);
    }
  };

  /* ---------------------------------------------------------
      🆕 GROUP CREATED
  --------------------------------------------------------- */
  socket.on("group:created", (data) => {
    console.log("📢 group:created", data);
    safeCall(onGroupCreated, data?.group, "group:created");
  });

  /* ---------------------------------------------------------
      📝 GROUP UPDATED
  --------------------------------------------------------- */
  socket.on("group:updated", (data) => {
    console.log("🔄 group:updated", data);
    safeCall(onGroupUpdated, data?.group, "group:updated");
  });

  /* ---------------------------------------------------------
      ❌ GROUP DELETED
  --------------------------------------------------------- */
  socket.on("group:deleted", (data) => {
    console.log("🗑 group:deleted", data);
    safeCall(onGroupDeleted, data?.group_id, "group:deleted");
  });

  /* ---------------------------------------------------------
      ➕ MEMBER ADDED
  --------------------------------------------------------- */
  socket.on("group:member_added", (data) => {
    console.log("👤 group:member_added", data);
    safeCall(onMemberAdded, data, "group:member_added");
  });

  /* ---------------------------------------------------------
      ➖ MEMBER REMOVED
  --------------------------------------------------------- */
  socket.on("group:member_removed", (data) => {
    console.log("🚫 group:member_removed", data);
    safeCall(onMemberRemoved, data, "group:member_removed");
  });
}

/* -------------------------------------------------------------
   🔥 CLIENT → SERVER EMITTERS
------------------------------------------------------------- */
export const GroupEmit = {
  createGroup(socket, payload) {
    if (!socket?.connected) return console.warn("⚠ Socket offline: createGroup");
    socket.emit("group:create", payload);
  },

  updateGroup(socket, group_id, updates) {
    if (!socket?.connected || !group_id) return;
    socket.emit("group:update", { group_id, updates });
  },

  addMember(socket, group_id, user_id) {
    if (!socket?.connected || !group_id || !user_id) return;
    socket.emit("group:add_member", { group_id, user_id });
  },

  removeMember(socket, group_id, user_id) {
    if (!socket?.connected || !group_id || !user_id) return;
    socket.emit("group:remove_member", { group_id, user_id });
  },

  deleteGroup(socket, group_id) {
    if (!socket?.connected || !group_id) return;
    socket.emit("group:delete", { group_id });
  },
};
