from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import get_db
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from bson import ObjectId

file_upload_bp = Blueprint("file_upload", __name__)

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "pdf", "mp4", "mp3", "zip", "txt"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@file_upload_bp.route("/upload/file", methods=["POST"])
@jwt_required()
def upload_file():
    db = get_db()
    user_id = get_jwt_identity()

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    chat_id = request.form.get("chat_id")

    if not chat_id:
        return jsonify({"error": "chat_id required"}), 400

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Allowed: images, PDFs, videos, documents"}), 400

    # Validate file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset file pointer
    
    if file_size > MAX_FILE_SIZE:
        size_mb = MAX_FILE_SIZE / 1024 / 1024
        actual_mb = file_size / 1024 / 1024
        return jsonify({
            "error": f"File too large. Maximum size is {size_mb:.0f}MB, your file is {actual_mb:.2f}MB"
        }), 400
    
    if file_size == 0:
        return jsonify({"error": "Cannot upload empty files"}), 400

    # Ensure upload directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    filename = secure_filename(file.filename)
    # Add timestamp to avoid filename conflicts
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{filename}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)

    # Create message document (type: file)
    msg = {
        "chat_id": ObjectId(chat_id),
        "sender_id": user_id,
        "message_type": "file",
        "content": file_path,              # File path stored
        "extra": {
            "filename": filename,
            "unique_filename": unique_filename,
            "file_size": file_size,
            "mime_type": file.content_type
        },
        "reactions": [],
        "seen_by": [],
        "created_at": datetime.utcnow()
    }

    result = db.messages.insert_one(msg)
    msg["_id"] = str(result.inserted_id)
    msg["chat_id"] = str(msg["chat_id"])  # Convert ObjectId to string for JSON

    return jsonify({
        "success": True,
        "message": "File uploaded successfully",
        "file_message": msg,
        "file_size_mb": round(file_size / 1024 / 1024, 2)
    }), 200
