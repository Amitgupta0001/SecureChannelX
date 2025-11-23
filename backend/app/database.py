# backend/app/database.py

from flask import current_app
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import certifi

class Database:
    def __init__(self):
        self.client = None
        self.db = None

    def init_app(self, app):
        """
        Initializes MongoDB connection using URI from config.
        Supports both local MongoDB and MongoDB Atlas (TLS required).
        """
        try:
            mongodb_uri = app.config.get(
                "MONGODB_URI",
                "mongodb://localhost:27017/securechannelx"
            )

            # Choose TLS when required (Atlas)
            if "mongodb+srv" in mongodb_uri:
                self.client = MongoClient(mongodb_uri, tlsCAFile=certifi.where())
            else:
                self.client = MongoClient(mongodb_uri)

            # Test connection
            self.client.admin.command("ping")

            # DB name auto-extracted from connection string
            self.db = self.client.get_database()

            # Build indexes for HIGH performance
            self.create_indexes()

            print("[INFO] MongoDB connected successfully")

        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"[ERROR] MongoDB connection failed: {str(e)}")
            raise

    # --------------------------------------------------------------------
    # INDEX DEFINITIONS
    # --------------------------------------------------------------------
    def create_indexes(self):
        """
        Creates performance-optimized, safe indexes
        matching ALL updated schema across features.
        """
        try:
            # ---------------- USERS ----------------
            self.db.users.create_index("username", unique=True)
            self.db.users.create_index("email", unique=True)
            self.db.users.create_index("created_at")

            # ---------------- CHATS ----------------
            self.db.chats.create_index("participants")
            self.db.chats.create_index("chat_type")
            self.db.chats.create_index("last_message_at")
            self.db.chats.create_index([("participants", 1), ("last_message_at", -1)])

            # ---------------- MESSAGES ----------------
            self.db.messages.create_index("chat_id")
            self.db.messages.create_index("sender_id")
            self.db.messages.create_index("parent_id")          # threads

            self.db.messages.create_index(
                [("chat_id", 1), ("created_at", -1)],
                name="chat_messages_sorted"
            )
            self.db.messages.create_index(
                [("sender_id", 1), ("created_at", -1)],
                name="user_messages_sorted"
            )

            # ---------------- SESSION KEYS (AES) ----------------
            self.db.session_keys.create_index("user_id")
            self.db.session_keys.create_index([("user_id", 1), ("is_active", 1)])
            self.db.session_keys.create_index("expires_at", expireAfterSeconds=0)

            # ---------------- AUDIT LOGS ----------------
            self.db.audit_logs.create_index("user_id")
            self.db.audit_logs.create_index("timestamp")
            self.db.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])

            # ---------------- POLLS ----------------
            self.db.polls.create_index("room_id")
            self.db.polls.create_index("created_by")
            self.db.polls.create_index("created_at")

            # ---------------- 2FA TEMP SECRETS ----------------
            self.db.temp_2fa_secrets.create_index("user_id", unique=True)
            self.db.temp_2fa_secrets.create_index("expires_at", expireAfterSeconds=0)

            # ---------------- DEVICES ----------------
            self.db.user_devices.create_index("user_id")
            self.db.user_devices.create_index("device_id")

            # ---------------- CALLS (WebRTC + VoIP) ----------------
            self.db.calls.create_index("chat_id")
            self.db.calls.create_index("caller_id")
            self.db.calls.create_index("receiver_id")
            self.db.calls.create_index("started_at")

            print("[INFO] Database indexes created successfully")

        except Exception as e:
            print(f"[WARNING] Index creation warning: {str(e)}")

# --------------------------------------------------------------------
# PUBLIC ACCESSORS
# --------------------------------------------------------------------
db_instance = Database()

def init_db(app):
    db_instance.init_app(app)

def get_db():
    if db_instance.db is None:
        raise RuntimeError("Database not initialized. Call init_db(app).")
    return db_instance.db

def get_client():
    if db_instance.client is None:
        raise RuntimeError("Database client not initialized.")
    return db_instance.client
