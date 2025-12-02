"""
SecureChannelX User Model
-------------------------
Enhanced device management and user operations with:
  - Device registration and tracking
  - Device metadata
  - Session management
  - Device activity tracking
  - Validation and error handling
"""

import logging
from datetime import datetime
from bson import ObjectId
from flask import current_app, request

from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   CONSTANTS
# ============================================================

MAX_DEVICES_PER_USER = 10
DEVICE_INACTIVITY_TIMEOUT = 2592000  # 30 days


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_user_id(user_id: str) -> bool:
    """✅ ENHANCED: Validate user ID format"""
    try:
        ObjectId(str(user_id))
        return True
    except Exception:
        return False


def validate_device_info(device_info: dict) -> tuple:
    """✅ ENHANCED: Validate device information"""
    errors = []
    
    if not isinstance(device_info, dict):
        errors.append("Device info must be a dictionary")
    
    if "user_agent" not in device_info or not device_info.get("user_agent"):
        errors.append("user_agent is required")
    
    if device_info.get("user_agent") and len(str(device_info["user_agent"])) > 500:
        errors.append("user_agent too long (max 500 chars)")
    
    if errors:
        return False, errors
    
    return True, []


# ============================================================
#                   USER MODEL
# ============================================================

class User:
    """✅ ENHANCED: Comprehensive user model"""
    
    # ============= FIND OPERATIONS =============
    
    @staticmethod
    def find_by_username(username: str) -> dict:
        """✅ ENHANCED: Find user by username with validation"""
        try:
            if not username or not isinstance(username, str):
                logger.warning("[USER FIND] Invalid username format")
                return None
            
            db = get_db()
            user = db.users.find_one({
                "username": username.lower().strip()
            })
            
            return user
        
        except Exception as e:
            logger.error(f"[USER FIND USERNAME] Error: {e}")
            return None
    
    @staticmethod
    def find_by_email(email: str) -> dict:
        """✅ ENHANCED: Find user by email with validation"""
        try:
            if not email or not isinstance(email, str):
                logger.warning("[USER FIND] Invalid email format")
                return None
            
            db = get_db()
            user = db.users.find_one({
                "email": email.lower().strip()
            })
            
            return user
        
        except Exception as e:
            logger.error(f"[USER FIND EMAIL] Error: {e}")
            return None
    
    @staticmethod
    def find_by_id(user_id: str) -> dict:
        """✅ ENHANCED: Find user by ID with validation"""
        try:
            if not validate_user_id(user_id):
                logger.warning(f"[USER FIND ID] Invalid user ID: {user_id}")
                return None
            
            db = get_db()
            user = db.users.find_one({"_id": ObjectId(str(user_id))})
            
            return user
        
        except Exception as e:
            logger.error(f"[USER FIND ID] Error: {e}")
            return None
    
    # ============= CREATE OPERATIONS =============
    
    @staticmethod
    def create_user(user_data: dict) -> str:
        """✅ ENHANCED: Create new user with validation"""
        try:
            if not isinstance(user_data, dict):
                raise ValueError("user_data must be a dictionary")
            
            # ✅ ENHANCED: Normalize email
            if "email" in user_data:
                user_data["email"] = user_data["email"].lower().strip()
            
            # ✅ ENHANCED: Normalize username
            if "username" in user_data:
                user_data["username"] = user_data["username"].lower().strip()
            
            # ✅ ENHANCED: Add timestamps
            now = now_utc()
            user_data["created_at"] = now
            user_data["updated_at"] = now
            user_data["last_login"] = None
            
            # ✅ ENHANCED: Initialize default fields
            user_data.setdefault("is_active", True)
            user_data.setdefault("is_verified", False)
            user_data.setdefault("devices", [])
            user_data.setdefault("sessions", [])
            user_data.setdefault("contacts", [])
            user_data.setdefault("blocked_users", [])
            user_data.setdefault("preferences", {})
            
            db = get_db()
            result = db.users.insert_one(user_data)
            
            logger.info(f"[USER CREATE] User created: {result.inserted_id}")
            
            return str(result.inserted_id)
        
        except Exception as e:
            logger.error(f"[USER CREATE] Error: {e}")
            raise
    
    # ============= UPDATE OPERATIONS =============
    
    @staticmethod
    def update_user(user_id: str, update_data: dict) -> dict:
        """✅ ENHANCED: Update user with validation"""
        try:
            if not validate_user_id(user_id):
                raise ValueError("Invalid user_id")
            
            if not isinstance(update_data, dict):
                raise ValueError("update_data must be a dictionary")
            
            # ✅ ENHANCED: Add update timestamp
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
    
    # ============= DEVICE MANAGEMENT =============
    
    @staticmethod
    def add_device(user_id: str, user_agent: str = None, device_name: str = None) -> int:
        """
        ✅ ENHANCED: Register a new device for user
        
        Returns: device_id (integer)
        """
        try:
            if not validate_user_id(user_id):
                raise ValueError("Invalid user_id")
            
            db = get_db()
            user_id_str = str(user_id)
            
            # ✅ ENHANCED: Check device limit
            user = db.users.find_one({"_id": ObjectId(user_id_str)})
            if not user:
                raise ValueError("User not found")
            
            existing_devices = user.get("devices", [])
            if len(existing_devices) >= MAX_DEVICES_PER_USER:
                raise ValueError(f"Maximum devices reached ({MAX_DEVICES_PER_USER})")
            
            # ✅ ENHANCED: Generate device ID
            device_id = len(existing_devices) + 1
            
            # ✅ ENHANCED: Create device document
            device_doc = {
                "device_id": device_id,
                "name": device_name or f"Device {device_id}",
                "user_agent": user_agent or "Unknown",
                "ip_address": request.remote_addr if request else None,
                "created_at": now_utc(),
                "last_active": now_utc(),
                "is_active": True,
                "is_trusted": False,
                "metadata": {
                    "browser": None,
                    "os": None,
                    "device_type": None
                }
            }
            
            # ✅ ENHANCED: Add device to user
            db.users.update_one(
                {"_id": ObjectId(user_id_str)},
                {
                    "$push": {"devices": device_doc},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            logger.info(f"[DEVICE ADD] Device {device_id} added for user {user_id}")
            
            return device_id
        
        except Exception as e:
            logger.error(f"[DEVICE ADD] Error: {e}")
            raise
    
    @staticmethod
    def get_devices(user_id: str) -> list:
        """✅ ENHANCED: Get all active devices for user"""
        try:
            if not validate_user_id(user_id):
                logger.warning(f"[DEVICES GET] Invalid user ID: {user_id}")
                return []
            
            db = get_db()
            user = db.users.find_one(
                {"_id": ObjectId(str(user_id))},
                {"devices": 1}
            )
            
            if not user:
                logger.warning(f"[DEVICES GET] User not found: {user_id}")
                return []
            
            devices = user.get("devices", [])
            
            # ✅ ENHANCED: Filter active devices
            active_devices = [
                d for d in devices if d.get("is_active", True)
            ]
            
            logger.debug(f"[DEVICES GET] Retrieved {len(active_devices)} devices for {user_id}")
            
            return active_devices
        
        except Exception as e:
            logger.error(f"[DEVICES GET] Error: {e}")
            return []
    
    @staticmethod
    def remove_device(user_id: str, device_id: int) -> bool:
        """✅ ENHANCED: Remove device from user"""
        try:
            if not validate_user_id(user_id):
                raise ValueError("Invalid user_id")
            
            db = get_db()
            result = db.users.update_one(
                {"_id": ObjectId(str(user_id))},
                {
                    "$pull": {"devices": {"device_id": int(device_id)}},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            if result.modified_count == 0:
                logger.warning(f"[DEVICE REMOVE] Device not found: {device_id}")
                return False
            
            logger.info(f"[DEVICE REMOVE] Device {device_id} removed for user {user_id}")
            
            return True
        
        except Exception as e:
            logger.error(f"[DEVICE REMOVE] Error: {e}")
            raise
    
    @staticmethod
    def update_device_activity(user_id: str, device_id: int) -> bool:
        """✅ ENHANCED: Update device last activity timestamp"""
        try:
            if not validate_user_id(user_id):
                raise ValueError("Invalid user_id")
            
            db = get_db()
            result = db.users.update_one(
                {
                    "_id": ObjectId(str(user_id)),
                    "devices.device_id": int(device_id)
                },
                {
                    "$set": {
                        "devices.$.last_active": now_utc(),
                        "updated_at": now_utc()
                    }
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[DEVICE ACTIVITY] Error: {e}")
            return False
    
    # ============= CONTACT MANAGEMENT =============
    
    @staticmethod
    def add_contact(user_id: str, contact_user_id: str) -> bool:
        """✅ ENHANCED: Add contact to user's contact list"""
        try:
            if not validate_user_id(user_id) or not validate_user_id(contact_user_id):
                raise ValueError("Invalid user IDs")
            
            if user_id == contact_user_id:
                raise ValueError("Cannot add yourself as contact")
            
            db = get_db()
            result = db.users.update_one(
                {"_id": ObjectId(str(user_id))},
                {
                    "$addToSet": {"contacts": str(contact_user_id)},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[CONTACT ADD] Error: {e}")
            raise
    
    @staticmethod
    def remove_contact(user_id: str, contact_user_id: str) -> bool:
        """✅ ENHANCED: Remove contact from user's contact list"""
        try:
            if not validate_user_id(user_id) or not validate_user_id(contact_user_id):
                raise ValueError("Invalid user IDs")
            
            db = get_db()
            result = db.users.update_one(
                {"_id": ObjectId(str(user_id))},
                {
                    "$pull": {"contacts": str(contact_user_id)},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[CONTACT REMOVE] Error: {e}")
            raise
    
    @staticmethod
    def get_contacts(user_id: str) -> list:
        """✅ ENHANCED: Get user's contact list"""
        try:
            if not validate_user_id(user_id):
                return []
            
            db = get_db()
            user = db.users.find_one(
                {"_id": ObjectId(str(user_id))},
                {"contacts": 1}
            )
            
            return user.get("contacts", []) if user else []
        
        except Exception as e:
            logger.error(f"[CONTACTS GET] Error: {e}")
            return []
    
    # ============= BLOCKING =============
    
    @staticmethod
    def block_user(user_id: str, blocked_user_id: str) -> bool:
        """✅ ENHANCED: Block a user"""
        try:
            if not validate_user_id(user_id) or not validate_user_id(blocked_user_id):
                raise ValueError("Invalid user IDs")
            
            if user_id == blocked_user_id:
                raise ValueError("Cannot block yourself")
            
            db = get_db()
            result = db.users.update_one(
                {"_id": ObjectId(str(user_id))},
                {
                    "$addToSet": {"blocked_users": str(blocked_user_id)},
                    "$pull": {"contacts": str(blocked_user_id)},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            logger.info(f"[BLOCK USER] {user_id} blocked {blocked_user_id}")
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[BLOCK USER] Error: {e}")
            raise
    
    @staticmethod
    def unblock_user(user_id: str, blocked_user_id: str) -> bool:
        """✅ ENHANCED: Unblock a user"""
        try:
            if not validate_user_id(user_id) or not validate_user_id(blocked_user_id):
                raise ValueError("Invalid user IDs")
            
            db = get_db()
            result = db.users.update_one(
                {"_id": ObjectId(str(user_id))},
                {
                    "$pull": {"blocked_users": str(blocked_user_id)},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[UNBLOCK USER] Error: {e}")
            raise
    
    @staticmethod
    def is_blocked(user_id: str, other_user_id: str) -> bool:
        """✅ ENHANCED: Check if user is blocked"""
        try:
            if not validate_user_id(user_id):
                return False
            
            db = get_db()
            user = db.users.find_one(
                {"_id": ObjectId(str(user_id))},
                {"blocked_users": 1}
            )
            
            return str(other_user_id) in user.get("blocked_users", []) if user else False
        
        except Exception as e:
            logger.error(f"[IS BLOCKED] Error: {e}")
            return False


__all__ = ["User", "validate_user_id", "validate_device_info"]
