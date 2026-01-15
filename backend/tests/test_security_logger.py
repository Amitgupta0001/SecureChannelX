"""
Test Security Logger
-------------------
Tests for security event logging
"""

import pytest
from app.utils.security_logger import (
    SecurityLogger,
    SecurityEventType,
    SecurityEventSeverity,
    get_security_logger
)


class TestSecurityLogger:
    """Test security logging functionality"""
    
    def test_logger_initialization(self):
        """Test security logger initialization"""
        logger = SecurityLogger()
        assert logger is not None
        assert logger.logger is not None
        print("✅ Security logger initialized")
    
    def test_log_login_success(self):
        """Test logging successful login"""
        logger = SecurityLogger()
        logger.log_login_success(
            user_id='test_user_123',
            ip_address='192.168.1.1'
        )
        print("✅ Login success logged")
    
    def test_log_login_failure(self):
        """Test logging failed login"""
        logger = SecurityLogger()
        logger.log_login_failure(
            username='testuser',
            reason='Invalid password',
            ip_address='192.168.1.1'
        )
        print("✅ Login failure logged")
    
    def test_log_brute_force(self):
        """Test logging brute force attempt"""
        logger = SecurityLogger()
        logger.log_brute_force(
            username='testuser',
            ip_address='192.168.1.1',
            attempts=5
        )
        print("✅ Brute force attempt logged")
    
    def test_log_2fa_events(self):
        """Test logging 2FA events"""
        logger = SecurityLogger()
        
        # Success
        logger.log_2fa_success(user_id='test_user_123')
        
        # Failure
        logger.log_2fa_failure(user_id='test_user_123')
        
        print("✅ 2FA events logged")
    
    def test_log_unauthorized_access(self):
        """Test logging unauthorized access"""
        logger = SecurityLogger()
        logger.log_unauthorized_access(
            user_id='test_user_123',
            resource='/admin/users',
            ip_address='192.168.1.1'
        )
        print("✅ Unauthorized access logged")
    
    def test_log_rate_limit(self):
        """Test logging rate limit exceeded"""
        logger = SecurityLogger()
        logger.log_rate_limit_exceeded(
            user_id='test_user_123',
            endpoint='/api/messages',
            ip_address='192.168.1.1'
        )
        print("✅ Rate limit exceeded logged")
    
    def test_get_global_logger(self):
        """Test getting global logger instance"""
        logger1 = get_security_logger()
        logger2 = get_security_logger()
        
        # Should be same instance
        assert logger1 is logger2
        print("✅ Global logger singleton working")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
