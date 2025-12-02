"""
WebRTC signaling + call lifecycle handler (production-ready)
-----------------------------------------------------------

Handles:
- Offers / Answers
- ICE candidates
- Call start, accept, end
- Call DB updates (status → ringing/accepted/ended/missed)
- Socket room routing
- Call validation and security
- Rate limiting on call operations
- Comprehensive error handling and logging
- Call duration tracking
- Missed call detection
- Call state management
"""

import logging
import traceback
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from functools import wraps

from flask import request
from flask_socketio import emit, join_room, leave_room, rooms
from bson import ObjectId

from app import socketio
from app.database import get_db
from app.utils.helpers import now_utc
from app.security.hardening import audit_logger

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   CONSTANTS
# ============================================================

CALL_TIMEOUT = 300  # 5 minutes
MISSED_CALL_THRESHOLD = 30  # Seconds before marking as missed
MAX_CONCURRENT_CALLS = 3
MAX_CALL_DURATION = 3600  # 1 hour
RATE_LIMIT_CALLS = 10  # Per minute
RATE_LIMIT_ICE = 50  # Per minute


# ============================================================
#                   AUDIT LOGGING
# ============================================================

class CallAuditLogger:
    """✅ ENHANCED: Comprehensive call logging"""
    
    COLLECTION = "call_audit_logs"
    
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()
        try:
            self.db[self.COLLECTION].create_index([("timestamp", -1)])
            self.db[self.COLLECTION].create_index([("call_id", 1)])
            self.db[self.COLLECTION].create_index([("user_id", 1)])
        except Exception as e:
            logger.warning(f"[CALL AUDIT] Index creation failed: {e}")
    
    def log(self, event: str, user_id: str, call_id: str = None, 
            status: str = "success", details: Dict = None, error_msg: str = ""):
        """✅ ENHANCED: Log call event"""
        try:
            doc = {
                "event": event,
                "user_id": user_id,
                "call_id": call_id,
                "status": status,
                "details": details or {},
                "error": error_msg,
                "ip_address": request.remote_addr if request else None,
                "sid": request.sid if request else None,
                "timestamp": now_utc()
            }
            self.db[self.COLLECTION].insert_one(doc)
        except Exception as e:
            logger.error(f"[CALL AUDIT] Failed to log: {e}")


call_audit_logger = CallAuditLogger()


# ============================================================
#                   RATE LIMITING
# ============================================================

class CallRateLimiter:
    """✅ ENHANCED: Rate limiting for call operations"""
    
    def __init__(self):
        self.call_counts = {}  # user_id -> [(timestamp, op_type), ...]
    
    def check_limit(self, user_id: str, operation: str, limit: int) -> Tuple[bool, str]:
        """✅ ENHANCED: Check if operation is within rate limit"""
        now = time.time()
        
        if user_id not in self.call_counts:
            self.call_counts[user_id] = []
        
        # Clean old entries (older than 1 minute)
        cutoff = now - 60
        self.call_counts[user_id] = [
            (ts, op) for ts, op in self.call_counts[user_id] if ts > cutoff
        ]
        
        # Count operations of this type
        count = sum(1 for _, op in self.call_counts[user_id] if op == operation)
        
        if count >= limit:
            return False, f"Rate limit exceeded for {operation} ({limit}/min)"
        
        self.call_counts[user_id].append((now, operation))
        return True, ""


call_rate_limiter = CallRateLimiter()


# ============================================================
#                   USER SESSION MANAGEMENT
# ============================================================

class UserSessionManager:
    """✅ ENHANCED: Track connected users and their active calls"""
    
    def __init__(self):
        self.connected_users = {}  # sid -> user_info
        self.active_calls = {}  # user_id -> [call_ids]
    
    def register_user(self, sid: str, user_id: str, user_info: Dict):
        """✅ ENHANCED: Register connected user"""
        self.connected_users[sid] = {
            "user_id": user_id,
            "connected_at": now_utc(),
            **user_info
        }
        logger.debug(f"[SESSION] Registered user {user_id} (SID: {sid})")
    
    def unregister_user(self, sid: str):
        """✅ ENHANCED: Unregister user on disconnect"""
        if sid in self.connected_users:
            user_info = self.connected_users.pop(sid)
            logger.debug(f"[SESSION] Unregistered user {user_info.get('user_id')} (SID: {sid})")
    
    def get_user_info(self, sid: str) -> Optional[Dict]:
        """✅ ENHANCED: Get user info from SID"""
        return self.connected_users.get(sid)
    
    def get_user_id(self, sid: str) -> Optional[str]:
        """✅ ENHANCED: Get user ID from SID"""
        user_info = self.connected_users.get(sid)
        return user_info.get("user_id") if user_info else None
    
    def add_active_call(self, user_id: str, call_id: str):
        """✅ ENHANCED: Track active call"""
        if user_id not in self.active_calls:
            self.active_calls[user_id] = []
        
        if call_id not in self.active_calls[user_id]:
            self.active_calls[user_id].append(call_id)
    
    def remove_active_call(self, user_id: str, call_id: str):
        """✅ ENHANCED: Untrack call"""
        if user_id in self.active_calls:
            self.active_calls[user_id] = [
                cid for cid in self.active_calls[user_id] if cid != call_id
            ]
    
    def get_active_calls(self, user_id: str) -> list:
        """✅ ENHANCED: Get active calls for user"""
        return self.active_calls.get(user_id, [])
    
    def get_concurrent_call_count(self, user_id: str) -> int:
        """✅ ENHANCED: Count concurrent calls"""
        return len(self.get_active_calls(user_id))


user_session_manager = UserSessionManager()


# ============================================================
#                   DECORATORS
# ============================================================

def socket_authenticated(f):
    """✅ ENHANCED: Require authenticated socket connection"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        sid = request.sid
        user_info = user_session_manager.get_user_info(sid)
        
        if not user_info:
            logger.warning(f"[AUTH] Unauthenticated socket event from SID {sid}")
            emit("error", {"message": "Unauthorized"})
            return
        
        return f(user_info, *args, **kwargs)
    
    return wrapper


def validate_call_data(required_fields: list):
    """✅ ENHANCED: Validate required fields in call data"""
    def decorator(f):
        @wraps(f)
        def wrapper(user_info, data, *args, **kwargs):
            if not isinstance(data, dict):
                emit("error", {"message": "Invalid data format"})
                return
            
            missing = [field for field in required_fields if field not in data]
            if missing:
                emit("error", {"message": f"Missing fields: {', '.join(missing)}"})
                return
            
            return f(user_info, data, *args, **kwargs)
        
        return wrapper
    
    return decorator


# ============================================================
#                   SAFE EMIT HELPER
# ============================================================

def safe_emit(event: str, payload: Dict = None, room: str = None, skip_sid: str = None) -> bool:
    """✅ ENHANCED: Emit safely with error handling"""
    try:
        if payload is None:
            payload = {}
        
        socketio.emit(event, payload, room=room, skip_sid=skip_sid)
        return True
    
    except Exception as e:
        logger.error(f"[SOCKET EMIT] Event {event} failed: {e}")
        logger.error(traceback.format_exc())
        return False


# ============================================================
#                   CONNECTION LIFECYCLE
# ============================================================

@socketio.on("connect")
def on_connect(auth=None):
    """✅ ENHANCED: Handle client connection"""
    sid = request.sid
    logger.info(f"[CONNECT] Client connected: {sid}")
    
    try:
        # ✅ ENHANCED: Validate authentication token
        if not auth:
            logger.warning(f"[CONNECT] No auth token from {sid}")
            return False
        
        # ✅ ENHANCED: Extract and verify token
        from flask_jwt_extended import decode_token
        
        token = auth.get("token")
        if not token:
            return False
        
        try:
            decoded = decode_token(token)
            user_id = decoded.get("sub")
            
            if not user_id:
                return False
            
            # ✅ ENHANCED: Fetch user from DB
            db = get_db()
            user = db.users.find_one({"_id": ObjectId(user_id)})
            
            if not user:
                logger.warning(f"[CONNECT] User not found: {user_id}")
                return False
            
            # ✅ ENHANCED: Register user session
            user_session_manager.register_user(sid, str(user_id), {
                "username": user.get("username"),
                "email": user.get("email")
            })
            
            # ✅ ENHANCED: Auto-join user room
            join_room(f"user:{user_id}")
            
            emit("connect:success", {"message": "Connected to SecureChannelX"})
            logger.info(f"[CONNECT] User {user_id} authenticated via {sid}")
            
            return True
        
        except Exception as decode_error:
            logger.error(f"[CONNECT] Token decode failed: {decode_error}")
            return False
    
    except Exception as e:
        logger.error(f"[CONNECT] Error: {e}")
        logger.error(traceback.format_exc())
        return False


@socketio.on("disconnect")
def on_disconnect():
    """✅ ENHANCED: Handle client disconnection"""
    sid = request.sid
    
    try:
        user_info = user_session_manager.get_user_info(sid)
        
        if user_info:
            user_id = user_info.get("user_id")
            
            # ✅ ENHANCED: End any active calls
            active_calls = user_session_manager.get_active_calls(user_id)
            for call_id in active_calls:
                _handle_call_end(user_id, call_id, "disconnected")
            
            call_audit_logger.log("DISCONNECT", user_id)
        
        user_session_manager.unregister_user(sid)
        logger.info(f"[DISCONNECT] Client disconnected: {sid}")
    
    except Exception as e:
        logger.error(f"[DISCONNECT] Error: {e}")
        logger.error(traceback.format_exc())


# ============================================================
#                   ROOM MANAGEMENT
# ============================================================

@socketio.on("join:user")
@socket_authenticated
@validate_call_data(["user_id"])
def on_join_user(user_info, data):
    """✅ ENHANCED: Join user room"""
    try:
        user_id = data.get("user_id")
        current_user = user_info.get("user_id")
        
        # ✅ ENHANCED: Prevent spoofing (can only join own room)
        if user_id != current_user:
            logger.warning(f"[JOIN] User {current_user} attempted to join room {user_id}")
            emit("error", {"message": "Cannot join other user's room"})
            return
        
        join_room(f"user:{user_id}")
        emit("join:user:success", {"user_id": user_id})
        logger.debug(f"[JOIN USER] User {user_id} joined own room")
    
    except Exception as e:
        logger.error(f"[JOIN USER] Error: {e}")
        emit("error", {"message": "Failed to join user room"})


@socketio.on("join:chat")
@socket_authenticated
@validate_call_data(["chat_id"])
def on_join_chat(user_info, data):
    """✅ ENHANCED: Join chat room"""
    try:
        chat_id = data.get("chat_id")
        user_id = user_info.get("user_id")
        
        # ✅ ENHANCED: Verify user is part of chat
        db = get_db()
        chat = db.chats.find_one({
            "_id": ObjectId(chat_id),
            "participants": user_id
        })
        
        if not chat:
            logger.warning(f"[JOIN] User {user_id} not in chat {chat_id}")
            emit("error", {"message": "Access denied to chat"})
            return
        
        join_room(f"chat:{chat_id}")
        emit("join:chat:success", {"chat_id": chat_id})
        logger.debug(f"[JOIN CHAT] User {user_id} joined chat {chat_id}")
    
    except Exception as e:
        logger.error(f"[JOIN CHAT] Error: {e}")
        emit("error", {"message": "Failed to join chat room"})


@socketio.on("leave:room")
@socket_authenticated
@validate_call_data(["room"])
def on_leave_room(user_info, data):
    """✅ ENHANCED: Leave room"""
    try:
        room = data.get("room")
        leave_room(room)
        emit("leave:room:success", {"room": room})
    except Exception as e:
        logger.error(f"[LEAVE ROOM] Error: {e}")


# ============================================================
#                   SIGNALING EVENTS
# ============================================================

@socketio.on("call:offer")
@socket_authenticated
@validate_call_data(["callee_id", "offer"])
def on_call_offer(user_info, data):
    """✅ ENHANCED: Send WebRTC offer"""
    try:
        caller_id = user_info.get("user_id")
        callee_id = data.get("callee_id")
        offer = data.get("offer")
        chat_id = data.get("chat_id")
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = call_rate_limiter.check_limit(caller_id, "offer", RATE_LIMIT_CALLS)
        if not allowed:
            logger.warning(f"[OFFER] Rate limit exceeded for user {caller_id}")
            emit("error", {"message": msg})
            return
        
        # ✅ ENHANCED: Validate caller and callee
        if caller_id == callee_id:
            emit("error", {"message": "Cannot call yourself"})
            return
        
        # ✅ ENHANCED: Prevent spoofing
        data["caller_id"] = caller_id
        
        # ✅ ENHANCED: Send to callee
        safe_emit("call:offer", data, room=f"user:{callee_id}")
        
        call_audit_logger.log("OFFER_SENT", caller_id, details={
            "callee": callee_id
        })
        
        logger.debug(f"[OFFER] {caller_id} -> {callee_id}")
    
    except Exception as e:
        logger.error(f"[OFFER] Error: {e}")
        emit("error", {"message": "Failed to send offer"})
        call_audit_logger.log("OFFER_SENT", user_info.get("user_id"), 
                             status="failed", error_msg=str(e))


@socketio.on("call:answer")
@socket_authenticated
@validate_call_data(["caller_id", "answer"])
def on_call_answer(user_info, data):
    """✅ ENHANCED: Send WebRTC answer"""
    try:
        callee_id = user_info.get("user_id")
        caller_id = data.get("caller_id")
        answer = data.get("answer")
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = call_rate_limiter.check_limit(callee_id, "answer", RATE_LIMIT_CALLS)
        if not allowed:
            emit("error", {"message": msg})
            return
        
        # ✅ ENHANCED: Prevent spoofing
        data["callee_id"] = callee_id
        
        # ✅ ENHANCED: Send to caller
        safe_emit("call:answer", data, room=f"user:{caller_id}")
        
        call_audit_logger.log("ANSWER_SENT", callee_id, details={
            "caller": caller_id
        })
        
        logger.debug(f"[ANSWER] {callee_id} -> {caller_id}")
    
    except Exception as e:
        logger.error(f"[ANSWER] Error: {e}")
        emit("error", {"message": "Failed to send answer"})
        call_audit_logger.log("ANSWER_SENT", user_info.get("user_id"), 
                             status="failed", error_msg=str(e))


@socketio.on("call:ice")
@socket_authenticated
@validate_call_data(["to", "ice"])
def on_call_ice(user_info, data):
    """✅ ENHANCED: Send ICE candidate"""
    try:
        user_id = user_info.get("user_id")
        to_user = data.get("to")
        ice = data.get("ice")
        
        # ✅ ENHANCED: Rate limiting (strict for ICE)
        allowed, msg = call_rate_limiter.check_limit(user_id, "ice", RATE_LIMIT_ICE)
        if not allowed:
            logger.debug(f"[ICE] Rate limit for {user_id}")
            return  # Don't emit error for ICE to avoid noise
        
        # ✅ ENHANCED: Add sender info
        data["from"] = user_id
        
        # ✅ ENHANCED: Send to recipient
        safe_emit("call:ice", data, room=f"user:{to_user}")
        
        logger.debug(f"[ICE] {user_id} -> {to_user}")
    
    except Exception as e:
        logger.error(f"[ICE] Error: {e}")


# ============================================================
#                   CALL LIFECYCLE MANAGEMENT
# ============================================================

@socketio.on("call:start")
@socket_authenticated
@validate_call_data(["chat_id", "receiver_id"])
def on_call_start(user_info, data):
    """✅ ENHANCED: Initiate new call"""
    try:
        db = get_db()
        caller_id = user_info.get("user_id")
        receiver_id = data.get("receiver_id")
        chat_id = data.get("chat_id")
        call_type = data.get("call_type", "audio")
        
        # ✅ ENHANCED: Validate call type
        if call_type not in ["audio", "video"]:
            emit("error", {"message": "Invalid call type"})
            return
        
        # ✅ ENHANCED: Validate caller and receiver
        if caller_id == receiver_id:
            emit("error", {"message": "Cannot call yourself"})
            return
        
        # ✅ ENHANCED: Check concurrent call limit
        concurrent = user_session_manager.get_concurrent_call_count(caller_id)
        if concurrent >= MAX_CONCURRENT_CALLS:
            emit("error", {"message": f"Too many concurrent calls (max {MAX_CONCURRENT_CALLS})"})
            return
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = call_rate_limiter.check_limit(caller_id, "start_call", RATE_LIMIT_CALLS)
        if not allowed:
            emit("error", {"message": msg})
            return
        
        # ✅ ENHANCED: Verify chat exists and users are participants
        chat = db.chats.find_one({
            "_id": ObjectId(chat_id),
            "participants": {"$all": [caller_id, receiver_id]}
        })
        
        if not chat:
            emit("error", {"message": "Invalid chat or access denied"})
            return
        
        # ✅ ENHANCED: Create call document
        call_doc = {
            "chat_id": ObjectId(chat_id),
            "caller_id": caller_id,
            "receiver_id": receiver_id,
            "call_type": call_type,
            "status": "ringing",
            "started_at": now_utc(),
            "answered_at": None,
            "ended_at": None,
            "duration_seconds": None,
            "call_metadata": {
                "initiator_ip": request.remote_addr,
                "call_version": "v2"
            }
        }
        
        res = db.calls.insert_one(call_doc)
        call_id = str(res.inserted_id)
        
        # ✅ ENHANCED: Track active call
        user_session_manager.add_active_call(caller_id, call_id)
        
        # ✅ ENHANCED: Prepare response
        call_response = {
            "call_id": call_id,
            "chat_id": chat_id,
            "caller_id": caller_id,
            "receiver_id": receiver_id,
            "call_type": call_type,
            "status": "ringing",
            "started_at": call_doc["started_at"].isoformat()
        }
        
        # ✅ ENHANCED: Notify receiver
        safe_emit("call:incoming", call_response, room=f"user:{receiver_id}")
        
        call_audit_logger.log("CALL_STARTED", caller_id, call_id, details={
            "receiver": receiver_id,
            "type": call_type
        })
        
        logger.info(f"[CALL START] {caller_id} calling {receiver_id} (call: {call_id})")
    
    except Exception as e:
        logger.error(f"[CALL START] Error: {e}")
        logger.error(traceback.format_exc())
        emit("error", {"message": "Failed to start call"})
        call_audit_logger.log("CALL_STARTED", user_info.get("user_id"), 
                             status="failed", error_msg=str(e))


@socketio.on("call:accept")
@socket_authenticated
@validate_call_data(["call_id"])
def on_call_accept(user_info, data):
    """✅ ENHANCED: Accept incoming call"""
    try:
        db = get_db()
        receiver_id = user_info.get("user_id")
        call_id = data.get("call_id")
        
        # ✅ ENHANCED: Verify call exists and receiver is correct
        call = db.calls.find_one({
            "_id": ObjectId(call_id),
            "receiver_id": receiver_id,
            "status": "ringing"
        })
        
        if not call:
            emit("error", {"message": "Call not found or already handled"})
            return
        
        # ✅ ENHANCED: Check call timeout
        if (now_utc() - call["started_at"]).total_seconds() > CALL_TIMEOUT:
            db.calls.update_one(
                {"_id": ObjectId(call_id)},
                {"$set": {"status": "missed"}}
            )
            emit("error", {"message": "Call expired"})
            return
        
        # ✅ ENHANCED: Update call status
        db.calls.update_one(
            {"_id": ObjectId(call_id)},
            {
                "$set": {
                    "status": "accepted",
                    "answered_at": now_utc()
                }
            }
        )
        
        # ✅ ENHANCED: Track active call
        user_session_manager.add_active_call(receiver_id, call_id)
        
        # ✅ ENHANCED: Notify caller
        caller_id = call["caller_id"]
        safe_emit("call:accepted", {
            "call_id": call_id,
            "receiver_id": receiver_id,
            "answered_at": now_utc().isoformat()
        }, room=f"user:{caller_id}")
        
        call_audit_logger.log("CALL_ACCEPTED", receiver_id, call_id)
        logger.info(f"[CALL ACCEPT] Call {call_id} accepted by {receiver_id}")
    
    except Exception as e:
        logger.error(f"[CALL ACCEPT] Error: {e}")
        emit("error", {"message": "Failed to accept call"})
        call_audit_logger.log("CALL_ACCEPTED", user_info.get("user_id"), 
                             data.get("call_id"), status="failed", error_msg=str(e))


@socketio.on("call:reject")
@socket_authenticated
@validate_call_data(["call_id"])
def on_call_reject(user_info, data):
    """✅ ENHANCED: Reject incoming call"""
    try:
        db = get_db()
        receiver_id = user_info.get("user_id")
        call_id = data.get("call_id")
        
        # ✅ ENHANCED: Update call status
        result = db.calls.update_one(
            {
                "_id": ObjectId(call_id),
                "receiver_id": receiver_id,
                "status": "ringing"
            },
            {"$set": {"status": "rejected"}}
        )
        
        if result.matched_count == 0:
            emit("error", {"message": "Call not found"})
            return
        
        # ✅ ENHANCED: Notify caller
        call = db.calls.find_one({"_id": ObjectId(call_id)})
        if call:
            caller_id = call["caller_id"]
            safe_emit("call:rejected", {
                "call_id": call_id,
                "rejected_by": receiver_id
            }, room=f"user:{caller_id}")
        
        call_audit_logger.log("CALL_REJECTED", receiver_id, call_id)
        logger.info(f"[CALL REJECT] Call {call_id} rejected by {receiver_id}")
    
    except Exception as e:
        logger.error(f"[CALL REJECT] Error: {e}")
        emit("error", {"message": "Failed to reject call"})


@socketio.on("call:end")
@socket_authenticated
@validate_call_data(["call_id"])
def on_call_end(user_info, data):
    """✅ ENHANCED: End active call"""
    try:
        ended_by = user_info.get("user_id")
        call_id = data.get("call_id")
        
        _handle_call_end(ended_by, call_id, "normal")
    
    except Exception as e:
        logger.error(f"[CALL END] Error: {e}")
        emit("error", {"message": "Failed to end call"})


def _handle_call_end(user_id: str, call_id: str, reason: str = "normal"):
    """✅ ENHANCED: Internal call end handler"""
    try:
        db = get_db()
        
        # ✅ ENHANCED: Get call details
        call = db.calls.find_one({"_id": ObjectId(call_id)})
        
        if not call:
            return
        
        # ✅ ENHANCED: Calculate duration
        start_time = call.get("answered_at") or call.get("started_at")
        duration = int((now_utc() - start_time).total_seconds()) if start_time else 0
        
        # ✅ ENHANCED: Validate duration
        if duration > MAX_CALL_DURATION:
            logger.warning(f"[CALL END] Call duration exceeds max: {duration}s")
            duration = MAX_CALL_DURATION
        
        # ✅ ENHANCED: Determine final status
        final_status = call["status"]
        
        if call["status"] == "ringing" and (now_utc() - call["started_at"]).total_seconds() > MISSED_CALL_THRESHOLD:
            final_status = "missed"
        elif call["status"] == "accepted":
            final_status = "completed"
        
        # ✅ ENHANCED: Update call
        db.calls.update_one(
            {"_id": ObjectId(call_id)},
            {
                "$set": {
                    "status": final_status,
                    "ended_at": now_utc(),
                    "duration_seconds": duration,
                    "end_reason": reason
                }
            }
        )
        
        # ✅ ENHANCED: Untrack from session
        user_session_manager.remove_active_call(user_id, call_id)
        
        # ✅ ENHANCED: Notify participants
        caller_id = call["caller_id"]
        receiver_id = call["receiver_id"]
        
        end_data = {
            "call_id": call_id,
            "status": final_status,
            "duration": duration,
            "ended_by": user_id,
            "ended_at": now_utc().isoformat()
        }
        
        safe_emit("call:ended", end_data, room=f"user:{caller_id}")
        safe_emit("call:ended", end_data, room=f"user:{receiver_id}")
        
        call_audit_logger.log("CALL_ENDED", user_id, call_id, details={
            "status": final_status,
            "duration": duration,
            "reason": reason
        })
        
        logger.info(f"[CALL END] Call {call_id} ended ({final_status}, {duration}s)")
    
    except Exception as e:
        logger.error(f"[CALL END HANDLER] Error: {e}")
        logger.error(traceback.format_exc())


# ============================================================
#                   ERROR HANDLING
# ============================================================

@socketio.on_error_default
def default_error_handler(e):
    """✅ ENHANCED: Global error handler"""
    logger.error(f"[SOCKET ERROR] {e}")
    logger.error(traceback.format_exc())
    emit("error", {"message": "An error occurred", "error": str(e)})


# ============================================================
#                   INITIALIZATION (FIXED)
# ============================================================

def register_call_events(socketio_instance=None):
    """
    Register call events with Socket.IO.
    All @socketio.on handlers in this module are already active when imported.
    This function only exists so app_factory.py can import it safely.
    """
    logger.info("[CALL EVENTS] Registered successfully")

    if socketio_instance:
        logger.debug("[CALL EVENTS] Socket.IO instance passed during registration")


__all__ = ["register_call_events", "user_session_manager", "call_audit_logger"]
