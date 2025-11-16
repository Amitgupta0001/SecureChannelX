# database/optimizations.py
from sqlalchemy import Index, text
from sqlalchemy.event import listens_for
from sqlalchemy.orm import Session

# Create indexes for better performance
def create_indexes():
    """Create database indexes for optimal query performance"""
    indexes = [
        Index('idx_message_room_created', Message.room_id, Message.created_at),
        Index('idx_message_user_created', Message.user_id, Message.created_at),
        Index('idx_user_last_login', User.last_login),
        Index('idx_session_key_user', SessionKey.user_id, SessionKey.created_at),
        Index('idx_audit_log_user_time', AuditLog.user_id, AuditLog.created_at)
    ]
    
    return indexes

# Database connection pooling
class DatabasePool:
    def __init__(self, app):
        self.app = app
        self.engine = None
    
    def init_pool(self):
        """Initialize connection pool with optimal settings"""
        self.engine = create_engine(
            app.config['SQLALCHEMY_DATABASE_URI'],
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True,
            pool_recycle=3600  # Recycle connections every hour
        )
    
    def get_connection(self):
        return self.engine.connect()

# Query optimization
def optimize_queries(session):
    """Add query optimization hints"""
    @listens_for(Session, "before_execute")
    def before_execute(conn, clauseelement, multiparams, params):
        # Add query hints for frequently used queries
        if hasattr(clauseelement, 'whereclause'):
            # Add specific optimizations based on query patterns
            pass

# Caching layer
class QueryCache:
    def __init__(self, redis_client, default_ttl=300):
        self.redis = redis_client
        self.default_ttl = default_ttl
    
    def get_cached_query(self, key):
        """Get cached query result"""
        cached = self.redis.get(f"query:{key}")
        if cached:
            return json.loads(cached)
        return None
    
    def set_cached_query(self, key, result, ttl=None):
        """Cache query result"""
        if ttl is None:
            ttl = self.default_ttl
        
        self.redis.setex(
            f"query:{key}",
            ttl,
            json.dumps(result)
        )
    
    def invalidate_pattern(self, pattern):
        """Invalidate cache keys matching pattern"""
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)