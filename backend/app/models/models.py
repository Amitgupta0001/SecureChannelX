"""
SecureChannelX Models (Enhanced Version)
-----------------------------------------
Comprehensive models for:
  - Users
  - Audit logs
  - Messages
  - Session keys
"""

import logging
import traceback
from bson import ObjectId
from app.utils.helpers import now_utc
from app.database import get_db

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_object_id(obj_id: str) -> bool:
    """✅ ENHANCED: Validate MongoDB ObjectId"""
    try:
        ObjectId(str(obj_id))
        return True
    except Exception:
        return False


# ============================================================
#                   USER MODEL
# ============================================================

class User:
    """✅ ENHANCED: User operations with comprehensive error handling"""
    
    @staticmethod
    def find_by_username(username: str) -> dict:
        """✅ ENHANCED: Find user by username"""
        try:
            if not username or not isinstance(username, str):
                return None
            
            db = get_db()
            user = db.users.find_one({"username": username.lower().strip()})
            return user
        
        except Exception as e:
            logger.error(f"[USER FIND USERNAME] Error: {e}")
            return None
    
    @staticmethod
    def find_by_email(email: str) -> dict:
        """✅ ENHANCED: Find user by email"""
        try:
            if not email or not isinstance(email, str):
                return None
            
            db = get_db()
            user = db.users.find_one({"email": email.lower().strip()})
            return user
        
        except Exception as e:
            logger.error(f"[USER FIND EMAIL] Error: {e}")
            return None
    
    @staticmethod
    def find_by_id(user_id: str) -> dict:
        """✅ ENHANCED: Find user by ID"""
        try:
            if not validate_object_id(user_id):
                return None
            
            db = get_db()
            user = db.users.find_one({"_id": ObjectId(str(user_id))})
            return user
        
        except Exception as e:
            logger.error(f"[USER FIND ID] Error: {e}")
            return None
    
    @staticmethod
    def create_user(user_data: dict) -> str:
        """✅ ENHANCED: Create new user"""
        try:
            if not isinstance(user_data, dict):
                raise ValueError("user_data must be a dictionary")
            
            # ✅ ENHANCED: Normalize data
            user_data["email"] = user_data.get("email", "").lower().strip()
            user_data["username"] = user_data.get("username", "").lower().strip()
            user_data["created_at"] = now_utc()
            user_data["updated_at"] = now_utc()
            user_data.setdefault("is_active", True)
            user_data.setdefault("devices", [])
            
            db = get_db()
            result = db.users.insert_one(user_data)
            
            logger.info(f"[USER CREATE] New user: {result.inserted_id}")
            return str(result.inserted_id)
        
        except Exception as e:
            logger.error(f"[USER CREATE] Error: {e}")
            raise
    
    @staticmethod
    def update_user(user_id: str, update_data: dict) -> dict:
        """✅ ENHANCED: Update user with timestamp"""
        try:
            if not validate_object_id(user_id):
                raise ValueError("Invalid user_id")
            
            update_data["updated_at"] = now_utc()
            
            db = get_db()
            result = db.users.update_one(
                {"_id": ObjectId(str(user_id))},
                {"$set": update_data}
            )
            
            if result.matched_count == 0:
                logger.warning(f"[USER UPDATE] User not found: {user_id}")
                return None
            
            logger.info(f"[USER UPDATE] User updated: {user_id}")
            return User.find_by_id(user_id)
        
        except Exception as e:
            logger.error(f"[USER UPDATE] Error: {e}")
            raise
    
    @staticmethod
    def add_device(user_id: str, device_info: dict) -> bool:
        """✅ ENHANCED: Add device to user"""
        try:
            if not validate_object_id(user_id):
                raise ValueError("Invalid user_id")
            
            if not isinstance(device_info, dict):
                raise ValueError("device_info must be a dictionary")
            
            # ✅ ENHANCED: Ensure required fields
            device_info.setdefault("name", "Unknown Device")
            device_info.setdefault("created_at", now_utc())
            device_info.setdefault("last_active", now_utc())
            device_info.setdefault("is_active", True)
            
            db = get_db()
            result = db.users.update_one(
                {"_id": ObjectId(str(user_id))},
                {
                    "$addToSet": {"devices": device_info},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[DEVICE ADD] Error: {e}")
            raise
    
    @staticmethod
    def get_devices(user_id: str) -> list:
        """✅ ENHANCED: Get all devices for user"""
        try:
            if not validate_object_id(user_id):
                return []
            
            db = get_db()
            user = db.users.find_one(
                {"_id": ObjectId(str(user_id))},
                {"devices": 1}
            )
            
            return user.get("devices", []) if user else []
        
        except Exception as e:
            logger.error(f"[DEVICES GET] Error: {e}")
            return []


# ============================================================
#                   AUDIT LOG MODEL
# ============================================================

class AuditLog:
    """✅ ENHANCED: Comprehensive audit logging"""
    
    COLLECTION = "audit_logs"
    
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()
        try:
            # ✅ ENHANCED: Create indexes for performance
            self.db[self.COLLECTION].create_index([("timestamp", -1)])
            self.db[self.COLLECTION].create_index([("user_id", 1)])
            self.db[self.COLLECTION].create_index([("event_type", 1)])
            # TTL index: auto-delete logs after 90 days
            self.db[self.COLLECTION].create_index([("timestamp", 1)], expireAfterSeconds=7776000)
        except Exception as e:
            logger.warning(f"[AUDIT LOG] Index creation failed: {e}")
    
    @staticmethod
    def log_event(user_id: str, event_type: str, description: str = "", 
                  ip_address: str = None, details: dict = None) -> bool:
        """✅ ENHANCED: Log audit event"""
        try:
            db = get_db()
            log_doc = {
                "user_id": str(user_id) if user_id else None,
                "event_type": event_type,
                "description": description,
                "ip_address": ip_address,
                "details": details or {},
                "timestamp": now_utc()
            }
            
            result = db.audit_logs.insert_one(log_doc)
            logger.debug(f"[AUDIT LOG] Logged {event_type} for user {user_id}")
            return result.inserted_id is not None
        
        except Exception as e:
            logger.error(f"[AUDIT LOG] Error: {e}")
            return False
    
    @staticmethod
    def get_user_logs(user_id: str, limit: int = 100) -> list:
        """✅ ENHANCED: Get user audit logs with pagination"""
        try:
            if not validate_object_id(user_id) and not isinstance(user_id, str):
                return []
            
            db = get_db()
            logs = list(
                db.audit_logs.find({"user_id": str(user_id)})
                .sort("timestamp", -1)
                .limit(limit)
            )
            
            return logs
        
        except Exception as e:
            logger.error(f"[AUDIT LOGS GET] Error: {e}")
            return []


# ============================================================
#                   MESSAGE MODEL
# ============================================================

class Message:
    """✅ ENHANCED: Message operations"""
    
    @staticmethod
    def create_message(message_doc: dict) -> str:
        """✅ ENHANCED: Create new message"""
        try:
            if not isinstance(message_doc, dict):
                raise ValueError("message_doc must be a dictionary")
            
            # ✅ ENHANCED: Add timestamps
            message_doc["created_at"] = now_utc()
            message_doc["updated_at"] = now_utc()
            message_doc.setdefault("is_deleted", False)
            message_doc.setdefault("is_edited", False)
            
            db = get_db()
            result = db.messages.insert_one(message_doc)
            
            logger.info(f"[MESSAGE CREATE] Message created: {result.inserted_id}")
            return str(result.inserted_id)
        
        except Exception as e:
            logger.error(f"[MESSAGE CREATE] Error: {e}")
            raise
    
    @staticmethod
    def get_chat_messages(chat_id: str, limit: int = 50, skip: int = 0) -> list:
        """✅ ENHANCED: Get messages with pagination"""
        try:
            if not validate_object_id(chat_id):
                return []
            
            db = get_db()
            messages = list(
                db.messages.find({
                    "chat_id": ObjectId(str(chat_id)),
                    "is_deleted": False
                })
                .sort("created_at", -1)
                .skip(skip)
                .limit(limit)
            )
            
            return messages
        
        except Exception as e:
            logger.error(f"[MESSAGES GET] Error: {e}")
            return []
    
    @staticmethod
    def delete_message(message_id: str) -> bool:
        """✅ ENHANCED: Soft delete message"""
        try:
            if not validate_object_id(message_id):
                raise ValueError("Invalid message_id")
            
            db = get_db()
            result = db.messages.update_one(
                {"_id": ObjectId(str(message_id))},
                {
                    "$set": {
                        "is_deleted": True,
                        "content": "[message deleted]",
                        "encrypted_content": "[deleted]",
                        "updated_at": now_utc()
                    }
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[MESSAGE DELETE] Error: {e}")
            raise
    
    @staticmethod
    def add_reaction(message_id: str, emoji: str, user_id: str) -> bool:
        """✅ ENHANCED: Add reaction to message"""
        try:
            if not validate_object_id(message_id):
                raise ValueError("Invalid message_id")
            
            db = get_db()
            result = db.messages.update_one(
                {"_id": ObjectId(str(message_id))},
                {
                    "$addToSet": {
                        "reactions": {
                            "emoji": emoji,
                            "user_id": str(user_id),
                            "added_at": now_utc()
                        }
                    },
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[REACTION ADD] Error: {e}")
            raise
    
    @staticmethod
    def mark_as_seen(message_id: str, user_id: str) -> bool:
        """✅ ENHANCED: Mark message as seen"""
        try:
            if not validate_object_id(message_id):
                raise ValueError("Invalid message_id")
            
            db = get_db()
            result = db.messages.update_one(
                {"_id": ObjectId(str(message_id))},
                {
                    "$addToSet": {"seen_by": str(user_id)},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[MESSAGE MARK SEEN] Error: {e}")
            raise


# ============================================================
#                   SESSION KEY MODEL
# ============================================================

class SessionKey:
    """✅ ENHANCED: Session key management for E2E encryption"""
    
    @staticmethod
    def store_session_key(user_id: str, session_key_hex: str, expires_at) -> bool:
        """✅ ENHANCED: Store session key with validation"""
        try:
            if not validate_object_id(user_id) and not isinstance(user_id, str):
                raise ValueError("Invalid user_id")
            
            if not session_key_hex or not isinstance(session_key_hex, str):
                raise ValueError("session_key_hex must be non-empty string")
            
            db = get_db()
            result = db.session_keys.insert_one({
                "user_id": str(user_id),
                "session_key": session_key_hex,
                "created_at": now_utc(),
                "expires_at": expires_at,
                "is_active": True
            })
            
            logger.info(f"[SESSION KEY STORE] Key stored for user {user_id}")
            return result.inserted_id is not None
        
        except Exception as e:
            logger.error(f"[SESSION KEY STORE] Error: {e}")
            raise
    
    @staticmethod
    def get_latest_active_key(user_id: str) -> dict:
        """✅ ENHANCED: Get latest active session key"""
        try:
            if not validate_object_id(user_id) and not isinstance(user_id, str):
                return None
            
            db = get_db()
            key = db.session_keys.find_one(
                {"user_id": str(user_id), "is_active": True},
                sort=[("created_at", -1)]
            )
            
            return key
        
        except Exception as e:
            logger.error(f"[SESSION KEY GET] Error: {e}")
            return None
    
    @staticmethod
    def deactivate_all(user_id: str) -> bool:
        """✅ ENHANCED: Deactivate all session keys for user"""
        try:
            if not validate_object_id(user_id) and not isinstance(user_id, str):
                raise ValueError("Invalid user_id")
            
            db = get_db()
            result = db.session_keys.update_many(
                {"user_id": str(user_id)},
                {"$set": {"is_active": False}}
            )
            
            logger.info(f"[SESSION KEY DEACTIVATE] Deactivated keys for user {user_id}")
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[SESSION KEY DEACTIVATE] Error: {e}")
            raise


__all__ = ["User", "AuditLog", "Message", "SessionKey", "validate_object_id"]
