# FILE: backend/app/routes/users.py

from flask import Blueprint, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app.utils.response_builder import success, error

users_bp = Blueprint("users", __name__, url_prefix="/api/users")
db = get_db()


# ============================================================
#                   GET CURRENT USER INFO
# ============================================================
@users_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """Get current logged-in user's info"""
    try:
        current_user_id = get_jwt_identity()
        
        user = db.users.find_one(
            {"_id": ObjectId(current_user_id)},
            {"password": 0, "two_factor_secret": 0}
        )
        
        if not user:
            return error("User not found", 404)
        
        return success(data={
            "user": {
                "id": str(user["_id"]),
                "username": user.get("username"),
                "email": user.get("email"),
            }
        })
    
    except Exception as e:
        current_app.logger.error(f"[GET CURRENT USER ERROR] {str(e)}")
        return error("Failed to fetch user info", 500)


# ============================================================
#                   LIST ALL USERS (except current user)
# ============================================================
@users_bp.route("/list", methods=["GET"])
@jwt_required()
def list_users():
    """Get all users except the current logged-in user"""
    try:
        current_user_id = get_jwt_identity()
        
        # Find all users except current user
        cursor = db.users.find(
            {"_id": {"$ne": ObjectId(current_user_id)}},
            {"password": 0, "two_factor_secret": 0}  # Exclude sensitive fields
        )
        
        users = []
        for user in cursor:
            users.append({
                "id": str(user["_id"]),
                "username": user.get("username"),
                "email": user.get("email"),
            })
        
        return success(data={"users": users})
    
    except Exception as e:
        current_app.logger.error(f"[LIST USERS ERROR] {str(e)}")
        return error("Failed to fetch users", 500)


# ============================================================
#                   DEVICE MANAGEMENT
# ============================================================
@users_bp.route("/devices", methods=["GET"])
@jwt_required()
def get_devices():
    """Get list of active devices for current user"""
    try:
        user_id = get_jwt_identity()
        # Import User model here to avoid circular imports if any, 
        # or just use the one we imported if we add it to top level
        from app.models.models import User 
        
        devices = User.get_devices(user_id)
        return success(data={"devices": devices})
    except Exception as e:
        current_app.logger.error(f"[GET DEVICES ERROR] {str(e)}")
        return error("Failed to fetch devices", 500)

@users_bp.route("/devices/<int:device_id>", methods=["DELETE"])
@jwt_required()
def revoke_device(device_id):
    """Revoke a device (remove from list and delete keys)"""
    try:
        user_id = get_jwt_identity()
        
        # Remove from user's device list
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$pull": {"devices": {"device_id": device_id}}}
        )
        
        if result.modified_count == 0:
            return error("Device not found", 404)
            
        # Also delete keys for this device
        db.key_bundles.delete_one({"user_id": user_id, "device_id": device_id})
        
        return success("Device revoked successfully")
    except Exception as e:
        current_app.logger.error(f"[REVOKE DEVICE ERROR] {str(e)}")
        return error("Failed to revoke device", 500)
