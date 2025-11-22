# FILE: backend/app/routes/groups.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app import socketio  # ✅ FIXED: Correct import

# Utils
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc

# Models
from app.models.group_model import group_document
from app.models.chat_model import chat_document

groups_bp = Blueprint("groups", __name__, url_prefix="/api/groups")
db = get_db()


# ================================================================
#                      CREATE GROUP
# ================================================================
@groups_bp.route("/create", methods=["POST"])
@jwt_required()
def create_group():
    try:
        data = request.get_json() or {}
        title = data.get("title")
        description = data.get("description")
        members = data.get("members", [])

        if not title or not isinstance(members, list) or len(members) == 0:
            return error("title and members are required", 400)

        current_user = get_jwt_identity()
        if current_user not in members:
            members.append(current_user)

        # Build group document
        group_doc = group_document(
            title=title,
            created_by=current_user,
            description=description,
            members=members
        )

        group_id = db.groups.insert_one(group_doc).inserted_id
        group_doc["_id"] = str(group_id)

        # Create chat linked to this group
        chat_doc = chat_document(
            chat_type="group",
            participants=members,
            created_by=current_user,
            title=title,
            description=description,
            group_id=str(group_id)
        )

        chat_id = db.chats.insert_one(chat_doc).inserted_id

        return success("Group created successfully", {
            "group": group_doc,
            "chat_id": str(chat_id)
        })

    except Exception as e:
        current_app.logger.error(f"[GROUP CREATE ERROR] {str(e)}")
        return error("Failed to create group", 500)


# ================================================================
#                     ADD MEMBER TO GROUP
# ================================================================
@groups_bp.route("/<group_id>/add", methods=["POST"])
@jwt_required()
def add_group_member(group_id):
    try:
        data = request.get_json() or {}
        member_id = data.get("member_id")

        if not member_id:
            return error("member_id is required", 400)

        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            return error("Group not found", 404)

        # Add member to group
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$addToSet": {"members": member_id}}
        )

        # Sync in chat document
        db.chats.update_one(
            {"group_id": group_id},
            {"$addToSet": {"participants": member_id}}
        )

        # Optional WebSocket event
        socketio.emit(
            "group:member_added",
            {"group_id": group_id, "member_id": member_id},
            room=f"group:{group_id}"
        )

        return success("Member added successfully")

    except Exception as e:
        current_app.logger.error(f"[ADD MEMBER ERROR] {str(e)}")
        return error("Failed to add group member", 500)
