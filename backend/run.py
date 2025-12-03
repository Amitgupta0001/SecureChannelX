"""
SecureChannelX - Application Runner (FINAL FIXED VERSION)
"""

import os
import sys
import logging
import signal
import io
from dotenv import load_dotenv

# =====================================================================
#                     FORCE SOCKET.IO TO USE WERKZEUG
# =====================================================================
os.environ["FLASK_SOCKETIO_ASYNC_MODE"] = "threading"

# Load environment variables
load_dotenv()

# =====================================================================
#                     WINDOWS UTF-8 OUTPUT FIX
# =====================================================================
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# =====================================================================
#                     LOGGING CONFIGURATION
# =====================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app.log", encoding="utf-8")
    ]
)

logger = logging.getLogger("run")


# =====================================================================
#                          BANNERS
# =====================================================================

def print_banner():
    print("""
╔═══════════════════════════════════════════════════════════════╗
║                     SecureChannelX Backend Server             ║
║                  End-to-End Encrypted Platform                ║
║                        Version: 2.0.0                         ║
╚═══════════════════════════════════════════════════════════════╝
""")


def print_security_features():
    print("""
Security Features:
  - AES-256-GCM End-to-End Encryption
  - Perfect Forward Secrecy (X3DH + Double Ratchet)
  - Zero-Knowledge Architecture
  - Multi-Device Secure Sessions
  - Self-Destructing Messages
  - Screenshot Detection
  - Two-Factor Authentication (2FA)
""")


def print_configuration(env, port, debug):
    print("Configuration:")
    print(f"  Environment: {env}")
    print(f"  Port: {port}")
    print(f"  Debug: {debug}")
    print(f"  Redis: {'ENABLED' if os.getenv('REDIS_URL') else 'NOT CONFIGURED'}")
    print(f"  Email: {'ENABLED' if os.getenv('MAIL_USERNAME') else 'NOT CONFIGURED'}")
    print()


# =====================================================================
#                   ENVIRONMENT VALIDATION
# =====================================================================

def validate_environment():
    logger.info("[STARTUP] Validating environment...")
    required = ["SECRET_KEY", "JWT_SECRET_KEY"]
    missing = [v for v in required if not os.getenv(v)]

    if missing:
        logger.error(f"[STARTUP] Missing env vars: {', '.join(missing)}")
        sys.exit(1)

    logger.info("[STARTUP] Environment validation passed")


# =====================================================================
#                       HEALTH CHECK
# =====================================================================

def startup_health_check(app):
    logger.info("[STARTUP] Running dependency health checks...")

    with app.app_context():
        # MongoDB
        try:
            from app.database import get_db
            get_db().command("ping")
            logger.info("[STARTUP] MongoDB OK")
        except Exception as e:
            logger.error(f"[STARTUP] MongoDB FAILED: {e}")
            sys.exit(1)

        # Redis
        try:
            from app.utils.redis_client import get_redis_client
            rc = get_redis_client()
            logger.info("[STARTUP] Redis OK" if rc.is_redis else "[STARTUP] Redis fallback (memory)")
        except Exception as e:
            logger.warning(f"[STARTUP] Redis check failed: {e}")

        # Email
        if os.getenv("MAIL_USERNAME") and os.getenv("MAIL_PASSWORD"):
            logger.info("[STARTUP] Email OK")
        else:
            logger.warning("[STARTUP] Email not configured")


# =====================================================================
#                          SIGNAL HANDLERS
# =====================================================================

def setup_signal_handlers():
    def shutdown(signum, frame):
        logger.info(f"[SHUTDOWN] Signal {signum} received")

        try:
            from app.database import get_client
            get_client().close()
        except:
            pass

        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    logger.info("[STARTUP] Signal handlers active")


# =====================================================================
#                              MAIN
# =====================================================================

def main():
    print_banner()

    env = os.getenv("FLASK_ENV", "development")
    port = int(os.getenv("FLASK_RUN_PORT", 5050))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"

    print_configuration(env, port, debug)
    print_security_features()

    validate_environment()

    # Import app + socket
    try:
        from app.app_factory import create_app
        from app import socketio
        import app.socket_handlers  # register events

        app = create_app()
        logger.info("[STARTUP] App created successfully")
    except Exception as e:
        logger.error(f"[STARTUP] App creation failed: {e}", exc_info=True)
        sys.exit(1)

    startup_health_check(app)
    setup_signal_handlers()

    use_tls = os.getenv("USE_TLS", "false").lower() == "true"

    try:
        if use_tls:
            cert = os.getenv("TLS_CERT_FILE", "certs/cert.pem")
            key = os.getenv("TLS_KEY_FILE", "certs/key.pem")

            if not os.path.exists(cert) or not os.path.exists(key):
                logger.error("[TLS] Certificate files missing!")
                sys.exit(1)

            logger.info("[TLS] Starting Secure HTTPS Server (Werkzeug)")

            socketio.run(
                app,
                host="0.0.0.0",
                port=port,
                debug=False,
                use_reloader=False,
                allow_unsafe_werkzeug=True,
                ssl_context=(cert, key)
            )

        else:
            logger.info("[STARTUP] Starting HTTP server")

            socketio.run(
                app,
                host="0.0.0.0",
                port=port,
                debug=debug,
                use_reloader=debug,
                allow_unsafe_werkzeug=True
            )

    except Exception as e:
        logger.error(f"[ERROR] Server crashed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

# =====================================================================
#              WSGI/Gunicorn Entry Point (for production)
# =====================================================================
# When running with Gunicorn, import app and socketio at module level
from app.app_factory import create_app, socketio

# Create app instance for Gunicorn
app = create_app()
