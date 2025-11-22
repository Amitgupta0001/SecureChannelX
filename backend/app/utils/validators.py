# backend/app/utils/validators.py

import re
from app.utils.constants import MAX_MESSAGE_LENGTH, MAX_USERNAME_LENGTH


# -------------------------------------------
# Regex Patterns
# -------------------------------------------

USERNAME_REGEX = r"^(?![_])(?!.*[_]{2})[A-Za-z0-9_]{3,20}$"
# - cannot start with _
# - cannot contain __ (double underscore)
# - must be 3–20 chars

EMAIL_REGEX = (
    r"(^[a-zA-Z0-9_.+-]+"
    r"@[a-zA-Z0-9-]+"
    r"\.[a-zA-Z0-9-.]+$)"
)

PASSWORD_REGEX = r"^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$"
# - minimum 8 chars
# - at least 1 uppercase
# - at least 1 lowercase
# - at least 1 number
# - at least 1 special char


# -------------------------------------------
# USER VALIDATION
# -------------------------------------------

def validate_username(username: str) -> bool:
    if not username:
        return False
    if len(username) > MAX_USERNAME_LENGTH:
        return False
    return bool(re.match(USERNAME_REGEX, username))


def validate_email(email: str) -> bool:
    if not email:
        return False
    return bool(re.match(EMAIL_REGEX, email))


def validate_password(password: str) -> bool:
    """Strong password enforcement."""
    if not password:
        return False
    return bool(re.match(PASSWORD_REGEX, password))


# -------------------------------------------
# MESSAGE VALIDATION
# -------------------------------------------

def validate_message_content(text: str) -> bool:
    """Prevent empty, whitespace-only, emoji-only messages."""
    if not text:
        return False

    stripped = text.strip()

    if len(stripped) == 0:
        return False

    if len(text) > MAX_MESSAGE_LENGTH:
        return False

    # block messages containing ONLY emojis or symbols
    if re.fullmatch(r"[\W_]+", stripped):
        return False

    return True


# -------------------------------------------
# GROUP / CHAT VALIDATION
# -------------------------------------------

def validate_group_title(title: str) -> bool:
    if not title:
        return False
    title = title.strip()
    return 2 <= len(title) <= 50


def validate_group_description(desc: str) -> bool:
    """Optional field but restrict bad input."""
    if desc is None:
        return True
    if len(desc) > 300:
        return False
    return True


# -------------------------------------------
# OPTIONAL: PHONE VALIDATOR
# -------------------------------------------

PHONE_REGEX = r"^[0-9]{10,15}$"

def validate_phone(number: str) -> bool:
    """Validate phone number (optional for future use)."""
    if not number:
        return False
    return bool(re.match(PHONE_REGEX, number))
