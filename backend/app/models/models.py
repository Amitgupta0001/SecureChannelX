# backend/app/models/models.py

from bson import ObjectId
from app.utils.helpers import now_utc
from app.database import get_db


# =========================================================
#                        USER MODEL
# =========================================================
class User:
    @staticmethod
    def find_by_username(username: str):
        return get_db().users.find_one({"username": username})

    @staticmethod
    def find_by_email(email: str):
        return get_db().users.find_one({"email": email})

    @staticmethod
    def find_by_id(user_id: str):
        try:
            return get_db().users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None

    @staticmethod
    def create_user(user_data: dict):
        return get_db().users.insert_one(user_data).inserted_id

    @staticmethod
    def update_user(user_id: str, update_data: dict):
        return get_db().users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data, "$currentDate": {"updated_at": True}}
        )

    @staticmethod
    def add_device(user_id: str, device_info: dict):
        return get_db().user_devices.insert_one({
            "user_id": user_id,
            **device_info,
            "last_active": now_utc()
        })


# =========================================================
#                       AUDIT LOG MODEL
# =========================================================
class AuditLog:
    @staticmethod
    def log_event(user_id, event_type, description, ip_address=None):
        log = {
            "user_id": str(user_id) if user_id else None,
            "event_type": event_type,
            "description": description,
            "ip_address": ip_address,
            "timestamp": now_utc()
        }
        return get_db().audit_logs.insert_one(log)

    @staticmethod
    def get_user_logs(user_id: str, limit: int = 100):
        return list(
            get_db().audit_logs.find({"user_id": str(user_id)})
            .sort("timestamp", -1)
            .limit(limit)
        )


# =========================================================
#                      MESSAGE MODEL HELPERS
# =========================================================
class Message:
    @staticmethod
    def create_message(message_doc: dict):
        return get_db().messages.insert_one(message_doc).inserted_id

    @staticmethod
    def get_chat_messages(chat_id: str, limit: int = 50):
        return list(
            get_db().messages.find({
                "chat_id": ObjectId(chat_id),
                "is_deleted": False
            })
            .sort("created_at", -1)
            .limit(limit)
        )

    @staticmethod
    def delete_message(message_id: str):
        return get_db().messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "content": "[message deleted]",
                    "updated_at": now_utc()
                }
            }
        )

    @staticmethod
    def add_reaction(message_id: str, emoji: str, user_id: str):
        return get_db().messages.update_one(
            {"_id": ObjectId(message_id)},
            {"$addToSet": {"reactions": {"emoji": emoji, "user_id": user_id}}}
        )

    @staticmethod
    def mark_as_seen(message_id: str, user_id: str):
        return get_db().messages.update_one(
            {"_id": ObjectId(message_id)},
            {"$addToSet": {"seen_by": user_id}}
        )


# =========================================================
#                     SESSION KEY MODEL
# =========================================================
class SessionKey:
    """
    Session keys used for your E2E encryption system:
    {
        "user_id": "abc",
        "session_key": "<hex>",
        "created_at": datetime,
        "expires_at": datetime,
        "is_active": True
    }
    """

    @staticmethod
    def store_session_key(user_id: str, session_key_hex: str, expires_at):
        return get_db().session_keys.insert_one({
            "user_id": user_id,
            "session_key": session_key_hex,
            "created_at": now_utc(),
            "expires_at": expires_at,
            "is_active": True
        })

    @staticmethod
    def get_latest_active_key(user_id: str):
        return get_db().session_keys.find_one(
            {"user_id": user_id, "is_active": True},
            sort=[("created_at", -1)]
        )

    @staticmethod
    def deactivate_all(user_id: str):
        return get_db().session_keys.update_many(
            {"user_id": user_id},
            {"$set": {"is_active": False}}
        )
