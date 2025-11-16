from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, create_access_token, get_jwt_identity
from app.database import get_db
from bson import ObjectId
from datetime import datetime
from flask_bcrypt import Bcrypt
import re

auth_bp = Blueprint('auth', __name__, url_prefix="/api")

db = get_db()
bcrypt = Bcrypt()

# ------------------ User Helper Functions ------------------ #

class User:
    @staticmethod
    def find_by_username(username):
        return db.users.find_one({"username": username})

    @staticmethod
    def find_by_email(email):
        return db.users.find_one({"email": email})

    @staticmethod
    def find_by_id(user_id):
        return db.users.find_one({"_id": ObjectId(user_id)})

    @staticmethod
    def create_user(data):
        result = db.users.insert_one(data)
        return result.inserted_id

class AuditLog:
    @staticmethod
    def log_event(user_id, action, message):
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": action,
            "message": message,
            "timestamp": datetime.utcnow()
        })

# ------------------ REGISTER ------------------ #

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()

        if not data or not data.get("username") or not data.get("email") or not data.get("password"):
            return jsonify({"error": "Missing required fields"}), 400

        # Email validation
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", data["email"]):
            return jsonify({"error": "Invalid email format"}), 400

        # Username exists?
        if User.find_by_username(data["username"]):
            return jsonify({"error": "Username already exists"}), 409

        # Email exists?
        if User.find_by_email(data["email"]):
            return jsonify({"error": "Email already exists"}), 409

        # Secure password hash
        hashed_pw = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

        user_data = {
            "username": data["username"],
            "email": data["email"],
            "password": hashed_pw,       # STORE HASHED PASSWORD
            "created_at": datetime.utcnow(),
            "is_active": True
        }

        user_id = User.create_user(user_data)

        AuditLog.log_event(str(user_id), "REGISTER", "User registered successfully")

        return jsonify({
            "message": "User registered successfully",
            "user_id": str(user_id)
        }), 201

    except Exception as e:
        current_app.logger.error(f"Registration error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# ------------------ LOGIN ------------------ #

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()

        if not data or not data.get("username") or not data.get("password"):
            return jsonify({"error": "Username and password required"}), 400

        user = User.find_by_username(data["username"])

        if not user:
            AuditLog.log_event(None, "LOGIN_FAILED", f"Invalid username: {data['username']}")
            return jsonify({"error": "Invalid credentials"}), 401

        # Check password
        if not bcrypt.check_password_hash(user["password"], data["password"]):
            AuditLog.log_event(str(user["_id"]), "LOGIN_FAILED", "Wrong password")
            return jsonify({"error": "Invalid credentials"}), 401

        # Generate JWT token
        access_token = create_access_token(identity=str(user["_id"]))

        AuditLog.log_event(str(user["_id"]), "LOGIN_SUCCESS", "User logged in successfully")

        return jsonify({
            "access_token": access_token,
            "user_id": str(user["_id"]),
            "username": user["username"]
        }), 200

    except Exception as e:
        current_app.logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# ------------------ PROFILE ------------------ #

@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    try:
        current_user_id = get_jwt_identity()
        user = User.find_by_id(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "user_id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"]
        })

    except Exception as e:
        current_app.logger.error(f"Profile error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500