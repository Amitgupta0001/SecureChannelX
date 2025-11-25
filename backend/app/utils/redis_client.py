# FILE: backend/app/utils/redis_client.py
"""
Redis client with automatic fallback to in-memory storage
Provides distributed rate limiting and caching
"""

import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class RedisClient:
    """Redis client wrapper with fallback support"""
    
    def __init__(self):
        self.client = None
        self.enabled = False
        self._initialize()
    
    def _initialize(self):
        """Initialize Redis connection with fallback"""
        redis_url = os.getenv('REDIS_URL')
        
        if not redis_url:
            logger.warning("⚠️  REDIS_URL not configured. Using in-memory storage.")
            logger.warning("   For production, install Redis: docker run -d -p 6379:6379 redis:alpine")
            return
        
        try:
            import redis
            self.client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test connection
            self.client.ping()
            self.enabled = True
            logger.info(f"✅ Redis connected: {redis_url}")
            
        except ImportError:
            logger.error("❌ Redis library not installed. Run: pip install redis")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {str(e)}")
            logger.warning("   Falling back to in-memory storage")
            self.client = None
    
    def get(self, key: str) -> Optional[str]:
        """Get value from Redis or return None"""
        if not self.enabled:
            return None
        try:
            return self.client.get(key)
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None
    
    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Set value in Redis with optional expiration"""
        if not self.enabled:
            return False
        try:
            return self.client.set(key, value, ex=ex)
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from Redis"""
        if not self.enabled:
            return False
        try:
            return self.client.delete(key) > 0
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
            return False
    
    def incr(self, key: str) -> Optional[int]:
        """Increment counter"""
        if not self.enabled:
            return None
        try:
            return self.client.incr(key)
        except Exception as e:
            logger.error(f"Redis INCR error: {e}")
            return None
    
    def expire(self, key: str, seconds: int) -> bool:
        """Set expiration on key"""
        if not self.enabled:
            return False
        try:
            return self.client.expire(key, seconds)
        except Exception as e:
            logger.error(f"Redis EXPIRE error: {e}")
            return False

# Global Redis client instance
redis_client = RedisClient()
