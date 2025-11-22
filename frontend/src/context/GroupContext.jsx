// FILE: src/context/GroupContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { useSocket } from "./SocketContext";
import groupApi from "../api/groupApi";
import chatApi from "../api/chatApi";

const GroupContext = createContext();
export const useGroups = () => useContext(GroupContext);

export const GroupProvider = ({ children }) => {
  /* ---------------------------------------------------------
      STATE
  --------------------------------------------------------- */
  const [groups, setGroups] = useState([]);             // all groups
  const [activeGroupId, setActiveGroupId] = useState(null);

  const { socket, safeEmit } = useSocket();

  /* ---------------------------------------------------------
      LOAD ALL GROUPS FROM BACKEND
  --------------------------------------------------------- */
  const loadGroups = useCallback(async () => {
    try {
      const res = await groupApi.getAllGroups();
      setGroups(res.groups || []);
    } catch (err) {
      console.error("Failed loading groups:", err);
    }
  }, []);

  /* ---------------------------------------------------------
      CREATE NEW GROUP
  --------------------------------------------------------- */
  const createGroup = async (payload) => {
    try {
      const res = await groupApi.createGroup(payload);

      if (res.group) {
        setGroups((prev) => [...prev, res.group]);
      }

      return res.group;
    } catch (err) {
      console.error("Create group error:", err);
      throw err;
    }
  };

  /* ---------------------------------------------------------
      ADD MEMBER
  --------------------------------------------------------- */
  const addMember = async (groupId, userId) => {
    try {
      await groupApi.addMember(groupId, userId);

      setGroups((prev) =>
        prev.map((g) =>
          g._id === groupId
            ? { ...g, members: [...g.members, userId] }
            : g
        )
      );
    } catch (err) {
      console.error("Add member error:", err);
    }
  };

  /* ---------------------------------------------------------
      REMOVE MEMBER
  --------------------------------------------------------- */
  const removeMember = async (groupId, userId) => {
    try {
      await groupApi.removeMember(groupId, userId);

      setGroups((prev) =>
        prev.map((g) =>
          g._id === groupId
            ? {
                ...g,
                members: g.members.filter((id) => id !== userId),
              }
            : g
        )
      );
    } catch (err) {
      console.error("Remove member error:", err);
    }
  };

  /* ---------------------------------------------------------
      UPDATE GROUP DATA (NAME, AVATAR)
  --------------------------------------------------------- */
  const updateGroup = async (groupId, payload) => {
    try {
      const res = await groupApi.updateGroup(groupId, payload);

      if (res.group) {
        setGroups((prev) =>
          prev.map((g) => (g._id === groupId ? res.group : g))
        );
      }
    } catch (err) {
      console.error("Update group error:", err);
    }
  };

  /* ---------------------------------------------------------
      DELETE GROUP
  --------------------------------------------------------- */
  const deleteGroup = async (groupId) => {
    try {
      await groupApi.deleteGroup(groupId);

      setGroups((prev) => prev.filter((g) => g._id !== groupId));
      if (activeGroupId === groupId) setActiveGroupId(null);
    } catch (err) {
      console.error("Delete group error:", err);
    }
  };

  /* ---------------------------------------------------------
      SOCKET EVENTS
  --------------------------------------------------------- */
  useEffect(() => {
    if (!socket) return;

    /* GROUP CREATED */
    socket.on("group:created", ({ group }) => {
      setGroups((prev) => [...prev, group]);
    });

    /* MEMBER ADDED */
    socket.on("group:member_added", ({ group_id, member_id }) => {
      setGroups((prev) =>
        prev.map((g) =>
          g._id === group_id
            ? { ...g, members: [...g.members, member_id] }
            : g
        )
      );
    });

    /* MEMBER REMOVED */
    socket.on("group:member_removed", ({ group_id, member_id }) => {
      setGroups((prev) =>
        prev.map((g) =>
          g._id === group_id
            ? {
                ...g,
                members: g.members.filter((id) => id !== member_id),
              }
            : g
        )
      );
    });

    /* GROUP RENAMED */
    socket.on("group:updated", ({ group }) => {
      setGroups((prev) =>
        prev.map((g) => (g._id === group._id ? group : g))
      );
    });

    /* GROUP DELETED */
    socket.on("group:deleted", ({ group_id }) => {
      setGroups((prev) => prev.filter((g) => g._id !== group_id));

      if (activeGroupId === group_id) {
        setActiveGroupId(null);
      }
    });

    return () => {
      socket.off("group:created");
      socket.off("group:member_added");
      socket.off("group:member_removed");
      socket.off("group:updated");
      socket.off("group:deleted");
    };
  }, [socket, activeGroupId]);

  /* ---------------------------------------------------------
      INITIAL LOAD
  --------------------------------------------------------- */
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return (
    <GroupContext.Provider
      value={{
        groups,
        activeGroupId,
        setActiveGroupId,

        reloadGroups: loadGroups,
        createGroup,
        addMember,
        removeMember,
        updateGroup,
        deleteGroup,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};
