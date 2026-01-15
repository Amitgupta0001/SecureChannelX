"""
SecureChannelX - Password Reset
-------------------------------
Secure password reset with email verification
"""

import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional

from flask import Blueprint, request, jsonify
from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)

password_reset_bp = Blueprint('password_reset', __name__)


class PasswordResetManager:
    """Manages password reset tokens and flow"""
    
    def __init__(self, db=None):
        self.db = db or get_db()
        self.token_expiry_hours = 1  # Reset tokens expire in 1 hour
    
    def generate_reset_token(self, email: str) -> Optional[str]:
        """
        Generate password reset token
        
        Args:
            email: User email
            
        Returns:
            Reset token or None if user not found
        """
        # Find user
        user = self.db.users.find_one({'email': email})
        if not user:
            logger.warning(f"[PasswordReset] Reset requested for non-existent email: {email}")
            return None
        
        # Generate secure token
        token = secrets.token_urlsafe(32)
        
        # Store token with expiry
        expires_at = now_utc() + timedelta(hours=self.token_expiry_hours)
        
        self.db.password_reset_tokens.insert_one({
            'user_id': str(user['_id']),
            'email': email,
            'token': token,
            'created_at': now_utc(),
            'expires_at': expires_at,
            'used': False
        })
        
        logger.info(f"[PasswordReset] Token generated for user: {user['username']}")
        return token
    
    def verify_reset_token(self, token: str) -> Optional[dict]:
        """
        Verify reset token is valid
        
        Args:
            token: Reset token
            
        Returns:
            Token data or None if invalid
        """
        token_data = self.db.password_reset_tokens.find_one({
            'token': token,
            'used': False
        })
        
        if not token_data:
            logger.warning("[PasswordReset] Invalid token")
            return None
        
        # Check if expired
        if token_data['expires_at'] < now_utc():
            logger.warning("[PasswordReset] Expired token")
            return None
        
        return token_data
    
    def reset_password(self, token: str, new_password: str) -> bool:
        """
        Reset password with token
        
        Args:
            token: Reset token
            new_password: New password
            
        Returns:
            True if successful
        """
        # Verify token
        token_data = self.verify_reset_token(token)
        if not token_data:
            return False
        
        # Hash new password
        from flask_bcrypt import Bcrypt
        bcrypt = Bcrypt()
        password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
        
        # Update password
        self.db.users.update_one(
            {'_id': token_data['user_id']},
            {'$set': {
                'password': password_hash,
                'updated_at': now_utc()
            }}
        )
        
        # Mark token as used
        self.db.password_reset_tokens.update_one(
            {'token': token},
            {'$set': {'used': True, 'used_at': now_utc()}}
        )
        
        logger.info(f"[PasswordReset] Password reset successful for user: {token_data['user_id']}")
        return True
    
    def send_reset_email(self, email: str, token: str):
        """
        Send password reset email
        
        Args:
            email: User email
            token: Reset token
        """
        # In production, use actual email service (SendGrid, AWS SES, etc.)
        reset_link = f"http://localhost:3000/reset-password?token={token}"
        
        # For now, just log (in production, send actual email)
        logger.info(f"[PasswordReset] Reset link: {reset_link}")
        
        # TODO: Implement actual email sending
        # from flask_mail import Message
        # msg = Message(
        #     'Password Reset - SecureChannelX',
        #     recipients=[email],
        #     body=f'Click here to reset your password: {reset_link}'
        # )
        # mail.send(msg)


# Routes
@password_reset_bp.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset"""
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email required'}), 400
    
    manager = PasswordResetManager()
    token = manager.generate_reset_token(email)
    
    if token:
        manager.send_reset_email(email, token)
    
    # Always return success (don't reveal if email exists)
    return jsonify({
        'message': 'If that email exists, a reset link has been sent'
    }), 200


@password_reset_bp.route('/api/auth/verify-reset-token', methods=['POST'])
def verify_reset_token():
    """Verify reset token is valid"""
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    manager = PasswordResetManager()
    token_data = manager.verify_reset_token(token)
    
    if token_data:
        return jsonify({'valid': True}), 200
    else:
        return jsonify({'valid': False, 'error': 'Invalid or expired token'}), 400


@password_reset_bp.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset password with token"""
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')
    
    if not token or not new_password:
        return jsonify({'error': 'Token and new password required'}), 400
    
    # Validate password strength
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    manager = PasswordResetManager()
    success = manager.reset_password(token, new_password)
    
    if success:
        return jsonify({'message': 'Password reset successful'}), 200
    else:
        return jsonify({'error': 'Invalid or expired token'}), 400


__all__ = ['password_reset_bp', 'PasswordResetManager']
