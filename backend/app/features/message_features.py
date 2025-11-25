# backend/app/features/message_features.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from  app import socketio

# Utils
from app.utils.response_builder import success, error
from app.utils.validators import validate_message_content
from app.utils.helpers import now_utc

message_features_bp = Blueprint("message_features", __name__, url_prefix="/api/messages")
db = get_db()


# -------------------------------------------------------------
# Search Messages
# -------------------------------------------------------------
@message_features_bp.route("/search", methods=["GET"])
@jwt_required()
def search_messages():
    try:
        user_id = get_jwt_identity()
        query = request.args.get("q", "").strip()
        room_id = request.args.get("room_id")

        if not query:
            return error("Query parameter 'q' is required", 400)

        search_filter = {
            "user_id": user_id,
            "is_deleted": False,
            "content": {"$regex": query, "$options": "i"}
        }

        if room_id:
            search_filter["room_id"] = room_id

        cursor = db.messages.find(search_filter).sort("created_at", -1).limit(50)

        results = [{
            "id": str(m["_id"]),
            "content": m.get("content", ""),
            "room_id": m.get("room_id"),
            "timestamp": m.get("created_at", now_utc()).isoformat(),
            "username": m.get("username", "Unknown")
        } for m in cursor]

        return success(data={"results": results})

    except Exception as e:
        current_app.logger.error(f"[SEARCH MESSAGE ERROR] {str(e)}")
        return error("Failed to search messages", 500)


# -------------------------------------------------------------
# Edit Message
# -------------------------------------------------------------
@message_features_bp.route("/<message_id>", methods=["PUT"])
@jwt_required()
def edit_message(message_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        new_content = data.get("content")

        if not new_content:
            return error("Content is required", 400)

        if not validate_message_content(new_content):
            return error("Invalid or empty message content", 400)

        message = db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            return error("Message not found", 404)

        if message["user_id"] != user_id:
            return error("You are not authorized to edit this message", 403)

        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "content": new_content,
                    "is_edited": True,
                    "updated_at": now_utc()
                }
            }
        )

        # Notify clients
        socketio.emit(
            "message_edited",
            {
                "message_id": message_id,
                "content": new_content,
                "room_id": message["room_id"]
            },
            room=message["room_id"]
        )

        return success("Message updated successfully")

    except Exception as e:
        current_app.logger.error(f"[EDIT MESSAGE ERROR] {str(e)}")
        return error("Failed to edit message", 500)


# -------------------------------------------------------------
# Delete Message (Soft Delete)
# -------------------------------------------------------------
@message_features_bp.route("/<message_id>", methods=["DELETE"])
@jwt_required()
def delete_message(message_id):
    try:
        user_id = get_jwt_identity()

        message = db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            return error("Message not found", 404)

        if message["user_id"] != user_id:
            return error("You are not authorized to delete this message", 403)

        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "content": "[message deleted]",
                    "updated_at": now_utc()
                }
            }
        )

        socketio.emit(
            "message_deleted",
            {
                "message_id": message_id,
                "room_id": message["room_id"]
            },
            room=message["room_id"]
        )

        return success("Message deleted successfully")

    except Exception as e:
        current_app.logger.error(f"[DELETE MESSAGE ERROR] {str(e)}")
        return error("Failed to delete message", 500)


# -------------------------------------------------------------
# Create Threaded Message
# -------------------------------------------------------------
@message_features_bp.route("/<message_id>/thread", methods=["POST"])
@jwt_required()
def create_thread(message_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        content = data.get("content")

        if not content:
            return error("Content is required", 400)

        if not validate_message_content(content):
            return error("Invalid or empty message content", 400)

        parent = db.messages.find_one({"_id": ObjectId(message_id)})
        if not parent:
            return error("Parent message not found", 404)

        thread_doc = {
            "content": content,
            "encrypted_content": data.get("encrypted_content", ""),
            "user_id": user_id,
            "username": parent.get("username", "Unknown"),
            "room_id": parent["room_id"],
            "parent_id": message_id,
            "created_at": now_utc(),
            "is_deleted": False,
            "is_edited": False,
            "message_type": "thread"
        }

        result = db.messages.insert_one(thread_doc)
        thread_id = str(result.inserted_id)

        socketio.emit(
            "thread_message",
            {
                "parent_id": message_id,
                "message": {
                    "id": thread_id,
                    "content": content,
                    "user_id": user_id,
                    "username": parent.get("username", "Unknown"),
                    "timestamp": thread_doc["created_at"].isoformat()
                },
                "room_id": parent["room_id"]
            },
            room=parent["room_id"]
        )

        return success("Thread message created", {"thread_id": thread_id})

    except Exception as e:
        current_app.logger.error(f"[CREATE THREAD ERROR] {str(e)}")
        return error("Failed to create thread message", 500)


# -------------------------------------------------------------
# Get Thread Messages
# -------------------------------------------------------------
@message_features_bp.route("/<message_id>/thread", methods=["GET"])
@jwt_required()
def get_thread(message_id):
    try:
        cursor = db.messages.find({
            "parent_id": message_id,
            "is_deleted": False
        }).sort("created_at", 1)

        thread = [{
            "id": str(m["_id"]),
            "content": m.get("content", ""),
            "user_id": m.get("user_id"),
            "username": m.get("username", "Unknown"),
            "timestamp": m.get("created_at", now_utc()).isoformat()
        } for m in cursor]

        return success(data={"thread": thread})

    except Exception as e:
        current_app.logger.error(f"[GET THREAD ERROR] {str(e)}")
        return error("Failed to fetch thread messages", 500)
