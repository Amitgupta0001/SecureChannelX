from flask import current_app
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import certifi

class Database:
    def __init__(self):
        self.client = None
        self.db = None
    
    def init_app(self, app):
        try:
            # MongoDB connection with error handling
            mongodb_uri = app.config.get('MONGODB_URI', 'mongodb://localhost:27017/securechannelx')
            
            # For MongoDB Atlas, use certifi for SSL
            if 'mongodb+srv' in mongodb_uri:
                self.client = MongoClient(mongodb_uri, tlsCAFile=certifi.where())
            else:
                self.client = MongoClient(mongodb_uri)
            
            # Test connection
            self.client.admin.command('ismaster')
            
            # Get database
            self.db = self.client.get_database()
            
            # Create indexes
            self.create_indexes()
            
            print("✅ MongoDB connected successfully")
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"❌ MongoDB connection failed: {e}")
            raise e
    
    def create_indexes(self):
        try:
            # Users collection indexes
            self.db.users.create_index("username", unique=True)
            self.db.users.create_index("email", unique=True)
            self.db.users.create_index("created_at")
            
            # Messages collection indexes
            self.db.messages.create_index("room_id")
            self.db.messages.create_index("user_id")
            self.db.messages.create_index([("room_id", 1), ("created_at", -1)])
            self.db.messages.create_index([("user_id", 1), ("created_at", -1)])
            self.db.messages.create_index("parent_id")  # For threaded messages
            
            # Session keys indexes
            self.db.session_keys.create_index("user_id")
            self.db.session_keys.create_index("expires_at", expireAfterSeconds=0)
            self.db.session_keys.create_index([("user_id", 1), ("is_active", 1)])
            
            # Audit logs indexes
            self.db.audit_logs.create_index("user_id")
            self.db.audit_logs.create_index("timestamp")
            self.db.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])
            
            # Polls indexes
            self.db.polls.create_index("room_id")
            self.db.polls.create_index("created_by")
            self.db.polls.create_index("created_at")
            
            # 2FA temporary secrets
            self.db.temp_2fa_secrets.create_index("user_id", unique=True)
            self.db.temp_2fa_secrets.create_index("expires_at", expireAfterSeconds=0)
            
            # User devices
            self.db.user_devices.create_index("user_id")
            self.db.user_devices.create_index("device_id")
            
            print("✅ Database indexes created successfully")
            
        except Exception as e:
            print(f"⚠️ Index creation warning: {e}")

# Global database instance
db_instance = Database()

def init_db(app):
    db_instance.init_app(app)

def get_db():
    if db_instance.db is None:
        raise RuntimeError("Database not initialized. Call init_db first.")
    return db_instance.db

def get_client():
    if db_instance.client is None:
        raise RuntimeError("Database client not initialized.")
    return db_instance.client