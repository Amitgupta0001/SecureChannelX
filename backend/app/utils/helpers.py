# backend/app/utils/helpers.py

import uuid
import datetime
from flask import request
from bson import ObjectId


# -------------------------------------------------------
#  UUID & Random Helpers
# -------------------------------------------------------

def generate_uuid():
    """Generate a secure UUID v4 string."""
    return str(uuid.uuid4())


def generate_random_hex(length=32):
    """Generate a secure random hex string."""
    import secrets
    return secrets.token_hex(length // 2)


# -------------------------------------------------------
#  Time / Date Helpers
# -------------------------------------------------------

def now_utc():
    """Return current UTC timestamp."""
    return datetime.datetime.utcnow()


def isoformat(dt):
    """Convert datetime into ISO string safely."""
    if dt is None:
        return None
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


# -------------------------------------------------------
#  Client Info Helpers
# -------------------------------------------------------

def get_client_ip():
    """
    Returns the best possible client IP address behind proxies, load balancers, etc.
    Order of trust:
      - Cloudflare header
      - X-Forwarded-For chain
      - X-Real-IP
      - request.remote_addr
    """

    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # If multiple proxies: client_ip, proxy1, proxy2
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    return request.remote_addr


def get_user_agent():
    """Returns client device/user-agent string."""
    return request.headers.get("User-Agent", "Unknown")


# -------------------------------------------------------
#  Safe Serialization Helpers
# -------------------------------------------------------

def safe_value(v):
    """Serialize a single value into JSON-safe form."""
    if isinstance(v, ObjectId):
        return str(v)
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if isinstance(v, (bytes, bytearray)):
        return v.decode(errors="ignore")
    return v


def safe_dict(obj):
    """
    Safely convert MongoDB dict into JSON serializable dict.
    Handles:
      - ObjectId
      - datetime
      - nested dicts
      - lists
      - bytes
    """

    out = {}

    for key, value in obj.items():

        if isinstance(value, dict):
            out[key] = safe_dict(value)

        elif isinstance(value, list):
            out[key] = [safe_value(i) if not isinstance(i, dict) else safe_dict(i) for i in value]

        else:
            out[key] = safe_value(value)

    return out
