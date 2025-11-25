"""
Typing indicator socket events
------------------------------
Broadcasts "user is typing" and "user stopped typing" notifications
to all members of a chat:<chat_id> room.
"""

from app import socketio
from flask import request
import traceback


@socketio.on("typing:start")
def on_typing_start(data):
    """
    data = { chat_id: str, user_id: str }
    Emits:
        typing:started
    """
    try:
        chat_id = data.get("chat_id")
        user_id = data.get("user_id")

        if not chat_id or not user_id:
            return

        room = f"chat:{chat_id}"

        socketio.emit(
            "typing:started",
            {"chat_id": chat_id, "user_id": user_id},
            room=room,
            skip_sid=request.sid  # Do not send back to the typer
        )

    except Exception:
        print("[typing:start] error:", traceback.format_exc())


@socketio.on("typing:stop")
def on_typing_stop(data):
    """
    data = { chat_id: str, user_id: str }
    Emits:
        typing:stopped
    """
    try:
        chat_id = data.get("chat_id")
        user_id = data.get("user_id")

        if not chat_id or not user_id:
            return

        room = f"chat:{chat_id}"

        socketio.emit(
            "typing:stopped",
            {"chat_id": chat_id, "user_id": user_id},
            room=room,
            skip_sid=request.sid
        )

    except Exception:
        print("[typing:stop] error:", traceback.format_exc())
