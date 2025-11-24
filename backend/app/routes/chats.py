# backend/app/routes/chats.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app.models.chat_model import chat_document

chats_bp = Blueprint("chats", __name__, url_prefix="/api/chats")
db = get_db()


# ============================================================
#                   CREATE CHAT (private or group)
# ============================================================
@chats_bp.route("/create", methods=["POST"])
@jwt_required()
def create_chat():
    try:
        data = request.get_json() or {}
        chat_type = data.get("chat_type")        # private | group
        participants = data.get("participants", [])
        title = data.get("title")
        description = data.get("description")

        if chat_type not in ("private", "group"):
            return error("Invalid chat_type. Must be 'private' or 'group'", 400)

        if not isinstance(participants, list) or len(participants) == 0:
            return error("participants must be a non-empty list", 400)

        current_user = get_jwt_identity()
        if current_user not in participants:
            participants.append(current_user)

        # Build chat document using updated chat_model.py
        doc = chat_document(
            chat_type=chat_type,
            participants=participants,
            created_by=current_user,
            title=title,
            description=description
        )

        result = db.chats.insert_one(doc)
        doc["_id"] = str(result.inserted_id)

        return success("Chat created", {"chat": doc},)

    except Exception as e:
        current_app.logger.error(f"[CREATE CHAT ERROR] {str(e)}")
        return error("Failed to create chat", 500)


# ============================================================
#                       GET CHAT BY ID
# ============================================================
@chats_bp.route("/<chat_id>", methods=["GET"])
@jwt_required()
def get_chat(chat_id):
    try:
        chat = db.chats.find_one({"_id": ObjectId(chat_id)})
        if not chat:
            return error("Chat not found", 404)

        chat["_id"] = str(chat["_id"])
        chat["participants"] = [str(p) for p in chat.get("participants", [])]

        return success(data={"chat": chat})

    except Exception as e:
        current_app.logger.error(f"[GET CHAT ERROR] {str(e)}")
        return error("Failed to fetch chat", 500)


# ============================================================
#                 LIST ALL CHATS FOR CURRENT USER
# ============================================================
@chats_bp.route("/list", methods=["GET"])
@jwt_required()
def list_user_chats():
    try:
        user_id = get_jwt_identity()

        cursor = db.chats.find({"participants": user_id}) \
                        .sort("last_message_at", -1)

        chats = []
        for c in cursor:
            chats.append({
                "_id": str(c["_id"]),
                "chat_type": c.get("chat_type"),
                "title": c.get("title"),
                "participants": [str(x) for x in c.get("participants", [])],
                "last_message_preview": c.get("last_message_preview"),
                "last_message_encrypted": c.get("last_message_encrypted"),
                "last_message_at": (
                    c.get("last_message_at").isoformat()
                    if c.get("last_message_at") else None
                ),
            })

        return success(data={"chats": chats})

    except Exception as e:
        current_app.logger.error(f"[LIST CHATS ERROR] {str(e)}")
        return error("Failed to list user chats", 500)
