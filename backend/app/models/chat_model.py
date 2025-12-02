# backend/app/models/chat_model.py

"""
SecureChannelX Chat Model (Enhanced Version)
---------------------------------------------
Supports:
  - Private & Group chats
  - Message previews
  - Unread counters
  - Pinned messages
  - Message threads
  - Reactions
  - Typing metadata
  - Chat mute/archive
  - E2E encryption
  - Chat preferences
"""

from bson import ObjectId
from app.utils.helpers import now_utc
from datetime import datetime, timedelta
from app.database import get_db
import logging

logger = logging.getLogger(__name__)

# ============================================================
#                   CONSTANTS
# ============================================================

CHAT_TYPES = ["private", "group"]
MAX_PINNED_MESSAGES = 20
CHAT_ARCHIVE_RETENTION = 90  # days


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_chat_data(
    chat_type: str,
    participants: list,
    title: str = None,
    description: str = None
) -> tuple:
    """✅ ENHANCED: Validate chat data before creation"""
    errors = []
    
    # ✅ ENHANCED: Chat type validation
    if chat_type not in CHAT_TYPES:
        errors.append(f"Invalid chat_type: {chat_type}")
    
    # ✅ ENHANCED: Participants validation
    if not isinstance(participants, list):
        errors.append("Participants must be a list")
    elif len(participants) < 2:
        errors.append("Need at least 2 participants")
    elif len(set(participants)) != len(participants):
        errors.append("Duplicate participants not allowed")
    
    # ✅ ENHANCED: Group-only validations
    if chat_type == "group":
        if not title or not isinstance(title, str):
            errors.append("Group title required")
        elif len(title) < 1 or len(title) > 256:
            errors.append("Title must be 1-256 chars")
    
    if errors:
        return False, errors
    
    return True, []


# ============================================================
#                   CHAT DOCUMENT FACTORY
# ============================================================

def chat_document(
    chat_type: str,
    participants: list,
    created_by: str,
    title: str = None,
    description: str = None,
    group_id: str = None,
    is_encrypted: bool = True
) -> dict:
    """
    ✅ ENHANCED: Create chat document with full validation
    """
    
    # ✅ ENHANCED: Validate inputs
    valid, errors = validate_chat_data(chat_type, participants, title, description)
    if not valid:
        raise ValueError(f"Invalid chat data: {', '.join(errors)}")
    
    # ✅ ENHANCED: Normalize participants
    normalized_participants = sorted([str(uid) for uid in participants])
    
    # ✅ ENHANCED: Normalize created_by
    created_by_str = str(created_by)
    
    now = now_utc()
    
    # ✅ ENHANCED: Create comprehensive chat document
    doc = {
        "_id": ObjectId(),
        
        # ============= BASIC INFORMATION =============
        "chat_type": chat_type,  # private | group
        "created_by": created_by_str,
        
        # ============= PARTICIPANTS =============
        "participants": normalized_participants,
        "participant_count": len(normalized_participants),
        
        # ============= GROUP LINKAGE =============
        "group_id": str(group_id) if group_id else None,
        
        # ============= UI METADATA =============
        "title": title if chat_type == "group" else None,
        "description": description if chat_type == "group" else None,
        "chat_icon": None,  # Avatar for group chats
        "chat_color": None,  # Hex color for UI
        
        # ============= TIMESTAMPS =============
        "created_at": now,
        "updated_at": now,
        "last_message_at": None,
        "last_activity_at": now,
        
        # ============= MESSAGE METADATA =============
        "last_message_preview": None,  # Plain text preview
        "last_message_encrypted": False,  # Hide preview if encrypted media
        "last_message_sender": None,
        "last_message_type": None,  # text | image | video | etc
        "message_count": 0,
        "total_messages": 0,
        
        # ✅ ENHANCED: Unread counts per user
        "unread_map": {
            uid: 0 for uid in normalized_participants
        },
        
        # ✅ ENHANCED: User mute/archive settings
        "user_settings": {
            # user_id -> {muted, archived, notifications, ...}
        },
        
        # ============= MESSAGE PINNING =============
        "pinned_messages": [],  # List of message IDs (max MAX_PINNED_MESSAGES)
        "pinned_count": 0,
        
        # ============= THREADS (NEW) =============
        "thread_count": 0,
        "last_thread_at": None,
        
        # ============= TYPING INDICATORS =============
        "typing": [],  # List of user IDs currently typing
        "typing_timeout": 5,  # seconds
        
        # ============= REACTIONS =============
        "total_reactions": 0,
        "recent_reactions": [],  # Most used emoji reactions
        
        # ============= SECURITY & ENCRYPTION =============
        "is_encrypted": is_encrypted,
        "encryption_type": "e2e" if is_encrypted else "none",
        "key_rotation_enabled": True,
        "last_key_rotation": now,
        
        # ============= CHAT STATUS =============
        "is_active": True,
        "is_archived": False,
        "archived_at": None,
        "is_deleted": False,
        "deleted_at": None,
        
        # ============= CHAT SETTINGS =============
        "settings": {
            "allow_media": True,
            "allow_documents": True,
            "allow_links": True,
            "allow_voice_messages": True,
            "allow_video_messages": True,
            "allow_voice_calls": True,
            "allow_video_calls": True,
            "allow_polls": True,
            "allow_reactions": True,
            "allow_threads": True,
            "allow_mentions": True,
            "default_notification": "all",
            "notify_on_typing": True,
            "disappearing_messages_enabled": False,
            "disappearing_messages_timeout": None,
            "message_retention_days": None,
            "auto_delete_media": False,
            "auto_delete_media_days": None,
            "show_read_receipts": True,
            "show_typing_indicators": True,
            "show_presence": True,
        },
        
        # ============= CHAT PARTICIPANTS DATA =============
        "participant_data": {},
        
        # ============= CALL HISTORY =============
        "call_count": 0,
        "last_call_at": None,
        
        # ============= METADATA =============
        "metadata": {
            "search_index": None,
            "backup_location": None,
        }
    }
    
    # ============= GROUP-ONLY SETTINGS =============
    if chat_type == "group":
        doc["settings"].update({
            "group_permissions": {
                "send_messages": True,
                "send_media": True,
                "add_members": True,
                "remove_members": True,
                "pin_messages": True,
                "promote_members": True,
                "change_group_info": True,
            },
            "group_icon": None,
            "group_invite_link": None,
            "require_join_approval": False,
            "admin_only_messages": False,
        })
    
    # ✅ ENHANCED: Initialize participant data
    for participant_id in normalized_participants:
        doc["participant_data"][participant_id] = {
            "joined_at": now,
            "last_seen": now,
            "last_seen_message_id": None,
            "message_count": 0,
            "is_muted": False,
            "muted_until": None,
            "notification_setting": "all",
            "is_blocked": False,
            "read_receipt": "pending",
        }
        
        # Initialize user settings
        doc["user_settings"][participant_id] = {
            "is_muted": False,
            "muted_until": None,
            "is_archived": False,
            "is_pinned": False,
            "notification_setting": "all",
            "custom_notification_sound": None,
            "custom_notification_vibration": None,
        }
    
    return doc


# ============================================================
#                   CHAT HELPER FUNCTIONS
# ============================================================

def is_participant(chat: dict, user_id: str) -> bool:
    """✅ ENHANCED: Check if user is a chat participant"""
    return str(user_id) in chat.get("participants", [])


def get_participant_data(chat: dict, user_id: str) -> dict:
    """✅ ENHANCED: Get participant specific data"""
    return chat.get("participant_data", {}).get(str(user_id), {})


def get_user_settings(chat: dict, user_id: str) -> dict:
    """✅ ENHANCED: Get user's chat settings"""
    return chat.get("user_settings", {}).get(str(user_id), {})


def is_user_muted(chat: dict, user_id: str) -> bool:
    """✅ ENHANCED: Check if notifications are muted"""
    user_settings = get_user_settings(chat, user_id)
    return user_settings.get("is_muted", False)


def is_chat_archived(chat: dict, user_id: str) -> bool:
    """✅ ENHANCED: Check if chat is archived for user"""
    user_settings = get_user_settings(chat, user_id)
    return user_settings.get("is_archived", False)


def get_unread_count(chat: dict, user_id: str) -> int:
    """✅ ENHANCED: Get unread message count for user"""
    return chat.get("unread_map", {}).get(str(user_id), 0)


def increment_unread(chat: dict, user_id: str, count: int = 1) -> dict:
    """✅ ENHANCED: Increment unread counter for user"""
    user_id = str(user_id)
    if user_id not in chat.get("unread_map", {}):
        chat["unread_map"][user_id] = 0
    chat["unread_map"][user_id] += count
    return chat


def reset_unread(chat: dict, user_id: str) -> dict:
    """✅ ENHANCED: Reset unread counter for user"""
    user_id = str(user_id)
    if user_id in chat.get("unread_map", {}):
        chat["unread_map"][user_id] = 0
    return chat


# ============================================================
#                   CHAT CLASS
# ============================================================

class Chat:
    """✅ ENHANCED: Chat model class"""
    
    @staticmethod
    def create(chat_type: str, participants: list, created_by: str, **kwargs) -> str:
        """Create a new chat"""
        try:
            doc = chat_document(chat_type, participants, created_by, **kwargs)
            db = get_db()
            result = db.chats.insert_one(doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"[CHAT CREATE] Error: {e}")
            raise

    @staticmethod
    def find_by_id(chat_id: str) -> dict:
        """Find chat by ID"""
        try:
            db = get_db()
            return db.chats.find_one({"_id": ObjectId(str(chat_id))})
        except Exception as e:
            logger.error(f"[CHAT FIND] Error: {e}")
            return None

    @staticmethod
    def find_by_user(user_id: str) -> list:
        """Find chats for a user"""
        try:
            db = get_db()
            return list(db.chats.find({"participants": str(user_id)}))
        except Exception as e:
            logger.error(f"[CHAT FIND USER] Error: {e}")
            return []


__all__ = [
    "Chat",
    "chat_document",
    "validate_chat_data",
    "is_participant",
    "get_participant_data",
    "get_user_settings",
    "is_user_muted",
    "is_chat_archived",
    "get_unread_count",
    "increment_unread",
    "reset_unread"
]
