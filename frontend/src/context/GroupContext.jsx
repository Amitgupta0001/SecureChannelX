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
import { useAuth } from "./AuthContext";

const GroupContext = createContext();
export const useGroups = () => useContext(GroupContext);

export const GroupProvider = ({ children }) => {
  /* ---------------------------------------------------------
      STATE
  --------------------------------------------------------- */
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);

  const { socket } = useSocket();
  const { token } = useAuth(); // 🔥 Correct location

  /* ---------------------------------------------------------
      LOAD ALL GROUPS (Safe)
  --------------------------------------------------------- */
  const loadGroups = useCallback(async () => {
    const storedToken = localStorage.getItem("access_token");

    if (!storedToken) {
      console.warn("⛔ No token found — skipping group load");
      return; // 🚫 Do not call API without token
    }

    try {
      const res = await groupApi.getAllGroups(storedToken);
      setGroups(res.groups || []);
    } catch (err) {
      console.error("Failed loading groups:", err);
    }
  }, []);

  /* ---------------------------------------------------------
      CREATE GROUP
  --------------------------------------------------------- */
  const createGroup = async ({ title, members, description }) => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) return;

    try {
      const res = await groupApi.createGroup(
        title,
        members,
        storedToken,
        description
      );

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
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) return;

    try {
      await groupApi.addMember(groupId, userId, storedToken);

      setGroups((prev) =>
        prev.map((g) =>
          g._id === groupId ? { ...g, members: [...g.members, userId] } : g
        )
      );
    } catch (err) {
      console.error("Add member error:", err);
    }
  };

  /* ---------------------------------------------------------
      SOCKET EVENTS
  --------------------------------------------------------- */
  useEffect(() => {
    if (!socket) return;

    socket.on("group:created", ({ group }) => {
      setGroups((prev) => [...prev, group]);
    });

    socket.on("group:member_added", ({ group_id, member_id }) => {
      setGroups((prev) =>
        prev.map((g) =>
          g._id === group_id
            ? { ...g, members: [...g.members, member_id] }
            : g
        )
      );
    });

    return () => {
      socket.off("group:created");
      socket.off("group:member_added");
    };
  }, [socket]);

  /* ---------------------------------------------------------
      INITIAL LOAD (runs ONLY after login)
  --------------------------------------------------------- */
  useEffect(() => {
    if (!token) return; // 🔥 Do NOT attempt load without authentication

    loadGroups();
  }, [token, loadGroups]);

  return (
    <GroupContext.Provider
      value={{
        groups,
        activeGroupId,
        setActiveGroupId,
        reloadGroups: loadGroups,
        createGroup,
        addMember,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};
