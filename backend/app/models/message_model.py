# backend/app/models/message_model.py

"""
SecureChannelX Message Model (Enhanced Version)
------------------------------------------------
Full WhatsApp-level message support:
  - Text messages (plain & encrypted)
  - File messages (images, videos, documents, audio)
  - Voice notes
  - Polls
  - System messages (joins, leaves, promotions)
  - Call events
  - Threaded replies
  - Message reactions
  - Read receipts
  - Edit history
  - Soft delete with recovery
"""

import logging
from bson import ObjectId
from app.utils.helpers import now_utc
from app.database import get_db

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   CONSTANTS
# ============================================================

MESSAGE_TYPES = [
    "text",          # Plain text message
    "encrypted",     # Encrypted text message
    "file",          # Generic file (document, PDF, etc)
    "image",         # Image message
    "video",         # Video message
    "audio",         # Audio/voice note
    "poll",          # Poll message
    "call",          # Call event
    "system",        # System message (join, leave, promote, etc)
    "reaction",      # Emoji reaction
]

SYSTEM_MESSAGE_TYPES = [
    "user_joined",
    "user_left",
    "user_promoted",
    "user_demoted",
    "group_created",
    "group_name_changed",
    "group_icon_changed",
    "group_description_changed",
    "members_added",
    "members_removed"
]

FILE_TYPES = [
    "document",
    "image",
    "video",
    "audio",
    "archive"
]


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_message_data(
    chat_id: str,
    sender_id: str,
    message_type: str,
    content: str = None
) -> tuple:
    """✅ ENHANCED: Validate message data"""
    errors = []
    
    if not chat_id or not isinstance(chat_id, str):
        errors.append("Valid chat_id required")
    
    if not sender_id or not isinstance(sender_id, str):
        errors.append("Valid sender_id required")
    
    if message_type not in MESSAGE_TYPES:
        errors.append(f"Invalid message_type: {message_type}")
    
    if content and len(str(content)) > 65536:
        errors.append("Content too large (max 64KB)")
    
    if errors:
        return False, errors
    
    return True, []


# ============================================================
#                   MESSAGE DOCUMENT FACTORY
# ============================================================

def message_document(
    chat_id: str,
    sender_id: str,
    message_type: str,
    content: str = None,
    encrypted_content: str = None,
    parent_id: str = None,
    extra: dict = None,
    username: str = "Unknown"
) -> dict:
    """
    ✅ ENHANCED: Create comprehensive message document
    """
    
    # ✅ ENHANCED: Validate inputs
    valid, errors = validate_message_data(chat_id, sender_id, message_type, content)
    if not valid:
        raise ValueError(f"Invalid message data: {', '.join(errors)}")
    
    now = now_utc()
    
    # ✅ ENHANCED: Create comprehensive message document
    doc = {
        "_id": ObjectId(),
        
        # ============= REFERENCES =============
        "chat_id": str(chat_id),
        "sender_id": str(sender_id),
        "username": username or "Unknown",
        
        # ============= MESSAGE CONTENT =============
        "message_type": message_type,
        "content": content,  # Plain text (if not encrypted)
        "encrypted_content": encrypted_content,  # AES-GCM ciphertext (base64)
        "x3dh_header": None,  # X3DH key data
        
        # ============= THREADING =============
        "parent_id": str(parent_id) if parent_id else None,
        "reply_count": 0,  # Number of replies in thread
        "last_reply_at": None,
        
        # ============= METADATA =============
        "extra": extra or {},  # File info, poll data, call info, etc
        
        # ============= MESSAGE EDITING & DELETION =============
        "is_edited": False,
        "edit_history": [],  # [{content, edited_at, edited_by}, ...]
        "is_deleted": False,  # Soft delete
        "deleted_at": None,
        "deleted_by": None,
        "can_recover_until": None,  # Recovery window
        
        # ============= MESSAGE STATE =============
        "is_pinned": False,
        "pinned_at": None,
        "pinned_by": None,
        
        # ============= REACTIONS =============
        "reactions": [],  # [{emoji, user_id, added_at}, ...]
        "reaction_count": 0,
        
        # ============= READ RECEIPTS =============
        "seen_by": [],  # User IDs who have seen
        "delivered_to": [],  # User IDs who received
        "read_at": None,  # When sender read it
        "delivery_status": "pending",  # pending | delivered | read
        
        # ============= TIMESTAMPS =============
        "created_at": now,
        "updated_at": now,
        "message_index": 0,  # For ordering within chat
        
        # ============= E2E ENCRYPTION =============
        "is_encrypted": bool(encrypted_content),
        "encryption_type": "e2e" if encrypted_content else "none",
        "requires_key_rotation": False,
        
        # ============= MEDIA HANDLING =============
        "media_urls": [],  # [{url, type, size}, ...]
        "media_download_link": None,
        "expires_at": None,  # For disappearing messages
        
        # ============= AUDIT & COMPLIANCE =============
        "metadata": {
            "client_version": None,
            "device_id": None,
            "ip_address": None,
            "failed_decrypt_count": 0,
        }
    }
    
    # ✅ ENHANCED: Type-specific fields
    if message_type == "file":
        doc["extra"].setdefault("filename", "document")
        doc["extra"].setdefault("mime_type", "application/octet-stream")
        doc["extra"].setdefault("file_size", 0)
        doc["extra"].setdefault("storage_url", None)
    
    elif message_type in ["image", "video"]:
        doc["extra"].setdefault("thumbnail_url", None)
        doc["extra"].setdefault("media_size", 0)
        doc["extra"].setdefault("dimensions", {"width": 0, "height": 0})
        doc["extra"].setdefault("duration", None)  # For video
    
    elif message_type == "audio":
        doc["extra"].setdefault("duration_seconds", 0)
        doc["extra"].setdefault("waveform", [])  # For UI visualization
        doc["extra"].setdefault("is_voice_note", True)
    
    elif message_type == "poll":
        doc["extra"].setdefault("question", "Poll Question")
        doc["extra"].setdefault("options", [])
        doc["extra"].setdefault("votes", {})  # user_id -> option_index
        doc["extra"].setdefault("allows_multiple", False)
        doc["extra"].setdefault("is_anonymous", False)
        doc["extra"].setdefault("ends_at", None)
    
    elif message_type == "call":
        doc["extra"].setdefault("call_id", None)
        doc["extra"].setdefault("call_type", "audio")  # audio | video
        doc["extra"].setdefault("status", "missed")  # missed | ended | failed
        doc["extra"].setdefault("duration_seconds", 0)
        doc["extra"].setdefault("participants", [])
    
    elif message_type == "system":
        doc["extra"].setdefault("system_type", "user_joined")
        doc["extra"].setdefault("target_user", None)
        doc["extra"].setdefault("action_by", sender_id)
    
    return doc


# ============================================================
#                   MESSAGE HELPER FUNCTIONS
# ============================================================

def format_message_for_display(message: dict) -> dict:
    """✅ ENHANCED: Format message for API response"""
    try:
        return {
            "id": str(message.get("_id")),
            "chat_id": message.get("chat_id"),
            "sender_id": message.get("sender_id"),
            "username": message.get("username", "Unknown"),
            "message_type": message.get("message_type"),
            "content": "[encrypted]" if message.get("is_encrypted") else message.get("content"),
            "is_edited": message.get("is_edited", False),
            "is_deleted": message.get("is_deleted", False),
            "is_pinned": message.get("is_pinned", False),
            "reactions": message.get("reactions", []),
            "reply_count": message.get("reply_count", 0),
            "seen_count": len(message.get("seen_by", [])),
            "created_at": message.get("created_at").isoformat() if message.get("created_at") else None,
            "parent_id": message.get("parent_id"),
            "extra": message.get("extra", {})
        }
    
    except Exception as e:
        logger.error(f"[FORMAT MESSAGE] Error: {e}")
        return {}


def get_message_preview(message: dict, max_length: int = 100) -> str:
    """✅ ENHANCED: Get message preview text"""
    try:
        msg_type = message.get("message_type", "text")
        
        if message.get("is_deleted"):
            return "[message deleted]"
        
        if message.get("is_encrypted"):
            type_map = {
                "image": "🖼️ Photo",
                "video": "🎥 Video",
                "audio": "🎤 Voice message",
                "file": "📄 Document",
                "poll": "📊 Poll",
                "call": "📞 Call",
            }
            return type_map.get(msg_type, "📨 Message")
        
        content = message.get("content", "")
        
        if msg_type == "image":
            return "🖼️ Photo"
        elif msg_type == "video":
            return "🎥 Video"
        elif msg_type == "audio":
            return "🎤 Voice message"
        elif msg_type == "file":
            filename = message.get("extra", {}).get("filename", "Document")
            return f"📄 {filename}"
        elif msg_type == "poll":
            question = message.get("extra", {}).get("question", "Poll")
            return f"📊 {question}"
        elif msg_type == "call":
            status = message.get("extra", {}).get("status", "Call")
            return f"📞 {status}"
        else:
            return content[:max_length] + ("..." if len(content) > max_length else "")
    
    except Exception as e:
        logger.error(f"[GET PREVIEW] Error: {e}")
        return "Message"


# ============================================================
#                   MESSAGE CLASS
# ============================================================

class Message:
    """✅ ENHANCED: Message model class"""
    
    @staticmethod
    def create(chat_id: str, sender_id: str, message_type: str, **kwargs) -> str:
        """Create a new message"""
        try:
            doc = message_document(chat_id, sender_id, message_type, **kwargs)
            db = get_db()
            result = db.messages.insert_one(doc)
            
            # Update chat last message
            db.chats.update_one(
                {"_id": ObjectId(str(chat_id))},
                {
                    "$set": {
                        "last_message_at": now_utc(),
                        "last_message_preview": get_message_preview(doc),
                        "last_message_sender": str(sender_id),
                        "last_message_type": message_type
                    },
                    "$inc": {"message_count": 1}
                }
            )
            
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"[MESSAGE CREATE] Error: {e}")
            raise

    @staticmethod
    def find_by_id(message_id: str) -> dict:
        """Find message by ID"""
        try:
            db = get_db()
            return db.messages.find_one({"_id": ObjectId(str(message_id))})
        except Exception as e:
            logger.error(f"[MESSAGE FIND] Error: {e}")
            return None

    @staticmethod
    def find_by_chat(chat_id: str, limit: int = 50, skip: int = 0) -> list:
        """Find messages in a chat"""
        try:
            db = get_db()
            return list(db.messages.find(
                {"chat_id": str(chat_id)}
            ).sort("created_at", -1).skip(skip).limit(limit))
        except Exception as e:
            logger.error(f"[MESSAGE FIND CHAT] Error: {e}")
            return []


__all__ = [
    "Message",
    "message_document",
    "validate_message_data",
    "format_message_for_display",
    "get_message_preview",
    "MESSAGE_TYPES",
    "SYSTEM_MESSAGE_TYPES"
]
