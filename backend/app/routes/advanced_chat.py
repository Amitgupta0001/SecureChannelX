# features/advanced_chat.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import get_db
from bson import ObjectId
from datetime import datetime
import json

advanced_chat_bp = Blueprint('advanced_chat', __name__)
db = get_db()

# Mock implementations - replace with actual AI services
class ChatAnalyzer:
    def analyze_sentiment(self, message):
        # Mock implementation - replace with actual sentiment analysis
        if any(word in message.lower() for word in ['happy', 'great', 'awesome', 'good']):
            return "positive"
        elif any(word in message.lower() for word in ['sad', 'bad', 'terrible', 'hate']):
            return "negative"
        else:
            return "neutral"
    
    def smart_reply_suggestions(self, conversation_context):
        # Mock implementation - replace with actual AI suggestions
        return ["Okay", "Thanks!", "I see", "Got it", "Interesting"]

class MessageTranslator:
    def translate_message(self, message, target_language='es'):
        # Mock implementation - replace with actual translation service
        translations = {
            'es': f"Traducido: {message}",
            'fr': f"Traduit: {message}",
            'de': f"Übersetzt: {message}"
        }
        return translations.get(target_language, f"Translated: {message}")

chat_analyzer = ChatAnalyzer()
translator = MessageTranslator()

@advanced_chat_bp.route('/api/chat/analyze-sentiment', methods=['POST'])
@jwt_required()
def analyze_sentiment():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message required'}), 400
        
        sentiment = chat_analyzer.analyze_sentiment(data['message'])
        
        return jsonify({'sentiment': sentiment})
    
    except Exception as e:
        current_app.logger.error(f"Sentiment analysis error: {str(e)}")
        return jsonify({'error': 'Failed to analyze sentiment'}), 500

@advanced_chat_bp.route('/api/chat/translate', methods=['POST'])
@jwt_required()
def translate_message():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message required'}), 400
        
        target_language = data.get('target_language', 'es')
        translated = translator.translate_message(data['message'], target_language)
        
        return jsonify({
            'translated_message': translated,
            'original_message': data['message'],
            'target_language': target_language
        })
    
    except Exception as e:
        current_app.logger.error(f"Translation error: {str(e)}")
        return jsonify({'error': 'Failed to translate message'}), 500

@advanced_chat_bp.route('/api/chat/smart-replies', methods=['POST'])
@jwt_required()
def get_smart_replies():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'conversation_context' not in data:
            return jsonify({'error': 'Conversation context required'}), 400
        
        suggestions = chat_analyzer.smart_reply_suggestions(data['conversation_context'])
        
        return jsonify({'suggestions': suggestions})
    
    except Exception as e:
        current_app.logger.error(f"Smart replies error: {str(e)}")
        return jsonify({'error': 'Failed to generate smart replies'}), 500

@advanced_chat_bp.route('/api/chat/polls', methods=['POST'])
@jwt_required()
def create_poll():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'question' not in data or 'options' not in data:
            return jsonify({'error': 'Question and options required'}), 400
        
        # Create poll document
        poll_data = {
            'question': data['question'],
            'options': data['options'],
            'created_by': user_id,
            'room_id': data.get('room_id', 'general'),
            'is_anonymous': data.get('is_anonymous', False),
            'allows_multiple': data.get('allows_multiple', False),
            'created_at': datetime.utcnow(),
            'is_active': True,
            'votes': {}
        }
        
        result = db.polls.insert_one(poll_data)
        poll_id = str(result.inserted_id)
        
        # Notify room about new poll
        from app import socketio
        socketio.emit('new_poll', {
            'poll_id': poll_id,
            'question': data['question'],
            'options': data['options'],
            'created_by': user_id,
            'room_id': data.get('room_id', 'general')
        }, room=data.get('room_id', 'general'))
        
        return jsonify({'poll_id': poll_id, 'message': 'Poll created successfully'})
    
    except Exception as e:
        current_app.logger.error(f"Create poll error: {str(e)}")
        return jsonify({'error': 'Failed to create poll'}), 500

@advanced_chat_bp.route('/api/chat/polls/<poll_id>/vote', methods=['POST'])
@jwt_required()
def vote_on_poll(poll_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'option_index' not in data:
            return jsonify({'error': 'Option index required'}), 400
        
        poll = db.polls.find_one({'_id': ObjectId(poll_id)})
        
        if not poll:
            return jsonify({'error': 'Poll not found'}), 404
        
        # Check if user already voted (for single-choice polls)
        if not poll.get('allows_multiple', False) and user_id in poll.get('votes', {}):
            return jsonify({'error': 'Already voted on this poll'}), 400
        
        # Update vote
        vote_key = f'votes.{user_id}'
        if poll.get('allows_multiple', False):
            # For multiple choice, store as array
            db.polls.update_one(
                {'_id': ObjectId(poll_id)},
                {'$addToSet': {vote_key: data['option_index']}}
            )
        else:
            # For single choice, store as single value
            db.polls.update_one(
                {'_id': ObjectId(poll_id)},
                {'$set': {vote_key: data['option_index']}}
            )
        
        # Get updated poll results
        updated_poll = db.polls.find_one({'_id': ObjectId(poll_id)})
        results = self.calculate_poll_results(updated_poll)
        
        # Notify about poll update
        from app import socketio
        socketio.emit('poll_updated', {
            'poll_id': poll_id,
            'results': results
        }, room=poll.get('room_id', 'general'))
        
        return jsonify({'message': 'Vote recorded successfully', 'results': results})
    
    except Exception as e:
        current_app.logger.error(f"Vote error: {str(e)}")
        return jsonify({'error': 'Failed to record vote'}), 500

def calculate_poll_results(self, poll):
    """Calculate poll results"""
    votes = poll.get('votes', {})
    options = poll.get('options', [])
    
    results = {i: 0 for i in range(len(options))}
    
    for user_id, vote in votes.items():
        if isinstance(vote, list):
            # Multiple choice
            for option_index in vote:
                if option_index in results:
                    results[option_index] += 1
        else:
            # Single choice
            if vote in results:
                results[vote] += 1
    
    return {
        'question': poll.get('question'),
        'options': options,
        'votes': results,
        'total_votes': len(votes)
    }