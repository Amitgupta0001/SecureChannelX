# features/message_features.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import get_db
from app import socketio
from bson import ObjectId
from datetime import datetime

message_features_bp = Blueprint('message_features', __name__)
db = get_db()

@message_features_bp.route('/api/messages/search', methods=['GET'])
@jwt_required()
def search_messages():
    try:
        user_id = get_jwt_identity()
        query = request.args.get('q', '')
        room_id = request.args.get('room_id')
        
        if not query:
            return jsonify({'error': 'Query parameter required'}), 400
        
        # Build search query
        search_filter = {
            'user_id': user_id,
            'is_deleted': False,
            'content': {'$regex': query, '$options': 'i'}
        }
        
        if room_id:
            search_filter['room_id'] = room_id
        
        # Search in messages
        messages = db.messages.find(search_filter)\
            .sort('created_at', -1)\
            .limit(50)
        
        results = []
        for message in messages:
            results.append({
                'id': str(message['_id']),
                'content': message.get('content', ''),
                'room_id': message.get('room_id'),
                'timestamp': message.get('created_at', datetime.utcnow()).isoformat(),
                'username': message.get('username', 'Unknown')
            })
        
        return jsonify({'results': results})
    
    except Exception as e:
        current_app.logger.error(f"Search error: {str(e)}")
        return jsonify({'error': 'Failed to search messages'}), 500

@message_features_bp.route('/api/messages/<message_id>', methods=['PUT'])
@jwt_required()
def edit_message(message_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({'error': 'Content required'}), 400
        
        message = db.messages.find_one({'_id': ObjectId(message_id)})
        
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        if message.get('user_id') != user_id:
            return jsonify({'error': 'Not authorized to edit this message'}), 403
        
        # Update message
        db.messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {
                'content': data['content'],
                'is_edited': True,
                'updated_at': datetime.utcnow()
            }}
        )
        
        # Notify room about edit
        socketio.emit('message_edited', {
            'message_id': message_id,
            'content': data['content'],
            'room_id': message.get('room_id')
        }, room=message.get('room_id'))
        
        return jsonify({'message': 'Message updated successfully'})
    
    except Exception as e:
        current_app.logger.error(f"Edit message error: {str(e)}")
        return jsonify({'error': 'Failed to edit message'}), 500

@message_features_bp.route('/api/messages/<message_id>', methods=['DELETE'])
@jwt_required()
def delete_message(message_id):
    try:
        user_id = get_jwt_identity()
        
        message = db.messages.find_one({'_id': ObjectId(message_id)})
        
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        if message.get('user_id') != user_id:
            return jsonify({'error': 'Not authorized to delete this message'}), 403
        
        # Soft delete message
        db.messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {
                'is_deleted': True,
                'content': '[message deleted]',
                'updated_at': datetime.utcnow()
            }}
        )
        
        # Notify room about deletion
        socketio.emit('message_deleted', {
            'message_id': message_id,
            'room_id': message.get('room_id')
        }, room=message.get('room_id'))
        
        return jsonify({'message': 'Message deleted successfully'})
    
    except Exception as e:
        current_app.logger.error(f"Delete message error: {str(e)}")
        return jsonify({'error': 'Failed to delete message'}), 500

@message_features_bp.route('/api/messages/<message_id>/thread', methods=['POST'])
@jwt_required()
def create_thread(message_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({'error': 'Content required'}), 400
        
        parent_message = db.messages.find_one({'_id': ObjectId(message_id)})
        
        if not parent_message:
            return jsonify({'error': 'Parent message not found'}), 404
        
        # Create threaded message
        thread_message = {
            'content': data['content'],
            'encrypted_content': data.get('encrypted_content', ''),
            'user_id': user_id,
            'username': parent_message.get('username', 'Unknown'),
            'room_id': parent_message.get('room_id'),
            'parent_id': message_id,
            'created_at': datetime.utcnow(),
            'is_deleted': False,
            'is_edited': False,
            'message_type': 'thread'
        }
        
        result = db.messages.insert_one(thread_message)
        thread_id = str(result.inserted_id)
        
        # Notify about new thread message
        socketio.emit('thread_message', {
            'parent_id': message_id,
            'message': {
                'id': thread_id,
                'content': data['content'],
                'user_id': user_id,
                'username': parent_message.get('username', 'Unknown'),
                'timestamp': thread_message['created_at'].isoformat()
            },
            'room_id': parent_message.get('room_id')
        }, room=parent_message.get('room_id'))
        
        return jsonify({'message': 'Thread message created', 'thread_id': thread_id})
    
    except Exception as e:
        current_app.logger.error(f"Create thread error: {str(e)}")
        return jsonify({'error': 'Failed to create thread message'}), 500

@message_features_bp.route('/api/messages/<message_id>/thread', methods=['GET'])
@jwt_required()
def get_thread(message_id):
    try:
        thread_messages = db.messages.find({
            'parent_id': message_id,
            'is_deleted': False
        }).sort('created_at', 1)
        
        messages = []
        for msg in thread_messages:
            messages.append({
                'id': str(msg['_id']),
                'content': msg.get('content', ''),
                'user_id': msg.get('user_id'),
                'username': msg.get('username', 'Unknown'),
                'timestamp': msg.get('created_at', datetime.utcnow()).isoformat()
            })
        
        return jsonify({'thread': messages})
    
    except Exception as e:
        current_app.logger.error(f"Get thread error: {str(e)}")
        return jsonify({'error': 'Failed to fetch thread messages'}), 500