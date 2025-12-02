from app import socketio  # use the shared instance defined in app.__init__
from flask_socketio import emit
import jwt
import os

@socketio.on('connect')
def handle_connect(auth):
    """
    ✅ Handle client connection with JWT authentication
    
    Socket.IO sends auth as a dict: { "token": "..." }
    """
    try:
        print(f"📡 Socket.IO connection attempt - Auth: {auth}")
        
        # Extract token from auth dict
        if not auth or not isinstance(auth, dict):
            print("❌ No auth data provided")
            return False
        
        token = auth.get('token')
        
        if not token:
            print("❌ No token in auth data")
            return False
        
        # Verify JWT token
        secret = os.getenv('JWT_SECRET_KEY')
        if not secret:
            print("❌ JWT_SECRET_KEY not configured")
            return False
        
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        user_id = payload.get('user_id') or payload.get('sub')
        
        if not user_id:
            print("❌ No user_id in token payload")
            return False
        
        print(f"✅ Socket.IO client connected: user_id={user_id}")
        
        # Store user_id in session for future events
        from flask import request
        request.user_id = user_id
        
        return True  # Accept connection
        
    except jwt.ExpiredSignatureError:
        print("❌ Token expired")
        return False
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid token: {e}")
        return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        import traceback
        traceback.print_exc()
        return False

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"🔌 Socket.IO client disconnected")

@socketio.on_error_default
def default_error_handler(e):
    """Handle Socket.IO errors"""
    print(f"❌ Socket.IO error: {e}")
    import traceback
    traceback.print_exc()

@socketio.on("ping")
def on_ping():
    emit("pong")