# backend/app/utils/constants.py
"""
SecureChannelX Constants (Enhanced Version)
--------------------------------------------
Centralized configuration for:
  - User & Auth limits
  - Messaging limits
  - File upload limits
  - Rate limiting
  - Encryption parameters
  - Localization settings
  - Error messages
  - HTTP status codes
  - Cache timeouts
"""

from enum import Enum
from datetime import timedelta

# ============================================================
#                   USER & AUTH CONSTANTS
# ============================================================

# ✅ ENHANCED: Avatar configuration
DEFAULT_AVATAR_URL = "https://cdn.securechannelx.com/avatars/default.png"
AVATAR_UPLOAD_PATH = "uploads/avatars"
MAX_AVATAR_SIZE_MB = 5

# ✅ ENHANCED: Username configuration
MAX_USERNAME_LENGTH = 30
MIN_USERNAME_LENGTH = 3
USERNAME_PATTERN = r"^[a-zA-Z0-9_-]+$"  # Alphanumeric, underscore, hyphen

# ✅ ENHANCED: Password configuration
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
REQUIRE_UPPERCASE = True
REQUIRE_LOWERCASE = True
REQUIRE_NUMBERS = True
REQUIRE_SPECIAL_CHARS = True

# ✅ ENHANCED: Email configuration
MAX_EMAIL_LENGTH = 254
EMAIL_VERIFICATION_REQUIRED = True
EMAIL_VERIFICATION_EXPIRY_HOURS = 24

# ✅ ENHANCED: Phone number configuration
ALLOW_PHONE_AUTH = True
PHONE_VERIFICATION_REQUIRED = True
PHONE_VERIFICATION_EXPIRY_MINUTES = 15

# ✅ ENHANCED: Token configuration
TOKEN_EXPIRY_HOURS = 24
REFRESH_TOKEN_EXPIRY_DAYS = 30
SESSION_KEY_ROTATION_MINUTES = 15
OTP_EXPIRY_MINUTES = 5
OTP_LENGTH = 6

# ✅ ENHANCED: Device configuration
MAX_DEVICES_PER_USER = 10
DEVICE_INACTIVITY_TIMEOUT_DAYS = 30

# ✅ ENHANCED: Login attempt tracking
MAX_LOGIN_ATTEMPTS = 5
LOGIN_ATTEMPT_LOCKOUT_MINUTES = 15


# ============================================================
#                   MESSAGING CONSTANTS
# ============================================================

# ✅ ENHANCED: Message limits
MAX_MESSAGE_LENGTH = 4096  # Characters
MAX_MESSAGE_BULK_SIZE = 100  # Batch operations
MESSAGE_RETENTION_DAYS = 365  # Default retention
MESSAGE_EDIT_WINDOW_HOURS = 1
MESSAGE_DELETE_WINDOW_HOURS = 24

# ✅ ENHANCED: Message types
ALLOWED_MESSAGE_TYPES = [
    "text",
    "file",
    "image",
    "video",
    "audio",
    "poll",
    "system",
    "reply",
    "thread",
    "reaction"
]

# ✅ ENHANCED: Group/Chat limits
MIN_GROUP_MEMBERS = 2
MAX_GROUP_MEMBERS = 1024
MAX_GROUP_NAME_LENGTH = 256
MAX_GROUP_DESCRIPTION_LENGTH = 1024

# ✅ ENHANCED: Thread limits
MAX_THREAD_DEPTH = 10
MAX_THREAD_SIZE = 1000
MAX_PINNED_MESSAGES = 20

# ✅ ENHANCED: Reaction limits
MAX_REACTIONS_PER_MESSAGE = 100
ALLOWED_EMOJIS = [
    "👍", "❤️", "😂", "😮", "😢", "🔥", "👏",
    "🎉", "😍", "👌", "✨", "💯", "🙏", "😎"
]


# ============================================================
#                   FILE UPLOAD CONSTANTS
# ============================================================

# ✅ ENHANCED: General file limits
MAX_FILE_SIZE_MB = 100
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

# ✅ ENHANCED: Image configuration
MAX_IMAGE_SIZE_MB = 10
ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"]
IMAGE_COMPRESSION_QUALITY = 85

# ✅ ENHANCED: Video configuration
MAX_VIDEO_SIZE_MB = 100
ALLOWED_VIDEO_FORMATS = ["mp4", "webm", "mov", "avi", "mkv"]
VIDEO_MAX_DURATION_SECONDS = 3600  # 1 hour

# ✅ ENHANCED: Audio configuration
MAX_AUDIO_SIZE_MB = 25
ALLOWED_AUDIO_FORMATS = ["mp3", "wav", "ogg", "m4a", "aac", "flac"]
AUDIO_MAX_DURATION_SECONDS = 600  # 10 minutes

# ✅ ENHANCED: Document configuration
MAX_DOCUMENT_SIZE_MB = 50
ALLOWED_DOCUMENT_FORMATS = [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "zip", "rar", "7z", "csv", "json"
]

# ✅ ENHANCED: Upload storage configuration
UPLOAD_BASE_PATH = "uploads"
UPLOAD_TEMP_PATH = "uploads/temp"
UPLOAD_STORAGE_BACKEND = "local"  # local | s3 | gcs


# ============================================================
#                   ENCRYPTION CONSTANTS
# ============================================================

# ✅ ENHANCED: E2E encryption
ENCRYPTION_TYPE = "AES-256-GCM"
ENCRYPTION_KEY_SIZE = 32  # 256 bits
NONCE_SIZE = 12  # 96 bits for GCM
TAG_SIZE = 16  # 128 bits

# ✅ ENHANCED: X3DH Key Exchange
X3DH_ALGORITHM = "X3DH"
ELLIPTIC_CURVE = "Curve25519"
SIGNING_ALGORITHM = "Ed25519"

# ✅ ENHANCED: Post-Quantum
POST_QUANTUM_ENABLED = True
KYBER_KEY_SIZE = 1024  # Kyber1024

# ✅ ENHANCED: Key rotation
KEY_ROTATION_INTERVAL_DAYS = 90
PREKEY_ROTATION_INTERVAL_DAYS = 30
OTK_ROTATION_THRESHOLD = 10  # Rotate when < 10 available


# ============================================================
#                   RATE LIMITING CONSTANTS
# ============================================================

# ✅ ENHANCED: Authentication rate limits
RATE_LIMIT_LOGIN = "10/minute"
RATE_LIMIT_REGISTER = "5/minute"
RATE_LIMIT_PASSWORD_RESET = "3/minute"
RATE_LIMIT_VERIFY_EMAIL = "5/minute"

# ✅ ENHANCED: Message rate limits
RATE_LIMIT_SEND_MESSAGE = "100/minute"
RATE_LIMIT_EDIT_MESSAGE = "50/minute"
RATE_LIMIT_DELETE_MESSAGE = "30/minute"
RATE_LIMIT_SEARCH_MESSAGES = "30/minute"

# ✅ ENHANCED: Call rate limits
RATE_LIMIT_INITIATE_CALL = "100/hour"
RATE_LIMIT_END_CALL = "1000/hour"

# ✅ ENHANCED: File upload rate limits
RATE_LIMIT_UPLOAD_FILE = "20/minute"
RATE_LIMIT_UPLOAD_SIZE = "500/hour"  # MB per hour

# ✅ ENHANCED: API rate limits
RATE_LIMIT_DEFAULT = "1000/hour"
RATE_LIMIT_API_GENERAL = "1000/hour"
RATE_LIMIT_API_AUTH = "100/hour"
RATE_LIMIT_API_PREMIUM = "10000/hour"


# ============================================================
#                   CACHE CONSTANTS
# ============================================================

# ✅ ENHANCED: Cache timeouts
CACHE_TIMEOUT_SHORT = timedelta(minutes=5)
CACHE_TIMEOUT_MEDIUM = timedelta(minutes=30)
CACHE_TIMEOUT_LONG = timedelta(hours=1)
CACHE_TIMEOUT_DAY = timedelta(days=1)

# ✅ ENHANCED: Cache keys
CACHE_KEY_USER = "user:{user_id}"
CACHE_KEY_CHAT = "chat:{chat_id}"
CACHE_KEY_MESSAGE = "message:{message_id}"
CACHE_KEY_GROUP = "group:{group_id}"


# ============================================================
#                   PAGINATION CONSTANTS
# ============================================================

# ✅ ENHANCED: Pagination defaults
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MIN_PAGE_SIZE = 1


# ============================================================
#                   INTERNATIONALIZATION (i18n)
# ============================================================

# ✅ ENHANCED: Supported languages with native names
SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "native": "English"},
    "es": {"name": "Spanish", "native": "Español"},
    "fr": {"name": "French", "native": "Français"},
    "de": {"name": "German", "native": "Deutsch"},
    "it": {"name": "Italian", "native": "Italiano"},
    "pt": {"name": "Portuguese", "native": "Português"},
    "ru": {"name": "Russian", "native": "Русский"},
    "ja": {"name": "Japanese", "native": "日本語"},
    "zh": {"name": "Chinese", "native": "中文"},
    "hi": {"name": "Hindi", "native": "हिन्दी"},
    "ko": {"name": "Korean", "native": "한국어"},
    "ar": {"name": "Arabic", "native": "العربية"},
}

DEFAULT_LANGUAGE = "en"
FALLBACK_LANGUAGE = "en"


# ============================================================
#                   HTTP STATUS CODES
# ============================================================

class HTTPStatus(Enum):
    """✅ ENHANCED: HTTP status codes"""
    OK = 200
    CREATED = 201
    ACCEPTED = 202
    NO_CONTENT = 204
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    CONFLICT = 409
    RATE_LIMITED = 429
    INTERNAL_ERROR = 500
    SERVICE_UNAVAILABLE = 503


# ============================================================
#                   ERROR MESSAGES (COMPREHENSIVE)
# ============================================================

# ✅ ENHANCED: Comprehensive error messages
ERROR_MESSAGES = {
    # Authentication errors
    "INVALID_CREDENTIALS": "Invalid username or password.",
    "INVALID_EMAIL": "Invalid email format.",
    "INVALID_PASSWORD": "Password does not meet requirements.",
    "EMAIL_ALREADY_EXISTS": "Email already registered.",
    "USERNAME_ALREADY_EXISTS": "Username is already taken.",
    "EMAIL_NOT_VERIFIED": "Email not verified. Please check your inbox.",
    "PHONE_NOT_VERIFIED": "Phone number not verified.",
    "INVALID_TOKEN": "Invalid or expired authentication token.",
    "TOKEN_EXPIRED": "Token has expired. Please login again.",
    "UNAUTHORIZED": "You are not authorized to perform this action.",
    "SESSION_EXPIRED": "Your session has expired. Please login again.",
    "INVALID_OTP": "Invalid OTP code.",
    "OTP_EXPIRED": "OTP code has expired.",
    "TOO_MANY_LOGIN_ATTEMPTS": "Too many login attempts. Try again later.",
    "ACCOUNT_LOCKED": "Account is locked. Contact support.",
    
    # User errors
    "USER_NOT_FOUND": "User not found.",
    "USER_INACTIVE": "User account is inactive.",
    "USER_DELETED": "User account has been deleted.",
    "PROFILE_NOT_FOUND": "User profile not found.",
    "INVALID_USER_ID": "Invalid user ID format.",
    
    # Message errors
    "MESSAGE_NOT_FOUND": "Message not found.",
    "MESSAGE_DELETED": "Message has been deleted.",
    "INVALID_MESSAGE_TYPE": "Message type not supported.",
    "MESSAGE_TOO_LONG": "Message exceeds maximum length.",
    "MESSAGE_EMPTY": "Message content cannot be empty.",
    "MESSAGE_NOT_EDITABLE": "Message can no longer be edited.",
    "MESSAGE_NOT_DELETABLE": "Message can no longer be deleted.",
    
    # Chat/Group errors
    "CHAT_NOT_FOUND": "Chat not found.",
    "GROUP_NOT_FOUND": "Group not found.",
    "NOT_IN_CHAT": "You are not a member of this chat.",
    "NOT_IN_GROUP": "You are not a member of this group.",
    "ALREADY_IN_GROUP": "You are already a member of this group.",
    "GROUP_FULL": "Group has reached maximum members.",
    "INVALID_GROUP_NAME": "Group name is invalid.",
    "INSUFFICIENT_PERMISSIONS": "You do not have permission to perform this action.",
    
    # File errors
    "FILE_NOT_FOUND": "File not found.",
    "FILE_TOO_LARGE": "File exceeds maximum size.",
    "INVALID_FILE_TYPE": "File type not supported.",
    "FILE_UPLOAD_FAILED": "File upload failed.",
    "FILE_DOWNLOAD_FAILED": "File download failed.",
    
    # Validation errors
    "MISSING_FIELDS": "Required fields are missing.",
    "INVALID_FIELD_FORMAT": "Invalid format for field: {field}.",
    "VALIDATION_FAILED": "Validation failed for the provided input.",
    "DUPLICATE_ENTRY": "Duplicate entry not allowed.",
    
    # Call errors
    "CALL_NOT_FOUND": "Call not found.",
    "CALL_IN_PROGRESS": "Call is already in progress.",
    "INVALID_CALL_TYPE": "Invalid call type.",
    
    # Server errors
    "INTERNAL_ERROR": "An internal server error occurred.",
    "SERVICE_UNAVAILABLE": "Service is temporarily unavailable.",
    "DATABASE_ERROR": "Database operation failed.",
    "ENCRYPTION_ERROR": "Encryption operation failed.",
    "DECRYPTION_ERROR": "Decryption operation failed.",
    
    # Rate limiting
    "RATE_LIMIT_EXCEEDED": "Too many requests. Please try again later.",
    "RATE_LIMIT_LOGIN": "Too many login attempts. Try again later.",
    "RATE_LIMIT_UPLOAD": "Upload rate limit exceeded.",
}


# ============================================================
#                   SUCCESS MESSAGES
# ============================================================

# ✅ ENHANCED: Success messages
SUCCESS_MESSAGES = {
    "USER_CREATED": "User account created successfully.",
    "USER_UPDATED": "User profile updated successfully.",
    "EMAIL_VERIFIED": "Email verified successfully.",
    "PHONE_VERIFIED": "Phone verified successfully.",
    "PASSWORD_RESET": "Password reset successfully.",
    "PASSWORD_CHANGED": "Password changed successfully.",
    "MESSAGE_SENT": "Message sent successfully.",
    "MESSAGE_EDITED": "Message edited successfully.",
    "MESSAGE_DELETED": "Message deleted successfully.",
    "FILE_UPLOADED": "File uploaded successfully.",
    "CHAT_CREATED": "Chat created successfully.",
    "GROUP_CREATED": "Group created successfully.",
    "CALL_INITIATED": "Call initiated.",
    "CALL_ENDED": "Call ended.",
}


# ============================================================
#                   FEATURE FLAGS
# ============================================================

# ✅ ENHANCED: Feature toggle configuration
FEATURE_FLAGS = {
    "E2E_ENCRYPTION": True,
    "POST_QUANTUM_ENCRYPTION": True,
    "VIDEO_CALLS": True,
    "VOICE_CALLS": True,
    "GROUP_CALLS": False,  # Beta
    "MESSAGE_REACTIONS": True,
    "MESSAGE_THREADS": True,
    "MESSAGE_SEARCH": True,
    "FILE_SHARING": True,
    "MESSAGE_DISAPPEAR": True,
    "READ_RECEIPTS": True,
    "TYPING_INDICATORS": True,
    "PRESENCE_INDICATOR": True,
    "USER_STATUS": True,
    "CUSTOM_EMOJIS": False,  # Premium
    "MESSAGE_TRANSLATION": False,  # Beta
    "VOICE_TO_TEXT": False,  # Beta
    "2FA": True,
    "BIOMETRIC_AUTH": False,  # Beta
}


# ============================================================
#                   METRICS & MONITORING
# ============================================================

# ✅ ENHANCED: Metrics configuration
METRICS_CONFIG = {
    "ENABLE_METRICS": True,
    "METRICS_PORT": 9090,
    "INCLUDE_REQUEST_TIMING": True,
    "INCLUDE_DB_TIMING": True,
    "INCLUDE_ENCRYPTION_TIMING": True,
}


__all__ = [
    "DEFAULT_AVATAR_URL",
    "MAX_USERNAME_LENGTH",
    "MIN_USERNAME_LENGTH",
    "TOKEN_EXPIRY_HOURS",
    "MAX_MESSAGE_LENGTH",
    "ALLOWED_MESSAGE_TYPES",
    "SUPPORTED_LANGUAGES",
    "DEFAULT_LANGUAGE",
    "ERROR_MESSAGES",
    "SUCCESS_MESSAGES",
    "HTTPStatus",
    "FEATURE_FLAGS",
    "RATE_LIMIT_LOGIN",
    "RATE_LIMIT_REGISTER",
    "MAX_FILE_SIZE_MB",
    "ALLOWED_IMAGE_FORMATS",
    "ALLOWED_VIDEO_FORMATS",
    "ALLOWED_AUDIO_FORMATS",
]
