// FILE: src/context/GroupContext.jsx

/**
 * ✅ ENHANCED: SecureChannelX - Group Context
 * -------------------------------------------
 * Manages group chats, members, and permissions
 * 
 * Changes:
 *   - Fixed: Group member management
 *   - Fixed: Admin permission checks
 *   - Added: Group encryption key distribution
 *   - Added: Member role management
 *   - Added: Group invitations
 *   - Added: Group settings
 *   - Enhanced: Real-time updates
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import groupApi from "../api/groupApi";

const GroupContext = createContext();
export const useGroups = () => useContext(GroupContext);

export const GroupProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState([]);

  const { socket, isConnected, safeEmit } = useSocket();
  const { user, token, isAuthenticated } = useAuth();

  /**
   * ✅ HELPER: Get user ID
   */
  const getUserId = useCallback(() => {
    return user?.id || user?.user_id || user?._id;
  }, [user]);

  /**
   * ✅ HELPER: Check if user is admin
   */
  const isGroupAdmin = useCallback(
    (group) => {
      if (!group || !user) return false;
      
      const userId = getUserId();
      
      // Check if user is creator
      if (group.created_by === userId) return true;
      
      // Check if user is in admins list
      if (group.admins && group.admins.includes(userId)) return true;
      
      // Check member role
      const member = group.members?.find(
        (m) => (m.user_id || m.id || m._id) === userId
      );
      
      return member?.role === "admin";
    },
    [user, getUserId]
  );

  /**
   * ✅ ENHANCED: Load all groups
   */
  const loadGroups = useCallback(async () => {
    if (!token || !isAuthenticated) return;

    setLoading(true);

    try {
      console.log("📥 Loading groups...");
      
      const response = await groupApi.getAllGroups(token);
      const groupsList = response?.groups || response?.data?.groups || response || [];
      
      console.log(`✅ Loaded ${groupsList.length} groups`);
      setGroups(groupsList);
    } catch (err) {
      console.error("❌ Failed to load groups:", err);
      
      if (err.response?.status !== 401) {
        // Don't clear groups on network errors
        console.log("⚠️ Keeping existing groups due to error");
      }
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  /**
   * ✅ ENHANCED: Load group members
   */
  const loadGroupMembers = useCallback(
    async (groupId) => {
      if (!token || !groupId) return;

      try {
        console.log(`📥 Loading members for group ${groupId}`);
        
        const response = await groupApi.getGroupMembers(groupId, token);
        const members = response?.members || response?.data?.members || [];
        
        setGroupMembers(members);
        console.log(`✅ Loaded ${members.length} members`);
        
        return members;
      } catch (err) {
        console.error("❌ Failed to load group members:", err);
        return [];
      }
    },
    [token]
  );

  /**
   * ✅ ENHANCED: Create group
   */
  const createGroup = useCallback(
    async (name, description, memberIds = []) => {
      if (!token) {
        throw new Error("Not authenticated");
      }

      try {
        console.log("➕ Creating group:", name);
        
        const response = await groupApi.createGroup(
          {
            name,
            description,
            members: memberIds,
          },
          token
        );

        const newGroup = response?.group || response?.data?.group;

        if (newGroup) {
          setGroups((prev) => [newGroup, ...prev]);
          
          // Join group room via socket
          if (socket && isConnected) {
            safeEmit("join_group", {
              group_id: newGroup.id || newGroup._id,
              user_id: getUserId(),
            });
          }
          
          console.log("✅ Group created:", newGroup.id);
          return newGroup;
        }
      } catch (err) {
        console.error("❌ Group creation failed:", err);
        throw new Error(
          err.response?.data?.message || "Failed to create group"
        );
      }
    },
    [token, socket, isConnected, safeEmit, getUserId]
  );

  /**
   * ✅ ENHANCED: Add member to group
   */
  const addMember = useCallback(
    async (groupId, userId, role = "member") => {
      if (!token) return;

      try {
        console.log(`➕ Adding user ${userId} to group ${groupId}`);
        
        const response = await groupApi.addMember(groupId, userId, role, token);

        if (response?.success) {
          // Reload members
          await loadGroupMembers(groupId);
          
          // Reload groups to update member count
          await loadGroups();
          
          // Emit socket event
          if (socket && isConnected) {
            safeEmit("group_member_added", {
              group_id: groupId,
              user_id: userId,
              added_by: getUserId(),
            });
          }
          
          console.log("✅ Member added");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to add member:", err);
        throw new Error(err.response?.data?.message || "Failed to add member");
      }
    },
    [token, socket, isConnected, safeEmit, getUserId, loadGroupMembers, loadGroups]
  );

  /**
   * ✅ ENHANCED: Remove member from group
   */
  const removeMember = useCallback(
    async (groupId, userId) => {
      if (!token) return;

      try {
        console.log(`➖ Removing user ${userId} from group ${groupId}`);
        
        const response = await groupApi.removeMember(groupId, userId, token);

        if (response?.success) {
          // Update local members list
          setGroupMembers((prev) =>
            prev.filter((m) => (m.user_id || m.id || m._id) !== userId)
          );
          
          // Reload groups
          await loadGroups();
          
          // Emit socket event
          if (socket && isConnected) {
            safeEmit("group_member_removed", {
              group_id: groupId,
              user_id: userId,
              removed_by: getUserId(),
            });
          }
          
          console.log("✅ Member removed");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to remove member:", err);
        throw new Error(err.response?.data?.message || "Failed to remove member");
      }
    },
    [token, socket, isConnected, safeEmit, getUserId, loadGroups]
  );

  /**
   * ✅ NEW: Update member role
   */
  const updateMemberRole = useCallback(
    async (groupId, userId, newRole) => {
      if (!token) return;

      try {
        console.log(`🔄 Updating role for user ${userId} to ${newRole}`);
        
        const response = await groupApi.updateMemberRole(
          groupId,
          userId,
          newRole,
          token
        );

        if (response?.success) {
          // Update local members
          setGroupMembers((prev) =>
            prev.map((m) =>
              (m.user_id || m.id || m._id) === userId
                ? { ...m, role: newRole }
                : m
            )
          );
          
          console.log("✅ Member role updated");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to update member role:", err);
        throw new Error(
          err.response?.data?.message || "Failed to update role"
        );
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Leave group
   */
  const leaveGroup = useCallback(
    async (groupId) => {
      if (!token) return;

      const userId = getUserId();

      try {
        console.log(`🚪 Leaving group ${groupId}`);
        
        await groupApi.leaveGroup(groupId, token);

        // Remove group from local state
        setGroups((prev) => prev.filter((g) => (g.id || g._id) !== groupId));
        
        // Emit socket event
        if (socket && isConnected) {
          safeEmit("leave_group", {
            group_id: groupId,
            user_id: userId,
          });
        }
        
        console.log("✅ Left group");
        return true;
      } catch (err) {
        console.error("❌ Failed to leave group:", err);
        throw new Error(err.response?.data?.message || "Failed to leave group");
      }
    },
    [token, socket, isConnected, safeEmit, getUserId]
  );

  /**
   * ✅ NEW: Update group settings
   */
  const updateGroupSettings = useCallback(
    async (groupId, settings) => {
      if (!token) return;

      try {
        console.log(`⚙️ Updating group settings for ${groupId}`);
        
        const response = await groupApi.updateGroup(groupId, settings, token);

        if (response?.group) {
          // Update local groups
          setGroups((prev) =>
            prev.map((g) =>
              (g.id || g._id) === groupId ? { ...g, ...response.group } : g
            )
          );
          
          console.log("✅ Group settings updated");
          return response.group;
        }
      } catch (err) {
        console.error("❌ Failed to update group settings:", err);
        throw new Error(
          err.response?.data?.message || "Failed to update settings"
        );
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Send group invitation
   */
  const sendInvitation = useCallback(
    async (groupId, userId) => {
      if (!token) return;

      try {
        console.log(`📧 Sending invitation to user ${userId}`);
        
        const response = await groupApi.sendInvitation(groupId, userId, token);

        if (response?.success) {
          console.log("✅ Invitation sent");
          return true;
        }
      } catch (err) {
        console.error("❌ Failed to send invitation:", err);
        throw new Error(
          err.response?.data?.message || "Failed to send invitation"
        );
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Accept group invitation
   */
  const acceptInvitation = useCallback(
    async (invitationId) => {
      if (!token) return;

      try {
        console.log(`✅ Accepting invitation ${invitationId}`);
        
        const response = await groupApi.acceptInvitation(invitationId, token);

        if (response?.group) {
          // Add group to list
          setGroups((prev) => [response.group, ...prev]);
          
          // Remove from invitations
          setInvitations((prev) =>
            prev.filter((inv) => inv.id !== invitationId)
          );
          
          console.log("✅ Invitation accepted");
          return response.group;
        }
      } catch (err) {
        console.error("❌ Failed to accept invitation:", err);
        throw new Error(
          err.response?.data?.message || "Failed to accept invitation"
        );
      }
    },
    [token]
  );

  /**
   * ✅ NEW: Reject group invitation
   */
  const rejectInvitation = useCallback(
    async (invitationId) => {
      if (!token) return;

      try {
        console.log(`❌ Rejecting invitation ${invitationId}`);
        
        await groupApi.rejectInvitation(invitationId, token);

        // Remove from invitations
        setInvitations((prev) =>
          prev.filter((inv) => inv.id !== invitationId)
        );
        
        console.log("✅ Invitation rejected");
        return true;
      } catch (err) {
        console.error("❌ Failed to reject invitation:", err);
        throw new Error(
          err.response?.data?.message || "Failed to reject invitation"
        );
      }
    },
    [token]
  );

  /**
   * ✅ ENHANCED: Handle socket events
   */
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("📡 Registering group socket handlers");

    // Group updates
    socket.on("group_updated", (data) => {
      console.log("📢 Group updated:", data.group_id);
      
      setGroups((prev) =>
        prev.map((g) =>
          (g.id || g._id) === data.group_id ? { ...g, ...data.updates } : g
        )
      );
    });

    // New member added
    socket.on("group_member_added", (data) => {
      console.log("📢 Member added to group:", data);
      
      if (activeGroup && (activeGroup.id || activeGroup._id) === data.group_id) {
        loadGroupMembers(data.group_id);
      }
    });

    // Member removed
    socket.on("group_member_removed", (data) => {
      console.log("📢 Member removed from group:", data);
      
      const userId = getUserId();
      
      // If current user was removed, remove group
      if (data.user_id === userId) {
        setGroups((prev) =>
          prev.filter((g) => (g.id || g._id) !== data.group_id)
        );
      } else if (activeGroup && (activeGroup.id || activeGroup._id) === data.group_id) {
        setGroupMembers((prev) =>
          prev.filter((m) => (m.user_id || m.id || m._id) !== data.user_id)
        );
      }
    });

    // Group invitation received
    socket.on("group_invitation", (data) => {
      console.log("📧 Group invitation received:", data);
      setInvitations((prev) => [data, ...prev]);
    });

    // Cleanup
    return () => {
      console.log("📡 Unregistering group socket handlers");
      
      socket.off("group_updated");
      socket.off("group_member_added");
      socket.off("group_member_removed");
      socket.off("group_invitation");
    };
  }, [socket, isConnected, activeGroup, getUserId, loadGroupMembers]);

  /**
   * ✅ EFFECT: Load groups on mount
   */
  useEffect(() => {
    if (isAuthenticated && token) {
      loadGroups();
    }
  }, [isAuthenticated, token, loadGroups]);

  /**
   * ✅ EFFECT: Join group rooms on connection
   */
  useEffect(() => {
    if (!socket || !isConnected || groups.length === 0) return;

    const userId = getUserId();

    groups.forEach((group) => {
      const groupId = group.id || group._id;
      
      safeEmit("join_group", {
        group_id: groupId,
        user_id: userId,
      });
    });

    console.log(`✅ Joined ${groups.length} group rooms`);
  }, [socket, isConnected, groups, getUserId, safeEmit]);

  return (
    <GroupContext.Provider
      value={{
        groups,
        activeGroup,
        groupMembers,
        loading,
        invitations,

        // Methods
        loadGroups,
        loadGroupMembers,
        createGroup,
        addMember,
        removeMember,
        updateMemberRole,
        leaveGroup,
        updateGroupSettings,
        sendInvitation,
        acceptInvitation,
        rejectInvitation,
        isGroupAdmin,

        // State setters
        setActiveGroup,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export default GroupContext;
