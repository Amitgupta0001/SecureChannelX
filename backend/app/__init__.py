"""
SecureChannelX - Application Package
-------------------------------------
Main application package initialization
"""

from flask import Flask
from flask_socketio import SocketIO
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
# Talisman removed - package corrupted

socketio = SocketIO(
    async_mode="threading",
    cors_allowed_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
    ],
)

# Global extensions
bcrypt = Bcrypt()
jwt = JWTManager()
cors = CORS()
mail = Mail()
limiter = Limiter(key_func=get_remote_address)

# App factory loader
def create_app():
    from app.app_factory import create_app as factory
    return factory()

__version__ = "2.0.0"

__all__ = [
    "socketio",
    "__version__"
]
