from flask import Blueprint, request, jsonify, current_app
from flask_socketio import emit
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import get_db
from bson import ObjectId
from app import socketio
import secrets
import time
from datetime import datetime

webrtc_bp = Blueprint('webrtc', __name__)
db = get_db()

# Store active calls and WebRTC sessions
active_calls = {}
webrtc_sessions = {}

@webrtc_bp.route('/api/calls/initiate', methods=['POST'])
@jwt_required()
def initiate_call():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'callee_id' not in data:
            return jsonify({'error': 'Callee ID required'}), 400
        
        caller = db.users.find_one({"_id": ObjectId(user_id)})
        callee = db.users.find_one({"_id": ObjectId(data['callee_id'])})
        
        if not caller or not callee:
            return jsonify({'error': 'User not found'}), 404
        
        # Generate unique call ID
        call_id = secrets.token_urlsafe(16)
        
        # Store call information
        active_calls[call_id] = {
            'caller': user_id,
            'callee': data['callee_id'],
            'call_type': data.get('type', 'video'),  # video or audio
            'status': 'ringing',
            'created_at': time.time(),
            'caller_sdp': None,
            'callee_sdp': None
        }
        
        # Log call initiation
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "call_initiated",
            "resource": "webrtc",
            "status": "success",
            "details": f'Call to {callee["username"]}, type: {data.get("type", "video")}',
            "timestamp": datetime.utcnow()
        })
        
        # Notify callee through Socket.IO
        from app import socketio
        # Get callee's socket ID from connected users (you'll need to implement this tracking)
        callee_sid = get_user_socket_id(data['callee_id'])
        
        if callee_sid:
            emit('incoming_call', {
                'call_id': call_id,
                'caller_id': user_id,
                'caller_username': caller["username"],
                'call_type': data.get('type', 'video')
            }, room=callee_sid)
        
        return jsonify({
            'call_id': call_id,
            'message': 'Call initiated'
        })
        
    except Exception as e:
        current_app.logger.error(f"Initiate call error: {str(e)}")
        return jsonify({'error': 'Failed to initiate call'}), 500

def get_user_socket_id(user_id):
    """Get user's socket ID from your connected users tracking"""
    # You'll need to implement this based on how you track connected users
    # This is a placeholder - implement based on your connected_users structure
    from app.messages import connected_users  # Import from your messages module
    return connected_users.get(user_id)

@socketio.on('webrtc_offer')
@jwt_required()
def handle_webrtc_offer(data):
    try:
        user_id = get_jwt_identity()
        call_id = data.get('call_id')
        
        if not call_id or call_id not in active_calls:
            emit('error', {'message': 'Call not found'})
            return
        
        call = active_calls[call_id]
        
        # Store caller's SDP offer
        call['caller_sdp'] = data['offer']
        call['status'] = 'offer_received'
        
        # Forward offer to callee
        callee_sid = get_user_socket_id(call['callee'])
        if callee_sid:
            emit('webrtc_offer', {
                'offer': data['offer'],
                'call_id': call_id,
                'caller_id': user_id
            }, room=callee_sid)
        
    except Exception as e:
        current_app.logger.error(f"WebRTC offer error: {str(e)}")
        emit('error', {'message': 'Failed to handle WebRTC offer'})

@socketio.on('webrtc_answer')
@jwt_required()
def handle_webrtc_answer(data):
    try:
        user_id = get_jwt_identity()
        call_id = data.get('call_id')
        
        if not call_id or call_id not in active_calls:
            emit('error', {'message': 'Call not found'})
            return
        
        call = active_calls[call_id]
        
        # Store callee's SDP answer
        call['callee_sdp'] = data['answer']
        call['status'] = 'connected'
        
        # Forward answer to caller
        caller_sid = get_user_socket_id(call['caller'])
        if caller_sid:
            emit('webrtc_answer', {
                'answer': data['answer'],
                'call_id': call_id
            }, room=caller_sid)
        
        # Log call connection
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "call_connected",
            "resource": "webrtc",
            "status": "success",
            "details": f'Call {call_id} connected',
            "timestamp": datetime.utcnow()
        })
        
    except Exception as e:
        current_app.logger.error(f"WebRTC answer error: {str(e)}")
        emit('error', {'message': 'Failed to handle WebRTC answer'})

@socketio.on('webrtc_ice_candidate')
@jwt_required()
def handle_webrtc_ice_candidate(data):
    try:
        user_id = get_jwt_identity()
        call_id = data.get('call_id')
        
        if not call_id or call_id not in active_calls:
            return
        
        call = active_calls[call_id]
        
        # Forward ICE candidate to the other peer
        target_id = call['callee'] if user_id == call['caller'] else call['caller']
        target_sid = get_user_socket_id(target_id)
        
        if target_sid:
            emit('webrtc_ice_candidate', {
                'candidate': data['candidate'],
                'call_id': call_id
            }, room=target_sid)
        
    except Exception as e:
        current_app.logger.error(f"ICE candidate error: {str(e)}")
        emit('error', {'message': 'Failed to handle ICE candidate'})

@socketio.on('end_call')
@jwt_required()
def handle_end_call(data):
    try:
        user_id = get_jwt_identity()
        call_id = data.get('call_id')
        
        if not call_id or call_id not in active_calls:
            return
        
        call = active_calls[call_id]
        
        # Notify other party
        other_party_id = call['callee'] if user_id == call['caller'] else call['caller']
        other_party_sid = get_user_socket_id(other_party_id)
        
        if other_party_sid:
            emit('call_ended', {
                'call_id': call_id,
                'reason': data.get('reason', 'call_ended')
            }, room=other_party_sid)
        
        # Log call end
        db.audit_logs.insert_one({
            "user_id": user_id,
            "action": "call_ended",
            "resource": "webrtc",
            "status": "success",
            "details": f'Call {call_id} ended',
            "timestamp": datetime.utcnow()
        })
        
        # Cleanup
        del active_calls[call_id]
        
    except Exception as e:
        current_app.logger.error(f"End call error: {str(e)}")
        emit('error', {'message': 'Failed to end call'})

@webrtc_bp.route('/api/calls/<call_id>', methods=['GET'])
@jwt_required()
def get_call_status(call_id):
    try:
        user_id = get_jwt_identity()
        
        if call_id not in active_calls:
            return jsonify({'error': 'Call not found'}), 404
        
        call = active_calls[call_id]
        
        # Verify user is part of the call
        if user_id not in [call['caller'], call['callee']]:
            return jsonify({'error': 'Not authorized'}), 403
        
        return jsonify({
            'call_id': call_id,
            'status': call['status'],
            'call_type': call['call_type'],
            'duration': time.time() - call['created_at'] if call['status'] == 'connected' else 0
        })
        
    except Exception as e:
        current_app.logger.error(f"Get call status error: {str(e)}")
        return jsonify({'error': 'Failed to get call status'}), 500

@socketio.on('call_accepted')
@jwt_required()
def handle_call_accepted(data):
    try:
        user_id = get_jwt_identity()
        call_id = data.get('call_id')
        
        if not call_id or call_id not in active_calls:
            emit('error', {'message': 'Call not found'})
            return
        
        call = active_calls[call_id]
        call['status'] = 'accepted'
        
        # Notify caller that call was accepted
        caller_sid = get_user_socket_id(call['caller'])
        if caller_sid:
            emit('call_accepted', {
                'call_id': call_id
            }, room=caller_sid)
        
    except Exception as e:
        current_app.logger.error(f"Call accepted error: {str(e)}")
        emit('error', {'message': 'Failed to accept call'})

@socketio.on('call_rejected')
@jwt_required()
def handle_call_rejected(data):
    try:
        user_id = get_jwt_identity()
        call_id = data.get('call_id')
        
        if not call_id or call_id not in active_calls:
            emit('error', {'message': 'Call not found'})
            return
        
        call = active_calls[call_id]
        
        # Notify caller that call was rejected
        caller_sid = get_user_socket_id(call['caller'])
        if caller_sid:
            emit('call_rejected', {
                'call_id': call_id,
                'reason': data.get('reason', 'Call rejected')
            }, room=caller_sid)
        
        # Cleanup
        del active_calls[call_id]
        
    except Exception as e:
        current_app.logger.error(f"Call rejected error: {str(e)}")
        emit('error', {'message': 'Failed to reject call'})