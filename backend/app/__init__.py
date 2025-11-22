from flask import Flask
from flask_socketio import SocketIO
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail

# Global extensions
socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="threading",
    ping_timeout=30,
    ping_interval=25
)
bcrypt = Bcrypt()
jwt = JWTManager()
cors = CORS()
mail = Mail()

# App factory loader
def create_app():
    from app.app_factory import create_app as factory
    return factory()

__all__ = ["socketio", "bcrypt", "jwt", "cors", "mail", "create_app"]
