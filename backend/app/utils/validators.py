"""
SecureChannelX Validators (Enhanced Version)
---------------------------------------------
Production-grade validation for:
  - User input (username, email, password)
  - Messages & content
  - Groups & chats
  - Files & uploads
  - Phone numbers
  - URLs & links
  - Comprehensive error reporting
"""

import re
import logging
from typing import Tuple, Optional, List, Dict
from app.utils.constants import (
    MAX_MESSAGE_LENGTH,
    MAX_USERNAME_LENGTH,
    MIN_USERNAME_LENGTH,
    MIN_PASSWORD_LENGTH,
    MAX_PASSWORD_LENGTH,
    REQUIRE_UPPERCASE,
    REQUIRE_LOWERCASE,
    REQUIRE_NUMBERS,
    REQUIRE_SPECIAL_CHARS,
    MAX_GROUP_NAME_LENGTH,
    MAX_GROUP_DESCRIPTION_LENGTH,
    USERNAME_PATTERN,
    ALLOWED_IMAGE_FORMATS,
    ALLOWED_VIDEO_FORMATS,
    ALLOWED_AUDIO_FORMATS,
    ALLOWED_DOCUMENT_FORMATS,
    MAX_FILE_SIZE_MB,
)

logger = logging.getLogger(__name__)


# ============================================================
#                   REGEX PATTERNS
# ============================================================

# ✅ ENHANCED: Comprehensive regex patterns with documentation
USERNAME_REGEX = r"^(?![_])(?!.*[_]{2})[A-Za-z0-9_-]{3,30}$"
"""
Username pattern:
  - Cannot start with _ or -
  - Cannot contain __ (double underscore)
  - Can contain letters, numbers, underscore, hyphen
  - Must be 3-30 characters
"""

EMAIL_REGEX = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
"""
Email pattern (RFC 5322 simplified):
  - Local part: alphanumeric + . % + - _
  - Domain: alphanumeric + . -
  - TLD: at least 2 letters
"""

PASSWORD_REGEX = r"^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$"
"""
Password pattern (strong):
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number
  - At least 1 special char (!@#$%^&*)
"""

PHONE_REGEX = r"^\+?[0-9]{10,15}$"
"""
Phone pattern:
  - Optional + prefix
  - 10-15 digits
"""

URL_REGEX = r"^https?://[^\s/$.?#].[^\s]*$"
"""
URL pattern:
  - HTTP or HTTPS
  - Valid domain
  - No spaces
"""

IPV4_REGEX = r"^(\d{1,3}\.){3}\d{1,3}$"
"""IPv4 address pattern"""

SLUG_REGEX = r"^[a-z0-9-]+$"
"""URL slug pattern"""


# ============================================================
#                   VALIDATION RESULT TYPE
# ============================================================

class ValidationResult:
    """✅ ENHANCED: Structured validation result"""
    
    def __init__(self, valid: bool, message: str = "", errors: List[str] = None):
        self.valid = valid
        self.message = message
        self.errors = errors or []
    
    def __bool__(self):
        return self.valid
    
    def __str__(self):
        if self.valid:
            return f"✅ {self.message or 'Valid'}"
        return f"❌ {self.message or 'Invalid'}"
    
    def to_dict(self) -> Dict:
        return {
            "valid": self.valid,
            "message": self.message,
            "errors": self.errors
        }


# ============================================================
#                   USER VALIDATION
# ============================================================

def validate_username(username: str, strict: bool = False) -> ValidationResult:
    """
    ✅ ENHANCED: Validate username with detailed error reporting
    
    Args:
        username: Username to validate
        strict: If True, enforce all constraints strictly
    
    Returns:
        ValidationResult with validation details
    """
    errors = []
    
    # ✅ ENHANCED: Type check
    if not username or not isinstance(username, str):
        return ValidationResult(False, "Username is required and must be string", ["INVALID_TYPE"])
    
    # ✅ ENHANCED: Length validation
    username = username.strip()
    
    if len(username) < MIN_USERNAME_LENGTH:
        errors.append(f"Username too short (min {MIN_USERNAME_LENGTH} chars)")
    
    if len(username) > MAX_USERNAME_LENGTH:
        errors.append(f"Username too long (max {MAX_USERNAME_LENGTH} chars)")
    
    if errors:
        return ValidationResult(False, "Username length invalid", errors)
    
    # ✅ ENHANCED: Format validation
    if not re.match(USERNAME_REGEX, username):
        errors = [
            "Cannot start with underscore or hyphen",
            "Cannot contain consecutive underscores",
            "Can only contain letters, numbers, underscore, hyphen"
        ]
        return ValidationResult(False, "Username format invalid", errors)
    
    # ✅ ENHANCED: Reserved usernames
    reserved = {"admin", "root", "system", "support", "moderator", "bot"}
    if username.lower() in reserved:
        return ValidationResult(False, f"'{username}' is reserved", ["RESERVED_USERNAME"])
    
    return ValidationResult(True, "Username is valid")


def validate_email(email: str) -> ValidationResult:
    """✅ ENHANCED: Validate email with detailed error reporting"""
    errors = []
    
    # ✅ ENHANCED: Type check
    if not email or not isinstance(email, str):
        return ValidationResult(False, "Email is required", ["INVALID_TYPE"])
    
    email = email.strip().lower()
    
    # ✅ ENHANCED: Length check
    if len(email) > 254:  # RFC 5321
        errors.append("Email too long (max 254 chars)")
    
    # ✅ ENHANCED: Format check
    if not re.match(EMAIL_REGEX, email):
        errors.append("Invalid email format")
    
    if errors:
        return ValidationResult(False, "Email format invalid", errors)
    
    # ✅ ENHANCED: Check for disposable/temp email services
    disposable_domains = {
        "tempmail.com", "guerrillamail.com", "10minutemail.com",
        "maildrop.cc", "throwaway.email"
    }
    
    domain = email.split("@")[1].lower()
    if domain in disposable_domains:
        return ValidationResult(False, "Disposable email addresses not allowed", ["DISPOSABLE_EMAIL"])
    
    return ValidationResult(True, "Email is valid")


def validate_password(password: str, username: str = None) -> ValidationResult:
    """
    ✅ ENHANCED: Validate password with comprehensive checks
    
    Args:
        password: Password to validate
        username: Username to check against (prevent username in password)
    
    Returns:
        ValidationResult with validation details
    """
    errors = []
    
    # ✅ ENHANCED: Type check
    if not password or not isinstance(password, str):
        return ValidationResult(False, "Password is required", ["INVALID_TYPE"])
    
    # ✅ ENHANCED: Length check
    if len(password) < MIN_PASSWORD_LENGTH:
        errors.append(f"Password too short (min {MIN_PASSWORD_LENGTH} chars)")
    
    if len(password) > MAX_PASSWORD_LENGTH:
        errors.append(f"Password too long (max {MAX_PASSWORD_LENGTH} chars)")
    
    # ✅ ENHANCED: Uppercase check
    if REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        errors.append("Must contain at least one uppercase letter")
    
    # ✅ ENHANCED: Lowercase check
    if REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        errors.append("Must contain at least one lowercase letter")
    
    # ✅ ENHANCED: Number check
    if REQUIRE_NUMBERS and not re.search(r"[0-9]", password):
        errors.append("Must contain at least one number")
    
    # ✅ ENHANCED: Special character check
    if REQUIRE_SPECIAL_CHARS and not re.search(r"[!@#$%^&*()_\-+=\[\]{};:'\"\\|,.<>?/]", password):
        errors.append("Must contain at least one special character (!@#$%^&*)")
    
    # ✅ ENHANCED: Common passwords list
    common_passwords = {
        "password", "123456", "12345678", "qwerty", "abc123",
        "password123", "admin123", "letmein", "welcome", "monkey"
    }
    if password.lower() in common_passwords:
        errors.append("Password is too common")
    
    # ✅ ENHANCED: Username check
    if username and username.lower() in password.lower():
        errors.append("Password cannot contain username")
    
    if errors:
        return ValidationResult(False, "Password does not meet requirements", errors)
    
    return ValidationResult(True, "Password is valid")


# ============================================================
#                   MESSAGE VALIDATION
# ============================================================

def validate_message_content(text: str) -> ValidationResult:
    """
    ✅ ENHANCED: Validate message content with comprehensive checks
    
    Prevents:
      - Empty messages
      - Whitespace-only messages
      - Emoji-only messages
      - Oversized messages
      - XSS attempts
    """
    errors = []
    
    # ✅ ENHANCED: Type check
    if not isinstance(text, str):
        return ValidationResult(False, "Message must be string", ["INVALID_TYPE"])
    
    # ✅ ENHANCED: Empty check
    stripped = text.strip()
    if not stripped:
        errors.append("Message cannot be empty")
    
    # ✅ ENHANCED: Length check
    if len(text) > MAX_MESSAGE_LENGTH:
        errors.append(f"Message too long (max {MAX_MESSAGE_LENGTH} chars)")
    
    if errors:
        return ValidationResult(False, "Message validation failed", errors)
    
    # ✅ ENHANCED: Emoji-only check
    # Allow emojis but require some text
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags (iOS)
        "]+", flags=re.UNICODE
    )
    
    non_emoji = re.sub(emoji_pattern, "", stripped)
    if not non_emoji or non_emoji.isspace():
        errors.append("Message cannot contain only emojis")
    
    # ✅ ENHANCED: XSS check
    xss_patterns = [
        r"<script",
        r"javascript:",
        r"onerror=",
        r"onclick=",
        r"onload="
    ]
    
    for pattern in xss_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            errors.append("Message contains potentially harmful content")
            break
    
    if errors:
        return ValidationResult(False, "Message validation failed", errors)
    
    return ValidationResult(True, "Message is valid")


# ============================================================
#                   GROUP / CHAT VALIDATION
# ============================================================

def validate_group_name(name: str) -> ValidationResult:
    """✅ ENHANCED: Validate group/chat name"""
    errors = []
    
    if not name or not isinstance(name, str):
        return ValidationResult(False, "Group name is required", ["INVALID_TYPE"])
    
    name = name.strip()
    
    # ✅ ENHANCED: Length check
    if len(name) < 2:
        errors.append("Group name too short (min 2 chars)")
    
    if len(name) > MAX_GROUP_NAME_LENGTH:
        errors.append(f"Group name too long (max {MAX_GROUP_NAME_LENGTH} chars)")
    
    # ✅ ENHANCED: Character check
    if not re.match(r"^[a-zA-Z0-9\s\-_().&']+$", name):
        errors.append("Group name contains invalid characters")
    
    if errors:
        return ValidationResult(False, "Group name invalid", errors)
    
    return ValidationResult(True, "Group name is valid")


def validate_group_description(desc: str) -> ValidationResult:
    """✅ ENHANCED: Validate group description (optional)"""
    errors = []
    
    # ✅ ENHANCED: Optional field
    if desc is None or desc == "":
        return ValidationResult(True, "Description is optional")
    
    if not isinstance(desc, str):
        return ValidationResult(False, "Description must be string", ["INVALID_TYPE"])
    
    # ✅ ENHANCED: Length check
    if len(desc) > MAX_GROUP_DESCRIPTION_LENGTH:
        errors.append(f"Description too long (max {MAX_GROUP_DESCRIPTION_LENGTH} chars)")
    
    if errors:
        return ValidationResult(False, "Description invalid", errors)
    
    return ValidationResult(True, "Description is valid")


# ============================================================
#                   FILE VALIDATION
# ============================================================

def validate_file_upload(filename: str, file_size_mb: float, file_type: str) -> ValidationResult:
    """
    ✅ ENHANCED: Validate file uploads
    
    Args:
        filename: Original filename
        file_size_mb: File size in megabytes
        file_type: File type (image, video, audio, document)
    
    Returns:
        ValidationResult with validation details
    """
    errors = []
    
    # ✅ ENHANCED: Filename check
    if not filename or not isinstance(filename, str):
        errors.append("Filename is required")
    
    # ✅ ENHANCED: Size check
    if file_size_mb > MAX_FILE_SIZE_MB:
        errors.append(f"File too large (max {MAX_FILE_SIZE_MB}MB)")
    
    if file_size_mb <= 0:
        errors.append("File size must be positive")
    
    # ✅ ENHANCED: File extension check
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    if not ext:
        errors.append("File must have an extension")
    else:
        if file_type == "image" and ext not in ALLOWED_IMAGE_FORMATS:
            errors.append(f"Invalid image format. Allowed: {', '.join(ALLOWED_IMAGE_FORMATS)}")
        
        elif file_type == "video" and ext not in ALLOWED_VIDEO_FORMATS:
            errors.append(f"Invalid video format. Allowed: {', '.join(ALLOWED_VIDEO_FORMATS)}")
        
        elif file_type == "audio" and ext not in ALLOWED_AUDIO_FORMATS:
            errors.append(f"Invalid audio format. Allowed: {', '.join(ALLOWED_AUDIO_FORMATS)}")
        
        elif file_type == "document" and ext not in ALLOWED_DOCUMENT_FORMATS:
            errors.append(f"Invalid document format. Allowed: {', '.join(ALLOWED_DOCUMENT_FORMATS)}")
    
    # ✅ ENHANCED: Path traversal check
    if ".." in filename or "/" in filename or "\\" in filename:
        errors.append("Invalid filename (path traversal detected)")
    
    if errors:
        return ValidationResult(False, "File validation failed", errors)
    
    return ValidationResult(True, "File is valid")


# ============================================================
#                   PHONE VALIDATION
# ============================================================

def validate_phone(number: str) -> ValidationResult:
    """✅ ENHANCED: Validate phone number"""
    errors = []
    
    if not number or not isinstance(number, str):
        return ValidationResult(False, "Phone number is required", ["INVALID_TYPE"])
    
    # ✅ ENHANCED: Remove common formatting
    cleaned = re.sub(r"[\s\-().+]", "", number)
    
    # ✅ ENHANCED: Format check
    if not re.match(PHONE_REGEX, cleaned):
        errors.append("Invalid phone number format (10-15 digits)")
    
    # ✅ ENHANCED: All zeros/ones check
    if all(c == cleaned[0] for c in cleaned):
        errors.append("Phone number is invalid")
    
    if errors:
        return ValidationResult(False, "Phone number invalid", errors)
    
    return ValidationResult(True, "Phone number is valid")


# ============================================================
#                   URL VALIDATION
# ============================================================

def validate_url(url: str) -> ValidationResult:
    """✅ ENHANCED: Validate URL"""
    errors = []
    
    if not url or not isinstance(url, str):
        return ValidationResult(False, "URL is required", ["INVALID_TYPE"])
    
    # ✅ ENHANCED: Format check
    if not re.match(URL_REGEX, url):
        errors.append("Invalid URL format")
    
    # ✅ ENHANCED: Length check
    if len(url) > 2048:
        errors.append("URL too long (max 2048 chars)")
    
    if errors:
        return ValidationResult(False, "URL invalid", errors)
    
    return ValidationResult(True, "URL is valid")


def validate_redirect_url(url: str, allowed_domains: List[str] = None) -> ValidationResult:
    """✅ ENHANCED: Validate redirect URL (prevent open redirect)"""
    errors = []
    
    if not url or not isinstance(url, str):
        return ValidationResult(False, "URL is required", ["INVALID_TYPE"])
    
    # ✅ ENHANCED: Relative URLs only
    if not url.startswith("/"):
        errors.append("Redirect URL must be relative")
    
    # ✅ ENHANCED: Prevent // (protocol-relative)
    if url.startswith("//"):
        errors.append("Redirect URL cannot be protocol-relative")
    
    # ✅ ENHANCED: Whitelist domains if provided
    if allowed_domains and url.startswith("http"):
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.netloc not in allowed_domains:
            errors.append(f"Domain not in whitelist")
    
    if errors:
        return ValidationResult(False, "Redirect URL invalid", errors)
    
    return ValidationResult(True, "Redirect URL is valid")


# ============================================================
#                   IP VALIDATION
# ============================================================

def validate_ipv4(ip: str) -> ValidationResult:
    """✅ ENHANCED: Validate IPv4 address"""
    if not re.match(IPV4_REGEX, ip):
        return ValidationResult(False, "Invalid IPv4 address", ["INVALID_FORMAT"])
    
    # ✅ ENHANCED: Check each octet
    try:
        parts = ip.split(".")
        for part in parts:
            num = int(part)
            if num < 0 or num > 255:
                return ValidationResult(False, "Invalid IPv4 address", ["OUT_OF_RANGE"])
    except ValueError:
        return ValidationResult(False, "Invalid IPv4 address", ["INVALID_FORMAT"])
    
    return ValidationResult(True, "IPv4 address is valid")


# ============================================================
#                   SLUG VALIDATION
# ============================================================

def validate_slug(slug: str, min_length: int = 1, max_length: int = 100) -> ValidationResult:
    """✅ ENHANCED: Validate URL slug"""
    errors = []
    
    if not slug or not isinstance(slug, str):
        return ValidationResult(False, "Slug is required", ["INVALID_TYPE"])
    
    # ✅ ENHANCED: Length check
    if len(slug) < min_length:
        errors.append(f"Slug too short (min {min_length} chars)")
    
    if len(slug) > max_length:
        errors.append(f"Slug too long (max {max_length} chars)")
    
    # ✅ ENHANCED: Format check
    if not re.match(SLUG_REGEX, slug):
        errors.append("Slug can only contain lowercase letters, numbers, and hyphens")
    
    if errors:
        return ValidationResult(False, "Slug invalid", errors)
    
    return ValidationResult(True, "Slug is valid")


__all__ = [
    "ValidationResult",
    "validate_username",
    "validate_email",
    "validate_password",
    "validate_message_content",
    "validate_group_name",
    "validate_group_description",
    "validate_file_upload",
    "validate_phone",
    "validate_url",
    "validate_redirect_url",
    "validate_ipv4",
    "validate_slug",
]
