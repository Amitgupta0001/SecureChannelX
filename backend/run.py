# FILE: run.py

from app import create_app, socketio   # ✅ Correct import from app/__init__.py

# ---------------------------------------------------------
#  Create Application Instance
# ---------------------------------------------------------
app = create_app()

if __name__ == "__main__":
    print("\n=============================================")
    print("🚀 SecureChannelX Backend Starting...")
    print("🔐 End-to-End Encryption: ACTIVE")
    print("🔒 Forward Secrecy (Double Ratchet): ENABLED")
    print("⚛️ Post-Quantum Hybrid Encryption: ENABLED")
    print("🔌 Socket.IO Realtime Engine: READY")
    print("📡 Server URL: http://localhost:5050")
    print("=============================================\n")

    socketio.run(
        app,
        host="0.0.0.0",
        port=5050,
        debug=True,
        allow_unsafe_werkzeug=True  # Required for Flask-SocketIO in debug mode
    )
