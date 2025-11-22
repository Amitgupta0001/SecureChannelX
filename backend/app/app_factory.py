# FILE: backend/app/app_factory.py

import os
from flask import Flask, jsonify
from datetime import timedelta
from dotenv import load_dotenv

# ⬅️ Correct import — takes extensions from app/__init__.py
from app import socketio, bcrypt, jwt, cors, mail

load_dotenv()



# --------------------------------------------------------
# APPLICATION FACTORY
# --------------------------------------------------------
def create_app():
    app_factory = Flask(__name__)

    # ----------------------------------------------------
    # CONFIG
    # ----------------------------------------------------
    app_factory.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "your-secret-key-here")
    app_factory.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "jwt-secret-key-here")
    app_factory.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
    app_factory.config["MONGODB_URI"] = os.getenv(
        "MONGODB_URI", "mongodb://localhost:27017/securechannelx"
    )

    # ----------------------------------------------------
    # EXTENSIONS INIT
    # ----------------------------------------------------
    cors.init_app(app_factory)
    bcrypt.init_app(app_factory)
    jwt.init_app(app_factory)
    mail.init_app(app_factory)
    socketio.init_app(app_factory)

    # ----------------------------------------------------
    # DATABASE INIT
    # ----------------------------------------------------
    from app.database import init_db
    init_db(app_factory)

    # ----------------------------------------------------
    # REGISTER BLUEPRINTS
    # ----------------------------------------------------
    from app.routes.auth import auth_bp
    from app.routes.security_routes import security_bp
    from app.routes.chats import chats_bp
    from app.routes.groups import groups_bp
    from app.routes.direct_messages import dm_bp
    from app.routes.messages import messages_bp
    from app.routes.calls import calls_bp
    from app.features.message_features import message_features_bp
    from app.features.advanced_chat import advanced_chat_bp
    from app.webrtc.webrtc import webrtc_bp
    from app.routes.file_upload import file_upload_bp
    from app.routes.read_receipts import reads_bp
    from app.routes.notifications import notifications_bp
    from app.routes.reactions import reactions_bp

    app_factory.register_blueprint(auth_bp)
    app_factory.register_blueprint(security_bp)
    app_factory.register_blueprint(chats_bp)
    app_factory.register_blueprint(groups_bp)
    app_factory.register_blueprint(dm_bp)
    app_factory.register_blueprint(messages_bp)
    app_factory.register_blueprint(calls_bp)
    app_factory.register_blueprint(message_features_bp)
    app_factory.register_blueprint(advanced_chat_bp)
    app_factory.register_blueprint(webrtc_bp)
    app_factory.register_blueprint(file_upload_bp)
    app_factory.register_blueprint(reads_bp)
    app_factory.register_blueprint(notifications_bp)
    app_factory.register_blueprint(reactions_bp)

    # ----------------------------------------------------
    # SOCKET.IO EVENT IMPORTS (must be after init_app)
    # ----------------------------------------------------
    import app.socket.chat_events
    import app.socket.call_events
    import app.socket.group_events
    import app.socket.typing_events
    # If you ever add a webrtc_events.py, import it here.

    # ----------------------------------------------------
    # ERROR HANDLERS
    # ----------------------------------------------------
    from app.utils.response_builder import error, not_found

    @app_factory.errorhandler(404)
    def handle_404(_):
        return not_found("Endpoint not found")

    @app_factory.errorhandler(500)
    def handle_500(_):
        return error("Internal server error", 500)

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return error("Token has expired", 401)

    @jwt.invalid_token_loader
    def invalid_token(err):
        return error("Invalid token", 401)

    @jwt.unauthorized_loader
    def missing_token(err):
        return error("Token missing", 401)

    # ----------------------------------------------------
    # HEALTH CHECK
    # ----------------------------------------------------
    @app_factory.route("/api/health")
    def health():
        return jsonify(
            {
                "status": "healthy",
                "service": "SecureChannelX API",
                "e2e_encryption": True,
                "security_level": "military_grade",
            }
        )

    # ----------------------------------------------------
    # ROOT ENDPOINT
    # ----------------------------------------------------
    @app_factory.route("/")
    def index():
        return jsonify(
            {
                "message": "SecureChannelX - End-to-End Encrypted Chat",
                "version": "1.0.0",
                "security": {
                    "e2e_encryption": True,
                    "forward_secrecy": True,
                    "post_quantum": True,
                },
            }
        )

    return app_factory

