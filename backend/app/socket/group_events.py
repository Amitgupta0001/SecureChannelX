"""
Real-time socket events for group actions:
 - create group
 - add member
 - remove member
 - leave group
 - update group settings
 - broadcast announcements
 - comprehensive audit logging
 - rate limiting
 - access control
"""

import logging
import traceback
from datetime import datetime
from typing import Optional, Dict, Any

from flask import request
from flask_socketio import join_room, leave_room, emit
from bson import ObjectId

from app import socketio
from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   CONSTANTS
# ============================================================

MAX_GROUP_NAME_LENGTH = 100
MAX_GROUP_DESCRIPTION_LENGTH = 1000
MAX_MEMBERS_PER_GROUP = 500
MIN_MEMBERS_FOR_GROUP = 2
MAX_GROUPS_PER_USER = 100
RATE_LIMIT_GROUP_OPS = 10  # per minute
RATE_LIMIT_MEMBER_OPS = 20  # per minute


# ============================================================
#                   AUDIT LOGGING
# ============================================================

class GroupAuditLogger:
    """✅ ENHANCED: Comprehensive group audit logging"""
    
    COLLECTION = "group_audit_logs"
    
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()
        try:
            self.db[self.COLLECTION].create_index([("timestamp", -1)])
            self.db[self.COLLECTION].create_index([("event", 1)])
            self.db[self.COLLECTION].create_index([("group_id", 1)])
            self.db[self.COLLECTION].create_index([("user_id", 1)])
        except Exception as e:
            logger.warning(f"[GROUP AUDIT] Index creation failed: {e}")
    
    def log(self, event: str, user_id: str, group_id: str = None,
            status: str = "success", details: Dict = None, error_msg: str = ""):
        """✅ ENHANCED: Log group event"""
        try:
            doc = {
                "event": event,
                "user_id": user_id,
                "group_id": group_id,
                "status": status,
                "details": details or {},
                "error": error_msg,
                "ip_address": request.remote_addr if request else None,
                "timestamp": now_utc()
            }
            self.db[self.COLLECTION].insert_one(doc)
        except Exception as e:
            logger.error(f"[GROUP AUDIT] Failed to log: {e}")


group_audit_logger = GroupAuditLogger()


# ============================================================
#                   RATE LIMITING
# ============================================================

class GroupRateLimiter:
    """✅ ENHANCED: Rate limiting for group operations"""
    
    def __init__(self):
        self.ops = {}  # user_id -> [(timestamp, op_type), ...]
    
    def check_limit(self, user_id: str, operation: str, limit: int) -> tuple:
        """✅ ENHANCED: Check if operation is within rate limit"""
        import time
        
        now = time.time()
        
        if user_id not in self.ops:
            self.ops[user_id] = []
        
        # Clean old entries (older than 1 minute)
        cutoff = now - 60
        self.ops[user_id] = [
            (ts, op) for ts, op in self.ops[user_id] if ts > cutoff
        ]
        
        # Count operations
        count = sum(1 for _, op in self.ops[user_id] if op == operation)
        
        if count >= limit:
            return False, f"Rate limit exceeded for {operation} ({limit}/min)"
        
        self.ops[user_id].append((now, operation))
        return True, ""


group_rate_limiter = GroupRateLimiter()


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_group_name(name: str) -> tuple:
    """✅ ENHANCED: Validate group name"""
    if not name or not isinstance(name, str):
        return False, "Group name must be a string"
    
    name = name.strip()
    if len(name) < 1:
        return False, "Group name cannot be empty"
    
    if len(name) > MAX_GROUP_NAME_LENGTH:
        return False, f"Group name too long (max {MAX_GROUP_NAME_LENGTH} chars)"
    
    return True, name


def validate_group_description(desc: str) -> tuple:
    """✅ ENHANCED: Validate group description"""
    if not desc:
        return True, ""
    
    if not isinstance(desc, str):
        return False, "Description must be a string"
    
    desc = desc.strip()
    if len(desc) > MAX_GROUP_DESCRIPTION_LENGTH:
        return False, f"Description too long (max {MAX_GROUP_DESCRIPTION_LENGTH} chars)"
    
    return True, desc


def validate_members_list(members: list) -> tuple:
    """✅ ENHANCED: Validate members list"""
    if not isinstance(members, list):
        return False, "Members must be a list"
    
    if len(members) < MIN_MEMBERS_FOR_GROUP:
        return False, f"Need at least {MIN_MEMBERS_FOR_GROUP} members"
    
    if len(members) > MAX_MEMBERS_PER_GROUP:
        return False, f"Too many members (max {MAX_MEMBERS_PER_GROUP})"
    
    # Remove duplicates
    members = list(set(members))
    
    return True, members


def is_user_admin(db, group_id: str, user_id: str) -> bool:
    """✅ ENHANCED: Check if user is group admin"""
    try:
        group = db.groups.find_one({
            "_id": ObjectId(group_id),
            "admin_ids": user_id
        })
        return group is not None
    except:
        return False


def is_user_member(db, group_id: str, user_id: str) -> bool:
    """✅ ENHANCED: Check if user is group member"""
    try:
        group = db.groups.find_one({
            "_id": ObjectId(group_id),
            "members": user_id
        })
        return group is not None
    except:
        return False


# ============================================================
#                   GROUP CREATION
# ============================================================

@socketio.on("group:create")
def on_group_create(data):
    """
    ✅ ENHANCED: Create new group with validation
    
    data = {
        title: str,
        members: [user_id...],
        created_by: str,
        description?: str
    }
    """
    try:
        db = get_db()
        
        # ✅ ENHANCED: Validate input
        if not isinstance(data, dict):
            emit("error", {"message": "Invalid data format", "code": "INVALID_DATA"})
            return
        
        title = data.get("title", "").strip()
        members = data.get("members", [])
        created_by = data.get("created_by", "").strip()
        description = data.get("description", "").strip()
        
        # ✅ ENHANCED: Validate title
        valid, result = validate_group_name(title)
        if not valid:
            logger.warning(f"[GROUP CREATE] Invalid title: {result}")
            emit("error", {"message": result, "code": "INVALID_TITLE"})
            return
        title = result
        
        # ✅ ENHANCED: Validate description
        valid, result = validate_group_description(description)
        if not valid:
            emit("error", {"message": result, "code": "INVALID_DESCRIPTION"})
            return
        description = result
        
        # ✅ ENHANCED: Validate members
        valid, result = validate_members_list(members)
        if not valid:
            emit("error", {"message": result, "code": "INVALID_MEMBERS"})
            return
        members = result
        
        # ✅ ENHANCED: Validate created_by
        if not created_by:
            emit("error", {"message": "Creator ID required", "code": "INVALID_CREATOR"})
            return
        
        # ✅ ENHANCED: Verify creator is in members
        if created_by not in members:
            members.insert(0, created_by)
        
        # ✅ ENHANCED: Check user group limit
        user_group_count = db.groups.count_documents({"members": created_by})
        if user_group_count >= MAX_GROUPS_PER_USER:
            logger.warning(f"[GROUP CREATE] User {created_by} exceeded group limit")
            emit("error", {
                "message": f"Too many groups (max {MAX_GROUPS_PER_USER})",
                "code": "GROUP_LIMIT_EXCEEDED"
            })
            return
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = group_rate_limiter.check_limit(created_by, "create", RATE_LIMIT_GROUP_OPS)
        if not allowed:
            logger.warning(f"[GROUP CREATE] Rate limit for {created_by}: {msg}")
            emit("error", {"message": msg, "code": "RATE_LIMITED"})
            return
        
        # ✅ ENHANCED: Check for duplicate group names
        existing = db.groups.find_one({
            "title": title,
            "created_by": created_by
        })
        if existing:
            emit("error", {"message": "Group already exists", "code": "DUPLICATE_GROUP"})
            return
        
        # ✅ ENHANCED: Create group document
        group_doc = {
            "title": title,
            "description": description,
            "created_by": created_by,
            "members": members,
            "admin_ids": [created_by],
            "created_at": now_utc(),
            "updated_at": now_utc(),
            "is_active": True,
            "settings": {
                "allow_media": True,
                "allow_polls": True,
                "allow_reactions": True,
                "allow_voice": True,
                "default_encryption": "e2e"
            },
            "metadata": {
                "member_count": len(members),
                "message_count": 0,
                "last_activity": None
            }
        }
        
        res = db.groups.insert_one(group_doc)
        group_id = str(res.inserted_id)
        
        logger.info(f"[GROUP CREATE] Created group {title} ({group_id}) by {created_by}")
        
        # ✅ ENHANCED: Create associated chat document
        chat_doc = {
            "chat_type": "group",
            "group_id": ObjectId(group_id),
            "participants": members,
            "title": title,
            "description": description,
            "created_by": created_by,
            "created_at": now_utc(),
            "updated_at": now_utc(),
            "last_message_at": None,
            "last_message_preview": None,
            "settings": group_doc["settings"]
        }
        
        chat_res = db.chats.insert_one(chat_doc)
        chat_id = str(chat_res.inserted_id)
        
        # ✅ ENHANCED: Link group <-> chat
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"chat_id": chat_id}}
        )
        
        # ✅ ENHANCED: Prepare response
        group_response = {
            "group_id": group_id,
            "chat_id": chat_id,
            "title": title,
            "description": description,
            "created_by": created_by,
            "members": members,
            "admin_ids": [created_by],
            "member_count": len(members),
            "created_at": group_doc["created_at"].isoformat()
        }
        
        # ✅ ENHANCED: Send invites to members
        for uid in members:
            if uid != created_by:
                emit("group:invited", group_response, room=f"user:{uid}")
        
        # ✅ ENHANCED: Broadcast group created
        emit("group:created", group_response, broadcast=True)
        
        group_audit_logger.log("GROUP_CREATED", created_by, group_id, details={
            "title": title,
            "member_count": len(members)
        })
    
    except Exception as e:
        logger.error(f"[GROUP CREATE] Error: {e}")
        logger.error(traceback.format_exc())
        emit("error", {
            "message": "Failed to create group",
            "code": "CREATE_FAILED"
        })
        group_audit_logger.log("GROUP_CREATED", data.get("created_by"), 
                              status="failed", error_msg=str(e))


# ============================================================
#                   ADD MEMBER
# ============================================================

@socketio.on("group:add_member")
def on_group_add_member(data):
    """
    ✅ ENHANCED: Add member to group with validation
    
    data = {
        group_id: str,
        member_id: str,
        added_by: str
    }
    """
    try:
        db = get_db()
        
        # ✅ ENHANCED: Validate input
        if not isinstance(data, dict):
            emit("error", {"message": "Invalid data format", "code": "INVALID_DATA"})
            return
        
        group_id = str(data.get("group_id", "")).strip()
        member_id = str(data.get("member_id", "")).strip()
        added_by = str(data.get("added_by", "")).strip()
        
        if not group_id or not member_id or not added_by:
            emit("error", {"message": "Missing required fields", "code": "MISSING_FIELDS"})
            return
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = group_rate_limiter.check_limit(added_by, "add_member", RATE_LIMIT_MEMBER_OPS)
        if not allowed:
            emit("error", {"message": msg, "code": "RATE_LIMITED"})
            return
        
        # ✅ ENHANCED: Verify group exists
        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            logger.warning(f"[ADD MEMBER] Group not found: {group_id}")
            emit("error", {"message": "Group not found", "code": "GROUP_NOT_FOUND"})
            return
        
        # ✅ ENHANCED: Verify added_by is admin
        if added_by not in group.get("admin_ids", []):
            logger.warning(f"[ADD MEMBER] User {added_by} not admin of {group_id}")
            emit("error", {
                "message": "Only admins can add members",
                "code": "PERMISSION_DENIED"
            })
            return
        
        # ✅ ENHANCED: Check if already member
        if member_id in group.get("members", []):
            logger.warning(f"[ADD MEMBER] {member_id} already in group {group_id}")
            emit("error", {"message": "User already in group", "code": "ALREADY_MEMBER"})
            return
        
        # ✅ ENHANCED: Check member count limit
        if len(group.get("members", [])) >= MAX_MEMBERS_PER_GROUP:
            emit("error", {
                "message": f"Group is full (max {MAX_MEMBERS_PER_GROUP} members)",
                "code": "GROUP_FULL"
            })
            return
        
        # ✅ ENHANCED: Verify member exists in system
        member_user = db.users.find_one({"_id": ObjectId(member_id)})
        if not member_user:
            logger.warning(f"[ADD MEMBER] User not found: {member_id}")
            emit("error", {"message": "User not found", "code": "USER_NOT_FOUND"})
            return
        
        # ✅ ENHANCED: Update group
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$addToSet": {"members": member_id},
                "$set": {"updated_at": now_utc()},
                "$inc": {"metadata.member_count": 1}
            }
        )
        
        # ✅ ENHANCED: Update chat participants
        chat_id = group.get("chat_id")
        if chat_id:
            db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {
                    "$addToSet": {"participants": member_id},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            # ✅ ENHANCED: Auto-join socket room
            join_room(f"chat:{chat_id}")
        
        # ✅ ENHANCED: Notify new member
        emit("group:member_added", {
            "group_id": group_id,
            "chat_id": chat_id,
            "group_title": group.get("title"),
            "added_by": added_by,
            "timestamp": now_utc().isoformat()
        }, room=f"user:{member_id}")
        
        # ✅ ENHANCED: Notify existing members
        if chat_id:
            emit("group:member_joined", {
                "group_id": group_id,
                "member_id": member_id,
                "member_name": member_user.get("username", "Unknown"),
                "added_by": added_by,
                "timestamp": now_utc().isoformat()
            }, room=f"chat:{chat_id}")
        
        group_audit_logger.log("MEMBER_ADDED", added_by, group_id, details={
            "member_id": member_id,
            "group_title": group.get("title")
        })
        
        logger.info(f"[ADD MEMBER] {member_id} added to group {group_id} by {added_by}")
    
    except Exception as e:
        logger.error(f"[ADD MEMBER] Error: {e}")
        logger.error(traceback.format_exc())
        emit("error", {
            "message": "Failed to add member",
            "code": "ADD_FAILED"
        })
        group_audit_logger.log("MEMBER_ADDED", data.get("added_by"), 
                              data.get("group_id"), status="failed", error_msg=str(e))


# ============================================================
#                   REMOVE MEMBER
# ============================================================

@socketio.on("group:remove_member")
def on_group_remove_member(data):
    """
    ✅ ENHANCED: Remove member from group with validation
    
    data = {
        group_id: str,
        member_id: str,
        removed_by: str
    }
    """
    try:
        db = get_db()
        
        # ✅ ENHANCED: Validate input
        if not isinstance(data, dict):
            emit("error", {"message": "Invalid data format", "code": "INVALID_DATA"})
            return
        
        group_id = str(data.get("group_id", "")).strip()
        member_id = str(data.get("member_id", "")).strip()
        removed_by = str(data.get("removed_by", "")).strip()
        
        if not group_id or not member_id or not removed_by:
            emit("error", {"message": "Missing required fields", "code": "MISSING_FIELDS"})
            return
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = group_rate_limiter.check_limit(removed_by, "remove_member", RATE_LIMIT_MEMBER_OPS)
        if not allowed:
            emit("error", {"message": msg, "code": "RATE_LIMITED"})
            return
        
        # ✅ ENHANCED: Verify group exists
        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            emit("error", {"message": "Group not found", "code": "GROUP_NOT_FOUND"})
            return
        
        # ✅ ENHANCED: Verify removed_by is admin
        if removed_by not in group.get("admin_ids", []):
            # ✅ ENHANCED: Allow self-removal (leaving group)
            if member_id != removed_by:
                logger.warning(f"[REMOVE MEMBER] User {removed_by} not admin of {group_id}")
                emit("error", {
                    "message": "Only admins can remove members",
                    "code": "PERMISSION_DENIED"
                })
                return
        
        # ✅ ENHANCED: Check if member exists
        if member_id not in group.get("members", []):
            emit("error", {"message": "User not in group", "code": "NOT_MEMBER"})
            return
        
        # ✅ ENHANCED: Prevent removing last admin
        if member_id in group.get("admin_ids", []) and len(group.get("admin_ids", [])) == 1:
            emit("error", {
                "message": "Cannot remove last admin",
                "code": "LAST_ADMIN"
            })
            return
        
        chat_id = group.get("chat_id")
        
        # ✅ ENHANCED: Update group
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$pull": {
                    "members": member_id,
                    "admin_ids": member_id
                },
                "$set": {"updated_at": now_utc()},
                "$inc": {"metadata.member_count": -1}
            }
        )
        
        # ✅ ENHANCED: Update chat participants
        if chat_id:
            db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {
                    "$pull": {"participants": member_id},
                    "$set": {"updated_at": now_utc()}
                }
            )
        
        # ✅ ENHANCED: Notify removed member
        emit("group:member_removed", {
            "group_id": group_id,
            "chat_id": chat_id,
            "group_title": group.get("title"),
            "removed_by": removed_by,
            "timestamp": now_utc().isoformat()
        }, room=f"user:{member_id}")
        
        # ✅ ENHANCED: Notify group room
        if chat_id:
            emit("group:member_left", {
                "group_id": group_id,
                "member_id": member_id,
                "removed_by": removed_by,
                "timestamp": now_utc().isoformat()
            }, room=f"chat:{chat_id}")
        
        group_audit_logger.log("MEMBER_REMOVED", removed_by, group_id, details={
            "member_id": member_id,
            "group_title": group.get("title")
        })
        
        logger.info(f"[REMOVE MEMBER] {member_id} removed from group {group_id} by {removed_by}")
    
    except Exception as e:
        logger.error(f"[REMOVE MEMBER] Error: {e}")
        logger.error(traceback.format_exc())
        emit("error", {
            "message": "Failed to remove member",
            "code": "REMOVE_FAILED"
        })
        group_audit_logger.log("MEMBER_REMOVED", data.get("removed_by"), 
                              data.get("group_id"), status="failed", error_msg=str(e))


# ============================================================
#                   LEAVE GROUP
# ============================================================

@socketio.on("group:leave")
def on_group_leave(data):
    """
    ✅ ENHANCED: Leave group
    
    data = {
        group_id: str,
        user_id: str
    }
    """
    try:
        db = get_db()
        
        if not isinstance(data, dict):
            emit("error", {"message": "Invalid data format", "code": "INVALID_DATA"})
            return
        
        group_id = str(data.get("group_id", "")).strip()
        user_id = str(data.get("user_id", "")).strip()
        
        if not group_id or not user_id:
            emit("error", {"message": "Missing required fields", "code": "MISSING_FIELDS"})
            return
        
        # ✅ ENHANCED: Verify group exists
        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            emit("error", {"message": "Group not found", "code": "GROUP_NOT_FOUND"})
            return
        
        # ✅ ENHANCED: Check if user is member
        if user_id not in group.get("members", []):
            emit("error", {"message": "Not a member", "code": "NOT_MEMBER"})
            return
        
        # ✅ ENHANCED: Prevent leaving if only admin
        if user_id in group.get("admin_ids", []) and len(group.get("admin_ids", [])) == 1:
            emit("error", {
                "message": "Cannot leave: you are the last admin",
                "code": "LAST_ADMIN",
                "suggestion": "Promote another member to admin first"
            })
            return
        
        chat_id = group.get("chat_id")
        
        # ✅ ENHANCED: Update group
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$pull": {
                    "members": user_id,
                    "admin_ids": user_id
                },
                "$set": {"updated_at": now_utc()},
                "$inc": {"metadata.member_count": -1}
            }
        )
        
        # ✅ ENHANCED: Update chat
        if chat_id:
            db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {
                    "$pull": {"participants": user_id},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            # ✅ ENHANCED: Leave socket room
            leave_room(f"chat:{chat_id}")
        
        # ✅ ENHANCED: Notify group members
        if chat_id:
            emit("group:member_left", {
                "group_id": group_id,
                "member_id": user_id,
                "timestamp": now_utc().isoformat()
            }, room=f"chat:{chat_id}")
        
        emit("group:left", {
            "group_id": group_id,
            "message": "You have left the group"
        })
        
        group_audit_logger.log("GROUP_LEFT", user_id, group_id)
        logger.info(f"[GROUP LEAVE] {user_id} left group {group_id}")
    
    except Exception as e:
        logger.error(f"[GROUP LEAVE] Error: {e}")
        emit("error", {
            "message": "Failed to leave group",
            "code": "LEAVE_FAILED"
        })


# ============================================================
#                   PROMOTE MEMBER
# ============================================================

@socketio.on("group:promote_member")
def on_group_promote_member(data):
    """
    ✅ ENHANCED: Promote member to admin
    
    data = {
        group_id: str,
        member_id: str,
        promoted_by: str
    }
    """
    try:
        db = get_db()
        
        if not isinstance(data, dict):
            emit("error", {"message": "Invalid data format", "code": "INVALID_DATA"})
            return
        
        group_id = str(data.get("group_id", "")).strip()
        member_id = str(data.get("member_id", "")).strip()
        promoted_by = str(data.get("promoted_by", "")).strip()
        
        if not group_id or not member_id or not promoted_by:
            emit("error", {"message": "Missing required fields", "code": "MISSING_FIELDS"})
            return
        
        # ✅ ENHANCED: Verify group exists
        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            emit("error", {"message": "Group not found", "code": "GROUP_NOT_FOUND"})
            return
        
        # ✅ ENHANCED: Verify promoted_by is admin
        if promoted_by not in group.get("admin_ids", []):
            emit("error", {"message": "Only admins can promote", "code": "PERMISSION_DENIED"})
            return
        
        # ✅ ENHANCED: Check if member exists
        if member_id not in group.get("members", []):
            emit("error", {"message": "User not in group", "code": "NOT_MEMBER"})
            return
        
        # ✅ ENHANCED: Check if already admin
        if member_id in group.get("admin_ids", []):
            emit("error", {"message": "Already an admin", "code": "ALREADY_ADMIN"})
            return
        
        # ✅ ENHANCED: Promote member
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$addToSet": {"admin_ids": member_id},
                "$set": {"updated_at": now_utc()}
            }
        )
        
        # ✅ ENHANCED: Notify members
        chat_id = group.get("chat_id")
        if chat_id:
            emit("group:member_promoted", {
                "group_id": group_id,
                "member_id": member_id,
                "promoted_by": promoted_by,
                "timestamp": now_utc().isoformat()
            }, room=f"chat:{chat_id}")
        
        group_audit_logger.log("MEMBER_PROMOTED", promoted_by, group_id, 
                              details={"member_id": member_id})
        
        logger.info(f"[PROMOTE] {member_id} promoted to admin in group {group_id}")
    
    except Exception as e:
        logger.error(f"[PROMOTE MEMBER] Error: {e}")
        emit("error", {"message": "Failed to promote member", "code": "PROMOTE_FAILED"})


# ============================================================
#                   UPDATE GROUP SETTINGS
# ============================================================

@socketio.on("group:settings:update")
def on_group_settings_update(data):
    """
    ✅ ENHANCED: Update group settings
    
    data = {
        group_id: str,
        updated_by: str,
        settings: {
            allow_media?: bool,
            allow_polls?: bool,
            allow_reactions?: bool,
            allow_voice?: bool
        }
    }
    """
    try:
        db = get_db()
        
        if not isinstance(data, dict):
            emit("error", {"message": "Invalid data format", "code": "INVALID_DATA"})
            return
        
        group_id = str(data.get("group_id", "")).strip()
        updated_by = str(data.get("updated_by", "")).strip()
        settings = data.get("settings", {})
        
        if not group_id or not updated_by:
            emit("error", {"message": "Missing required fields", "code": "MISSING_FIELDS"})
            return
        
        # ✅ ENHANCED: Verify group exists
        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            emit("error", {"message": "Group not found", "code": "GROUP_NOT_FOUND"})
            return
        
        # ✅ ENHANCED: Verify updated_by is admin
        if updated_by not in group.get("admin_ids", []):
            emit("error", {"message": "Only admins can update settings", "code": "PERMISSION_DENIED"})
            return
        
        # ✅ ENHANCED: Sanitize settings
        valid_settings = {
            "allow_media": bool(settings.get("allow_media", True)),
            "allow_polls": bool(settings.get("allow_polls", True)),
            "allow_reactions": bool(settings.get("allow_reactions", True)),
            "allow_voice": bool(settings.get("allow_voice", True))
        }
        
        # ✅ ENHANCED: Update group settings
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$set": {
                    "settings": valid_settings,
                    "updated_at": now_utc()
                }
            }
        )
        
        # ✅ ENHANCED: Update chat settings mirror
        chat_id = group.get("chat_id")
        if chat_id:
            db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {"$set": {"settings": valid_settings}}
            )
        
        # ✅ ENHANCED: Broadcast settings update
        if chat_id:
            emit("group:settings:updated", {
                "group_id": group_id,
                "settings": valid_settings,
                "updated_by": updated_by,
                "timestamp": now_utc().isoformat()
            }, room=f"chat:{chat_id}")
        
        group_audit_logger.log("SETTINGS_UPDATED", updated_by, group_id, 
                              details={"settings": valid_settings})
        
        logger.info(f"[SETTINGS] Group {group_id} settings updated by {updated_by}")
    
    except Exception as e:
        logger.error(f"[GROUP SETTINGS UPDATE] Error: {e}")
        emit("error", {"message": "Failed to update settings", "code": "UPDATE_FAILED"})


# ============================================================
#                   ERROR HANDLING
# ============================================================

@socketio.on_error_default
def default_error_handler(e):
    """✅ ENHANCED: Global error handler"""
    logger.error(f"[SOCKET ERROR] {e}")
    logger.error(traceback.format_exc())
    emit("error", {
        "message": "An error occurred",
        "code": "INTERNAL_ERROR"
    })


# ============================================================
#                   INITIALIZATION (FIXED)
# ============================================================

def register_group_events(socketio_instance=None):
    """
    Register group events with Socket.IO.
    All @socketio.on handlers in this file are already active on import.
    This function exists only so app_factory can import it safely.
    """
    logger.info("[GROUP EVENTS] Registered successfully")

    if socketio_instance:
        logger.debug("[GROUP EVENTS] Socket.IO instance passed during registration")


__all__ = ["register_group_events"]
