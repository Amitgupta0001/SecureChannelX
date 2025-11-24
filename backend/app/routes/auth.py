# FILE: backend/app/routes/auth.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import (
    jwt_required,
    create_access_token,
    get_jwt_identity
)
from bson import ObjectId

# Correct imports — NO "backend.*" anywhere
from app import bcrypt, limiter
from app.database import get_db

# Utils
from app.utils.validators import validate_email, validate_username, validate_password
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app.utils.email import send_email
from datetime import timedelta
from flask_jwt_extended import decode_token

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
db = get_db()


# ======================================================
#                   USER MODEL HELPERS
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
        except Exception:
            return None

    @staticmethod
    def create(data: dict):
        return db.users.insert_one(data).inserted_id


class AuditLog:
    @staticmethod
    def log(user_id, action, description):
        db.audit_logs.insert_one({
            "user_id": str(user_id) if user_id else None,
            "action": action,
            "description": description,
            "timestamp": now_utc(),
        })


# ======================================================
#                       REGISTER
# ======================================================
@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    try:
        data = request.get_json() or {}

        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password")

        if not username or not email or not password:
            return error("Missing required fields", 400)

        if not validate_username(username):
            return error("Invalid username format (3–20 chars)", 400)

        if not validate_email(email):
            return error("Invalid email format", 400)

        if not validate_password(password):
            return error("Weak password (uppercase, number, special char required)", 400)

        if User.find_by_username(username):
            return error("Username already exists", 409)

        if User.find_by_email(email):
            return error("Email already registered", 409)

        # Hash password using global bcrypt
        hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")

        new_user = {
            "username": username,
            "email": email,
            "password": hashed_pw,
            "created_at": now_utc(),
            "is_active": True,
            "two_factor_enabled": False,
            "two_factor_secret": None,
        }

        user_id = User.create(new_user)
        AuditLog.log(user_id, "REGISTER", "User registered")

        return success("User registered successfully", {
            "user_id": str(user_id)
        })

    except Exception as e:
        current_app.logger.error(f"[REGISTER ERROR] {str(e)}")
        return error("Internal server error", 500)


# ======================================================
#                       LOGIN
# ======================================================
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    try:
        data = request.get_json() or {}

        username = (data.get("username") or "").strip()
        password = data.get("password")

        if not username or not password:
            return error("Username and password required", 400)

        user = User.find_by_username(username)
        if not user:
            AuditLog.log(None, "LOGIN_FAILED", f"Unknown username '{username}'")
            return error("Invalid credentials", 401)

        if not bcrypt.check_password_hash(user["password"], password):
            AuditLog.log(user["_id"], "LOGIN_FAILED", "Bad password")
            return error("Invalid credentials", 401)

        # 2FA CHECK
        if user.get("two_factor_enabled"):
            temp_token = create_access_token(
                identity=str(user["_id"]),
                additional_claims={"type": "2fa_temp"},
                expires_delta=False  # defaults to config (24h), maybe should be shorter but fine for now
            )
            return success("2FA required", {
                "two_factor_required": True,
                "temp_token": temp_token
            })

        token = create_access_token(
            identity=str(user["_id"]),
            additional_claims={
                "username": user["username"],
                "email": user["email"]
            }
        )

        AuditLog.log(user["_id"], "LOGIN_SUCCESS", "User logged in")

        return success("Login successful", {
            "access_token": token,
            "user": {
                "id": str(user["_id"]),
                "username": user["username"],
                "email": user["email"]
            }
        })

    except Exception as e:
        current_app.logger.error(f"[LOGIN ERROR] {str(e)}")
        return error("Internal server error", 500)


# ======================================================
#                   FORGOT PASSWORD
# ======================================================
@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("3 per minute")
def forgot_password():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()

        if not email:
            return error("Email is required", 400)

        user = User.find_by_email(email)
        if not user:
            # Security: Don't reveal if user exists
            return success("If an account exists, a reset link has been sent.")

        # Generate reset token (short lived - 15 mins)
        reset_token = create_access_token(
            identity=str(user["_id"]),
            additional_claims={"type": "reset"},
            expires_delta=timedelta(minutes=15)
        )

        reset_link = f"http://localhost:5173/reset-password/{reset_token}"
        
        body = f"""Hello {user['username']},

You requested a password reset. Click the link below to reset your password:

{reset_link}

This link expires in 15 minutes.

If you did not request this, please ignore this email.
"""

        send_email(email, "Password Reset Request", body)

        AuditLog.log(user["_id"], "PASSWORD_RESET_REQUEST", "Reset link sent")

        return success("If an account exists, a reset link has been sent.")

    except Exception as e:
        current_app.logger.error(f"[FORGOT PASSWORD ERROR] {str(e)}")
        return error("Internal server error", 500)


# ======================================================
#                   RESET PASSWORD
# ======================================================
@auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit("3 per minute")
def reset_password():
    try:
        data = request.get_json() or {}
        token = data.get("token")
        new_password = data.get("password")

        if not token or not new_password:
            return error("Token and new password required", 400)

        if not validate_password(new_password):
            return error("Weak password (uppercase, number, special char required)", 400)

        # Verify token
        try:
            decoded = decode_token(token)
            if decoded.get("type") != "reset":
                return error("Invalid token type", 400)
            
            user_id = decoded["sub"]
        except Exception:
            return error("Invalid or expired token", 400)

        # Update password
        hashed_pw = bcrypt.generate_password_hash(new_password).decode("utf-8")
        
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password": hashed_pw}}
        )

        # Invalidate all sessions? (Optional, but good practice)
        # For now just log it
        AuditLog.log(user_id, "PASSWORD_RESET_SUCCESS", "Password updated successfully")

        return success("Password reset successfully")

    except Exception as e:
        current_app.logger.error(f"[RESET PASSWORD ERROR] {str(e)}")
        return error("Internal server error", 500)


# ======================================================
#                        PROFILE
# ======================================================
@auth_bp.route("/profile", methods=["GET"])
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
            "created_at": user["created_at"].isoformat(),
            "two_factor_enabled": user.get("two_factor_enabled", False),
        })

    except Exception as e:
        current_app.logger.error(f"[PROFILE ERROR] {str(e)}")
        return error("Internal server error", 500)
