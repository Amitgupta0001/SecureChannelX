# backend/app/utils/constants.py
"""
Global constants for SecureChannelX backend
Centralized configuration for message limits, user limits,
expiry durations, supported languages, and default resources.
"""

# ------------------------------------------------------
#  User / Auth Constants
# ------------------------------------------------------

DEFAULT_AVATAR_URL = (
    "https://cdn.securechannelx.com/avatars/default.png"
)

MAX_USERNAME_LENGTH = 20
MIN_USERNAME_LENGTH = 3

TOKEN_EXPIRY_HOURS = 24                # JWT lifespan
SESSION_KEY_ROTATION_MINUTES = 15      # For KMS + encryption service


# ------------------------------------------------------
#  Messaging Constants
# ------------------------------------------------------

MAX_MESSAGE_LENGTH = 4000

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
]


# ------------------------------------------------------
#  Internationalization (i18n)
# ------------------------------------------------------

SUPPORTED_LANGUAGES = [
    "en", "es", "fr", "de", "hi", "jp"
]

DEFAULT_LANGUAGE = "en"


# ------------------------------------------------------
#  Error Messages (centralized)
# ------------------------------------------------------

ERROR_MESSAGES = {
    "INVALID_CREDENTIALS": "Invalid username or password.",
    "MISSING_FIELDS": "Required fields are missing.",
    "UNAUTHORIZED": "You are not authorized to perform this action.",
    "USER_NOT_FOUND": "User not found.",
    "MESSAGE_NOT_FOUND": "Message not found.",
    "GROUP_NOT_FOUND": "Group not found.",
    "CHAT_NOT_FOUND": "Chat not found.",
    "INVALID_TOKEN": "Invalid or expired authentication token.",
    "INVALID_MESSAGE_TYPE": "Message type not supported.",
    "VALIDATION_FAILED": "Validation failed for the provided input.",
}
