# FILE: backend/app/routes/chats.py

from flask import Blueprint, request, current_app, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app.models.chat_model import chat_document

# ✅ FIXED: Use consistent blueprint name
chats_bp = Blueprint("chats", __name__, url_prefix="/api/chats")
db = get_db()

def _authorized():
    auth = request.headers.get("Authorization", "")
    return auth.startswith("Bearer ")

# ============================================================
#                   CREATE CHAT (private or group)
# ============================================================
@chats_bp.route("/create", methods=["POST"])
@jwt_required()
def create_chat():
    """
    Create a new private or group chat
    
    Expected JSON:
    {
        "chat_type": "private" | "group",
        "participants": ["user_id1", "user_id2", ...],
        "title": "Chat Title" (required for group),
        "description": "Chat Description" (optional)
    }
    """
    try:
        data = request.get_json() or {}

        chat_type = data.get("chat_type")
        participants = data.get("participants", [])
        title = data.get("title")
        description = data.get("description")

        if chat_type not in ("private", "group"):
            return error("Invalid chat_type. Must be 'private' or 'group'", 400)

        if not isinstance(participants, list) or len(participants) == 0:
            return error("participants must be a non-empty list", 400)

        current_user = get_jwt_identity()

        # Ensure string → ObjectId conversion & ensure current user is included
        final_participants = []

        for p in participants:
            try:
                p_oid = ObjectId(p) if isinstance(p, str) else p
                if p_oid not in final_participants:  # ✅ Avoid duplicates
                    final_participants.append(p_oid)
            except:
                return error(f"Invalid participant ID format: {p}", 400)

        # ✅ Add current user if not already included
        current_user_oid = ObjectId(current_user)
        if current_user_oid not in final_participants:
            final_participants.append(current_user_oid)

        # ✅ Validate private chats have exactly 2 participants
        if chat_type == "private" and len(final_participants) != 2:
            return error("Private chat must have exactly 2 participants", 400)

        # ✅ Validate group chats have a title
        if chat_type == "group" and not title:
            return error("Group chat requires a title", 400)

        # ✅ Validate all participants exist
        participant_count = db.users.count_documents({"_id": {"$in": final_participants}})
        if participant_count != len(final_participants):
            return error("One or more participants do not exist", 404)

        # ✅ PRIVATE CHAT CHECK - Find existing chat with same 2 participants
        if chat_type == "private":
            existing_chat = db.chats.find_one({
                "chat_type": "private",
                "participants": {
                    "$all": [str(p) for p in final_participants],
                    "$size": len(final_participants)
                }
            })

            if existing_chat:
                existing_chat["_id"] = str(existing_chat["_id"])
                existing_chat["participants"] = [str(p) for p in existing_chat.get("participants", [])]
                current_app.logger.info(f"[CHAT] Returned existing private chat {existing_chat['_id']}")
                return success("Chat already exists", {"chat": existing_chat, "existing": True})

        # ✅ CREATE NEW CHAT DOCUMENT
        doc = chat_document(
            chat_type=chat_type,
            participants=[str(p) for p in final_participants],  # ✅ Stored as strings for consistency
            created_by=current_user,
            title=title or None,
            description=description or None
        )

        result = db.chats.insert_one(doc)
        doc["_id"] = str(result.inserted_id)

        # ✅ Initialize unread counts for all participants
        db.chats.update_one(
            {"_id": ObjectId(doc["_id"])},
            {
                "$set": {
                    "unread_count": {str(p): 0 for p in final_participants}
                }
            }
        )

        current_app.logger.info(f"[CHAT] Created new {chat_type} chat {doc['_id']}")
        return success("Chat created", {"chat": doc, "existing": False})

    except Exception as e:
        current_app.logger.error(f"[CREATE CHAT ERROR] {e}")
        return error("Failed to create chat", 500)


# ============================================================
#                       GET CHAT BY ID
# ============================================================
@chats_bp.route("/<chat_id>", methods=["GET"])
@jwt_required()
def get_chat(chat_id):
    """
    Get detailed chat information by ID
    """
    try:
        current_user = get_jwt_identity()

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        chat = db.chats.find_one({"_id": chat_oid})

        if not chat:
            return error("Chat not found", 404)

        # ✅ Verify user is a participant
        if current_user not in chat.get("participants", []):
            return error("Unauthorized: You are not a participant in this chat", 403)

        # ✅ Fetch participant details
        participant_ids = chat.get("participants", [])
        object_ids = [ObjectId(pid) for pid in participant_ids]

        users_cursor = db.users.find({"_id": {"$in": object_ids}})

        participant_details = {}
        for u in users_cursor:
            participant_details[str(u["_id"])] = {
                "id": str(u["_id"]),
                "user_id": str(u["_id"]),
                "_id": str(u["_id"]),
                "username": u.get("username", "Unknown"),
                "email": u.get("email", ""),
                "profile_picture": u.get("profile_picture", None),
                "bio": u.get("bio", ""),
                "is_online": False  # ✅ Can integrate with socket tracking
            }

        # ✅ Get last 50 messages for context
        messages = list(db.messages.find({"chat_id": chat_oid})
                       .sort("created_at", -1)
                       .limit(50))

        message_list = []
        for msg in messages:
            message_list.append({
                "id": str(msg["_id"]),
                "message_id": str(msg["_id"]),
                "_id": str(msg["_id"]),
                "chat_id": str(msg["chat_id"]),
                "sender_id": msg["sender_id"],
                "message_type": msg.get("message_type", "text"),
                "content": msg.get("content"),
                "encrypted_content": msg.get("encrypted_content"),
                "iv": msg.get("iv"),
                "created_at": msg["created_at"].isoformat() if isinstance(msg["created_at"], datetime) else msg["created_at"],
                "edited_at": msg["edited_at"].isoformat() if msg.get("edited_at") and isinstance(msg["edited_at"], datetime) else None,
                "is_deleted": msg.get("is_deleted", False),
                "reactions": msg.get("reactions", {}),
                "reply_to": msg.get("reply_to")
            })

        response_chat = {
            "_id": str(chat["_id"]),
            "id": str(chat["_id"]),
            "chat_id": str(chat["_id"]),
            "chat_type": chat.get("chat_type"),
            "title": chat.get("title"),
            "description": chat.get("description"),
            "participants": list(participant_details.values()),
            "participants_info": participant_details,  # ✅ For quick lookups
            "created_by": chat.get("created_by"),
            "created_at": chat["created_at"].isoformat() if isinstance(chat["created_at"], datetime) else chat["created_at"],
            "last_message_preview": chat.get("last_message_preview"),
            "last_message_at": (
                chat.get("last_message_at").isoformat()
                if chat.get("last_message_at") and isinstance(chat.get("last_message_at"), datetime)
                else chat.get("last_message_at")
            ),
            "unread_count": chat.get("unread_count", {}).get(current_user, 0),
            "messages": message_list,  # ✅ Include recent messages for context
            "message_count": db.messages.count_documents({"chat_id": chat_oid})
        }

        return success(data={"chat": response_chat})

    except Exception as e:
        current_app.logger.error(f"[GET CHAT ERROR] {e}")
        return error("Failed to fetch chat", 500)


# ============================================================
#                 LIST ALL CHATS FOR CURRENT USER
# ============================================================
@chats_bp.route("/list", methods=["GET"])
@jwt_required()
def list_user_chats():
    """
    List all chats for the current user with pagination
    
    Query params:
    - limit: number of chats per page (default: 20)
    - skip: number of chats to skip (default: 0)
    - search: search in chat titles/descriptions
    """
    try:
        user_id = get_jwt_identity()
        
        # ✅ Pagination & search
        limit = int(request.args.get("limit", 20))
        skip = int(request.args.get("skip", 0))
        search = request.args.get("search", "").strip()

        if limit > 100:  # ✅ Prevent excessive queries
            limit = 100

        # ✅ Build query
        query = {"participants": user_id}
        
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]

        # ✅ Fetch total count
        total_chats = db.chats.count_documents(query)

        # ✅ FETCH ALL CHATS FOR USER - sorted by last message
        cursor = db.chats.find(query).sort("last_message_at", -1).skip(skip).limit(limit)

        chats = []

        for c in cursor:
            # ✅ Fetch participant details
            participant_ids = c.get("participants", [])
            object_ids = [ObjectId(pid) for pid in participant_ids if pid]

            users_cursor = db.users.find({"_id": {"$in": object_ids}})

            participant_details = []
            for u in users_cursor:
                participant_details.append({
                    "id": str(u["_id"]),
                    "user_id": str(u["_id"]),
                    "_id": str(u["_id"]),
                    "username": u.get("username", "Unknown"),
                    "email": u.get("email", ""),
                    "profile_picture": u.get("profile_picture", None),
                    "is_online": False
                })

            # ✅ Get last message
            last_message = db.messages.find_one(
                {"chat_id": c["_id"]},
                sort=[("created_at", -1)]
            )

            last_message_preview = c.get("last_message_preview", "No messages yet")
            if last_message and not c.get("last_message_preview"):
                last_message_preview = (
                    last_message.get("content", "[File/Media]")[:50] 
                    if last_message.get("content") 
                    else "[File/Media]"
                )

            # ✅ Build chat response object
            chat_response = {
                "_id": str(c["_id"]),
                "id": str(c["_id"]),
                "chat_id": str(c["_id"]),
                "chat_type": c.get("chat_type"),
                "title": c.get("title"),
                "description": c.get("description"),
                "participants": participant_details,
                "created_by": c.get("created_by"),
                "created_at": c["created_at"].isoformat() if isinstance(c["created_at"], datetime) else c["created_at"],
                "last_message_preview": last_message_preview,
                "last_message_encrypted": c.get("last_message_encrypted", False),
                "last_message_at": (
                    c.get("last_message_at").isoformat()
                    if c.get("last_message_at") and isinstance(c.get("last_message_at"), datetime)
                    else None
                ),
                "unread_count": c.get("unread_count", {}).get(user_id, 0),
                "message_count": db.messages.count_documents({"chat_id": c["_id"]})
            }
            chats.append(chat_response)

        return success(data={
            "chats": chats,
            "total": total_chats,
            "limit": limit,
            "skip": skip,
            "has_more": (skip + limit) < total_chats
        })

    except Exception as e:
        current_app.logger.error(f"[LIST CHATS ERROR] {e}")
        return error("Failed to list user chats", 500)


# ============================================================
#                   UPDATE CHAT
# ============================================================
@chats_bp.route("/<chat_id>", methods=["PUT"])
@jwt_required()
def update_chat(chat_id):
    """
    Update chat details (title, description, etc.)
    Only group admins/creators can update
    """
    try:
        current_user = get_jwt_identity()
        data = request.get_json() or {}

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        chat = db.chats.find_one({"_id": chat_oid})

        if not chat:
            return error("Chat not found", 404)

        # ✅ Verify user is creator/admin
        if chat.get("created_by") != current_user:
            return error("Only chat creator can update chat details", 403)

        # ✅ Update allowed fields
        update_fields = {}
        
        if "title" in data and data["title"]:
            update_fields["title"] = data["title"]
        
        if "description" in data:
            update_fields["description"] = data["description"]

        if not update_fields:
            return error("No valid fields to update", 400)

        update_fields["updated_at"] = now_utc()

        db.chats.update_one(
            {"_id": chat_oid},
            {"$set": update_fields}
        )

        # ✅ Fetch and return updated chat
        updated_chat = db.chats.find_one({"_id": chat_oid})
        updated_chat["_id"] = str(updated_chat["_id"])
        updated_chat["participants"] = [str(p) for p in updated_chat.get("participants", [])]

        return success("Chat updated", {"chat": updated_chat})

    except Exception as e:
        current_app.logger.error(f"[UPDATE CHAT ERROR] {e}")
        return error("Failed to update chat", 500)


# ============================================================
#                   DELETE CHAT
# ============================================================
@chats_bp.route("/<chat_id>", methods=["DELETE"])
@jwt_required()
def delete_chat(chat_id):
    """
    Delete a chat (soft delete - marks as deleted)
    Only group creators can delete
    """
    try:
        current_user = get_jwt_identity()

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        chat = db.chats.find_one({"_id": chat_oid})

        if not chat:
            return error("Chat not found", 404)

        # ✅ Verify permissions
        if chat.get("created_by") != current_user:
            return error("Only chat creator can delete chat", 403)

        # ✅ Soft delete
        db.chats.update_one(
            {"_id": chat_oid},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": now_utc(),
                    "deleted_by": current_user
                }
            }
        )

        return success("Chat deleted")

    except Exception as e:
        current_app.logger.error(f"[DELETE CHAT ERROR] {e}")
        return error("Failed to delete chat", 500)


# ============================================================
#              LEAVE CHAT / REMOVE PARTICIPANT
# ============================================================
@chats_bp.route("/<chat_id>/leave", methods=["POST"])
@jwt_required()
def leave_chat(chat_id):
    """
    User leaves a chat
    """
    try:
        current_user = get_jwt_identity()

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        chat = db.chats.find_one({"_id": chat_oid})

        if not chat:
            return error("Chat not found", 404)

        if current_user not in chat.get("participants", []):
            return error("You are not a participant in this chat", 400)

        # ✅ Remove user from participants
        db.chats.update_one(
            {"_id": chat_oid},
            {
                "$pull": {"participants": current_user},
                "$unset": {f"unread_count.{current_user}": 1}
            }
        )

        current_app.logger.info(f"[CHAT] User {current_user} left chat {chat_id}")
        return success("You have left the chat")

    except Exception as e:
        current_app.logger.error(f"[LEAVE CHAT ERROR] {e}")
        return error("Failed to leave chat", 500)


# ============================================================
#                   ADD PARTICIPANT
# ============================================================
@chats_bp.route("/<chat_id>/add-participant", methods=["POST"])
@jwt_required()
def add_participant(chat_id):
    """
    Add a new participant to group chat
    """
    try:
        current_user = get_jwt_identity()
        data = request.get_json() or {}
        
        new_user_id = data.get("user_id")

        if not new_user_id:
            return error("user_id is required", 400)

        try:
            chat_oid = ObjectId(chat_id)
            new_user_oid = ObjectId(new_user_id)
        except:
            return error("Invalid ID format", 400)

        chat = db.chats.find_one({"_id": chat_oid})

        if not chat:
            return error("Chat not found", 404)

        # ✅ Verify current user is in chat
        if current_user not in chat.get("participants", []):
            return error("You are not a participant in this chat", 403)

        # ✅ Only group chats allow adding participants
        if chat.get("chat_type") != "group":
            return error("Cannot add participants to private chats", 400)

        # ✅ Check if user already in chat
        if new_user_id in chat.get("participants", []):
            return error("User is already in this chat", 400)

        # ✅ Verify new user exists
        user = db.users.find_one({"_id": new_user_oid})
        if not user:
            return error("User not found", 404)

        # ✅ Add participant
        db.chats.update_one(
            {"_id": chat_oid},
            {
                "$push": {"participants": new_user_id},
                "$set": {f"unread_count.{new_user_id}": 0}
            }
        )

        return success("Participant added to chat")

    except Exception as e:
        current_app.logger.error(f"[ADD PARTICIPANT ERROR] {e}")
        return error("Failed to add participant", 500)


# ============================================================
#                REMOVE PARTICIPANT
# ============================================================
@chats_bp.route("/<chat_id>/remove-participant/<user_id>", methods=["DELETE"])
@jwt_required()
def remove_participant(chat_id, user_id):
    """
    Remove a participant from group chat
    Only creator can remove
    """
    try:
        current_user = get_jwt_identity()

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        chat = db.chats.find_one({"_id": chat_oid})

        if not chat:
            return error("Chat not found", 404)

        # ✅ Verify permissions
        if chat.get("created_by") != current_user and current_user != user_id:
            return error("Unauthorized", 403)

        if user_id not in chat.get("participants", []):
            return error("User is not a participant in this chat", 400)

        # ✅ Remove participant
        db.chats.update_one(
            {"_id": chat_oid},
            {
                "$pull": {"participants": user_id},
                "$unset": {f"unread_count.{user_id}": 1}
            }
        )

        return success("Participant removed from chat")

    except Exception as e:
        current_app.logger.error(f"[REMOVE PARTICIPANT ERROR] {e}")
        return error("Failed to remove participant", 500)


# ============================================================
#              MARK CHAT AS READ / UPDATE UNREAD
# ============================================================
@chats_bp.route("/<chat_id>/mark-read", methods=["PUT"])
@jwt_required()
def mark_chat_read(chat_id):
    """
    Mark all messages in a chat as read for current user
    """
    try:
        current_user = get_jwt_identity()

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        chat = db.chats.find_one({"_id": chat_oid})

        if not chat:
            return error("Chat not found", 404)

        if current_user not in chat.get("participants", []):
            return error("Unauthorized", 403)

        # ✅ Reset unread count
        db.chats.update_one(
            {"_id": chat_oid},
            {"$set": {f"unread_count.{current_user}": 0}}
        )

        # ✅ Mark messages as read
        db.messages.update_many(
            {"chat_id": chat_oid, "sender_id": {"$ne": current_user}},
            {"$addToSet": {"read_by": current_user}}
        )

        return success("Chat marked as read")

    except Exception as e:
        current_app.logger.error(f"[MARK READ ERROR] {e}")
        return error("Failed to mark chat as read", 500)


# ============================================================
#                       GET ALL CHATS (FOR TESTING)
# ============================================================
@chats_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_chats():
    """
    Get all chats for current user (main endpoint)
    """
    return list_user_chats()