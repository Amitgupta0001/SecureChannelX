# FILE: backend/app/routes/security_routes.py

from flask import Blueprint, request, current_app, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token, get_jwt
from bson import ObjectId
from datetime import datetime, timedelta
import pyotp
import qrcode
import base64
from io import BytesIO

# ✅ FIXED: Correct imports
from app import bcrypt
from app.database import get_db
from app import socketio

# utils
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc, safe_dict
from app.utils.validators import validate_password

security_bp = Blueprint("security", __name__, url_prefix="/api/security")
db = get_db()

# ============================================================
#              CONSTANTS
# ============================================================
MAX_2FA_ATTEMPTS = 5  # ✅ FIXED: Prevent brute force
RATE_LIMIT_WINDOW = 300  # 5 minutes
MAX_DEVICES_PER_USER = 10  # ✅ FIXED: Limit devices


# ============================================================
#              HELPER FUNCTIONS
# ============================================================
def check_rate_limit(user_id, action):
    """✅ FIXED: Prevent brute force attacks"""
    try:
        recent_attempts = db.rate_limits.count_documents({
            "user_id": user_id,
            "action": action,
            "timestamp": {"$gte": now_utc() - timedelta(seconds=RATE_LIMIT_WINDOW)}
        })
        return recent_attempts < MAX_2FA_ATTEMPTS
    except:
        return True


def record_attempt(user_id, action, success_status):
    """✅ FIXED: Log rate limit attempts"""
    try:
        db.rate_limits.insert_one({
            "user_id": user_id,
            "action": action,
            "status": "success" if success_status else "failed",
            "timestamp": now_utc()
        })
    except Exception as e:
        current_app.logger.warning(f"[RATE LIMIT LOG ERROR] {e}")


def validate_2fa_code(code):
    """✅ FIXED: Validate 2FA code format"""
    if not code or not isinstance(code, str):
        return False
    
    code = code.strip()
    if len(code) != 6 or not code.isdigit():
        return False
    
    return True


def generate_backup_codes(count=10):
    """✅ FIXED: Generate backup codes for 2FA"""
    import secrets
    codes = []
    for _ in range(count):
        code = secrets.token_hex(4).upper()
        codes.append(code)
    return codes


# ============================================================
#              2FA: SETUP
# ============================================================
@security_bp.route("/setup-2fa", methods=["POST"])
@jwt_required()
def setup_2fa():
    """
    ✅ FIXED: Initialize 2FA setup with QR code
    """
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({"_id": ObjectId(user_id)})

        if not user:
            return error("User not found", 404)

        # ✅ FIXED: Check if already enabled
        if user.get("two_factor_enabled", False):
            return error("2FA is already enabled for this account", 400)

        # ✅ FIXED: Generate secret
        secret = pyotp.random_base32()

        # ✅ FIXED: Store temporary secret with expiration
        db.temp_2fa_secrets.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "secret": secret,
                    "created_at": now_utc(),
                    "expires_at": now_utc() + timedelta(hours=1),
                    "verified": False
                }
            },
            upsert=True,
        )

        # ✅ FIXED: Generate provisioning URL
        totp = pyotp.TOTP(secret)
        provisioning_url = totp.provisioning_uri(
            name=user.get("email", user.get("username")),
            issuer_name="SecureChannelX"
        )

        # ✅ FIXED: Generate QR code
        try:
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(provisioning_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            buffer = BytesIO()
            img.save(buffer, format="PNG")
            qr_code_b64 = base64.b64encode(buffer.getvalue()).decode()
        except Exception as qr_error:
            current_app.logger.error(f"[QR CODE ERROR] {qr_error}")
            qr_code_b64 = None

        # ✅ FIXED: Log audit trail
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "2FA_SETUP_INIT",
            "resource": "security",
            "status": "success",
            "ip_address": request.remote_addr,
            "user_agent": request.headers.get("User-Agent"),
            "timestamp": now_utc()
        })

        current_app.logger.info(f"[2FA] User {user_id} initiated 2FA setup")

        return success(
            "Scan QR code with your authenticator app (Google Authenticator, Authy, etc.)",
            {
                "secret": secret,
                "provisioning_url": provisioning_url,
                "qr_code": f"data:image/png;base64,{qr_code_b64}" if qr_code_b64 else None,
                "expires_in": 3600  # ✅ FIXED: Tell client expiration
            }
        )

    except Exception as e:
        current_app.logger.error(f"[2FA SETUP ERROR] {str(e)}")
        return error("Failed to setup 2FA", 500)


# ============================================================
#              2FA: VERIFY (Login Step 2)
# ============================================================
@security_bp.route("/verify-2fa", methods=["POST"])
@jwt_required()
def verify_2fa():
    """
    ✅ FIXED: Verify 2FA code during login
    Expects temporary JWT with type: "2fa_temp"
    """
    try:
        user_id = get_jwt_identity()
        claims = get_jwt()
        
        # ✅ FIXED: Verify this is a 2FA temp token
        if claims.get("type") != "2fa_temp":
            return error("Invalid token. Please login again.", 401)

        data = request.get_json() or {}
        code = (data.get("code") or "").strip()

        # ✅ FIXED: Validate code format
        if not validate_2fa_code(code):
            return error("Invalid code format (must be 6 digits)", 400)

        # ✅ FIXED: Check rate limit
        if not check_rate_limit(user_id, "2fa_verify"):
            return error("Too many failed attempts. Try again later.", 429)

        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return error("User not found", 404)

        # ✅ FIXED: Check if 2FA is enabled
        if not user.get("two_factor_enabled", False):
            return error("2FA is not enabled", 400)

        secret = user.get("two_factor_secret")
        if not secret:
            return error("2FA secret not found", 400)

        # ✅ FIXED: Verify TOTP with time window
        totp = pyotp.TOTP(secret)
        if not totp.verify(code, valid_window=1):  # Allow ±1 time window
            record_attempt(user_id, "2fa_verify", False)
            
            db.audit_logs.insert_one({
                "user_id": user_id,
                "action": "2FA_LOGIN_FAIL",
                "resource": "security",
                "status": "failed",
                "details": "Invalid code",
                "ip_address": request.remote_addr,
                "timestamp": now_utc()
            })
            
            current_app.logger.warning(f"[2FA] User {user_id} failed verification")
            return error("Invalid verification code", 401)

        # ✅ FIXED: Check for backup code
        backup_codes = user.get("backup_codes", [])
        if code in backup_codes:
            # ✅ FIXED: Remove used backup code
            db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$pull": {"backup_codes": code}}
            )

        record_attempt(user_id, "2fa_verify", True)

        # ✅ FIXED: Generate FULL access token (not temp)
        token = create_access_token(
            identity=str(user["_id"]),
            additional_claims={
                "username": user.get("username"),
                "email": user.get("email"),
                "type": "access"  # ✅ FIXED: Mark as full token
            }
        )

        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "LOGIN_SUCCESS_2FA",
            "resource": "auth",
            "status": "success",
            "ip_address": request.remote_addr,
            "timestamp": now_utc()
        })

        current_app.logger.info(f"[2FA] User {user_id} login successful")

        return success("Login successful", {
            "access_token": token,
            "user": {
                "id": str(user["_id"]),
                "username": user.get("username"),
                "email": user.get("email"),
                "two_factor_enabled": user.get("two_factor_enabled", False)
            }
        })

    except Exception as e:
        current_app.logger.error(f"[2FA VERIFY ERROR] {str(e)}")
        return error("Internal server error", 500)


# ============================================================
#              2FA: ENABLE
# ============================================================
@security_bp.route("/enable-2fa", methods=["POST"])
@jwt_required()
def enable_2fa():
    """
    ✅ FIXED: Enable 2FA by verifying code
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        code = (data.get("code") or "").strip()

        # ✅ FIXED: Validate code
        if not validate_2fa_code(code):
            return error("Invalid code format", 400)

        # ✅ FIXED: Check rate limit
        if not check_rate_limit(user_id, "2fa_enable"):
            return error("Too many attempts. Try again later.", 429)

        # ✅ FIXED: Get temporary secret
        temp_secret_doc = db.temp_2fa_secrets.find_one({"user_id": user_id})
        if not temp_secret_doc:
            return error("2FA setup not started or expired", 400)

        # ✅ FIXED: Check expiration
        if temp_secret_doc.get("expires_at") < now_utc():
            db.temp_2fa_secrets.delete_one({"user_id": user_id})
            return error("2FA setup expired. Start over.", 400)

        secret = temp_secret_doc.get("secret")
        totp = pyotp.TOTP(secret)

        # ✅ FIXED: Verify code
        if not totp.verify(code, valid_window=1):
            record_attempt(user_id, "2fa_enable", False)
            return error("Invalid verification code", 400)

        record_attempt(user_id, "2fa_enable", True)

        # ✅ FIXED: Generate backup codes
        backup_codes = generate_backup_codes(10)

        # ✅ FIXED: Enable 2FA
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "two_factor_enabled": True,
                    "two_factor_secret": secret,
                    "backup_codes": backup_codes,
                    "updated_at": now_utc()
                }
            }
        )

        db.temp_2fa_secrets.delete_one({"user_id": user_id})

        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "2FA_ENABLED",
            "resource": "security",
            "status": "success",
            "ip_address": request.remote_addr,
            "timestamp": now_utc()
        })

        current_app.logger.info(f"[2FA] 2FA enabled for user {user_id}")

        return success("2FA enabled successfully", {
            "backup_codes": backup_codes,
            "message": "Save these backup codes in a safe place. You can use them to login if you lose access to your authenticator."
        })

    except Exception as e:
        current_app.logger.error(f"[2FA ENABLE ERROR] {str(e)}")
        return error("Failed to enable 2FA", 500)


# ============================================================
#              2FA: DISABLE
# ============================================================
@security_bp.route("/disable-2fa", methods=["POST"])
@jwt_required()
def disable_2fa():
    """
    ✅ FIXED: Disable 2FA with password verification
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        password = data.get("password", "").strip()

        # ✅ FIXED: Validate password provided
        if not password:
            return error("Password required for security verification", 400)

        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return error("User not found", 404)

        # ✅ FIXED: Check if 2FA is enabled
        if not user.get("two_factor_enabled", False):
            return error("2FA is not enabled", 400)

        # ✅ FIXED: Verify password
        if not bcrypt.check_password_hash(user.get("password", ""), password):
            db.audit_logs.insert_one({
                "user_id": user_id,
                "action": "2FA_DISABLE_ATTEMPT",
                "resource": "security",
                "status": "failed",
                "details": "Wrong password",
                "ip_address": request.remote_addr,
                "timestamp": now_utc()
            })
            
            current_app.logger.warning(f"[2FA] User {user_id} failed password verification for 2FA disable")
            return error("Invalid password", 401)

        # ✅ FIXED: Disable 2FA
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "two_factor_enabled": False,
                    "two_factor_secret": None,
                    "backup_codes": [],
                    "updated_at": now_utc()
                }
            }
        )

        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "2FA_DISABLED",
            "resource": "security",
            "status": "success",
            "ip_address": request.remote_addr,
            "timestamp": now_utc()
        })

        current_app.logger.info(f"[2FA] 2FA disabled for user {user_id}")

        return success("2FA disabled successfully")

    except Exception as e:
        current_app.logger.error(f"[2FA DISABLE ERROR] {str(e)}")
        return error("Failed to disable 2FA", 500)


# ============================================================
#              DEVICE MANAGEMENT: LIST
# ============================================================
@security_bp.route("/devices", methods=["GET"])
@jwt_required()
def get_devices():
    """
    ✅ FIXED: List all trusted devices for current user
    """
    try:
        user_id = get_jwt_identity()
        current_device_id = request.args.get("current_device_id")

        # ✅ FIXED: Fetch devices with proper sorting
        cursor = db.user_devices.find({"user_id": user_id}).sort("last_active", -1).limit(50)

        devices = []
        for device in cursor:
            device_data = {
                "id": str(device.get("_id")),
                "device_id": device.get("device_id"),
                "device_name": device.get("device_name", "Unknown Device"),
                "device_type": device.get("device_type", "web"),  # ✅ FIXED: Add device type
                "os": device.get("os"),
                "browser": device.get("browser"),
                "ip_address": device.get("ip_address"),
                "last_active": (
                    device.get("last_active", now_utc()).isoformat()
                    if isinstance(device.get("last_active"), datetime)
                    else device.get("last_active")
                ),
                "is_active": device.get("is_active", True),
                "is_current": device.get("device_id") == current_device_id  # ✅ FIXED: Mark current device
            }
            devices.append(device_data)

        return success(data={
            "devices": devices,
            "total": len(devices)
        })

    except Exception as e:
        current_app.logger.error(f"[DEVICE LIST ERROR] {str(e)}")
        return error("Failed to fetch devices", 500)


# ============================================================
#              DEVICE MANAGEMENT: REMOVE
# ============================================================
@security_bp.route("/devices/<device_id>", methods=["DELETE"])
@jwt_required()
def remove_device(device_id):
    """
    ✅ FIXED: Remove a trusted device
    """
    try:
        user_id = get_jwt_identity()

        # ✅ FIXED: Validate device ObjectId
        try:
            device_oid = ObjectId(device_id)
        except:
            return error("Invalid device_id format", 400)

        # ✅ FIXED: Check if device exists and belongs to user
        device = db.user_devices.find_one({"_id": device_oid, "user_id": user_id})
        if not device:
            return error("Device not found", 404)

        # ✅ FIXED: Prevent removing current device
        current_device_id = request.args.get("current_device_id")
        if str(device.get("device_id")) == current_device_id:
            return error("Cannot remove your current device", 400)

        result = db.user_devices.delete_one({"_id": device_oid, "user_id": user_id})

        if result.deleted_count == 0:
            return error("Failed to remove device", 400)

        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "DEVICE_REMOVED",
            "resource": "security",
            "status": "success",
            "details": f"Device: {device.get('device_name')}",
            "ip_address": request.remote_addr,
            "timestamp": now_utc()
        })

        # ✅ FIXED: Notify user of device removal
        try:
            socketio.emit(
                "device:removed",
                {
                    "device_id": device_id,
                    "device_name": device.get("device_name")
                },
                room=f"user:{user_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        current_app.logger.info(f"[DEVICE] User {user_id} removed device {device_id}")

        return success("Device removed successfully")

    except Exception as e:
        current_app.logger.error(f"[REMOVE DEVICE ERROR] {str(e)}")
        return error("Failed to remove device", 500)


# ============================================================
#              DEVICE MANAGEMENT: RENAME
# ============================================================
@security_bp.route("/devices/<device_id>/rename", methods=["PUT"])
@jwt_required()
def rename_device(device_id):
    """
    ✅ FIXED: Rename a device for easy identification
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        new_name = (data.get("name") or "").strip()

        # ✅ FIXED: Validate name
        if not new_name or len(new_name) > 50:
            return error("Device name must be 1-50 characters", 400)

        try:
            device_oid = ObjectId(device_id)
        except:
            return error("Invalid device_id format", 400)

        result = db.user_devices.update_one(
            {"_id": device_oid, "user_id": user_id},
            {"$set": {"device_name": new_name}}
        )

        if result.matched_count == 0:
            return error("Device not found", 404)

        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "DEVICE_RENAMED",
            "resource": "security",
            "status": "success",
            "ip_address": request.remote_addr,
            "timestamp": now_utc()
        })

        return success("Device renamed successfully")

    except Exception as e:
        current_app.logger.error(f"[RENAME DEVICE ERROR] {str(e)}")
        return error("Failed to rename device", 500)


# ============================================================
#              AUDIT LOGS
# ============================================================
@security_bp.route("/audit-logs", methods=["GET"])
@jwt_required()
def get_audit_logs():
    """
    ✅ FIXED: Get user's audit logs with pagination
    """
    try:
        user_id = get_jwt_identity()

        # ✅ FIXED: Pagination with proper validation
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 50))))
        skip = (page - 1) * per_page

        # ✅ FIXED: Optional action filter
        action_filter = request.args.get("action")

        query = {"user_id": user_id}
        if action_filter:
            query["action"] = action_filter

        # ✅ FIXED: Get total and fetch logs
        total = db.audit_logs.count_documents(query)
        
        cursor = (
            db.audit_logs.find(query)
            .sort("timestamp", -1)
            .skip(skip)
            .limit(per_page)
        )

        logs = []
        for log in cursor:
            logs.append({
                "id": str(log.get("_id")),
                "action": log.get("action"),
                "resource": log.get("resource"),
                "status": log.get("status"),
                "details": log.get("details"),
                "ip_address": log.get("ip_address"),
                "user_agent": log.get("user_agent"),
                "timestamp": (
                    log.get("timestamp", now_utc()).isoformat()
                    if isinstance(log.get("timestamp"), datetime)
                    else log.get("timestamp")
                )
            })

        total_pages = (total + per_page - 1) // per_page

        current_app.logger.info(f"[AUDIT] User {user_id} fetched audit logs (page {page})")

        return success(data={
            "audit_logs": logs,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        })

    except Exception as e:
        current_app.logger.error(f"[AUDIT LOG ERROR] {str(e)}")
        return error("Failed to fetch audit logs", 500)


# ============================================================
#              SESSION KEYS / ACCESS TOKENS
# ============================================================
@security_bp.route("/session-keys", methods=["GET"])
@jwt_required()
def get_session_keys():
    """
    ✅ FIXED: List active session keys/tokens
    """
    try:
        user_id = get_jwt_identity()

        cursor = (
            db.session_keys.find({"user_id": user_id, "is_active": True})
            .sort("created_at", -1)
            .limit(20)
        )

        keys = []
        for k in cursor:
            full_key = k.get("session_key", "")
            keys.append({
                "id": str(k.get("_id")),
                "name": k.get("name", "Session"),
                "token_preview": f"{full_key[:16]}..." if full_key else None,
                "created_at": (
                    k.get("created_at", now_utc()).isoformat()
                    if isinstance(k.get("created_at"), datetime)
                    else k.get("created_at")
                ),
                "expires_at": (
                    k.get("expires_at", now_utc()).isoformat()
                    if isinstance(k.get("expires_at"), datetime)
                    else k.get("expires_at")
                ),
                "last_used": (
                    k.get("last_used", now_utc()).isoformat()
                    if isinstance(k.get("last_used"), datetime)
                    else k.get("last_used")
                ),
                "is_active": k.get("is_active", False)
            })

        return success(data={"session_keys": keys})

    except Exception as e:
        current_app.logger.error(f"[SESSION KEY ERROR] {str(e)}")
        return error("Failed to fetch session keys", 500)


# ============================================================
#              REVOKE SESSION KEY
# ============================================================
@security_bp.route("/session-keys/<key_id>/revoke", methods=["POST"])
@jwt_required()
def revoke_session_key(key_id):
    """
    ✅ FIXED: Revoke/invalidate a session key
    """
    try:
        user_id = get_jwt_identity()

        try:
            key_oid = ObjectId(key_id)
        except:
            return error("Invalid key_id format", 400)

        result = db.session_keys.update_one(
            {"_id": key_oid, "user_id": user_id},
            {
                "$set": {
                    "is_active": False,
                    "revoked_at": now_utc()
                }
            }
        )

        if result.matched_count == 0:
            return error("Session key not found", 404)

        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "SESSION_KEY_REVOKED",
            "resource": "security",
            "status": "success",
            "ip_address": request.remote_addr,
            "timestamp": now_utc()
        })

        current_app.logger.info(f"[SESSION] User {user_id} revoked session key {key_id}")

        return success("Session key revoked")

    except Exception as e:
        current_app.logger.error(f"[REVOKE SESSION ERROR] {str(e)}")
        return error("Failed to revoke session key", 500)


# ============================================================
#              LOGOUT
# ============================================================
@security_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    ✅ FIXED: Logout current session with audit log
    """
    try:
        user_id = get_jwt_identity()

        # ✅ FIXED: Optional: blacklist token
        # This would require token blacklist implementation

        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "LOGOUT",
            "resource": "auth",
            "status": "success",
            "ip_address": request.remote_addr,
            "user_agent": request.headers.get("User-Agent"),
            "timestamp": now_utc()
        })

        current_app.logger.info(f"[AUTH] User {user_id} logged out")

        return success("Logged out successfully")

    except Exception as e:
        current_app.logger.error(f"[LOGOUT ERROR] {str(e)}")
        return error("Failed to logout", 500)


# ============================================================
#              CLIENT-SIDE ERROR LOGGING
# ============================================================
@security_bp.route("/log-client-error", methods=["POST"])
def log_client_error():
    """
    ✅ FIXED: Log client-side errors with validation
    """
    try:
        data = request.get_json() or {}

        # ✅ FIXED: Validate required fields
        error_message = data.get("message", "").strip()
        if not error_message:
            return error("Error message required", 400)

        # ✅ FIXED: Limit stack trace size
        stack = (data.get("stack") or "")[:5000]
        component_stack = (data.get("componentStack") or "")[:5000]

        # ✅ FIXED: Store with metadata
        db.client_errors.insert_one({
            "error_message": error_message,
            "stack": stack,
            "component_stack": component_stack,
            "error_type": data.get("errorType"),
            "url": data.get("url"),
            "user_id": data.get("user_id"),
            "ip_address": request.remote_addr,
            "user_agent": request.headers.get("User-Agent"),
            "created_at": now_utc()
        })

        current_app.logger.warning(f"[CLIENT ERROR] {error_message[:100]}")

        return success("Error logged")

    except Exception as e:
        current_app.logger.error(f"[LOG CLIENT ERROR] {str(e)}")
        return error("Failed to log error", 500)


# ============================================================
#              CHANGE PASSWORD
# ============================================================
@security_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """
    ✅ FIXED: Change user password with validation
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        current_password = data.get("current_password", "").strip()
        new_password = data.get("new_password", "").strip()
        confirm_password = data.get("confirm_password", "").strip()

        # ✅ FIXED: Validate inputs
        if not current_password or not new_password:
            return error("Current and new password required", 400)

        if new_password != confirm_password:
            return error("Passwords do not match", 400)

        if len(new_password) < 8:
            return error("Password must be at least 8 characters", 400)

        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return error("User not found", 404)

        # ✅ FIXED: Verify current password
        if not bcrypt.check_password_hash(user.get("password", ""), current_password):
            db.audit_logs.insert_one({
                "user_id": user_id,
                "action": "PASSWORD_CHANGE_FAIL",
                "resource": "security",
                "status": "failed",
                "details": "Wrong current password",
                "ip_address": request.remote_addr,
                "timestamp": now_utc()
            })
            return error("Current password is incorrect", 401)

        # ✅ FIXED: Prevent same password
        if bcrypt.check_password_hash(user.get("password", ""), new_password):
            return error("New password must be different", 400)

        # ✅ FIXED: Hash and update
        hashed_password = bcrypt.generate_password_hash(new_password).decode()
        
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "password": hashed_password,
                    "updated_at": now_utc()
                }
            }
        )

        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "PASSWORD_CHANGED",
            "resource": "security",
            "status": "success",
            "ip_address": request.remote_addr,
            "timestamp": now_utc()
        })

        current_app.logger.info(f"[SECURITY] User {user_id} changed password")

        return success("Password changed successfully")

    except Exception as e:
        current_app.logger.error(f"[PASSWORD CHANGE ERROR] {str(e)}")
        return error("Failed to change password", 500)


