# FILE: backend/app/routes/calls.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app import socketio      # ✅ FIXED import

# Utils
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc

# Models
from app.models.call_model import call_document

calls_bp = Blueprint("calls", __name__, url_prefix="/api/calls")
db = get_db()


# ============================================================
#                      CALL HISTORY
# ============================================================
@calls_bp.route("/history/<chat_id>", methods=["GET"])
@jwt_required()
def call_history(chat_id):
    try:
        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id", 400)

        cursor = db.calls.find({"chat_id": chat_oid}).sort("started_at", -1)

        calls = []
        for c in cursor:
            calls.append({
                "id": str(c["_id"]),
                "chat_id": str(c["chat_id"]),
                "caller_id": c["caller_id"],
                "receiver_id": c["receiver_id"],
                "call_type": c["call_type"],
                "status": c["status"],
                "started_at": c["started_at"].isoformat(),
                "ended_at": c["ended_at"].isoformat() if c.get("ended_at") else None,
                "duration_seconds": c.get("duration_seconds"),
                "call_metadata": c.get("call_metadata", {})
            })

        return success(data={"calls": calls})

    except Exception as e:
        current_app.logger.error(f"[CALL HISTORY ERROR] {str(e)}")
        return error("Failed to fetch call history", 500)


# ============================================================
#                        START A CALL
# ============================================================
@calls_bp.route("/start", methods=["POST"])
@jwt_required()
def start_call():
    """
    Starts an audio or video call.

    Expected JSON:
    {
        "chat_id": "...",
        "receiver_id": "...",
        "call_type": "audio" | "video"
    }
    """

    try:
        data = request.get_json() or {}

        chat_id = data.get("chat_id")
        receiver_id = data.get("receiver_id")
        call_type = data.get("call_type", "audio")
        caller_id = get_jwt_identity()

        if not chat_id or not receiver_id:
            return error("chat_id and receiver_id are required", 400)

        # Convert chat_id → ObjectId
        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        # Build call document using model
        call_doc = call_document(
            chat_id=str(chat_oid),
            caller_id=caller_id,
            receiver_id=receiver_id,
            call_type=call_type,
            status="ringing",
        )

        inserted_id = db.calls.insert_one(call_doc).inserted_id
        call_doc["_id"] = str(inserted_id)

        # Notify the receiver via WebSocket (private room)
        socketio.emit(
            "call:incoming",
            {"call": call_doc},
            room=f"user:{receiver_id}"   # User-specific room
        )

        return success("Call started", {"call": call_doc})

    except Exception as e:
        current_app.logger.error(f"[START CALL ERROR] {str(e)}")
        return error("Failed to start call", 500)
