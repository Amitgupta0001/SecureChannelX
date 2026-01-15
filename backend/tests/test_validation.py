"""
Test Input Validation Schemas
-----------------------------
Tests for Marshmallow validation schemas
"""

import pytest
from marshmallow import ValidationError
from app.validation.schemas import (
    RegisterSchema,
    LoginSchema,
    MessageSchema,
    validate_request,
    sanitize_string
)


class TestValidationSchemas:
    """Test input validation schemas"""
    
    def test_register_schema_valid(self):
        """Test valid registration data"""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'SecurePass123!'
        }
        
        result = validate_request(RegisterSchema, data)
        assert result['username'] == 'testuser'
        assert result['email'] == 'test@example.com'
        print("✅ Valid registration data accepted")
    
    def test_register_schema_invalid_username(self):
        """Test invalid username"""
        data = {
            'username': 'ab',  # Too short
            'email': 'test@example.com',
            'password': 'SecurePass123!'
        }
        
        with pytest.raises(ValidationError):
            validate_request(RegisterSchema, data)
        print("✅ Short username rejected")
    
    def test_register_schema_invalid_email(self):
        """Test invalid email"""
        data = {
            'username': 'testuser',
            'email': 'invalid-email',
            'password': 'SecurePass123!'
        }
        
        with pytest.raises(ValidationError):
            validate_request(RegisterSchema, data)
        print("✅ Invalid email rejected")
    
    def test_register_schema_weak_password(self):
        """Test weak password"""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'short'  # Too short
        }
        
        with pytest.raises(ValidationError):
            validate_request(RegisterSchema, data)
        print("✅ Weak password rejected")
    
    def test_login_schema_valid(self):
        """Test valid login data"""
        data = {
            'username': 'testuser',
            'password': 'password123'
        }
        
        result = validate_request(LoginSchema, data)
        assert result['username'] == 'testuser'
        print("✅ Valid login data accepted")
    
    def test_message_schema_valid(self):
        """Test valid message data"""
        data = {
            'content': 'Hello, World!',
            'recipient_id': '507f1f77bcf86cd799439011'  # Valid MongoDB ObjectId
        }
        
        result = validate_request(MessageSchema, data)
        assert result['content'] == 'Hello, World!'
        print("✅ Valid message data accepted")
    
    def test_message_schema_invalid_recipient(self):
        """Test invalid recipient ID"""
        data = {
            'content': 'Hello!',
            'recipient_id': 'invalid-id'
        }
        
        with pytest.raises(ValidationError):
            validate_request(MessageSchema, data)
        print("✅ Invalid recipient ID rejected")
    
    def test_message_schema_too_long(self):
        """Test message too long"""
        data = {
            'content': 'A' * 10001,  # Exceeds 10000 char limit
            'recipient_id': '507f1f77bcf86cd799439011'
        }
        
        with pytest.raises(ValidationError):
            validate_request(MessageSchema, data)
        print("✅ Oversized message rejected")
    
    def test_sanitize_string(self):
        """Test string sanitization"""
        # Test null byte removal
        result = sanitize_string('test\x00string')
        assert '\x00' not in result
        
        # Test whitespace stripping
        result = sanitize_string('  test  ')
        assert result == 'test'
        
        # Test length limiting
        result = sanitize_string('A' * 100, max_length=10)
        assert len(result) == 10
        
        print("✅ String sanitization working")
    
    def test_schema_unknown_fields_ignored(self):
        """Test that unknown fields are ignored"""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'SecurePass123!',
            'unknown_field': 'should be ignored'
        }
        
        result = validate_request(RegisterSchema, data)
        assert 'unknown_field' not in result
        print("✅ Unknown fields ignored")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
