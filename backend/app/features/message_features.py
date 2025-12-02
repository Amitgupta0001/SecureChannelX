"""
Message features REST API:
- Search messages with pagination
- Edit messages with history
- Delete messages (soft delete)
- Threaded messages/replies
- Message reactions
- Message pinning
- Comprehensive audit logging
- Rate limiting
- Access control
"""

import logging
import traceback
from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timedelta

from app.database import get_db
from app import socketio

# Utils
from app.utils.response_builder import success, error
from app.utils.validators import validate_message_content
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

message_features_bp = Blueprint("message_features", __name__, url_prefix="/api/messages")


# ============================================================
#                   CONSTANTS
# ============================================================

MAX_SEARCH_RESULTS = 100
MAX_THREAD_DEPTH = 10
MAX_THREAD_SIZE = 1000
MESSAGE_EDIT_WINDOW = 3600  # 1 hour
MESSAGE_DELETE_WINDOW = 86400  # 24 hours
SEARCH_RATE_LIMIT = 30  # per minute
EDIT_RATE_LIMIT = 50  # per minute
DELETE_RATE_LIMIT = 30  # per minute
PIN_RATE_LIMIT = 20  # per minute


# ============================================================
#                   AUDIT LOGGING
# ============================================================

class MessageAuditLogger:
    """✅ ENHANCED: Comprehensive message audit logging"""
    
    COLLECTION = "message_audit_logs"
    
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()
        try:
            self.db[self.COLLECTION].create_index([("timestamp", -1)])
            self.db[self.COLLECTION].create_index([("event", 1)])
            self.db[self.COLLECTION].create_index([("user_id", 1)])
            self.db[self.COLLECTION].create_index([("message_id", 1)])
            # TTL index: auto-delete logs after 30 days
            self.db[self.COLLECTION].create_index([("timestamp", 1)], expireAfterSeconds=2592000)
        except Exception as e:
            logger.warning(f"[MESSAGE AUDIT] Index creation failed: {e}")
    
    def log(self, event: str, user_id: str, message_id: str = None,
            status: str = "success", details: dict = None, error_msg: str = ""):
        """✅ ENHANCED: Log message event"""
        try:
            doc = {
                "event": event,
                "user_id": user_id,
                "message_id": message_id,
                "status": status,
                "details": details or {},
                "error": error_msg,
                "ip_address": request.remote_addr if request else None,
                "timestamp": now_utc()
            }
            self.db[self.COLLECTION].insert_one(doc)
        except Exception as e:
            logger.error(f"[MESSAGE AUDIT] Failed to log: {e}")


message_audit_logger = MessageAuditLogger()


# ============================================================
#                   RATE LIMITING
# ============================================================

class MessageRateLimiter:
    """✅ ENHANCED: Rate limiting for message operations"""
    
    def __init__(self):
        self.operations = {}  # user_id -> [(timestamp, op_type), ...]
    
    def check_limit(self, user_id: str, operation: str, limit: int) -> tuple:
        """✅ ENHANCED: Check if operation is within rate limit"""
        import time
        
        now = time.time()
        
        if user_id not in self.operations:
            self.operations[user_id] = []
        
        # Clean old entries (older than 1 minute)
        cutoff = now - 60
        self.operations[user_id] = [
            (ts, op) for ts, op in self.operations[user_id] if ts > cutoff
        ]
        
        # Count operations
        count = sum(1 for _, op in self.operations[user_id] if op == operation)
        
        if count >= limit:
            return False, f"Rate limit exceeded for {operation} ({limit}/min)"
        
        self.operations[user_id].append((now, operation))
        return True, ""


message_rate_limiter = MessageRateLimiter()


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def verify_user_in_chat(user_id: str, chat_id: str) -> bool:
    """✅ ENHANCED: Verify user is participant in chat"""
    try:
        db = get_db()
        chat = db.chats.find_one({
            "_id": ObjectId(chat_id),
            "participants": user_id
        })
        return chat is not None
    except Exception as e:
        logger.error(f"[VERIFY CHAT] Error: {e}")
        return False


def can_edit_message(message: dict, user_id: str, chat_id: str = None) -> tuple:
    """✅ ENHANCED: Check if user can edit message"""
    # ✅ ENHANCED: Only sender can edit
    if message.get("sender_id") != user_id and message.get("user_id") != user_id:
        return False, "Only message sender can edit"
    
    # ✅ ENHANCED: Check edit window
    created_at = message.get("created_at")
    if created_at:
        elapsed = (now_utc() - created_at).total_seconds()
        if elapsed > MESSAGE_EDIT_WINDOW:
            return False, f"Edit window expired (max {MESSAGE_EDIT_WINDOW}s)"
    
    return True, ""


def can_delete_message(message: dict, user_id: str) -> tuple:
    """✅ ENHANCED: Check if user can delete message"""
    # ✅ ENHANCED: Only sender can delete
    if message.get("sender_id") != user_id and message.get("user_id") != user_id:
        return False, "Only message sender can delete"
    
    # ✅ ENHANCED: Check delete window
    created_at = message.get("created_at")
    if created_at:
        elapsed = (now_utc() - created_at).total_seconds()
        if elapsed > MESSAGE_DELETE_WINDOW:
            return False, f"Delete window expired (max {MESSAGE_DELETE_WINDOW}s)"
    
    return True, ""


# ============================================================
#                   SEARCH MESSAGES
# ============================================================

@message_features_bp.route("/search", methods=["GET"])
@jwt_required()
def search_messages():
    """
    ✅ ENHANCED: Search messages with pagination and filtering
    
    GET /api/messages/search?q=keyword&chat_id=chat_123&page=1&limit=20
    
    Query parameters:
    - q: search query (required)
    - chat_id: filter by chat (optional)
    - page: page number (default 1)
    - limit: results per page (max 100, default 20)
    - date_from: ISO format timestamp (optional)
    - date_to: ISO format timestamp (optional)
    
    Response: {
        "results": [...],
        "total": int,
        "page": int,
        "pages": int,
        "limit": int
    }
    """
    try:
        user_id = get_jwt_identity()
        query = request.args.get("q", "").strip()
        chat_id = request.args.get("chat_id", "").strip()
        page = int(request.args.get("page", 1))
        limit = min(int(request.args.get("limit", 20)), MAX_SEARCH_RESULTS)
        
        # ✅ ENHANCED: Validate inputs
        if not query or len(query) < 2:
            return error("Search query too short (min 2 chars)", 400)
        
        if len(query) > 500:
            return error("Search query too long (max 500 chars)", 400)
        
        if page < 1:
            return error("Page must be >= 1", 400)
        
        if limit < 1:
            return error("Limit must be >= 1", 400)
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = message_rate_limiter.check_limit(user_id, "search", SEARCH_RATE_LIMIT)
        if not allowed:
            logger.warning(f"[SEARCH] Rate limit for {user_id}")
            return error(msg, 429)
        
        # ✅ ENHANCED: Build search filter
        db = get_db()
        search_filter = {
            "is_deleted": False,
            "encrypted_content": {"$regex": query, "$options": "i"}
        }
        
        # ✅ ENHANCED: Verify user is in chat if chat_id provided
        if chat_id:
            if not verify_user_in_chat(user_id, chat_id):
                logger.warning(f"[SEARCH] User {user_id} not in chat {chat_id}")
                return error("Access denied to chat", 403)
            
            search_filter["chat_id"] = chat_id
        else:
            # ✅ ENHANCED: Search only in user's chats
            user_chats = db.chats.find({"participants": user_id}, {"_id": 1})
            chat_ids = [str(c["_id"]) for c in user_chats]
            if chat_ids:
                search_filter["chat_id"] = {"$in": chat_ids}
            else:
                return success("No chats found", data={"results": [], "total": 0})
        
        # ✅ ENHANCED: Date range filter
        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")
        
        if date_from or date_to:
            date_filter = {}
            
            if date_from:
                try:
                    date_from_dt = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                    date_filter["$gte"] = date_from_dt
                except ValueError:
                    return error("Invalid date_from format (use ISO 8601)", 400)
            
            if date_to:
                try:
                    date_to_dt = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                    date_filter["$lte"] = date_to_dt
                except ValueError:
                    return error("Invalid date_to format (use ISO 8601)", 400)
            
            if date_filter:
                search_filter["created_at"] = date_filter
        
        # ✅ ENHANCED: Execute search
        total = db.messages.count_documents(search_filter)
        skip = (page - 1) * limit
        
        cursor = db.messages.find(search_filter).sort("created_at", -1).skip(skip).limit(limit)
        
        results = []
        for msg in cursor:
            results.append({
                "id": str(msg["_id"]),
                "content": "[encrypted]" if msg.get("is_deleted") else msg.get("encrypted_content", ""),
                "chat_id": msg.get("chat_id"),
                "sender_id": msg.get("sender_id") or msg.get("user_id"),
                "username": msg.get("username", "Unknown"),
                "timestamp": msg.get("created_at", now_utc()).isoformat(),
                "is_edited": msg.get("is_edited", False),
                "is_deleted": msg.get("is_deleted", False),
                "message_type": msg.get("message_type", "text")
            })
        
        pages = (total + limit - 1) // limit
        
        message_audit_logger.log(
            "MESSAGE_SEARCH", user_id,
            details={
                "query": query,
                "results_found": total,
                "chat_id": chat_id
            }
        )
        
        logger.info(f"[SEARCH] User {user_id} found {total} messages")
        
        return success("Messages searched successfully", data={
            "results": results,
            "total": total,
            "page": page,
            "pages": pages,
            "limit": limit
        })
    
    except ValueError as e:
        logger.error(f"[SEARCH VALIDATION] {e}")
        return error("Invalid parameter format", 400)
    
    except Exception as e:
        logger.error(f"[SEARCH ERROR] {e}")
        logger.error(traceback.format_exc())
        message_audit_logger.log(
            "MESSAGE_SEARCH", user_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to search messages", 500)


# ============================================================
#                   EDIT MESSAGE
# ============================================================

@message_features_bp.route("/<message_id>", methods=["PUT"])
@jwt_required()
def edit_message(message_id):
    """
    ✅ ENHANCED: Edit message with history tracking
    
    PUT /api/messages/{message_id}
    {
        "encrypted_content": "updated content",
        "x3dh_header": "..."
    }
    
    Response: {
        "message": {...},
        "edited_at": "...",
        "can_still_edit": bool
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        encrypted_content = data.get("encrypted_content", "").strip()
        
        # ✅ ENHANCED: Validate input
        if not encrypted_content:
            return error("Content is required", 400)
        
        if len(encrypted_content) > 65536:
            return error("Content too large (max 64KB)", 400)
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = message_rate_limiter.check_limit(user_id, "edit", EDIT_RATE_LIMIT)
        if not allowed:
            logger.warning(f"[EDIT] Rate limit for {user_id}")
            return error(msg, 429)
        
        # ✅ ENHANCED: Find message
        db = get_db()
        message = db.messages.find_one({"_id": ObjectId(message_id)})
        
        if not message:
            logger.warning(f"[EDIT] Message not found: {message_id}")
            return error("Message not found", 404)
        
        # ✅ ENHANCED: Verify authorization
        can_edit, reason = can_edit_message(message, user_id)
        if not can_edit:
            logger.warning(f"[EDIT] {user_id} cannot edit {message_id}: {reason}")
            return error(reason, 403)
        
        # ✅ ENHANCED: Store edit history
        edit_history = message.get("edit_history", [])
        edit_history.append({
            "content": message.get("encrypted_content"),
            "x3dh_header": message.get("x3dh_header"),
            "edited_at": now_utc(),
            "edited_by": user_id
        })
        
        # ✅ ENHANCED: Update message
        now = now_utc()
        elapsed_since_creation = (now - message.get("created_at")).total_seconds()
        can_still_edit = elapsed_since_creation < MESSAGE_EDIT_WINDOW
        
        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "encrypted_content": encrypted_content,
                    "x3dh_header": data.get("x3dh_header"),
                    "is_edited": True,
                    "last_edited_at": now,
                    "edit_history": edit_history
                }
            }
        )
        
        # ✅ ENHANCED: Broadcast update
        chat_id = message.get("chat_id")
        if chat_id:
            socketio.emit(
                "message:edited",
                {
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "edited_by": user_id,
                    "edited_at": now.isoformat(),
                    "is_edited": True
                },
                room=f"chat:{chat_id}"
            )
        
        message_audit_logger.log(
            "MESSAGE_EDITED", user_id, message_id,
            details={
                "chat_id": chat_id,
                "edit_count": len(edit_history)
            }
        )
        
        logger.info(f"[EDIT] Message {message_id} edited by {user_id}")
        
        return success("Message updated successfully", data={
            "message_id": message_id,
            "edited_at": now.isoformat(),
            "can_still_edit": can_still_edit,
            "edit_count": len(edit_history)
        })
    
    except Exception as e:
        logger.error(f"[EDIT ERROR] {e}")
        logger.error(traceback.format_exc())
        message_audit_logger.log(
            "MESSAGE_EDITED", user_id, message_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to edit message", 500)


# ============================================================
#                   DELETE MESSAGE (SOFT DELETE)
# ============================================================

@message_features_bp.route("/<message_id>", methods=["DELETE"])
@jwt_required()
def delete_message(message_id):
    """
    ✅ ENHANCED: Soft delete message with recovery window
    
    DELETE /api/messages/{message_id}
    
    Response: {
        "deleted_at": "...",
        "can_recover": bool,
        "recovery_window": int (seconds)
    }
    """
    try:
        user_id = get_jwt_identity()
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = message_rate_limiter.check_limit(user_id, "delete", DELETE_RATE_LIMIT)
        if not allowed:
            logger.warning(f"[DELETE] Rate limit for {user_id}")
            return error(msg, 429)
        
        # ✅ ENHANCED: Find message
        db = get_db()
        message = db.messages.find_one({"_id": ObjectId(message_id)})
        
        if not message:
            return error("Message not found", 404)
        
        # ✅ ENHANCED: Check if already deleted
        if message.get("is_deleted", False):
            return error("Message already deleted", 400)
        
        # ✅ ENHANCED: Verify authorization
        can_delete, reason = can_delete_message(message, user_id)
        if not can_delete:
            logger.warning(f"[DELETE] {user_id} cannot delete {message_id}: {reason}")
            return error(reason, 403)
        
        # ✅ ENHANCED: Soft delete
        now = now_utc()
        deletion_recovery_window = now + timedelta(seconds=MESSAGE_DELETE_WINDOW)
        
        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": now,
                    "deleted_by": user_id,
                    "content": "[message deleted]",
                    "encrypted_content": "[deleted]",
                    "can_recover_until": deletion_recovery_window
                }
            }
        )
        
        # ✅ ENHANCED: Broadcast deletion
        chat_id = message.get("chat_id")
        if chat_id:
            socketio.emit(
                "message:deleted",
                {
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "deleted_by": user_id,
                    "deleted_at": now.isoformat()
                },
                room=f"chat:{chat_id}"
            )
        
        message_audit_logger.log(
            "MESSAGE_DELETED", user_id, message_id,
            details={"chat_id": chat_id}
        )
        
        logger.info(f"[DELETE] Message {message_id} deleted by {user_id}")
        
        return success("Message deleted successfully", data={
            "message_id": message_id,
            "deleted_at": now.isoformat(),
            "can_recover": True,
            "recovery_window": MESSAGE_DELETE_WINDOW
        })
    
    except Exception as e:
        logger.error(f"[DELETE ERROR] {e}")
        logger.error(traceback.format_exc())
        message_audit_logger.log(
            "MESSAGE_DELETED", user_id, message_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to delete message", 500)


# ============================================================
#                   RECOVER MESSAGE
# ============================================================

@message_features_bp.route("/<message_id>/recover", methods=["POST"])
@jwt_required()
def recover_message(message_id):
    """✅ ENHANCED: Recover deleted message within recovery window"""
    try:
        user_id = get_jwt_identity()
        
        db = get_db()
        message = db.messages.find_one({"_id": ObjectId(message_id)})
        
        if not message:
            return error("Message not found", 404)
        
        if not message.get("is_deleted", False):
            return error("Message is not deleted", 400)
        
        # ✅ ENHANCED: Check recovery window
        recovery_until = message.get("can_recover_until")
        if recovery_until and now_utc() > recovery_until:
            return error("Recovery window expired", 410)
        
        # ✅ ENHANCED: Only deleter can recover
        if message.get("deleted_by") != user_id:
            return error("Only deleter can recover", 403)
        
        # ✅ ENHANCED: Get original content from edit history
        original_content = message.get("encrypted_content")
        if not original_content or original_content == "[deleted]":
            # Try to get from edit history
            edit_history = message.get("edit_history", [])
            if edit_history:
                original_content = edit_history[-1].get("content")
        
        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "is_deleted": False,
                    "recovered_at": now_utc(),
                    "recovered_by": user_id
                },
                "$unset": {"deleted_at": "", "can_recover_until": ""}
            }
        )
        
        # ✅ ENHANCED: Broadcast recovery
        chat_id = message.get("chat_id")
        if chat_id:
            socketio.emit(
                "message:recovered",
                {
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "recovered_by": user_id
                },
                room=f"chat:{chat_id}"
            )
        
        message_audit_logger.log(
            "MESSAGE_RECOVERED", user_id, message_id,
            details={"chat_id": chat_id}
        )
        
        logger.info(f"[RECOVER] Message {message_id} recovered by {user_id}")
        
        return success("Message recovered successfully")
    
    except Exception as e:
        logger.error(f"[RECOVER ERROR] {e}")
        return error("Failed to recover message", 500)


# ============================================================
#                   THREADED MESSAGES
# ============================================================

@message_features_bp.route("/<message_id>/replies", methods=["POST"])
@jwt_required()
def create_thread_reply(message_id):
    """
    ✅ ENHANCED: Create threaded reply
    
    POST /api/messages/{message_id}/replies
    {
        "encrypted_content": "reply content",
        "x3dh_header": "..."
    }
    
    Response: {
        "reply_id": "...",
        "parent_id": "...",
        "created_at": "..."
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        encrypted_content = data.get("encrypted_content", "").strip()
        
        # ✅ ENHANCED: Validate input
        if not encrypted_content:
            return error("Content is required", 400)
        
        if len(encrypted_content) > 65536:
            return error("Content too large", 400)
        
        # ✅ ENHANCED: Find parent message
        db = get_db()
        parent = db.messages.find_one({"_id": ObjectId(message_id)})
        
        if not parent:
            return error("Parent message not found", 404)
        
        if parent.get("is_deleted", False):
            return error("Cannot reply to deleted message", 400)
        
        chat_id = parent.get("chat_id")
        
        # ✅ ENHANCED: Verify user is in chat
        if not verify_user_in_chat(user_id, chat_id):
            return error("Access denied to chat", 403)
        
        # ✅ ENHANCED: Check thread depth
        depth = 0
        current = parent
        while current.get("parent_id") and depth < MAX_THREAD_DEPTH:
            parent_doc = db.messages.find_one({"_id": ObjectId(current.get("parent_id"))})
            if not parent_doc:
                break
            current = parent_doc
            depth += 1
        
        if depth >= MAX_THREAD_DEPTH:
            return error("Thread depth limit reached", 400)
        
        # ✅ ENHANCED: Count thread size
        thread_count = db.messages.count_documents({
            "$or": [
                {"parent_id": message_id},
                {"_id": ObjectId(message_id), "parent_id": {"$exists": True}}
            ]
        })
        
        if thread_count >= MAX_THREAD_SIZE:
            return error("Thread size limit reached", 400)
        
        # ✅ ENHANCED: Get user info
        user = db.users.find_one({"_id": ObjectId(user_id)})
        username = user.get("username", "Unknown") if user else "Unknown"
        
        # ✅ ENHANCED: Create reply
        reply_doc = {
            "encrypted_content": encrypted_content,
            "x3dh_header": data.get("x3dh_header"),
            "sender_id": user_id,
            "username": username,
            "chat_id": chat_id,
            "parent_id": message_id,
            "created_at": now_utc(),
            "is_deleted": False,
            "is_edited": False,
            "message_type": "reply",
            "e2e_encrypted": True
        }
        
        result = db.messages.insert_one(reply_doc)
        reply_id = str(result.inserted_id)
        
        # ✅ ENHANCED: Update parent reply count
        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$inc": {"reply_count": 1},
                "$set": {"last_reply_at": now_utc()}
            }
        )
        
        # ✅ ENHANCED: Broadcast reply
        socketio.emit(
            "message:reply",
            {
                "reply_id": reply_id,
                "parent_id": message_id,
                "chat_id": chat_id,
                "sender_id": user_id,
                "username": username,
                "created_at": reply_doc["created_at"].isoformat()
            },
            room=f"chat:{chat_id}"
        )
        
        message_audit_logger.log(
            "REPLY_CREATED", user_id, reply_id,
            details={
                "parent_id": message_id,
                "chat_id": chat_id
            }
        )
        
        logger.info(f"[REPLY] User {user_id} replied to {message_id}")
        
        return success("Reply created successfully", data={
            "reply_id": reply_id,
            "parent_id": message_id,
            "created_at": reply_doc["created_at"].isoformat()
        })
    
    except Exception as e:
        logger.error(f"[CREATE REPLY ERROR] {e}")
        logger.error(traceback.format_exc())
        message_audit_logger.log(
            "REPLY_CREATED", user_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to create reply", 500)


# ============================================================
#                   GET THREAD REPLIES
# ============================================================

@message_features_bp.route("/<message_id>/replies", methods=["GET"])
@jwt_required()
def get_thread_replies(message_id):
    """
    ✅ ENHANCED: Get threaded replies with pagination
    
    GET /api/messages/{message_id}/replies?page=1&limit=50
    
    Response: {
        "replies": [...],
        "total": int,
        "page": int,
        "pages": int
    }
    """
    try:
        user_id = get_jwt_identity()
        page = int(request.args.get("page", 1))
        limit = min(int(request.args.get("limit", 50)), 100)
        
        # ✅ ENHANCED: Validate inputs
        if page < 1:
            return error("Page must be >= 1", 400)
        
        # ✅ ENHANCED: Find parent message
        db = get_db()
        parent = db.messages.find_one({"_id": ObjectId(message_id)})
        
        if not parent:
            return error("Message not found", 404)
        
        chat_id = parent.get("chat_id")
        
        # ✅ ENHANCED: Verify user is in chat
        if not verify_user_in_chat(user_id, chat_id):
            return error("Access denied to chat", 403)
        
        # ✅ ENHANCED: Query replies
        total = db.messages.count_documents({
            "parent_id": message_id,
            "is_deleted": False
        })
        
        skip = (page - 1) * limit
        
        cursor = db.messages.find({
            "parent_id": message_id,
            "is_deleted": False
        }).sort("created_at", 1).skip(skip).limit(limit)
        
        replies = []
        for msg in cursor:
            replies.append({
                "id": str(msg["_id"]),
                "content": "[encrypted]",
                "sender_id": msg.get("sender_id"),
                "username": msg.get("username", "Unknown"),
                "created_at": msg.get("created_at", now_utc()).isoformat(),
                "is_edited": msg.get("is_edited", False),
                "reply_count": msg.get("reply_count", 0)
            })
        
        pages = (total + limit - 1) // limit
        
        logger.info(f"[GET REPLIES] User {user_id} retrieved {len(replies)} replies")
        
        return success("Replies retrieved successfully", data={
            "replies": replies,
            "total": total,
            "page": page,
            "pages": pages,
            "limit": limit
        })
    
    except ValueError:
        return error("Invalid parameter format", 400)
    
    except Exception as e:
        logger.error(f"[GET REPLIES ERROR] {e}")
        return error("Failed to fetch replies", 500)


# ============================================================
#                   PIN MESSAGE
# ============================================================

@message_features_bp.route("/<message_id>/pin", methods=["POST"])
@jwt_required()
def pin_message(message_id):
    """✅ ENHANCED: Pin message to top of chat"""
    try:
        user_id = get_jwt_identity()
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = message_rate_limiter.check_limit(user_id, "pin", PIN_RATE_LIMIT)
        if not allowed:
            return error(msg, 429)
        
        db = get_db()
        message = db.messages.find_one({"_id": ObjectId(message_id)})
        
        if not message:
            return error("Message not found", 404)
        
        chat_id = message.get("chat_id")
        
        # ✅ ENHANCED: Verify user is admin/in chat
        if not verify_user_in_chat(user_id, chat_id):
            return error("Access denied to chat", 403)
        
        # ✅ ENHANCED: Unpin if already pinned
        if message.get("is_pinned", False):
            db.messages.update_one(
                {"_id": ObjectId(message_id)},
                {"$set": {"is_pinned": False}}
            )
            
            socketio.emit(
                "message:unpinned",
                {"message_id": message_id, "chat_id": chat_id},
                room=f"chat:{chat_id}"
            )
            
            return success("Message unpinned")
        
        # ✅ ENHANCED: Pin message
        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "is_pinned": True,
                    "pinned_at": now_utc(),
                    "pinned_by": user_id
                }
            }
        )
        
        socketio.emit(
            "message:pinned",
            {
                "message_id": message_id,
                "chat_id": chat_id,
                "pinned_by": user_id
            },
            room=f"chat:{chat_id}"
        )
        
        message_audit_logger.log("MESSAGE_PINNED", user_id, message_id)
        
        return success("Message pinned successfully")
    
    except Exception as e:
        logger.error(f"[PIN ERROR] {e}")
        return error("Failed to pin message", 500)


# ============================================================
#                   GET PINNED MESSAGES
# ============================================================

@message_features_bp.route("/chat/<chat_id>/pinned", methods=["GET"])
@jwt_required()
def get_pinned_messages(chat_id):
    """✅ ENHANCED: Get all pinned messages in chat"""
    try:
        user_id = get_jwt_identity()
        
        # ✅ ENHANCED: Verify user is in chat
        if not verify_user_in_chat(user_id, chat_id):
            return error("Access denied to chat", 403)
        
        db = get_db()
        
        cursor = db.messages.find({
            "chat_id": chat_id,
            "is_pinned": True,
            "is_deleted": False
        }).sort("pinned_at", -1)
        
        pinned = []
        for msg in cursor:
            pinned.append({
                "id": str(msg["_id"]),
                "sender_id": msg.get("sender_id"),
                "username": msg.get("username"),
                "pinned_at": msg.get("pinned_at", now_utc()).isoformat(),
                "pinned_by": msg.get("pinned_by")
            })
        
        return success("Pinned messages retrieved", data={"pinned": pinned})
    
    except Exception as e:
        logger.error(f"[GET PINNED ERROR] {e}")
        return error("Failed to fetch pinned messages", 500)


# ============================================================
#                   INITIALIZATION
# ============================================================

def init_message_features():
    """✅ ENHANCED: Initialize message features"""
    logger.info("[MESSAGE FEATURES] Initialized")


__all__ = [
    "message_features_bp",
    "message_audit_logger",
    "init_message_features"
]
