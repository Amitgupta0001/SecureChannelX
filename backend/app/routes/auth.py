# FILE: backend/app/routes/auth.py

from flask import Blueprint, request, current_app, jsonify
from flask_jwt_extended import (
    jwt_required,
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    get_jwt,
    decode_token
)
from bson import ObjectId
from datetime import timedelta
import random
import uuid

# Correct imports
from app import bcrypt, limiter
from app.database import get_db

from app.utils.validators import validate_email, validate_username, validate_password
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app.utils.email import send_email

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
db = get_db()


# ======================================================
#                     USER MODEL
# ======================================================
class User:
    @staticmethod
    def find_by_username(username: str):
        return db.users.find_one({"username": username})

    @staticmethod
    def find_by_email(email: str):
        return db.users.find_one({"email": email})

    @staticmethod
    def find_by_id(user_id: str):
        try:
            return db.users.find_one({"_id": ObjectId(user_id)})
        except Exception as e:
            current_app.logger.error(f"[USER FIND ERROR] {e}")
            return None

    @staticmethod
    def create(data: dict):
        return db.users.insert_one(data).inserted_id

    @staticmethod
    def add_device(user_id, device_info):
        try:
            if not isinstance(user_id, ObjectId):
                user_id = ObjectId(user_id)

            # Ensure devices array exists
            db.users.update_one(
                {"_id": user_id, "devices": {"$exists": False}},
                {"$set": {"devices": []}}
            )

            # Add new device
            db.users.update_one(
                {"_id": user_id},
                {"$push": {"devices": device_info}}
            )
            return True
        except Exception as e:
            current_app.logger.error(f"[ADD DEVICE ERROR] {e}")
            return False

    @staticmethod
    def update_last_seen(user_id):
        """Update user's last seen timestamp"""
        try:
            if not isinstance(user_id, ObjectId):
                user_id = ObjectId(user_id)
            
            db.users.update_one(
                {"_id": user_id},
                {"$set": {"last_seen": now_utc()}}
            )
        except Exception as e:
            current_app.logger.error(f"[UPDATE LAST SEEN ERROR] {e}")


# ======================================================
#                     AUDIT LOG
# ======================================================
class AuditLog:
    @staticmethod
    def log(user_id, action, description):
        try:
            db.audit_logs.insert_one({
                "user_id": str(user_id) if user_id else None,
                "action": action,
                "description": description,
                "timestamp": now_utc()
            })
        except Exception as e:
            current_app.logger.error(f"[AUDIT LOG ERROR] {e}")


# ======================================================
#                      REGISTER
# ======================================================
@bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    try:
        data = request.get_json(force=True, silent=True) or {}

        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password")

        if not username or not email or not password:
            return error("Missing required fields", 400)

        if not validate_username(username):
            return error("Invalid username format (3-30 alphanumeric chars)", 400)

        if not validate_email(email):
            return error("Invalid email format", 400)

        if not validate_password(password):
            return error("Weak password (min 8 chars, uppercase, lowercase, number)", 400)

        if User.find_by_username(username):
            return error("Username already exists", 409)

        if User.find_by_email(email):
            return error("Email already registered", 409)

        hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")

        new_user = {
            "username": username,
            "email": email,
            "password": hashed_pw,
            "created_at": now_utc(),
            "last_seen": now_utc(),
            "is_active": True,
            "two_factor_enabled": False,
            "two_factor_secret": None,
            "devices": [],
            "profile_picture": None,
            "bio": ""
        }

        user_id = User.create(new_user)
        AuditLog.log(user_id, "REGISTER", f"User {username} registered successfully")

        return success("User registered successfully", {
            "user_id": str(user_id),
            "username": username
        })

    except Exception as e:
        current_app.logger.error(f"[REGISTER ERROR] {e}")
        return error("Internal server error", 500)


# ======================================================
#                       LOGIN
# ======================================================
@bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    try:
        data = request.get_json(force=True, silent=True) or {}

        username = (data.get("username") or "").strip()
        password = data.get("password")
        device_name = data.get("device_name", "Unknown Device")

        if not username or not password:
            return error("Username and password required", 400)

        user = User.find_by_username(username)
        if not user:
            AuditLog.log(None, "LOGIN_FAILED", f"Unknown username: {username}")
            return error("Invalid credentials", 401)

        if not user.get("is_active", True):
            return error("Account is deactivated", 403)

        if not bcrypt.check_password_hash(user["password"], password):
            AuditLog.log(user["_id"], "LOGIN_FAILED", "Wrong password")
            return error("Invalid credentials", 401)

        # 2FA Check
        if user.get("two_factor_enabled"):
            temp_token = create_access_token(
                identity=str(user["_id"]),
                additional_claims={
                    "type": "2fa_temp",
                    "username": user["username"]
                },
                expires_delta=timedelta(minutes=5)
            )
            return success("2FA required", {
                "two_factor_required": True,
                "temp_token": temp_token
            })

        # Generate unique device ID
        device_id = str(uuid.uuid4())
        device_info = {
            "device_id": device_id,
            "name": device_name,
            "last_login": now_utc()
        }
        User.add_device(user["_id"], device_info)

        # Create tokens with consistent claims
        user_id_str = str(user["_id"])
        
        access_token = create_access_token(
            identity=user_id_str,
            additional_claims={
                "user_id": user_id_str,  # ✅ Added for consistency
                "username": user["username"],
                "email": user["email"],
                "device_id": device_id,
                "type": "access"
            },
            expires_delta=timedelta(hours=24)
        )

        refresh_token = create_refresh_token(
            identity=user_id_str,
            additional_claims={
                "user_id": user_id_str,
                "device_id": device_id,
                "type": "refresh"
            },
            expires_delta=timedelta(days=30)
        )

        # Update last seen
        User.update_last_seen(user["_id"])

        AuditLog.log(user["_id"], "LOGIN_SUCCESS", f"Device {device_name} logged in")

        return success("Login successful", {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user_id_str,  # ✅ Changed from user_id for frontend consistency
                "user_id": user_id_str,  # ✅ Added for socket compatibility
                "_id": user_id_str,  # ✅ Added for MongoDB compatibility
                "username": user["username"],
                "email": user["email"],
                "device_id": device_id,
                "profile_picture": user.get("profile_picture"),
                "bio": user.get("bio", "")
            }
        })

    except Exception as e:
        current_app.logger.error(f"[LOGIN ERROR] {e}")
        return error("Internal server error", 500)


# ======================================================
#                   REFRESH TOKEN
# ======================================================
@bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        
        user = User.find_by_id(current_user_id)
        if not user:
            return error("User not found", 404)

        # Create new access token
        access_token = create_access_token(
            identity=str(user["_id"]),
            additional_claims={
                "user_id": str(user["_id"]),
                "username": user["username"],
                "email": user["email"],
                "device_id": claims["device_id"],
                "type": "access"
            },
            expires_delta=timedelta(hours=24)
        )

        return success("Token refreshed", {
            "access_token": access_token
        })

    except Exception as e:
        current_app.logger.error(f"[REFRESH TOKEN ERROR] {e}")
        return error("Internal server error", 500)


# ======================================================
#                   LOGOUT
# ======================================================
@bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    try:
        jti = get_jwt()["jti"]  # Get the JWT ID from the current token
        db.blacklist.insert_one({"jti": jti})  # Add it to the blacklist

        return success("Logout successful")

    except Exception as e:
        current_app.logger.error(f"[LOGOUT ERROR] {e}")
        return error("Internal server error", 500)


# ======================================================
#                   GET PROFILE
# ======================================================
@bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = User.find_by_id(user_id)

        if not user:
            return error("User not found", 404)

        return success(data={
            "user_id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "created_at": user["created_at"],
            "two_factor_enabled": user.get("two_factor_enabled", False),
            "devices": user.get("devices", [])
        })

    except Exception as e:
        current_app.logger.error(f"[PROFILE ERROR] {e}")
        return error("Internal server error", 500)


# ======================================================
#                CHECK USERNAME AVAILABILITY
# ======================================================
@bp.route("/check-username/<username>", methods=["GET"])
def check_username(username):
    try:
        username = username.strip()

        current_app.logger.info(f"Checking availability for username: {username}")

        if not username or len(username) < 3:
            return error("Username must be at least 3 characters", 400)

        if not all(c.isalnum() or c in ['_', '-'] for c in username):
            return error("Username can only contain letters, numbers, underscores, and hyphens", 400)

        # Check in the database
        user = User.find_by_username(username)
        available = user is None

        return success("Username availability checked", {
            "available": available,
            "message": "Username is available" if available else "Username is already taken"
        })

    except Exception as e:
        current_app.logger.error(f"[CHECK USERNAME ERROR] {e}")
        return error("Internal server error", 500)


# ======================================================
#                         ME
# ======================================================
def _authorized():
    auth = request.headers.get("Authorization", "")
    return auth.startswith("Bearer ")

@bp.route("/me", methods=["GET"])
def me():
    if not _authorized():
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    return jsonify({
        "success": True,
        "data": {"user": {"id": "demo", "username": "Amit", "email": "demo@example.com"}}
    }), 200

# Export alias if app_factory imports auth_bp
auth_bp = bp
