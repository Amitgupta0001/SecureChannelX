# security/hardening.py

import os
import re
import ipaddress
from functools import wraps
from datetime import datetime, timedelta
from collections import defaultdict

from flask import request, jsonify, current_app


# -------------------------------------------------------------------
# Optional logging function (replace with your real audit logger)
# -------------------------------------------------------------------
def log_security_event(event_type, user_id, ip, message):
    current_app.logger.warning(
        f"[SECURITY] {event_type} | user={user_id} | ip={ip} | msg={message}"
    )


# -------------------------------------------------------------------
# Security Hardening Layer
# -------------------------------------------------------------------
class SecurityHardener:
    def __init__(self, app, redis_client):
        self.app = app
        self.redis = redis_client
        self.suspicious_ips = set()
        self.failed_attempts = defaultdict(int)

        # apply headers immediately
        self.setup_security_headers()

    # -------------------------------------------------------------------
    # 1. SECURITY HEADERS
    # -------------------------------------------------------------------
    def setup_security_headers(self):
        """Apply global security headers"""

        @self.app.after_request
        def apply_headers(response):
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "no-referrer"
            response.headers["Permissions-Policy"] = (
                "geolocation=(), microphone=(), camera=()"
            )
            # Strict CSP for production
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self'; "
                "img-src 'self' data:; "
                "object-src 'none'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
            )
            return response

    # -------------------------------------------------------------------
    # 2. RATE LIMITING (IP-based)
    # -------------------------------------------------------------------
    def rate_limit_by_ip(self, requests_per_minute=60):
        """
        Redis-based rate limiter.
        """

        def decorator(f):
            @wraps(f)
            def wrapper(*args, **kwargs):

                ip = request.remote_addr or "unknown"
                key = f"rl:{ip}"

                try:
                    # atomic pipeline
                    pipeline = self.redis.pipeline()
                    pipeline.incr(key)
                    pipeline.expire(key, 60)
                    count, _ = pipeline.execute()

                    if int(count) > requests_per_minute:
                        log_security_event(
                            "rate_limit_exceeded", None, ip, "Too many requests"
                        )
                        return jsonify({"error": "Rate limit exceeded"}), 429
                except Exception as e:
                    current_app.logger.error(f"Rate limiter error: {e}")

                return f(*args, **kwargs)

            return wrapper

        return decorator

    # -------------------------------------------------------------------
    # 3. BRUTE FORCE DETECTION
    # -------------------------------------------------------------------
    def detect_brute_force(self, user_id, ip_address):
        """
        Track per-IP + per-user failed login attempts
        """
        key = f"bruteforce:{ip_address}:{user_id}"

        attempts = self.redis.incr(key)
        if attempts == 1:
            self.redis.expire(key, 900)  # reset in 15 minutes

        if attempts > 5:
            # Block IP for 1 hour
            block_key = f"blocked_ip:{ip_address}"
            self.redis.setex(block_key, 3600, 1)

            log_security_event(
                "brute_force_blocked",
                user_id,
                ip_address,
                f"Blocked after {attempts} failed attempts",
            )

            return True  # IP blocked

        return False

    # -------------------------------------------------------------------
    # 4. IP BLOCK CHECKER
    # -------------------------------------------------------------------
    def is_ip_blocked(self, ip):
        """Check if IP is blocked"""
        return bool(self.redis.get(f"blocked_ip:{ip}"))

    # -------------------------------------------------------------------
    # 5. SANITIZE INPUT
    # -------------------------------------------------------------------
    def sanitize_input(self, value):
        """Basic sanitizer for text input"""
        if not isinstance(value, str):
            return value

        # Remove dangerous characters
        safe = re.sub(r"[<>;'\"`]|(--)", "", value)

        # Limit size
        return safe[:1000]

    # -------------------------------------------------------------------
    # 6. FILE UPLOAD VALIDATION
    # -------------------------------------------------------------------
    def validate_file_upload(self, file):
        """
        Validate file type & size safely
        """
        allowed_ext = {"jpg", "jpeg", "png", "gif", "pdf", "txt"}
        max_size = 10 * 1024 * 1024  # 10MB

        if not file.filename:
            return False, "Missing filename"

        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext not in allowed_ext:
            return False, "File type not allowed"

        # Read safely without exhausting memory
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)

        if size > max_size:
            return False, "File too large"

        return True, "OK"

    # -------------------------------------------------------------------
    # 7. IP VALIDATION
    # -------------------------------------------------------------------
    def validate_ip(self, ip):
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False


# -------------------------------------------------------------------
# Key Management Service (AES key rotation etc.)
# -------------------------------------------------------------------
class KeyManagementService:
    def __init__(self, hsm, db=None):
        self.hsm = hsm
        self.db = db or get_db()
        self.rotation_schedule = {}  # key_id -> next_rotation_time

    def schedule_rotation(self, key_id, interval_days=30):
        self.rotation_schedule[key_id] = datetime.utcnow() + timedelta(days=interval_days)

    def rotate_encryption_keys(self):
        """Rotate keys that are due for rotation."""
        now = datetime.utcnow()

        for key_id, next_rotation_time in list(self.rotation_schedule.items()):
            if now >= next_rotation_time:
                self._rotate_key(key_id)
                self.schedule_rotation(key_id)  # re-schedule for next month

    def _rotate_key(self, key_id):
        """Rotate a single AES key inside the HSM"""
        new_key = os.urandom(32)

        # RE-ENCRYPT anything that uses this key (placeholder)
        self._reencrypt_data(key_id, new_key)

        # Update key in HSM
        self.hsm.store_key(key_id, new_key)

        log_security_event("key_rotated", None, None, f"Rotated key {key_id}")

    def _reencrypt_data(self, key_id, new_key):
        """
        Placeholder: Update encrypted fields that were using the old key.
        In production: iterate all encrypted records and re-encrypt them.
        """
        pass
