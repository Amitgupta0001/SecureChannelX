# security/hardening.py
import re
import ipaddress
from functools import wraps
from flask import request, jsonify

class SecurityHardener:
    def __init__(self, app):
        self.app = app
        self.suspicious_ips = set()
        self.failed_attempts = defaultdict(int)
    
    def setup_security_headers(self):
        """Setup security headers for all responses"""
        @self.app.after_request
        def set_security_headers(response):
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['X-XSS-Protection'] = '1; mode=block'
            response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
            response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
            return response
    
    def rate_limit_by_ip(self, requests_per_minute=60):
        """Rate limiting decorator by IP address"""
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                ip = request.remote_addr
                key = f"rate_limit:{ip}"
                
                current = redis_client.get(key)
                if current and int(current) > requests_per_minute:
                    return jsonify({'error': 'Rate limit exceeded'}), 429
                
                pipeline = redis_client.pipeline()
                pipeline.incr(key, 1)
                pipeline.expire(key, 60)
                pipeline.execute()
                
                return f(*args, **kwargs)
            return decorated_function
        return decorator
    
    def detect_brute_force(self, user_id, ip_address):
        """Detect and prevent brute force attacks"""
        key = f"brute_force:{ip_address}:{user_id}"
        attempts = redis_client.incr(key)
        
        if attempts == 1:
            redis_client.expire(key, 900)  # 15 minutes
        
        if attempts > 5:
            # Block IP for 1 hour
            redis_client.setex(f"blocked_ip:{ip_address}", 3600, '1')
            log_security_event('brute_force_blocked', user_id, ip_address, 
                             f'Blocked after {attempts} attempts')
            return True
        
        return False
    
    def sanitize_input(self, input_string):
        """Sanitize user input to prevent injection attacks"""
        # Remove potentially dangerous characters
        sanitized = re.sub(r'[;\"\']', '', input_string)
        # Limit length
        sanitized = sanitized[:1000]
        return sanitized
    
    def validate_file_upload(self, file):
        """Validate uploaded files for security"""
        allowed_extensions = {'jpg', 'jpeg', 'png', 'gif', 'pdf', 'txt'}
        max_size = 10 * 1024 * 1024  # 10MB
        
        if not ('.' in file.filename and 
                file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return False, 'File type not allowed'
        
        if len(file.read()) > max_size:
            return False, 'File too large'
        
        file.seek(0)  # Reset file pointer
        return True, 'OK'

# Advanced encryption key management
class KeyManagementService:
    def __init__(self, hsm):
        self.hsm = hsm
        self.key_rotation_schedule = {}
    
    def rotate_encryption_keys(self):
        """Rotate encryption keys on schedule"""
        now = datetime.utcnow()
        
        for key_id, rotation_time in self.key_rotation_schedule.items():
            if now >= rotation_time:
                self._rotate_key(key_id)
                # Schedule next rotation
                self.key_rotation_schedule[key_id] = now + timedelta(days=30)
    
    def _rotate_key(self, key_id):
        """Rotate a specific encryption key"""
        # Generate new key
        new_key = os.urandom(32)
        
        # Re-encrypt data with new key (in production, this would be batched)
        self._reencrypt_data(key_id, new_key)
        
        # Update key in HSM
        self.hsm.update_key(key_id, new_key)
        
        log_security_event('key_rotated', None, None, f'Key {key_id} rotated')