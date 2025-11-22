# FILE: backend/app/routes/messages.py

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    verify_jwt_in_request
)
from flask_socketio import emit, join_room
from bson import ObjectId
from datetime import datetime
import logging

from app import socketio                     # ✅ FIXED IMPORT
from app.database import get_db
from app.security.advanced_encryption import encryption_service

from app.utils.response_builder import success, error

messages_bp = Blueprint("messages", __name__, url_prefix="/api/messages")
db = get_db()

# Track connected socket users: { user_id: sid }
connected_users = {}


# =====================================================================
#  SOCKET DECORATOR — AUTHENTICATES JWT FOR SOCKET EVENTS
# =====================================================================
def socket_authenticated(func):
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception:
            emit("error", {"message": "Unauthorized socket token"})
            return
        return func(*args, **kwargs)

    wrapper.__name__ = func.__name__
    return wrapper


# =====================================================================
#  SOCKET ― USER CONNECT
# =====================================================================
@socketio.on("connect")
def handle_connect():
    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()

        connected_users[user_id] = request.sid
        join_room(f"user:{user_id}")

        logging.info(f"[socket] User {user_id} connected (SID {request.sid})")

        emit("user_online", {"user_id": user_id}, broadcast=True)

    except Exception as e:
        logging.error(f"[socket connect error] {e}")
        emit("error", {"message": "Unauthorized connection"})
        return False


# =====================================================================
#  SOCKET ― SEND ENCRYPTED MESSAGE
# =====================================================================
@socketio.on("message:send")
@socket_authenticated
def handle_send_message(data):
    try:
        user_id = get_jwt_identity()

        chat_id = data.get("chat_id")
        content = data.get("content")
        message_type = data.get("message_type", "text")

        if not chat_id or not content:
            emit("error", {"message": "chat_id and content required"})
            return

        try:
            chat_oid = ObjectId(chat_id)
        except:
            emit("error", {"message": "Invalid chat_id"})
            return

        # Get latest active session key
        session_key_record = db.session_keys.find_one(
            {"user_id": user_id, "is_active": True},
            sort=[("created_at", -1)]
        )

        if not session_key_record:
            emit("error", {"message": "No active encryption session"})
            return

        session_key = bytes.fromhex(session_key_record["session_key"])

        # Encrypt content with AES-GCM
        encrypted_blob = encryption_service.encrypt_message(content, session_key)

        message_doc = {
            "chat_id": chat_oid,
            "sender_id": user_id,
            "encrypted_content": encrypted_blob,
            "message_type": message_type,
            "created_at": datetime.utcnow(),
            "e2e_encrypted": True,
            "reactions": [],
            "is_deleted": False,
            "is_edited": False,
        }

        inserted = db.messages.insert_one(message_doc)
        msg_id = str(inserted.inserted_id)

        broadcast_data = {
            "id": msg_id,
            "chat_id": chat_id,
            "user_id": user_id,
            "encrypted_content": encrypted_blob,
            "timestamp": message_doc["created_at"].isoformat(),
            "message_type": message_type,
            "e2e_encrypted": True,
        }

        # Send to chat room
        socketio.emit("message:new", {"message": broadcast_data}, room=f"chat:{chat_id}")

    except Exception as e:
        logging.error(f"[message send error] {e}")
        emit("error", {"message": "Failed to send encrypted message"})


# =====================================================================
#  SOCKET ― PROVIDE SESSION KEY FOR DECRYPTION
# =====================================================================
@socketio.on("message:request_decryption_key")
@socket_authenticated
def handle_key_request(data):
    try:
        user_id = get_jwt_identity()
        msg_id = data.get("message_id")

        if not msg_id:
            emit("error", {"message": "message_id required"})
            return

        try:
            msg = db.messages.find_one({"_id": ObjectId(msg_id)})
        except:
            emit("error", {"message": "Invalid message ID"})
            return

        if not msg:
            emit("error", {"message": "Message not found"})
            return

        # Verify user is part of the chat
        chat = db.chats.find_one({"_id": msg["chat_id"]})
        if not chat or user_id not in chat.get("participants", []):
            emit("error", {"message": "Unauthorized"})
            return

        key_record = db.session_keys.find_one(
            {"user_id": user_id, "is_active": True},
            sort=[("created_at", -1)]
        )

        if not key_record:
            emit("error", {"message": "No active key"})
            return

        emit("message:decryption_key", {
            "message_id": msg_id,
            "session_key": key_record["session_key"]
        })

    except Exception as e:
        logging.error(f"[decryption-key-error] {e}")
        emit("error", {"message": "Failed to fetch decryption key"})


# =====================================================================
#  SOCKET ― DOUBLE RATCHET MESSAGE ENCRYPTION
# =====================================================================
@socketio.on("ratchet:encrypt")
@socket_authenticated
def handle_ratchet_encrypt(data):
    try:
        user_id = get_jwt_identity()

        session_id = data.get("session_id")
        content = data.get("content")
        target_user = data.get("target_user_id")

        if not all([session_id, content, target_user]):
            emit("error", {"message": "Missing session_id, content, or target_user"})
            return

        encrypted_payload = encryption_service.ratchet_encrypt_message(
            session_id,
            content
        )

        target_sid = connected_users.get(target_user)
        if target_sid:
            emit("ratchet:message", encrypted_payload, room=target_sid)

    except Exception as e:
        logging.error(f"[ratchet encrypt error] {e}")
        emit("error", {"message": "Double ratchet encryption failed"})


# =====================================================================
#  REST ― GET ENCRYPTED MESSAGES
# =====================================================================
@messages_bp.route("/<chat_id>", methods=["GET"])
@jwt_required()
def get_messages(chat_id):
    try:
        try:
            chat_oid = ObjectId(chat_id)
        except:
            return jsonify({"error": "Invalid chat_id"}), 400

        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 50))
        skip = (page - 1) * per_page

        cursor = (
            db.messages.find({"chat_id": chat_oid, "is_deleted": False})
            .sort("created_at", -1)
            .skip(skip)
            .limit(per_page)
        )

        messages = []
        for m in cursor:
            messages.append({
                "id": str(m["_id"]),
                "chat_id": chat_id,
                "user_id": m["sender_id"],
                "encrypted_content": m["encrypted_content"],
                "timestamp": m["created_at"].isoformat(),
                "message_type": m.get("message_type", "text"),
                "e2e_encrypted": True,
                "reactions": m.get("reactions", []),
            })

        total = db.messages.count_documents(
            {"chat_id": chat_oid, "is_deleted": False}
        )
        total_pages = (total + per_page - 1) // per_page

        return jsonify({
            "messages": messages[::-1],
            "page": page,
            "total_pages": total_pages,
            "total_messages": total,
            "has_next": page < total_pages,
            "has_prev": page > 1
        })

    except Exception as e:
        logging.error(f"[REST get_messages] {e}")
        return jsonify({"error": "Failed to fetch messages"}), 500
