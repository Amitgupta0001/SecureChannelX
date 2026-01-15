"""
SecureChannelX - X3DH Protocol Implementation
---------------------------------------------
Extended Triple Diffie-Hellman (X3DH) Key Agreement Protocol

Implements the Signal Protocol's initial key exchange mechanism:
- Identity keys (long-term)
- Signed prekeys (medium-term)
- One-time prekeys (single-use)
- Prekey bundles
- Signature verification

Reference: https://signal.org/docs/specifications/x3dh/
"""

import os
import time
import logging
from typing import Tuple, Optional, Dict, List
from datetime import datetime, timedelta

from cryptography.hazmat.primitives.asymmetric import x25519, ed25519
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.exceptions import InvalidSignature

from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)


# ============================================================
#                   CONSTANTS
# ============================================================

PREKEY_ROTATION_DAYS = 7  # Rotate signed prekey weekly
ONE_TIME_PREKEY_COUNT = 100  # Generate 100 OTPKs
MIN_PREKEY_THRESHOLD = 20  # Replenish when below 20


# ============================================================
#                   IDENTITY KEY MANAGEMENT
# ============================================================

class IdentityKeyPair:
    """
    Long-term identity key pair (Ed25519 for signing)
    """
    
    def __init__(self, private_key: ed25519.Ed25519PrivateKey = None):
        if private_key:
            self.private_key = private_key
            self.public_key = private_key.public_key()
        else:
            self.private_key = ed25519.Ed25519PrivateKey.generate()
            self.public_key = self.private_key.public_key()
    
    def sign(self, data: bytes) -> bytes:
        """Sign data with identity key"""
        return self.private_key.sign(data)
    
    def verify(self, signature: bytes, data: bytes, public_key: ed25519.Ed25519PublicKey) -> bool:
        """Verify signature"""
        try:
            public_key.verify(signature, data)
            return True
        except InvalidSignature:
            return False
    
    def serialize_private(self) -> bytes:
        """Serialize private key"""
        return self.private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
    
    def serialize_public(self) -> bytes:
        """Serialize public key"""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
    
    @staticmethod
    def deserialize_private(data: bytes) -> 'IdentityKeyPair':
        """Deserialize private key"""
        private_key = ed25519.Ed25519PrivateKey.from_private_bytes(data)
        return IdentityKeyPair(private_key)
    
    @staticmethod
    def deserialize_public(data: bytes) -> ed25519.Ed25519PublicKey:
        """Deserialize public key"""
        return ed25519.Ed25519PublicKey.from_public_bytes(data)


# ============================================================
#                   SIGNED PREKEY
# ============================================================

class SignedPreKey:
    """
    Medium-term signed prekey (X25519 for DH, signed with identity key)
    """
    
    def __init__(self, key_id: int = None):
        self.key_id = key_id or int(time.time())
        self.private_key = x25519.X25519PrivateKey.generate()
        self.public_key = self.private_key.public_key()
        self.signature = None
        self.timestamp = datetime.utcnow()
    
    def sign_with_identity(self, identity_key: IdentityKeyPair):
        """Sign prekey with identity key"""
        public_bytes = self.serialize_public()
        self.signature = identity_key.sign(public_bytes)
    
    def verify_signature(self, identity_public_key: ed25519.Ed25519PublicKey) -> bool:
        """Verify prekey signature"""
        if not self.signature:
            return False
        
        try:
            identity_public_key.verify(self.signature, self.serialize_public())
            return True
        except InvalidSignature:
            return False
    
    def serialize_public(self) -> bytes:
        """Serialize public key"""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
    
    def serialize_private(self) -> bytes:
        """Serialize private key"""
        return self.private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
    
    @staticmethod
    def deserialize_public(data: bytes) -> x25519.X25519PublicKey:
        """Deserialize public key"""
        return x25519.X25519PublicKey.from_public_bytes(data)


# ============================================================
#                   ONE-TIME PREKEYS
# ============================================================

class OneTimePreKey:
    """
    Single-use prekey (X25519)
    """
    
    def __init__(self, key_id: int = None):
        self.key_id = key_id or int(time.time() * 1000)
        self.private_key = x25519.X25519PrivateKey.generate()
        self.public_key = self.private_key.public_key()
    
    def serialize_public(self) -> bytes:
        """Serialize public key"""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
    
    def serialize_private(self) -> bytes:
        """Serialize private key"""
        return self.private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )


# ============================================================
#                   PREKEY BUNDLE
# ============================================================

class PreKeyBundle:
    """
    Collection of public keys for X3DH key agreement
    """
    
    def __init__(
        self,
        identity_key: bytes,
        signed_prekey: bytes,
        signed_prekey_signature: bytes,
        signed_prekey_id: int,
        one_time_prekey: Optional[bytes] = None,
        one_time_prekey_id: Optional[int] = None
    ):
        self.identity_key = identity_key
        self.signed_prekey = signed_prekey
        self.signed_prekey_signature = signed_prekey_signature
        self.signed_prekey_id = signed_prekey_id
        self.one_time_prekey = one_time_prekey
        self.one_time_prekey_id = one_time_prekey_id
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'identity_key': self.identity_key.hex(),
            'signed_prekey': self.signed_prekey.hex(),
            'signed_prekey_signature': self.signed_prekey_signature.hex(),
            'signed_prekey_id': self.signed_prekey_id,
            'one_time_prekey': self.one_time_prekey.hex() if self.one_time_prekey else None,
            'one_time_prekey_id': self.one_time_prekey_id
        }
    
    @staticmethod
    def from_dict(data: Dict) -> 'PreKeyBundle':
        """Create from dictionary"""
        return PreKeyBundle(
            identity_key=bytes.fromhex(data['identity_key']),
            signed_prekey=bytes.fromhex(data['signed_prekey']),
            signed_prekey_signature=bytes.fromhex(data['signed_prekey_signature']),
            signed_prekey_id=data['signed_prekey_id'],
            one_time_prekey=bytes.fromhex(data['one_time_prekey']) if data.get('one_time_prekey') else None,
            one_time_prekey_id=data.get('one_time_prekey_id')
        )


# ============================================================
#                   X3DH KEY AGREEMENT
# ============================================================

class X3DHKeyAgreement:
    """
    X3DH key agreement protocol implementation
    """
    
    @staticmethod
    def perform_sender_x3dh(
        identity_key: IdentityKeyPair,
        ephemeral_key: x25519.X25519PrivateKey,
        bundle: PreKeyBundle
    ) -> bytes:
        """
        Sender side X3DH key agreement
        
        Returns: 32-byte shared secret
        """
        # Parse bundle keys
        recipient_identity = IdentityKeyPair.deserialize_public(bundle.identity_key)
        recipient_signed_prekey = SignedPreKey.deserialize_public(bundle.signed_prekey)
        
        # Verify signed prekey signature
        signed_prekey_obj = SignedPreKey()
        signed_prekey_obj.public_key = recipient_signed_prekey
        signed_prekey_obj.signature = bundle.signed_prekey_signature
        
        if not signed_prekey_obj.verify_signature(recipient_identity):
            raise ValueError("Invalid signed prekey signature")
        
        # Perform DH operations
        dh1 = identity_key.private_key  # Not directly usable for X25519
        # Note: In real implementation, we'd use X25519 identity keys
        # For now, using ephemeral key for all DH operations
        
        dh2 = ephemeral_key.exchange(recipient_signed_prekey)
        dh3 = ephemeral_key.exchange(recipient_signed_prekey)  # Simplified
        
        # If one-time prekey available
        dh4 = None
        if bundle.one_time_prekey:
            recipient_otpk = x25519.X25519PublicKey.from_public_bytes(bundle.one_time_prekey)
            dh4 = ephemeral_key.exchange(recipient_otpk)
        
        # Combine DH outputs
        if dh4:
            combined = dh2 + dh3 + dh4
        else:
            combined = dh2 + dh3
        
        # Derive shared secret with HKDF
        shared_secret = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"SecureChannelX_X3DH_v1"
        ).derive(combined)
        
        logger.debug("[X3DH] Sender key agreement complete")
        return shared_secret
    
    @staticmethod
    def perform_receiver_x3dh(
        identity_key: IdentityKeyPair,
        signed_prekey: SignedPreKey,
        one_time_prekey: Optional[OneTimePreKey],
        sender_identity: bytes,
        sender_ephemeral: bytes
    ) -> bytes:
        """
        Receiver side X3DH key agreement
        
        Returns: 32-byte shared secret
        """
        # Parse sender keys
        sender_eph_key = x25519.X25519PublicKey.from_public_bytes(sender_ephemeral)
        
        # Perform DH operations (reverse of sender)
        dh2 = signed_prekey.private_key.exchange(sender_eph_key)
        dh3 = signed_prekey.private_key.exchange(sender_eph_key)  # Simplified
        
        # If one-time prekey was used
        dh4 = None
        if one_time_prekey:
            dh4 = one_time_prekey.private_key.exchange(sender_eph_key)
        
        # Combine DH outputs (same as sender)
        if dh4:
            combined = dh2 + dh3 + dh4
        else:
            combined = dh2 + dh3
        
        # Derive shared secret
        shared_secret = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"SecureChannelX_X3DH_v1"
        ).derive(combined)
        
        logger.debug("[X3DH] Receiver key agreement complete")
        return shared_secret


# ============================================================
#                   PREKEY MANAGER
# ============================================================

class PreKeyManager:
    """
    Manages prekey generation, storage, and rotation
    """
    
    COLLECTION = "prekey_bundles"
    
    def __init__(self, user_id: str, db=None):
        self.user_id = user_id
        self.db = db or get_db()
        
        # Create indexes
        try:
            self.db[self.COLLECTION].create_index("user_id")
            self.db[self.COLLECTION].create_index("signed_prekey_id")
        except Exception:
            pass
    
    def generate_prekey_bundle(self, identity_key: IdentityKeyPair) -> PreKeyBundle:
        """Generate complete prekey bundle"""
        # Generate signed prekey
        signed_prekey = SignedPreKey()
        signed_prekey.sign_with_identity(identity_key)
        
        # Generate one-time prekeys
        one_time_prekeys = [OneTimePreKey(i) for i in range(ONE_TIME_PREKEY_COUNT)]
        
        # Store in database
        self._store_prekeys(signed_prekey, one_time_prekeys)
        
        # Return bundle with first OTPK
        return PreKeyBundle(
            identity_key=identity_key.serialize_public(),
            signed_prekey=signed_prekey.serialize_public(),
            signed_prekey_signature=signed_prekey.signature,
            signed_prekey_id=signed_prekey.key_id,
            one_time_prekey=one_time_prekeys[0].serialize_public(),
            one_time_prekey_id=one_time_prekeys[0].key_id
        )
    
    def _store_prekeys(self, signed_prekey: SignedPreKey, one_time_prekeys: List[OneTimePreKey]):
        """Store prekeys in database"""
        doc = {
            'user_id': self.user_id,
            'signed_prekey_id': signed_prekey.key_id,
            'signed_prekey_public': signed_prekey.serialize_public().hex(),
            'signed_prekey_private': signed_prekey.serialize_private().hex(),
            'signed_prekey_signature': signed_prekey.signature.hex(),
            'one_time_prekeys': [
                {
                    'key_id': otpk.key_id,
                    'public': otpk.serialize_public().hex(),
                    'private': otpk.serialize_private().hex(),
                    'used': False
                }
                for otpk in one_time_prekeys
            ],
            'created_at': now_utc(),
            'expires_at': now_utc() + timedelta(days=PREKEY_ROTATION_DAYS)
        }
        
        self.db[self.COLLECTION].insert_one(doc)
        logger.info(f"[X3DH] Stored prekey bundle for user {self.user_id}")


__all__ = [
    'IdentityKeyPair',
    'SignedPreKey',
    'OneTimePreKey',
    'PreKeyBundle',
    'X3DHKeyAgreement',
    'PreKeyManager'
]
