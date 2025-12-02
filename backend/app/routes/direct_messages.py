# FILE: backend/app/routes/direct_messages.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app.models.chat_model import chat_document

dm_bp = Blueprint("direct_messages", __name__, url_prefix="/api/direct")
db = get_db()


# -----------------------------------------------------------
# Utility: Deterministic Room Name
# -----------------------------------------------------------
def dm_room_name(user_a: str, user_b: str):
    a, b = sorted([str(user_a), str(user_b)])
    return f"dm:{a}:{b}"


# -----------------------------------------------------------
#  OPEN or CREATE A DM CHAT
# -----------------------------------------------------------
@dm_bp.route("/open/<other_user_id>", methods=["POST"])
@jwt_required()
def open_dm(other_user_id):
    try:
        current_user = get_jwt_identity()

        # Ensure IDs are strings for DB (your chats collection stores them as strings)
        current_user = str(current_user)
        other_user_id = str(other_user_id)

        # -----------------------------
        #   FIND EXISTING PRIVATE CHAT
        # -----------------------------
        chat = db.chats.find_one({
            "chat_type": "private",
            "participants": {"$all": [current_user, other_user_id]},
            "$expr": {"$eq": [{"$size": "$participants"}, 2]}
        })

        if chat:
            chat["_id"] = str(chat["_id"])
            chat["participants"] = [str(p) for p in chat.get("participants", [])]
            return success("DM chat found", {"chat": chat})

        # -----------------------------
        #   CREATE NEW PRIVATE CHAT
        # -----------------------------
        doc = chat_document(
            chat_type="private",
            participants=[current_user, other_user_id],
            created_by=current_user,
        )

        inserted_id = db.chats.insert_one(doc).inserted_id
        doc["_id"] = str(inserted_id)

        return success("DM chat created", {"chat": doc})

    except Exception as e:
        current_app.logger.error(f"[DM OPEN ERROR] {e}")
        return error("Failed to open or create DM", 500)


# -----------------------------------------------------------
#  FETCH MESSAGES (Supports infinite scroll)
# -----------------------------------------------------------
@dm_bp.route("/room/<other_user_id>", methods=["GET"])
@jwt_required()
def get_dm_messages(other_user_id):
    try:
        current_user = get_jwt_identity()
        current_user = str(current_user)
        other_user_id = str(other_user_id)

        # Pagination support (WhatsApp-style infinite scroll)
        limit = int(request.args.get("limit", 50))
        before_ts = request.args.get("before")

        # -----------------------------
        #   Locate the private chat
        # -----------------------------
        chat = db.chats.find_one({
            "chat_type": "private",
            "participants": {"$all": [current_user, other_user_id]},
            "$expr": {"$eq": [{"$size": "$participants"}, 2]}
        })

        if not chat:
            return success(data={"messages": []})  # No DM yet

        chat_id = str(chat["_id"])

        # -----------------------------
        #   FETCH MESSAGES
        # -----------------------------
        query = {
            "chat_id": ObjectId(chat_id),
            "is_deleted": False
        }

        if before_ts:
            query["created_at"] = {"$lt": before_ts}

        cursor = db.messages.find(query)\
            .sort("created_at", -1)\
            .limit(limit)

        messages = []
        for m in cursor:
            messages.append({
                "id": str(m["_id"]),
                "chat_id": chat_id,
                "sender_id": m.get("sender_id"),
                "content": m.get("content"),                 # plaintext (if saved)
                "encrypted_content": m.get("encrypted_content"),
                "message_type": m.get("message_type"),
                "reactions": m.get("reactions", []),
                "seen_by": m.get("seen_by", []),
                "parent_id": m.get("parent_id"),
                "is_deleted": m.get("is_deleted", False),
                "is_edited": m.get("is_edited", False),
                "created_at": m.get("created_at").isoformat() if m.get("created_at") else now_utc().isoformat(),
                "updated_at": m.get("updated_at").isoformat() if m.get("updated_at") else now_utc().isoformat(),
            })

        # Return messages oldest-first for chat UI
        messages.reverse()

        # -----------------------------
        #   AUTO-UPDATE READ RECEIPTS
        # -----------------------------
        db.messages.update_many(
            {
                "chat_id": ObjectId(chat_id),
                "sender_id": {"$ne": current_user},
                "seen_by": {"$ne": current_user}
            },
            {
                "$addToSet": {"seen_by": current_user}
            }
        )

        # -----------------------------
        #   RESET UNREAD COUNT
        # -----------------------------
        db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {f"unread_count.{current_user}": 0}}
        )

        return success(data={"messages": messages})

    except Exception as e:
        current_app.logger.error(f"[DM MESSAGE ERROR] {e}")
        return error("Failed to fetch DM messages", 500)
