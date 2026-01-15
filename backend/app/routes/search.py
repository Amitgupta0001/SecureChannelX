"""
SecureChannelX - Message Search
-------------------------------
Full-text search for encrypted messages
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database import get_db

logger = logging.getLogger(__name__)

search_bp = Blueprint('search', __name__)


class MessageSearchEngine:
    """
    Search engine for encrypted messages
    Note: Search happens on decrypted content client-side,
    but we provide filtering and indexing server-side
    """
    
    def __init__(self, db=None):
        self.db = db or get_db()
        self._create_text_indexes()
    
    def _create_text_indexes(self):
        """Create text indexes for search"""
        try:
            # Create text index on message content (for server-side metadata search)
            self.db.messages.create_index([
                ('sender_id', 1),
                ('recipient_id', 1),
                ('timestamp', -1)
            ], name='message_search_idx')
            
            logger.debug("[Search] Text indexes created")
        except Exception as e:
            logger.error(f"[Search] Failed to create indexes: {e}")
    
    def search_messages(
        self,
        user_id: str,
        query: str = None,
        contact_id: str = None,
        start_date: datetime = None,
        end_date: datetime = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict]:
        """
        Search messages with filters
        
        Args:
            user_id: Current user ID
            query: Search query (client-side only for E2EE)
            contact_id: Filter by contact
            start_date: Filter by start date
            end_date: Filter by end date
            limit: Max results
            skip: Pagination offset
            
        Returns:
            List of messages (encrypted)
        """
        # Build query
        search_query = {
            '$or': [
                {'sender_id': user_id},
                {'recipient_id': user_id}
            ]
        }
        
        # Filter by contact
        if contact_id:
            search_query['$or'] = [
                {'sender_id': user_id, 'recipient_id': contact_id},
                {'sender_id': contact_id, 'recipient_id': user_id}
            ]
        
        # Filter by date range
        if start_date or end_date:
            search_query['timestamp'] = {}
            if start_date:
                search_query['timestamp']['$gte'] = start_date
            if end_date:
                search_query['timestamp']['$lte'] = end_date
        
        # Execute search
        messages = list(self.db.messages.find(
            search_query,
            {'_id': 0}
        ).sort('timestamp', -1).skip(skip).limit(limit))
        
        logger.info(f"[Search] Found {len(messages)} messages for user {user_id}")
        return messages
    
    def search_contacts(self, user_id: str, query: str, limit: int = 20) -> List[Dict]:
        """
        Search contacts/users
        
        Args:
            user_id: Current user ID
            query: Search query
            limit: Max results
            
        Returns:
            List of matching users
        """
        # Search by username or email
        search_query = {
            '_id': {'$ne': user_id},  # Exclude self
            '$or': [
                {'username': {'$regex': query, '$options': 'i'}},
                {'email': {'$regex': query, '$options': 'i'}},
                {'display_name': {'$regex': query, '$options': 'i'}}
            ]
        }
        
        users = list(self.db.users.find(
            search_query,
            {'_id': 1, 'username': 1, 'email': 1, 'display_name': 1, 'avatar': 1}
        ).limit(limit))
        
        # Convert ObjectId to string
        for user in users:
            user['_id'] = str(user['_id'])
        
        logger.info(f"[Search] Found {len(users)} contacts matching '{query}'")
        return users
    
    def get_recent_contacts(self, user_id: str, limit: int = 20) -> List[Dict]:
        """
        Get recent contacts (users you've messaged)
        
        Args:
            user_id: Current user ID
            limit: Max results
            
        Returns:
            List of recent contacts
        """
        # Aggregate recent conversations
        pipeline = [
            {
                '$match': {
                    '$or': [
                        {'sender_id': user_id},
                        {'recipient_id': user_id}
                    ]
                }
            },
            {
                '$project': {
                    'contact_id': {
                        '$cond': [
                            {'$eq': ['$sender_id', user_id]},
                            '$recipient_id',
                            '$sender_id'
                        ]
                    },
                    'timestamp': 1
                }
            },
            {
                '$sort': {'timestamp': -1}
            },
            {
                '$group': {
                    '_id': '$contact_id',
                    'last_message': {'$first': '$timestamp'}
                }
            },
            {
                '$sort': {'last_message': -1}
            },
            {
                '$limit': limit
            }
        ]
        
        recent_contacts = list(self.db.messages.aggregate(pipeline))
        
        # Get user details
        contact_ids = [c['_id'] for c in recent_contacts]
        users = list(self.db.users.find(
            {'_id': {'$in': contact_ids}},
            {'_id': 1, 'username': 1, 'display_name': 1, 'avatar': 1}
        ))
        
        # Convert ObjectId to string
        for user in users:
            user['_id'] = str(user['_id'])
        
        return users


# Routes
@search_bp.route('/api/search/messages', methods=['GET'])
@jwt_required()
def search_messages():
    """Search messages"""
    user_id = get_jwt_identity()
    
    # Get query parameters
    query = request.args.get('q', '')
    contact_id = request.args.get('contact_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = int(request.args.get('limit', 50))
    skip = int(request.args.get('skip', 0))
    
    # Parse dates
    if start_date:
        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    if end_date:
        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    
    # Search
    engine = MessageSearchEngine()
    messages = engine.search_messages(
        user_id=user_id,
        query=query,
        contact_id=contact_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        skip=skip
    )
    
    return jsonify({
        'messages': messages,
        'count': len(messages),
        'query': query
    }), 200


@search_bp.route('/api/search/contacts', methods=['GET'])
@jwt_required()
def search_contacts():
    """Search contacts/users"""
    user_id = get_jwt_identity()
    query = request.args.get('q', '')
    limit = int(request.args.get('limit', 20))
    
    if not query or len(query) < 2:
        return jsonify({'error': 'Query must be at least 2 characters'}), 400
    
    engine = MessageSearchEngine()
    contacts = engine.search_contacts(user_id, query, limit)
    
    return jsonify({
        'contacts': contacts,
        'count': len(contacts)
    }), 200


@search_bp.route('/api/search/recent-contacts', methods=['GET'])
@jwt_required()
def get_recent_contacts():
    """Get recent contacts"""
    user_id = get_jwt_identity()
    limit = int(request.args.get('limit', 20))
    
    engine = MessageSearchEngine()
    contacts = engine.get_recent_contacts(user_id, limit)
    
    return jsonify({
        'contacts': contacts,
        'count': len(contacts)
    }), 200


__all__ = ['search_bp', 'MessageSearchEngine']
