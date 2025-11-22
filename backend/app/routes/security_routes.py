# FILE: backend/app/routes/security_routes.py

from flask import Blueprint, request, current_app, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timedelta
import pyotp
import qrcode
import base64
from io import BytesIO

# Correct imports (NO more backend.*)
from app import bcrypt
from app.database import get_db

# utils
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc, safe_dict
from app.utils.validators import validate_password

security_bp = Blueprint("security", __name__, url_prefix="/api/security")
db = get_db()


# -----------------------------------------------------
#  2FA: Setup
# -----------------------------------------------------
@security_bp.route("/setup-2fa", methods=["POST"])
@jwt_required()
def setup_2fa():
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({"_id": ObjectId(user_id)})

        if not user:
            return error("User not found", 404)

        secret = pyotp.random_base32()

        db.temp_2fa_secrets.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "secret": secret,
                    "created_at": now_utc(),
                    "expires_at": now_utc() + timedelta(hours=1),
                }
            },
            upsert=True,
        )

        totp = pyotp.TOTP(secret)
        provisioning_url = totp.provisioning_uri(
            name=user["username"], issuer_name="SecureChannelX"
        )

        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffer = BytesIO()
        img.save(buffer, format="PNG")
        qr_code_b64 = base64.b64encode(buffer.getvalue()).decode()

        db.audit_logs.insert_one(
            {
                "user_id": user_id,
                "action": "2FA_SETUP_INIT",
                "status": "success",
                "timestamp": now_utc(),
            }
        )

        return success(
            "Scan QR code with your authenticator app",
            {
                "secret": secret,
                "provisioning_url": provisioning_url,
                "qr_code": f"data:image/png;base64,{qr_code_b64}",
            },
        )

    except Exception as e:
        current_app.logger.error(f"[2FA SETUP ERROR] {str(e)}")
        return error("Failed to setup 2FA", 500)


# -----------------------------------------------------
#  2FA: Enable
# -----------------------------------------------------
@security_bp.route("/enable-2fa", methods=["POST"])
@jwt_required()
def enable_2fa():
    try:
        user_id = get_jwt_identity()
        token = (request.get_json() or {}).get("token")

        if not token:
            return error("Token required", 400)

        temp_secret = db.temp_2fa_secrets.find_one({"user_id": user_id})

        if not temp_secret:
            return error("2FA setup not started or expired", 400)

        totp = pyotp.TOTP(temp_secret["secret"])

        if not totp.verify(token):
            db.audit_logs.insert_one(
                {
                    "user_id": user_id,
                    "action": "2FA_VERIFY_FAIL",
                    "status": "failed",
                    "timestamp": now_utc(),
                }
            )
            return error("Invalid verification code", 400)

        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "two_factor_enabled": True,
                    "two_factor_secret": temp_secret["secret"],
                }
            },
        )

        db.temp_2fa_secrets.delete_one({"user_id": user_id})

        db.audit_logs.insert_one(
            {
                "user_id": user_id,
                "action": "2FA_ENABLED",
                "status": "success",
                "timestamp": now_utc(),
            }
        )

        return success("2FA enabled successfully")

    except Exception as e:
        current_app.logger.error(f"[2FA ENABLE ERROR] {str(e)}")
        return error("Failed to enable 2FA", 500)


# -----------------------------------------------------
#  2FA: Disable
# -----------------------------------------------------
@security_bp.route("/disable-2fa", methods=["POST"])
@jwt_required()
def disable_2fa():
    try:
        user_id = get_jwt_identity()
        password = (request.get_json() or {}).get("password")

        if not password:
            return error("Password required", 400)

        user = db.users.find_one({"_id": ObjectId(user_id)})

        if not user:
            return error("User not found", 404)

        if not user.get("two_factor_enabled", False):
            return error("2FA is not enabled", 400)

        if not bcrypt.check_password_hash(user["password"], password):
            db.audit_logs.insert_one(
                {
                    "user_id": user_id,
                    "action": "2FA_DISABLE_ATTEMPT",
                    "status": "failed",
                    "details": "Wrong password",
                    "timestamp": now_utc(),
                }
            )
            return error("Invalid password", 400)

        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"two_factor_enabled": False, "two_factor_secret": None}},
        )

        db.audit_logs.insert_one(
            {
                "user_id": user_id,
                "action": "2FA_DISABLED",
                "status": "success",
                "timestamp": now_utc(),
            }
        )

        return success("2FA disabled successfully")

    except Exception as e:
        current_app.logger.error(f"[2FA DISABLE ERROR] {str(e)}")
        return error("Failed to disable 2FA", 500)


# -----------------------------------------------------
#  List Devices
# -----------------------------------------------------
@security_bp.route("/devices", methods=["GET"])
@jwt_required()
def get_devices():
    try:
        user_id = get_jwt_identity()

        cursor = db.user_devices.find({"user_id": user_id}).sort("last_active", -1)

        devices = []
        for d in cursor:
            devices.append(
                {
                    "id": str(d["_id"]),
                    "device_id": d.get("device_id"),
                    "device_name": d.get("device_name", "Unknown Device"),
                    "last_active": d.get("last_active", now_utc()).isoformat(),
                    "is_active": d.get("is_active", True),
                }
            )

        return success(data={"devices": devices})

    except Exception as e:
        current_app.logger.error(f"[DEVICE LIST ERROR] {str(e)}")
        return error("Failed to fetch devices", 500)


# -----------------------------------------------------
#  Remove Device
# -----------------------------------------------------
@security_bp.route("/devices/<device_id>", methods=["DELETE"])
@jwt_required()
def remove_device(device_id):
    try:
        user_id = get_jwt_identity()

        result = db.user_devices.delete_one(
            {"_id": ObjectId(device_id), "user_id": user_id}
        )

        if result.deleted_count == 0:
            return error("Device not found", 404)

        db.audit_logs.insert_one(
            {
                "user_id": user_id,
                "action": "DEVICE_REMOVED",
                "status": "success",
                "timestamp": now_utc(),
            }
        )

        return success("Device removed successfully")

    except Exception as e:
        current_app.logger.error(f"[REMOVE DEVICE ERROR] {str(e)}")
        return error("Failed to remove device", 500)


# -----------------------------------------------------
#  Audit Logs
# -----------------------------------------------------
@security_bp.route("/audit-logs", methods=["GET"])
@jwt_required()
def get_audit_logs():
    try:
        user_id = get_jwt_identity()

        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 50))
        skip = (page - 1) * per_page

        cursor = (
            db.audit_logs.find({"user_id": user_id})
            .sort("timestamp", -1)
            .skip(skip)
            .limit(per_page)
        )

        logs = []
        for log in cursor:
            logs.append(
                {
                    "id": str(log["_id"]),
                    "action": log.get("action"),
                    "resource": log.get("resource"),
                    "status": log.get("status"),
                    "details": log.get("details"),
                    "timestamp": log.get("timestamp", now_utc()).isoformat(),
                }
            )

        total = db.audit_logs.count_documents({"user_id": user_id})
        total_pages = (total + per_page - 1) // per_page

        return success(
            data={
                "audit_logs": logs,
                "page": page,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            }
        )

    except Exception as e:
        current_app.logger.error(f"[AUDIT LOG ERROR] {str(e)}")
        return error("Failed to fetch audit logs", 500)


# -----------------------------------------------------
#  Session Keys
# -----------------------------------------------------
@security_bp.route("/session-keys", methods=["GET"])
@jwt_required()
def get_session_keys():
    try:
        user_id = get_jwt_identity()

        cursor = (
            db.session_keys.find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(10)
        )

        keys = []
        for k in cursor:
            full_key = k.get("session_key", "")
            keys.append(
                {
                    "id": str(k["_id"]),
                    "session_key": f"{full_key[:16]}..." if full_key else None,
                    "created_at": k.get("created_at", now_utc()).isoformat(),
                    "expires_at": k.get("expires_at", now_utc()).isoformat(),
                    "is_active": k.get("is_active", False),
                }
            )

        return success(data={"session_keys": keys})

    except Exception as e:
        current_app.logger.error(f"[SESSION KEY ERROR] {str(e)}")
        return error("Failed to fetch session keys", 500)


# -----------------------------------------------------
#  Logout
# -----------------------------------------------------
@security_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    try:
        user_id = get_jwt_identity()

        db.audit_logs.insert_one(
            {
                "user_id": user_id,
                "action": "LOGOUT",
                "resource": "auth",
                "status": "success",
                "timestamp": now_utc(),
            }
        )

        return success("Logged out successfully")

    except Exception as e:
        current_app.logger.error(f"[LOGOUT ERROR] {str(e)}")
        return error("Failed to logout", 500)


# -----------------------------------------------------
#  Client-Side Error Logging
# -----------------------------------------------------
@security_bp.route("/log-client-error", methods=["POST"])
def log_client_error():
    data = request.get_json()

    db.client_errors.insert_one(
        {
            "error": data.get("message"),
            "stack": data.get("stack"),
            "component_stack": data.get("componentStack"),
            "created_at": datetime.utcnow(),
        }
    )

    return jsonify({"ok": True})
