from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import get_db
from bson import ObjectId
from datetime import datetime, timedelta
import pyotp
import qrcode
import base64
from io import BytesIO
import secrets
import os

security_bp = Blueprint('security', __name__)
db = get_db()

@security_bp.route('/api/security/setup-2fa', methods=['POST'])
@jwt_required()
def setup_2fa():
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Generate secret for authenticator app
        secret = pyotp.random_base32()
        
        # Store secret temporarily in MongoDB
        db.temp_2fa_secrets.update_one(
            {"user_id": user_id},
            {"$set": {
                "secret": secret,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=1)
            }},
            upsert=True
        )
        
        # Generate QR code
        totp = pyotp.TOTP(secret)
        provisioning_url = totp.provisioning_uri(
            name=user["username"],
            issuer_name="SecureChannelX"
        )
        
        # Generate QR code image
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        qr_code = base64.b64encode(buffered.getvalue()).decode()
        
        # Log 2FA setup attempt
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "2fa_setup_initiated",
            "resource": "security",
            "status": "success",
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({
            'secret': secret,
            'provisioning_url': provisioning_url,
            'qr_code': f"data:image/png;base64,{qr_code}",
            'message': 'Scan QR code with authenticator app'
        })
        
    except Exception as e:
        current_app.logger.error(f"2FA setup error: {str(e)}")
        return jsonify({'error': 'Failed to setup 2FA'}), 500

@security_bp.route('/api/security/enable-2fa', methods=['POST'])
@jwt_required()
def enable_2fa():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'token' not in data:
            return jsonify({'error': 'Token required'}), 400
        
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get stored secret
        temp_secret = db.temp_2fa_secrets.find_one({"user_id": user_id})
        if not temp_secret:
            return jsonify({'error': '2FA setup expired or not started'}), 400
        
        # Verify token
        totp = pyotp.TOTP(temp_secret["secret"])
        if totp.verify(data['token']):
            # Enable 2FA
            db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "two_factor_enabled": True,
                    "two_factor_secret": temp_secret["secret"]
                }}
            )
            
            # Cleanup
            db.temp_2fa_secrets.delete_one({"user_id": user_id})
            
            # Log successful 2FA enablement
            db.audit_logs.insert_one({
                "user_id": user_id,
                "action": "2fa_enabled",
                "resource": "security",
                "status": "success",
                "timestamp": datetime.utcnow()
            })
            
            return jsonify({'message': '2FA enabled successfully'})
        else:
            # Log failed verification
            db.audit_logs.insert_one({
                "user_id": user_id,
                "action": "2fa_verification_failed",
                "resource": "security",
                "status": "failed",
                "timestamp": datetime.utcnow()
            })
            
            return jsonify({'error': 'Invalid verification code'}), 400
            
    except Exception as e:
        current_app.logger.error(f"2FA enable error: {str(e)}")
        return jsonify({'error': 'Failed to enable 2FA'}), 500

@security_bp.route('/api/security/disable-2fa', methods=['POST'])
@jwt_required()
def disable_2fa():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'password' not in data:
            return jsonify({'error': 'Password required'}), 400
        
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if not user.get('two_factor_enabled', False):
            return jsonify({'error': '2FA is not enabled'}), 400
        
        # Verify password before disabling
        from flask_bcrypt import Bcrypt
        bcrypt = Bcrypt()
        if not bcrypt.check_password_hash(user["password"], data['password']):
            db.audit_logs.insert_one({
                "user_id": user_id,
                "action": "2fa_disable_attempt",
                "resource": "security",
                "status": "failed",
                "details": "Wrong password",
                "timestamp": datetime.utcnow()
            })
            return jsonify({'error': 'Invalid password'}), 400
        
        # Disable 2FA
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "two_factor_enabled": False,
                "two_factor_secret": None
            }}
        )
        
        # Log 2FA disablement
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "2fa_disabled",
            "resource": "security",
            "status": "success",
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({'message': '2FA disabled successfully'})
        
    except Exception as e:
        current_app.logger.error(f"2FA disable error: {str(e)}")
        return jsonify({'error': 'Failed to disable 2FA'}), 500

@security_bp.route('/api/security/devices', methods=['GET'])
@jwt_required()
def get_devices():
    try:
        user_id = get_jwt_identity()
        
        devices = db.user_devices.find({"user_id": user_id}).sort("last_active", -1)
        
        device_list = []
        for device in devices:
            device_list.append({
                'id': str(device["_id"]),
                'device_name': device.get("device_name", "Unknown Device"),
                'device_id': device.get("device_id"),
                'last_active': device.get("last_active", datetime.utcnow()).isoformat(),
                'is_active': device.get("is_active", True)
            })
        
        return jsonify({'devices': device_list})
        
    except Exception as e:
        current_app.logger.error(f"Get devices error: {str(e)}")
        return jsonify({'error': 'Failed to fetch devices'}), 500

@security_bp.route('/api/security/devices/<device_id>', methods=['DELETE'])
@jwt_required()
def remove_device(device_id):
    try:
        user_id = get_jwt_identity()
        
        result = db.user_devices.delete_one({"_id": ObjectId(device_id), "user_id": user_id})
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Device not found'}), 404
        
        # Log device removal
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "device_removed",
            "resource": "security",
            "status": "success",
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({'message': 'Device removed successfully'})
        
    except Exception as e:
        current_app.logger.error(f"Remove device error: {str(e)}")
        return jsonify({'error': 'Failed to remove device'}), 500

@security_bp.route('/api/security/audit-logs', methods=['GET'])
@jwt_required()
def get_audit_logs():
    try:
        user_id = get_jwt_identity()
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        skip = (page - 1) * per_page
        
        logs = db.audit_logs.find({"user_id": user_id})\
            .sort("timestamp", -1)\
            .skip(skip)\
            .limit(per_page)
        
        log_list = []
        for log in logs:
            log_list.append({
                'id': str(log["_id"]),
                'action': log.get("action"),
                'resource': log.get("resource"),
                'status': log.get("status"),
                'details': log.get("details"),
                'timestamp': log.get("timestamp", datetime.utcnow()).isoformat()
            })
        
        total_logs = db.audit_logs.count_documents({"user_id": user_id})
        total_pages = (total_logs + per_page - 1) // per_page
        
        return jsonify({
            'audit_logs': log_list,
            'has_next': page < total_pages,
            'has_prev': page > 1,
            'page': page,
            'total_pages': total_pages
        })
        
    except Exception as e:
        current_app.logger.error(f"Get audit logs error: {str(e)}")
        return jsonify({'error': 'Failed to fetch audit logs'}), 500

@security_bp.route('/api/security/session-keys', methods=['GET'])
@jwt_required()
def get_session_keys():
    try:
        user_id = get_jwt_identity()
        
        keys = db.session_keys.find({"user_id": user_id})\
            .sort("created_at", -1)\
            .limit(10)
        
        key_list = []
        for key in keys:
            full_key = key.get("session_key", "")
            key_list.append({
                'id': str(key["_id"]),
                'session_key': f"{full_key[:16]}..." if full_key else "None",
                'created_at': key.get("created_at", datetime.utcnow()).isoformat(),
                'expires_at': key.get("expires_at", datetime.utcnow()).isoformat(),
                'is_active': key.get("is_active", False)
            })
        
        return jsonify({'session_keys': key_list})
        
    except Exception as e:
        current_app.logger.error(f"Get session keys error: {str(e)}")
        return jsonify({'error': 'Failed to fetch session keys'}), 500

@security_bp.route('/api/logout', methods=['POST'])
@jwt_required()
def logout():
    try:
        user_id = get_jwt_identity()
        
        # Log logout action
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "logout",
            "resource": "auth",
            "status": "success",
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        current_app.logger.error(f"Logout error: {str(e)}")
        return jsonify({'error': 'Failed to logout'}), 500