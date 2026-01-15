"""
SecureChannelX - Secure File Handling
-------------------------------------
Secure file upload/download with access control and optimization.
Note: In a full E2EE flow, files should be encrypted client-side. 
This module handles the secure storage and retrieval of those encrypted blobs.
"""

import os
import uuid
import logging
import mimetypes
from datetime import datetime
from typing import Optional, Dict

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.database import get_db

logger = logging.getLogger(__name__)

files_bp = Blueprint('files', __name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'storage', 'uploads')
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB limit per default
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'zip', 'enc'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

class SecureFileManager:
    """Manages secure file storage and retrieval"""
    
    def __init__(self, db=None):
        self.db = db or get_db()
        self.upload_folder = UPLOAD_FOLDER
    
    def allowed_file(self, filename: str) -> bool:
        """Check if file extension is allowed"""
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    
    def save_file(self, file_obj, uploader_id: str, encrypted: bool = False) -> Dict:
        """
        Save an uploaded file securely
        
        Args:
            file_obj: The file object from request.files
            uploader_id: ID of the user uploading
            encrypted: Whether the client has already encrypted this file
        
        Returns:
            Metadata dictionary of stored file
        """
        if not file_obj or file_obj.filename == '':
            raise ValueError("No valid file provided")
            
        if not self.allowed_file(file_obj.filename):
            raise ValueError("File type not allowed")

        # Generate unique secure secure filename
        original_filename = secure_filename(file_obj.filename)
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'bin'
        file_id = str(uuid.uuid4())
        unique_filename = f"{file_id}.{ext}"
        file_path = os.path.join(self.upload_folder, unique_filename)
        
        # Save file
        try:
            file_obj.save(file_path)
            size = os.path.getsize(file_path)
        except Exception as e:
            logger.error(f"[Files] Failed to save file: {e}")
            raise IOError("Storage error")

        # Create metadata entry
        file_metadata = {
            'file_id': file_id,
            'original_name': original_filename,
            'stored_name': unique_filename,
            'uploader_id': uploader_id,
            'size': size,
            'mime_type': mimetypes.guess_type(original_filename)[0] or 'application/octet-stream',
            'encrypted': encrypted,  # Flag if client-side encrypted
            'upload_date': datetime.utcnow(),
            'downloads': 0
        }
        
        self.db.files.insert_one(file_metadata)
        
        logger.info(f"[Files] File saved: {unique_filename} by {uploader_id}")
        return file_metadata

    def get_file_metadata(self, file_id: str) -> Optional[Dict]:
        """Get file metadata"""
        file_data = self.db.files.find_one({'file_id': file_id}, {'_id': 0})
        return file_data

    def get_file_path(self, file_id: str) -> Optional[str]:
        """Get physical path if allowed"""
        metadata = self.get_file_metadata(file_id)
        if not metadata:
            return None
        return os.path.join(self.upload_folder, metadata['stored_name'])

    def record_download(self, file_id: str):
        """Increment download counter"""
        self.db.files.update_one(
            {'file_id': file_id},
            {'$inc': {'downloads': 1}}
        )

# Routes

@files_bp.route('/api/files/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """
    Upload a file
    
    Data form:
    - file: binary
    - encrypted: 'true'/'false' (optional)
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
        
    file = request.files['file']
    user_id = get_jwt_identity()
    is_encrypted = request.form.get('encrypted', 'false').lower() == 'true'
    
    manager = SecureFileManager()
    
    try:
        metadata = manager.save_file(file, user_id, encrypted=is_encrypted)
        return jsonify({
            'message': 'File uploaded successfully',
            'file': metadata
        }), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@files_bp.route('/api/files/<file_id>', methods=['GET'])
@jwt_required()
def download_file(file_id):
    """
    Download a file by ID
    """
    user_id = get_jwt_identity()
    manager = SecureFileManager()
    
    metadata = manager.get_file_metadata(file_id)
    if not metadata:
        return jsonify({'error': 'File not found'}), 404
        
    # Access Control: For 1-on-1, ideally check if user is sender or recipient.
    # Since we lack a 'file_sharing' table linking files to messages/recipients efficiently here,
    # we currently only allow the uploader. 
    # TODO: In full E2EE integration, validate user is in the recipient list of the message containing this file.
    
    if metadata['uploader_id'] != user_id:
        # Check if this file is part of a message sent to this user
        # This requires querying messages to see if this file_id is attached to a message for user_id
        db = get_db()
        linked_message = db.messages.find_one({
            'attachments.file_id': file_id,
            '$or': [{'recipient_id': user_id}, {'sender_id': user_id}]
        })
        
        if not linked_message:
             return jsonify({'error': 'Access denied'}), 403

    path = manager.get_file_path(file_id)
    if not path or not os.path.exists(path):
        return jsonify({'error': 'File missing on server'}), 500
        
    manager.record_download(file_id)
    
    return send_file(
        path,
        mimetype=metadata['mime_type'],
        as_attachment=True,
        download_name=metadata['original_name']
    )

@files_bp.route('/api/files/<file_id>/meta', methods=['GET'])
@jwt_required()
def get_file_meta(file_id):
    """Get file metadata"""
    manager = SecureFileManager()
    metadata = manager.get_file_metadata(file_id)
    
    if not metadata:
        return jsonify({'error': 'File not found'}), 404
        
    return jsonify(metadata), 200

__all__ = ['files_bp', 'SecureFileManager']
