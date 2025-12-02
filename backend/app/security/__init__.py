"""
Security Integration Module
Connects all security improvements to the main application
"""

# Import all security modules
from app.security.jwt_rotation import (
    get_jwt_secret,
    get_valid_jwt_secrets,
    get_secret_manager,
    force_jwt_rotation,
    get_jwt_rotation_status
)

from app.security.dependency_scanner import DependencyScanner

# Export for easy access
__all__ = [
    'get_jwt_secret',
    'get_valid_jwt_secrets',
    'get_secret_manager',
    'force_jwt_rotation',
    'get_jwt_rotation_status',
    'DependencyScanner',
]