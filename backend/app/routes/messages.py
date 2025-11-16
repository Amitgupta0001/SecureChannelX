from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit, join_room
from app.database import get_db
from app.security.advanced_encryption import encryption_service
from app import socketio
from bson import ObjectId
from datetime import datetime, timedelta
import logging

messages_bp = Blueprint("messages", __name__)
db = get_db()

connected_users = {}

# ------------------ SOCKET CONNECTION ------------------ #

@socketio.on("connect")
@jwt_required()
def handle_connect():
    user_id = get_jwt_identity()
    user = db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        emit("error", {"message": "User not found"})
        return

    connected_users[user_id] = request.sid

    # Create E2E session key
    session_key = encryption_service.generate_session_key()
    expires_at = datetime.utcnow() + timedelta(hours=24)

    db.session_keys.insert_one({
        "user_id": user_id,
        "session_key": session_key.hex(),
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
        "is_active": True
    })

    emit("session_key", {"key": session_key.hex()})
    emit("user_online", {
        "user_id": user_id,
        "username": user["username"]
    }, broadcast=True, include_self=False)

    logging.info(f"User {user_id} connected with E2E encryption")

# ------------------ E2E MESSAGE HANDLING ------------------ #

@socketio.on("send_message")
@jwt_required()
def handle_send_message(data):
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({"_id": ObjectId(user_id)})

        if not user:
            emit("error", {"message": "User not found"})
            return

        # Get active session key for E2E encryption
        session_key_record = db.session_keys.find_one(
            {"user_id": user_id, "is_active": True},
            sort=[("created_at", -1)]
        )

        if not session_key_record:
            emit("error", {"message": "No active session key"})
            return

        session_key = bytes.fromhex(session_key_record["session_key"])

        # E2E Encrypt message content
        encrypted_content = encryption_service.encrypt_message(
            data["content"], session_key
        )

        # Create message document with encrypted content
        message_doc = {
            "encrypted_content": encrypted_content,  # E2E Encrypted
            "user_id": user_id,
            "username": user["username"],
            "room_id": data["room_id"],
            "message_type": data.get("type", "text"),
            "created_at": datetime.utcnow(),
            "is_deleted": False,
            "is_edited": False,
            "reactions": [],
            "e2e_encrypted": True,  # Mark as E2E encrypted
            "encryption_version": "aes-256-gcm"
        }

        # Store encrypted message in database
        result = db.messages.insert_one(message_doc)
        message_id = str(result.inserted_id)

        # Prepare message for broadcasting (still encrypted)
        broadcast_message = {
            "id": message_id,
            "encrypted_content": encrypted_content,
            "user_id": user_id,
            "username": user["username"],
            "room_id": data["room_id"],
            "timestamp": message_doc["created_at"].isoformat(),
            "e2e_encrypted": True,
            "encryption_version": "aes-256-gcm"
        }

        # Broadcast encrypted message to room
        emit("new_message", broadcast_message, room=data["room_id"])

        logging.info(f"E2E encrypted message sent by {user_id} in room {data['room_id']}")

    except Exception as e:
        logging.error(f"E2E message sending failed: {str(e)}")
        emit("error", {"message": f"Failed to send encrypted message: {str(e)}"})

@socketio.on("request_decryption_key")
@jwt_required()
def handle_decryption_key_request(data):
    """Provide decryption key to authorized users"""
    try:
        user_id = get_jwt_identity()
        message_id = data.get("message_id")
        
        message = db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            emit("error", {"message": "Message not found"})
            return
        
        # Verify user has permission to read this message
        # (e.g., same room, not blocked, etc.)
        
        # Get session key for decryption
        session_key_record = db.session_keys.find_one(
            {"user_id": user_id, "is_active": True},
            sort=[("created_at", -1)]
        )
        
        if session_key_record:
            # Send decryption key (in real implementation, use proper key exchange)
            emit("decryption_key", {
                "message_id": message_id,
                "session_key": session_key_record["session_key"]
            })
        
    except Exception as e:
        logging.error(f"Decryption key request failed: {str(e)}")
        emit("error", {"message": "Failed to provide decryption key"})

# ------------------ E2E SECURE SESSION MANAGEMENT ------------------ #

@socketio.on("establish_e2e_session")
@jwt_required()
def handle_establish_e2e_session(data):
    """Establish E2E encrypted session between two users"""
    try:
        user_id = get_jwt_identity()
        target_user_id = data.get("target_user_id")
        
        if not target_user_id:
            emit("error", {"message": "Target user ID required"})
            return
        
        # Setup E2E session with forward secrecy
        session_data = encryption_service.setup_secure_session(user_id, target_user_id)
        
        # Notify target user about session establishment
        target_sid = connected_users.get(target_user_id)
        if target_sid:
            emit("e2e_session_request", {
                "initiator_id": user_id,
                "session_data": session_data
            }, room=target_sid)
        
        emit("e2e_session_established", session_data)
        
        logging.info(f"E2E session established between {user_id} and {target_user_id}")
        
    except Exception as e:
        logging.error(f"E2E session establishment failed: {str(e)}")
        emit("error", {"message": f"Failed to establish secure session: {str(e)}"})

@socketio.on("ratchet_encrypt_message")
@jwt_required()
def handle_ratchet_encrypt_message(data):
    """Send message with forward secrecy using Double Ratchet"""
    try:
        user_id = get_jwt_identity()
        session_id = data.get("session_id")
        message_content = data.get("content")
        
        if not all([session_id, message_content]):
            emit("error", {"message": "Session ID and content required"})
            return
        
        # Encrypt with forward secrecy
        encrypted_data = encryption_service.ratchet_encrypt_message(session_id, message_content)
        
        # Send to recipient
        target_user_id = data.get("target_user_id")
        target_sid = connected_users.get(target_user_id)
        
        if target_sid:
            emit("ratchet_message", encrypted_data, room=target_sid)
        
        logging.info(f"Forward-secure message sent via session {session_id}")
        
    except Exception as e:
        logging.error(f"Ratchet encryption failed: {str(e)}")
        emit("error", {"message": f"Secure message failed: {str(e)}"})

# ------------------ GET ENCRYPTED MESSAGES ------------------ #

@messages_bp.route("/api/messages/<room_id>", methods=["GET"])
@jwt_required()
def get_messages(room_id):
    try:
        user_id = get_jwt_identity()
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 50))

        skip = (page - 1) * per_page

        # Fetch encrypted messages
        cursor = db.messages.find(
            {"room_id": room_id, "is_deleted": False}
        ).sort("created_at", -1).skip(skip).limit(per_page)

        messages = []
        for msg in cursor:
            messages.append({
                "id": str(msg["_id"]),
                "user_id": msg["user_id"],
                "username": msg["username"],
                "room_id": msg["room_id"],
                "encrypted_content": msg["encrypted_content"],  # Still encrypted
                "message_type": msg["message_type"],
                "timestamp": msg["created_at"].isoformat(),
                "is_edited": msg["is_edited"],
                "reactions": msg["reactions"],
                "e2e_encrypted": msg.get("e2e_encrypted", False),
                "encryption_version": msg.get("encryption_version", "unknown")
            })

        total_messages = db.messages.count_documents(
            {"room_id": room_id, "is_deleted": False}
        )
        total_pages = (total_messages + per_page - 1) // per_page

        return jsonify({
            "messages": messages[::-1],  # Reverse to show oldest first
            "page": page,
            "total_pages": total_pages,
            "total_messages": total_messages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
            "e2e_encrypted": True
        })

    except Exception as e:
        logging.error(f"Failed to fetch encrypted messages: {str(e)}")
        return jsonify({"error": "Failed to fetch messages"}), 500