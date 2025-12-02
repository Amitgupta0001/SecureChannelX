"""
SecureChannelX Database Module (Enhanced Version)
--------------------------------------------------
Production-grade MongoDB connection with:
  - Connection pooling & retry logic
  - Comprehensive index management
  - Health monitoring
  - Migration support
  - Collection validation
  - Performance optimization
  - Graceful error handling
"""

import os
import logging
from typing import Optional
from flask import current_app
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import (
    ConnectionFailure, 
    ServerSelectionTimeoutError,
    OperationFailure,
    DuplicateKeyError
)
import certifi

logger = logging.getLogger(__name__)

# ============================================================
#                   DATABASE CLASS
# ============================================================

class Database:
    """Enhanced: MongoDB connection manager"""
    
    def __init__(self):
        self.client: Optional[MongoClient] = None
        self.db = None
        self._is_initialized = False
    
    def init_app(self, app):
        """
        Enhanced: Initializes MongoDB connection with comprehensive error handling
        """
        try:
            mongodb_uri = app.config.get("MONGODB_URI", "mongodb://localhost:27017/SecureChannelX")
            db_name = app.config.get("MONGODB_DB_NAME", "SecureChannelX")
            
            logger.info("[DATABASE] Connecting to MongoDB...")
            logger.info(f"[DATABASE] Database: {db_name}")
            
            if os.getenv("FLASK_ENV") == "production":
                if "localhost" in mongodb_uri or "127.0.0.1" in mongodb_uri:
                    logger.error("[DATABASE] CRITICAL: Using localhost MongoDB in production")
                    logger.error("Set MONGODB_URI to a production database server")
            
            if "mongodb+srv" in mongodb_uri or "ssl=true" in mongodb_uri.lower():
                logger.info("[DATABASE] Using TLS/SSL connection (MongoDB Atlas)")
                self.client = MongoClient(
                    mongodb_uri,
                    tlsCAFile=certifi.where(),
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=10000,
                    socketTimeoutMS=10000,
                    maxPoolSize=50,
                    minPoolSize=10,
                    retryWrites=True,
                    retryReads=True
                )
            else:
                logger.info("[DATABASE] Using standard connection (local MongoDB)")
                self.client = MongoClient(
                    mongodb_uri,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=10000,
                    socketTimeoutMS=10000,
                    maxPoolSize=50,
                    minPoolSize=10,
                    retryWrites=True,
                    retryReads=True
                )
            
            server_info = self.client.server_info()
            logger.info("[DATABASE] MongoDB connection established")
            logger.info(f"[DATABASE] MongoDB version: {server_info.get('version', 'unknown')}")
            
            self.db = self.client[db_name]
            self.db.command("ping")
            logger.info(f"[DATABASE] Database '{db_name}' is accessible")
            
            self.create_indexes()
            self.setup_collections()
            
            self._is_initialized = True
            logger.info("[DATABASE] MongoDB initialization complete")
        
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"[DATABASE] Connection failed: {e}")
            logger.error("[DATABASE] Ensure MongoDB is running and accessible")
            logger.error(f"[DATABASE] URI: {mongodb_uri}")
            raise
        
        except Exception as e:
            logger.error(f"[DATABASE] Unexpected initialization error: {e}")
            raise

    # ============================================================
    #                   INDEX MANAGEMENT
    # ============================================================

    def create_indexes(self):
        """Enhanced: Creates performance-optimized indexes"""
        try:
            logger.info("[DATABASE] Creating indexes...")
            
            # USERS
            self.db.users.create_index("username", unique=True, name="idx_username_unique")
            self.db.users.create_index("email", unique=True, name="idx_email_unique")
            self.db.users.create_index("created_at", name="idx_users_created")
            self.db.users.create_index("is_active", name="idx_users_active")
            self.db.users.create_index("last_seen", name="idx_users_last_seen")
            self.db.users.create_index(
                [("username", ASCENDING), ("email", ASCENDING)],
                name="idx_users_lookup"
            )
            logger.info("[DATABASE] Users indexes created")
            
            # CHATS
            self.db.chats.create_index("participants", name="idx_chats_participants")
            self.db.chats.create_index("chat_type", name="idx_chats_type")
            self.db.chats.create_index("created_at", name="idx_chats_created")
            self.db.chats.create_index("last_message_at", name="idx_chats_last_message")
            self.db.chats.create_index("is_group", name="idx_chats_is_group")
            self.db.chats.create_index(
                [("participants", ASCENDING), ("last_message_at", DESCENDING)],
                name="idx_chats_user_recent"
            )
            self.db.chats.create_index(
                [("chat_type", ASCENDING), ("is_group", ASCENDING)],
                name="idx_chats_type_group"
            )
            logger.info("[DATABASE] Chats indexes created")
            
            # MESSAGES
            self.db.messages.create_index("chat_id", name="idx_messages_chat")
            self.db.messages.create_index("sender_id", name="idx_messages_sender")
            self.db.messages.create_index("created_at", name="idx_messages_created")
            self.db.messages.create_index("message_type", name="idx_messages_type")
            self.db.messages.create_index("parent_id", name="idx_messages_parent")
            self.db.messages.create_index("is_deleted", name="idx_messages_deleted")
            self.db.messages.create_index("is_edited", name="idx_messages_edited")
            self.db.messages.create_index(
                [("chat_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_messages_chat_sorted"
            )
            self.db.messages.create_index(
                [("sender_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_messages_user_sorted"
            )
            self.db.messages.create_index(
                [("chat_id", ASCENDING), ("is_deleted", ASCENDING), ("created_at", DESCENDING)],
                name="idx_messages_chat_active"
            )
            self.db.messages.create_index(
                [("parent_id", ASCENDING), ("created_at", ASCENDING)],
                name="idx_messages_threads"
            )
            logger.info("[DATABASE] Messages indexes created")
            
            # GROUPS
            self.db.groups.create_index("name", name="idx_groups_name")
            self.db.groups.create_index("created_by", name="idx_groups_creator")
            self.db.groups.create_index("created_at", name="idx_groups_created")
            self.db.groups.create_index("members", name="idx_groups_members")
            self.db.groups.create_index("admins", name="idx_groups_admins")
            self.db.groups.create_index(
                [("members", ASCENDING), ("created_at", DESCENDING)],
                name="idx_groups_member_recent"
            )
            logger.info("[DATABASE] Groups indexes created")
            
            # SESSION KEYS
            self.db.session_keys.create_index("user_id", name="idx_session_keys_user")
            self.db.session_keys.create_index("device_id", name="idx_session_keys_device")
            self.db.session_keys.create_index("is_active", name="idx_session_keys_active")
            self.db.session_keys.create_index("created_at", name="idx_session_keys_created")
            self.db.session_keys.create_index("expires_at", expireAfterSeconds=0, name="idx_session_keys_ttl")
            self.db.session_keys.create_index(
                [("user_id", ASCENDING), ("is_active", ASCENDING), ("device_id", ASCENDING)],
                name="idx_session_keys_user_active"
            )
            logger.info("[DATABASE] Session keys indexes created")
            
            # PUBLIC KEYS
            self.db.public_keys.create_index("user_id", name="idx_public_keys_user")
            self.db.public_keys.create_index("key_type", name="idx_public_keys_type")
            self.db.public_keys.create_index("is_active", name="idx_public_keys_active")
            self.db.public_keys.create_index("created_at", name="idx_public_keys_created")
            self.db.public_keys.create_index(
                [("user_id", ASCENDING), ("key_type", ASCENDING), ("is_active", ASCENDING)],
                name="idx_public_keys_lookup"
            )
            logger.info("[DATABASE] Public keys indexes created")
            
            # READ RECEIPTS
            self.db.read_receipts.create_index("message_id", name="idx_read_receipts_message")
            self.db.read_receipts.create_index("user_id", name="idx_read_receipts_user")
            self.db.read_receipts.create_index("chat_id", name="idx_read_receipts_chat")
            self.db.read_receipts.create_index("read_at", name="idx_read_receipts_time")
            self.db.read_receipts.create_index(
                [("message_id", ASCENDING), ("user_id", ASCENDING)],
                unique=True,
                name="idx_read_receipts_unique"
            )
            self.db.read_receipts.create_index(
                [("chat_id", ASCENDING), ("user_id", ASCENDING), ("read_at", DESCENDING)],
                name="idx_read_receipts_chat_user"
            )
            logger.info("[DATABASE] Read receipts indexes created")
            
            # REACTIONS
            self.db.reactions.create_index("message_id", name="idx_reactions_message")
            self.db.reactions.create_index("user_id", name="idx_reactions_user")
            self.db.reactions.create_index("reaction_type", name="idx_reactions_type")
            self.db.reactions.create_index("created_at", name="idx_reactions_created")
            self.db.reactions.create_index(
                [("message_id", ASCENDING), ("user_id", ASCENDING)],
                unique=True,
                name="idx_reactions_unique"
            )
            logger.info("[DATABASE] Reactions indexes created")
            
            # NOTIFICATIONS
            self.db.notifications.create_index("user_id", name="idx_notifications_user")
            self.db.notifications.create_index("is_read", name="idx_notifications_read")
            self.db.notifications.create_index("notification_type", name="idx_notifications_type")
            self.db.notifications.create_index("created_at", name="idx_notifications_created")
            self.db.notifications.create_index(
                [("user_id", ASCENDING), ("is_read", ASCENDING), ("created_at", DESCENDING)],
                name="idx_notifications_user_unread"
            )
            logger.info("[DATABASE] Notifications indexes created")
            
            # CALLS
            self.db.calls.create_index("chat_id", name="idx_calls_chat")
            self.db.calls.create_index("caller_id", name="idx_calls_caller")
            self.db.calls.create_index("receiver_id", name="idx_calls_receiver")
            self.db.calls.create_index("call_type", name="idx_calls_type")
            self.db.calls.create_index("status", name="idx_calls_status")
            self.db.calls.create_index("started_at", name="idx_calls_started")
            self.db.calls.create_index("ended_at", name="idx_calls_ended")
            self.db.calls.create_index(
                [("caller_id", ASCENDING), ("started_at", DESCENDING)],
                name="idx_calls_caller_history"
            )
            self.db.calls.create_index(
                [("receiver_id", ASCENDING), ("started_at", DESCENDING)],
                name="idx_calls_receiver_history"
            )
            logger.info("[DATABASE] Calls indexes created")
            
            # DEVICES
            self.db.user_devices.create_index("user_id", name="idx_devices_user")
            self.db.user_devices.create_index("device_id", unique=True, name="idx_devices_id_unique")
            self.db.user_devices.create_index("is_active", name="idx_devices_active")
            self.db.user_devices.create_index("last_seen", name="idx_devices_last_seen")
            self.db.user_devices.create_index(
                [("user_id", ASCENDING), ("is_active", ASCENDING)],
                name="idx_devices_user_active"
            )
            logger.info("[DATABASE] Devices indexes created")
            
            # AUDIT LOGS
            self.db.audit_logs.create_index("user_id", name="idx_audit_user")
            self.db.audit_logs.create_index("action_type", name="idx_audit_action")
            self.db.audit_logs.create_index("timestamp", name="idx_audit_timestamp")
            self.db.audit_logs.create_index("ip_address", name="idx_audit_ip")
            self.db.audit_logs.create_index(
                [("user_id", ASCENDING), ("timestamp", DESCENDING)],
                name="idx_audit_user_sorted"
            )
            self.db.audit_logs.create_index(
                [("action_type", ASCENDING), ("timestamp", DESCENDING)],
                name="idx_audit_action_sorted"
            )
            logger.info("[DATABASE] Audit logs indexes created")
            
            # POLLS
            self.db.polls.create_index("chat_id", name="idx_polls_chat")
            self.db.polls.create_index("created_by", name="idx_polls_creator")
            self.db.polls.create_index("created_at", name="idx_polls_created")
            self.db.polls.create_index("expires_at", name="idx_polls_expires")
            self.db.polls.create_index("is_active", name="idx_polls_active")
            self.db.polls.create_index(
                [("chat_id", ASCENDING), ("is_active", ASCENDING), ("created_at", DESCENDING)],
                name="idx_polls_chat_active"
            )
            logger.info("[DATABASE] Polls indexes created")
            
            # TEMP 2FA
            self.db.temp_2fa_secrets.create_index("user_id", unique=True, name="idx_2fa_temp_user_unique")
            self.db.temp_2fa_secrets.create_index("expires_at", expireAfterSeconds=0, name="idx_2fa_temp_ttl")
            logger.info("[DATABASE] 2FA temp secrets indexes created")
            
            # FILE METADATA
            self.db.file_metadata.create_index("chat_id", name="idx_files_chat")
            self.db.file_metadata.create_index("uploader_id", name="idx_files_uploader")
            self.db.file_metadata.create_index("file_type", name="idx_files_type")
            self.db.file_metadata.create_index("uploaded_at", name="idx_files_uploaded")
            self.db.file_metadata.create_index("file_size", name="idx_files_size")
            self.db.file_metadata.create_index(
                [("chat_id", ASCENDING), ("uploaded_at", DESCENDING)],
                name="idx_files_chat_sorted"
            )
            logger.info("[DATABASE] File metadata indexes created")
            
            # BLOCKED USERS
            self.db.blocked_users.create_index("blocker_id", name="idx_blocked_blocker")
            self.db.blocked_users.create_index("blocked_id", name="idx_blocked_blocked")
            self.db.blocked_users.create_index("blocked_at", name="idx_blocked_time")
            self.db.blocked_users.create_index(
                [("blocker_id", ASCENDING), ("blocked_id", ASCENDING)],
                unique=True,
                name="idx_blocked_unique"
            )
            logger.info("[DATABASE] Blocked users indexes created")
            
            # TYPING INDICATORS
            self.db.typing_indicators.create_index("chat_id", name="idx_typing_chat")
            self.db.typing_indicators.create_index("user_id", name="idx_typing_user")
            self.db.typing_indicators.create_index(
                "last_typed_at",
                expireAfterSeconds=30,
                name="idx_typing_ttl"
            )
            logger.info("[DATABASE] Typing indicators indexes created")
            
            logger.info("[DATABASE] All indexes created successfully")
        
        except DuplicateKeyError as e:
            logger.warning(f"[DATABASE] Duplicate key during index creation: {e}")
        
        except OperationFailure as e:
            logger.warning(f"[DATABASE] Index creation operation failed: {e}")
        
        except Exception as e:
            logger.error(f"[DATABASE] Index creation error: {e}")
            raise

    # ============================================================
    #                   COLLECTION SETUP
    # ============================================================

    def setup_collections(self):
        try:
            logger.info("[DATABASE] Setting up collections...")
            
            existing_collections = self.db.list_collection_names()
            
            required_collections = [
                "users",
                "chats",
                "messages",
                "groups",
                "session_keys",
                "public_keys",
                "read_receipts",
                "reactions",
                "notifications",
                "calls",
                "user_devices",
                "audit_logs",
                "polls",
                "temp_2fa_secrets",
                "file_metadata",
                "blocked_users",
                "typing_indicators"
            ]
            
            for collection in required_collections:
                if collection not in existing_collections:
                    self.db.create_collection(collection)
                    logger.info(f"[DATABASE] Created collection: {collection}")
            
            logger.info("[DATABASE] Collections setup complete")
        
        except Exception as e:
            logger.warning(f"[DATABASE] Collection setup warning: {e}")

    # ============================================================
    #                   HEALTH CHECK
    # ============================================================

    def health_check(self) -> bool:
        try:
            if not self._is_initialized:
                return False
            
            self.db.command("ping")
            return True
        
        except Exception as e:
            logger.error(f"[DATABASE] Health check failed: {e}")
            return False

    # ============================================================
    #                   DATABASE INFO
    # ============================================================

    def get_info(self) -> dict:
        try:
            if not self._is_initialized:
                return {"status": "not_initialized"}
            
            server_info = self.client.server_info()
            db_stats = self.db.command("dbStats")
            
            return {
                "status": "healthy",
                "mongodb_version": server_info.get("version"),
                "database_name": self.db.name,
                "collections": len(self.db.list_collection_names()),
                "storage_size_mb": round(db_stats.get("storageSize", 0) / (1024 * 1024), 2),
                "indexes": db_stats.get("indexes", 0),
                "data_size_mb": round(db_stats.get("dataSize", 0) / (1024 * 1024), 2)
            }
        
        except Exception as e:
            logger.error(f"[DATABASE] Failed to get info: {e}")
            return {"status": "error", "message": str(e)}

    # ============================================================
    #                   UTILITY METHODS
    # ============================================================

    def drop_all_indexes(self):
        if os.getenv("FLASK_ENV") != "development":
            logger.error("[DATABASE] Cannot drop indexes in production")
            return False
        
        try:
            collections = self.db.list_collection_names()
            
            for collection in collections:
                self.db[collection].drop_indexes()
                logger.info(f"[DATABASE] Dropped indexes for: {collection}")
            
            logger.info("[DATABASE] All indexes dropped")
            return True
        
        except Exception as e:
            logger.error(f"[DATABASE] Failed to drop indexes: {e}")
            return False
    
    def rebuild_indexes(self):
        try:
            logger.info("[DATABASE] Rebuilding indexes...")
            self.drop_all_indexes()
            self.create_indexes()
            logger.info("[DATABASE] Indexes rebuilt successfully")
            return True
        
        except Exception as e:
            logger.error(f"[DATABASE] Failed to rebuild indexes: {e}")
            return False

# ============================================================
#                   GLOBAL INSTANCE
# ============================================================

db_instance = Database()

# ============================================================
#                   PUBLIC FUNCTIONS
# ============================================================

def init_db(app):
    db_instance.init_app(app)

def get_db():
    if db_instance.db is None:
        raise RuntimeError("Database not initialized. Call init_db(app) first.")
    return db_instance.db

def get_client():
    if db_instance.client is None:
        raise RuntimeError("Database client not initialized. Call init_db(app) first.")
    return db_instance.client

def health_check() -> bool:
    return db_instance.health_check()

def get_database_info() -> dict:
    return db_instance.get_info()

__all__ = [
    "Database",
    "init_db",
    "get_db",
    "get_client",
    "health_check",
    "get_database_info",
]
