"""
SecureChannelX - Performance Optimization
-----------------------------------------
Database indexing, caching, and message batching

Features:
- Compound database indexes
- Redis caching with fallback
- Message batching
- Query optimization
"""

import logging
from typing import List, Dict, Optional, Any
from functools import lru_cache
from datetime import datetime, timedelta
import time

logger = logging.getLogger(__name__)


# ============================================================
#                   DATABASE OPTIMIZATION
# ============================================================

class DatabaseOptimizer:
    """
    Optimizes database performance with proper indexing
    """
    
    @staticmethod
    def create_indexes(db):
        """
        Create all necessary indexes for optimal performance
        """
        logger.info("[DBOptimizer] Creating database indexes...")
        
        try:
            # Messages collection
            db.messages.create_index([
                ("recipient_id", 1),
                ("timestamp", -1)
            ], name="recipient_timestamp_idx")
            
            db.messages.create_index([
                ("sender_id", 1),
                ("timestamp", -1)
            ], name="sender_timestamp_idx")
            
            db.messages.create_index([
                ("recipient_id", 1),
                ("read", 1),
                ("timestamp", -1)
            ], name="unread_messages_idx")
            
            db.messages.create_index([
                ("conversation_id", 1),
                ("timestamp", -1)
            ], name="conversation_idx")
            
            # Users collection
            db.users.create_index("username", unique=True, name="username_idx")
            db.users.create_index("email", unique=True, name="email_idx")
            db.users.create_index("created_at", name="user_created_idx")
            
            # Sessions collection
            db.sessions.create_index([
                ("user_id", 1),
                ("expires_at", 1)
            ], name="session_expiry_idx")
            
            db.sessions.create_index("token", unique=True, name="session_token_idx")
            
            # Keys collection
            db.prekey_bundles.create_index("user_id", name="prekey_user_idx")
            db.prekey_bundles.create_index([
                ("user_id", 1),
                ("expires_at", 1)
            ], name="prekey_expiry_idx")
            
            # Security events
            db.security_events.create_index([
                ("user_id", 1),
                ("timestamp", -1)
            ], name="security_events_idx")
            
            db.security_events.create_index("event_type", name="event_type_idx")
            db.security_events.create_index("severity", name="severity_idx")
            
            logger.info("[DBOptimizer] ✅ All indexes created successfully")
            
        except Exception as e:
            logger.error(f"[DBOptimizer] Error creating indexes: {e}")
    
    @staticmethod
    def analyze_slow_queries(db):
        """
        Analyze and log slow queries
        """
        # Enable profiling
        db.command('profile', 2)  # Profile slow queries (>100ms)
        
        # Get slow queries
        slow_queries = db.system.profile.find({
            'millis': {'$gt': 100}
        }).sort('ts', -1).limit(10)
        
        for query in slow_queries:
            logger.warning(f"[DBOptimizer] Slow query ({query['millis']}ms): {query['command']}")


# ============================================================
#                   CACHING LAYER
# ============================================================

class CacheManager:
    """
    Multi-level caching with Redis and in-memory fallback
    """
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
        self.local_cache = {}
        self.cache_ttl = 300  # 5 minutes default TTL
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache (Redis -> Local -> None)
        """
        # Try Redis first
        if self.redis:
            try:
                value = self.redis.get(key)
                if value:
                    import json
                    return json.loads(value)
            except Exception as e:
                logger.warning(f"[Cache] Redis get failed: {e}")
        
        # Fallback to local cache
        if key in self.local_cache:
            entry = self.local_cache[key]
            if entry['expires_at'] > time.time():
                return entry['value']
            else:
                del self.local_cache[key]
        
        return None
    
    def set(self, key: str, value: Any, ttl: int = None):
        """
        Set value in cache
        """
        ttl = ttl or self.cache_ttl
        
        # Try Redis first
        if self.redis:
            try:
                import json
                self.redis.setex(key, ttl, json.dumps(value, default=str))
                return
            except Exception as e:
                logger.warning(f"[Cache] Redis set failed: {e}")
        
        # Fallback to local cache
        self.local_cache[key] = {
            'value': value,
            'expires_at': time.time() + ttl
        }
    
    def delete(self, key: str):
        """Delete from cache"""
        if self.redis:
            try:
                self.redis.delete(key)
            except Exception:
                pass
        
        if key in self.local_cache:
            del self.local_cache[key]
    
    def clear(self):
        """Clear all cache"""
        if self.redis:
            try:
                self.redis.flushdb()
            except Exception:
                pass
        
        self.local_cache.clear()
    
    @lru_cache(maxsize=1000)
    def get_user_public_keys(self, user_id: str):
        """
        Cached user public keys lookup
        """
        cache_key = f"user_keys:{user_id}"
        return self.get(cache_key)
    
    def cache_user_public_keys(self, user_id: str, keys: Dict):
        """Cache user public keys"""
        cache_key = f"user_keys:{user_id}"
        self.set(cache_key, keys, ttl=3600)  # 1 hour


# ============================================================
#                   MESSAGE BATCHING
# ============================================================

class MessageBatcher:
    """
    Batch messages for efficient processing
    """
    
    def __init__(self, batch_size: int = 10, batch_timeout: float = 1.0):
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        self.pending_messages = []
        self.last_flush = time.time()
    
    def add_message(self, message: Dict) -> Optional[List[Dict]]:
        """
        Add message to batch
        
        Returns:
            Batch of messages if ready to flush, None otherwise
        """
        self.pending_messages.append(message)
        
        # Check if should flush
        if self._should_flush():
            return self.flush()
        
        return None
    
    def _should_flush(self) -> bool:
        """Check if batch should be flushed"""
        # Flush if batch is full
        if len(self.pending_messages) >= self.batch_size:
            return True
        
        # Flush if timeout reached
        if time.time() - self.last_flush >= self.batch_timeout:
            return True
        
        return False
    
    def flush(self) -> List[Dict]:
        """
        Flush pending messages
        
        Returns:
            List of messages to process
        """
        messages = self.pending_messages.copy()
        self.pending_messages.clear()
        self.last_flush = time.time()
        
        logger.debug(f"[MessageBatcher] Flushed {len(messages)} messages")
        return messages
    
    def batch_insert(self, db, collection: str, documents: List[Dict]):
        """
        Batch insert documents into database
        """
        if not documents:
            return
        
        try:
            result = db[collection].insert_many(documents, ordered=False)
            logger.debug(f"[MessageBatcher] Inserted {len(result.inserted_ids)} documents")
        except Exception as e:
            logger.error(f"[MessageBatcher] Batch insert failed: {e}")


# ============================================================
#                   QUERY OPTIMIZER
# ============================================================

class QueryOptimizer:
    """
    Optimize database queries
    """
    
    @staticmethod
    def get_recent_messages(db, user_id: str, limit: int = 50) -> List[Dict]:
        """
        Optimized query for recent messages
        """
        # Use compound index: recipient_id + timestamp
        messages = list(db.messages.find(
            {'recipient_id': user_id},
            {'_id': 0}
        ).sort('timestamp', -1).limit(limit))
        
        return messages
    
    @staticmethod
    def get_unread_count(db, user_id: str) -> int:
        """
        Optimized query for unread message count
        """
        # Use compound index: recipient_id + read + timestamp
        count = db.messages.count_documents({
            'recipient_id': user_id,
            'read': False
        })
        
        return count
    
    @staticmethod
    def get_conversation_messages(
        db,
        user1_id: str,
        user2_id: str,
        limit: int = 100
    ) -> List[Dict]:
        """
        Optimized query for conversation messages
        """
        messages = list(db.messages.find({
            '$or': [
                {'sender_id': user1_id, 'recipient_id': user2_id},
                {'sender_id': user2_id, 'recipient_id': user1_id}
            ]
        }).sort('timestamp', -1).limit(limit))
        
        return messages
    
    @staticmethod
    def mark_messages_read(db, user_id: str, sender_id: str):
        """
        Optimized bulk update for marking messages as read
        """
        result = db.messages.update_many(
            {
                'recipient_id': user_id,
                'sender_id': sender_id,
                'read': False
            },
            {'$set': {'read': True, 'read_at': datetime.utcnow()}}
        )
        
        logger.debug(f"[QueryOptimizer] Marked {result.modified_count} messages as read")
        return result.modified_count


# Global instances
_cache_manager = None
_message_batcher = None


def get_cache_manager(redis_client=None):
    """Get global cache manager instance"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager(redis_client)
    return _cache_manager


def get_message_batcher():
    """Get global message batcher instance"""
    global _message_batcher
    if _message_batcher is None:
        _message_batcher = MessageBatcher()
    return _message_batcher


__all__ = [
    'DatabaseOptimizer',
    'CacheManager',
    'MessageBatcher',
    'QueryOptimizer',
    'get_cache_manager',
    'get_message_batcher'
]
