# FILE: backend/app/routes/calls.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from app import socketio

# Utils
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc

# Models
from app.models.call_model import call_document

calls_bp = Blueprint("calls", __name__, url_prefix="/api/calls")
db = get_db()


# ============================================================
#                      CALL HISTORY
# ============================================================
@calls_bp.route("/history/<chat_id>", methods=["GET"])
@jwt_required()
def call_history(chat_id):
    """
    Get call history for a specific chat
    """
    try:
        current_user_id = get_jwt_identity()
        
        # Validate chat_id
        try:
            chat_oid = ObjectId(chat_id)
        except Exception:
            return error("Invalid chat_id format", 400)

        # Verify user is part of this chat
        chat = db.chats.find_one({"_id": chat_oid})
        if not chat:
            return error("Chat not found", 404)
        
        if current_user_id not in chat.get("participants", []):
            return error("Unauthorized access to this chat", 403)

        # Fetch calls
        cursor = db.calls.find({
            "chat_id": chat_oid
        }).sort("started_at", -1).limit(50)  # Limit to last 50 calls

        calls = []
        for c in cursor:
            call_data = {
                "id": str(c["_id"]),
                "call_id": str(c["_id"]),  # ✅ Added for consistency
                "chat_id": str(c["chat_id"]),
                "caller_id": c["caller_id"],
                "receiver_id": c["receiver_id"],
                "call_type": c.get("call_type", "audio"),
                "status": c.get("status", "unknown"),
                "started_at": c["started_at"].isoformat() if isinstance(c["started_at"], datetime) else c["started_at"],
                "ended_at": c["ended_at"].isoformat() if c.get("ended_at") and isinstance(c["ended_at"], datetime) else None,
                "duration_seconds": c.get("duration_seconds", 0),
                "call_metadata": c.get("call_metadata", {})
            }
            calls.append(call_data)

        return success(data={"calls": calls, "total": len(calls)})

    except Exception as e:
        current_app.logger.error(f"[CALL HISTORY ERROR] {str(e)}")
        return error("Failed to fetch call history", 500)


# ============================================================
#                        START A CALL
# ============================================================
@calls_bp.route("/start", methods=["POST"])
@jwt_required()
def start_call():
    """
    Starts an audio or video call.

    Expected JSON:
    {
        "chat_id": "...",
        "receiver_id": "...",
        "call_type": "audio" | "video",
        "offer": { ... }  // WebRTC offer (optional)
    }
    """
    try:
        data = request.get_json() or {}

        chat_id = data.get("chat_id")
        receiver_id = data.get("receiver_id")
        call_type = data.get("call_type", "audio")
        offer = data.get("offer")  # WebRTC SDP offer
        caller_id = get_jwt_identity()

        # Validation
        if not chat_id or not receiver_id:
            return error("chat_id and receiver_id are required", 400)

        if call_type not in ["audio", "video"]:
            return error("call_type must be 'audio' or 'video'", 400)

        if caller_id == receiver_id:
            return error("Cannot call yourself", 400)

        # Convert chat_id → ObjectId
        try:
            chat_oid = ObjectId(chat_id)
        except Exception:
            return error("Invalid chat_id format", 400)

        # Verify chat exists and caller is participant
        chat = db.chats.find_one({"_id": chat_oid})
        if not chat:
            return error("Chat not found", 404)

        if caller_id not in chat.get("participants", []):
            return error("You are not a participant in this chat", 403)

        if receiver_id not in chat.get("participants", []):
            return error("Receiver is not a participant in this chat", 403)

        # Check if receiver is online (optional but recommended)
        # You can implement this by checking socket connections

        # Check for ongoing calls in this chat
        ongoing_call = db.calls.find_one({
            "chat_id": chat_oid,
            "status": {"$in": ["ringing", "ongoing"]}
        })

        if ongoing_call:
            return error("There is already an ongoing call in this chat", 409)

        # Build call document
        call_doc = call_document(
            chat_id=str(chat_oid),
            caller_id=caller_id,
            receiver_id=receiver_id,
            call_type=call_type,
            status="ringing",
            call_metadata={
                "offer": offer,
                "initiated_at": now_utc().isoformat()
            }
        )

        # Insert into database
        inserted_id = db.calls.insert_one(call_doc).inserted_id
        
        # Prepare response document
        response_call = {
            "id": str(inserted_id),
            "call_id": str(inserted_id),
            "_id": str(inserted_id),
            "chat_id": str(chat_oid),
            "caller_id": caller_id,
            "receiver_id": receiver_id,
            "call_type": call_type,
            "status": "ringing",
            "started_at": call_doc["started_at"].isoformat() if isinstance(call_doc["started_at"], datetime) else call_doc["started_at"],
            "call_metadata": call_doc.get("call_metadata", {})
        }

        # Notify the receiver via WebSocket
        try:
            socketio.emit(
                "call:incoming",
                {
                    "call": response_call,
                    "caller": {
                        "id": caller_id,
                        "username": chat.get("participants_info", {}).get(caller_id, {}).get("username", "Unknown")
                    }
                },
                room=f"user:{receiver_id}"
            )
            current_app.logger.info(f"[CALL] Notified receiver {receiver_id} of incoming call {inserted_id}")
        except Exception as socket_error:
            current_app.logger.error(f"[CALL SOCKET ERROR] {socket_error}")
            # Don't fail the request if socket notification fails

        return success("Call initiated successfully", {"call": response_call})

    except Exception as e:
        current_app.logger.error(f"[START CALL ERROR] {str(e)}")
        return error("Failed to start call", 500)


# ============================================================
#                     ACCEPT CALL
# ============================================================
@calls_bp.route("/accept/<call_id>", methods=["POST"])
@jwt_required()
def accept_call(call_id):
    """
    Accept an incoming call
    
    Expected JSON:
    {
        "answer": { ... }  // WebRTC SDP answer
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        answer = data.get("answer")

        # Validate call_id
        try:
            call_oid = ObjectId(call_id)
        except Exception:
            return error("Invalid call_id format", 400)

        # Find call
        call = db.calls.find_one({"_id": call_oid})
        if not call:
            return error("Call not found", 404)

        # Verify user is the receiver
        if call.get("receiver_id") != current_user_id:
            return error("Unauthorized: You are not the receiver of this call", 403)

        # Check call status
        if call.get("status") != "ringing":
            return error(f"Cannot accept call with status: {call.get('status')}", 400)

        # Update call status
        update_data = {
            "status": "ongoing",
            "accepted_at": now_utc()
        }

        if answer:
            update_data["call_metadata.answer"] = answer

        db.calls.update_one(
            {"_id": call_oid},
            {"$set": update_data}
        )

        # Notify caller
        try:
            socketio.emit(
                "call:accepted",
                {
                    "call_id": str(call_oid),
                    "answer": answer,
                    "accepted_at": update_data["accepted_at"].isoformat()
                },
                room=f"user:{call['caller_id']}"
            )
        except Exception as socket_error:
            current_app.logger.error(f"[CALL ACCEPT SOCKET ERROR] {socket_error}")

        return success("Call accepted", {
            "call_id": str(call_oid),
            "status": "ongoing"
        })

    except Exception as e:
        current_app.logger.error(f"[ACCEPT CALL ERROR] {str(e)}")
        return error("Failed to accept call", 500)


# ============================================================
#                      REJECT CALL
# ============================================================
@calls_bp.route("/reject/<call_id>", methods=["POST"])
@jwt_required()
def reject_call(call_id):
    """
    Reject an incoming call
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        reason = data.get("reason", "Call rejected")

        # Validate call_id
        try:
            call_oid = ObjectId(call_id)
        except Exception:
            return error("Invalid call_id format", 400)

        # Find call
        call = db.calls.find_one({"_id": call_oid})
        if not call:
            return error("Call not found", 404)

        # Verify user is the receiver
        if call.get("receiver_id") != current_user_id:
            return error("Unauthorized: You are not the receiver of this call", 403)

        # Check call status
        if call.get("status") not in ["ringing", "ongoing"]:
            return error(f"Cannot reject call with status: {call.get('status')}", 400)

        # Update call status
        db.calls.update_one(
            {"_id": call_oid},
            {
                "$set": {
                    "status": "rejected",
                    "ended_at": now_utc(),
                    "rejection_reason": reason
                }
            }
        )

        # Notify caller
        try:
            socketio.emit(
                "call:rejected",
                {
                    "call_id": str(call_oid),
                    "reason": reason
                },
                room=f"user:{call['caller_id']}"
            )
        except Exception as socket_error:
            current_app.logger.error(f"[CALL REJECT SOCKET ERROR] {socket_error}")

        return success("Call rejected", {"call_id": str(call_oid)})

    except Exception as e:
        current_app.logger.error(f"[REJECT CALL ERROR] {str(e)}")
        return error("Failed to reject call", 500)


# ============================================================
#                       END CALL
# ============================================================
@calls_bp.route("/end/<call_id>", methods=["POST"])
@jwt_required()
def end_call(call_id):
    """
    End an ongoing call
    """
    try:
        current_user_id = get_jwt_identity()

        # Validate call_id
        try:
            call_oid = ObjectId(call_id)
        except Exception:
            return error("Invalid call_id format", 400)

        # Find call
        call = db.calls.find_one({"_id": call_oid})
        if not call:
            return error("Call not found", 404)

        # Verify user is participant
        if current_user_id not in [call.get("caller_id"), call.get("receiver_id")]:
            return error("Unauthorized: You are not a participant in this call", 403)

        # Check call status
        if call.get("status") not in ["ringing", "ongoing"]:
            return error(f"Call already ended with status: {call.get('status')}", 400)

        # Calculate duration
        ended_at = now_utc()
        started_at = call.get("started_at")
        
        duration_seconds = 0
        if started_at and isinstance(started_at, datetime):
            duration_seconds = int((ended_at - started_at).total_seconds())

        # Update call status
        db.calls.update_one(
            {"_id": call_oid},
            {
                "$set": {
                    "status": "ended",
                    "ended_at": ended_at,
                    "duration_seconds": duration_seconds,
                    "ended_by": current_user_id
                }
            }
        )

        # Notify other participant
        other_user_id = call["receiver_id"] if current_user_id == call["caller_id"] else call["caller_id"]
        
        try:
            socketio.emit(
                "call:ended",
                {
                    "call_id": str(call_oid),
                    "ended_by": current_user_id,
                    "duration_seconds": duration_seconds
                },
                room=f"user:{other_user_id}"
            )
        except Exception as socket_error:
            current_app.logger.error(f"[CALL END SOCKET ERROR] {socket_error}")

        return success("Call ended", {
            "call_id": str(call_oid),
            "duration_seconds": duration_seconds
        })

    except Exception as e:
        current_app.logger.error(f"[END CALL ERROR] {str(e)}")
        return error("Failed to end call", 500)


# ============================================================
#                   ICE CANDIDATE EXCHANGE
# ============================================================
@calls_bp.route("/ice-candidate/<call_id>", methods=["POST"])
@jwt_required()
def add_ice_candidate(call_id):
    """
    Exchange ICE candidates for WebRTC connection
    
    Expected JSON:
    {
        "candidate": { ... }
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        candidate = data.get("candidate")

        if not candidate:
            return error("ICE candidate is required", 400)

        # Validate call_id
        try:
            call_oid = ObjectId(call_id)
        except Exception:
            return error("Invalid call_id format", 400)

        # Find call
        call = db.calls.find_one({"_id": call_oid})
        if not call:
            return error("Call not found", 404)

        # Verify user is participant
        if current_user_id not in [call.get("caller_id"), call.get("receiver_id")]:
            return error("Unauthorized", 403)

        # Determine recipient
        recipient_id = call["receiver_id"] if current_user_id == call["caller_id"] else call["caller_id"]

        # Forward ICE candidate to other participant
        try:
            socketio.emit(
                "call:ice-candidate",
                {
                    "call_id": str(call_oid),
                    "candidate": candidate,
                    "from": current_user_id
                },
                room=f"user:{recipient_id}"
            )
        except Exception as socket_error:
            current_app.logger.error(f"[ICE CANDIDATE SOCKET ERROR] {socket_error}")
            return error("Failed to forward ICE candidate", 500)

        return success("ICE candidate forwarded")

    except Exception as e:
        current_app.logger.error(f"[ICE CANDIDATE ERROR] {str(e)}")
        return error("Failed to process ICE candidate", 500)


# ============================================================
#                   GET CALL STATUS
# ============================================================
@calls_bp.route("/status/<call_id>", methods=["GET"])
@jwt_required()
def get_call_status(call_id):
    """
    Get current status of a call
    """
    try:
        current_user_id = get_jwt_identity()

        # Validate call_id
        try:
            call_oid = ObjectId(call_id)
        except Exception:
            return error("Invalid call_id format", 400)

        # Find call
        call = db.calls.find_one({"_id": call_oid})
        if not call:
            return error("Call not found", 404)

        # Verify user is participant
        if current_user_id not in [call.get("caller_id"), call.get("receiver_id")]:
            return error("Unauthorized", 403)

        return success(data={
            "call_id": str(call["_id"]),
            "status": call.get("status"),
            "call_type": call.get("call_type"),
            "caller_id": call.get("caller_id"),
            "receiver_id": call.get("receiver_id"),
            "started_at": call["started_at"].isoformat() if isinstance(call["started_at"], datetime) else call["started_at"],
            "ended_at": call["ended_at"].isoformat() if call.get("ended_at") and isinstance(call["ended_at"], datetime) else None,
            "duration_seconds": call.get("duration_seconds")
        })

    except Exception as e:
        current_app.logger.error(f"[GET CALL STATUS ERROR] {str(e)}")
        return error("Failed to get call status", 500)
