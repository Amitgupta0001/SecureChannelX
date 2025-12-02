# backend/app/utils/helpers.py

"""
SecureChannelX Helper Utilities (Enhanced Version)
--------------------------------------------------
Production-grade utility functions for:
  - UUID & random generation
  - Time/date handling
  - Client information extraction
  - Safe serialization
  - String utilities
  - Data validation
  - Hashing & cryptography
  - Error handling
"""

import os
import uuid
import secrets
import logging
import hashlib
import hmac
import string
from typing import Any, Dict, List, Optional, Union, Tuple
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import urlparse, urljoin

from flask import request, current_app
from bson import ObjectId

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   UUID & RANDOM HELPERS
# ============================================================

def generate_uuid() -> str:
    """✅ ENHANCED: Generate secure UUID v4 string"""
    try:
        return str(uuid.uuid4())
    except Exception as e:
        logger.error(f"[UUID GENERATE] Error: {e}")
        raise


def generate_random_hex(length: int = 32) -> str:
    """✅ ENHANCED: Generate secure random hex string"""
    try:
        if length < 1:
            raise ValueError("Length must be positive")
        
        # Each byte = 2 hex chars, so divide length by 2
        byte_length = (length + 1) // 2
        hex_string = secrets.token_hex(byte_length)
        
        return hex_string[:length]
    
    except Exception as e:
        logger.error(f"[HEX GENERATE] Error: {e}")
        raise


def generate_random_string(length: int = 32, charset: str = None) -> str:
    """✅ ENHANCED: Generate random alphanumeric string"""
    try:
        if length < 1:
            raise ValueError("Length must be positive")
        
        # Default: alphanumeric + underscore
        if charset is None:
            charset = string.ascii_letters + string.digits + "_-"
        
        return ''.join(secrets.choice(charset) for _ in range(length))
    
    except Exception as e:
        logger.error(f"[STRING GENERATE] Error: {e}")
        raise


def generate_token(prefix: str = "", length: int = 32) -> str:
    """✅ ENHANCED: Generate secure token with optional prefix"""
    try:
        token = generate_random_hex(length)
        
        if prefix:
            return f"{prefix}_{token}"
        
        return token
    
    except Exception as e:
        logger.error(f"[TOKEN GENERATE] Error: {e}")
        raise


def generate_otp(length: int = 6) -> str:
    """✅ ENHANCED: Generate one-time password (digits only)"""
    try:
        if length < 1:
            raise ValueError("Length must be positive")
        
        return ''.join(secrets.choice(string.digits) for _ in range(length))
    
    except Exception as e:
        logger.error(f"[OTP GENERATE] Error: {e}")
        raise


# ============================================================
#                   TIME / DATE HELPERS
# ============================================================

def now_utc() -> datetime:
    """✅ ENHANCED: Return current UTC timestamp"""
    try:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    
    except Exception as e:
        logger.error(f"[NOW UTC] Error: {e}")
        raise


def utc_timestamp() -> int:
    """✅ ENHANCED: Return Unix timestamp (seconds since epoch)"""
    try:
        return int(datetime.now(timezone.utc).timestamp())
    
    except Exception as e:
        logger.error(f"[UTC TIMESTAMP] Error: {e}")
        raise


def utc_timestamp_ms() -> int:
    """✅ ENHANCED: Return Unix timestamp in milliseconds"""
    try:
        return int(datetime.now(timezone.utc).timestamp() * 1000)
    
    except Exception as e:
        logger.error(f"[UTC TIMESTAMP MS] Error: {e}")
        raise


def isoformat(dt: Optional[datetime]) -> Optional[str]:
    """✅ ENHANCED: Convert datetime to ISO 8601 string safely"""
    try:
        if dt is None:
            return None
        
        if isinstance(dt, str):
            return dt
        
        if hasattr(dt, "isoformat"):
            return dt.isoformat()
        
        return str(dt)
    
    except Exception as e:
        logger.error(f"[ISOFORMAT] Error: {e}")
        return None


def parse_iso_datetime(date_string: str) -> Optional[datetime]:
    """✅ ENHANCED: Parse ISO 8601 string to datetime"""
    try:
        if not date_string or not isinstance(date_string, str):
            return None
        
        # Handle various ISO formats
        if "T" in date_string:
            # ISO 8601 format
            date_string = date_string.replace("Z", "+00:00")
            return datetime.fromisoformat(date_string)
        else:
            # Date only
            return datetime.fromisoformat(date_string)
    
    except Exception as e:
        logger.error(f"[PARSE ISO] Error: {e}")
        return None


def add_hours(dt: datetime, hours: int) -> datetime:
    """✅ ENHANCED: Add hours to datetime"""
    try:
        if not isinstance(dt, datetime):
            raise ValueError("dt must be datetime")
        
        return dt + timedelta(hours=hours)
    
    except Exception as e:
        logger.error(f"[ADD HOURS] Error: {e}")
        raise


def add_days(dt: datetime, days: int) -> datetime:
    """✅ ENHANCED: Add days to datetime"""
    try:
        if not isinstance(dt, datetime):
            raise ValueError("dt must be datetime")
        
        return dt + timedelta(days=days)
    
    except Exception as e:
        logger.error(f"[ADD DAYS] Error: {e}")
        raise


def add_minutes(dt: datetime, minutes: int) -> datetime:
    """✅ ENHANCED: Add minutes to datetime"""
    try:
        if not isinstance(dt, datetime):
            raise ValueError("dt must be datetime")
        
        return dt + timedelta(minutes=minutes)
    
    except Exception as e:
        logger.error(f"[ADD MINUTES] Error: {e}")
        raise


def is_expired(expiry_time: datetime) -> bool:
    """✅ ENHANCED: Check if datetime has expired"""
    try:
        if not isinstance(expiry_time, datetime):
            return True
        
        return now_utc() > expiry_time
    
    except Exception as e:
        logger.error(f"[IS EXPIRED] Error: {e}")
        return True


def time_until_expiry(expiry_time: datetime) -> int:
    """✅ ENHANCED: Get seconds until datetime expires"""
    try:
        if not isinstance(expiry_time, datetime):
            return 0
        
        delta = expiry_time - now_utc()
        return max(0, int(delta.total_seconds()))
    
    except Exception as e:
        logger.error(f"[TIME UNTIL EXPIRY] Error: {e}")
        return 0


def format_time_ago(dt: datetime) -> str:
    """✅ ENHANCED: Format datetime as 'X time ago' string"""
    try:
        if not isinstance(dt, datetime):
            return "unknown"
        
        delta = now_utc() - dt
        seconds = int(delta.total_seconds())
        
        if seconds < 60:
            return f"{seconds}s ago"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes}m ago"
        elif seconds < 86400:
            hours = seconds // 3600
            return f"{hours}h ago"
        elif seconds < 604800:
            days = seconds // 86400
            return f"{days}d ago"
        else:
            return dt.strftime("%Y-%m-%d")
    
    except Exception as e:
        logger.error(f"[FORMAT TIME AGO] Error: {e}")
        return "unknown"


# ============================================================
#                   CLIENT INFO HELPERS
# ============================================================

def get_client_ip() -> str:
    """
    ✅ ENHANCED: Extract client IP behind proxies/load balancers
    
    Trust order:
      1. Cloudflare (CF-Connecting-IP)
      2. X-Forwarded-For chain (first IP)
      3. X-Real-IP
      4. request.remote_addr
    """
    try:
        # ✅ ENHANCED: Cloudflare IP
        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip and _is_valid_ip(cf_ip):
            logger.debug(f"[CLIENT IP] Cloudflare: {cf_ip}")
            return cf_ip
        
        # ✅ ENHANCED: X-Forwarded-For chain
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take first IP from chain
            client_ip = forwarded_for.split(",")[0].strip()
            if _is_valid_ip(client_ip):
                logger.debug(f"[CLIENT IP] X-Forwarded-For: {client_ip}")
                return client_ip
        
        # ✅ ENHANCED: X-Real-IP
        real_ip = request.headers.get("X-Real-IP")
        if real_ip and _is_valid_ip(real_ip):
            logger.debug(f"[CLIENT IP] X-Real-IP: {real_ip}")
            return real_ip
        
        # ✅ ENHANCED: Fallback to remote_addr
        client_ip = request.remote_addr or "0.0.0.0"
        logger.debug(f"[CLIENT IP] Remote addr: {client_ip}")
        return client_ip
    
    except Exception as e:
        logger.error(f"[CLIENT IP] Error: {e}")
        return "0.0.0.0"


def _is_valid_ip(ip: str) -> bool:
    """✅ ENHANCED: Validate IP address format"""
    try:
        import ipaddress
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def get_user_agent() -> str:
    """✅ ENHANCED: Extract user agent string"""
    try:
        ua = request.headers.get("User-Agent", "Unknown")
        return ua[:500]  # Limit length
    
    except Exception as e:
        logger.error(f"[USER AGENT] Error: {e}")
        return "Unknown"


def get_client_info() -> Dict[str, str]:
    """✅ ENHANCED: Extract comprehensive client information"""
    try:
        return {
            "ip_address": get_client_ip(),
            "user_agent": get_user_agent(),
            "referer": request.headers.get("Referer", ""),
            "accept_language": request.headers.get("Accept-Language", ""),
            "timestamp": isoformat(now_utc()),
        }
    
    except Exception as e:
        logger.error(f"[CLIENT INFO] Error: {e}")
        return {
            "ip_address": "0.0.0.0",
            "user_agent": "Unknown",
            "timestamp": isoformat(now_utc()),
        }


# ============================================================
#                   SAFE SERIALIZATION HELPERS
# ============================================================

def safe_value(value: Any) -> Any:
    """✅ ENHANCED: Serialize single value into JSON-safe form"""
    try:
        # Handle MongoDB ObjectId
        if isinstance(value, ObjectId):
            return str(value)
        
        # Handle datetime
        if isinstance(value, datetime):
            return value.isoformat()
        
        # Handle bytes
        if isinstance(value, (bytes, bytearray)):
            return value.decode(errors="ignore")
        
        # Handle dict
        if isinstance(value, dict):
            return safe_dict(value)
        
        # Handle list
        if isinstance(value, list):
            return [safe_value(v) for v in value]
        
        # Handle Enum
        if hasattr(value, "value"):
            return value.value
        
        # Return as-is for primitive types
        return value
    
    except Exception as e:
        logger.error(f"[SAFE VALUE] Error: {e}")
        return str(value)


def safe_dict(obj: Dict) -> Dict:
    """
    ✅ ENHANCED: Safely convert MongoDB dict to JSON-serializable dict
    
    Handles:
      - ObjectId → string
      - datetime → ISO 8601
      - bytes → decoded string
      - Nested dicts
      - Lists with mixed types
      - Enums
    """
    try:
        if not isinstance(obj, dict):
            return {}
        
        result = {}
        
        for key, value in obj.items():
            try:
                # Skip private fields
                if str(key).startswith("_"):
                    continue
                
                # Recursively handle dicts
                if isinstance(value, dict):
                    result[key] = safe_dict(value)
                
                # Handle lists
                elif isinstance(value, list):
                    result[key] = [
                        safe_dict(v) if isinstance(v, dict) else safe_value(v)
                        for v in value
                    ]
                
                # Handle other types
                else:
                    result[key] = safe_value(value)
            
            except Exception as e:
                logger.warning(f"[SAFE DICT] Error serializing {key}: {e}")
                continue
        
        return result
    
    except Exception as e:
        logger.error(f"[SAFE DICT] Error: {e}")
        return {}


def safe_json_dumps(obj: Any, indent: int = None) -> str:
    """✅ ENHANCED: Safely dump object to JSON string"""
    try:
        import json
        
        if isinstance(obj, dict):
            obj = safe_dict(obj)
        
        return json.dumps(obj, indent=indent, default=str)
    
    except Exception as e:
        logger.error(f"[JSON DUMPS] Error: {e}")
        return "{}"


# ============================================================
#                   STRING UTILITIES
# ============================================================

def slugify(text: str) -> str:
    """✅ ENHANCED: Convert text to URL-friendly slug"""
    try:
        if not isinstance(text, str):
            return ""
        
        import re
        
        # Convert to lowercase
        text = text.lower()
        
        # Replace spaces with hyphens
        text = re.sub(r'\s+', '-', text)
        
        # Remove non-alphanumeric except hyphens
        text = re.sub(r'[^a-z0-9-]', '', text)
        
        # Remove consecutive hyphens
        text = re.sub(r'-+', '-', text)
        
        # Strip leading/trailing hyphens
        text = text.strip('-')
        
        return text
    
    except Exception as e:
        logger.error(f"[SLUGIFY] Error: {e}")
        return ""


def truncate(text: str, length: int = 100, suffix: str = "...") -> str:
    """✅ ENHANCED: Truncate text with optional suffix"""
    try:
        if not isinstance(text, str) or length < 1:
            return ""
        
        if len(text) <= length:
            return text
        
        return text[:length - len(suffix)] + suffix
    
    except Exception as e:
        logger.error(f"[TRUNCATE] Error: {e}")
        return text


def strip_html(html: str) -> str:
    """✅ ENHANCED: Remove HTML tags from string"""
    try:
        import re
        
        if not html or not isinstance(html, str):
            return ""
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', html)
        
        # Decode HTML entities
        import html as html_module
        text = html_module.unescape(text)
        
        return text
    
    except Exception as e:
        logger.error(f"[STRIP HTML] Error: {e}")
        return str(html)


def normalize_email(email: str) -> str:
    """✅ ENHANCED: Normalize email address"""
    try:
        if not email or not isinstance(email, str):
            return ""
        
        # Lowercase
        email = email.lower().strip()
        
        # Remove whitespace
        email = email.replace(" ", "")
        
        return email
    
    except Exception as e:
        logger.error(f"[NORMALIZE EMAIL] Error: {e}")
        return ""


def normalize_username(username: str) -> str:
    """✅ ENHANCED: Normalize username"""
    try:
        if not username or not isinstance(username, str):
            return ""
        
        # Lowercase
        username = username.lower().strip()
        
        # Keep only alphanumeric, underscore, hyphen
        import re
        username = re.sub(r'[^a-z0-9_-]', '', username)
        
        return username
    
    except Exception as e:
        logger.error(f"[NORMALIZE USERNAME] Error: {e}")
        return ""


# ============================================================
#                   HASHING & CRYPTOGRAPHY
# ============================================================

def hash_sha256(data: str) -> str:
    """✅ ENHANCED: SHA-256 hash string"""
    try:
        if not isinstance(data, str):
            data = str(data)
        
        return hashlib.sha256(data.encode()).hexdigest()
    
    except Exception as e:
        logger.error(f"[HASH SHA256] Error: {e}")
        raise


def hash_sha256_file(filepath: str) -> str:
    """✅ ENHANCED: SHA-256 hash file"""
    try:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")
        
        sha256 = hashlib.sha256()
        
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256.update(chunk)
        
        return sha256.hexdigest()
    
    except Exception as e:
        logger.error(f"[HASH FILE] Error: {e}")
        raise


def hmac_sha256(message: str, secret: str) -> str:
    """✅ ENHANCED: HMAC-SHA256 signature"""
    try:
        if not isinstance(message, str):
            message = str(message)
        
        if not isinstance(secret, str):
            secret = str(secret)
        
        return hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
    
    except Exception as e:
        logger.error(f"[HMAC SHA256] Error: {e}")
        raise


def verify_hmac(message: str, signature: str, secret: str, tolerance: float = 0) -> bool:
    """✅ ENHANCED: Verify HMAC signature with timing-safe comparison"""
    try:
        expected = hmac_sha256(message, secret)
        
        # Timing-safe comparison
        return hmac.compare_digest(expected, signature)
    
    except Exception as e:
        logger.error(f"[VERIFY HMAC] Error: {e}")
        return False


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_email_format(email: str) -> bool:
    """✅ ENHANCED: Validate email format (RFC 5322 simplified)"""
    try:
        import re
        
        if not email or not isinstance(email, str):
            return False
        
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    except Exception as e:
        logger.error(f"[VALIDATE EMAIL] Error: {e}")
        return False


def validate_username_format(username: str) -> bool:
    """✅ ENHANCED: Validate username format"""
    try:
        import re
        
        if not username or not isinstance(username, str):
            return False
        
        # 3-30 chars, alphanumeric + underscore/hyphen
        pattern = r'^[a-zA-Z0-9_-]{3,30}$'
        return re.match(pattern, username) is not None
    
    except Exception as e:
        logger.error(f"[VALIDATE USERNAME] Error: {e}")
        return False


def validate_url(url: str) -> bool:
    """✅ ENHANCED: Validate URL format"""
    try:
        if not url or not isinstance(url, str):
            return False
        
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    
    except Exception as e:
        logger.error(f"[VALIDATE URL] Error: {e}")
        return False


def is_safe_redirect_url(url: str, base_url: str = None) -> bool:
    """✅ ENHANCED: Check if URL is safe for redirect"""
    try:
        if not url or not isinstance(url, str):
            return False
        
        # Must be relative or same domain
        if url.startswith(("http://", "https://", "//")):
            if base_url and url.startswith(base_url):
                return True
            return False
        
        # Relative URLs are safe
        return url.startswith("/")
    
    except Exception as e:
        logger.error(f"[VALIDATE REDIRECT] Error: {e}")
        return False


# ============================================================
#                   ERROR HANDLING DECORATORS
# ============================================================

def handle_errors(logger_obj=None, default_return=None):
    """✅ ENHANCED: Decorator to catch and log errors"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                log = logger_obj or logger
                log.error(f"[{func.__name__.upper()}] Error: {e}")
                return default_return
        
        return wrapper
    
    return decorator


# ============================================================
#                   DEBUGGING HELPERS
# ============================================================

def log_function_call(func):
    """✅ ENHANCED: Decorator to log function calls with timing"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = now_utc()
        logger.debug(f"[CALL] {func.__name__} with args={args}, kwargs={kwargs}")
        
        try:
            result = func(*args, **kwargs)
            duration = (now_utc() - start_time).total_seconds()
            logger.debug(f"[RETURN] {func.__name__} completed in {duration:.3f}s")
            return result
        
        except Exception as e:
            duration = (now_utc() - start_time).total_seconds()
            logger.error(f"[ERROR] {func.__name__} failed after {duration:.3f}s: {e}")
            raise
    
    return wrapper


__all__ = [
    # UUID & Random
    "generate_uuid",
    "generate_random_hex",
    "generate_random_string",
    "generate_token",
    "generate_otp",
    
    # Time & Date
    "now_utc",
    "utc_timestamp",
    "utc_timestamp_ms",
    "isoformat",
    "parse_iso_datetime",
    "add_hours",
    "add_days",
    "add_minutes",
    "is_expired",
    "time_until_expiry",
    "format_time_ago",
    
    # Client Info
    "get_client_ip",
    "get_user_agent",
    "get_client_info",
    
    # Serialization
    "safe_value",
    "safe_dict",
    "safe_json_dumps",
    
    # String Utilities
    "slugify",
    "truncate",
    "strip_html",
    "normalize_email",
    "normalize_username",
    
    # Hashing & Crypto
    "hash_sha256",
    "hash_sha256_file",
    "hmac_sha256",
    "verify_hmac",
    
    # Validation
    "validate_email_format",
    "validate_username_format",
    "validate_url",
    "is_safe_redirect_url",
    
    # Decorators
    "handle_errors",
    "log_function_call",
]
