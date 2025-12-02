# backend/app/models/group_model.py

"""
SecureChannelX Group Model (Enhanced Version)
------------------------------------------------
Supports:
  - Group Admins & Moderators
  - Permissions
  - Invite links
  - Member activity tracking
  - Group size limits
  - Join codes & QR support
"""

import uuid
from bson import ObjectId
from app.utils.helpers import now_utc
from datetime import datetime, timedelta
from app.database import get_db
import logging

logger = logging.getLogger(__name__)

# ============================================================
#                   CONSTANTS
# ============================================================

MAX_GROUP_MEMBERS = 256
MAX_GROUP_NAME_LENGTH = 100
MAX_GROUP_DESCRIPTION_LENGTH = 1024
INVITE_LINK_EXPIRY = 86400 * 30  # 30 days


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_group_data(title: str, description: str = None, members: list = None) -> tuple:
    """✅ ENHANCED: Validate group data before creation"""
    errors = []
    
    if not title or not isinstance(title, str):
        errors.append("Title must be a non-empty string")
    elif len(title) > MAX_GROUP_NAME_LENGTH:
        errors.append(f"Title too long (max {MAX_GROUP_NAME_LENGTH} chars)")
    
    if description:
        if not isinstance(description, str):
            errors.append("Description must be a string")
        elif len(description) > MAX_GROUP_DESCRIPTION_LENGTH:
            errors.append(f"Description too long (max {MAX_GROUP_DESCRIPTION_LENGTH} chars)")
    
    if members:
        if not isinstance(members, list):
            errors.append("Members must be a list")
        elif len(members) < 2:
            errors.append("Need at least 2 members")
        elif len(members) > MAX_GROUP_MEMBERS:
            errors.append(f"Too many members (max {MAX_GROUP_MEMBERS})")
        else:
            # Check for duplicates
            if len(set(members)) != len(members):
                errors.append("Duplicate members not allowed")
    
    if errors:
        return False, errors
    
    return True, []


# ============================================================
#                   GROUP PERMISSIONS
# ============================================================

def get_default_permissions() -> dict:
    """✅ ENHANCED: Get default permission set"""
    return {
        "send_messages": True,
        "send_media": True,
        "add_members": True,
        "remove_members": False,
        "pin_messages": True,
        "unpin_messages": True,
        "manage_reactions": True,
        "manage_threads": True,
        "manage_invites": True,
        "manage_permissions": False,
        "promote_members": False,
        "demote_members": False,
        "change_group_info": True,
        "change_group_icon": True,
        "delete_group": False,
        "archive_group": True
    }


# ============================================================
#                   GROUP DOCUMENT FACTORY
# ============================================================

def group_document(
    title: str,
    created_by: str,
    description: str = None,
    members: list = None,
    group_icon: str = None,
    is_encrypted: bool = True
) -> dict:
    """
    ✅ ENHANCED: Create group document with full validation
    """
    
    # ✅ ENHANCED: Validate inputs
    valid, errors = validate_group_data(title, description, members)
    if not valid:
        raise ValueError(f"Invalid group data: {', '.join(errors)}")
    
    # ✅ ENHANCED: Normalize members
    member_list = [str(uid) for uid in (members or [created_by])]
    
    # ✅ ENHANCED: Ensure creator is in members
    created_by_str = str(created_by)
    if created_by_str not in member_list:
        member_list.insert(0, created_by_str)
    
    # ✅ ENHANCED: Generate invite link token
    invite_token = str(uuid.uuid4())
    invite_link = f"https://securechannelx.app/join/{invite_token}"
    
    now = now_utc()
    
    # ✅ ENHANCED: Create comprehensive group document
    doc = {
        "_id": ObjectId(),
        
        # ============= BASIC INFORMATION =============
        "title": title.strip(),
        "description": description.strip() if description else None,
        "created_by": created_by_str,
        
        # ============= MEMBERSHIP =============
        "members": member_list,
        "member_count": len(member_list),
        
        # ✅ ENHANCED: Admin management
        "admins": [created_by_str],  # Creator is always admin
        "admin_count": 1,
        
        # ✅ ENHANCED: Moderators (can manage members)
        "moderators": [],
        "moderator_count": 0,
        
        # ============= GROUP METADATA =============
        "group_icon": group_icon,
        "group_icon_url": None,  # CDN or storage URL
        "group_color": None,  # Hex color for UI
        "group_pinned_message": None,  # ID of pinned message
        
        # ============= SECURITY & ENCRYPTION =============
        "is_encrypted": is_encrypted,
        "encryption_type": "e2e" if is_encrypted else "none",
        "key_rotation_enabled": True,
        "last_key_rotation": now,
        
        # ============= TIMESTAMPS =============
        "created_at": now,
        "updated_at": now,
        "last_activity_at": now,
        "last_message_at": None,
        
        # ============= ACTIVITY METRICS =============
        "total_messages": 0,
        "total_reactions": 0,
        "total_threads": 0,
        "total_calls": 0,
        
        # ============= SETTINGS =============
        "settings": {
            "allow_media": True,
            "allow_documents": True,
            "allow_links": True,
            "allow_voice_messages": True,
            "allow_video_messages": True,
            "allow_polls": True,
            "allow_reactions": True,
            "allow_threads": True,
            "allow_mentions": True,
            "default_notification": "all",
            "mute_notifications": False,
            "muted_until": None,
            "max_members": MAX_GROUP_MEMBERS,
            "auto_join_new_members": False,
            "require_approval": False,
            "invite_link": invite_link,
            "invite_token": invite_token,
            "invite_expiry": now + timedelta(seconds=INVITE_LINK_EXPIRY),
            "invite_enabled": True,
            "invite_one_time": False,
            "max_invite_uses": None,
            "invite_uses": 0,
            "join_code": None,
            "require_join_code": False,
            "message_retention_days": None,
            "auto_delete_media": False,
            "auto_delete_media_days": None,
        },
        
        # ============= PERMISSIONS =============
        "permissions": {
            "default": get_default_permissions(),
            "admin": get_default_permissions(),
            "custom": {}
        },
        
        # ============= MEMBER-SPECIFIC DATA =============
        "member_data": {},
        
        # ============= STATUS & LIFECYCLE =============
        "is_active": True,
        "is_archived": False,
        "is_locked": False,
        "is_deleted": False,
        
        # ============= ADMIN METADATA =============
        "deleted_at": None,
        "deleted_by": None,
        "archived_at": None,
        "archived_by": None,
    }
    
    # ✅ ENHANCED: Initialize member data
    for member_id in member_list:
        doc["member_data"][member_id] = {
            "role": "admin" if member_id == created_by_str else "member",
            "joined_at": now,
            "last_seen": now,
            "is_muted": False,
            "muted_until": None,
            "notification_setting": "all",
            "is_blocked": False,
            "message_count": 0
        }
    
    return doc


# ============================================================
#                   GROUP HELPER FUNCTIONS
# ============================================================

def get_member_info(group: dict, member_id: str) -> dict:
    """✅ ENHANCED: Get member information from group"""
    return group.get("member_data", {}).get(str(member_id), {})


def is_member(group: dict, user_id: str) -> bool:
    """✅ ENHANCED: Check if user is a group member"""
    return str(user_id) in group.get("members", [])


def is_admin(group: dict, user_id: str) -> bool:
    """✅ ENHANCED: Check if user is a group admin"""
    return str(user_id) in group.get("admins", [])


def is_moderator(group: dict, user_id: str) -> bool:
    """✅ ENHANCED: Check if user is a group moderator"""
    return str(user_id) in group.get("moderators", [])


def is_creator(group: dict, user_id: str) -> bool:
    """✅ ENHANCED: Check if user is the group creator"""
    return group.get("created_by") == str(user_id)


def can_perform_action(group: dict, user_id: str, action: str) -> bool:
    """✅ ENHANCED: Check if user can perform action"""
    user_id = str(user_id)
    
    # Creator can do everything
    if is_creator(group, user_id):
        return True
    
    # Admins can do most things
    if is_admin(group, user_id) and action != "delete_group":
        return True
    
    # Moderators can manage members
    if is_moderator(group, user_id) and action in ["add_members", "remove_members", "promote_members"]:
        return True
    
    # Check permissions for regular members
    if is_member(group, user_id):
        perms = group.get("permissions", {}).get("default", {})
        return perms.get(action, False)
    
    return False


# ============================================================
#                   GROUP CLASS
# ============================================================

class Group:
    """✅ ENHANCED: Group model class"""
    
    @staticmethod
    def create(title: str, created_by: str, **kwargs) -> str:
        """Create a new group"""
        try:
            doc = group_document(title, created_by, **kwargs)
            db = get_db()
            result = db.groups.insert_one(doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"[GROUP CREATE] Error: {e}")
            raise

    @staticmethod
    def find_by_id(group_id: str) -> dict:
        """Find group by ID"""
        try:
            db = get_db()
            return db.groups.find_one({"_id": ObjectId(str(group_id))})
        except Exception as e:
            logger.error(f"[GROUP FIND] Error: {e}")
            return None

    @staticmethod
    def find_by_member(user_id: str) -> list:
        """Find groups for a member"""
        try:
            db = get_db()
            return list(db.groups.find({"members": str(user_id)}))
        except Exception as e:
            logger.error(f"[GROUP FIND MEMBER] Error: {e}")
            return []


__all__ = [
    "Group",
    "group_document",
    "validate_group_data",
    "get_default_permissions",
    "get_member_info",
    "is_member",
    "is_admin",
    "is_moderator",
    "is_creator",
    "can_perform_action"
]
