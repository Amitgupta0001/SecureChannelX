from flask import Flask
from flask_socketio import SocketIO
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail

# Global extensions
socketio = SocketIO()
bcrypt = Bcrypt()
jwt = JWTManager()
cors = CORS()
mail = Mail()

def create_app():
    from app import app_factory
    return app_factory.create_app()

# Expose extensions to other modules
__all__ = [
    "socketio",
    "bcrypt",
    "jwt",
    "cors",
    "mail",
    "create_app"
]
