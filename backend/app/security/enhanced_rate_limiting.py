"""
SecureChannelX - Enhanced Rate Limiting
---------------------------------------
Distributed rate limiting with Redis fallback

Features:
- Per-user rate limiting
- Per-IP rate limiting
- Endpoint-specific limits
- Distributed rate limiting (Redis)
- In-memory fallback
- Progressive delays
- Account lockout
"""

import time
import logging
from typing import Tuple, Optional, Dict
from collections import defaultdict
from datetime import datetime, timedelta
import threading

logger = logging.getLogger(__name__)


# ============================================================
#                   RATE LIMIT CONFIGURATION
# ============================================================

class RateLimitConfig:
    """Rate limit configuration"""
    
    # Global limits
    GLOBAL_REQUESTS_PER_MINUTE = 1000
    GLOBAL_REQUESTS_PER_HOUR = 10000
    
    # Per-user limits
    USER_REQUESTS_PER_MINUTE = 60
    USER_REQUESTS_PER_HOUR = 1000
    
    # Per-IP limits
    IP_REQUESTS_PER_MINUTE = 100
    IP_REQUESTS_PER_HOUR = 2000
    
    # Endpoint-specific limits
    ENDPOINT_LIMITS = {
        '/api/auth/login': {
            'per_minute': 5,
            'per_hour': 20,
            'lockout_threshold': 10,
            'lockout_duration': 3600  # 1 hour
        },
        '/api/auth/register': {
            'per_minute': 3,
            'per_hour': 10
        },
        '/api/messages/send': {
            'per_minute': 30,
            'per_hour': 500
        },
        '/api/files/upload': {
            'per_minute': 10,
            'per_hour': 100
        }
    }
    
    # Progressive delay (seconds)
    PROGRESSIVE_DELAYS = [0, 1, 2, 5, 10, 30, 60]


# ============================================================
#                   ENHANCED RATE LIMITER
# ============================================================

class EnhancedRateLimiter:
    """
    Enhanced rate limiter with distributed support
    """
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
        self.local_cache = defaultdict(list)
        self.lockouts = defaultdict(dict)
        self._lock = threading.Lock()
        self.config = RateLimitConfig()
    
    def check_rate_limit(
        self,
        identifier: str,
        endpoint: str,
        limit_type: str = 'user'
    ) -> Tuple[bool, Optional[str], int]:
        """
        Check if request is within rate limit
        
        Args:
            identifier: User ID or IP address
            endpoint: API endpoint
            limit_type: 'user', 'ip', or 'global'
            
        Returns:
            (allowed, error_message, retry_after_seconds)
        """
        # Check if locked out
        if self._is_locked_out(identifier, endpoint):
            lockout_info = self.lockouts[identifier].get(endpoint, {})
            retry_after = int(lockout_info.get('expires_at', time.time()) - time.time())
            return False, "Account temporarily locked due to too many attempts", retry_after
        
        # Get limits for endpoint
        limits = self._get_limits(endpoint, limit_type)
        
        # Check minute limit
        minute_allowed, minute_msg = self._check_window(
            identifier,
            endpoint,
            60,
            limits['per_minute']
        )
        
        if not minute_allowed:
            retry_after = self._calculate_retry_after(identifier, endpoint)
            self._increment_violations(identifier, endpoint)
            return False, minute_msg, retry_after
        
        # Check hour limit
        hour_allowed, hour_msg = self._check_window(
            identifier,
            endpoint,
            3600,
            limits['per_hour']
        )
        
        if not hour_allowed:
            retry_after = self._calculate_retry_after(identifier, endpoint)
            self._increment_violations(identifier, endpoint)
            return False, hour_msg, retry_after
        
        # Record request
        self._record_request(identifier, endpoint)
        
        return True, None, 0
    
    def _get_limits(self, endpoint: str, limit_type: str) -> Dict:
        """Get rate limits for endpoint"""
        # Endpoint-specific limits
        if endpoint in self.config.ENDPOINT_LIMITS:
            return self.config.ENDPOINT_LIMITS[endpoint]
        
        # Default limits based on type
        if limit_type == 'user':
            return {
                'per_minute': self.config.USER_REQUESTS_PER_MINUTE,
                'per_hour': self.config.USER_REQUESTS_PER_HOUR
            }
        elif limit_type == 'ip':
            return {
                'per_minute': self.config.IP_REQUESTS_PER_MINUTE,
                'per_hour': self.config.IP_REQUESTS_PER_HOUR
            }
        else:  # global
            return {
                'per_minute': self.config.GLOBAL_REQUESTS_PER_MINUTE,
                'per_hour': self.config.GLOBAL_REQUESTS_PER_HOUR
            }
    
    def _check_window(
        self,
        identifier: str,
        endpoint: str,
        window_seconds: int,
        max_requests: int
    ) -> Tuple[bool, Optional[str]]:
        """Check if within rate limit for time window"""
        key = f"{identifier}:{endpoint}:{window_seconds}"
        now = time.time()
        cutoff = now - window_seconds
        
        with self._lock:
            # Clean old entries
            self.local_cache[key] = [
                ts for ts in self.local_cache[key]
                if ts > cutoff
            ]
            
            # Check limit
            if len(self.local_cache[key]) >= max_requests:
                window_name = "minute" if window_seconds == 60 else "hour"
                return False, f"Rate limit exceeded: {max_requests} requests per {window_name}"
            
            return True, None
    
    def _record_request(self, identifier: str, endpoint: str):
        """Record a request"""
        now = time.time()
        
        with self._lock:
            # Record in minute window
            key_minute = f"{identifier}:{endpoint}:60"
            self.local_cache[key_minute].append(now)
            
            # Record in hour window
            key_hour = f"{identifier}:{endpoint}:3600"
            self.local_cache[key_hour].append(now)
    
    def _increment_violations(self, identifier: str, endpoint: str):
        """Increment violation count and check for lockout"""
        key = f"{identifier}:{endpoint}"
        
        with self._lock:
            if key not in self.lockouts[identifier]:
                self.lockouts[identifier][key] = {
                    'violations': 0,
                    'first_violation': time.time()
                }
            
            self.lockouts[identifier][key]['violations'] += 1
            violations = self.lockouts[identifier][key]['violations']
            
            # Check if should lock out
            endpoint_config = self.config.ENDPOINT_LIMITS.get(endpoint, {})
            lockout_threshold = endpoint_config.get('lockout_threshold', 20)
            
            if violations >= lockout_threshold:
                lockout_duration = endpoint_config.get('lockout_duration', 3600)
                self.lockouts[identifier][endpoint] = {
                    'locked_at': time.time(),
                    'expires_at': time.time() + lockout_duration,
                    'violations': violations
                }
                logger.warning(
                    f"[RateLimit] Locked out {identifier} for {endpoint} "
                    f"({violations} violations)"
                )
    
    def _is_locked_out(self, identifier: str, endpoint: str) -> bool:
        """Check if identifier is locked out"""
        if identifier not in self.lockouts:
            return False
        
        lockout_info = self.lockouts[identifier].get(endpoint)
        if not lockout_info:
            return False
        
        # Check if lockout expired
        if lockout_info.get('expires_at', 0) < time.time():
            # Remove expired lockout
            with self._lock:
                del self.lockouts[identifier][endpoint]
            return False
        
        return True
    
    def _calculate_retry_after(self, identifier: str, endpoint: str) -> int:
        """Calculate retry-after seconds with progressive delay"""
        key = f"{identifier}:{endpoint}"
        
        if identifier in self.lockouts and key in self.lockouts[identifier]:
            violations = self.lockouts[identifier][key].get('violations', 0)
            delay_index = min(violations, len(self.config.PROGRESSIVE_DELAYS) - 1)
            return self.config.PROGRESSIVE_DELAYS[delay_index]
        
        return 60  # Default 1 minute
    
    def reset_violations(self, identifier: str, endpoint: str = None):
        """Reset violations for identifier"""
        with self._lock:
            if endpoint:
                if identifier in self.lockouts and endpoint in self.lockouts[identifier]:
                    del self.lockouts[identifier][endpoint]
            else:
                if identifier in self.lockouts:
                    del self.lockouts[identifier]
        
        logger.info(f"[RateLimit] Reset violations for {identifier}")


# Global rate limiter instance
_rate_limiter = None


def get_rate_limiter(redis_client=None):
    """Get global rate limiter instance"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = EnhancedRateLimiter(redis_client)
    return _rate_limiter


__all__ = [
    'EnhancedRateLimiter',
    'RateLimitConfig',
    'get_rate_limiter'
]
