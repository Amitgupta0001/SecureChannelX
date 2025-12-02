# FILE: backend/app/routes/users.py

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc

# ✅ FIXED: Use consistent blueprint name
users_bp = Blueprint("users", __name__, url_prefix="/api/users")
db = get_db()


def _authorized():
    auth = request.headers.get("Authorization", "")
    return auth.startswith("Bearer ")


# Example in-memory fallback. Replace with real DB query using your models.
_FAKE_USERS = [
    {"id": "u1", "username": "Amit", "email": "amit@example.com"},
    {"id": "u2", "username": "Mohit", "email": "mohit@example.com"},
    {"id": "u3", "username": "Riya", "email": "riya@example.com"},
]


# ============================================================
#                   GET CURRENT USER INFO
# ============================================================
@users_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """
    ✅ FIXED: Get current logged-in user's info with full profile
    """
    try:
        current_user_id = get_jwt_identity()
        
        # ✅ FIXED: Exclude sensitive fields
        user = db.users.find_one(
            {"_id": ObjectId(current_user_id)},
            {
                "password": 0,
                "two_factor_secret": 0,
                "backup_codes": 0,
                "refresh_tokens": 0
            }
        )
        
        if not user:
            return error("User not found", 404)
        
        # ✅ FIXED: Format user data
        user_data = {
            "id": str(user["_id"]),
            "username": user.get("username"),
            "email": user.get("email"),
            "full_name": user.get("full_name"),
            "avatar_url": user.get("avatar_url"),
            "bio": user.get("bio"),
            "status": user.get("status", "offline"),  # online, offline, away, busy
            "two_factor_enabled": user.get("two_factor_enabled", False),
            "is_online": user.get("is_online", False),
            "last_seen": (
                user.get("last_seen", now_utc()).isoformat()
                if isinstance(user.get("last_seen"), datetime)
                else user.get("last_seen")
            ),
            "created_at": (
                user.get("created_at", now_utc()).isoformat()
                if isinstance(user.get("created_at"), datetime)
                else user.get("created_at")
            ),
            "updated_at": (
                user.get("updated_at", now_utc()).isoformat()
                if isinstance(user.get("updated_at"), datetime)
                else user.get("updated_at")
            ),
            "email_verified": user.get("email_verified", False),
            "preferences": user.get("preferences", {})
        }
        
        current_app.logger.info(f"[USER] Retrieved profile for user {current_user_id}")
        
        return success(data={"user": user_data})
    
    except Exception as e:
        current_app.logger.error(f"[GET CURRENT USER ERROR] {str(e)}")
        return error("Failed to fetch user info", 500)


# ============================================================
#                   UPDATE CURRENT USER PROFILE
# ============================================================
@users_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_current_user():
    """
    ✅ FIXED: Update current user's profile information
    
    Body: {
        "full_name": "John Doe",
        "bio": "Software engineer",
        "avatar_url": "https://...",
        "status": "online|away|busy|offline",
        "preferences": { ... }
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        
        # ✅ FIXED: Validate updateable fields
        allowed_fields = {
            "full_name": str,
            "bio": str,
            "avatar_url": str,
            "status": str,
            "preferences": dict
        }
        
        update_data = {}
        
        for field, field_type in allowed_fields.items():
            if field in data:
                value = data[field]
                
                # ✅ FIXED: Type validation
                if not isinstance(value, field_type):
                    return error(f"{field} must be {field_type.__name__}", 400)
                
                # ✅ FIXED: Field-specific validation
                if field == "full_name" and (len(value) < 2 or len(value) > 100):
                    return error("Full name must be 2-100 characters", 400)
                
                if field == "bio" and len(value) > 500:
                    return error("Bio must be less than 500 characters", 400)
                
                if field == "avatar_url":
                    if not value.startswith(("http://", "https://", "")):
                        return error("Invalid avatar URL", 400)
                
                if field == "status" and value not in ["online", "offline", "away", "busy"]:
                    return error("Invalid status. Allowed: online, offline, away, busy", 400)
                
                update_data[field] = value
        
        if not update_data:
            return error("No valid fields to update", 400)
        
        # ✅ FIXED: Add update timestamp
        update_data["updated_at"] = now_utc()
        
        result = db.users.update_one(
            {"_id": ObjectId(current_user_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return error("User not found", 404)
        
        current_app.logger.info(f"[USER] Updated profile for user {current_user_id}")
        
        return success("Profile updated successfully", {
            "updated_fields": list(update_data.keys())
        })
    
    except Exception as e:
        current_app.logger.error(f"[UPDATE USER ERROR] {str(e)}")
        return error("Failed to update profile", 500)


# ============================================================
#                   GET USER BY ID
# ============================================================
@users_bp.route("/<user_id>", methods=["GET"])
@jwt_required()
def get_user_by_id(user_id):
    """
    ✅ FIXED: Get public profile of any user
    """
    try:
        current_user_id = get_jwt_identity()
        
        # ✅ FIXED: Validate user_id format
        try:
            user_oid = ObjectId(user_id)
        except:
            return error("Invalid user_id format", 400)
        
        # ✅ FIXED: Only return public fields
        user = db.users.find_one(
            {"_id": user_oid},
            {
                "password": 0,
                "two_factor_secret": 0,
                "backup_codes": 0,
                "refresh_tokens": 0,
                "email": 0,  # ✅ FIXED: Don't expose email in public profile
                "phone": 0
            }
        )
        
        if not user:
            return error("User not found", 404)
        
        # ✅ FIXED: Check if blocked
        is_blocked = db.blocks.find_one({
            "$or": [
                {"blocker_id": current_user_id, "blocked_id": user_id},
                {"blocker_id": user_id, "blocked_id": current_user_id}
            ]
        })
        
        if is_blocked:
            return error("User not found", 404)
        
        user_data = {
            "id": str(user["_id"]),
            "username": user.get("username"),
            "full_name": user.get("full_name"),
            "avatar_url": user.get("avatar_url"),
            "bio": user.get("bio"),
            "status": user.get("status", "offline"),
            "is_online": user.get("is_online", False),
            "last_seen": (
                user.get("last_seen", now_utc()).isoformat()
                if isinstance(user.get("last_seen"), datetime)
                else user.get("last_seen")
            )
        }
        
        return success(data={"user": user_data})
    
    except Exception as e:
        current_app.logger.error(f"[GET USER BY ID ERROR] {str(e)}")
        return error("Failed to fetch user", 500)


# ============================================================
#                   SEARCH USERS
# ============================================================
@users_bp.route("/search", methods=["GET"])
@jwt_required()
def search_users():
    """
    ✅ FIXED: Search users by username or full name
    
    Query params:
    - q: search query (required)
    - limit: results per page (default: 20)
    - skip: pagination offset (default: 0)
    """
    try:
        current_user_id = get_jwt_identity()
        query = (request.args.get("q") or "").strip()
        limit = int(request.args.get("limit", 20))
        skip = int(request.args.get("skip", 0))
        
        # ✅ FIXED: Validate search query
        if not query or len(query) < 2:
            return error("Search query must be at least 2 characters", 400)
        
        if len(query) > 100:
            return error("Search query too long", 400)
        
        if limit > 100:
            limit = 100
        
        # ✅ FIXED: Case-insensitive search with regex
        search_pattern = {"$regex": query, "$options": "i"}
        
        cursor = (
            db.users.find(
                {
                    "_id": {"$ne": ObjectId(current_user_id)},
                    "$or": [
                        {"username": search_pattern},
                        {"full_name": search_pattern},
                        {"email": search_pattern}
                    ]
                },
                {
                    "password": 0,
                    "two_factor_secret": 0,
                    "backup_codes": 0,
                    "email": 0,
                    "phone": 0
                }
            )
            .skip(skip)
            .limit(limit)
        )
        
        users = []
        for user in cursor:
            users.append({
                "id": str(user["_id"]),
                "username": user.get("username"),
                "full_name": user.get("full_name"),
                "avatar_url": user.get("avatar_url"),
                "status": user.get("status", "offline"),
                "is_online": user.get("is_online", False)
            })
        
        total = db.users.count_documents({
            "_id": {"$ne": ObjectId(current_user_id)},
            "$or": [
                {"username": search_pattern},
                {"full_name": search_pattern},
                {"email": search_pattern}
            ]
        })
        
        current_app.logger.info(f"[USER SEARCH] User {current_user_id} searched for '{query}'")
        
        return success(data={
            "results": users,
            "total": total,
            "limit": limit,
            "skip": skip,
            "has_more": (skip + limit) < total
        })
    
    except Exception as e:
        current_app.logger.error(f"[SEARCH USERS ERROR] {str(e)}")
        return error("Failed to search users", 500)


# ============================================================
#                   LIST ALL USERS (with pagination)
# ============================================================
@users_bp.route("/list", methods=["GET"])
@jwt_required()
def list_users():
    """
    ✅ FIXED: Get all users except current user with pagination
    
    Query params:
    - limit: results per page (default: 50)
    - skip: pagination offset (default: 0)
    - online_only: show only online users (default: false)
    """
    try:
        current_user_id = get_jwt_identity()
        limit = int(request.args.get("limit", 50))
        skip = int(request.args.get("skip", 0))
        online_only = request.args.get("online_only", "false").lower() == "true"
        
        if limit > 200:
            limit = 200
        
        # ✅ FIXED: Build query
        query = {"_id": {"$ne": ObjectId(current_user_id)}}
        
        if online_only:
            query["is_online"] = True
        
        # ✅ FIXED: Exclude sensitive fields
        cursor = (
            db.users.find(
                query,
                {
                    "password": 0,
                    "two_factor_secret": 0,
                    "backup_codes": 0,
                    "refresh_tokens": 0,
                    "phone": 0
                }
            )
            .sort("last_seen", -1)
            .skip(skip)
            .limit(limit)
        )
        
        users = []
        for user in cursor:
            users.append({
                "id": str(user["_id"]),
                "username": user.get("username"),
                "full_name": user.get("full_name"),
                "avatar_url": user.get("avatar_url"),
                "status": user.get("status", "offline"),
                "is_online": user.get("is_online", False),
                "last_seen": (
                    user.get("last_seen", now_utc()).isoformat()
                    if isinstance(user.get("last_seen"), datetime)
                    else user.get("last_seen")
                )
            })
        
        total = db.users.count_documents(query)
        
        return success(data={
            "users": users,
            "total": total,
            "limit": limit,
            "skip": skip,
            "has_more": (skip + limit) < total
        })
    
    except Exception as e:
        current_app.logger.error(f"[LIST USERS ERROR] {str(e)}")
        return error("Failed to fetch users", 500)


# ============================================================
#                   DEVICE MANAGEMENT: LIST
# ============================================================
@users_bp.route("/devices", methods=["GET"])
@jwt_required()
def get_devices():
    """
    ✅ FIXED: Get list of active devices for current user
    """
    try:
        user_id = get_jwt_identity()
        
        cursor = (
            db.user_devices.find({"user_id": user_id})
            .sort("last_active", -1)
        )
        
        devices = []
        for device in cursor:
            device_data = {
                "id": str(device.get("_id")),
                "device_id": device.get("device_id"),
                "device_name": device.get("device_name", "Unknown Device"),
                "device_type": device.get("device_type", "web"),  # web, android, ios
                "os": device.get("os"),
                "browser": device.get("browser"),
                "ip_address": device.get("ip_address"),
                "last_active": (
                    device.get("last_active", now_utc()).isoformat()
                    if isinstance(device.get("last_active"), datetime)
                    else device.get("last_active")
                ),
                "is_active": device.get("is_active", True)
            }
            devices.append(device_data)
        
        current_app.logger.info(f"[DEVICES] User {user_id} fetched device list")
        
        return success(data={"devices": devices})
    
    except Exception as e:
        current_app.logger.error(f"[GET DEVICES ERROR] {str(e)}")
        return error("Failed to fetch devices", 500)


# ============================================================
#                   DEVICE MANAGEMENT: REMOVE
# ============================================================
@users_bp.route("/devices/<device_id>", methods=["DELETE"])
@jwt_required()
def revoke_device(device_id):
    """
    ✅ FIXED: Revoke/remove a device
    """
    try:
        user_id = get_jwt_identity()
        
        # ✅ FIXED: Validate device_id format
        try:
            device_oid = ObjectId(device_id)
        except:
            return error("Invalid device_id format", 400)
        
        # ✅ FIXED: Check if device belongs to user
        device = db.user_devices.find_one({
            "_id": device_oid,
            "user_id": user_id
        })
        
        if not device:
            return error("Device not found", 404)
        
        # ✅ FIXED: Delete device
        result = db.user_devices.delete_one({
            "_id": device_oid,
            "user_id": user_id
        })
        
        if result.deleted_count == 0:
            return error("Failed to delete device", 400)
        
        # ✅ FIXED: Also delete keys for this device
        db.key_bundles.delete_one({
            "user_id": user_id,
            "device_id": device.get("device_id")
        })
        
        current_app.logger.info(f"[DEVICE] User {user_id} revoked device {device_id}")
        
        return success("Device revoked successfully")
    
    except Exception as e:
        current_app.logger.error(f"[REVOKE DEVICE ERROR] {str(e)}")
        return error("Failed to revoke device", 500)


# ============================================================
#                   USER FRIENDS / CONTACTS
# ============================================================
@users_bp.route("/friends", methods=["GET"])
@jwt_required()
def get_friends():
    """
    ✅ FIXED: Get current user's friends list with status
    """
    try:
        user_id = get_jwt_identity()
        
        # ✅ FIXED: Fetch friends from separate collection
        cursor = (
            db.friendships.find(
                {"$or": [
                    {"user_id_a": user_id},
                    {"user_id_b": user_id}
                ]},
                {"status": "accepted"}
            )
            .sort("accepted_at", -1)
        )
        
        friend_ids = []
        for friendship in cursor:
            friend_id = friendship.get("user_id_b") if friendship.get("user_id_a") == user_id else friendship.get("user_id_a")
            friend_ids.append(ObjectId(friend_id))
        
        # ✅ FIXED: Get friend details
        friends = []
        for friend_id in friend_ids:
            friend = db.users.find_one(
                {"_id": friend_id},
                {"password": 0, "two_factor_secret": 0, "backup_codes": 0, "email": 0}
            )
            
            if friend:
                friends.append({
                    "id": str(friend["_id"]),
                    "username": friend.get("username"),
                    "full_name": friend.get("full_name"),
                    "avatar_url": friend.get("avatar_url"),
                    "status": friend.get("status", "offline"),
                    "is_online": friend.get("is_online", False),
                    "last_seen": (
                        friend.get("last_seen", now_utc()).isoformat()
                        if isinstance(friend.get("last_seen"), datetime)
                        else friend.get("last_seen")
                    )
                })
        
        return success(data={
            "friends": friends,
            "total": len(friends)
        })
    
    except Exception as e:
        current_app.logger.error(f"[GET FRIENDS ERROR] {str(e)}")
        return error("Failed to fetch friends", 500)


# ============================================================
#                   BLOCK/UNBLOCK USER
# ============================================================
@users_bp.route("/<user_id>/block", methods=["POST"])
@jwt_required()
def block_user(user_id):
    """
    ✅ FIXED: Block a user from sending messages
    """
    try:
        current_user_id = get_jwt_identity()
        
        # ✅ FIXED: Validate user_id format
        try:
            blocked_user_oid = ObjectId(user_id)
        except:
            return error("Invalid user_id format", 400)
        
        # ✅ FIXED: Prevent self-blocking
        if current_user_id == user_id:
            return error("Cannot block yourself", 400)
        
        # ✅ FIXED: Check if target user exists
        target_user = db.users.find_one({"_id": blocked_user_oid})
        if not target_user:
            return error("User not found", 404)
        
        # ✅ FIXED: Check if already blocked
        existing_block = db.blocks.find_one({
            "blocker_id": current_user_id,
            "blocked_id": user_id
        })
        
        if existing_block:
            return error("User already blocked", 409)
        
        # ✅ FIXED: Create block
        db.blocks.insert_one({
            "blocker_id": current_user_id,
            "blocked_id": user_id,
            "created_at": now_utc()
        })
        
        current_app.logger.info(f"[BLOCK] User {current_user_id} blocked user {user_id}")
        
        return success("User blocked successfully")
    
    except Exception as e:
        current_app.logger.error(f"[BLOCK USER ERROR] {str(e)}")
        return error("Failed to block user", 500)


# ============================================================
#                   UNBLOCK USER
# ============================================================
@users_bp.route("/<user_id>/unblock", methods=["POST"])
@jwt_required()
def unblock_user(user_id):
    """
    ✅ FIXED: Unblock a previously blocked user
    """
    try:
        current_user_id = get_jwt_identity()
        
        try:
            user_oid = ObjectId(user_id)
        except:
            return error("Invalid user_id format", 400)
        
        result = db.blocks.delete_one({
            "blocker_id": current_user_id,
            "blocked_id": user_id
        })
        
        if result.deleted_count == 0:
            return error("User not blocked", 404)
        
        current_app.logger.info(f"[UNBLOCK] User {current_user_id} unblocked user {user_id}")
        
        return success("User unblocked successfully")
    
    except Exception as e:
        current_app.logger.error(f"[UNBLOCK USER ERROR] {str(e)}")
        return error("Failed to unblock user", 500)


# ============================================================
#                   GET BLOCKED USERS
# ============================================================
@users_bp.route("/blocked-users", methods=["GET"])
@jwt_required()
def get_blocked_users():
    """
    ✅ FIXED: Get list of users blocked by current user
    """
    try:
        current_user_id = get_jwt_identity()
        
        cursor = db.blocks.find({"blocker_id": current_user_id})
        
        blocked_users = []
        for block in cursor:
            blocked_user = db.users.find_one(
                {"_id": ObjectId(block["blocked_id"])},
                {"password": 0, "two_factor_secret": 0, "backup_codes": 0}
            )
            
            if blocked_user:
                blocked_users.append({
                    "id": str(blocked_user["_id"]),
                    "username": blocked_user.get("username"),
                    "full_name": blocked_user.get("full_name"),
                    "avatar_url": blocked_user.get("avatar_url"),
                    "blocked_at": (
                        block.get("created_at", now_utc()).isoformat()
                        if isinstance(block.get("created_at"), datetime)
                        else block.get("created_at")
                    )
                })
        
        return success(data={
            "blocked_users": blocked_users,
            "total": len(blocked_users)
        })
    
    except Exception as e:
        current_app.logger.error(f"[GET BLOCKED USERS ERROR] {str(e)}")
        return error("Failed to fetch blocked users", 500)


# ============================================================
#                   UPDATE USER STATUS
# ============================================================
@users_bp.route("/status", methods=["PUT"])
@jwt_required()
def update_status():
    """
    ✅ FIXED: Update user's online status
    
    Body: {
        "status": "online|away|busy|offline"
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        status = (data.get("status") or "offline").strip().lower()
        
        # ✅ FIXED: Validate status
        allowed_statuses = ["online", "offline", "away", "busy"]
        if status not in allowed_statuses:
            return error(f"Invalid status. Allowed: {', '.join(allowed_statuses)}", 400)
        
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "status": status,
                    "is_online": status == "online",
                    "last_seen": now_utc()
                }
            }
        )
        
        return success("Status updated successfully", {"status": status})
    
    except Exception as e:
        current_app.logger.error(f"[UPDATE STATUS ERROR] {str(e)}")
        return error("Failed to update status", 500)


# ============================================================
#                   DELETE ACCOUNT
# ============================================================
@users_bp.route("/me", methods=["DELETE"])
@jwt_required()
def delete_account():
    """
    ✅ FIXED: Delete user account (soft delete)
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        password = data.get("password", "").strip()
        
        # ✅ FIXED: Require password confirmation
        if not password:
            return error("Password required for account deletion", 400)
        
        from app import bcrypt
        
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return error("User not found", 404)
        
        # ✅ FIXED: Verify password
        if not bcrypt.check_password_hash(user.get("password", ""), password):
            return error("Invalid password", 401)
        
        # ✅ FIXED: Soft delete (mark as deleted)
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": now_utc(),
                    "email": None,  # ✅ FIXED: Clear email for privacy
                    "username": f"deleted_user_{user_id}"
                }
            }
        )
        
        # ✅ FIXED: Clean up related data
        db.chats.delete_many({"participants": user_id})
        db.messages.delete_many({"sender_id": user_id})
        db.friendships.delete_many({
            "$or": [
                {"user_id_a": user_id},
                {"user_id_b": user_id}
            ]
        })
        
        current_app.logger.info(f"[ACCOUNT] User {user_id} deleted account")
        
        return success("Account deleted successfully")
    
    except Exception as e:
        current_app.logger.error(f"[DELETE ACCOUNT ERROR] {str(e)}")
        return error("Failed to delete account", 500)