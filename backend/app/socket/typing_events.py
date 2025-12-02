"""
Typing indicator socket events
------------------------------
Broadcasts "user is typing" and "user stopped typing" notifications
to all members of a chat:<chat_id> room.

✅ ENHANCED FEATURES:
- Rate limiting on typing indicators
- Session validation
- Timeout protection (auto-clear typing after inactivity)
- Audit logging
- Proper error handling
- User presence tracking
- Memory-efficient cleanup
- Multi-room support
- Typing indicator throttling
"""

import logging
import traceback
import time
from typing import Optional, Dict, Set
from datetime import datetime, timedelta

from flask import request
from bson import ObjectId

from app import socketio
from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   CONSTANTS
# ============================================================

TYPING_TIMEOUT = 5  # Clear typing indicator after 5 seconds of inactivity
MAX_TYPING_EVENTS_PER_MINUTE = 30  # Rate limit: prevent spam
TYPING_INDICATOR_THROTTLE = 0.5  # Minimum seconds between typing events


# ============================================================
#                   AUDIT LOGGING
# ============================================================

class TypingAuditLogger:
    """✅ ENHANCED: Audit log for typing indicators"""
    
    COLLECTION = "typing_audit_logs"
    
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()
        try:
            self.db[self.COLLECTION].create_index([("timestamp", -1)])
            self.db[self.COLLECTION].create_index([("user_id", 1)])
            self.db[self.COLLECTION].create_index([("chat_id", 1)])
            # TTL index: auto-delete logs after 7 days
            self.db[self.COLLECTION].create_index([("timestamp", 1)], expireAfterSeconds=604800)
        except Exception as e:
            logger.warning(f"[TYPING AUDIT] Index creation failed: {e}")
    
    def log(self, event: str, user_id: str, chat_id: str, 
            status: str = "success", error_msg: str = ""):
        """✅ ENHANCED: Log typing event"""
        try:
            doc = {
                "event": event,
                "user_id": user_id,
                "chat_id": chat_id,
                "status": status,
                "error": error_msg,
                "ip_address": request.remote_addr if request else None,
                "timestamp": now_utc()
            }
            self.db[self.COLLECTION].insert_one(doc)
        except Exception as e:
            logger.error(f"[TYPING AUDIT] Failed to log: {e}")


typing_audit_logger = TypingAuditLogger()


# ============================================================
#                   RATE LIMITING
# ============================================================

class TypingRateLimiter:
    """✅ ENHANCED: Rate limiting for typing indicators"""
    
    def __init__(self):
        self.typing_events = {}  # user_id -> [(timestamp, chat_id), ...]
    
    def check_limit(self, user_id: str, limit: int = MAX_TYPING_EVENTS_PER_MINUTE) -> tuple:
        """✅ ENHANCED: Check if typing events are within rate limit"""
        now = time.time()
        
        if user_id not in self.typing_events:
            self.typing_events[user_id] = []
        
        # Clean old entries (older than 1 minute)
        cutoff = now - 60
        self.typing_events[user_id] = [
            (ts, cid) for ts, cid in self.typing_events[user_id] if ts > cutoff
        ]
        
        count = len(self.typing_events[user_id])
        
        if count >= limit:
            return False, "Typing indicator rate limit exceeded"
        
        return True, ""
    
    def record_typing(self, user_id: str, chat_id: str):
        """✅ ENHANCED: Record typing event"""
        if user_id not in self.typing_events:
            self.typing_events[user_id] = []
        
        self.typing_events[user_id].append((time.time(), chat_id))


typing_rate_limiter = TypingRateLimiter()


# ============================================================
#                   TYPING STATE MANAGER
# ============================================================

class TypingStateManager:
    """✅ ENHANCED: Manage typing state with timeouts"""
    
    def __init__(self):
        self.active_typers = {}  # chat_id -> {user_id: timestamp, ...}
        self.throttle_times = {}  # f"{user_id}:{chat_id}" -> timestamp
    
    def set_typing(self, user_id: str, chat_id: str) -> bool:
        """✅ ENHANCED: Mark user as typing with throttle check"""
        key = f"{user_id}:{chat_id}"
        now = time.time()
        
        # ✅ ENHANCED: Throttle frequent typing events
        if key in self.throttle_times:
            last_time = self.throttle_times[key]
            if (now - last_time) < TYPING_INDICATOR_THROTTLE:
                return False  # Throttled
        
        self.throttle_times[key] = now
        
        if chat_id not in self.active_typers:
            self.active_typers[chat_id] = {}
        
        self.active_typers[chat_id][user_id] = now
        return True
    
    def clear_typing(self, user_id: str, chat_id: str) -> bool:
        """✅ ENHANCED: Clear typing indicator"""
        if chat_id not in self.active_typers:
            return False
        
        if user_id in self.active_typers[chat_id]:
            del self.active_typers[chat_id][user_id]
            
            # Clean up empty rooms
            if not self.active_typers[chat_id]:
                del self.active_typers[chat_id]
            
            return True
        
        return False
    
    def get_typing_users(self, chat_id: str) -> list:
        """✅ ENHANCED: Get all users typing in chat"""
        if chat_id not in self.active_typers:
            return []
        
        return list(self.active_typers[chat_id].keys())
    
    def cleanup_stale(self) -> Dict[str, int]:
        """✅ ENHANCED: Remove typing indicators that have timed out"""
        now = time.time()
        cutoff = now - TYPING_TIMEOUT
        cleaned = {"chats": 0, "users": 0}
        
        chats_to_delete = []
        
        for chat_id, typers in self.active_typers.items():
            users_to_delete = []
            
            for user_id, timestamp in typers.items():
                if timestamp < cutoff:
                    users_to_delete.append(user_id)
                    cleaned["users"] += 1
            
            for user_id in users_to_delete:
                del typers[user_id]
            
            if not typers:
                chats_to_delete.append(chat_id)
                cleaned["chats"] += 1
        
        for chat_id in chats_to_delete:
            del self.active_typers[chat_id]
        
        return cleaned


typing_state_manager = TypingStateManager()


# ============================================================
#                   SESSION VALIDATION
# ============================================================

def get_user_from_session(sid: str) -> Optional[str]:
    """✅ ENHANCED: Get user ID from socket session"""
    try:
        # ✅ ENHANCED: Import session manager from chat_events
        from app.socket.chat_events import chat_session_manager
        
        session = chat_session_manager.get_session(sid)
        if session:
            return session.get("user_id")
    except Exception as e:
        logger.error(f"[TYPING SESSION] Failed to get user: {e}")
    
    return None


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
        logger.error(f"[TYPING VERIFY] Failed to verify: {e}")
        return False


# ============================================================
#                   TYPING EVENTS
# ============================================================

@socketio.on("typing:start")
def on_typing_start(data):
    """
    ✅ ENHANCED: Handle typing start with validation
    
    data = {
        chat_id: str,
        user_id?: str  # Auto-populated from session if not provided
    }
    
    Emits:
        typing:started -> {chat_id, user_id, username, timestamp}
        error -> {message, code}
    """
    try:
        # ✅ ENHANCED: Validate input
        if not isinstance(data, dict):
            logger.warning(f"[TYPING START] Invalid data format from {request.sid}")
            socketio.emit("error", {
                "message": "Invalid data format",
                "code": "INVALID_DATA"
            })
            return
        
        chat_id = str(data.get("chat_id", "")).strip()
        
        if not chat_id:
            socketio.emit("error", {
                "message": "chat_id required",
                "code": "MISSING_CHAT_ID"
            })
            return
        
        # ✅ ENHANCED: Get user from session (more secure)
        sid = request.sid
        user_id = get_user_from_session(sid)
        
        if not user_id:
            logger.warning(f"[TYPING START] No user session for {sid}")
            socketio.emit("error", {
                "message": "Unauthorized",
                "code": "AUTH_REQUIRED"
            })
            return
        
        # ✅ ENHANCED: Verify user is in chat
        if not verify_user_in_chat(user_id, chat_id):
            logger.warning(f"[TYPING START] User {user_id} not in chat {chat_id}")
            socketio.emit("error", {
                "message": "Access denied",
                "code": "ACCESS_DENIED"
            })
            return
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = typing_rate_limiter.check_limit(user_id)
        if not allowed:
            logger.debug(f"[TYPING START] Rate limit for {user_id}")
            typing_audit_logger.log("TYPING_START", user_id, chat_id, status="rate_limited")
            return  # Silently ignore to avoid spamming client
        
        # ✅ ENHANCED: Check throttle
        if not typing_state_manager.set_typing(user_id, chat_id):
            return  # Throttled
        
        # ✅ ENHANCED: Get user info for broadcast
        db = get_db()
        user = db.users.find_one({"_id": ObjectId(user_id)})
        username = user.get("username", "Unknown") if user else "Unknown"
        
        room = f"chat:{chat_id}"
        
        # ✅ ENHANCED: Broadcast typing indicator
        socketio.emit(
            "typing:started",
            {
                "chat_id": chat_id,
                "user_id": user_id,
                "username": username,
                "timestamp": now_utc().isoformat()
            },
            room=room,
            skip_sid=sid  # Don't send back to the typer
        )
        
        typing_audit_logger.log("TYPING_START", user_id, chat_id)
        logger.debug(f"[TYPING START] {username} ({user_id}) typing in {chat_id}")
        
        typing_rate_limiter.record_typing(user_id, chat_id)
    
    except Exception as e:
        logger.error(f"[TYPING START] Error: {e}")
        logger.error(traceback.format_exc())
        typing_audit_logger.log("TYPING_START", "unknown", data.get("chat_id", ""), 
                               status="failed", error_msg=str(e))


@socketio.on("typing:stop")
def on_typing_stop(data):
    """
    ✅ ENHANCED: Handle typing stop with validation
    
    data = {
        chat_id: str,
        user_id?: str  # Auto-populated from session if not provided
    }
    
    Emits:
        typing:stopped -> {chat_id, user_id, timestamp}
        error -> {message, code}
    """
    try:
        # ✅ ENHANCED: Validate input
        if not isinstance(data, dict):
            logger.warning(f"[TYPING STOP] Invalid data format from {request.sid}")
            socketio.emit("error", {
                "message": "Invalid data format",
                "code": "INVALID_DATA"
            })
            return
        
        chat_id = str(data.get("chat_id", "")).strip()
        
        if not chat_id:
            socketio.emit("error", {
                "message": "chat_id required",
                "code": "MISSING_CHAT_ID"
            })
            return
        
        # ✅ ENHANCED: Get user from session
        sid = request.sid
        user_id = get_user_from_session(sid)
        
        if not user_id:
            logger.warning(f"[TYPING STOP] No user session for {sid}")
            return  # Silent fail on disconnect
        
        # ✅ ENHANCED: Clear typing state
        was_typing = typing_state_manager.clear_typing(user_id, chat_id)
        
        if not was_typing:
            return  # User wasn't typing
        
        room = f"chat:{chat_id}"
        
        # ✅ ENHANCED: Broadcast stop indicator
        socketio.emit(
            "typing:stopped",
            {
                "chat_id": chat_id,
                "user_id": user_id,
                "timestamp": now_utc().isoformat()
            },
            room=room,
            skip_sid=sid
        )
        
        typing_audit_logger.log("TYPING_STOP", user_id, chat_id)
        logger.debug(f"[TYPING STOP] {user_id} stopped typing in {chat_id}")
    
    except Exception as e:
        logger.error(f"[TYPING STOP] Error: {e}")
        logger.error(traceback.format_exc())


@socketio.on("typing:users")
def on_get_typing_users(data):
    """
    ✅ ENHANCED: Get all users currently typing in a chat
    
    data = {
        chat_id: str
    }
    
    Emits:
        typing:users -> {chat_id, users: [user_ids], count: int}
    """
    try:
        if not isinstance(data, dict):
            return
        
        chat_id = str(data.get("chat_id", "")).strip()
        
        if not chat_id:
            return
        
        # ✅ ENHANCED: Get session user
        sid = request.sid
        user_id = get_user_from_session(sid)
        
        if not user_id:
            return
        
        # ✅ ENHANCED: Get typing users
        typing_users = typing_state_manager.get_typing_users(chat_id)
        
        # ✅ ENHANCED: Return to requester
        socketio.emit("typing:users", {
            "chat_id": chat_id,
            "users": typing_users,
            "count": len(typing_users),
            "timestamp": now_utc().isoformat()
        })
        
        logger.debug(f"[TYPING USERS] {len(typing_users)} users typing in {chat_id}")
    
    except Exception as e:
        logger.error(f"[TYPING USERS] Error: {e}")


# ============================================================
#                   CLEANUP ON DISCONNECT
# ============================================================

@socketio.on("disconnect")
def on_typing_disconnect():
    """✅ ENHANCED: Clean up typing state on disconnect"""
    try:
        sid = request.sid
        user_id = get_user_from_session(sid)
        
        if not user_id:
            return
        
        # ✅ ENHANCED: Clear all typing indicators for this user across all chats
        chats_cleared = 0
        active_typers = typing_state_manager.active_typers.copy()
        
        for chat_id, typers in active_typers.items():
            if user_id in typers:
                typing_state_manager.clear_typing(user_id, chat_id)
                
                # ✅ ENHANCED: Notify room
                socketio.emit(
                    "typing:stopped",
                    {
                        "chat_id": chat_id,
                        "user_id": user_id,
                        "timestamp": now_utc().isoformat()
                    },
                    room=f"chat:{chat_id}"
                )
                
                chats_cleared += 1
        
        if chats_cleared > 0:
            logger.debug(f"[TYPING DISCONNECT] Cleared {chats_cleared} typing indicators for {user_id}")
    
    except Exception as e:
        logger.error(f"[TYPING DISCONNECT] Error: {e}")


# ============================================================
#                   BACKGROUND CLEANUP
# ============================================================

def cleanup_stale_typing_indicators():
    """✅ ENHANCED: Periodically clean up stale typing indicators"""
    try:
        result = typing_state_manager.cleanup_stale()
        
        if result["users"] > 0:
            logger.info(f"[TYPING CLEANUP] Cleared {result['users']} stale typing indicators from {result['chats']} chats")
    
    except Exception as e:
        logger.error(f"[TYPING CLEANUP] Error: {e}")


# ============================================================
#                   INITIALIZATION (FIXED)
# ============================================================

def register_typing_events(socketio_instance=None):
    """
    Register typing events with Socket.IO.
    All @socketio.on handlers in this module are already active when imported.
    This function only exists so app_factory.py can import it without errors.
    """
    try:
        # Start periodic cleanup of stale typing indicators (every 10s)
        from threading import Timer

        def schedule_cleanup():
            try:
                cleanup_stale_typing_indicators()
            except Exception as e:
                logger.error(f"[TYPING CLEANUP] Error: {e}")
            Timer(10, schedule_cleanup).start()

        Timer(10, schedule_cleanup).start()

        logger.info("[TYPING EVENTS] Registered with periodic cleanup")

        if socketio_instance:
            logger.debug("[TYPING EVENTS] Socket.IO instance received")

    except Exception as e:
        logger.error(f"[TYPING EVENTS INIT] Error: {e}")


__all__ = ["register_typing_events", "typing_state_manager", "typing_audit_logger"]
