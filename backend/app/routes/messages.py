from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    verify_jwt_in_request
)
from flask_socketio import emit, join_room
from bson import ObjectId
from datetime import datetime
import logging

from app import socketio
from app.database import get_db
from app.utils.response_builder import success, error

messages_bp = Blueprint("messages", __name__, url_prefix="/api/messages")
# db = get_db()

# Track connected socket users
connected_users = {}

# ======================================================
#   SOCKET AUTH WRAPPER
# ======================================================
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

# ======================================================
#   SOCKET: CONNECT
# ======================================================
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

# ======================================================
#   SOCKET: SEND ENCRYPTED MESSAGE (ZERO KNOWLEDGE)
# ======================================================
@socketio.on("message:send")
@socket_authenticated
def handle_send_message(data):
    db = get_db()
    try:
        user_id = get_jwt_identity()
        chat_id = data.get("chat_id")
        
        # 'content' here is expected to be the encrypted blob (ciphertext)
        # It might be a JSON string or object containing { header, ciphertext, nonce }
        encrypted_content = data.get("content") 
        message_type = data.get("message_type", "text")
        
        # Optional: X3DH header for first message
        x3dh_header = data.get("x3dh_header")

        if not chat_id or not encrypted_content:
            emit("error", {"message": "chat_id and content required"})
            return

        try:
            chat_oid = ObjectId(chat_id)
        except:
            emit("error", {"message": "Invalid chat_id"})
            return

        # Store message exactly as received (Zero Knowledge)
        message_doc = {
            "chat_id": chat_oid,
            "sender_id": user_id,
            "encrypted_content": encrypted_content, # BLOB
            "x3dh_header": x3dh_header, # Optional for session init
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
            "encrypted_content": encrypted_content,
            "x3dh_header": x3dh_header,
            "timestamp": message_doc["created_at"].isoformat(),
            "message_type": message_type,
            "e2e_encrypted": True,
        }

        # Broadcast to chat room
        socketio.emit("message:new", {"message": broadcast_data}, room=f"chat:{chat_id}")

    except Exception as e:
        logging.error(f"[message send error] {e}")
        emit("error", {"message": "Failed to send message"})

# ======================================================
#   REST: GET MESSAGES
# ======================================================
@messages_bp.route("/<chat_id>", methods=["GET"])
@jwt_required()
def get_messages(chat_id):
    db = get_db()
    try:
        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id", 400)

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
                "x3dh_header": m.get("x3dh_header"),
                "timestamp": m["created_at"].isoformat(),
                "message_type": m.get("message_type", "text"),
                "e2e_encrypted": True,
                "reactions": m.get("reactions", []),
            })

        total = db.messages.count_documents({"chat_id": chat_oid, "is_deleted": False})
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
        return error("Failed to fetch messages", 500)
