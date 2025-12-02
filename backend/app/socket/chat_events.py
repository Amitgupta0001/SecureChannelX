"""
Socket handlers for real-time chat events:
 - Joining/leaving chat rooms
 - Realtime message sending
 - Message broadcasting
 - Presence notifications
 - Typing indicators
 - Message reactions
 - Read receipts
"""

import logging
import traceback
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from functools import wraps

from flask import request
from flask_socketio import join_room, leave_room, emit, rooms
from bson import ObjectId
from flask_jwt_extended import decode_token

from app import socketio
from app.database import get_db
from app.utils.helpers import now_utc
from app.security.hardening import audit_logger

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ============================================================
#                   CONSTANTS
# ============================================================

MESSAGE_MAX_LENGTH = 65536  # 64KB max message
MAX_MESSAGES_PER_MINUTE = 30
MAX_TYPING_DURATION = 5  # seconds
ROOM_PREFIX_CHAT = "chat:"
ROOM_PREFIX_GROUP = "group:"


# ============================================================
#                   SESSION MANAGEMENT
# ============================================================

class ChatSessionManager:
    """✅ ENHANCED: Track connected users and their state"""
    
    def __init__(self):
        self.sessions = {}  # sid -> session_info
        self.user_sids = {}  # user_id -> [sids]
    
    def create_session(self, sid: str, user_id: str, username: str) -> None:
        """✅ ENHANCED: Create user session"""
        self.sessions[sid] = {
            "user_id": user_id,
            "username": username,
            "connected_at": now_utc(),
            "typing_in": None,
            "active_rooms": set()
        }
        
        if user_id not in self.user_sids:
            self.user_sids[user_id] = []
        
        if sid not in self.user_sids[user_id]:
            self.user_sids[user_id].append(sid)
        
        logger.debug(f"[SESSION] Created for {username} (SID: {sid})")
    
    def destroy_session(self, sid: str) -> Optional[str]:
        """✅ ENHANCED: Destroy session and return user_id"""
        if sid not in self.sessions:
            return None
        
        session = self.sessions.pop(sid)
        user_id = session.get("user_id")
        
        if user_id in self.user_sids:
            self.user_sids[user_id] = [s for s in self.user_sids[user_id] if s != sid]
            if not self.user_sids[user_id]:
                del self.user_sids[user_id]
        
        logger.debug(f"[SESSION] Destroyed for {user_id} (SID: {sid})")
        return user_id
    
    def get_session(self, sid: str) -> Optional[Dict]:
        """✅ ENHANCED: Get session info"""
        return self.sessions.get(sid)
    
    def get_user_sids(self, user_id: str) -> list:
        """✅ ENHANCED: Get all SIDs for user (multi-device)"""
        return self.user_sids.get(user_id, [])
    
    def is_user_online(self, user_id: str) -> bool:
        """✅ ENHANCED: Check if user has any active connection"""
        return user_id in self.user_sids and len(self.user_sids[user_id]) > 0
    
    def add_room(self, sid: str, room: str) -> None:
        """✅ ENHANCED: Track room join"""
        if sid in self.sessions:
            self.sessions[sid]["active_rooms"].add(room)
    
    def remove_room(self, sid: str, room: str) -> None:
        """✅ ENHANCED: Track room leave"""
        if sid in self.sessions:
            self.sessions[sid]["active_rooms"].discard(room)
    
    def set_typing(self, sid: str, room: str) -> None:
        """✅ ENHANCED: Mark user as typing"""
        if sid in self.sessions:
            self.sessions[sid]["typing_in"] = room


chat_session_manager = ChatSessionManager()


# ============================================================
#                   RATE LIMITING
# ============================================================

class ChatRateLimiter:
    """✅ ENHANCED: Rate limiting for chat operations"""
    
    def __init__(self):
        self.message_counts = {}  # user_id -> [(timestamp, op), ...]
    
    def check_limit(self, user_id: str, operation: str, limit: int) -> tuple:
        """✅ ENHANCED: Check if operation is within rate limit"""
        import time
        
        now = time.time()
        
        if user_id not in self.message_counts:
            self.message_counts[user_id] = []
        
        # Clean old entries (older than 1 minute)
        cutoff = now - 60
        self.message_counts[user_id] = [
            (ts, op) for ts, op in self.message_counts[user_id] if ts > cutoff
        ]
        
        # Count operations
        count = sum(1 for _, op in self.message_counts[user_id] if op == operation)
        
        if count >= limit:
            return False, f"Rate limit exceeded for {operation} ({limit}/min)"
        
        self.message_counts[user_id].append((now, operation))
        return True, ""


chat_rate_limiter = ChatRateLimiter()


# ============================================================
#                   AUDIT LOGGING
# ============================================================

class ChatAuditLogger:
    """✅ ENHANCED: Comprehensive chat audit logging"""
    
    COLLECTION = "chat_audit_logs"
    
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()
        try:
            self.db[self.COLLECTION].create_index([("timestamp", -1)])
            self.db[self.COLLECTION].create_index([("event", 1)])
            self.db[self.COLLECTION].create_index([("user_id", 1)])
            self.db[self.COLLECTION].create_index([("chat_id", 1)])
        except Exception as e:
            logger.warning(f"[CHAT AUDIT] Index creation failed: {e}")
    
    def log(self, event: str, user_id: str, chat_id: str = None, 
            status: str = "success", details: Dict = None, error_msg: str = ""):
        """✅ ENHANCED: Log chat event"""
        try:
            doc = {
                "event": event,
                "user_id": user_id,
                "chat_id": chat_id,
                "status": status,
                "details": details or {},
                "error": error_msg,
                "ip_address": request.remote_addr if request else None,
                "sid": request.sid if request else None,
                "timestamp": now_utc()
            }
            self.db[self.COLLECTION].insert_one(doc)
        except Exception as e:
            logger.error(f"[CHAT AUDIT] Failed to log: {e}")


chat_audit_logger = ChatAuditLogger()


# ============================================================
#                   DECORATORS
# ============================================================

def socket_authenticated(f):
    """✅ ENHANCED: Require authenticated socket connection"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        sid = request.sid
        session = chat_session_manager.get_session(sid)
        
        if not session:
            logger.warning(f"[AUTH] Unauthenticated socket event from SID {sid}")
            emit("error", {"message": "Unauthorized", "code": "AUTH_REQUIRED"})
            return
        
        return f(session, *args, **kwargs)
    
    return wrapper


def validate_chat_data(required_fields: list):
    """✅ ENHANCED: Validate required fields"""
    def decorator(f):
        @wraps(f)
        def wrapper(session, data, *args, **kwargs):
            if not isinstance(data, dict):
                emit("error", {"message": "Invalid data format", "code": "INVALID_DATA"})
                return
            
            missing = [field for field in required_fields if field not in data]
            if missing:
                emit("error", {
                    "message": f"Missing fields: {', '.join(missing)}",
                    "code": "MISSING_FIELDS"
                })
                return
            
            return f(session, data, *args, **kwargs)
        
        return wrapper
    
    return decorator


# ============================================================
#                   CONNECTION LIFECYCLE
# ============================================================

@socketio.on("connect")
def on_connect(auth=None):
    """
    ✅ FIXED: Handle client connection with proper token authentication
    """
    try:
        sid = request.sid
        print(f"[SOCKET] 🔌 Client connecting: sid={sid}")
        
        # ✅ FIX: Get token from multiple sources
        token = None
        
        # Try auth object first (Socket.IO v4+)
        if auth and isinstance(auth, dict):
            token = auth.get('token')
            if token:
                print(f"[SOCKET] Token from auth dict: {token[:20]}...")
        
        # Try query parameters first (recommended)
        if hasattr(request, 'args'):
            token = request.args.get('token')
            print(f"[SOCKET] Token from query: {token[:20] if token else 'None'}...")
        
        # Try auth object (Flask-SocketIO 5.x)
        if not token:
            auth = request.environ.get('HTTP_SEC_WEBSOCKET_PROTOCOL', '')
            if auth:
                token = auth
                print(f"[SOCKET] Token from auth: {token[:20]}...")
        
        # Try Authorization header (fallback)
        if not token:
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
                print(f"[SOCKET] Token from header: {token[:20]}...")
        
        if not token:
            print("[SOCKET] ❌ No authentication token provided")
            emit("error", {
                "message": "Authentication required",
                "error_code": "AUTH_REQUIRED"
            })
            return False
        
        # Verify JWT token
        try:
            # decode_token is already imported at module level
            decoded = decode_token(token)
            user_id = decoded.get("sub")
            
            if not user_id:
                print("[SOCKET] ❌ Invalid token: no user_id")
                emit("error", {
                    "message": "Invalid authentication token",
                    "error_code": "INVALID_TOKEN"
                })
                return False
            
            # Fetch user details for session
            db = get_db()
            user = db.users.find_one({"_id": ObjectId(user_id)})
            
            if not user:
                print(f"[SOCKET] ❌ User not found: {user_id}")
                emit("error", {
                    "message": "User not found",
                    "error_code": "USER_NOT_FOUND"
                })
                return False
                
            username = user.get("username", "Unknown")
            
            # Store user session using the manager
            chat_session_manager.create_session(sid, user_id, username)
            
            print(f"[SOCKET] ✅ User authenticated: user_id={user_id}, sid={sid}")
            
            # Notify user of successful connection
            emit("connected", {
                "message": "Connected to SecureChannelX",
                "user_id": user_id,
                "sid": sid
            })
            
            # Broadcast online status
            emit("user:online", {
                "user_id": user_id,
                "username": username,
                "timestamp": now_utc().isoformat()
            }, broadcast=True)
            
            return True
        
        except Exception as e:
            print(f"[SOCKET] ❌ Token verification failed: {e}")
            emit("error", {
                "message": "Authentication failed",
                "error_code": "AUTH_FAILED"
            })
            return False
    
    except Exception as e:
        print(f"[SOCKET] ❌ Connection error: {e}")
        emit("error", {
            "message": "Connection failed",
            "error_code": "CONNECTION_ERROR"
        })
        return False


@socketio.on("disconnect")
def on_disconnect():
    """✅ ENHANCED: Handle client disconnection"""
    sid = request.sid
    
    try:
        user_id = chat_session_manager.destroy_session(sid)
        
        if user_id:
            # ✅ ENHANCED: Check if user still has other connections
            if not chat_session_manager.is_user_online(user_id):
                # Only broadcast offline if no other devices connected
                db = get_db()
                user = db.users.find_one({"_id": ObjectId(user_id)})
                username = user.get("username", "Unknown") if user else "Unknown"
                
                emit("user:offline", {
                    "user_id": user_id,
                    "username": username,
                    "timestamp": now_utc().isoformat()
                }, broadcast=True)
                
                chat_audit_logger.log("DISCONNECT_OFFLINE", user_id)
                logger.info(f"[DISCONNECT] User {username} ({user_id}) offline")
            else:
                chat_audit_logger.log("DISCONNECT_MULTIDEVICE", user_id, 
                                     details={"remaining_connections": len(chat_session_manager.get_user_sids(user_id))})
        
        logger.debug(f"[DISCONNECT] SID {sid} disconnected")
    
    except Exception as e:
        logger.error(f"[DISCONNECT] Error: {e}")
        logger.error(traceback.format_exc())


# ============================================================
#                   ROOM MANAGEMENT
# ============================================================

@socketio.on("chat:join")
@socket_authenticated
@validate_chat_data(["chat_id"])
def on_chat_join(session, data):
    """✅ ENHANCED: Join chat room with access control"""
    try:
        user_id = session.get("user_id")
        username = session.get("username")
        chat_id = str(data.get("chat_id"))
        
        db = get_db()
        
        # ✅ ENHANCED: Verify user is participant
        chat = db.chats.find_one({
            "_id": ObjectId(chat_id),
            "participants": user_id
        })
        
        if not chat:
            logger.warning(f"[CHAT JOIN] User {user_id} not in chat {chat_id}")
            emit("error", {
                "message": "Access denied to chat",
                "code": "ACCESS_DENIED"
            })
            return
        
        room = f"chat:{chat_id}"
        join_room(room)
        chat_session_manager.add_room(request.sid, room)
        
        # ✅ ENHANCED: Notify room members
        emit("chat:member:joined", {
            "chat_id": chat_id,
            "user_id": user_id,
            "username": username,
            "timestamp": now_utc().isoformat()
        }, room=room, skip_sid=request.sid)
        
        chat_audit_logger.log("CHAT_JOIN", user_id, chat_id)
        logger.debug(f"[CHAT JOIN] User {username} ({user_id}) joined chat {chat_id}")
    
    except Exception as e:
        logger.error(f"[CHAT JOIN] Error: {e}")
        emit("error", {
            "message": "Failed to join chat",
            "code": "JOIN_FAILED"
        })
        chat_audit_logger.log("CHAT_JOIN", session.get("user_id"), 
                             data.get("chat_id"), status="failed", error_msg=str(e))


@socketio.on("chat:leave")
@socket_authenticated
@validate_chat_data(["chat_id"])
def on_chat_leave(session, data):
    """✅ ENHANCED: Leave chat room"""
    try:
        user_id = session.get("user_id")
        username = session.get("username")
        chat_id = str(data.get("chat_id"))
        
        room = f"chat:{chat_id}"
        leave_room(room)
        chat_session_manager.remove_room(request.sid, room)
        
        # ✅ ENHANCED: Notify room members
        emit("chat:member:left", {
            "chat_id": chat_id,
            "user_id": user_id,
            "username": username,
            "timestamp": now_utc().isoformat()
        }, room=room)
        
        chat_audit_logger.log("CHAT_LEAVE", user_id, chat_id)
        logger.debug(f"[CHAT LEAVE] User {username} ({user_id}) left chat {chat_id}")
    
    except Exception as e:
        logger.error(f"[CHAT LEAVE] Error: {e}")


# ============================================================
#                   MESSAGE HANDLING
# ============================================================

@socketio.on("message:send")
@socket_authenticated
@validate_chat_data(["chat_id", "encrypted_content"])
def on_message_send(session, data):
    """✅ ENHANCED: Send encrypted message"""
    try:
        user_id = session.get("user_id")
        username = session.get("username")
        chat_id = str(data.get("chat_id"))
        encrypted_content = data.get("encrypted_content")
        message_type = data.get("message_type", "text")
        x3dh_header = data.get("x3dh_header")
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = chat_rate_limiter.check_limit(user_id, "send_message", MAX_MESSAGES_PER_MINUTE)
        if not allowed:
            logger.warning(f"[MESSAGE] Rate limit exceeded for user {user_id}")
            emit("error", {"message": msg, "code": "RATE_LIMITED"})
            return
        
        # ✅ ENHANCED: Validate message size
        if isinstance(encrypted_content, str):
            content_size = len(encrypted_content)
        else:
            content_size = len(str(encrypted_content))
        
        if content_size > MESSAGE_MAX_LENGTH:
            emit("error", {
                "message": f"Message too large (max {MESSAGE_MAX_LENGTH} bytes)",
                "code": "MESSAGE_TOO_LARGE"
            })
            return
        
        db = get_db()
        
        # ✅ ENHANCED: Verify user is participant
        chat = db.chats.find_one({
            "_id": ObjectId(chat_id),
            "participants": user_id
        })
        
        if not chat:
            logger.warning(f"[MESSAGE] User {user_id} not in chat {chat_id}")
            emit("error", {"message": "Access denied", "code": "ACCESS_DENIED"})
            return
        
        # ✅ ENHANCED: Create message document
        msg_doc = {
            "chat_id": ObjectId(chat_id),
            "sender_id": user_id,
            "message_type": message_type,
            "encrypted_content": encrypted_content,
            "x3dh_header": x3dh_header,
            "reactions": [],
            "seen_by": [user_id],
            "created_at": now_utc(),
            "e2e_encrypted": True,
            "is_deleted": False
        }
        
        res = db.messages.insert_one(msg_doc)
        message_id = str(res.inserted_id)
        
        # ✅ ENHANCED: Prepare response
        response = {
            "message_id": message_id,
            "chat_id": chat_id,
            "sender_id": user_id,
            "username": username,
            "message_type": message_type,
            "encrypted_content": encrypted_content,
            "x3dh_header": x3dh_header,
            "created_at": msg_doc["created_at"].isoformat()
        }
        
        # ✅ ENHANCED: Update chat last message
        db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$set": {
                    "last_message_preview": f"[{message_type}]" if message_type != "text" else "Encrypted Message",
                    "last_message_at": now_utc(),
                    "last_message_sender": user_id
                }
            }
        )
        
        # ✅ ENHANCED: Broadcast to room
        room = f"chat:{chat_id}"
        emit("message:new", response, room=room)
        
        chat_audit_logger.log("MESSAGE_SENT", user_id, chat_id, details={
            "message_id": message_id,
            "type": message_type
        })
        
        logger.debug(f"[MESSAGE] {user_id} sent message {message_id} to chat {chat_id}")
    
    except Exception as e:
        logger.error(f"[MESSAGE SEND] Error: {e}")
        logger.error(traceback.format_exc())
        emit("error", {
            "message": "Failed to send message",
            "code": "SEND_FAILED"
        })
        chat_audit_logger.log("MESSAGE_SENT", session.get("user_id"), 
                             data.get("chat_id"), status="failed", error_msg=str(e))


@socketio.on("message:read")
@socket_authenticated
@validate_chat_data(["chat_id", "message_ids"])
def on_message_read(session, data):
    """✅ ENHANCED: Mark messages as read"""
    try:
        user_id = session.get("user_id")
        chat_id = str(data.get("chat_id"))
        message_ids = data.get("message_ids", [])
        
        if not message_ids:
            return
        
        db = get_db()
        
        # ✅ ENHANCED: Update messages
        object_ids = [ObjectId(msg_id) for msg_id in message_ids]
        result = db.messages.update_many(
            {"_id": {"$in": object_ids}},
            {"$addToSet": {"seen_by": user_id}}
        )
        
        # ✅ ENHANCED: Notify room
        room = f"chat:{chat_id}"
        emit("message:read:receipt", {
            "chat_id": chat_id,
            "user_id": user_id,
            "message_ids": message_ids,
            "read_at": now_utc().isoformat()
        }, room=room)
        
        chat_audit_logger.log("MESSAGES_READ", user_id, chat_id, details={
            "count": result.modified_count
        })
        
        logger.debug(f"[MESSAGE READ] User {user_id} marked {result.modified_count} messages as read")
    
    except Exception as e:
        logger.error(f"[MESSAGE READ] Error: {e}")


# ============================================================
#                   TYPING INDICATORS
# ============================================================

@socketio.on("typing:start")
@socket_authenticated
@validate_chat_data(["chat_id"])
def on_typing_start(session, data):
    """✅ ENHANCED: Broadcast typing indicator"""
    try:
        user_id = session.get("user_id")
        username = session.get("username")
        chat_id = str(data.get("chat_id"))
        
        chat_session_manager.set_typing(request.sid, chat_id)
        
        room = f"chat:{chat_id}"
        emit("typing:indicator", {
            "chat_id": chat_id,
            "user_id": user_id,
            "username": username,
            "typing": True
        }, room=room, skip_sid=request.sid)
        
        logger.debug(f"[TYPING] User {username} typing in chat {chat_id}")
    
    except Exception as e:
        logger.error(f"[TYPING START] Error: {e}")


@socketio.on("typing:stop")
@socket_authenticated
@validate_chat_data(["chat_id"])
def on_typing_stop(session, data):
    """✅ ENHANCED: Stop typing indicator"""
    try:
        user_id = session.get("user_id")
        username = session.get("username")
        chat_id = str(data.get("chat_id"))
        
        room = f"chat:{chat_id}"
        emit("typing:indicator", {
            "chat_id": chat_id,
            "user_id": user_id,
            "username": username,
            "typing": False
        }, room=room, skip_sid=request.sid)
        
        logger.debug(f"[TYPING STOP] User {username} stopped typing in chat {chat_id}")
    
    except Exception as e:
        logger.error(f"[TYPING STOP] Error: {e}")


# ============================================================
#                   MESSAGE REACTIONS
# ============================================================

@socketio.on("message:react")
@socket_authenticated
@validate_chat_data(["chat_id", "message_id", "emoji"])
def on_message_react(session, data):
    """✅ ENHANCED: Add reaction to message"""
    try:
        user_id = session.get("user_id")
        chat_id = str(data.get("chat_id"))
        message_id = str(data.get("message_id"))
        emoji = str(data.get("emoji"))[:10]  # Limit emoji length
        
        db = get_db()
        
        # ✅ ENHANCED: Validate emoji
        if not emoji or len(emoji) == 0:
            emit("error", {"message": "Invalid emoji", "code": "INVALID_EMOJI"})
            return
        
        # ✅ ENHANCED: Add reaction
        db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$push": {
                    "reactions": {
                        "emoji": emoji,
                        "user_id": user_id,
                        "added_at": now_utc()
                    }
                }
            }
        )
        
        # ✅ ENHANCED: Broadcast reaction
        room = f"chat:{chat_id}"
        emit("message:reaction:added", {
            "message_id": message_id,
            "emoji": emoji,
            "user_id": user_id,
            "chat_id": chat_id
        }, room=room)
        
        logger.debug(f"[REACTION] User {user_id} reacted with {emoji} to message {message_id}")
    
    except Exception as e:
        logger.error(f"[MESSAGE REACT] Error: {e}")


# ============================================================
#                   GROUP MANAGEMENT
# ============================================================

@socketio.on("group:create")
@socket_authenticated
@validate_chat_data(["group_name"])
def on_group_create(session, data):
    """✅ ENHANCED: Create new group"""
    try:
        user_id = session.get("user_id")
        username = session.get("username")
        group_name = str(data.get("group_name", "")).strip()[:100]
        
        if not group_name:
            emit("error", {"message": "Invalid group name", "code": "INVALID_NAME"})
            return
        
        db = get_db()
        
        # ✅ ENHANCED: Check if group exists
        if db.groups.find_one({"name": group_name}):
            emit("error", {"message": "Group already exists", "code": "GROUP_EXISTS"})
            return
        
        # ✅ ENHANCED: Create group document
        group_doc = {
            "name": group_name,
            "creator_id": user_id,
            "members": [user_id],
            "created_at": now_utc(),
            "updated_at": now_utc()
        }
        
        res = db.groups.insert_one(group_doc)
        group_id = str(res.inserted_id)
        
        # ✅ ENHANCED: Create associated chat
        chat_doc = {
            "chat_type": "group",
            "group_id": ObjectId(group_id),
            "title": group_name,
            "participants": [user_id],
            "created_by": user_id,
            "created_at": now_utc(),
            "updated_at": now_utc()
        }
        
        res = db.chats.insert_one(chat_doc)
        chat_id = str(res.inserted_id)
        
        # ✅ ENHANCED: Update group with chat_id
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"chat_id": chat_id}}
        )
        
        emit("group:created", {
            "group_id": group_id,
            "chat_id": chat_id,
            "group_name": group_name,
            "creator": username
        })
        
        chat_audit_logger.log("GROUP_CREATED", user_id, details={
            "group_id": group_id,
            "group_name": group_name
        })
        
        logger.info(f"[GROUP] Created by {username}: {group_name} ({group_id})")
    
    except Exception as e:
        logger.error(f"[GROUP CREATE] Error: {e}")
        emit("error", {
            "message": "Failed to create group",
            "code": "CREATE_FAILED"
        })


@socketio.on("group:join")
@socket_authenticated
@validate_chat_data(["group_id"])
def on_group_join(session, data):
    """✅ ENHANCED: Join existing group"""
    try:
        user_id = session.get("user_id")
        username = session.get("username")
        group_id = str(data.get("group_id"))
        
        db = get_db()
        
        # ✅ ENHANCED: Find group
        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            emit("error", {"message": "Group not found", "code": "GROUP_NOT_FOUND"})
            return
        
        # ✅ ENHANCED: Add to group and chat
        chat_id = group.get("chat_id")
        
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$addToSet": {"members": user_id}}
        )
        
        if chat_id:
            db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {"$addToSet": {"participants": user_id}}
            )
            
            # ✅ ENHANCED: Join room
            room = f"chat:{chat_id}"
            join_room(room)
            chat_session_manager.add_room(request.sid, room)
            
            # ✅ ENHANCED: Broadcast join
            emit("chat:member:joined", {
                "chat_id": chat_id,
                "user_id": user_id,
                "username": username,
                "timestamp": now_utc().isoformat()
            }, room=room, skip_sid=request.sid)
        
        emit("group:joined", {
            "group_id": group_id,
            "group_name": group.get("name"),
            "chat_id": chat_id
        })
        
        chat_audit_logger.log("GROUP_JOINED", user_id, details={"group_id": group_id})
        logger.info(f"[GROUP] User {username} joined group {group.get('name')} ({group_id})")
    
    except Exception as e:
        logger.error(f"[GROUP JOIN] Error: {e}")
        emit("error", {
            "message": "Failed to join group",
            "code": "JOIN_FAILED"
        })


# ============================================================
#                   ERROR HANDLING
# ============================================================

@socketio.on_error_default
def default_error_handler(e):
    """✅ ENHANCED: Global error handler"""
    logger.error(f"[SOCKET ERROR] {e}")
    logger.error(traceback.format_exc())
    emit("error", {
        "message": "An error occurred",
        "code": "INTERNAL_ERROR"
    })


# ============================================================
#                   INITIALIZATION
# ============================================================

# ============================================================
#                   INITIALIZATION (FIXED)
# ============================================================

def register_chat_events(socketio_instance=None):
    """
    Register chat events with Socket.IO.
    Note: All event handlers are already bound using @socketio.on,
    so this function only serves as an import hook for the app factory.
    """
    logger.info("[CHAT EVENTS] Registered successfully")

    if socketio_instance:
        logger.debug("[CHAT EVENTS] Socket.IO instance passed during registration")


__all__ = ["register_chat_events", "chat_session_manager", "chat_audit_logger"]
