# backend/app/routes/read_receipts.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app import socketio
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc

reads_bp = Blueprint("read_receipts", __name__, url_prefix="/api/read")


@reads_bp.route("/mark_seen", methods=["POST"])
@jwt_required()
def mark_seen():
    """
    Mark a message as seen by current user.
    Body:
        {
            "message_id": "<id>",
            "chat_id": "<id>"
        }
    """
    try:
        db = get_db()
        data = request.get_json() or {}

        message_id = data.get("message_id")
        chat_id = data.get("chat_id")
        user_id = get_jwt_identity()

        if not message_id or not chat_id:
            return error("message_id and chat_id are required", 400)

        # Update seen_by array
        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$addToSet": {"seen_by": user_id},
                "$set": {"updated_at": now_utc()}
            }
        )

        # Notify socket listeners
        socketio.emit(
            "message:seen",
            {
                "message_id": message_id,
                "user_id": user_id,
                "timestamp": now_utc().isoformat()
            },
            room=f"chat:{chat_id}"
        )

        return success("Message marked as seen")

    except Exception as e:
        current_app.logger.error(f"[READ RECEIPT ERROR] {str(e)}")
        return error("Failed to update read receipt", 500)
