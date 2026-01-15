"""
SecureChannelX - Input Validation Schemas
-----------------------------------------
Marshmallow schemas for validating and sanitizing user inputs

Prevents:
- Injection attacks
- Invalid data
- Buffer overflows
- Type confusion
"""

from marshmallow import Schema, fields, validate, validates, ValidationError, EXCLUDE
from email_validator import validate_email, EmailNotValidError
import re


# ============================================================
#                   AUTHENTICATION SCHEMAS
# ============================================================

class RegisterSchema(Schema):
    """Validate user registration input"""
    
    class Meta:
        unknown = EXCLUDE  # Ignore unknown fields
    
    username = fields.Str(
        required=True,
        validate=[
            validate.Length(min=3, max=30),
            validate.Regexp(r'^[a-zA-Z0-9_-]+$', error="Username can only contain letters, numbers, hyphens, and underscores")
        ]
    )
    
    email = fields.Email(
        required=True,
        validate=validate.Length(max=255)
    )
    
    password = fields.Str(
        required=True,
        validate=[
            validate.Length(min=8, max=128),
        ]
    )
    
    @validates('email')
    def validate_email_format(self, value):
        """Validate email with email-validator library"""
        try:
            validate_email(value)
        except EmailNotValidError as e:
            raise ValidationError(str(e))


class LoginSchema(Schema):
    """Validate login input"""
    
    class Meta:
        unknown = EXCLUDE
    
    username = fields.Str(
        required=True,
        validate=validate.Length(min=3, max=30)
    )
    
    password = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=128)
    )


class TwoFactorSchema(Schema):
    """Validate 2FA code"""
    
    class Meta:
        unknown = EXCLUDE
    
    code = fields.Str(
        required=True,
        validate=[
            validate.Length(equal=6),
            validate.Regexp(r'^\d{6}$', error="2FA code must be 6 digits")
        ]
    )


# ============================================================
#                   MESSAGE SCHEMAS
# ============================================================

class MessageSchema(Schema):
    """Validate message input"""
    
    class Meta:
        unknown = EXCLUDE
    
    content = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=10000)  # Max 10KB
    )
    
    recipient_id = fields.Str(
        required=True,
        validate=[
            validate.Length(equal=24),  # MongoDB ObjectId length
            validate.Regexp(r'^[a-f0-9]{24}$', error="Invalid recipient ID format")
        ]
    )
    
    encrypted = fields.Bool(required=False, load_default=True)
    
    reply_to = fields.Str(
        required=False,
        allow_none=True,
        validate=[
            validate.Length(equal=24),
            validate.Regexp(r'^[a-f0-9]{24}$', error="Invalid message ID format")
        ]
    )


class GroupMessageSchema(Schema):
    """Validate group message input"""
    
    class Meta:
        unknown = EXCLUDE
    
    content = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=10000)
    )
    
    group_id = fields.Str(
        required=True,
        validate=[
            validate.Length(equal=24),
            validate.Regexp(r'^[a-f0-9]{24}$', error="Invalid group ID format")
        ]
    )


# ============================================================
#                   GROUP SCHEMAS
# ============================================================

class CreateGroupSchema(Schema):
    """Validate group creation"""
    
    class Meta:
        unknown = EXCLUDE
    
    name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=100)
    )
    
    description = fields.Str(
        required=False,
        allow_none=True,
        validate=validate.Length(max=500)
    )
    
    members = fields.List(
        fields.Str(
            validate=[
                validate.Length(equal=24),
                validate.Regexp(r'^[a-f0-9]{24}$')
            ]
        ),
        required=True,
        validate=validate.Length(min=1, max=256)  # Max 256 members
    )


# ============================================================
#                   FILE UPLOAD SCHEMAS
# ============================================================

class FileUploadSchema(Schema):
    """Validate file upload metadata"""
    
    class Meta:
        unknown = EXCLUDE
    
    filename = fields.Str(
        required=True,
        validate=[
            validate.Length(min=1, max=255),
            validate.Regexp(
                r'^[a-zA-Z0-9_\-. ]+\.[a-zA-Z0-9]+$',
                error="Invalid filename format"
            )
        ]
    )
    
    file_size = fields.Int(
        required=True,
        validate=validate.Range(min=1, max=100*1024*1024)  # Max 100MB
    )
    
    mime_type = fields.Str(
        required=True,
        validate=validate.OneOf([
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'text/plain',
            'application/zip',
            'video/mp4', 'video/webm',
            'audio/mpeg', 'audio/ogg'
        ])
    )


# ============================================================
#                   USER PROFILE SCHEMAS
# ============================================================

class UpdateProfileSchema(Schema):
    """Validate profile update"""
    
    class Meta:
        unknown = EXCLUDE
    
    display_name = fields.Str(
        required=False,
        validate=validate.Length(min=1, max=100)
    )
    
    bio = fields.Str(
        required=False,
        allow_none=True,
        validate=validate.Length(max=500)
    )
    
    avatar_url = fields.Url(
        required=False,
        allow_none=True
    )


# ============================================================
#                   SEARCH SCHEMAS
# ============================================================

class SearchSchema(Schema):
    """Validate search query"""
    
    class Meta:
        unknown = EXCLUDE
    
    query = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=100)
    )
    
    limit = fields.Int(
        required=False,
        load_default=50,
        validate=validate.Range(min=1, max=100)
    )
    
    skip = fields.Int(
        required=False,
        load_default=0,
        validate=validate.Range(min=0)
    )


# ============================================================
#                   PAGINATION SCHEMA
# ============================================================

class PaginationSchema(Schema):
    """Validate pagination parameters"""
    
    class Meta:
        unknown = EXCLUDE
    
    page = fields.Int(
        required=False,
        load_default=1,
        validate=validate.Range(min=1)
    )
    
    per_page = fields.Int(
        required=False,
        load_default=50,
        validate=validate.Range(min=1, max=100)
    )


# ============================================================
#                   HELPER FUNCTIONS
# ============================================================

def validate_request(schema_class, data):
    """
    Validate request data against schema
    
    Args:
        schema_class: Marshmallow schema class
        data: Dict of data to validate
        
    Returns:
        Validated and sanitized data
        
    Raises:
        ValidationError: If validation fails
    """
    schema = schema_class()
    return schema.load(data)


def sanitize_string(text: str, max_length: int = None) -> str:
    """
    Sanitize string input
    
    Args:
        text: Input string
        max_length: Maximum allowed length
        
    Returns:
        Sanitized string
    """
    if not isinstance(text, str):
        return ""
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Strip whitespace
    text = text.strip()
    
    # Limit length
    if max_length and len(text) > max_length:
        text = text[:max_length]
    
    return text


__all__ = [
    'RegisterSchema',
    'LoginSchema',
    'TwoFactorSchema',
    'MessageSchema',
    'GroupMessageSchema',
    'CreateGroupSchema',
    'FileUploadSchema',
    'UpdateProfileSchema',
    'SearchSchema',
    'PaginationSchema',
    'validate_request',
    'sanitize_string'
]
