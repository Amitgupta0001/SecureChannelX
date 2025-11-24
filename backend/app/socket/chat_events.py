"""
Socket handlers for real-time chat events:
 - Joining/leaving chat rooms
 - Realtime message sending
 - Message broadcasting
 - Presence notifications
"""

from app import socketio
from flask_socketio import join_room, leave_room, emit
from flask import request
from app.database import get_db
from bson import ObjectId
from datetime import datetime
import traceback
from flask_jwt_extended import decode_token
from app.models.models import User, Message
from app.models.chat_model import chat_document
from app.models.group_model import group_document


# =====================================================
#  SOCKET CONNECT
# =====================================================

@socketio.on("connect")
def on_connect():
    """
    Fired when a client opens a WebSocket connection.
    Here you should validate the JWT token if provided.
    """
    try:
        sid = request.sid
        print(f"[socket] Connected: sid={sid}")

        token = request.args.get("token")
        if token:
            try:
                decoded = decode_token(token)
                user_id = decoded["sub"]
                user = User.find_by_id(user_id)
                
                if user:
                    username = user["username"]
                    # Store user info in socket session
                    socketio.server.environ[sid] = socketio.server.environ.get(sid, {})
                    socketio.server.environ[sid]['user'] = user
                    
                    print(f"[socket] User {username} authenticated")
                    
                    # Mark online
                    User.update_user(user_id, {"online": True})
                    
                    # Broadcast online status
                    emit("user_online", username, broadcast=True, include_self=False)
                    
                    # Join personal rooms (by username and ID)
                    join_room(username)
                    join_room(user_id)
                    
                    # Load chat history (optional, based on snippet)
                    # For now, we won't dump all history to avoid overload, 
                    # but we can emit a ready event.
                    emit("ready", {"username": username, "user_id": user_id})
                    
            except Exception as e:
                print(f"[socket] Auth failed: {e}")
                # return False  # Uncomment to reject invalid tokens
        
    except Exception:
        print("[connect] error:", traceback.format_exc())


# =====================================================
#  JOIN CHAT ROOM
# =====================================================

@socketio.on("join_chat")
def on_join_chat(data):
    """
    data = { chat_id: str, user_id: str }
    """
    try:
        chat_id = str(data.get("chat_id"))
        user_id = str(data.get("user_id"))

        if not chat_id or not user_id:
            return

        room = f"chat:{chat_id}"

        join_room(room)
        print(f"[socket] {user_id} joined {room}")

        # Notify room members
        socketio.emit(
            "member:joined",
            {"chat_id": chat_id, "user_id": user_id},
            room=room
        )

    except Exception:
        print("[join_chat] error:", traceback.format_exc())


# =====================================================
#  LEAVE CHAT ROOM
# =====================================================

@socketio.on("leave_chat")
def on_leave_chat(data):
    """
    data = { chat_id: str, user_id: str }
    """
    try:
        chat_id = str(data.get("chat_id"))
        user_id = str(data.get("user_id"))

        if not chat_id or not user_id:
            return

        room = f"chat:{chat_id}"
        leave_room(room)

        print(f"[socket] {user_id} left {room}")

        socketio.emit(
            "member:left",
            {"chat_id": chat_id, "user_id": user_id},
            room=room
        )

    except Exception:
        print("[leave_chat] error:", traceback.format_exc())


# =====================================================
#  SEND REAL-TIME MESSAGE
# =====================================================

@socketio.on("message:send")
def on_message_send(payload):
    """
    payload:
      {
        chat_id: str,
        message: {
            sender_id: str,
            content: str,
            message_type: "text" | "file" | ...,
            extra: dict?
        }
      }
    """
    try:
        db = get_db()

        chat_id = payload.get("chat_id")
        message = payload.get("message")

        if not chat_id or not message:
            return

        sender_id = message.get("sender_id")
        content = message.get("content", "")

        # Build DB document
        doc = {
            "chat_id": ObjectId(chat_id),
            "sender_id": sender_id,
            "message_type": message.get("message_type", "text"),
            "content": content,
            "extra": message.get("extra", {}),
            "reactions": [],
            "seen_by": [sender_id],
            "created_at": datetime.utcnow()
        }

        res = db.messages.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        doc["chat_id"] = str(chat_id)

        # Update chat preview
        preview = content if doc["message_type"] == "text" else f"[{doc['message_type']}]"

        db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$set": {
                    "last_message_preview": preview,
                    "last_message_at": datetime.utcnow()
                }
            }
        )

        # Emit message to chat room
        room = f"chat:{chat_id}"
        socketio.emit("message:new", {"message": doc}, room=room)

    except Exception:
        print("[message:send] error:", traceback.format_exc())


# =====================================================
#  USER SNIPPET IMPLEMENTATION (ADAPTED)
# =====================================================

@socketio.on("disconnect")
def on_disconnect():
    try:
        sid = request.sid
        user = socketio.server.environ.get(sid, {}).get('user')
        if user:
            username = user['username']
            user_id = str(user['_id'])
            
            # Mark offline
            User.update_user(user_id, {"online": False})
            
            # Broadcast offline
            emit("user_offline", username, broadcast=True, include_self=False)
            print(f"[socket] {username} disconnected")
    except Exception:
        print("[disconnect] error:", traceback.format_exc())


@socketio.on("private_message")
def handle_private_message(data):
    """
    data = { "to": username, "message": text }
    """
    try:
        sid = request.sid
        user = socketio.server.environ.get(sid, {}).get('user')
        if not user:
            return
            
        sender_username = user['username']
        sender_id = str(user['_id'])
        
        recipient_username = data.get("to")
        recipient_id_target = data.get("to_user_id")
        encrypted_content = data.get("encrypted_content") # Expecting { header, ciphertext, nonce }
        
        if (not recipient_username and not recipient_id_target) or not encrypted_content:
            return

        if recipient_username:
            recipient = User.find_by_username(recipient_username)
        else:
            recipient = User.find_by_id(recipient_id_target)

        if not recipient:
            return
            
        recipient_id = str(recipient['_id'])
        
        # Find or create private chat
        db = get_db()
        chat = db.chats.find_one({
            "chat_type": "private",
            "participants": {"$all": [sender_id, recipient_id]}
        })
        
        if not chat:
            # Create new chat
            chat_doc = chat_document("private", [sender_id, recipient_id], sender_id)
            res = db.chats.insert_one(chat_doc)
            chat_id = str(res.inserted_id)
        else:
            chat_id = str(chat['_id'])
            
        # Create message
        msg_doc = {
            "chat_id": ObjectId(chat_id),
            "sender_id": sender_id,
            "message_type": "text",
            "encrypted_content": encrypted_content, # Store the blob
            "created_at": datetime.utcnow(),
            "is_deleted": False,
            "seen_by": [sender_id],
            "e2e_encrypted": True
        }
        db.messages.insert_one(msg_doc)
        
        # Update chat with last message info
        db.chats.update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$set": {
                    "last_message_encrypted": encrypted_content,
                    "last_message_preview": "Encrypted Message",
                    "last_message_at": datetime.utcnow()
                }
            }
        )
        
        # Emit to recipient
        emit("private_message", {
            "from": sender_username,
            "encrypted_content": encrypted_content,
            "chat_id": chat_id,
            "timestamp": msg_doc["created_at"].isoformat()
        }, room=recipient_username)
        
        # Also emit back to sender (optional, for UI update)
        emit("private_message_sent", {
            "to": recipient_username,
            "encrypted_content": encrypted_content,
            "chat_id": chat_id,
            "timestamp": msg_doc["created_at"].isoformat()
        })
        
    except Exception:
        print("[private_message] error:", traceback.format_exc())


@socketio.on("broadcast")
def handle_broadcast(message):
    try:
        sid = request.sid
        user = socketio.server.environ.get(sid, {}).get('user')
        if not user:
            return
            
        username = user['username']
        emit("broadcast", {"from": username, "message": message}, broadcast=True, include_self=False)
    except Exception:
        print("[broadcast] error:", traceback.format_exc())


@socketio.on("create_group")
def handle_create_group(group_name):
    try:
        sid = request.sid
        user = socketio.server.environ.get(sid, {}).get('user')
        if not user:
            return
            
        username = user['username']
        user_id = str(user['_id'])
        
        db = get_db()
        
        # Check if group exists (by name, as per snippet)
        exists = db.groups.find_one({"title": group_name})
        if exists:
            emit("error", "Group exists")
            return
            
        # Create group
        g_doc = group_document(group_name, user_id, members=[user_id])
        res = db.groups.insert_one(g_doc)
        group_id = str(res.inserted_id)
        
        # Create chat mirror
        c_doc = chat_document("group", [user_id], user_id, title=group_name)
        c_doc["group_id"] = group_id
        c_res = db.chats.insert_one(c_doc)
        chat_id = str(c_res.inserted_id)
        
        # Update group with chat_id
        db.groups.update_one({"_id": ObjectId(group_id)}, {"$set": {"chat_id": chat_id}})
        
        emit("group_created", group_name)
        
    except Exception:
        print("[create_group] error:", traceback.format_exc())


@socketio.on("join_group")
def handle_join_group(group_name):
    try:
        sid = request.sid
        user = socketio.server.environ.get(sid, {}).get('user')
        if not user:
            return
            
        username = user['username']
        user_id = str(user['_id'])
        
        db = get_db()
        group = db.groups.find_one({"title": group_name})
        if not group:
            emit("error", "Group not found")
            return
            
        group_id = str(group['_id'])
        chat_id = group.get('chat_id')
        
        if user_id not in group.get('members', []):
            # Add to group
            db.groups.update_one({"_id": ObjectId(group_id)}, {"$addToSet": {"members": user_id}})
            # Add to chat
            if chat_id:
                db.chats.update_one({"_id": ObjectId(chat_id)}, {"$addToSet": {"participants": user_id}})
                
        join_room(group_name)
        if chat_id:
            join_room(f"chat:{chat_id}")
            
        emit("group_joined", group_name)
        
    except Exception:
        print("[join_group] error:", traceback.format_exc())


@socketio.on("group_message")
def handle_group_message(data):
    """
    data = { "groupName": str, "message": str }
    """
    try:
        sid = request.sid
        user = socketio.server.environ.get(sid, {}).get('user')
        if not user:
            return
            
        username = user['username']
        user_id = str(user['_id'])
        
        group_name = data.get("groupName")
        encrypted_content = data.get("encrypted_content")
        
        if not group_name or not encrypted_content:
            return
            
        db = get_db()
        group = db.groups.find_one({"title": group_name})
        if not group:
            return
            
        if user_id not in group.get('members', []):
            return
            
        chat_id = group.get('chat_id')
        
        # Save message
        if chat_id:
            msg_doc = {
                "chat_id": ObjectId(chat_id),
                "sender_id": user_id,
                "message_type": "text",
                "encrypted_content": encrypted_content,
                "created_at": datetime.utcnow(),
                "is_deleted": False,
                "seen_by": [user_id],
                "e2e_encrypted": True
            }
            db.messages.insert_one(msg_doc)
            
            # Update chat with last message info
            db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {
                    "$set": {
                        "last_message_encrypted": encrypted_content,
                        "last_message_preview": "Encrypted Message",
                        "last_message_at": datetime.utcnow()
                    }
                }
            )
            
        # Emit to group room (using groupName as room to match snippet)
        emit("group_message", {
            "from": username,
            "group": group_name,
            "encrypted_content": encrypted_content,
            "timestamp": datetime.utcnow().isoformat()
        }, room=group_name)
        
    except Exception:
        print("[group_message] error:", traceback.format_exc())
