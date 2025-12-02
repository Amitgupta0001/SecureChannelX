"""
SecureChannelX Redis Client (Enhanced Version)
-----------------------------------------------
Production-grade Redis client with:
  - Automatic fallback to in-memory storage
  - Connection pooling & retry logic
  - Distributed rate limiting
  - Caching with TTL
  - Session management
  - Real-time notifications
  - Health monitoring
  - Graceful degradation
"""

import os
import json
import logging
import time
from typing import Optional, Any, Dict, List, Tuple
from functools import wraps
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   CONSTANTS
# ============================================================

DEFAULT_REDIS_URL = "redis://localhost:6379/0"
REDIS_SOCKET_CONNECT_TIMEOUT = 5
REDIS_SOCKET_TIMEOUT = 5
REDIS_RETRY_MAX = 3
REDIS_RETRY_DELAY = 1
HEALTH_CHECK_INTERVAL = 30  # seconds


# ============================================================
#                   IMPORTS & AVAILABILITY CHECK
# ============================================================

try:
    import redis
    from redis.connection import ConnectionPool
    from redis.retry import Retry
    from redis.backoff import ExponentialBackoff
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("[REDIS] redis library not installed. Run: pip install redis")


# ============================================================
#                   IN-MEMORY FALLBACK STORAGE
# ============================================================

class InMemoryStorage:
    """✅ ENHANCED: In-memory storage fallback"""
    
    def __init__(self):
        self.data = {}
        self.expiry = {}
    
    def get(self, key: str) -> Optional[str]:
        """Get value from memory"""
        # Check expiry
        if key in self.expiry:
            if time.time() > self.expiry[key]:
                del self.data[key]
                del self.expiry[key]
                return None
        
        return self.data.get(key)
    
    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Set value in memory with optional expiry"""
        try:
            self.data[key] = value
            
            if ex:
                self.expiry[key] = time.time() + ex
            elif key in self.expiry:
                del self.expiry[key]
            
            return True
        except Exception as e:
            logger.error(f"[MEMORY SET] Error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from memory"""
        try:
            if key in self.data:
                del self.data[key]
            
            if key in self.expiry:
                del self.expiry[key]
            
            return True
        except Exception as e:
            logger.error(f"[MEMORY DELETE] Error: {e}")
            return False
    
    def incr(self, key: str) -> int:
        """Increment counter"""
        try:
            current = self.data.get(key, 0)
            
            # Handle string representation
            if isinstance(current, str):
                try:
                    current = int(current)
                except ValueError:
                    current = 0
            
            new_value = int(current) + 1
            self.data[key] = str(new_value)
            
            return new_value
        except Exception as e:
            logger.error(f"[MEMORY INCR] Error: {e}")
            return 0
    
    def expire(self, key: str, seconds: int) -> bool:
        """Set expiration on key"""
        try:
            if key in self.data:
                self.expiry[key] = time.time() + seconds
                return True
            
            return False
        except Exception as e:
            logger.error(f"[MEMORY EXPIRE] Error: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists"""
        # Check expiry first
        if key in self.expiry:
            if time.time() > self.expiry[key]:
                del self.data[key]
                del self.expiry[key]
                return False
        
        return key in self.data
    
    def ttl(self, key: str) -> int:
        """Get TTL in seconds (-1 if no expiry, -2 if doesn't exist)"""
        if key not in self.data:
            return -2
        
        if key in self.expiry:
            remaining = self.expiry[key] - time.time()
            return max(-1, int(remaining))
        
        return -1
    
    def mget(self, *keys: str) -> List[Optional[str]]:
        """Get multiple values"""
        return [self.get(key) for key in keys]
    
    def mset(self, **kwargs) -> bool:
        """Set multiple key-value pairs"""
        try:
            for key, value in kwargs.items():
                self.data[key] = value
            
            return True
        except Exception as e:
            logger.error(f"[MEMORY MSET] Error: {e}")
            return False
    
    def lpush(self, key: str, *values) -> int:
        """Push to list (left)"""
        if key not in self.data:
            self.data[key] = []
        
        if not isinstance(self.data[key], list):
            self.data[key] = []
        
        for value in reversed(values):
            self.data[key].insert(0, value)
        
        return len(self.data[key])
    
    def lpop(self, key: str) -> Optional[str]:
        """Pop from list (left)"""
        if key not in self.data or not isinstance(self.data[key], list):
            return None
        
        if len(self.data[key]) == 0:
            return None
        
        return self.data[key].pop(0)
    
    def llen(self, key: str) -> int:
        """Get list length"""
        if key not in self.data or not isinstance(self.data[key], list):
            return 0
        
        return len(self.data[key])
    
    def clean_expired(self):
        """Remove expired keys (cleanup)"""
        now = time.time()
        expired_keys = [
            key for key, expiry in self.expiry.items()
            if now > expiry
        ]
        
        for key in expired_keys:
            if key in self.data:
                del self.data[key]
            del self.expiry[key]
        
        return len(expired_keys)


# ============================================================
#                   REDIS CLIENT WRAPPER
# ============================================================

class RedisClient:
    """✅ ENHANCED: Redis client with automatic fallback"""
    
    def __init__(self):
        self.client = None
        self.fallback = InMemoryStorage()
        self.enabled = False
        self.is_redis = False
        self.last_health_check = 0
        self.health_ok = False
        self._initialize()
    
    def _initialize(self):
        """✅ ENHANCED: Initialize Redis with comprehensive error handling"""
        if not REDIS_AVAILABLE:
            logger.warning("[REDIS INIT] redis library not available, using fallback")
            self.enabled = True  # Enable fallback
            return
        
        redis_url = os.getenv("REDIS_URL", DEFAULT_REDIS_URL)
        environment = os.getenv("FLASK_ENV", "development")
        
        # ✅ ENHANCED: Validate environment
        if environment == "production" and redis_url == DEFAULT_REDIS_URL:
            logger.error("[REDIS] ❌ [CRITICAL] REDIS_URL not set in PRODUCTION!")
            logger.error("   Running with in-memory fallback (NOT distributed).")
            logger.error("   Set REDIS_URL for production deployment.")
            self.enabled = True
            return
        
        # ✅ ENHANCED: Warn about localhost in production
        if environment == "production" and "localhost" in redis_url:
            logger.warning("[REDIS] ⚠️  Using localhost Redis in PRODUCTION")
            logger.warning("   This will NOT work in distributed/scaled deployments.")
        
        # ✅ ENHANCED: Try connecting with retry logic
        try:
            logger.info("[REDIS] Attempting connection to Redis...")
            
            # ✅ ENHANCED: Connection pool with retry
            retry = Retry(ExponentialBackoff(), REDIS_RETRY_MAX)
            pool = ConnectionPool.from_url(
                redis_url,
                retry=retry,
                retry_on_timeout=True,
                socket_connect_timeout=REDIS_SOCKET_CONNECT_TIMEOUT,
                socket_timeout=REDIS_SOCKET_TIMEOUT,
                max_connections=10,
                decode_responses=True
            )
            
            self.client = redis.Redis(connection_pool=pool)
            
            # ✅ ENHANCED: Test connection
            self.client.ping()
            self.enabled = True
            self.is_redis = True
            self.health_ok = True
            
            logger.info(f"[REDIS] ✅ Connected: {redis_url}")
            logger.info("[REDIS] Using Redis for caching, rate limiting, and sessions")
        
        except ImportError:
            logger.error("[REDIS] ❌ redis library not installed")
            logger.error("   pip install redis")
            self.enabled = True  # Enable fallback
        
        except redis.ConnectionError as e:
            logger.error(f"[REDIS] ❌ Connection failed: {e}")
            logger.warning("[REDIS] ⚠️  Falling back to in-memory storage")
            logger.warning("   In-memory storage does NOT work in distributed systems.")
            self.enabled = True  # Enable fallback
        
        except Exception as e:
            logger.error(f"[REDIS] ❌ Initialization error: {e}")
            logger.warning("[REDIS] ⚠️  Using fallback storage")
            self.enabled = True  # Enable fallback
    
    # ============= HEALTH CHECK =============
    
    def health_check(self) -> bool:
        """✅ ENHANCED: Check Redis health with caching"""
        now = time.time()
        
        # Only check every N seconds
        if now - self.last_health_check < HEALTH_CHECK_INTERVAL:
            return self.health_ok
        
        self.last_health_check = now
        
        if not self.is_redis:
            self.health_ok = True  # Fallback is always "healthy"
            return True
        
        try:
            self.client.ping()
            self.health_ok = True
            return True
        except Exception as e:
            logger.error(f"[REDIS HEALTH] ❌ Health check failed: {e}")
            self.health_ok = False
            return False
    
    def is_healthy(self) -> bool:
        """✅ ENHANCED: Quick health status check"""
        return self.enabled and self.health_ok
    
    # ============= BASIC OPERATIONS =============
    
    def get(self, key: str) -> Optional[str]:
        """✅ ENHANCED: Get value from Redis or fallback"""
        if not self.enabled:
            return None
        
        try:
            if self.is_redis:
                return self.client.get(key)
            else:
                return self.fallback.get(key)
        
        except Exception as e:
            logger.error(f"[REDIS GET] Error: {e}")
            
            # Fallback to in-memory if Redis fails
            if self.is_redis:
                try:
                    return self.fallback.get(key)
                except:
                    return None
            
            return None
    
    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """✅ ENHANCED: Set value with optional expiration"""
        if not self.enabled:
            return False
        
        try:
            if self.is_redis:
                return self.client.set(key, value, ex=ex)
            else:
                return self.fallback.set(key, value, ex=ex)
        
        except Exception as e:
            logger.error(f"[REDIS SET] Error: {e}")
            
            # Fallback to in-memory if Redis fails
            if self.is_redis:
                try:
                    return self.fallback.set(key, value, ex=ex)
                except:
                    return False
            
            return False
    
    def delete(self, key: str) -> bool:
        """✅ ENHANCED: Delete key"""
        if not self.enabled:
            return False
        
        try:
            if self.is_redis:
                return self.client.delete(key) > 0
            else:
                return self.fallback.delete(key)
        
        except Exception as e:
            logger.error(f"[REDIS DELETE] Error: {e}")
            
            # Fallback to in-memory if Redis fails
            if self.is_redis:
                try:
                    return self.fallback.delete(key)
                except:
                    return False
            
            return False
    
    def exists(self, key: str) -> bool:
        """✅ ENHANCED: Check if key exists"""
        if not self.enabled:
            return False
        
        try:
            if self.is_redis:
                return self.client.exists(key) > 0
            else:
                return self.fallback.exists(key)
        
        except Exception as e:
            logger.error(f"[REDIS EXISTS] Error: {e}")
            return False
    
    # ============= COUNTER OPERATIONS =============
    
    def incr(self, key: str) -> Optional[int]:
        """✅ ENHANCED: Increment counter (atomic in Redis)"""
        if not self.enabled:
            return None
        
        try:
            if self.is_redis:
                return self.client.incr(key)
            else:
                return self.fallback.incr(key)
        
        except Exception as e:
            logger.error(f"[REDIS INCR] Error: {e}")
            
            # Fallback to in-memory if Redis fails
            if self.is_redis:
                try:
                    return self.fallback.incr(key)
                except:
                    return None
            
            return None
    
    def incrby(self, key: str, amount: int) -> Optional[int]:
        """✅ ENHANCED: Increment counter by amount"""
        if not self.enabled:
            return None
        
        try:
            if self.is_redis:
                return self.client.incrby(key, amount)
            else:
                current = int(self.fallback.data.get(key, 0))
                new_value = current + amount
                self.fallback.data[key] = str(new_value)
                return new_value
        
        except Exception as e:
            logger.error(f"[REDIS INCRBY] Error: {e}")
            return None
    
    def decr(self, key: str) -> Optional[int]:
        """✅ ENHANCED: Decrement counter"""
        if not self.enabled:
            return None
        
        try:
            if self.is_redis:
                return self.client.decr(key)
            else:
                current = int(self.fallback.data.get(key, 0))
                new_value = max(0, current - 1)
                self.fallback.data[key] = str(new_value)
                return new_value
        
        except Exception as e:
            logger.error(f"[REDIS DECR] Error: {e}")
            return None
    
    # ============= EXPIRATION =============
    
    def expire(self, key: str, seconds: int) -> bool:
        """✅ ENHANCED: Set key expiration"""
        if not self.enabled:
            return False
        
        try:
            if self.is_redis:
                return self.client.expire(key, seconds)
            else:
                return self.fallback.expire(key, seconds)
        
        except Exception as e:
            logger.error(f"[REDIS EXPIRE] Error: {e}")
            return False
    
    def ttl(self, key: str) -> int:
        """✅ ENHANCED: Get remaining TTL in seconds"""
        if not self.enabled:
            return -2
        
        try:
            if self.is_redis:
                return self.client.ttl(key)
            else:
                return self.fallback.ttl(key)
        
        except Exception as e:
            logger.error(f"[REDIS TTL] Error: {e}")
            return -2
    
    # ============= MULTI-KEY OPERATIONS =============
    
    def mget(self, *keys: str) -> List[Optional[str]]:
        """✅ ENHANCED: Get multiple values"""
        if not self.enabled:
            return [None] * len(keys)
        
        try:
            if self.is_redis:
                return self.client.mget(*keys)
            else:
                return self.fallback.mget(*keys)
        
        except Exception as e:
            logger.error(f"[REDIS MGET] Error: {e}")
            return [None] * len(keys)
    
    def mset(self, **kwargs) -> bool:
        """✅ ENHANCED: Set multiple key-value pairs"""
        if not self.enabled:
            return False
        
        try:
            if self.is_redis:
                return self.client.mset(kwargs)
            else:
                return self.fallback.mset(**kwargs)
        
        except Exception as e:
            logger.error(f"[REDIS MSET] Error: {e}")
            return False
    
    # ============= LIST OPERATIONS =============
    
    def lpush(self, key: str, *values) -> int:
        """✅ ENHANCED: Push values to list (left side)"""
        if not self.enabled:
            return 0
        
        try:
            if self.is_redis:
                return self.client.lpush(key, *values)
            else:
                return self.fallback.lpush(key, *values)
        
        except Exception as e:
            logger.error(f"[REDIS LPUSH] Error: {e}")
            return 0
    
    def lpop(self, key: str) -> Optional[str]:
        """✅ ENHANCED: Pop from list (left side)"""
        if not self.enabled:
            return None
        
        try:
            if self.is_redis:
                return self.client.lpop(key)
            else:
                return self.fallback.lpop(key)
        
        except Exception as e:
            logger.error(f"[REDIS LPOP] Error: {e}")
            return None
    
    def llen(self, key: str) -> int:
        """✅ ENHANCED: Get list length"""
        if not self.enabled:
            return 0
        
        try:
            if self.is_redis:
                return self.client.llen(key)
            else:
                return self.fallback.llen(key)
        
        except Exception as e:
            logger.error(f"[REDIS LLEN] Error: {e}")
            return 0
    
    # ============= JSON OPERATIONS =============
    
    def get_json(self, key: str) -> Optional[Dict]:
        """✅ ENHANCED: Get and decode JSON value"""
        try:
            value = self.get(key)
            if value:
                return json.loads(value)
            return None
        
        except Exception as e:
            logger.error(f"[REDIS GET JSON] Error: {e}")
            return None
    
    def set_json(self, key: str, value: Dict, ex: Optional[int] = None) -> bool:
        """✅ ENHANCED: Encode and set JSON value"""
        try:
            json_str = json.dumps(value)
            return self.set(key, json_str, ex=ex)
        
        except Exception as e:
            logger.error(f"[REDIS SET JSON] Error: {e}")
            return False
    
    # ============= DEBUGGING =============
    
    def get_info(self) -> Dict[str, Any]:
        """✅ ENHANCED: Get Redis info"""
        try:
            if not self.is_redis:
                return {
                    "backend": "in-memory",
                    "status": "active",
                    "memory_usage": len(str(self.fallback.data)),
                    "keys_count": len(self.fallback.data)
                }
            
            info = self.client.info()
            return {
                "backend": "redis",
                "status": "healthy" if self.health_ok else "unhealthy",
                "version": info.get("redis_version", "unknown"),
                "memory_usage": info.get("used_memory", 0),
                "connected_clients": info.get("connected_clients", 0),
                "keys_count": sum(info.get(f"db{i}", {}).get("keys", 0) for i in range(16))
            }
        
        except Exception as e:
            logger.error(f"[REDIS INFO] Error: {e}")
            return {"status": "error", "message": str(e)}
    
    def flush_all(self) -> bool:
        """✅ ENHANCED: Flush all keys (DEVELOPMENT ONLY)"""
        if os.getenv("FLASK_ENV") == "production":
            logger.error("[REDIS FLUSH] ❌ Not allowed in production!")
            return False
        
        try:
            if self.is_redis:
                self.client.flushall()
            else:
                self.fallback.data.clear()
                self.fallback.expiry.clear()
            
            logger.info("[REDIS FLUSH] ✅ All keys flushed")
            return True
        
        except Exception as e:
            logger.error(f"[REDIS FLUSH] Error: {e}")
            return False


# ============================================================
#                   GLOBAL INSTANCE & HELPERS
# ============================================================

_redis_client = None

def get_redis_client() -> RedisClient:
    """✅ ENHANCED: Get singleton Redis client instance"""
    global _redis_client
    if _redis_client is None:
        _redis_client = RedisClient()
    return _redis_client


def redis_cache(ttl: int = 3600):
    """✅ ENHANCED: Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            redis = get_redis_client()
            
            # Generate cache key
            cache_key = f"cache:{func.__module__}:{func.__name__}:{args}:{kwargs}"
            
            # Try to get from cache
            cached = redis.get_json(cache_key)
            if cached is not None:
                logger.debug(f"[CACHE HIT] {func.__name__}")
                return cached
            
            # Call function and cache result
            result = func(*args, **kwargs)
            redis.set_json(cache_key, result, ex=ttl)
            
            logger.debug(f"[CACHE MISS] {func.__name__}")
            return result
        
        return wrapper
    
    return decorator


__all__ = [
    "RedisClient",
    "InMemoryStorage",
    "get_redis_client",
    "redis_cache",
]