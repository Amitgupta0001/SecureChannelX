"""
Socket handlers for real-time chat events:
 - Joining/leaving chat rooms
 - Realtime message sending
 - Message broadcasting
 - Presence notifications
"""

from app import socketio
from flask_socketio import join_room, leave_room
from flask import request
from app.database import get_db
from bson import ObjectId
from datetime import datetime
import traceback


# =====================================================
#  SOCKET CONNECT
# =====================================================

@socketio.on("connect")
def on_connect():
    """
    Fired when a client opens a WebSocket connection.
    Here you should validate the JWT token if provided.
    """
    try:
        sid = request.sid
        print(f"[socket] Connected: sid={sid}")

        # If JWT token is provided in query string, verify it
        # Example:
        # token = request.args.get("token")
        # validate JWT here if needed

    except Exception:
        print("[connect] error:", traceback.format_exc())


# =====================================================
#  JOIN CHAT ROOM
# =====================================================

@socketio.on("join_chat")
def on_join_chat(data):
    """
    data = { chat_id: str, user_id: str }
    """
    try:
        chat_id = str(data.get("chat_id"))
        user_id = str(data.get("user_id"))

        if not chat_id or not user_id:
            return

        room = f"chat:{chat_id}"

        join_room(room)
        print(f"[socket] {user_id} joined {room}")

        # Notify room members
        socketio.emit(
            "member:joined",
            {"chat_id": chat_id, "user_id": user_id},
            room=room
        )

    except Exception:
        print("[join_chat] error:", traceback.format_exc())


# =====================================================
#  LEAVE CHAT ROOM
# =====================================================

@socketio.on("leave_chat")
def on_leave_chat(data):
    """
    data = { chat_id: str, user_id: str }
    """
    try:
        chat_id = str(data.get("chat_id"))
        user_id = str(data.get("user_id"))

        if not chat_id or not user_id:
            return

        room = f"chat:{chat_id}"
        leave_room(room)

        print(f"[socket] {user_id} left {room}")

        socketio.emit(
            "member:left",
            {"chat_id": chat_id, "user_id": user_id},
            room=room
        )

    except Exception:
        print("[leave_chat] error:", traceback.format_exc())


# =====================================================
#  SEND REAL-TIME MESSAGE
# =====================================================

@socketio.on("message:send")
def on_message_send(payload):
    """
    payload:
      {
        chat_id: str,
        message: {
            sender_id: str,
            content: str,
            message_type: "text" | "file" | ...,
            extra: dict?
        }
      }
    """
    try:
        db = get_db()

        chat_id = payload.get("chat_id")
        message = payload.get("message")

        if not chat_id or not message:
            return

        sender_id = message.get("sender_id")
        content = message.get("content", "")

        # Build DB document
        doc = {
            "chat_id": ObjectId(chat_id),
            "sender_id": sender_id,
            "message_type": message.get("message_type", "text"),
            "content": content,
            "extra": message.get("extra", {}),
            "reactions": [],
            "seen_by": [sender_id],
            "created_at": datetime.utcnow()
        }

        res = db.messages.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        doc["chat_id"] = str(chat_id)

        # Update chat preview
        preview = content if doc["message_type"] == "text" else f"[{doc['message_type']}]"

        db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$set": {
                    "last_message_preview": preview,
                    "last_message_at": datetime.utcnow()
                }
            }
        )

        # Emit message to chat room
        room = f"chat:{chat_id}"
        socketio.emit("message:new", {"message": doc}, room=room)

    except Exception:
        print("[message:send] error:", traceback.format_exc())
