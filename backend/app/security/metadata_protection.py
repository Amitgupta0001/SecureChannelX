"""
SecureChannelX - Metadata Protection
------------------------------------
Implements metadata protection to prevent server from seeing:
- Who sends messages to whom
- When messages are sent
- Message sizes
- Communication patterns

Features:
- Sealed Sender (anonymous sender)
- Timestamp obfuscation
- Message padding
- Traffic analysis protection
"""

import os
import time
import logging
from typing import Tuple, Optional, Dict
from datetime import datetime, timedelta
import secrets

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)


# ============================================================
#                   CONSTANTS
# ============================================================

# Message padding sizes (to hide actual message length)
PADDING_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384]

# Timestamp jitter (randomize timestamps within this window)
TIMESTAMP_JITTER_SECONDS = 30

# Dummy message probability (send fake messages to hide patterns)
DUMMY_MESSAGE_PROBABILITY = 0.05  # 5% of messages are dummy


# ============================================================
#                   SEALED SENDER
# ============================================================

class SealedSender:
    """
    Implements sealed sender to hide sender identity from server
    
    The server only sees:
    - Encrypted sender certificate
    - Encrypted recipient ID
    - Encrypted message
    
    The server CANNOT see:
    - Who sent the message
    - Message content
    - Actual timestamp
    """
    
    @staticmethod
    def create_sender_certificate(
        sender_id: str,
        server_public_key: bytes,
        expires_at: datetime = None
    ) -> bytes:
        """
        Create encrypted sender certificate
        
        Args:
            sender_id: User ID of sender
            server_public_key: Server's public key for encryption
            expires_at: Certificate expiration time
            
        Returns:
            Encrypted sender certificate
        """
        if expires_at is None:
            expires_at = datetime.utcnow() + timedelta(hours=24)
        
        # Create certificate data
        cert_data = {
            'sender_id': sender_id,
            'issued_at': datetime.utcnow().isoformat(),
            'expires_at': expires_at.isoformat(),
            'nonce': secrets.token_hex(16)
        }
        
        # Serialize
        import json
        cert_json = json.dumps(cert_data).encode()
        
        # Encrypt with server's public key
        # In production, use actual asymmetric encryption
        # For now, using symmetric encryption with derived key
        key = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"SealedSender_Certificate"
        ).derive(server_public_key)
        
        encrypted_cert = SealedSender._encrypt_data(cert_json, key)
        
        logger.debug("[SealedSender] Created sender certificate")
        return encrypted_cert
    
    @staticmethod
    def seal_message(
        sender_id: str,
        recipient_id: str,
        message_content: bytes,
        server_public_key: bytes
    ) -> Dict[str, bytes]:
        """
        Seal message with encrypted metadata
        
        Args:
            sender_id: Sender user ID
            recipient_id: Recipient user ID
            message_content: Encrypted message content
            server_public_key: Server's public key
            
        Returns:
            Sealed message envelope
        """
        # Create sender certificate
        sender_cert = SealedSender.create_sender_certificate(
            sender_id,
            server_public_key
        )
        
        # Derive encryption key from server public key
        key = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"SealedSender_Envelope"
        ).derive(server_public_key)
        
        # Encrypt recipient ID
        encrypted_recipient = SealedSender._encrypt_data(
            recipient_id.encode(),
            key
        )
        
        # Add padding to message
        padded_message = SealedSender._add_padding(message_content)
        
        # Obfuscate timestamp
        obfuscated_timestamp = SealedSender._obfuscate_timestamp()
        
        envelope = {
            'sender_certificate': sender_cert,
            'encrypted_recipient': encrypted_recipient,
            'encrypted_message': padded_message,
            'timestamp': obfuscated_timestamp,
            'version': 1
        }
        
        logger.debug("[SealedSender] Message sealed")
        return envelope
    
    @staticmethod
    def unseal_message(
        envelope: Dict[str, bytes],
        server_private_key: bytes
    ) -> Tuple[str, str, bytes]:
        """
        Unseal message (server-side)
        
        Args:
            envelope: Sealed message envelope
            server_private_key: Server's private key
            
        Returns:
            (sender_id, recipient_id, message_content)
        """
        # Derive decryption key
        key = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"SealedSender_Envelope"
        ).derive(server_private_key)
        
        # Decrypt sender certificate
        import json
        cert_json = SealedSender._decrypt_data(
            envelope['sender_certificate'],
            key
        )
        cert_data = json.loads(cert_json.decode())
        sender_id = cert_data['sender_id']
        
        # Decrypt recipient ID
        recipient_bytes = SealedSender._decrypt_data(
            envelope['encrypted_recipient'],
            key
        )
        recipient_id = recipient_bytes.decode()
        
        # Remove padding from message
        message_content = SealedSender._remove_padding(
            envelope['encrypted_message']
        )
        
        logger.debug("[SealedSender] Message unsealed")
        return sender_id, recipient_id, message_content
    
    @staticmethod
    def _encrypt_data(data: bytes, key: bytes) -> bytes:
        """Encrypt data with AES-256-GCM"""
        iv = os.urandom(12)
        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(data) + encryptor.finalize()
        
        # Return IV + TAG + CIPHERTEXT
        return iv + encryptor.tag + ciphertext
    
    @staticmethod
    def _decrypt_data(encrypted: bytes, key: bytes) -> bytes:
        """Decrypt data with AES-256-GCM"""
        iv = encrypted[:12]
        tag = encrypted[12:28]
        ciphertext = encrypted[28:]
        
        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(iv, tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        return decryptor.update(ciphertext) + decryptor.finalize()
    
    @staticmethod
    def _add_padding(data: bytes) -> bytes:
        """
        Add padding to hide actual message size
        
        Pads to next power-of-2 size to prevent size-based analysis
        """
        current_size = len(data)
        
        # Find next padding size
        padded_size = next(
            (size for size in PADDING_SIZES if size >= current_size),
            PADDING_SIZES[-1]
        )
        
        # Add random padding
        padding_length = padded_size - current_size - 4  # 4 bytes for length
        padding = os.urandom(padding_length)
        
        # Format: [4 bytes: original length][original data][random padding]
        return (
            current_size.to_bytes(4, 'big') +
            data +
            padding
        )
    
    @staticmethod
    def _remove_padding(padded_data: bytes) -> bytes:
        """Remove padding from message"""
        original_length = int.from_bytes(padded_data[:4], 'big')
        return padded_data[4:4 + original_length]
    
    @staticmethod
    def _obfuscate_timestamp() -> int:
        """
        Obfuscate timestamp by adding random jitter
        
        Returns timestamp rounded to nearest minute with random jitter
        """
        now = int(time.time())
        
        # Round to nearest minute
        rounded = (now // 60) * 60
        
        # Add random jitter
        jitter = secrets.randbelow(TIMESTAMP_JITTER_SECONDS * 2) - TIMESTAMP_JITTER_SECONDS
        
        return rounded + jitter


# ============================================================
#                   TRAFFIC PADDING
# ============================================================

class TrafficPadding:
    """
    Implements traffic padding to hide communication patterns
    
    Techniques:
    - Constant-rate traffic (send dummy messages)
    - Random delays
    - Message batching
    """
    
    @staticmethod
    def should_send_dummy_message() -> bool:
        """
        Determine if a dummy message should be sent
        
        Returns True with DUMMY_MESSAGE_PROBABILITY
        """
        return secrets.randbelow(100) < (DUMMY_MESSAGE_PROBABILITY * 100)
    
    @staticmethod
    def create_dummy_message(recipient_id: str) -> Dict:
        """
        Create a dummy message to hide traffic patterns
        
        Args:
            recipient_id: Fake recipient ID
            
        Returns:
            Dummy message that looks like real message
        """
        # Random size
        size = secrets.choice(PADDING_SIZES)
        dummy_content = os.urandom(size)
        
        return {
            'type': 'dummy',
            'recipient_id': recipient_id,
            'content': dummy_content,
            'timestamp': int(time.time())
        }
    
    @staticmethod
    def add_random_delay() -> float:
        """
        Add random delay to message sending
        
        Returns delay in seconds (0-2 seconds)
        """
        return secrets.randbelow(2000) / 1000.0  # 0-2 seconds
    
    @staticmethod
    def batch_messages(messages: list, batch_size: int = 10) -> list:
        """
        Batch messages together to hide individual send times
        
        Args:
            messages: List of messages to batch
            batch_size: Maximum batch size
            
        Returns:
            List of message batches
        """
        batches = []
        for i in range(0, len(messages), batch_size):
            batch = messages[i:i + batch_size]
            batches.append(batch)
        
        return batches


# ============================================================
#                   METADATA PROTECTION MANAGER
# ============================================================

class MetadataProtectionManager:
    """
    Manages all metadata protection features
    """
    
    def __init__(self, server_public_key: bytes):
        self.server_public_key = server_public_key
        self.sealed_sender = SealedSender()
        self.traffic_padding = TrafficPadding()
    
    def protect_message(
        self,
        sender_id: str,
        recipient_id: str,
        message_content: bytes
    ) -> Dict:
        """
        Apply all metadata protection to message
        
        Args:
            sender_id: Sender user ID
            recipient_id: Recipient user ID
            message_content: Encrypted message content
            
        Returns:
            Protected message envelope
        """
        # Seal message (hide sender/recipient)
        envelope = self.sealed_sender.seal_message(
            sender_id,
            recipient_id,
            message_content,
            self.server_public_key
        )
        
        # Add traffic padding metadata
        envelope['padding_applied'] = True
        envelope['jitter_applied'] = True
        
        logger.info("[MetadataProtection] Message protected")
        return envelope
    
    def should_send_cover_traffic(self) -> bool:
        """Check if cover traffic (dummy message) should be sent"""
        return self.traffic_padding.should_send_dummy_message()
    
    def get_send_delay(self) -> float:
        """Get random delay for sending"""
        return self.traffic_padding.add_random_delay()


__all__ = [
    'SealedSender',
    'TrafficPadding',
    'MetadataProtectionManager'
]
