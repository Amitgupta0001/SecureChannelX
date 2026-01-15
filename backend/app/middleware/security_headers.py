"""
SecureChannelX - Security Headers Middleware
--------------------------------------------
Implements comprehensive security headers to protect against:
- XSS attacks
- Clickjacking
- MIME sniffing
- Information leakage
"""

from flask import Response
from typing import Callable


class SecurityHeadersMiddleware:
    """
    Middleware to add security headers to all responses
    """
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize middleware with Flask app"""
        app.after_request(self.add_security_headers)
    
    @staticmethod
    def add_security_headers(response: Response) -> Response:
        """
        Add comprehensive security headers to response
        
        Headers added:
        - Content-Security-Policy (CSP)
        - Strict-Transport-Security (HSTS)
        - X-Frame-Options
        - X-Content-Type-Options
        - X-XSS-Protection
        - Referrer-Policy
        - Permissions-Policy
        """
        
        # Content Security Policy - Prevents XSS attacks
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # Allow inline scripts for React
            "style-src 'self' 'unsafe-inline'",  # Allow inline styles
            "img-src 'self' data: https: blob:",  # Allow images from self, data URIs, HTTPS
            "font-src 'self' data:",
            "connect-src 'self' ws: wss:",  # Allow WebSocket connections
            "media-src 'self'",
            "object-src 'none'",  # Disable plugins
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",  # Prevent embedding
            "upgrade-insecure-requests",  # Upgrade HTTP to HTTPS
        ]
        response.headers['Content-Security-Policy'] = '; '.join(csp_directives)
        
        # Strict Transport Security - Force HTTPS
        # max-age=31536000 (1 year), includeSubDomains, preload
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        
        # X-Frame-Options - Prevent clickjacking
        response.headers['X-Frame-Options'] = 'DENY'
        
        # X-Content-Type-Options - Prevent MIME sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # X-XSS-Protection - Enable XSS filter (legacy browsers)
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer-Policy - Control referrer information
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions-Policy - Control browser features
        permissions = [
            'geolocation=()',
            'microphone=()',
            'camera=()',
            'payment=()',
            'usb=()',
            'magnetometer=()',
            'gyroscope=()',
            'accelerometer=()',
        ]
        response.headers['Permissions-Policy'] = ', '.join(permissions)
        
        # X-Permitted-Cross-Domain-Policies - Restrict Adobe Flash/PDF
        response.headers['X-Permitted-Cross-Domain-Policies'] = 'none'
        
        # Cache-Control - Prevent sensitive data caching
        if '/api/' in response.headers.get('Location', ''):
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        
        return response


def init_security_headers(app):
    """
    Initialize security headers middleware
    
    Usage:
        from app.middleware.security_headers import init_security_headers
        init_security_headers(app)
    """
    SecurityHeadersMiddleware(app)
    print("✅ Security headers middleware initialized")


__all__ = ['SecurityHeadersMiddleware', 'init_security_headers']
