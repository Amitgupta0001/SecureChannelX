from flask import Blueprint, request, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from werkzeug.utils import secure_filename
import os
import mimetypes
from datetime import datetime
from bson import ObjectId
import hashlib
import shutil

file_upload_bp = Blueprint("file_upload", __name__, url_prefix="/api/files")

# ✅ FIXED: Use environment-based upload path
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "pdf", "mp4", "mp3", "zip", "txt", "doc", "docx", "xls", "xlsx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # ✅ FIXED: Increased to 50MB for videos
MAX_TOTAL_STORAGE = 5 * 1024 * 1024 * 1024  # 5GB per user

# ✅ FIXED: Create upload folder on startup
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, "thumbnails"), exist_ok=True)

db = get_db()


# ✅ FIXED: Validate file extension properly
def allowed_file(filename):
    if not filename or "." not in filename:
        return False
    
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


# ✅ FIXED: Calculate user storage usage
def get_user_storage_usage(user_id):
    try:
        cursor = db.messages.find({
            "sender_id": user_id,
            "message_type": "file"
        })
        
        total_size = 0
        for msg in cursor:
            total_size += msg.get("extra", {}).get("file_size", 0)
        
        return total_size
    except Exception as e:
        current_app.logger.error(f"[STORAGE USAGE ERROR] {e}")
        return 0


# ✅ FIXED: Get MIME type properly
def get_mime_type(filename):
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


# ✅ FIXED: Generate file hash for deduplication
def generate_file_hash(file_obj):
    try:
        file_hash = hashlib.md5()
        for chunk in iter(lambda: file_obj.read(4096), b""):
            file_hash.update(chunk)
        file_obj.seek(0)  # Reset file pointer
        return file_hash.hexdigest()
    except Exception as e:
        current_app.logger.error(f"[HASH ERROR] {e}")
        return None


@file_upload_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_file():
    """
    Upload a file to a chat
    
    Form data:
    - file: File object
    - chat_id: Chat ID where file is sent
    - encrypted_content: (Optional) Encrypted file content
    """
    try:
        user_id = get_jwt_identity()

        # ✅ FIXED: Validate file exists
        if "file" not in request.files:
            return error("No file provided", 400)

        file = request.files["file"]
        chat_id = request.form.get("chat_id")
        encrypted_content = request.form.get("encrypted_content")
        iv = request.form.get("iv")

        # ✅ FIXED: Validate required fields
        if not chat_id:
            return error("chat_id is required", 400)

        if file.filename == "":
            return error("Empty filename", 400)

        if not allowed_file(file.filename):
            return error(f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}", 400)

        # ✅ FIXED: Validate chat exists and user is participant
        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        chat = db.chats.find_one({"_id": chat_oid})
        if not chat:
            return error("Chat not found", 404)

        if user_id not in chat.get("participants", []):
            return error("Unauthorized: You are not a participant in this chat", 403)

        # ✅ FIXED: Validate file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)  # Reset file pointer
        
        if file_size == 0:
            return error("Cannot upload empty files", 400)
        
        if file_size > MAX_FILE_SIZE:
            size_mb = MAX_FILE_SIZE / 1024 / 1024
            actual_mb = file_size / 1024 / 1024
            return error(
                f"File too large. Maximum size is {size_mb:.0f}MB, your file is {actual_mb:.2f}MB",
                413
            )

        # ✅ FIXED: Check user storage quota
        user_storage = get_user_storage_usage(user_id)
        if user_storage + file_size > MAX_TOTAL_STORAGE:
            available_mb = (MAX_TOTAL_STORAGE - user_storage) / 1024 / 1024
            return error(
                f"Storage quota exceeded. Available: {available_mb:.2f}MB",
                507
            )

        # ✅ FIXED: Generate unique filename with hash
        original_filename = secure_filename(file.filename)
        file_hash = generate_file_hash(file)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        file_ext = original_filename.rsplit(".", 1)[1].lower() if "." in original_filename else ""
        unique_filename = f"{timestamp}_{file_hash[:8]}.{file_ext}" if file_ext else f"{timestamp}_{file_hash[:8]}"
        
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)

        # ✅ FIXED: Save file safely
        try:
            file.save(file_path)
            
            if not os.path.exists(file_path):
                return error("Failed to save file", 500)
                
        except Exception as save_error:
            current_app.logger.error(f"[FILE SAVE ERROR] {save_error}")
            return error("Failed to save file", 500)

        # ✅ FIXED: Get proper MIME type
        mime_type = get_mime_type(original_filename)

        # ✅ FIXED: Create message document with all required fields
        msg_doc = {
            "chat_id": chat_oid,
            "sender_id": user_id,
            "message_type": "file",
            "content": file_path,
            "encrypted_content": encrypted_content or None,
            "iv": iv or None,
            "extra": {
                "filename": original_filename,
                "unique_filename": unique_filename,
                "file_size": file_size,
                "mime_type": mime_type,
                "file_hash": file_hash,
                "upload_timestamp": timestamp
            },
            "reactions": {},
            "read_by": [user_id],  # ✅ Sender has read it
            "created_at": now_utc(),
            "edited_at": None,
            "is_deleted": False,
            "reply_to": None
        }

        # ✅ FIXED: Insert into database
        try:
            result = db.messages.insert_one(msg_doc)
            msg_doc["_id"] = str(result.inserted_id)
        except Exception as insert_error:
            current_app.logger.error(f"[INSERT MESSAGE ERROR] {insert_error}")
            # Clean up file if database insert fails
            try:
                os.remove(file_path)
            except:
                pass
            return error("Failed to save message", 500)

        # ✅ FIXED: Update chat's last message
        db.chats.update_one(
            {"_id": chat_oid},
            {
                "$set": {
                    "last_message_preview": f"📎 {original_filename}",
                    "last_message_at": now_utc(),
                    "last_message_encrypted": bool(encrypted_content)
                }
            }
        )

        # ✅ FIXED: Format response properly
        response_msg = {
            "id": str(msg_doc["_id"]),
            "message_id": str(msg_doc["_id"]),
            "_id": str(msg_doc["_id"]),
            "chat_id": str(msg_doc["chat_id"]),
            "sender_id": msg_doc["sender_id"],
            "message_type": msg_doc["message_type"],
            "content": msg_doc["content"],
            "encrypted_content": msg_doc.get("encrypted_content"),
            "iv": msg_doc.get("iv"),
            "extra": msg_doc["extra"],
            "created_at": msg_doc["created_at"].isoformat() if isinstance(msg_doc["created_at"], datetime) else msg_doc["created_at"],
            "reactions": msg_doc.get("reactions", {}),
            "read_by": msg_doc.get("read_by", [])
        }

        current_app.logger.info(f"[FILE UPLOAD] User {user_id} uploaded {original_filename} to chat {chat_id}")

        return success("File uploaded successfully", {
            "message": response_msg,
            "file": {
                "filename": original_filename,
                "size_mb": round(file_size / 1024 / 1024, 2),
                "mime_type": mime_type,
                "download_url": f"/api/files/download/{str(msg_doc['_id'])}"
            }
        })

    except Exception as e:
        current_app.logger.error(f"[FILE UPLOAD ERROR] {e}")
        return error("Internal server error", 500)


# ✅ FIXED: Add download endpoint
@file_upload_bp.route("/download/<message_id>", methods=["GET"])
@jwt_required()
def download_file(message_id):
    """
    Download a file from a message
    """
    try:
        user_id = get_jwt_identity()

        try:
            msg_oid = ObjectId(message_id)
        except:
            return error("Invalid message_id format", 400)

        msg = db.messages.find_one({"_id": msg_oid, "message_type": "file"})
        if not msg:
            return error("File not found", 404)

        # ✅ FIXED: Verify user is in chat
        chat_oid = msg.get("chat_id")
        chat = db.chats.find_one({"_id": chat_oid})
        
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        file_path = msg.get("content")
        original_filename = msg.get("extra", {}).get("filename", "download")

        # ✅ FIXED: Validate file exists
        if not os.path.exists(file_path):
            current_app.logger.error(f"[FILE NOT FOUND] {file_path}")
            return error("File not found on server", 404)

        try:
            # ✅ FIXED: Mark as read by downloader
            db.messages.update_one(
                {"_id": msg_oid},
                {"$addToSet": {"read_by": user_id}}
            )

            current_app.logger.info(f"[FILE DOWNLOAD] User {user_id} downloaded {original_filename}")
            
            return send_file(
                file_path,
                as_attachment=True,
                download_name=original_filename
            )
        except Exception as send_error:
            current_app.logger.error(f"[FILE SEND ERROR] {send_error}")
            return error("Failed to download file", 500)

    except Exception as e:
        current_app.logger.error(f"[FILE DOWNLOAD ERROR] {e}")
        return error("Internal server error", 500)


# ✅ FIXED: Add delete endpoint
@file_upload_bp.route("/delete/<message_id>", methods=["DELETE"])
@jwt_required()
def delete_file(message_id):
    """
    Delete a file (soft delete message)
    """
    try:
        user_id = get_jwt_identity()

        try:
            msg_oid = ObjectId(message_id)
        except:
            return error("Invalid message_id format", 400)

        msg = db.messages.find_one({"_id": msg_oid, "message_type": "file"})
        if not msg:
            return error("File not found", 404)

        # ✅ FIXED: Only sender can delete
        if msg.get("sender_id") != user_id:
            return error("Only sender can delete file", 403)

        file_path = msg.get("content")

        # ✅ FIXED: Soft delete message
        db.messages.update_one(
            {"_id": msg_oid},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": now_utc(),
                    "content": None,
                    "encrypted_content": None
                }
            }
        )

        # ✅ FIXED: Delete file from storage (optional)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                current_app.logger.info(f"[FILE DELETED] {file_path}")
        except Exception as delete_error:
            current_app.logger.warning(f"[FILE DELETE WARNING] Could not delete {file_path}: {delete_error}")

        return success("File deleted")

    except Exception as e:
        current_app.logger.error(f"[FILE DELETE ERROR] {e}")
        return error("Internal server error", 500)


# ✅ FIXED: Add file info endpoint
@file_upload_bp.route("/info/<message_id>", methods=["GET"])
@jwt_required()
def get_file_info(message_id):
    """
    Get file information
    """
    try:
        user_id = get_jwt_identity()

        try:
            msg_oid = ObjectId(message_id)
        except:
            return error("Invalid message_id format", 400)

        msg = db.messages.find_one({"_id": msg_oid, "message_type": "file"})
        if not msg:
            return error("File not found", 404)

        # ✅ FIXED: Verify user is in chat
        chat_oid = msg.get("chat_id")
        chat = db.chats.find_one({"_id": chat_oid})
        
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        extra = msg.get("extra", {})

        return success(data={
            "file": {
                "id": str(msg["_id"]),
                "filename": extra.get("filename"),
                "size_mb": round(extra.get("file_size", 0) / 1024 / 1024, 2),
                "mime_type": extra.get("mime_type"),
                "uploaded_by": msg.get("sender_id"),
                "uploaded_at": msg.get("created_at").isoformat() if isinstance(msg.get("created_at"), datetime) else msg.get("created_at"),
                "is_encrypted": bool(msg.get("encrypted_content")),
                "download_count": len(msg.get("read_by", [])),
                "download_url": f"/api/files/download/{str(msg['_id'])}"
            }
        })

    except Exception as e:
        current_app.logger.error(f"[FILE INFO ERROR] {e}")
        return error("Internal server error", 500)
