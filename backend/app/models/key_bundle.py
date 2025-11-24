from app.database import get_db
from app.utils.helpers import now_utc

class KeyBundle:
    @staticmethod
    def save_bundle(user_id, bundle_data):
        """
        Save a user's pre-key bundle.
        bundle_data: {
            "identity_key": str (base64),
            "signed_pre_key": str (base64),
            "kyber_pre_key": str (base64),
            "signature": str (base64) [optional]
        }
        """
        db = get_db()
        doc = {
            "user_id": user_id,
            "identity_key": bundle_data["identity_key"],
            "signed_pre_key": bundle_data["signed_pre_key"],
            "kyber_pre_key": bundle_data["kyber_pre_key"],
            "signature": bundle_data.get("signature"),
            "updated_at": now_utc()
        }
        
        # Upsert: One bundle per user for simplicity in MVP
        # In full Signal, we'd have multiple pre-keys (One-Time PreKeys)
        db.key_bundles.update_one(
            {"user_id": user_id},
            {"$set": doc},
            upsert=True
        )
        return True

    @staticmethod
    def get_bundle(user_id):
        db = get_db()
        return db.key_bundles.find_one({"user_id": user_id}, {"_id": 0})
