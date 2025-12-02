# backend/app/routes/read_receipts.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from app import socketio
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc

reads_bp = Blueprint("read_receipts", __name__, url_prefix="/api/read")

db = get_db()

# ============================================================
#                   CONSTANTS
# ============================================================
RECEIPT_TYPES = {
    "sent": "Message sent",
    "delivered": "Message delivered",
    "read": "Message read"
}


# ============================================================
#                   HELPER FUNCTIONS
# ============================================================
def validate_receipt_type(receipt_type):
    """✅ FIXED: Validate receipt type"""
    if receipt_type not in RECEIPT_TYPES:
        return False, f"Invalid type. Allowed: {', '.join(RECEIPT_TYPES.keys())}"
    return True, None


def get_message_read_status(message_id, user_id):
    """✅ FIXED: Get read status for specific user"""
    try:
        message = db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            return None
        
        read_by = message.get("read_by", [])
        seen_by = message.get("seen_by", [])
        
        return {
            "is_read": user_id in read_by,
            "is_seen": user_id in seen_by,
            "read_by_count": len(read_by),
            "seen_by_count": len(seen_by)
        }
    except Exception as e:
        current_app.logger.error(f"[STATUS ERROR] {e}")
        return None


# ============================================================
#              MARK MESSAGE AS SEEN/READ
# ============================================================
@reads_bp.route("/mark_seen", methods=["POST"])
@jwt_required()
def mark_seen():
    """
    ✅ FIXED: Mark message as seen by current user
    
    Body: {
        "message_id": "<message-id>",
        "chat_id": "<chat-id>"
    }
    """
    try:
        data = request.get_json() or {}
        message_id = data.get("message_id")
        chat_id = data.get("chat_id")
        user_id = get_jwt_identity()

        # ✅ FIXED: Validate required fields
        if not message_id:
            return error("message_id is required", 400)
        
        if not chat_id:
            return error("chat_id is required", 400)

        # ✅ FIXED: Validate ObjectIds
        try:
            msg_oid = ObjectId(message_id)
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid message_id or chat_id format", 400)

        # ✅ FIXED: Verify message exists
        message = db.messages.find_one({"_id": msg_oid})
        if not message:
            return error("Message not found", 404)

        # ✅ FIXED: Verify chat exists
        chat = db.chats.find_one({"_id": chat_oid})
        if not chat:
            return error("Chat not found", 404)

        # ✅ FIXED: Verify user is in chat
        if user_id not in chat.get("participants", []):
            return error("Unauthorized: You are not a participant in this chat", 403)

        # ✅ FIXED: Check if already seen
        seen_by = message.get("seen_by", [])
        if user_id in seen_by:
            return success("Message already marked as seen")

        # ✅ FIXED: Update seen_by with timestamp
        db.messages.update_one(
            {"_id": msg_oid},
            {
                "$addToSet": {"seen_by": user_id},
                "$set": {
                    "updated_at": now_utc(),
                    f"seen_at.{user_id}": now_utc()  # ✅ FIXED: Track when each user saw it
                }
            }
        )

        # ✅ FIXED: Emit socket event with full context
        try:
            socketio.emit(
                "message:seen",
                {
                    "message_id": str(msg_oid),
                    "chat_id": str(chat_oid),
                    "user_id": user_id,
                    "timestamp": now_utc().isoformat(),
                    "seen_by_count": len(seen_by) + 1
                },
                room=f"chat:{str(chat_oid)}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        current_app.logger.info(f"[READ RECEIPT] User {user_id} marked message {message_id} as seen")

        return success("Message marked as seen", {
            "message_id": str(msg_oid),
            "seen_by_count": len(seen_by) + 1
        })

    except Exception as e:
        current_app.logger.error(f"[MARK SEEN ERROR] {str(e)}")
        return error("Failed to mark message as seen", 500)


# ============================================================
#              MARK MESSAGE AS READ
# ============================================================
@reads_bp.route("/mark_read", methods=["POST"])
@jwt_required()
def mark_read():
    """
    ✅ FIXED: Mark message as read by current user
    Difference: Read = Message was opened/focused, Seen = Message was in view
    
    Body: {
        "message_id": "<message-id>",
        "chat_id": "<chat-id>"
    }
    """
    try:
        data = request.get_json() or {}
        message_id = data.get("message_id")
        chat_id = data.get("chat_id")
        user_id = get_jwt_identity()

        # ✅ FIXED: Validate inputs
        if not message_id or not chat_id:
            return error("message_id and chat_id are required", 400)

        try:
            msg_oid = ObjectId(message_id)
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid ObjectId format", 400)

        # ✅ FIXED: Verify message and chat exist
        message = db.messages.find_one({"_id": msg_oid})
        if not message:
            return error("Message not found", 404)

        chat = db.chats.find_one({"_id": chat_oid})
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        # ✅ FIXED: Check if already read
        read_by = message.get("read_by", [])
        if user_id in read_by:
            return success("Message already marked as read")

        # ✅ FIXED: Update both read_by and seen_by
        db.messages.update_one(
            {"_id": msg_oid},
            {
                "$addToSet": {
                    "read_by": user_id,
                    "seen_by": user_id  # ✅ FIXED: Reading implies seeing
                },
                "$set": {
                    "updated_at": now_utc(),
                    f"read_at.{user_id}": now_utc(),  # ✅ FIXED: Track read time
                    f"seen_at.{user_id}": now_utc()
                }
            }
        )

        # ✅ FIXED: Emit socket event
        try:
            socketio.emit(
                "message:read",
                {
                    "message_id": str(msg_oid),
                    "chat_id": str(chat_oid),
                    "user_id": user_id,
                    "timestamp": now_utc().isoformat(),
                    "read_by_count": len(read_by) + 1
                },
                room=f"chat:{str(chat_oid)}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        current_app.logger.info(f"[READ RECEIPT] User {user_id} marked message {message_id} as read")

        return success("Message marked as read", {
            "message_id": str(msg_oid),
            "read_by_count": len(read_by) + 1
        })

    except Exception as e:
        current_app.logger.error(f"[MARK READ ERROR] {str(e)}")
        return error("Failed to mark message as read", 500)


# ============================================================
#           MARK MULTIPLE MESSAGES AS READ
# ============================================================
@reads_bp.route("/mark_batch_read", methods=["POST"])
@jwt_required()
def mark_batch_read():
    """
    ✅ FIXED: Mark multiple messages as read (batch operation)
    
    Body: {
        "message_ids": ["<id1>", "<id2>", ...],
        "chat_id": "<chat-id>"
    }
    """
    try:
        data = request.get_json() or {}
        message_ids = data.get("message_ids", [])
        chat_id = data.get("chat_id")
        user_id = get_jwt_identity()

        # ✅ FIXED: Validate inputs
        if not isinstance(message_ids, list) or len(message_ids) == 0:
            return error("message_ids must be a non-empty list", 400)

        if not chat_id:
            return error("chat_id is required", 400)

        if len(message_ids) > 1000:
            return error("Too many messages. Maximum is 1000", 400)

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        # ✅ FIXED: Verify chat
        chat = db.chats.find_one({"_id": chat_oid})
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        # ✅ FIXED: Convert all message IDs to ObjectIds
        msg_oids = []
        for msg_id in message_ids:
            try:
                msg_oids.append(ObjectId(msg_id))
            except:
                return error(f"Invalid message_id format: {msg_id}", 400)

        # ✅ FIXED: Batch update
        result = db.messages.update_many(
            {
                "_id": {"$in": msg_oids},
                "chat_id": chat_oid,
                "read_by": {"$ne": user_id}
            },
            {
                "$addToSet": {
                    "read_by": user_id,
                    "seen_by": user_id
                },
                "$set": {
                    "updated_at": now_utc(),
                    f"read_at.{user_id}": now_utc()
                }
            }
        )

        # ✅ FIXED: Emit socket event for batch
        try:
            socketio.emit(
                "messages:read_batch",
                {
                    "message_ids": [str(oid) for oid in msg_oids],
                    "chat_id": str(chat_oid),
                    "user_id": user_id,
                    "count": result.modified_count,
                    "timestamp": now_utc().isoformat()
                },
                room=f"chat:{str(chat_oid)}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        current_app.logger.info(f"[BATCH READ] User {user_id} marked {result.modified_count} messages as read")

        return success(f"Marked {result.modified_count} messages as read", {
            "chat_id": str(chat_oid),
            "marked_count": result.modified_count,
            "total_requested": len(message_ids)
        })

    except Exception as e:
        current_app.logger.error(f"[BATCH READ ERROR] {str(e)}")
        return error("Failed to mark messages as read", 500)


# ============================================================
#           MARK ENTIRE CHAT AS READ
# ============================================================
@reads_bp.route("/mark_chat_read", methods=["POST"])
@jwt_required()
def mark_chat_read():
    """
    ✅ FIXED: Mark all unread messages in chat as read
    
    Body: {
        "chat_id": "<chat-id>"
    }
    """
    try:
        data = request.get_json() or {}
        chat_id = data.get("chat_id")
        user_id = get_jwt_identity()

        if not chat_id:
            return error("chat_id is required", 400)

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        # ✅ FIXED: Verify user is in chat
        chat = db.chats.find_one({"_id": chat_oid})
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        # ✅ FIXED: Mark all unread messages in chat
        result = db.messages.update_many(
            {
                "chat_id": chat_oid,
                "read_by": {"$ne": user_id},
                "is_deleted": {"$ne": True}
            },
            {
                "$addToSet": {
                    "read_by": user_id,
                    "seen_by": user_id
                },
                "$set": {
                    "updated_at": now_utc(),
                    f"read_at.{user_id}": now_utc()
                }
            }
        )

        # ✅ FIXED: Reset unread count for chat
        db.chats.update_one(
            {"_id": chat_oid},
            {"$set": {f"unread_count.{user_id}": 0}}
        )

        # ✅ FIXED: Emit socket event
        try:
            socketio.emit(
                "chat:read_all",
                {
                    "chat_id": str(chat_oid),
                    "user_id": user_id,
                    "marked_count": result.modified_count,
                    "timestamp": now_utc().isoformat()
                },
                room=f"chat:{str(chat_oid)}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        current_app.logger.info(f"[CHAT READ] User {user_id} marked {result.modified_count} messages in chat {chat_id} as read")

        return success(f"Marked {result.modified_count} messages in chat as read", {
            "chat_id": str(chat_oid),
            "marked_count": result.modified_count
        })

    except Exception as e:
        current_app.logger.error(f"[CHAT READ ERROR] {str(e)}")
        return error("Failed to mark chat as read", 500)


# ============================================================
#           GET READ RECEIPTS FOR MESSAGE
# ============================================================
@reads_bp.route("/status/<message_id>", methods=["GET"])
@jwt_required()
def get_read_status(message_id):
    """
    ✅ FIXED: Get read/seen status for a message
    
    Returns: Who read it, who saw it, timestamps
    """
    try:
        user_id = get_jwt_identity()

        try:
            msg_oid = ObjectId(message_id)
        except:
            return error("Invalid message_id format", 400)

        # ✅ FIXED: Get message
        message = db.messages.find_one({"_id": msg_oid})
        if not message:
            return error("Message not found", 404)

        # ✅ FIXED: Verify user has access
        chat_id = message.get("chat_id")
        chat = db.chats.find_one({"_id": chat_id})
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        # ✅ FIXED: Get detailed status
        read_by = message.get("read_by", [])
        seen_by = message.get("seen_by", [])
        read_at = message.get("read_at", {})
        seen_at = message.get("seen_at", {})

        # ✅ FIXED: Format user details
        read_users = []
        for user in read_by:
            read_users.append({
                "user_id": user,
                "read_at": (
                    read_at.get(user).isoformat()
                    if read_at.get(user) and isinstance(read_at.get(user), datetime)
                    else read_at.get(user)
                )
            })

        seen_users = []
        for user in seen_by:
            if user not in read_by:  # Only show seen but not read
                seen_users.append({
                    "user_id": user,
                    "seen_at": (
                        seen_at.get(user).isoformat()
                        if seen_at.get(user) and isinstance(seen_at.get(user), datetime)
                        else seen_at.get(user)
                    )
                })

        return success(data={
            "message_id": str(msg_oid),
            "chat_id": str(chat_id),
            "read_by": read_users,
            "seen_by": seen_users,
            "read_count": len(read_by),
            "seen_count": len(seen_by),
            "total_participants": len(chat.get("participants", []))
        })

    except Exception as e:
        current_app.logger.error(f"[GET STATUS ERROR] {str(e)}")
        return error("Failed to fetch read status", 500)


# ============================================================
#           GET CHAT READ STATS
# ============================================================
@reads_bp.route("/chat_stats/<chat_id>", methods=["GET"])
@jwt_required()
def get_chat_read_stats(chat_id):
    """
    ✅ FIXED: Get unread message count and stats for chat
    
    Returns: Unread count, total messages, last read time
    """
    try:
        user_id = get_jwt_identity()

        try:
            chat_oid = ObjectId(chat_id)
        except:
            return error("Invalid chat_id format", 400)

        # ✅ FIXED: Verify user is in chat
        chat = db.chats.find_one({"_id": chat_oid})
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        # ✅ FIXED: Get unread count
        unread_count = db.messages.count_documents({
            "chat_id": chat_oid,
            "read_by": {"$ne": user_id},
            "is_deleted": {"$ne": True}
        })

        # ✅ FIXED: Get total messages
        total_messages = db.messages.count_documents({
            "chat_id": chat_oid,
            "is_deleted": {"$ne": True}
        })

        # ✅ FIXED: Get last read message
        last_read = db.messages.find_one(
            {"chat_id": chat_oid, "read_by": user_id},
            sort=[("created_at", -1)]
        )

        last_read_time = None
        if last_read:
            last_read_time = (
                last_read.get("created_at").isoformat()
                if isinstance(last_read.get("created_at"), datetime)
                else last_read.get("created_at")
            )

        return success(data={
            "chat_id": str(chat_oid),
            "unread_count": unread_count,
            "total_messages": total_messages,
            "last_read_at": last_read_time,
            "read_percentage": round(
                (total_messages - unread_count) / total_messages * 100, 1
            ) if total_messages > 0 else 0
        })
    except Exception as e:
        current_app.logger.error(f"[CHAT_STATS ERROR] {str(e)}")
        return error("Failed to fetch chat stats", 500)
