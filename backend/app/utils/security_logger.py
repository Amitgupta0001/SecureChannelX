"""
SecureChannelX - Security Event Logger
--------------------------------------
Comprehensive security event logging and monitoring

Logs:
- Authentication attempts
- Failed logins
- Suspicious activity
- Key operations
- Access violations
- Security events
"""

import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum


class SecurityEventType(Enum):
    """Security event types"""
    # Authentication
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failed"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    
    # 2FA
    TWO_FA_ENABLED = "2fa_enabled"
    TWO_FA_DISABLED = "2fa_disabled"
    TWO_FA_SUCCESS = "2fa_success"
    TWO_FA_FAILURE = "2fa_failure"
    
    # Account
    ACCOUNT_CREATED = "account_created"
    ACCOUNT_DELETED = "account_deleted"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    
    # Cryptography
    KEY_GENERATED = "key_generated"
    KEY_EXCHANGED = "key_exchanged"
    KEY_ROTATED = "key_rotated"
    KEY_DELETED = "key_deleted"
    
    # Access
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    PERMISSION_DENIED = "permission_denied"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    
    # Suspicious Activity
    BRUTE_FORCE_ATTEMPT = "brute_force_attempt"
    INVALID_TOKEN = "invalid_token"
    SUSPICIOUS_IP = "suspicious_ip"
    MULTIPLE_FAILED_LOGINS = "multiple_failed_logins"
    
    # Data
    DATA_EXPORT = "data_export"
    DATA_DELETION = "data_deletion"
    SENSITIVE_DATA_ACCESS = "sensitive_data_access"


class SecurityEventSeverity(Enum):
    """Event severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class SecurityLogger:
    """
    Security event logger with structured logging
    """
    
    def __init__(self, db=None):
        self.logger = logging.getLogger('security')
        self.logger.setLevel(logging.INFO)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # File handler for security events
        file_handler = logging.FileHandler('security_events.log')
        file_handler.setLevel(logging.INFO)
        
        # JSON formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)
        
        self.logger.addHandler(console_handler)
        self.logger.addHandler(file_handler)
        
        # Database for persistent storage
        self.db = db
        if self.db:
            try:
                self.db['security_events'].create_index('timestamp')
                self.db['security_events'].create_index('user_id')
                self.db['security_events'].create_index('event_type')
                self.db['security_events'].create_index('severity')
            except Exception:
                pass
    
    def log_event(
        self,
        event_type: SecurityEventType,
        user_id: Optional[str] = None,
        severity: SecurityEventSeverity = SecurityEventSeverity.INFO,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """
        Log a security event
        
        Args:
            event_type: Type of security event
            user_id: User ID (if applicable)
            severity: Event severity
            details: Additional event details
            ip_address: Client IP address
            user_agent: Client user agent
        """
        event = {
            'timestamp': datetime.utcnow(),
            'event_type': event_type.value,
            'user_id': user_id,
            'severity': severity.value,
            'details': details or {},
            'ip_address': ip_address,
            'user_agent': user_agent
        }
        
        # Log to file
        log_message = json.dumps(event, default=str)
        
        if severity == SecurityEventSeverity.CRITICAL:
            self.logger.critical(log_message)
        elif severity == SecurityEventSeverity.ERROR:
            self.logger.error(log_message)
        elif severity == SecurityEventSeverity.WARNING:
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)
        
        # Store in database
        if self.db:
            try:
                self.db['security_events'].insert_one(event)
            except Exception as e:
                self.logger.error(f"Failed to store security event in DB: {e}")
    
    # Convenience methods for common events
    
    def log_login_success(self, user_id: str, ip_address: str = None, user_agent: str = None):
        """Log successful login"""
        self.log_event(
            SecurityEventType.LOGIN_SUCCESS,
            user_id=user_id,
            severity=SecurityEventSeverity.INFO,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def log_login_failure(self, username: str, reason: str, ip_address: str = None):
        """Log failed login attempt"""
        self.log_event(
            SecurityEventType.LOGIN_FAILURE,
            severity=SecurityEventSeverity.WARNING,
            details={'username': username, 'reason': reason},
            ip_address=ip_address
        )
    
    def log_brute_force(self, username: str, ip_address: str, attempts: int):
        """Log brute force attempt"""
        self.log_event(
            SecurityEventType.BRUTE_FORCE_ATTEMPT,
            severity=SecurityEventSeverity.CRITICAL,
            details={'username': username, 'attempts': attempts},
            ip_address=ip_address
        )
    
    def log_2fa_success(self, user_id: str):
        """Log successful 2FA verification"""
        self.log_event(
            SecurityEventType.TWO_FA_SUCCESS,
            user_id=user_id,
            severity=SecurityEventSeverity.INFO
        )
    
    def log_2fa_failure(self, user_id: str):
        """Log failed 2FA verification"""
        self.log_event(
            SecurityEventType.TWO_FA_FAILURE,
            user_id=user_id,
            severity=SecurityEventSeverity.WARNING
        )
    
    def log_unauthorized_access(self, user_id: str, resource: str, ip_address: str = None):
        """Log unauthorized access attempt"""
        self.log_event(
            SecurityEventType.UNAUTHORIZED_ACCESS,
            user_id=user_id,
            severity=SecurityEventSeverity.ERROR,
            details={'resource': resource},
            ip_address=ip_address
        )
    
    def log_rate_limit_exceeded(self, user_id: str, endpoint: str, ip_address: str = None):
        """Log rate limit exceeded"""
        self.log_event(
            SecurityEventType.RATE_LIMIT_EXCEEDED,
            user_id=user_id,
            severity=SecurityEventSeverity.WARNING,
            details={'endpoint': endpoint},
            ip_address=ip_address
        )
    
    def log_key_operation(self, user_id: str, operation: str, key_type: str):
        """Log cryptographic key operation"""
        self.log_event(
            SecurityEventType.KEY_GENERATED,
            user_id=user_id,
            severity=SecurityEventSeverity.INFO,
            details={'operation': operation, 'key_type': key_type}
        )
    
    def log_account_created(self, user_id: str, username: str, ip_address: str = None):
        """Log account creation"""
        self.log_event(
            SecurityEventType.ACCOUNT_CREATED,
            user_id=user_id,
            severity=SecurityEventSeverity.INFO,
            details={'username': username},
            ip_address=ip_address
        )
    
    def log_suspicious_activity(self, user_id: str, activity: str, ip_address: str = None):
        """Log suspicious activity"""
        self.log_event(
            SecurityEventType.SUSPICIOUS_IP,
            user_id=user_id,
            severity=SecurityEventSeverity.CRITICAL,
            details={'activity': activity},
            ip_address=ip_address
        )


# Global security logger instance
_security_logger = None


def get_security_logger(db=None):
    """Get global security logger instance"""
    global _security_logger
    if _security_logger is None:
        _security_logger = SecurityLogger(db)
    return _security_logger


def init_security_logging(db=None):
    """Initialize security logging"""
    logger = get_security_logger(db)
    print("✅ Security logging initialized")
    return logger


__all__ = [
    'SecurityLogger',
    'SecurityEventType',
    'SecurityEventSeverity',
    'get_security_logger',
    'init_security_logging'
]
