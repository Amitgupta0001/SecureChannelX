from app.database import get_db
from datetime import datetime
from bson import ObjectId


# ---------------------- USER MODEL ---------------------- #

class User:
    @staticmethod
    def find_by_username(username):
        db = get_db()
        return db.users.find_one({"username": username})

    @staticmethod
    def find_by_email(email):
        db = get_db()
        return db.users.find_one({"email": email})

    @staticmethod
    def find_by_id(user_id):
        db = get_db()
        try:
            return db.users.find_one({"_id": ObjectId(user_id)})
        except:
            return None

    @staticmethod
    def create_user(user_data):
        db = get_db()
        result = db.users.insert_one(user_data)
        return result.inserted_id

    @staticmethod
    def update_user(user_id, update_data):
        db = get_db()
        return db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )


# ---------------------- AUDIT LOG ---------------------- #

class AuditLog:
    @staticmethod
    def log_event(user_id, event_type, description, ip_address=None):
        db = get_db()

        log_entry = {
            "user_id": ObjectId(user_id) if user_id else None,
            "event_type": event_type,
            "description": description,
            "ip_address": ip_address,
            "created_at": datetime.utcnow()
        }

        return db.audit_logs.insert_one(log_entry)

    @staticmethod
    def get_user_logs(user_id, limit=100):
        db = get_db()
        return list(
            db.audit_logs.find({"user_id": ObjectId(user_id)})
            .sort("created_at", -1)
            .limit(limit)
        )


# ---------------------- MESSAGE MODEL ---------------------- #

class Message:
    @staticmethod
    def create_message(message_data):
        db = get_db()
        result = db.messages.insert_one(message_data)
        return result.inserted_id

    @staticmethod
    def get_room_messages(room_id, limit=50):
        db = get_db()
        return list(
            db.messages.find({"room_id": room_id, "is_deleted": False})
            .sort("created_at", -1)
            .limit(limit)
        )

    @staticmethod
    def delete_message(message_id):
        db = get_db()
        return db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.utcnow()
                }
            }
        )


# ---------------------- SESSION KEY MODEL ---------------------- #

class SessionKey:
    """
    This must match your advanced_encryption.py socket workflow:
    
    {
        "user_id": <str>,
        "session_key": <hex string>,
        "created_at": <datetime>,
        "expires_at": <datetime>,
        "is_active": True
    }
    """

    @staticmethod
    def store_session_key(user_id, session_key_hex, expires_at):
        db = get_db()
        data = {
            "user_id": user_id,
            "session_key": session_key_hex,
            "created_at": datetime.utcnow(),
            "expires_at": expires_at,
            "is_active": True
        }
        return db.session_keys.insert_one(data)

    @staticmethod
    def get_latest_active_key(user_id):
        db = get_db()
        return db.session_keys.find_one(
            {"user_id": user_id, "is_active": True},
            sort=[("created_at", -1)]
        )

    @staticmethod
    def deactivate_all(user_id):
        db = get_db()
        return db.session_keys.update_many(
            {"user_id": user_id},
            {"$set": {"is_active": False}}
        )
