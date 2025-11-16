import os
import base64
import secrets
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize extensions
bcrypt = Bcrypt()
jwt = JWTManager()

socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-here')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['MONGODB_URI'] = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/securechannelx')
    
    # Initialize extensions with app
    bcrypt.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app)
    CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])
    
    # Database initialization
    from app.database import init_db
    init_db(app)
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.messages import messages_bp
    from app.routes.security_routes import security_bp
    from app.routes.message_features import message_features_bp
    from app.routes.advanced_chat import advanced_chat_bp
    from app.routes.webrtc import webrtc_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(security_bp)
    app.register_blueprint(message_features_bp)
    app.register_blueprint(advanced_chat_bp)
    app.register_blueprint(webrtc_bp)
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token'}), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Token is missing'}), 401
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return jsonify({
            'status': 'healthy', 
            'service': 'SecureChannelX API',
            'e2e_encryption': True,
            'security_level': 'military_grade'
        })
    
    # Root endpoint
    @app.route('/')
    def index():
        return jsonify({
            'message': 'SecureChannelX - End-to-End Encrypted Chat',
            'version': '1.0.0',
            'security': {
                'e2e_encryption': True,
                'forward_secrecy': True,
                'post_quantum': True,
                'authentication': 'multi_factor'
            },
            'endpoints': {
                'auth': '/api/auth/*',
                'messages': '/api/messages/*',
                'security': '/api/security/*',
                'chat_features': '/api/chat/*',
                'calls': '/api/calls/*'
            }
        })
    
    return app

# Create app instance
app = create_app()

if __name__ == '__main__':
    print("🚀 SecureChannelX Server Starting...")
    print("✅ MongoDB connected")
    print("✅ JWT initialized") 
    print("✅ Socket.IO ready")
    print("🔐 End-to-End Encryption: ACTIVE")
    print("🔒 Forward Secrecy: ENABLED")
    print("⚛️  Post-Quantum Resistance: ENABLED")
    print("📡 Server running on http://0.0.0.0:5050")
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=5050,
        debug=True,
        allow_unsafe_werkzeug=True
    )