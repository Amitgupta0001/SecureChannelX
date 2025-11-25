# backend/app/socket/webrtc.py

"""
Production-ready WebRTC signaling + call lifecycle manager for SecureChannelX
----------------------------------------------------------------------------

Features:
✔ Track connected users and their socket IDs
✔ Initiate / accept / reject / end calls
✔ WebRTC offer, answer, and ICE candidate forwarding
✔ Call status REST endpoint
✔ Fully stable emit routing to per-user rooms
✔ JWT validation only on REST routes (NOT for socket events)
"""

from flask import Blueprint, request, jsonify, current_app
from app.database import get_db
from app import socketio
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime
import secrets
import time
import traceback


webrtc_bp = Blueprint("webrtc", __name__)
db = get_db()

# ---------------------------------------------------------
#  CONNECTED USERS MAP:  user_id -> socket_id
# ---------------------------------------------------------
connected_users = {}       # { 'userid123': 'socketid456' }

# ---------------------------------------------------------
#  ACTIVE CALLS MAP
# ---------------------------------------------------------
active_calls = {}          # { call_id: {...} }


# =========================================================
#  SOCKET CONNECT / DISCONNECT
# =========================================================

@socketio.on("connect")
def on_socket_connect():
    """Register socket when it connects."""
    try:
        print(f"[WebRTC] Socket connected: {request.sid}")
    except:
        print("[WebRTC] Connect error:", traceback.format_exc())


@socketio.on("auth_user")
def on_auth_user(data):
    """
    data = { user_id: "<mongo-id>" }
    Client must call this right after connecting.
    """
    try:
        user_id = str(data.get("user_id"))
        if user_id:
            connected_users[user_id] = request.sid
            print(f"[WebRTC] User authenticated: {user_id} -> {request.sid}")

    except Exception:
        print("[WebRTC] auth_user error:", traceback.format_exc())


@socketio.on("disconnect")
def on_socket_disconnect():
    """Remove socket from connected user list."""
    sid = request.sid
    try:
        for uid, stored_sid in list(connected_users.items()):
            if stored_sid == sid:
                del connected_users[uid]
                print(f"[WebRTC] User disconnected: {uid}")
                break
    except Exception:
        print("[WebRTC] Disconnect error:", traceback.format_exc())


# =========================================================
#  REST: Initiate a call
# =========================================================

@webrtc_bp.route("/api/calls/initiate", methods=["POST"])
@jwt_required()
def initiate_call():
    try:
        caller_id = get_jwt_identity()
        data = request.get_json() or {}

        callee_id = data.get("callee_id")
        call_type = data.get("type", "video")

        if not callee_id:
            return jsonify({"error": "callee_id required"}), 400

        caller = db.users.find_one({"_id": ObjectId(caller_id)})
        callee = db.users.find_one({"_id": ObjectId(callee_id)})

        if not caller or not callee:
            return jsonify({"error": "User not found"}), 404

        # Create unique call ID
        call_id = secrets.token_urlsafe(16)

        active_calls[call_id] = {
            "caller": caller_id,
            "callee": callee_id,
            "call_type": call_type,
            "status": "ringing",
            "created_at": time.time(),
            "caller_sdp": None,
            "callee_sdp": None,
        }

        # Send incoming call to callee
        callee_sid = connected_users.get(callee_id)

        if callee_sid:
            socketio.emit(
                "incoming_call",
                {
                    "call_id": call_id,
                    "caller_id": caller_id,
                    "caller_username": caller.get("username"),
                    "call_type": call_type,
                },
                room=callee_sid,
            )

        return jsonify({"call_id": call_id, "message": "Call initiated"}), 200

    except Exception as e:
        current_app.logger.error(f"[Initiate Call Error] {str(e)}")
        return jsonify({"error": "Failed to initiate call"}), 500


# =========================================================
#  SOCKET: OFFER / ANSWER / ICE
# =========================================================

@socketio.on("webrtc_offer")
def handle_webrtc_offer(data):
    try:
        call_id = data.get("call_id")
        offer = data.get("offer")

        if call_id not in active_calls:
            return

        call = active_calls[call_id]
        call["caller_sdp"] = offer
        call["status"] = "offer_sent"

        callee_sid = connected_users.get(call["callee"])
        if callee_sid:
            socketio.emit(
                "webrtc_offer",
                {"call_id": call_id, "offer": offer},
                room=callee_sid,
            )

    except Exception:
        print("[WebRTC Offer Error]", traceback.format_exc())


@socketio.on("webrtc_answer")
def handle_webrtc_answer(data):
    try:
        call_id = data.get("call_id")
        answer = data.get("answer")

        if call_id not in active_calls:
            return

        call = active_calls[call_id]
        call["callee_sdp"] = answer
        call["status"] = "connected"

        caller_sid = connected_users.get(call["caller"])
        if caller_sid:
            socketio.emit(
                "webrtc_answer",
                {"call_id": call_id, "answer": answer},
                room=caller_sid,
            )

    except Exception:
        print("[WebRTC Answer Error]", traceback.format_exc())


@socketio.on("webrtc_ice_candidate")
def handle_webrtc_ice(data):
    try:
        call_id = data.get("call_id")
        candidate = data.get("candidate")

        if call_id not in active_calls:
            return

        call = active_calls[call_id]

        # Determine which side to send candidate to
        sender_sid = request.sid
        target_user_id = (
            call["callee"] if connected_users.get(call["caller"]) == sender_sid else call["caller"]
        )
        target_sid = connected_users.get(target_user_id)

        if target_sid:
            socketio.emit(
                "webrtc_ice_candidate",
                {"call_id": call_id, "candidate": candidate},
                room=target_sid,
            )

    except Exception:
        print("[WebRTC ICE Error]", traceback.format_exc())


# =========================================================
#  SOCKET: Accept / Reject / End
# =========================================================

@socketio.on("call_accepted")
def handle_call_accepted(data):
    try:
        call_id = data.get("call_id")
        if call_id not in active_calls:
            return

        call = active_calls[call_id]
        call["status"] = "accepted"

        caller_sid = connected_users.get(call["caller"])
        if caller_sid:
            socketio.emit("call_accepted", {"call_id": call_id}, room=caller_sid)

    except Exception:
        print("[Call Accepted Error]", traceback.format_exc())


@socketio.on("call_rejected")
def handle_call_rejected(data):
    try:
        call_id = data.get("call_id")
        reason = data.get("reason", "Call rejected")

        if call_id not in active_calls:
            return

        call = active_calls[call_id]

        caller_sid = connected_users.get(call["caller"])
        if caller_sid:
            socketio.emit(
                "call_rejected",
                {"call_id": call_id, "reason": reason},
                room=caller_sid,
            )

        del active_calls[call_id]

    except Exception:
        print("[Call Rejected Error]", traceback.format_exc())


@socketio.on("end_call")
def handle_end_call(data):
    try:
        call_id = data.get("call_id")

        if call_id not in active_calls:
            return

        call = active_calls[call_id]

        # Notify the other participant
        other_user = call["callee"] if request.sid == connected_users.get(call["caller"]) else call["caller"]
        other_sid = connected_users.get(other_user)

        if other_sid:
            socketio.emit(
                "call_ended",
                {"call_id": call_id, "reason": data.get("reason", "Call ended")},
                room=other_sid,
            )

        del active_calls[call_id]

    except Exception:
        print("[End Call Error]", traceback.format_exc())


# =========================================================
#  REST: Call Status
# =========================================================

@webrtc_bp.route("/api/calls/<call_id>", methods=["GET"])
@jwt_required()
def get_call_status(call_id):
    try:
        user_id = get_jwt_identity()

        if call_id not in active_calls:
            return jsonify({"error": "Call not found"}), 404

        call = active_calls[call_id]

        if user_id not in [call["caller"], call["callee"]]:
            return jsonify({"error": "Unauthorized"}), 403

        return jsonify(
            {
                "call_id": call_id,
                "status": call["status"],
                "call_type": call["call_type"],
                "duration": (
                    time.time() - call["created_at"]
                    if call["status"] == "connected"
                    else 0
                ),
            }
        ), 200

    except Exception:
        print("[Call Status Error]", traceback.format_exc())
        return jsonify({"error": "Failed to get call status"}), 500
