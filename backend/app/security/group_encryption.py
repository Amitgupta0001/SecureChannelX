"""
SecureChannelX - Group Encryption Manager (Sender Keys)
-------------------------------------------------------
Implements the Sender Key protocol for efficient group messaging.

Protocol:
1. Each participant generates a random 32-byte "Sender Key".
2. This key is encrypted individually for every other group member (using X3DH).
3. The encrypted keys are stored/distributed via the server.
4. Messages are encrypted with the sender's Sender Key.
5. Recipients use the stored Sender Key for that sender to decrypt.
"""

import os
import logging
from typing import Dict, List, Optional
from datetime import datetime

from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)

class GroupKeyManager:
    """Manages Sender Keys for group chats"""
    
    def __init__(self, db=None):
        self.db = db or get_db()

    def store_sender_key(self, group_id: str, sender_id: str, recipient_id: str, 
                        encrypted_key: str, key_id: int):
        """
        Store an encrypted copy of a sender key for a specific recipient.
        
        Args:
            group_id: The group chat ID
            sender_id: The user who owns this key
            recipient_id: The user who can decrypt this key
            encrypted_key: The key encrypted with recipient's public key
            key_id: ID to track key rotation
        """
        self.db.group_keys.update_one(
            {
                'group_id': group_id,
                'sender_id': sender_id,
                'recipient_id': recipient_id
            },
            {
                '$set': {
                    'encrypted_key': encrypted_key,
                    'key_id': key_id,
                    'updated_at': now_utc()
                }
            },
            upsert=True
        )

    def get_sender_key(self, group_id: str, sender_id: str, recipient_id: str) -> Optional[Dict]:
        """
        Retrieve a sender key for a recipient to decrypt messages from sender.
        """
        return self.db.group_keys.find_one({
            'group_id': group_id,
            'sender_id': sender_id,
            'recipient_id': recipient_id
        })

    def get_missing_keys(self, group_id: str, user_id: str) -> List[str]:
        """
        Find which group members haven't received my Sender Key yet.
        Returns list of user_ids.
        """
        # Get all members
        group = self.db.chats.find_one({'_id': {'$in': [group_id, str(group_id)]}}) # Handle potential ID formats
        if not group:
            # Try ObjectId
            from bson.objectid import ObjectId
            try:
                group = self.db.chats.find_one({'_id': ObjectId(group_id)})
            except:
                pass
                
        if not group:
            return []
            
        members = [str(p['user_id']) if isinstance(p, dict) else str(p) for p in group.get('participants', [])]
        members = [m for m in members if m != user_id] # Exclude self
        
        # Check existing keys
        existing = self.db.group_keys.find({
            'group_id': group_id,
            'sender_id': user_id
        })
        covered_members = [k['recipient_id'] for k in existing]
        
        missing = list(set(members) - set(covered_members))
        return missing

    def rotate_sender_key(self, user_id: str, group_id: str):
        """
        Mark current keys as expired/rotate logic
        (Client handles generation, this just cleans up)
        """
        # In this implementation, client pushes new keys with higher key_id, 
        # so explicit deletion isn't strictly necessary but good for hygiene.
        pass

# Global Instance
_group_key_manager = None
def get_group_key_manager():
    global _group_key_manager
    if not _group_key_manager:
        _group_key_manager = GroupKeyManager()
    return _group_key_manager
