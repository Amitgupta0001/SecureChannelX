from app.database import get_db
from app.utils.helpers import now_utc

class KeyBundle:
    @staticmethod
    def save_bundle(user_id, device_id, bundle_data):
        """
        Save a user's pre-key bundle for a specific device.
        """
        db = get_db()
        doc = {
            "user_id": user_id,
            "device_id": int(device_id),
            "identity_key": bundle_data["identity_key"],
            "signed_pre_key": bundle_data["signed_pre_key"],
            "kyber_pre_key": bundle_data["kyber_pre_key"],
            "signature": bundle_data.get("signature"),
            "updated_at": now_utc()
        }
        
        # Upsert based on user_id AND device_id
        db.key_bundles.update_one(
            {"user_id": user_id, "device_id": int(device_id)},
            {"$set": doc},
            upsert=True
        )
        return True

    @staticmethod
    def get_bundles(user_id):
        """Return ALL key bundles for a user (one per device)."""
        db = get_db()
        return list(db.key_bundles.find({"user_id": user_id}, {"_id": 0}))
