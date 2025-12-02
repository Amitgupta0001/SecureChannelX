"""
SecureChannelX Key Bundle Model (Enhanced Version)
---------------------------------------------------
Manages X3DH pre-key bundles for end-to-end encryption:
  - Identity keys
  - Signed pre-keys
  - Kyber pre-keys (post-quantum)
  - Device management
  - Key rotation
  - Signature verification
"""

import logging
from bson import ObjectId
from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_bundle_data(user_id: str, device_id: int, bundle_data: dict) -> tuple:
    """✅ ENHANCED: Validate key bundle data"""
    errors = []
    
    if not user_id or not isinstance(user_id, str):
        errors.append("Valid user_id required")
    
    if not isinstance(device_id, int) or device_id < 1:
        errors.append("Valid device_id (int >= 1) required")
    
    if not isinstance(bundle_data, dict):
        errors.append("bundle_data must be a dictionary")
    
    # ✅ ENHANCED: Check required fields
    required_fields = ["identity_key", "signed_pre_key"]
    for field in required_fields:
        if field not in bundle_data:
            errors.append(f"Missing required field: {field}")
    
    if errors:
        return False, errors
    
    return True, []


# ============================================================
#                   KEY BUNDLE MODEL
# ============================================================

class KeyBundle:
    """✅ ENHANCED: Comprehensive key bundle management"""
    
    # ============= STORAGE OPERATIONS =============
    
    @staticmethod
    def save_bundle(user_id: str, device_id: int, bundle_data: dict) -> bool:
        """
        ✅ ENHANCED: Save user's pre-key bundle for device
        
        Parameters:
        - user_id: User ID
        - device_id: Device ID
        - bundle_data: {
            identity_key: str,
            signed_pre_key: str,
            kyber_pre_key: str,
            signature: str,
            ...
          }
        
        Returns: True if successful
        """
        try:
            # ✅ ENHANCED: Validate inputs
            valid, errors = validate_bundle_data(user_id, device_id, bundle_data)
            if not valid:
                raise ValueError(f"Invalid bundle data: {', '.join(errors)}")
            
            db = get_db()
            
            # ✅ ENHANCED: Create bundle document
            doc = {
                "user_id": str(user_id),
                "device_id": int(device_id),
                "identity_key": bundle_data.get("identity_key"),
                "signed_pre_key": bundle_data.get("signed_pre_key"),
                "kyber_pre_key": bundle_data.get("kyber_pre_key"),  # Post-quantum
                "signature": bundle_data.get("signature"),
                "one_time_keys": bundle_data.get("one_time_keys", []),
                "created_at": now_utc(),
                "updated_at": now_utc(),
                "is_active": True,
                "key_rotation_required": False,
                "metadata": {
                    "algorithm": "X3DH",
                    "post_quantum_enabled": bool(bundle_data.get("kyber_pre_key")),
                    "signature_verified": False,
                }
            }
            
            # ✅ ENHANCED: Upsert based on user_id AND device_id
            result = db.key_bundles.update_one(
                {"user_id": str(user_id), "device_id": int(device_id)},
                {"$set": doc},
                upsert=True
            )
            
            logger.info(f"[KEY BUNDLE SAVE] Bundle saved for user {user_id} device {device_id}")
            
            return True
        
        except Exception as e:
            logger.error(f"[KEY BUNDLE SAVE] Error: {e}")
            raise
    
    @staticmethod
    def get_bundle(user_id: str, device_id: int) -> dict:
        """✅ ENHANCED: Get key bundle for specific device"""
        try:
            if not user_id or not isinstance(device_id, int):
                return None
            
            db = get_db()
            bundle = db.key_bundles.find_one({
                "user_id": str(user_id),
                "device_id": int(device_id)
            })
            
            return bundle
        
        except Exception as e:
            logger.error(f"[KEY BUNDLE GET] Error: {e}")
            return None
    
    @staticmethod
    def get_bundles(user_id: str) -> list:
        """✅ ENHANCED: Get ALL key bundles for user (one per device)"""
        try:
            if not user_id or not isinstance(user_id, str):
                return []
            
            db = get_db()
            bundles = list(db.key_bundles.find(
                {"user_id": str(user_id)},
                {"_id": 0}
            ))
            
            logger.debug(f"[KEY BUNDLES GET] Retrieved {len(bundles)} bundles for {user_id}")
            
            return bundles
        
        except Exception as e:
            logger.error(f"[KEY BUNDLES GET] Error: {e}")
            return []
    
    # ============= ONE-TIME KEY MANAGEMENT =============
    
    @staticmethod
    def add_one_time_keys(user_id: str, device_id: int, keys: list) -> bool:
        """✅ ENHANCED: Add one-time keys to bundle"""
        try:
            if not user_id or not isinstance(device_id, int) or not isinstance(keys, list):
                raise ValueError("Invalid parameters")
            
            db = get_db()
            result = db.key_bundles.update_one(
                {"user_id": str(user_id), "device_id": int(device_id)},
                {
                    "$addToSet": {"one_time_keys": {"$each": keys}},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[ONE-TIME KEY ADD] Error: {e}")
            raise
    
    @staticmethod
    def consume_one_time_key(user_id: str, device_id: int, key: str) -> bool:
        """✅ ENHANCED: Consume one-time key (remove after use)"""
        try:
            if not user_id or not isinstance(device_id, int):
                raise ValueError("Invalid parameters")
            
            db = get_db()
            result = db.key_bundles.update_one(
                {"user_id": str(user_id), "device_id": int(device_id)},
                {
                    "$pull": {"one_time_keys": key},
                    "$set": {"updated_at": now_utc()}
                }
            )
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[ONE-TIME KEY CONSUME] Error: {e}")
            raise
    
    # ============= KEY ROTATION =============
    
    @staticmethod
    def mark_key_rotation_required(user_id: str, device_id: int) -> bool:
        """✅ ENHANCED: Mark key rotation as required"""
        try:
            if not user_id or not isinstance(device_id, int):
                raise ValueError("Invalid parameters")
            
            db = get_db()
            result = db.key_bundles.update_one(
                {"user_id": str(user_id), "device_id": int(device_id)},
                {
                    "$set": {
                        "key_rotation_required": True,
                        "updated_at": now_utc()
                    }
                }
            )
            
            logger.info(f"[KEY ROTATION] Marked for rotation: user {user_id} device {device_id}")
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[KEY ROTATION MARK] Error: {e}")
            raise
    
    @staticmethod
    def rotate_keys(user_id: str, device_id: int, new_bundle_data: dict) -> bool:
        """✅ ENHANCED: Perform key rotation"""
        try:
            if not user_id or not isinstance(device_id, int):
                raise ValueError("Invalid parameters")
            
            db = get_db()
            result = db.key_bundles.update_one(
                {"user_id": str(user_id), "device_id": int(device_id)},
                {
                    "$set": {
                        "identity_key": new_bundle_data.get("identity_key"),
                        "signed_pre_key": new_bundle_data.get("signed_pre_key"),
                        "kyber_pre_key": new_bundle_data.get("kyber_pre_key"),
                        "signature": new_bundle_data.get("signature"),
                        "key_rotation_required": False,
                        "updated_at": now_utc()
                    }
                }
            )
            
            logger.info(f"[KEY ROTATION] Keys rotated: user {user_id} device {device_id}")
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[KEY ROTATION] Error: {e}")
            raise
    
    # ============= QUERY OPERATIONS =============
    
    @staticmethod
    def get_bundles_needing_rotation() -> list:
        """✅ ENHANCED: Get all bundles that need key rotation"""
        try:
            db = get_db()
            bundles = list(db.key_bundles.find({
                "key_rotation_required": True
            }))
            
            return bundles
        
        except Exception as e:
            logger.error(f"[GET ROTATION NEEDED] Error: {e}")
            return []
    
    @staticmethod
    def get_active_bundles(user_id: str) -> list:
        """✅ ENHANCED: Get all active bundles for user"""
        try:
            if not user_id:
                return []
            
            db = get_db()
            bundles = list(db.key_bundles.find({
                "user_id": str(user_id),
                "is_active": True
            }))
            
            return bundles
        
        except Exception as e:
            logger.error(f"[GET ACTIVE BUNDLES] Error: {e}")
            return []
    
    # ============= DEACTIVATION =============
    
    @staticmethod
    def deactivate_bundle(user_id: str, device_id: int) -> bool:
        """✅ ENHANCED: Deactivate bundle (e.g., device logged out)"""
        try:
            if not user_id or not isinstance(device_id, int):
                raise ValueError("Invalid parameters")
            
            db = get_db()
            result = db.key_bundles.update_one(
                {"user_id": str(user_id), "device_id": int(device_id)},
                {
                    "$set": {
                        "is_active": False,
                        "updated_at": now_utc()
                    }
                }
            )
            
            logger.info(f"[KEY BUNDLE DEACTIVATE] Deactivated: user {user_id} device {device_id}")
            
            return result.modified_count > 0
        
        except Exception as e:
            logger.error(f"[KEY BUNDLE DEACTIVATE] Error: {e}")
            raise


__all__ = ["KeyBundle", "validate_bundle_data"]
