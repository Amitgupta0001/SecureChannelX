from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import get_db
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from bson import ObjectId

file_upload_bp = Blueprint("file_upload", __name__)

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf", "mp4", "mp3", "zip", "txt"}

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
        return jsonify({"error": "Invalid file type"}), 400

    filename = secure_filename(file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)

    # Create message document (type: file)
    msg = {
        "chat_id": ObjectId(chat_id),
        "sender_id": user_id,
        "message_type": "file",
        "content": file_path,              # File path stored
        "extra": {"filename": filename},   # Metadata
        "reactions": [],
        "seen_by": [],
        "created_at": datetime.utcnow()
    }

    result = db.messages.insert_one(msg)
    msg["_id"] = str(result.inserted_id)

    return jsonify({
        "message": "File uploaded successfully",
        "file_message": msg
    })
