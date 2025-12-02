"""
backend/app/security/hardening.py

Production-grade security hardening layer for SecureChannelX.
"""

import os
import re
import json
import logging
import hashlib
import hmac
import secrets
import ipaddress
from functools import wraps
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Tuple, Optional, Dict, Any
from urllib.parse import urlparse

from flask import request, jsonify, current_app

# Cryptography – modern PBKDF2 implementation
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ============================================================
#                   SECURITY CONSTANTS
# ============================================================

DEFAULT_RATE_LIMIT = 60
AUTH_RATE_LIMIT = 5
API_RATE_LIMIT = 1000
BRUTE_FORCE_THRESHOLD = 5
BRUTE_FORCE_WINDOW = 900
BRUTE_FORCE_LOCKOUT = 3600
IP_BLOCK_DURATION = 86400
SUSPICIOUS_LOGIN_THRESHOLD = 3
MAX_REQUEST_SIZE = 1024 * 1024
MAX_FILE_SIZE = 50 * 1024 * 1024


# ============================================================
#                   AUDIT LOGGING
# ============================================================

class SecurityAuditLogger:
    COLLECTION = "security_audit_logs"

    def __init__(self, db=None):
        from app.database import get_db
        self.db = db if db is not None else get_db()
        try:
            self.db[self.COLLECTION].create_index([("timestamp", -1)])
            self.db[self.COLLECTION].create_index([("event_type", 1)])
            self.db[self.COLLECTION].create_index([("ip_address", 1)])
            self.db[self.COLLECTION].create_index([("user_id", 1)])
        except Exception as e:
            logger.warning(f"[AUDIT] Index creation failed: {e}")

    def log(self, event_type: str, user_id: str = None, ip_address: str = None,
            severity: str = "INFO", message: str = "", details: Dict = None):

        try:
            doc = {
                "event_type": event_type,
                "user_id": user_id,
                "ip_address": ip_address or request.remote_addr,
                "severity": severity,
                "message": message,
                "details": details or {},
                "user_agent": request.headers.get("User-Agent"),
                "path": request.path,
                "method": request.method,
                "timestamp": datetime.utcnow()
            }
            self.db[self.COLLECTION].insert_one(doc)

            if severity in ["CRITICAL", "HIGH"]:
                logger.critical(f"[SECURITY] {event_type}: {message}")
            else:
                logger.warning(f"[SECURITY] {event_type}: {message}")

        except Exception as e:
            logger.error(f"[AUDIT] Failed to log: {e}")


audit_logger = SecurityAuditLogger()


# ============================================================
#                   RATE LIMITER
# ============================================================

class RateLimiter:
    COLLECTION = "rate_limits"

    def __init__(self, redis_client=None, db=None):
        from app.database import get_db
        self.redis = redis_client
        self.db = db if db is not None else get_db()
        self.local_cache = defaultdict(lambda: {"count": 0, "reset_time": 0})

    def check_rate_limit(self, identifier: str, limit: int = DEFAULT_RATE_LIMIT, window: int = 60):
        try:
            if self.redis:
                return self._redis_check(identifier, limit, window)
            return self._local_check(identifier, limit, window)
        except Exception as e:
            logger.error(f"[RATE LIMIT] Check failed: {e}")
            return True, limit, 0

    def _redis_check(self, identifier: str, limit: int, window: int):
        key = f"rl:{identifier}"

        try:
            pipe = self.redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, window)
            count, _ = pipe.execute()

            count = int(count)
            remaining = max(0, limit - count)
            retry_after = self.redis.ttl(key) if count > limit else 0

            allowed = count <= limit

            if not allowed:
                audit_logger.log(
                    "RATE_LIMIT_EXCEEDED",
                    ip_address=identifier.split(":")[0],
                    severity="HIGH",
                    message=f"Rate limit exceeded",
                    details={"limit": limit, "count": count}
                )

            return allowed, remaining, retry_after

        except Exception as e:
            logger.error(f"[REDIS RATE LIMIT] {e}")
            return True, limit, 0

    def _local_check(self, identifier: str, limit: int, window: int):
        now = datetime.utcnow().timestamp()
        cache_entry = self.local_cache[identifier]

        if now > cache_entry["reset_time"]:
            cache_entry["count"] = 0
            cache_entry["reset_time"] = now + window

        cache_entry["count"] += 1
        allowed = cache_entry["count"] <= limit

        remaining = max(0, limit - cache_entry["count"])
        retry_after = int(cache_entry["reset_time"] - now) if not allowed else 0

        return allowed, remaining, retry_after


rate_limiter = RateLimiter()


# ============================================================
#                   BRUTE FORCE DETECTION
# ============================================================

class BruteForceDetector:
    COLLECTION = "brute_force_attempts"

    def __init__(self, redis_client=None, db=None):
        from app.database import get_db
        self.redis = redis_client
        self.db = db if db is not None else get_db()

    def record_failed_attempt(self, user_id: str, ip_address: str) -> bool:
        try:
            key = f"bf:{ip_address}:{user_id}"
            block_key = f"bf_blocked:{ip_address}"

            if self.redis:
                if self.redis.get(block_key):
                    audit_logger.log(
                        "BRUTE_FORCE_BLOCKED",
                        user_id=user_id,
                        ip_address=ip_address,
                        severity="CRITICAL",
                        message="Blocked IP attempted login"
                    )
                    return True

                attempts = self.redis.incr(key)
                self.redis.expire(key, BRUTE_FORCE_WINDOW)

                if attempts > BRUTE_FORCE_THRESHOLD:
                    self.redis.setex(block_key, BRUTE_FORCE_LOCKOUT, 1)
                    audit_logger.log(
                        "BRUTE_FORCE_DETECTED",
                        user_id=user_id,
                        ip_address=ip_address,
                        severity="CRITICAL",
                        message=f"Blocked after {attempts} failed attempts"
                    )
                    return True

            else:
                attempts = self.db[self.COLLECTION].count_documents({
                    "user_id": user_id,
                    "ip_address": ip_address,
                    "timestamp": {"$gte": datetime.utcnow() - timedelta(seconds=BRUTE_FORCE_WINDOW)}
                })

                if attempts >= BRUTE_FORCE_THRESHOLD:
                    audit_logger.log(
                        "BRUTE_FORCE_DETECTED",
                        user_id=user_id,
                        ip_address=ip_address,
                        severity="CRITICAL",
                        message=f"{attempts} failed attempts detected"
                    )
                    return True

                self.db[self.COLLECTION].insert_one({
                    "user_id": user_id,
                    "ip_address": ip_address,
                    "timestamp": datetime.utcnow()
                })

            return False

        except Exception as e:
            logger.error(f"[BRUTE FORCE] Detection failed: {e}")
            return False

    def record_successful_login(self, user_id: str, ip_address: str):
        try:
            key = f"bf:{ip_address}:{user_id}"
            if self.redis:
                self.redis.delete(key)
            else:
                self.db[self.COLLECTION].delete_many({"user_id": user_id, "ip_address": ip_address})

            audit_logger.log(
                "LOGIN_SUCCESS",
                user_id=user_id,
                ip_address=ip_address,
                message="Successful login"
            )
        except Exception as e:
            logger.error(f"[BRUTE FORCE] Clear attempts failed: {e}")

    def is_ip_blocked(self, ip_address: str) -> bool:
        try:
            block_key = f"bf_blocked:{ip_address}"
            if self.redis:
                return bool(self.redis.get(block_key))

            result = self.db["blocked_ips"].find_one({
                "ip_address": ip_address,
                "expires_at": {"$gt": datetime.utcnow()}
            })

            return bool(result)

        except Exception as e:
            logger.error(f"[BRUTE FORCE] IP check failed: {e}")
            return False


brute_force_detector = BruteForceDetector()


# ============================================================
#                   INPUT VALIDATION
# ============================================================

class InputValidator:

    SQL_PATTERNS = [
        r"(\b(UNION|SELECT|INSERT|DELETE|DROP|UPDATE)\b)",
        r"--|;|/\*|\*/",
    ]

    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"on\w+=",
        r"javascript:",
    ]

    @staticmethod
    def sanitize_string(value: str, max_length: int = 1000, allow_special: bool = False):
        if not isinstance(value, str):
            return ""

        value = value.strip().replace("\x00", "")
        if len(value) > max_length:
            value = value[:max_length]

        for pattern in InputValidator.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return ""

        if not allow_special:
            for pattern in InputValidator.SQL_PATTERNS:
                if re.search(pattern, value, re.IGNORECASE):
                    return ""
            value = re.sub(r"[<>;'\"`]", "", value)

        return value

    @staticmethod
    def validate_email(email: str) -> bool:
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$"
        return bool(re.match(pattern, email)) and len(email) <= 254

    @staticmethod
    def validate_url(url: str) -> bool:
        try:
            parsed = urlparse(url)
            return parsed.scheme in ["http", "https"] and bool(parsed.netloc)
        except:
            return False

    @staticmethod
    def validate_ip(ip: str) -> bool:
        try:
            ipaddress.ip_address(ip)
            return True
        except:
            return False

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        filename = os.path.basename(filename)
        filename = re.sub(r"[^a-zA-Z0-9._-]", "", filename)
        return filename[:255] or "file"


input_validator = InputValidator()


# ============================================================
#                   FILE UPLOAD VALIDATION
# ============================================================

class FileUploadValidator:

    ALLOWED_EXT = {
        "jpg", "jpeg", "png", "gif", "webp",
        "pdf", "txt", "docx", "xlsx"
    }

    FORBIDDEN_EXT = {
        "exe", "sh", "bat", "cmd", "com", "scr", "js", "vbs"
    }

    MAGIC_BYTES = {
        "jpg": [b"\xff\xd8"],
        "png": [b"\x89PNG"],
        "gif": [b"GIF87a", b"GIF89a"],
        "pdf": [b"%PDF"],
        "txt": None,
    }

    def __init__(self, max_file_size=MAX_FILE_SIZE):
        self.max_file_size = max_file_size

    def validate(self, file, filename: str):
        if not file or not filename:
            return False, "Missing file or filename"

        filename = input_validator.sanitize_filename(filename)
        ext = filename.split(".")[-1].lower()

        if ext in self.FORBIDDEN_EXT:
            return False, "File type forbidden"

        if ext not in self.ALLOWED_EXT:
            return False, "File type not allowed"

        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)

        if size == 0:
            return False, "File is empty"

        if size > self.max_file_size:
            return False, "File too large"

        header = file.read(16)
        file.seek(0)

        if self.MAGIC_BYTES.get(ext) is not None:
            if not any(header.startswith(m) for m in self.MAGIC_BYTES[ext]):
                return False, "Magic bytes mismatch"

        return True, "OK"


file_upload_validator = FileUploadValidator()


# ============================================================
#                   SECURITY HEADERS
# ============================================================

class SecurityHeadersManager:

    @staticmethod
    def apply(app):

        @app.after_request
        def set_headers(response):
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Referrer-Policy"] = "same-origin"

            response.headers["Permissions-Policy"] = (
                "geolocation=(), microphone=(), camera=()"
            )

            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "frame-ancestors 'none'"
            )

            response.headers.pop("Server", None)
            response.headers["X-Powered-By"] = "SecureChannelX"

            return response

        return app


# ============================================================
#                   KEY MANAGEMENT
# ============================================================

class KeyManagementService:
    COLLECTION = "key_management"

    def __init__(self, hsm=None, db=None):
        from app.database import get_db
        self.hsm = hsm
        self.db = db if db is not None else get_db()

        try:
            self.db[self.COLLECTION].create_index("key_id", unique=True)
            self.db[self.COLLECTION].create_index("expires_at")
        except:
            pass

    def create_key(self, key_id: str, expires_days: int = 90):
        data = secrets.token_bytes(32)
        now = datetime.utcnow()

        doc = {
            "key_id": key_id,
            "key_type": "AES256",
            "created_at": now,
            "expires_at": now + timedelta(days=expires_days),
            "rotation_count": 0,
            "status": "active",
        }

        self.db[self.COLLECTION].insert_one(doc)

        return doc


key_management_service = KeyManagementService()


# ============================================================
#                   MAIN HARDENER CLASS
# ============================================================

class SecurityHardener:

    def __init__(self, app, redis_client=None, db=None):
        from app.database import get_db
        self.app = app
        self.redis = redis_client
        self.db = db if db is not None else get_db()
        self.rate_limiter = RateLimiter(redis_client, db)
        self.brute_force_detector = BruteForceDetector(redis_client, db)

        self._setup_security_headers()
        self._setup_request_validation()
        self._setup_error_handlers()

    def _setup_security_headers(self):
        SecurityHeadersManager.apply(self.app)

    def _setup_request_validation(self):

        @self.app.before_request
        def validate():
            ip = request.remote_addr

            if not input_validator.validate_ip(ip):
                return jsonify({"error": "Invalid IP"}), 400

            if self.brute_force_detector.is_ip_blocked(ip):
                audit_logger.log("BLOCKED_REQUEST", ip_address=ip, severity="HIGH")
                return jsonify({"error": "Access denied"}), 403

            if request.content_length and request.content_length > MAX_REQUEST_SIZE:
                audit_logger.log(
                    "OVERSIZED_REQUEST",
                    ip_address=ip,
                    severity="MEDIUM",
                )
                return jsonify({"error": "Request too large"}), 413

    def _setup_error_handlers(self):

        @self.app.errorhandler(404)
        def not_found(e):
            return jsonify({"error": "Not found"}), 404

        @self.app.errorhandler(500)
        def server_error(e):
            audit_logger.log("INTERNAL_ERROR", severity="CRITICAL", message=str(e))
            return jsonify({"error": "Internal server error"}), 500

    def rate_limit(self, limit: int = DEFAULT_RATE_LIMIT, window: int = 60):
        def decorator(f):
            @wraps(f)
            def wrapper(*args, **kwargs):
                ip = request.remote_addr
                allowed, remaining, retry = self.rate_limiter.check_rate_limit(
                    f"ip:{ip}", limit, window
                )

                if not allowed:
                    audit_logger.log(
                        "RATE_LIMIT_EXCEEDED",
                        ip_address=ip,
                        severity="MEDIUM",
                    )
                    return jsonify({"error": "Rate limit exceeded"}), 429

                return f(*args, **kwargs)

            return wrapper
        return decorator


def require_https(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not request.is_secure and current_app.config.get("ENFORCE_HTTPS", True):
            audit_logger.log("HTTP_REQUEST", severity="MEDIUM")
            return jsonify({"error": "HTTPS required"}), 400
        return f(*args, **kwargs)
    return wrapper


def validate_json(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if request.method in ["POST", "PUT", "PATCH"]:
            if not request.is_json:
                return jsonify({"error": "Content-Type must be application/json"}), 400
        return f(*args, **kwargs)
    return wrapper


def init_security(app, redis_client=None, db=None):
    return SecurityHardener(app, redis_client, db)
