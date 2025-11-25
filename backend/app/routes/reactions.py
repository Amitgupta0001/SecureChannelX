# backend/app/routes/reactions.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app import socketio

reactions_bp = Blueprint("reactions", __name__, url_prefix="/api/reactions")
db = get_db()


# ======================================================
#                     ADD REACTION
# ======================================================
@reactions_bp.route("/add", methods=["POST"])
@jwt_required()
def add_reaction():
    """
    Add a reaction to a message.
    Body:
        {
            "message_id": "<msg>",
            "emoji": "🔥"
        }
    """

    try:
        data = request.get_json() or {}
        message_id = data.get("message_id")
        emoji = data.get("emoji")
        user_id = get_jwt_identity()

        if not message_id or not emoji:
            return error("message_id and emoji are required", 400)

        # Validate emoji
        if not isinstance(emoji, str) or len(emoji.strip()) == 0:
            return error("Invalid emoji", 400)

        # Get message
        message = db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            return error("Message not found", 404)

        # Prevent duplicate reaction by same user with same emoji
        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {"$addToSet": {"reactions": {"user_id": user_id, "emoji": emoji}}}
        )

        # Emit socket event
        room = f"chat:{str(message['chat_id'])}"
        socketio.emit(
            "reaction:added",
            {
                "message_id": message_id,
                "emoji": emoji,
                "user_id": user_id,
                "timestamp": now_utc().isoformat()
            },
            room=room
        )

        return success("Reaction added")

    except Exception as e:
        current_app.logger.error(f"[REACTION ADD ERROR] {str(e)}")
        return error("Failed to add reaction", 500)
