# FILE: backend/app/routes/groups.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
import os
from werkzeug.utils import secure_filename
from datetime import datetime

# DB + Socket
from app.database import get_db
from app import socketio

# Utils
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc

# Models
from app.models.group_model import group_document
from app.models.chat_model import chat_document

groups_bp = Blueprint("groups", __name__, url_prefix="/api/groups")

UPLOAD_FOLDER = os.getenv("GROUP_MEDIA_FOLDER", "group_media")
ALLOWED_ICON_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_ICON_SIZE = 5 * 1024 * 1024  # 5MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = get_db()


# ============================================================
#                   HELPER FUNCTIONS
# ============================================================
def allowed_icon_file(filename):
    """✅ FIXED: Validate icon file extension"""
    if not filename or "." not in filename:
        return False
    
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_ICON_EXTENSIONS


def get_group_with_validation(group_id, user_id=None):
    """✅ FIXED: Centralized group validation"""
    try:
        group_oid = ObjectId(group_id)
    except:
        return None, "Invalid group_id format"

    group = db.groups.find_one({"_id": group_oid})
    
    if not group:
        return None, "Group not found"

    if user_id and user_id not in group.get("members", []):
        return None, "Unauthorized: You are not a member of this group"

    return group, None


def normalize_group_response(group):
    """✅ FIXED: Consistent group response format"""
    return {
        "_id": str(group.get("_id")),
        "id": str(group.get("_id")),
        "group_id": str(group.get("_id")),
        "title": group.get("title"),
        "description": group.get("description"),
        "created_by": group.get("created_by"),
        "created_at": (
            group.get("created_at").isoformat() 
            if isinstance(group.get("created_at"), datetime) 
            else group.get("created_at")
        ),
        "members": group.get("members", []),
        "admins": group.get("admins", []),
        "group_icon": group.get("group_icon"),
        "member_count": len(group.get("members", [])),
        "is_admin": False  # Set dynamically
    }


# ============================================================
#                     CREATE GROUP (WITH ADMINS)
# ============================================================
@groups_bp.route("/create", methods=["POST"])
@jwt_required()
def create_group():
    """✅ FIXED: Proper validation and error handling"""
    try:
        data = request.get_json() or {}

        title = (data.get("title") or "").strip()
        description = (data.get("description") or "").strip()
        members = data.get("members", [])

        # ✅ FIXED: Validate input
        if not title:
            return error("Group title is required", 400)

        if not isinstance(members, list):
            return error("members must be a list", 400)

        if len(members) == 0:
            return error("Group must have at least one member", 400)

        if len(title) > 100:
            return error("Group title must be less than 100 characters", 400)

        creator = get_jwt_identity()

        # ✅ FIXED: Ensure creator is included (avoid duplicates)
        members = list(set(members))  # Remove duplicates
        if creator not in members:
            members.append(creator)

        # ✅ FIXED: Validate all members exist
        member_count = db.users.count_documents({"_id": {"$in": [ObjectId(m) if isinstance(m, str) else m for m in members]}})
        if member_count != len(members):
            return error("One or more members do not exist", 404)

        # ✅ FIXED: Build group document with all required fields
        group_doc = group_document(
            title=title,
            description=description,
            created_by=creator,
            members=members,
            admins=[creator],   # ✅ FIXED: Creator = SUPER ADMIN
            group_icon=None,
            created_at=now_utc(),  # ✅ FIXED: Add timestamp
            updated_at=now_utc(),
            is_active=True
        )

        group_id = db.groups.insert_one(group_doc).inserted_id

        # ✅ FIXED: Create linked chat with all participants
        chat_doc = chat_document(
            chat_type="group",
            participants=members,
            created_by=creator,
            title=title,
            description=description,
            group_id=str(group_id)
        )

        chat_id = db.chats.insert_one(chat_doc).inserted_id

        # ✅ FIXED: Initialize unread counts for all members
        db.chats.update_one(
            {"_id": chat_id},
            {"$set": {"unread_count": {member: 0 for member in members}}}
        )

        # ✅ FIXED: Notify all members
        try:
            socketio.emit(
                "group:created",
                {
                    "group_id": str(group_id),
                    "title": title,
                    "creator": creator,
                    "members": members
                },
                room="broadcast"
            )
        except Exception as socket_error:
            current_app.logger.error(f"[SOCKET ERROR] {socket_error}")

        group_doc["_id"] = str(group_id)
        group_doc["chat_id"] = str(chat_id)

        current_app.logger.info(f"[GROUP CREATED] {group_id} by {creator}")

        return success("Group created successfully", {
            "group": normalize_group_response(group_doc),
            "chat_id": str(chat_id)
        })

    except Exception as e:
        current_app.logger.error(f"[GROUP CREATE ERROR] {e}")
        return error("Failed to create group", 500)


# ============================================================
#                 LIST USER GROUPS
# ============================================================
@groups_bp.route("/list", methods=["GET"])
@jwt_required()
def list_groups():
    """✅ FIXED: Add pagination and search"""
    try:
        user_id = get_jwt_identity()
        
        # ✅ FIXED: Add pagination
        limit = int(request.args.get("limit", 20))
        skip = int(request.args.get("skip", 0))
        search = request.args.get("search", "").strip()

        if limit > 100:
            limit = 100

        # ✅ FIXED: Build query
        query = {"members": user_id}
        
        if search:
            query["title"] = {"$regex": search, "$options": "i"}

        # ✅ FIXED: Get total count
        total = db.groups.count_documents(query)

        # ✅ FIXED: Fetch groups with pagination
        cursor = db.groups.find(query).sort("updated_at", -1).skip(skip).limit(limit)

        groups = []
        for g in cursor:
            group_data = normalize_group_response(g)
            group_data["is_admin"] = user_id in g.get("admins", [])
            groups.append(group_data)

        current_app.logger.info(f"[GROUPS LIST] User {user_id} fetched {len(groups)} groups")

        return success("Groups fetched", {
            "groups": groups,
            "total": total,
            "limit": limit,
            "skip": skip,
            "has_more": (skip + limit) < total
        })

    except Exception as e:
        current_app.logger.error(f"[GROUP LIST ERROR] {e}")
        return error("Failed to fetch groups", 500)


# ============================================================
#                   GET GROUP DETAILS
# ============================================================
@groups_bp.route("/<group_id>", methods=["GET"])
@jwt_required()
def get_group(group_id):
    """✅ FIXED: Get group details with member info"""
    try:
        user_id = get_jwt_identity()

        group, error_msg = get_group_with_validation(group_id, user_id)
        if not group:
            return error(error_msg, 404 if error_msg == "Group not found" else 403)

        # ✅ FIXED: Fetch member details
        member_ids = group.get("members", [])
        object_ids = [ObjectId(mid) if isinstance(mid, str) else mid for mid in member_ids]

        users_cursor = db.users.find({"_id": {"$in": object_ids}})
        
        member_details = {}
        for u in users_cursor:
            member_details[str(u["_id"])] = {
                "id": str(u["_id"]),
                "user_id": str(u["_id"]),
                "username": u.get("username"),
                "email": u.get("email"),
                "profile_picture": u.get("profile_picture"),
                "is_admin": str(u["_id"]) in group.get("admins", [])
            }

        # ✅ FIXED: Get message count
        chat = db.chats.find_one({"group_id": group_id})
        message_count = db.messages.count_documents({"chat_id": chat["_id"]}) if chat else 0

        group_data = normalize_group_response(group)
        group_data["is_admin"] = user_id in group.get("admins", [])
        group_data["members_info"] = member_details
        group_data["message_count"] = message_count
        group_data["chat_id"] = str(chat["_id"]) if chat else None

        return success(data={"group": group_data})

    except Exception as e:
        current_app.logger.error(f"[GET GROUP ERROR] {e}")
        return error("Failed to fetch group", 500)


# ============================================================
#                    ADD MEMBER
# ============================================================
@groups_bp.route("/<group_id>/add", methods=["POST"])
@jwt_required()
def add_member(group_id):
    """✅ FIXED: Proper validation for adding members"""
    try:
        admin_id = get_jwt_identity()
        data = request.get_json() or {}
        member_id = data.get("member_id")

        if not member_id:
            return error("member_id is required", 400)

        # ✅ FIXED: Use validation helper
        group, error_msg = get_group_with_validation(group_id)
        if not group:
            return error(error_msg, 404)

        # ✅ FIXED: Check admin permission
        if admin_id not in group.get("admins", []):
            return error("Only admins can add members", 403)

        # ✅ FIXED: Check if user already in group
        if member_id in group.get("members", []):
            return error("User is already a member", 409)

        # ✅ FIXED: Verify member exists
        if not db.users.find_one({"_id": ObjectId(member_id) if isinstance(member_id, str) else member_id}):
            return error("User does not exist", 404)

        # ✅ FIXED: Add to both group and chat
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$push": {"members": member_id}}
        )

        chat = db.chats.find_one({"group_id": group_id})
        if chat:
            db.chats.update_one(
                {"_id": chat["_id"]},
                {
                    "$push": {"participants": member_id},
                    "$set": {f"unread_count.{member_id}": 0}
                }
            )

        # ✅ FIXED: Notify group members
        try:
            socketio.emit(
                "group:member_added",
                {
                    "group_id": group_id,
                    "member_id": member_id,
                    "added_by": admin_id
                },
                room=f"group:{group_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET WARNING] {socket_error}")

        current_app.logger.info(f"[GROUP] Member {member_id} added to group {group_id} by {admin_id}")

        return success("Member added to group")

    except Exception as e:
        current_app.logger.error(f"[ADD MEMBER ERROR] {e}")
        return error("Failed to add member", 500)


# ============================================================
#                REMOVE MEMBER
# ============================================================
@groups_bp.route("/<group_id>/remove", methods=["POST"])
@jwt_required()
def remove_member(group_id):
    """✅ FIXED: Proper validation for removing members"""
    try:
        admin_id = get_jwt_identity()
        data = request.get_json() or {}
        member_id = data.get("member_id")

        if not member_id:
            return error("member_id is required", 400)

        group, error_msg = get_group_with_validation(group_id)
        if not group:
            return error(error_msg, 404)

        # ✅ FIXED: Check admin permission
        if admin_id not in group.get("admins", []):
            return error("Only admins can remove members", 403)

        # ✅ FIXED: Cannot remove creator
        if member_id == group.get("created_by"):
            return error("Cannot remove group creator", 403)

        # ✅ FIXED: Check if member exists in group
        if member_id not in group.get("members", []):
            return error("User is not a member of this group", 400)

        # ✅ FIXED: Remove from both group and chat
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$pull": {
                    "members": member_id,
                    "admins": member_id
                }
            }
        )

        chat = db.chats.find_one({"group_id": group_id})
        if chat:
            db.chats.update_one(
                {"_id": chat["_id"]},
                {
                    "$pull": {"participants": member_id},
                    "$unset": {f"unread_count.{member_id}": 1}
                }
            )

        # ✅ FIXED: Notify group
        try:
            socketio.emit(
                "group:member_removed",
                {
                    "group_id": group_id,
                    "member_id": member_id,
                    "removed_by": admin_id
                },
                room=f"group:{group_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET WARNING] {socket_error}")

        current_app.logger.info(f"[GROUP] Member {member_id} removed from group {group_id} by {admin_id}")

        return success("Member removed from group")

    except Exception as e:
        current_app.logger.error(f"[REMOVE MEMBER ERROR] {e}")
        return error("Failed to remove member", 500)


# ============================================================
#                    PROMOTE ADMIN
# ============================================================
@groups_bp.route("/<group_id>/promote", methods=["POST"])
@jwt_required()
def promote_admin(group_id):
    """✅ FIXED: Proper admin promotion logic"""
    try:
        requester = get_jwt_identity()
        data = request.get_json() or {}
        member_id = data.get("member_id")

        if not member_id:
            return error("member_id is required", 400)

        group, error_msg = get_group_with_validation(group_id)
        if not group:
            return error(error_msg, 404)

        # ✅ FIXED: Check permission
        if requester not in group.get("admins", []):
            return error("Only admins can promote members", 403)

        # ✅ FIXED: Validate member exists in group
        if member_id not in group.get("members", []):
            return error("User is not a member of this group", 400)

        # ✅ FIXED: Check if already admin
        if member_id in group.get("admins", []):
            return error("User is already an admin", 409)

        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$addToSet": {"admins": member_id}}
        )

        # ✅ FIXED: Notify group
        try:
            socketio.emit(
                "group:member_promoted",
                {
                    "group_id": group_id,
                    "member_id": member_id,
                    "promoted_by": requester
                },
                room=f"group:{group_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET WARNING] {socket_error}")

        current_app.logger.info(f"[GROUP] Member {member_id} promoted to admin in group {group_id}")

        return success("Member promoted to admin")

    except Exception as e:
        current_app.logger.error(f"[PROMOTE ERROR] {e}")
        return error("Failed to promote member", 500)


# ============================================================
#                    DEMOTE ADMIN
# ============================================================
@groups_bp.route("/<group_id>/demote", methods=["POST"])
@jwt_required()
def demote_admin(group_id):
    """✅ FIXED: Proper admin demotion logic"""
    try:
        requester = get_jwt_identity()
        data = request.get_json() or {}
        member_id = data.get("member_id")

        if not member_id:
            return error("member_id is required", 400)

        group, error_msg = get_group_with_validation(group_id)
        if not group:
            return error(error_msg, 404)

        # ✅ FIXED: Check permission
        if requester not in group.get("admins", []):
            return error("Only admins can demote members", 403)

        # ✅ FIXED: Cannot demote creator
        if member_id == group.get("created_by"):
            return error("Cannot demote group creator", 403)

        # ✅ FIXED: Check if actually admin
        if member_id not in group.get("admins", []):
            return error("User is not an admin", 400)

        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$pull": {"admins": member_id}}
        )

        # ✅ FIXED: Notify group
        try:
            socketio.emit(
                "group:member_demoted",
                {
                    "group_id": group_id,
                    "member_id": member_id,
                    "demoted_by": requester
                },
                room=f"group:{group_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET WARNING] {socket_error}")

        current_app.logger.info(f"[GROUP] Member {member_id} demoted from admin in group {group_id}")

        return success("Member demoted from admin")

    except Exception as e:
        current_app.logger.error(f"[DEMOTE ERROR] {e}")
        return error("Failed to demote member", 500)


# ============================================================
#                 UPDATE GROUP INFO
# ============================================================
@groups_bp.route("/<group_id>/update", methods=["PUT"])
@jwt_required()
def update_group_info(group_id):
    """✅ FIXED: Proper validation and update"""
    try:
        uid = get_jwt_identity()
        data = request.get_json() or {}

        title = (data.get("title") or "").strip()
        description = (data.get("description") or "").strip()

        if not title and not description:
            return error("At least one field (title or description) is required", 400)

        group, error_msg = get_group_with_validation(group_id)
        if not group:
            return error(error_msg, 404)

        # ✅ FIXED: Check admin permission
        if uid not in group.get("admins", []):
            return error("Only admins can update group info", 403)

        update_fields = {"updated_at": now_utc()}
        
        if title and len(title) <= 100:
            update_fields["title"] = title
        
        if description and len(description) <= 500:
            update_fields["description"] = description

        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$set": update_fields}
        )

        # ✅ FIXED: Update linked chat
        db.chats.update_one(
            {"group_id": group_id},
            {"$set": update_fields}
        )

        # ✅ FIXED: Notify group
        try:
            socketio.emit(
                "group:updated",
                {
                    "group_id": group_id,
                    "updates": update_fields,
                    "updated_by": uid
                },
                room=f"group:{group_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET WARNING] {socket_error}")

        current_app.logger.info(f"[GROUP] Group {group_id} updated by {uid}")

        return success("Group updated successfully")

    except Exception as e:
        current_app.logger.error(f"[GROUP UPDATE ERROR] {e}")
        return error("Failed to update group", 500)


# ============================================================
#                  UPDATE GROUP ICON (IMAGE)
# ============================================================
@groups_bp.route("/<group_id>/icon", methods=["POST"])
@jwt_required()
def upload_group_icon(group_id):
    """✅ FIXED: Proper file validation and upload"""
    try:
        uid = get_jwt_identity()

        group, error_msg = get_group_with_validation(group_id)
        if not group:
            return error(error_msg, 404)

        # ✅ FIXED: Check admin permission
        if uid not in group.get("admins", []):
            return error("Only admins can change group icon", 403)

        # ✅ FIXED: Validate file exists
        if "icon" not in request.files:
            return error("No icon file provided", 400)

        file = request.files["icon"]

        # ✅ FIXED: Validate filename
        if file.filename == "":
            return error("Empty filename", 400)

        # ✅ FIXED: Validate file extension
        if not allowed_icon_file(file.filename):
            return error(f"Invalid file type. Allowed: {', '.join(ALLOWED_ICON_EXTENSIONS)}", 400)

        # ✅ FIXED: Validate file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        if file_size == 0:
            return error("Cannot upload empty file", 400)

        if file_size > MAX_ICON_SIZE:
            size_mb = MAX_ICON_SIZE / 1024 / 1024
            return error(f"File too large. Maximum size is {size_mb:.0f}MB", 413)

        # ✅ FIXED: Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit(".", 1)[1].lower() if "." in original_filename else "png"
        unique_filename = f"{group_id}_{timestamp}.{ext}"
        
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)

        # ✅ FIXED: Delete old icon if exists
        old_icon = group.get("group_icon")
        if old_icon and os.path.exists(old_icon):
            try:
                os.remove(old_icon)
            except Exception as delete_error:
                current_app.logger.warning(f"[DELETE OLD ICON WARNING] {delete_error}")

        # ✅ FIXED: Save new icon
        try:
            file.save(file_path)
            if not os.path.exists(file_path):
                return error("Failed to save icon", 500)
        except Exception as save_error:
            current_app.logger.error(f"[SAVE ICON ERROR] {save_error}")
            return error("Failed to save icon", 500)

        # ✅ FIXED: Update group
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$set": {
                    "group_icon": file_path,
                    "updated_at": now_utc()
                }
            }
        )

        # ✅ FIXED: Notify group
        try:
            socketio.emit(
                "group:icon_updated",
                {
                    "group_id": group_id,
                    "icon_url": file_path,
                    "updated_by": uid
                },
                room=f"group:{group_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET WARNING] {socket_error}")

        current_app.logger.info(f"[GROUP] Icon updated for group {group_id} by {uid}")

        return success("Group icon updated", {"icon_url": file_path})

    except Exception as e:
        current_app.logger.error(f"[ICON UPLOAD ERROR] {e}")
        return error("Failed to upload icon", 500)


# ============================================================
#                     EXIT GROUP
# ============================================================
@groups_bp.route("/<group_id>/exit", methods=["POST"])
@jwt_required()
def exit_group(group_id):
    """✅ FIXED: Proper exit logic"""
    try:
        uid = get_jwt_identity()

        group, error_msg = get_group_with_validation(group_id, uid)
        if not group:
            return error(error_msg, 404 if error_msg == "Group not found" else 403)

        # ✅ FIXED: Cannot exit if creator (must delete instead)
        if uid == group.get("created_by"):
            return error("Creator cannot exit group. Delete the group instead.", 400)

        # ✅ FIXED: Remove from group and chat
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$pull": {
                    "members": uid,
                    "admins": uid
                }
            }
        )

        chat = db.chats.find_one({"group_id": group_id})
        if chat:
            db.chats.update_one(
                {"_id": chat["_id"]},
                {
                    "$pull": {"participants": uid},
                    "$unset": {f"unread_count.{uid}": 1}
                }
            )

        # ✅ FIXED: Notify group
        try:
            socketio.emit(
                "group:member_exited",
                {
                    "group_id": group_id,
                    "member_id": uid
                },
                room=f"group:{group_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET WARNING] {socket_error}")

        current_app.logger.info(f"[GROUP] User {uid} exited group {group_id}")

        return success("You have left the group")

    except Exception as e:
        current_app.logger.error(f"[EXIT GROUP ERROR] {e}")
        return error("Failed to exit group", 500)


# ============================================================
#                     DELETE GROUP
# ============================================================
@groups_bp.route("/<group_id>/delete", methods=["DELETE"])
@jwt_required()
def delete_group(group_id):
    """✅ FIXED: Proper soft delete and cleanup"""
    try:
        uid = get_jwt_identity()

        group, error_msg = get_group_with_validation(group_id)
        if not group:
            return error(error_msg, 404)

        # ✅ FIXED: Only creator can delete
        if uid != group.get("created_by"):
            return error("Only group creator can delete group", 403)

        # ✅ FIXED: Soft delete group
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$set": {
                    "is_active": False,
                    "deleted_at": now_utc(),
                    "deleted_by": uid
                }
            }
        )

        # ✅ FIXED: Soft delete linked chat
        chat = db.chats.find_one({"group_id": group_id})
        if chat:
            db.chats.update_one(
                {"_id": chat["_id"]},
                {
                    "$set": {
                        "is_deleted": True,
                        "deleted_at": now_utc()
                    }
                }
            )

        # ✅ FIXED: Delete group icon if exists
        icon_path = group.get("group_icon")
        if icon_path and os.path.exists(icon_path):
            try:
                os.remove(icon_path)
            except Exception as delete_error:
                current_app.logger.warning(f"[DELETE ICON WARNING] {delete_error}")

        # ✅ FIXED: Notify all members
        try:
            members = group.get("members", [])
            socketio.emit(
                "group:deleted",
                {
                    "group_id": group_id,
                    "title": group.get("title"),
                    "deleted_by": uid
                },
                room=f"group:{group_id}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET WARNING] {socket_error}")

        current_app.logger.info(f"[GROUP] Group {group_id} deleted by {uid}")

        return success("Group deleted successfully")

    except Exception as e:
        current_app.logger.error(f"[GROUP DELETE ERROR] {e}")
        return error("Failed to delete group", 500)
