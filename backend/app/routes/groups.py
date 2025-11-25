# FILE: backend/app/routes/groups.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app.database import get_db
from app import socketio

# Utils
from app.utils.response_builder import success, error

# Models
from app.models.group_model import group_document
from app.models.chat_model import chat_document

# IMPORTANT: MUST begin with /api
groups_bp = Blueprint("groups", __name__, url_prefix="/api/groups")
# db = get_db()  <-- MOVED INSIDE ROUTES


# ================================================================
#                         CREATE GROUP
# ================================================================
@groups_bp.route("/create", methods=["POST"])
@jwt_required()
def create_group():
    db = get_db()
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
            members=members,
        )

        group_id = db.groups.insert_one(group_doc).inserted_id
        group_doc["_id"] = str(group_id)

        # Create linked chat
        chat_doc = chat_document(
            chat_type="group",
            participants=members,
            created_by=current_user,
            title=title,
            description=description,
            group_id=str(group_id),
        )

        chat_id = db.chats.insert_one(chat_doc).inserted_id

        return success(
            "Group created successfully",
            {"group": group_doc, "chat_id": str(chat_id)},
        )

    except Exception as e:
        current_app.logger.error(f"[GROUP CREATE ERROR] {e}")
        return error(f"Failed to create group: {str(e)}", 500)


# ================================================================
#                            LIST GROUPS
# ================================================================
@groups_bp.route("/list", methods=["GET"])
@jwt_required()
def get_user_groups():
    """GET /api/groups/list"""
    db = get_db()
    try:
        user_id = get_jwt_identity()
        groups = list(db.groups.find({"members": user_id}))

        for g in groups:
            g["_id"] = str(g["_id"])

        return success("Groups fetched successfully", {"groups": groups})

    except Exception as e:
        current_app.logger.error(f"[GROUP LIST ERROR] {e}")
        return error("Failed to fetch groups", 500)


# ================================================================
#                       ADD MEMBER TO GROUP
# ================================================================
@groups_bp.route("/<group_id>/add", methods=["POST"])
@jwt_required()
def add_group_member(group_id):
    db = get_db()
    try:
        data = request.get_json() or {}
        member_id = data.get("member_id")

        if not member_id:
            return error("member_id is required", 400)

        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            return error("Group not found", 404)

        # Update DB
        db.groups.update_one(
            {"_id": ObjectId(group_id)}, {"$addToSet": {"members": member_id}}
        )

        db.chats.update_one(
            {"group_id": group_id}, {"$addToSet": {"participants": member_id}}
        )

        # Emit socket update
        socketio.emit(
            "group:member_added",
            {"group_id": group_id, "member_id": member_id},
            room=f"group:{group_id}",
        )

        return success("Member added successfully")

    except Exception as e:
        current_app.logger.error(f"[ADD MEMBER ERROR] {e}")
        return error("Failed to add group member", 500)
