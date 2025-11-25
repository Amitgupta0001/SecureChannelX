# FILE: run.py

from app import create_app, socketio
import os

# ---------------------------------------------------------
#  Create Application Instance
# ---------------------------------------------------------
app = create_app()

if __name__ == "__main__":
    print("\n=============================================")
    print(" SecureChannelX Backend Starting...")
    print(" End-to-End Encryption: ACTIVE")
    print(" Forward Secrecy (Double Ratchet): ENABLED")
    print(" Post-Quantum Hybrid Encryption: ENABLED")
    print(" Socket.IO Realtime Engine: READY")
    print(" Server URL: http://localhost:5050")
    print("=============================================\n")

    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    
    # Only allow unsafe Werkzeug in development
    # In production, use Gunicorn with eventlet workers
    allow_unsafe = os.getenv("FLASK_ENV", "production") == "development"
    
    if not allow_unsafe:
        print("⚠️  Production mode detected. Use Gunicorn for production:")
        print("   gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5050 'app:create_app()'")
    
    socketio.run(
        app,
        host="0.0.0.0",
        port=5050,
        debug=debug_mode,
        allow_unsafe_werkzeug=allow_unsafe
    )
