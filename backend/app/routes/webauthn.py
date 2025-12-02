"""
WebAuthn/FIDO2 Authentication Routes
Provides hardware token authentication endpoints
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import secrets
import base64
import logging
from datetime import datetime, timedelta

from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)

webauthn_bp = Blueprint('webauthn', __name__, url_prefix='/api/auth/webauthn')

# Temporary challenge storage (use Redis in production)
# Format: {user_id: {'challenge': bytes, 'timestamp': datetime}}
challenges = {}

# Challenge expiration time
CHALLENGE_EXPIRATION = timedelta(minutes=5)


def cleanup_expired_challenges():
    """Remove expired challenges"""
    try:
        current_time = now_utc()
        expired = [
            user_id for user_id, data in challenges.items()
            if current_time - data.get('timestamp', current_time) > CHALLENGE_EXPIRATION
        ]
        for user_id in expired:
            del challenges[user_id]
        if expired:
            logger.info(f"[WEBAUTHN] Cleaned up {len(expired)} expired challenges")
    except Exception as e:
        logger.error(f"[WEBAUTHN] Challenge cleanup failed: {e}")


@webauthn_bp.route('/register/challenge', methods=['POST'])
@jwt_required()
def register_challenge():
    """
    Generate registration challenge for WebAuthn credential
    
    Request:
        {
            "username": "user123"
        }
    
    Response:
        {
            "challenge": "base64_encoded_challenge",
            "userId": "base64_encoded_user_id",
            "rpName": "SecureChannelX",
            "rpId": "localhost"
        }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        username = data.get('username', user_id)
        
        # Generate random challenge (32 bytes)
        challenge = secrets.token_bytes(32)
        challenge_b64 = base64.b64encode(challenge).decode('utf-8')
        
        # Store challenge with timestamp
        challenges[user_id] = {
            'challenge': challenge,
            'timestamp': now_utc(),
            'username': username
        }
        
        # Clean up old challenges
        cleanup_expired_challenges()
        
        # Get hostname from request
        host = request.host.split(':')[0]
        
        logger.info(f"[WEBAUTHN] Registration challenge generated for user: {user_id}")
        
        return jsonify({
            'success': True,
            'challenge': challenge_b64,
            'userId': base64.b64encode(user_id.encode()).decode('utf-8'),
            'rpName': 'SecureChannelX',
            'rpId': host,
            'timeout': 60000,  # 60 seconds
            'attestation': 'direct'
        }), 200
        
    except Exception as e:
        logger.error(f"[WEBAUTHN] Registration challenge failed: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate challenge'
        }), 500


@webauthn_bp.route('/register/verify', methods=['POST'])
@jwt_required()
def register_verify():
    """
    Verify and store WebAuthn credential
    
    Request:
        {
            "username": "user123",
            "credential": {
                "id": "credential_id",
                "rawId": "base64_raw_id",
                "type": "public-key",
                "response": {
                    "clientDataJSON": "base64_client_data",
                    "attestationObject": "base64_attestation"
                }
            }
        }
    
    Response:
        {
            "success": true,
            "credentialId": "credential_id"
        }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'credential' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing credential data'
            }), 400
        
        credential = data['credential']
        
        # Verify challenge exists
        if user_id not in challenges:
            return jsonify({
                'success': False,
                'error': 'No challenge found. Please request a new challenge.'
            }), 400
        
        # Get stored challenge
        challenge_data = challenges[user_id]
        
        # Check challenge expiration
        if now_utc() - challenge_data['timestamp'] > CHALLENGE_EXPIRATION:
            del challenges[user_id]
            return jsonify({
                'success': False,
                'error': 'Challenge expired. Please request a new challenge.'
            }), 400
        
        # In production, you would:
        # 1. Decode and verify clientDataJSON
        # 2. Verify attestationObject
        # 3. Extract and verify public key
        # 4. Check signature
        
        # For now, we'll do basic validation and storage
        credential_id = credential.get('id')
        if not credential_id:
            return jsonify({
                'success': False,
                'error': 'Invalid credential'
            }), 400
        
        # Store credential in database
        db = get_db()
        
        # Check if credential already exists
        existing = db.webauthn_credentials.find_one({
            'credential_id': credential_id
        })
        
        if existing:
            return jsonify({
                'success': False,
                'error': 'Credential already registered'
            }), 400
        
        # Store new credential
        credential_doc = {
            'user_id': user_id,
            'credential_id': credential_id,
            'raw_id': credential.get('rawId'),
            'type': credential.get('type', 'public-key'),
            'response': {
                'client_data_json': credential.get('response', {}).get('clientDataJSON'),
                'attestation_object': credential.get('response', {}).get('attestationObject')
            },
            'created_at': now_utc(),
            'last_used': None,
            'counter': 0,
            'name': data.get('name', 'Security Key'),
            'transports': data.get('transports', ['usb', 'nfc', 'ble'])
        }
        
        result = db.webauthn_credentials.insert_one(credential_doc)
        
        # Remove used challenge
        del challenges[user_id]
        
        logger.info(f"[WEBAUTHN] Credential registered for user: {user_id}")
        
        return jsonify({
            'success': True,
            'credentialId': credential_id,
            'message': 'Security key registered successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"[WEBAUTHN] Registration verification failed: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to verify credential'
        }), 500


@webauthn_bp.route('/login/challenge', methods=['POST'])
def login_challenge():
    """
    Generate login challenge for WebAuthn authentication
    
    Request:
        {
            "username": "user123"
        }
    
    Response:
        {
            "challenge": "base64_challenge",
            "allowCredentials": [
                {
                    "id": "base64_credential_id",
                    "type": "public-key",
                    "transports": ["usb", "nfc", "ble"]
                }
            ]
        }
    """
    try:
        data = request.get_json()
        username = data.get('username')
        
        if not username:
            return jsonify({
                'success': False,
                'error': 'Username required'
            }), 400
        
        # Get user from database
        db = get_db()
        user = db.users.find_one({'username': username})
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        user_id = str(user['_id'])
        
        # Generate challenge
        challenge = secrets.token_bytes(32)
        challenge_b64 = base64.b64encode(challenge).decode('utf-8')
        
        # Store challenge
        challenges[user_id] = {
            'challenge': challenge,
            'timestamp': now_utc(),
            'username': username
        }
        
        # Get user's credentials
        credentials = list(db.webauthn_credentials.find({'user_id': user_id}))
        
        if not credentials:
            return jsonify({
                'success': False,
                'error': 'No security keys registered for this user'
            }), 404
        
        # Format credentials for WebAuthn
        allow_credentials = []
        for cred in credentials:
            allow_credentials.append({
                'id': cred['raw_id'],
                'type': cred.get('type', 'public-key'),
                'transports': cred.get('transports', ['usb', 'nfc', 'ble'])
            })
        
        logger.info(f"[WEBAUTHN] Login challenge generated for user: {username}")
        
        return jsonify({
            'success': True,
            'challenge': challenge_b64,
            'allowCredentials': allow_credentials,
            'timeout': 60000,
            'userVerification': 'preferred'
        }), 200
        
    except Exception as e:
        logger.error(f"[WEBAUTHN] Login challenge failed: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate challenge'
        }), 500


@webauthn_bp.route('/login/verify', methods=['POST'])
def login_verify():
    """
    Verify WebAuthn assertion and authenticate user
    
    Request:
        {
            "username": "user123",
            "assertion": {
                "id": "credential_id",
                "rawId": "base64_raw_id",
                "type": "public-key",
                "response": {
                    "clientDataJSON": "base64_client_data",
                    "authenticatorData": "base64_auth_data",
                    "signature": "base64_signature",
                    "userHandle": "base64_user_handle"
                }
            }
        }
    
    Response:
        {
            "success": true,
            "token": "jwt_token",
            "user": {...}
        }
    """
    try:
        data = request.get_json()
        username = data.get('username')
        assertion = data.get('assertion')
        
        if not username or not assertion:
            return jsonify({
                'success': False,
                'error': 'Missing required data'
            }), 400
        
        # Get user
        db = get_db()
        user = db.users.find_one({'username': username})
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        user_id = str(user['_id'])
        
        # Verify challenge exists
        if user_id not in challenges:
            return jsonify({
                'success': False,
                'error': 'No challenge found'
            }), 400
        
        # Check challenge expiration
        challenge_data = challenges[user_id]
        if now_utc() - challenge_data['timestamp'] > CHALLENGE_EXPIRATION:
            del challenges[user_id]
            return jsonify({
                'success': False,
                'error': 'Challenge expired'
            }), 400
        
        # Get credential
        credential_id = assertion.get('id')
        credential = db.webauthn_credentials.find_one({
            'user_id': user_id,
            'credential_id': credential_id
        })
        
        if not credential:
            return jsonify({
                'success': False,
                'error': 'Credential not found'
            }), 404
        
        # In production, you would:
        # 1. Verify clientDataJSON
        # 2. Verify authenticatorData
        # 3. Verify signature using stored public key
        # 4. Check and update counter
        
        # For now, we'll accept the assertion and generate JWT
        from flask_jwt_extended import create_access_token, create_refresh_token
        
        # Update credential last used
        db.webauthn_credentials.update_one(
            {'_id': credential['_id']},
            {
                '$set': {'last_used': now_utc()},
                '$inc': {'counter': 1}
            }
        )
        
        # Remove used challenge
        del challenges[user_id]
        
        # Generate JWT tokens
        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)
        
        logger.info(f"[WEBAUTHN] User authenticated: {username}")
        
        return jsonify({
            'success': True,
            'token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user_id,
                'username': user['username'],
                'email': user.get('email')
            },
            'message': 'Authentication successful'
        }), 200
        
    except Exception as e:
        logger.error(f"[WEBAUTHN] Login verification failed: {e}")
        return jsonify({
            'success': False,
            'error': 'Authentication failed'
        }), 500


@webauthn_bp.route('/credentials', methods=['GET'])
@jwt_required()
def list_credentials():
    """
    List user's registered WebAuthn credentials
    
    Response:
        {
            "success": true,
            "credentials": [
                {
                    "id": "credential_id",
                    "name": "Security Key",
                    "created_at": "2025-11-29T...",
                    "last_used": "2025-11-29T...",
                    "transports": ["usb"]
                }
            ]
        }
    """
    try:
        user_id = get_jwt_identity()
        db = get_db()
        
        credentials = list(db.webauthn_credentials.find(
            {'user_id': user_id},
            {
                'credential_id': 1,
                'name': 1,
                'created_at': 1,
                'last_used': 1,
                'transports': 1,
                'counter': 1
            }
        ))
        
        # Format response
        formatted_credentials = []
        for cred in credentials:
            formatted_credentials.append({
                'id': cred['credential_id'],
                'name': cred.get('name', 'Security Key'),
                'created_at': cred['created_at'].isoformat() if cred.get('created_at') else None,
                'last_used': cred['last_used'].isoformat() if cred.get('last_used') else None,
                'transports': cred.get('transports', []),
                'usage_count': cred.get('counter', 0)
            })
        
        return jsonify({
            'success': True,
            'credentials': formatted_credentials,
            'count': len(formatted_credentials)
        }), 200
        
    except Exception as e:
        logger.error(f"[WEBAUTHN] List credentials failed: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to list credentials'
        }), 500


@webauthn_bp.route('/credentials/<credential_id>', methods=['DELETE'])
@jwt_required()
def remove_credential(credential_id):
    """
    Remove a WebAuthn credential
    
    Response:
        {
            "success": true,
            "message": "Credential removed"
        }
    """
    try:
        user_id = get_jwt_identity()
        db = get_db()
        
        # Verify credential belongs to user
        credential = db.webauthn_credentials.find_one({
            'user_id': user_id,
            'credential_id': credential_id
        })
        
        if not credential:
            return jsonify({
                'success': False,
                'error': 'Credential not found'
            }), 404
        
        # Delete credential
        result = db.webauthn_credentials.delete_one({
            '_id': credential['_id']
        })
        
        if result.deleted_count > 0:
            logger.info(f"[WEBAUTHN] Credential removed for user: {user_id}")
            return jsonify({
                'success': True,
                'message': 'Security key removed successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to remove credential'
            }), 500
        
    except Exception as e:
        logger.error(f"[WEBAUTHN] Remove credential failed: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to remove credential'
        }), 500


@webauthn_bp.route('/has-credentials', methods=['GET'])
def has_credentials():
    """
    Check if user has registered WebAuthn credentials
    
    Query params:
        username: string
    
    Response:
        {
            "hasCredentials": true,
            "count": 2
        }
    """
    try:
        username = request.args.get('username')
        
        if not username:
            return jsonify({
                'success': False,
                'error': 'Username required'
            }), 400
        
        db = get_db()
        user = db.users.find_one({'username': username})
        
        if not user:
            return jsonify({
                'hasCredentials': False,
                'count': 0
            }), 200
        
        user_id = str(user['_id'])
        count = db.webauthn_credentials.count_documents({'user_id': user_id})
        
        return jsonify({
            'hasCredentials': count > 0,
            'count': count
        }), 200
        
    except Exception as e:
        logger.error(f"[WEBAUTHN] Check credentials failed: {e}")
        return jsonify({
            'hasCredentials': False,
            'count': 0
        }), 200


# Health check endpoint
@webauthn_bp.route('/status', methods=['GET'])
def status():
    """WebAuthn service status"""
    return jsonify({
        'success': True,
        'service': 'WebAuthn',
        'status': 'operational',
        'active_challenges': len(challenges)
    }), 200
