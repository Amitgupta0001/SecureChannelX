"""
WebRTC signaling + call lifecycle handler (production-ready)
-----------------------------------------------------------

Handles:
- Offers / Answers
- ICE candidates
- Call start, accept, end
- Call DB updates (status → ringing/accepted/ended/missed)
- Socket room routing
"""

from app import socketio
from app.database import get_db
from bson import ObjectId
from datetime import datetime
import traceback


# --------------------------------------------
#  HELPER: Emit safely
# --------------------------------------------
def safe_emit(event, payload, room=None):
    try:
        socketio.emit(event, payload, room=room)
    except Exception:
        print(f"[socket emit error] event={event}")
        print(traceback.format_exc())


# ============================================================
#  JOIN ROOMS (required for signaling to work properly)
# ============================================================

@socketio.on("join:user")
def join_user_room(data):
    """
    data: { user_id: "<id>" }
    """
    try:
        user_id = str(data.get("user_id"))
        if user_id:
            socketio.join_room(f"user:{user_id}")
    except Exception:
        print("[join:user] error")
        print(traceback.format_exc())


@socketio.on("join:chat")
def join_chat_room(data):
    """
    data: { chat_id: "<id>" }
    """
    try:
        chat_id = str(data.get("chat_id"))
        if chat_id:
            socketio.join_room(f"chat:{chat_id}")
    except Exception:
        print("[join:chat] error")
        print(traceback.format_exc())


# ============================================================
#  SIGNALING EVENTS
# ============================================================

@socketio.on("call:offer")
def on_call_offer(data):
    """
    data: {
        caller_id: str,
        callee_id: str,
        chat_id: str,
        sdp: {...}
    }
    """
    try:
        callee = data.get("callee_id")
        if not callee:
            return

        # notify callee
        safe_emit("call:offer", data, room=f"user:{callee}")

    except Exception:
        print("[call:offer] error")
        print(traceback.format_exc())


@socketio.on("call:answer")
def on_call_answer(data):
    """
    data: {
        caller_id: str,
        callee_id: str,
        chat_id: str,
        sdp: {...}
    }
    """
    try:
        caller = data.get("caller_id")
        if not caller:
            return

        safe_emit("call:answer", data, room=f"user:{caller}")

    except Exception:
        print("[call:answer] error")
        print(traceback.format_exc())


@socketio.on("call:ice")
def on_call_ice(data):
    """
    data: {
        to: <user_id>,
        candidate: {...}
    }
    """
    try:
        target = data.get("to")
        if not target:
            return

        safe_emit("call:ice", data, room=f"user:{target}")

    except Exception:
        print("[call:ice] error")
        print(traceback.format_exc())


# ============================================================
#  CALL LIFECYCLE MANAGEMENT
# ============================================================

@socketio.on("call:start")
def on_call_start(data):
    """
    data: {
        chat_id: str,
        caller_id: str,
        receiver_id: str,
        call_type: "audio" | "video"
    }
    """
    try:
        db = get_db()

        chat_id = data.get("chat_id")
        caller = data.get("caller_id")
        receiver = data.get("receiver_id")
        call_type = data.get("call_type", "audio")

        if not chat_id or not caller or not receiver:
            return

        call_doc = {
            "chat_id": ObjectId(chat_id),
            "caller_id": caller,
            "receiver_id": receiver,
            "call_type": call_type,
            "status": "ringing",
            "started_at": datetime.utcnow(),
            "ended_at": None,
            "duration_seconds": None,
            "call_metadata": {}
        }

        res = db.calls.insert_one(call_doc)
        call_id = str(res.inserted_id)

        call_doc["_id"] = call_id
        call_doc["chat_id"] = chat_id  # convert

        # notify receiver of incoming call
        safe_emit("call:incoming", call_doc, room=f"user:{receiver}")

    except Exception:
        print("[call:start] error")
        print(traceback.format_exc())


@socketio.on("call:accept")
def on_call_accept(data):
    """
    data: {
        call_id: str,
        chat_id: str,
        accepted_by: user_id
    }
    """
    try:
        db = get_db()

        call_id = data.get("call_id")
        chat_id = data.get("chat_id")

        if not call_id:
            return

        db.calls.update_one(
            {"_id": ObjectId(call_id)},
            {"$set": {"status": "accepted"}}
        )

        safe_emit("call:accepted", data, room=f"chat:{chat_id}")

    except Exception:
        print("[call:accept] error")
        print(traceback.format_exc())


@socketio.on("call:end")
def on_call_end(data):
    """
    data: {
        call_id: str,
        chat_id: str,
        ended_by: str
    }
    """
    try:
        db = get_db()

        call_id = data.get("call_id")
        chat_id = data.get("chat_id")
        ended_by = data.get("ended_by")

        if not call_id or not chat_id:
            return

        # update DB end info
        db.calls.update_one(
            {"_id": ObjectId(call_id)},
            {
                "$set": {
                    "status": "ended",
                    "ended_at": datetime.utcnow()
                }
            }
        )

        # notify chat members
        safe_emit(
            "call:ended",
            {"call_id": call_id, "ended_by": ended_by},
            room=f"chat:{chat_id}"
        )

    except Exception:
        print("[call:end] error")
        print(traceback.format_exc())
