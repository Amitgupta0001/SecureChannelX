# backend/app/routes/reactions.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app import socketio

reactions_bp = Blueprint("reactions", __name__, url_prefix="/api/reactions")
db = get_db()

# ============================================================
#                   REACTION CONSTANTS
# ============================================================
ALLOWED_EMOJIS = {
    "👍", "❤️", "😂", "😢", "😡", "🔥", "🎉", "😍", "🤔", "👏",
    "😮", "😭", "🙏", "💪", "🌟", "✨", "💯", "🚀", "😎", "🤖"
}

MAX_REACTIONS_PER_MESSAGE = 100  # ✅ FIXED: Prevent reaction spam
MAX_REACTION_LENGTH = 10  # ✅ FIXED: Emoji can be multiple characters


# ============================================================
#                   HELPER FUNCTIONS
# ============================================================
def validate_emoji(emoji):
    """✅ FIXED: Validate emoji format and content"""
    if not isinstance(emoji, str):
        return False, "Emoji must be a string"
    
    emoji = emoji.strip()
    
    if len(emoji) == 0:
        return False, "Emoji cannot be empty"
    
    if len(emoji) > MAX_REACTION_LENGTH:
        return False, f"Emoji too long (max {MAX_REACTION_LENGTH} chars)"
    
    # ✅ FIXED: Optional - enforce emoji whitelist
    if emoji not in ALLOWED_EMOJIS:
        return False, f"Emoji not allowed. Allowed: {', '.join(ALLOWED_EMOJIS)}"
    
    return True, None


def get_reaction_count(message_id):
    """✅ FIXED: Get total reaction count"""
    try:
        message = db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            return 0
        
        reactions = message.get("reactions", {})
        total = sum(len(users) for users in reactions.values()) if isinstance(reactions, dict) else 0
        return total
    except:
        return 0


def normalize_reactions(reactions_dict):
    """✅ FIXED: Normalize reactions format for response"""
    if not reactions_dict:
        return {}
    
    if isinstance(reactions_dict, dict):
        return {
            emoji: {
                "emoji": emoji,
                "count": len(users) if isinstance(users, list) else 1,
                "users": users if isinstance(users, list) else [users],
                "you_reacted": False  # Set dynamically
            }
            for emoji, users in reactions_dict.items()
        }
    
    return {}


# ============================================================
#                     ADD REACTION
# ============================================================
@reactions_bp.route("/add", methods=["POST"])
@jwt_required()
def add_reaction():
    """
    ✅ FIXED: Add a reaction to a message
    
    Body: {
        "message_id": "<message-id>",
        "emoji": "👍"
    }
    """
    try:
        data = request.get_json() or {}
        message_id = data.get("message_id")
        emoji = data.get("emoji", "").strip()
        user_id = get_jwt_identity()

        # ✅ FIXED: Validate inputs
        if not message_id:
            return error("message_id is required", 400)

        if not emoji:
            return error("emoji is required", 400)

        # ✅ FIXED: Validate emoji format
        valid_emoji, error_msg = validate_emoji(emoji)
        if not valid_emoji:
            return error(error_msg, 400)

        # ✅ FIXED: Validate message ObjectId
        try:
            msg_oid = ObjectId(message_id)
        except:
            return error("Invalid message_id format", 400)

        # ✅ FIXED: Get message and verify exists
        message = db.messages.find_one({"_id": msg_oid})
        if not message:
            return error("Message not found", 404)

        # ✅ FIXED: Verify user is in chat
        chat_id = message.get("chat_id")
        chat = db.chats.find_one({"_id": chat_id})
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized: You are not a participant in this chat", 403)

        # ✅ FIXED: Check reaction limit
        current_reactions = db.messages.find_one(
            {"_id": msg_oid},
            {"reactions": 1}
        ).get("reactions", {})
        
        total_reactions = sum(
            len(users) if isinstance(users, list) else 1 
            for users in current_reactions.values()
        )
        
        if total_reactions >= MAX_REACTIONS_PER_MESSAGE:
            return error(f"Maximum reactions reached ({MAX_REACTIONS_PER_MESSAGE})", 409)

        # ✅ FIXED: Check if user already reacted with this emoji
        if emoji in current_reactions:
            users = current_reactions[emoji]
            if isinstance(users, list) and user_id in users:
                return error("You already reacted with this emoji", 409)

        # ✅ FIXED: Add reaction (supports emoji as key with list of users)
        db.messages.update_one(
            {"_id": msg_oid},
            {
                "$addToSet": {
                    f"reactions.{emoji}": user_id
                }
            }
        )

        # ✅ FIXED: Emit socket event with full context
        try:
            socketio.emit(
                "reaction:added",
                {
                    "message_id": str(msg_oid),
                    "chat_id": str(chat_id),
                    "emoji": emoji,
                    "user_id": user_id,
                    "timestamp": now_utc().isoformat(),
                    "reaction_count": total_reactions + 1
                },
                room=f"chat:{str(chat_id)}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        current_app.logger.info(f"[REACTION] User {user_id} added {emoji} to message {message_id}")

        return success("Reaction added", {
            "message_id": str(msg_oid),
            "emoji": emoji,
            "user_id": user_id
        })

    except Exception as e:
        current_app.logger.error(f"[REACTION ADD ERROR] {str(e)}")
        return error("Failed to add reaction", 500)


# ============================================================
#                   REMOVE REACTION
# ============================================================
@reactions_bp.route("/remove", methods=["POST"])
@jwt_required()
def remove_reaction():
    """
    ✅ FIXED: Remove a reaction from a message
    
    Body: {
        "message_id": "<message-id>",
        "emoji": "👍"
    }
    """
    try:
        data = request.get_json() or {}
        message_id = data.get("message_id")
        emoji = data.get("emoji", "").strip()
        user_id = get_jwt_identity()

        # ✅ FIXED: Validate inputs
        if not message_id or not emoji:
            return error("message_id and emoji are required", 400)

        try:
            msg_oid = ObjectId(message_id)
        except:
            return error("Invalid message_id format", 400)

        # ✅ FIXED: Get message
        message = db.messages.find_one({"_id": msg_oid})
        if not message:
            return error("Message not found", 404)

        # ✅ FIXED: Verify user is in chat
        chat_id = message.get("chat_id")
        chat = db.chats.find_one({"_id": chat_id})
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        # ✅ FIXED: Check if reaction exists
        reactions = message.get("reactions", {})
        if emoji not in reactions:
            return error("Reaction not found", 404)

        users = reactions[emoji]
        if isinstance(users, list) and user_id not in users:
            return error("You did not react with this emoji", 400)

        # ✅ FIXED: Remove user's reaction
        db.messages.update_one(
            {"_id": msg_oid},
            {
                "$pull": {
                    f"reactions.{emoji}": user_id
                }
            }
        )

        # ✅ FIXED: Clean up empty emoji keys
        db.messages.update_one(
            {"_id": msg_oid, f"reactions.{emoji}": {"$exists": True, "$size": 0}},
            {"$unset": {f"reactions.{emoji}": 1}}
        )

        # ✅ FIXED: Emit socket event
        try:
            socketio.emit(
                "reaction:removed",
                {
                    "message_id": str(msg_oid),
                    "chat_id": str(chat_id),
                    "emoji": emoji,
                    "user_id": user_id,
                    "timestamp": now_utc().isoformat()
                },
                room=f"chat:{str(chat_id)}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        current_app.logger.info(f"[REACTION] User {user_id} removed {emoji} from message {message_id}")

        return success("Reaction removed")

    except Exception as e:
        current_app.logger.error(f"[REACTION REMOVE ERROR] {str(e)}")
        return error("Failed to remove reaction", 500)


# ============================================================
#                 GET MESSAGE REACTIONS
# ============================================================
@reactions_bp.route("/message/<message_id>", methods=["GET"])
@jwt_required()
def get_message_reactions(message_id):
    """
    ✅ FIXED: Get all reactions for a message
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

        # ✅ FIXED: Verify user is in chat
        chat_id = message.get("chat_id")
        chat = db.chats.find_one({"_id": chat_id})
        if not chat or user_id not in chat.get("participants", []):
            return error("Unauthorized", 403)

        # ✅ FIXED: Format reactions
        reactions = message.get("reactions", {})
        formatted_reactions = {}

        for emoji, users in reactions.items():
            if not isinstance(users, list):
                users = [users]
            
            formatted_reactions[emoji] = {
                "emoji": emoji,
                "count": len(users),
                "users": users,
                "you_reacted": user_id in users  # ✅ FIXED: Show if current user reacted
            }

        # ✅ FIXED: Sort by count
        sorted_reactions = dict(sorted(
            formatted_reactions.items(),
            key=lambda x: x[1]["count"],
            reverse=True
        ))

        return success(data={
            "message_id": str(msg_oid),
            "reactions": sorted_reactions,
            "total_reactions": len(sorted_reactions),
            "total_reaction_count": sum(r["count"] for r in sorted_reactions.values())
        })

    except Exception as e:
        current_app.logger.error(f"[GET REACTIONS ERROR] {str(e)}")
        return error("Failed to fetch reactions", 500)


# ============================================================
#              GET USER REACTIONS ACROSS CHATS
# ============================================================
@reactions_bp.route("/user", methods=["GET"])
@jwt_required()
def get_user_reactions():
    """
    ✅ FIXED: Get all reactions made by current user
    
    Query params:
    - chat_id: (optional) Filter by chat
    - limit: (default: 50)
    - skip: (default: 0)
    """
    try:
        user_id = get_jwt_identity()
        chat_id = request.args.get("chat_id")
        limit = int(request.args.get("limit", 50))
        skip = int(request.args.get("skip", 0))

        if limit > 100:
            limit = 100

        # ✅ FIXED: Build query
        query = {}
        
        if chat_id:
            try:
                query["chat_id"] = ObjectId(chat_id)
            except:
                return error("Invalid chat_id format", 400)

        # ✅ FIXED: Find messages with reactions from user
        pipeline = [
            {"$match": query},
            {"$project": {
                "chat_id": 1,
                "sender_id": 1,
                "content": 1,
                "created_at": 1,
                "reactions": {
                    "$objectToArray": "$reactions"
                }
            }},
            {"$unwind": "$reactions"},
            {"$match": {
                "reactions.v": {"$in": [user_id]}
            }},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]

        messages = list(db.messages.aggregate(pipeline))

        # ✅ FIXED: Format response
        reactions_list = []
        for msg in messages:
            reactions_list.append({
                "message_id": str(msg["_id"]),
                "chat_id": str(msg["chat_id"]),
                "sender_id": msg["sender_id"],
                "content_preview": (msg.get("content") or "")[:50],
                "emoji": msg["reactions"]["k"],
                "reacted_at": msg.get("created_at").isoformat() if isinstance(msg.get("created_at"), datetime) else msg.get("created_at")
            })

        return success(data={
            "reactions": reactions_list,
            "limit": limit,
            "skip": skip,
            "count": len(reactions_list)
        })

    except Exception as e:
        current_app.logger.error(f"[USER REACTIONS ERROR] {str(e)}")
        return error("Failed to fetch user reactions", 500)


# ============================================================
#               GET MOST USED REACTIONS
# ============================================================
@reactions_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_reaction_stats():
    """
    ✅ FIXED: Get reaction statistics
    
    Query params:
    - chat_id: (optional) Filter by chat
    - period_days: (default: 30)
    """
    try:
        user_id = get_jwt_identity()
        chat_id = request.args.get("chat_id")
        period_days = int(request.args.get("period_days", 30))

        # ✅ FIXED: Build query
        from datetime import timedelta
        query = {"created_at": {"$gte": now_utc() - timedelta(days=period_days)}}
        
        if chat_id:
            try:
                query["chat_id"] = ObjectId(chat_id)
            except:
                return error("Invalid chat_id format", 400)

        # ✅ FIXED: Aggregate reaction stats
        pipeline = [
            {"$match": query},
            {"$project": {
                "reactions": {"$objectToArray": "$reactions"}
            }},
            {"$unwind": "$reactions"},
            {"$unwind": "$reactions.v"},
            {"$group": {
                "_id": "$reactions.k",
                "count": {"$sum": 1},
                "users": {"$addToSet": "$reactions.v"}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 20}
        ]

        stats = list(db.messages.aggregate(pipeline))

        # ✅ FIXED: Format response
        formatted_stats = [
            {
                "emoji": stat["_id"],
                "total_count": stat["count"],
                "unique_users": len(stat["users"])
            }
            for stat in stats
        ]

        return success(data={
            "stats": formatted_stats,
            "period_days": period_days,
            "total_unique_emojis": len(formatted_stats)
        })

    except Exception as e:
        current_app.logger.error(f"[REACTION STATS ERROR] {str(e)}")
        return error("Failed to fetch reaction stats", 500)


# ============================================================
#             BULK REMOVE ALL REACTIONS (ADMIN)
# ============================================================
@reactions_bp.route("/<message_id>/clear", methods=["DELETE"])
@jwt_required()
def clear_reactions(message_id):
    """
    ✅ FIXED: Clear all reactions from a message (message sender or admin only)
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

        # ✅ FIXED: Check permissions (only sender can clear)
        if message.get("sender_id") != user_id:
            return error("Only message sender can clear reactions", 403)

        # ✅ FIXED: Clear all reactions
        db.messages.update_one(
            {"_id": msg_oid},
            {"$set": {"reactions": {}}}
        )

        # ✅ FIXED: Emit socket event
        try:
            socketio.emit(
                "reactions:cleared",
                {
                    "message_id": str(msg_oid),
                    "chat_id": str(message["chat_id"]),
                    "cleared_by": user_id,
                    "timestamp": now_utc().isoformat()
                },
                room=f"chat:{str(message['chat_id'])}"
            )
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        current_app.logger.info(f"[REACTIONS] User {user_id} cleared reactions from message {message_id}")

        return success("All reactions cleared")

    except Exception as e:
        current_app.logger.error(f"[CLEAR REACTIONS ERROR] {str(e)}")
        return error("Failed to clear reactions", 500)
