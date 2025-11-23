# FILE: backend/app/routes/users.py

from flask import Blueprint, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app.utils.response_builder import success, error

users_bp = Blueprint("users", __name__, url_prefix="/api/users")
db = get_db()


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
