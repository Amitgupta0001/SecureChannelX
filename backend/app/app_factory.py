# FILE: backend/app/app_factory.py

import os
from flask import Flask, jsonify, request
from datetime import timedelta
from dotenv import load_dotenv
from flask_cors import CORS

# extensions imported from app/__init__.py
from app import socketio, bcrypt, jwt, cors as old_cors, mail, limiter, talisman

load_dotenv()

# =========================================================
# APPLICATION FACTORY
# =========================================================
def create_app():
    app_factory = Flask(__name__)

    # ----------------------------------------------------
    # CONFIG
    # ----------------------------------------------------
    app_factory.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    if not app_factory.config["SECRET_KEY"]:
        raise ValueError("No SECRET_KEY set for Flask application")
        
    app_factory.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    if not app_factory.config["JWT_SECRET_KEY"]:
        raise ValueError("No JWT_SECRET_KEY set for Flask application")

    app_factory.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
    app_factory.config["MONGODB_URI"] = os.getenv(
        "MONGODB_URI", "mongodb://localhost:27017/securechannelx"
    )

    # ----------------------------------------------------
    # CORS (FULLY FIXED)
    # ----------------------------------------------------
    CORS(
        app_factory,
        resources={r"/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # allow OPTIONS preflight (important for React)
    @app_factory.before_request
    def allow_preflight():
        if request.method == "OPTIONS":
            return jsonify({"status": "OK"}), 200

    # ----------------------------------------------------
    # EXTENSIONS INIT
    # ----------------------------------------------------
    bcrypt.init_app(app_factory)
    jwt.init_app(app_factory)
    mail.init_app(app_factory)
    
    # Initialize Redis client
    from app.utils.redis_client import redis_client
    
    # Configure rate limiter with Redis or in-memory fallback
    if redis_client.enabled:
        limiter.init_app(app_factory, storage_uri=os.getenv('REDIS_URL'))
        print("✅ Rate limiting using Redis (distributed)")
    else:
        limiter.init_app(app_factory)
        print("⚠️  Rate limiting using in-memory storage (not distributed)")
    
    # CSP Config - Military-Grade (tightened)
    csp = {
        'default-src': "'self'",
        'script-src': ["'self'"],  # Removed unsafe-inline and unsafe-eval
        'style-src': ["'self'", "'unsafe-inline'"],  # Only styles need inline for React
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", 'ws://localhost:5050', 'http://localhost:5050', 'ws://localhost:3000', 'http://localhost:3000'],
        'font-src': ["'self'", 'data:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': True
    }
    talisman.init_app(app_factory, content_security_policy=csp, force_https=False)
    
    socketio.init_app(app_factory, cors_allowed_origins=["http://localhost:5173", "http://localhost:3000"])

    # ----------------------------------------------------
    # DATABASE INIT
    # ----------------------------------------------------
    from app.database import init_db
    init_db(app_factory)

    # ----------------------------------------------------
    # AZURE SERVICES INIT (Optional - with fallbacks)
    # ----------------------------------------------------
    try:
        # Import Azure services
        from app.utils.azure_key_vault import key_vault_service
        from app.utils.azure_monitoring import monitoring_service, track_event
        from app.utils.azure_blob_storage import blob_storage_service
        
        # Services auto-initialize on import
        # Track application startup
        track_event("ApplicationStartup", {
            "environment": os.getenv("FLASK_ENV", "development"),
            "azure_key_vault_enabled": key_vault_service.enabled,
            "azure_monitoring_enabled": monitoring_service.enabled,
            "azure_blob_storage_enabled": blob_storage_service.enabled
        })
        
        # Add telemetry middleware for Flask requests
        if monitoring_service.enabled:
            from opencensus.ext.flask.flask_middleware import FlaskMiddleware
            middleware = FlaskMiddleware(
                app_factory,
                exporter=monitoring_service.metrics_exporter
            )
            print("✅ Azure telemetry middleware enabled")
        
    except Exception as e:
        print(f"⚠️  Azure services initialization skipped: {str(e)}")
        print("📝 Application will run with local fallbacks")


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
    from app.routes.file_upload import file_upload_bp
    from app.routes.notifications import notifications_bp
    from app.routes.reactions import reactions_bp
    from app.routes.read_receipts import reads_bp
    from app.routes.users import users_bp
    from app.routes.keys import keys_bp
    
    app_factory.register_blueprint(auth_bp)
    app_factory.register_blueprint(security_bp)
    app_factory.register_blueprint(chats_bp)
    app_factory.register_blueprint(groups_bp)
    app_factory.register_blueprint(dm_bp)
    app_factory.register_blueprint(messages_bp)
    app_factory.register_blueprint(calls_bp)
    app_factory.register_blueprint(file_upload_bp)
    app_factory.register_blueprint(notifications_bp)
    app_factory.register_blueprint(reactions_bp)
    app_factory.register_blueprint(reads_bp)
    app_factory.register_blueprint(users_bp)
    app_factory.register_blueprint(keys_bp)

    # ----------------------------------------------------
    # SOCKET.IO EVENTS
    # ----------------------------------------------------
    import app.socket.chat_events
    import app.socket.call_events
    import app.socket.group_events
    import app.socket.typing_events

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
