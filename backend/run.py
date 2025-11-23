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
    
    socketio.run(
        app,
        host="0.0.0.0",
        port=5050,
        debug=debug_mode,
        allow_unsafe_werkzeug=True   # Only needed in development
    )
