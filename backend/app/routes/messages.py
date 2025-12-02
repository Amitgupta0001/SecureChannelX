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

        # Verify user is a participant
        user_id = get_jwt_identity()
        chat = db.chats.find_one({"_id": chat_oid})
        
        if not chat:
            return error("Chat not found", 404)
            
        if user_id not in chat.get("participants", []):
            logging.warning(f"[SECURITY] User {user_id} attempted to access chat {chat_id} without permission")
            return error("Unauthorized access to chat", 403)

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
