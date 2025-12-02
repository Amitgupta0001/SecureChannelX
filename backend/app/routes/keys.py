from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.database import get_db
from app.models.key_bundle import KeyBundle
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from bson import ObjectId
from datetime import datetime

keys_bp = Blueprint("keys", __name__, url_prefix="/api/keys")

db = get_db()

# ============================================================
#              KEY BUNDLE CONSTANTS
# ============================================================
MAX_PRE_KEYS_PER_DEVICE = 100  # ✅ FIXED: Limit pre-keys to prevent bloat
KEY_ROTATION_DAYS = 30  # ✅ FIXED: Rotate keys every 30 days
MAX_KEY_SIZE = 1024  # ✅ FIXED: Max size per key in bytes


# ============================================================
#              HELPER FUNCTIONS
# ============================================================
def validate_key_format(key, key_type):
    """✅ FIXED: Validate key format and size"""
    if not key:
        return False, f"{key_type} cannot be empty"
    
    if not isinstance(key, (str, dict)):
        return False, f"{key_type} must be string or dict"
    
    key_str = str(key)
    if len(key_str) > MAX_KEY_SIZE:
        return False, f"{key_type} exceeds maximum size ({MAX_KEY_SIZE} bytes)"
    
    # ✅ FIXED: Validate Base64 format if string
    if isinstance(key, str):
        try:
            import base64
            # Check if valid Base64
            if len(key) % 4 != 0:
                return False, f"{key_type} is not valid Base64"
            base64.b64decode(key, validate=True)
        except Exception:
            return False, f"{key_type} is not valid Base64"
    
    return True, None


def check_key_rotation_needed(bundle):
    """✅ FIXED: Check if keys need rotation"""
    if not bundle:
        return True
    
    created_at = bundle.get("created_at")
    if not created_at:
        return True
    
    from datetime import timedelta
    if isinstance(created_at, datetime):
        age_days = (now_utc() - created_at).days
        return age_days > KEY_ROTATION_DAYS
    
    return False


def get_device_id_from_token():
    """✅ FIXED: Safely get device_id from JWT claims"""
    claims = get_jwt()
    device_id = claims.get("device_id") or claims.get("deviceId")
    
    if not device_id:
        return None, "Device ID missing from token"
    
    return device_id, None


# ============================================================
#              UPLOAD KEY BUNDLE
# ============================================================
@keys_bp.route("/bundle", methods=["POST"])
@jwt_required()
def upload_bundle():
    """
    ✅ FIXED: Upload or update key bundle for device
    
    Expected JSON:
    {
        "identity_key": "base64_encoded_key",
        "signed_pre_key": "base64_encoded_key",
        "signed_pre_key_signature": "base64_encoded_signature",
        "kyber_pre_key": "base64_encoded_key",
        "one_time_keys": [{"key_id": 1, "key": "base64"}, ...]
    }
    """
    try:
        user_id = get_jwt_identity()
        device_id, error_msg = get_device_id_from_token()
        
        if not device_id:
            return error(error_msg, 400)

        data = request.get_json(force=True, silent=True) or {}
        
        # ✅ FIXED: Validate required fields
        required_fields = ["identity_key", "signed_pre_key", "kyber_pre_key"]
        missing_fields = [f for f in required_fields if not data.get(f)]
        
        if missing_fields:
            return error(f"Missing required fields: {', '.join(missing_fields)}", 400)

        # ✅ FIXED: Validate each key format
        for key_type in required_fields:
            valid, error_msg = validate_key_format(data.get(key_type), key_type)
            if not valid:
                return error(error_msg, 400)

        # ✅ FIXED: Validate optional signature
        if data.get("signed_pre_key_signature"):
            valid, error_msg = validate_key_format(
                data.get("signed_pre_key_signature"),
                "signed_pre_key_signature"
            )
            if not valid:
                return error(error_msg, 400)

        # ✅ FIXED: Validate one-time keys if provided
        one_time_keys = data.get("one_time_keys", [])
        if one_time_keys:
            if not isinstance(one_time_keys, list):
                return error("one_time_keys must be a list", 400)
            
            if len(one_time_keys) > MAX_PRE_KEYS_PER_DEVICE:
                return error(
                    f"Too many one-time keys. Maximum is {MAX_PRE_KEYS_PER_DEVICE}",
                    400
                )
            
            for otk in one_time_keys:
                if not isinstance(otk, dict) or "key_id" not in otk or "key" not in otk:
                    return error("Invalid one-time key format", 400)
                
                valid, error_msg = validate_key_format(otk["key"], "one_time_key")
                if not valid:
                    return error(error_msg, 400)

        # ✅ FIXED: Build bundle document
        bundle_doc = {
            "user_id": user_id,
            "device_id": device_id,
            "identity_key": data["identity_key"],
            "signed_pre_key": data["signed_pre_key"],
            "signed_pre_key_signature": data.get("signed_pre_key_signature"),
            "kyber_pre_key": data["kyber_pre_key"],
            "one_time_keys": one_time_keys,
            "created_at": now_utc(),
            "updated_at": now_utc(),
            "rotation_date": now_utc(),  # ✅ FIXED: Track rotation date
            "is_active": True,
            "key_version": 1  # ✅ FIXED: Track key version
        }

        # ✅ FIXED: Use KeyBundle model if available, else MongoDB
        try:
            KeyBundle.save_bundle(user_id, device_id, bundle_doc)
        except Exception as model_error:
            current_app.logger.warning(f"[KEY BUNDLE MODEL ERROR] {model_error}")
            
            # ✅ FIXED: Fallback to direct MongoDB
            result = db.key_bundles.update_one(
                {"user_id": user_id, "device_id": device_id},
                {"$set": bundle_doc},
                upsert=True
            )

        current_app.logger.info(f"[KEY BUNDLE] Uploaded for user {user_id}, device {device_id}")

        return success("Key bundle uploaded successfully", {
            "user_id": user_id,
            "device_id": device_id,
            "version": 1
        })
        
    except Exception as e:
        current_app.logger.error(f"[BUNDLE UPLOAD ERROR] {e}")
        return error(f"Failed to upload bundle: {str(e)}", 500)


# ============================================================
#              GET KEY BUNDLE(S)
# ============================================================
@keys_bp.route("/bundle/<target_user_id>", methods=["GET"])
@jwt_required()
def get_bundle(target_user_id):
    """
    ✅ FIXED: Get key bundles for target user (all devices)
    Used for establishing encrypted session with target user
    """
    try:
        requester_id = get_jwt_identity()

        # ✅ FIXED: Validate target user exists
        target_user = db.users.find_one({"_id": ObjectId(target_user_id) if isinstance(target_user_id, str) else target_user_id})
        if not target_user:
            return error("Target user not found", 404)

        # ✅ FIXED: Fetch all active bundles for target user
        bundles = db.key_bundles.find({
            "user_id": target_user_id,
            "is_active": True
        })

        bundle_list = []
        for bundle in bundles:
            # ✅ FIXED: Check if key rotation is needed
            needs_rotation = check_key_rotation_needed(bundle)
            
            bundle_data = {
                "device_id": bundle.get("device_id"),
                "identity_key": bundle.get("identity_key"),
                "signed_pre_key": bundle.get("signed_pre_key"),
                "signed_pre_key_signature": bundle.get("signed_pre_key_signature"),
                "kyber_pre_key": bundle.get("kyber_pre_key"),
                "one_time_key": None,  # ✅ FIXED: Provide one OTK per request
                "key_version": bundle.get("key_version", 1),
                "created_at": (
                    bundle.get("created_at").isoformat()
                    if isinstance(bundle.get("created_at"), datetime)
                    else bundle.get("created_at")
                ),
                "needs_rotation": needs_rotation
            }

            # ✅ FIXED: Provide one one-time key if available
            one_time_keys = bundle.get("one_time_keys", [])
            if one_time_keys and len(one_time_keys) > 0:
                otk = one_time_keys[0]
                bundle_data["one_time_key"] = otk
                
                # ✅ FIXED: Remove the used one-time key
                try:
                    db.key_bundles.update_one(
                        {"_id": bundle["_id"]},
                        {"$pull": {"one_time_keys": {"key_id": otk.get("key_id")}}}
                    )
                except Exception as update_error:
                    current_app.logger.warning(f"[OTK REMOVAL ERROR] {update_error}")

            bundle_list.append(bundle_data)

        # ✅ FIXED: Return empty array for new users (not 404)
        current_app.logger.info(f"[KEY BUNDLE] User {requester_id} fetched {len(bundle_list)} bundles for user {target_user_id}")

        return success(data={
            "bundles": bundle_list,
            "target_user_id": target_user_id,
            "bundle_count": len(bundle_list)
        })
        
    except Exception as e:
        current_app.logger.error(f"[BUNDLE FETCH ERROR] {e}")
        return error(f"Failed to fetch bundles: {str(e)}", 500)


# ============================================================
#              GET SINGLE DEVICE BUNDLE
# ============================================================
@keys_bp.route("/bundle/<target_user_id>/<device_id>", methods=["GET"])
@jwt_required()
def get_device_bundle(target_user_id, device_id):
    """
    ✅ FIXED: Get key bundle for specific device
    """
    try:
        requester_id = get_jwt_identity()

        # ✅ FIXED: Fetch specific device bundle
        bundle = db.key_bundles.find_one({
            "user_id": target_user_id,
            "device_id": device_id,
            "is_active": True
        })

        if not bundle:
            return error("Bundle not found for this device", 404)

        # ✅ FIXED: Check rotation status
        needs_rotation = check_key_rotation_needed(bundle)

        bundle_data = {
            "device_id": bundle.get("device_id"),
            "identity_key": bundle.get("identity_key"),
            "signed_pre_key": bundle.get("signed_pre_key"),
            "signed_pre_key_signature": bundle.get("signed_pre_key_signature"),
            "kyber_pre_key": bundle.get("kyber_pre_key"),
            "key_version": bundle.get("key_version", 1),
            "created_at": (
                bundle.get("created_at").isoformat()
                if isinstance(bundle.get("created_at"), datetime)
                else bundle.get("created_at")
            ),
            "needs_rotation": needs_rotation,
            "otk_count": len(bundle.get("one_time_keys", []))
        }

        # ✅ FIXED: Provide one-time key if available
        one_time_keys = bundle.get("one_time_keys", [])
        if one_time_keys:
            otk = one_time_keys[0]
            bundle_data["one_time_key"] = otk
            
            try:
                db.key_bundles.update_one(
                    {"_id": bundle["_id"]},
                    {"$pull": {"one_time_keys": {"key_id": otk.get("key_id")}}}
                )
            except Exception as update_error:
                current_app.logger.warning(f"[OTK REMOVAL ERROR] {update_error}")

        return success(data={"bundle": bundle_data})
        
    except Exception as e:
        current_app.logger.error(f"[DEVICE BUNDLE ERROR] {e}")
        return error(f"Failed to fetch device bundle: {str(e)}", 500)


# ============================================================
#              REFRESH KEY BUNDLE
# ============================================================
@keys_bp.route("/bundle/refresh", methods=["POST"])
@jwt_required()
def refresh_bundle():
    """
    ✅ FIXED: Mark bundle for rotation and increment version
    """
    try:
        user_id = get_jwt_identity()
        device_id, error_msg = get_device_id_from_token()
        
        if not device_id:
            return error(error_msg, 400)

        bundle = db.key_bundles.find_one({
            "user_id": user_id,
            "device_id": device_id
        })

        if not bundle:
            return error("No bundle found for this device", 404)

        # ✅ FIXED: Increment version and reset rotation date
        new_version = (bundle.get("key_version", 1) or 1) + 1
        
        db.key_bundles.update_one(
            {"_id": bundle["_id"]},
            {
                "$set": {
                    "key_version": new_version,
                    "rotation_date": now_utc(),
                    "updated_at": now_utc(),
                    "one_time_keys": []  # ✅ FIXED: Clear old OTKs
                }
            }
        )

        current_app.logger.info(f"[KEY ROTATION] User {user_id}, device {device_id}, version {new_version}")

        return success("Key bundle marked for rotation", {
            "new_version": new_version,
            "device_id": device_id
        })
        
    except Exception as e:
        current_app.logger.error(f"[REFRESH ERROR] {e}")
        return error(f"Failed to refresh bundle: {str(e)}", 500)


# ============================================================
#              UPLOAD ONE-TIME KEYS
# ============================================================
@keys_bp.route("/otk/upload", methods=["POST"])
@jwt_required()
def upload_one_time_keys():
    """
    ✅ FIXED: Upload additional one-time keys
    """
    try:
        user_id = get_jwt_identity()
        device_id, error_msg = get_device_id_from_token()
        
        if not device_id:
            return error(error_msg, 400)

        data = request.get_json(force=True, silent=True) or {}
        one_time_keys = data.get("one_time_keys", [])

        # ✅ FIXED: Validate OTKs
        if not isinstance(one_time_keys, list) or len(one_time_keys) == 0:
            return error("one_time_keys must be a non-empty list", 400)

        if len(one_time_keys) > MAX_PRE_KEYS_PER_DEVICE:
            return error(f"Too many keys. Maximum is {MAX_PRE_KEYS_PER_DEVICE}", 400)

        for otk in one_time_keys:
            if not isinstance(otk, dict) or "key_id" not in otk or "key" not in otk:
                return error("Invalid one-time key format", 400)
            
            valid, error_msg = validate_key_format(otk["key"], "one_time_key")
            if not valid:
                return error(error_msg, 400)

        # ✅ FIXED: Check current OTK count
        bundle = db.key_bundles.find_one({"user_id": user_id, "device_id": device_id})
        current_otk_count = len(bundle.get("one_time_keys", [])) if bundle else 0
        
        if current_otk_count + len(one_time_keys) > MAX_PRE_KEYS_PER_DEVICE:
            return error(
                f"Would exceed maximum OTKs. Current: {current_otk_count}, Max: {MAX_PRE_KEYS_PER_DEVICE}",
                400
            )

        # ✅ FIXED: Add new OTKs
        db.key_bundles.update_one(
            {"user_id": user_id, "device_id": device_id},
            {"$push": {"one_time_keys": {"$each": one_time_keys}}},
            upsert=False
        )

        current_app.logger.info(f"[OTK UPLOAD] User {user_id}, device {device_id}, added {len(one_time_keys)} keys")

        return success("One-time keys uploaded", {
            "uploaded_count": len(one_time_keys),
            "device_id": device_id
        })
        
    except Exception as e:
        current_app.logger.error(f"[OTK UPLOAD ERROR] {e}")
        return error(f"Failed to upload one-time keys: {str(e)}", 500)


# ============================================================
#              GET OTK COUNT
# ============================================================
@keys_bp.route("/otk/count", methods=["GET"])
@jwt_required()
def get_otk_count():
    """
    ✅ FIXED: Get one-time key count for current device
    """
    try:
        user_id = get_jwt_identity()
        device_id, error_msg = get_device_id_from_token()
        
        if not device_id:
            return error(error_msg, 400)

        bundle = db.key_bundles.find_one({"user_id": user_id, "device_id": device_id})
        
        if not bundle:
            return error("No bundle found for this device", 404)

        otk_count = len(bundle.get("one_time_keys", []))

        # ✅ FIXED: Warn if count is low
        warning = None
        if otk_count < 10:
            warning = f"One-time key count is low ({otk_count}). Please upload more keys."

        return success(data={
            "otk_count": otk_count,
            "max_otk": MAX_PRE_KEYS_PER_DEVICE,
            "warning": warning,
            "device_id": device_id
        })
        
    except Exception as e:
        current_app.logger.error(f"[OTK COUNT ERROR] {e}")
        return error(f"Failed to get OTK count: {str(e)}", 500)


# ============================================================
#              DELETE KEY BUNDLE
# ============================================================
@keys_bp.route("/bundle/delete", methods=["DELETE"])
@jwt_required()
def delete_bundle():
    """
    ✅ FIXED: Soft delete (deactivate) key bundle
    """
    try:
        user_id = get_jwt_identity()
        device_id, error_msg = get_device_id_from_token()
        
        if not device_id:
            return error(error_msg, 400)

        result = db.key_bundles.update_one(
            {"user_id": user_id, "device_id": device_id},
            {
                "$set": {
                    "is_active": False,
                    "deleted_at": now_utc()
                }
            }
        )

        if result.matched_count == 0:
            return error("No bundle found for this device", 404)

        current_app.logger.info(f"[KEY BUNDLE DELETED] User {user_id}, device {device_id}")

        return success("Key bundle deactivated")
        
    except Exception as e:
        current_app.logger.error(f"[BUNDLE DELETE ERROR] {e}")
        return error(f"Failed to delete bundle: {str(e)}", 500)
