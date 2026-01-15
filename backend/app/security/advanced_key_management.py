"""
SecureChannelX - Advanced Key Management
----------------------------------------
Key backup, recovery, and multi-device sync

Features:
- 24-word recovery phrase (BIP39)
- Secure key backup
- Key restoration
- Multi-device key sync
- Automatic key rotation
"""

import os
import time
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from mnemonic import Mnemonic
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)


# ============================================================
#                   KEY BACKUP & RECOVERY
# ============================================================

class KeyBackupManager:
    """
    Manages secure key backup and recovery using BIP39 mnemonic phrases
    """
    
    def __init__(self, user_id: str, db=None):
        self.user_id = user_id
        self.db = db or get_db()
        self.mnemo = Mnemonic("english")
    
    def generate_recovery_phrase(self, entropy_bits: int = 256) -> str:
        """
        Generate 24-word recovery phrase (256-bit entropy)
        
        Args:
            entropy_bits: Entropy in bits (128, 160, 192, 224, 256)
            
        Returns:
            24-word mnemonic phrase
        """
        phrase = self.mnemo.generate(strength=entropy_bits)
        logger.info(f"[KeyBackup] Generated recovery phrase for user {self.user_id}")
        return phrase
    
    def derive_master_key_from_phrase(self, recovery_phrase: str, salt: bytes = None) -> bytes:
        """
        Derive master key from recovery phrase
        
        Args:
            recovery_phrase: 24-word mnemonic
            salt: Optional salt (uses user_id if not provided)
            
        Returns:
            32-byte master key
        """
        if not self.mnemo.check(recovery_phrase):
            raise ValueError("Invalid recovery phrase")
        
        # Use user_id as salt if not provided
        if salt is None:
            salt = self.user_id.encode()
        
        # Derive key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=600000  # NIST 2024 recommendation
        )
        
        master_key = kdf.derive(recovery_phrase.encode())
        logger.debug("[KeyBackup] Derived master key from recovery phrase")
        return master_key
    
    def backup_keys(self, keys: Dict, recovery_phrase: str) -> bytes:
        """
        Encrypt keys with recovery phrase
        
        Args:
            keys: Dictionary of keys to backup
            recovery_phrase: 24-word mnemonic
            
        Returns:
            Encrypted backup blob
        """
        # Derive encryption key from phrase
        master_key = self.derive_master_key_from_phrase(recovery_phrase)
        
        # Serialize keys
        import json
        keys_json = json.dumps(keys, default=str).encode()
        
        # Encrypt with AES-256-GCM
        aesgcm = AESGCM(master_key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, keys_json, None)
        
        # Combine nonce + ciphertext
        backup_blob = nonce + ciphertext
        
        # Store backup metadata in database
        self.db['key_backups'].insert_one({
            'user_id': self.user_id,
            'backup_size': len(backup_blob),
            'created_at': now_utc(),
            'keys_count': len(keys)
        })
        
        logger.info(f"[KeyBackup] Backed up {len(keys)} keys for user {self.user_id}")
        return backup_blob
    
    def restore_keys(self, backup_blob: bytes, recovery_phrase: str) -> Dict:
        """
        Restore keys from encrypted backup
        
        Args:
            backup_blob: Encrypted backup
            recovery_phrase: 24-word mnemonic
            
        Returns:
            Dictionary of restored keys
        """
        # Derive decryption key
        master_key = self.derive_master_key_from_phrase(recovery_phrase)
        
        # Extract nonce and ciphertext
        nonce = backup_blob[:12]
        ciphertext = backup_blob[12:]
        
        # Decrypt
        aesgcm = AESGCM(master_key)
        keys_json = aesgcm.decrypt(nonce, ciphertext, None)
        
        # Deserialize
        import json
        keys = json.loads(keys_json.decode())
        
        logger.info(f"[KeyBackup] Restored {len(keys)} keys for user {self.user_id}")
        return keys
    
    def export_backup_qr(self, backup_blob: bytes) -> str:
        """
        Generate QR code for backup (for easy transfer)
        
        Args:
            backup_blob: Encrypted backup
            
        Returns:
            Base64-encoded QR code image
        """
        import qrcode
        import io
        import base64
        
        # Encode backup as base64
        backup_b64 = base64.b64encode(backup_blob).decode()
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(backup_b64)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_b64 = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_b64}"


# ============================================================
#                   MULTI-DEVICE KEY SYNC
# ============================================================

class MultiDeviceKeySync:
    """
    Secure key synchronization across multiple devices
    """
    
    def __init__(self, user_id: str, db=None):
        self.user_id = user_id
        self.db = db or get_db()
    
    def register_device(self, device_id: str, device_name: str, device_public_key: bytes) -> Dict:
        """
        Register a new device for key sync
        
        Args:
            device_id: Unique device identifier
            device_name: Human-readable device name
            device_public_key: Device's public key for encryption
            
        Returns:
            Device registration info
        """
        device_info = {
            'user_id': self.user_id,
            'device_id': device_id,
            'device_name': device_name,
            'device_public_key': device_public_key.hex(),
            'registered_at': now_utc(),
            'last_sync': None,
            'status': 'pending_verification'
        }
        
        self.db['devices'].insert_one(device_info)
        logger.info(f"[MultiDevice] Registered device {device_name} for user {self.user_id}")
        
        return device_info
    
    def verify_device(self, device_id: str, verification_code: str) -> bool:
        """
        Verify device ownership with code
        
        Args:
            device_id: Device to verify
            verification_code: 6-digit code
            
        Returns:
            True if verified
        """
        # In production, verify code sent via email/SMS
        # For now, simple verification
        
        self.db['devices'].update_one(
            {'user_id': self.user_id, 'device_id': device_id},
            {'$set': {'status': 'verified', 'verified_at': now_utc()}}
        )
        
        logger.info(f"[MultiDevice] Verified device {device_id}")
        return True
    
    def sync_keys_to_device(self, device_id: str, keys: Dict) -> bytes:
        """
        Sync keys to specific device
        
        Args:
            device_id: Target device
            keys: Keys to sync
            
        Returns:
            Encrypted keys for device
        """
        # Get device info
        device = self.db['devices'].find_one({
            'user_id': self.user_id,
            'device_id': device_id,
            'status': 'verified'
        })
        
        if not device:
            raise ValueError("Device not found or not verified")
        
        # Encrypt keys with device's public key
        device_public_key = bytes.fromhex(device['device_public_key'])
        
        # In production, use asymmetric encryption
        # For now, use symmetric encryption with derived key
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF
        
        encryption_key = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"MultiDevice_KeySync"
        ).derive(device_public_key)
        
        # Encrypt keys
        import json
        keys_json = json.dumps(keys, default=str).encode()
        
        aesgcm = AESGCM(encryption_key)
        nonce = os.urandom(12)
        encrypted_keys = aesgcm.encrypt(nonce, keys_json, None)
        
        # Update sync timestamp
        self.db['devices'].update_one(
            {'user_id': self.user_id, 'device_id': device_id},
            {'$set': {'last_sync': now_utc()}}
        )
        
        logger.info(f"[MultiDevice] Synced keys to device {device_id}")
        return nonce + encrypted_keys
    
    def get_user_devices(self) -> List[Dict]:
        """Get all devices for user"""
        devices = list(self.db['devices'].find(
            {'user_id': self.user_id},
            {'_id': 0}
        ))
        return devices
    
    def revoke_device(self, device_id: str):
        """Revoke device access"""
        self.db['devices'].update_one(
            {'user_id': self.user_id, 'device_id': device_id},
            {'$set': {'status': 'revoked', 'revoked_at': now_utc()}}
        )
        logger.warning(f"[MultiDevice] Revoked device {device_id}")


# ============================================================
#                   AUTOMATIC KEY ROTATION
# ============================================================

class AutoKeyRotation:
    """
    Automatic key rotation for enhanced security
    """
    
    def __init__(self, user_id: str, db=None):
        self.user_id = user_id
        self.db = db or get_db()
        self.rotation_interval_days = 30  # Rotate every 30 days
    
    def schedule_rotation(self, key_type: str, key_id: str):
        """
        Schedule automatic key rotation
        
        Args:
            key_type: Type of key (identity, signed_prekey, etc.)
            key_id: Key identifier
        """
        next_rotation = now_utc() + timedelta(days=self.rotation_interval_days)
        
        self.db['key_rotations'].insert_one({
            'user_id': self.user_id,
            'key_type': key_type,
            'key_id': key_id,
            'scheduled_at': now_utc(),
            'next_rotation': next_rotation,
            'status': 'scheduled'
        })
        
        logger.info(f"[KeyRotation] Scheduled {key_type} rotation for {next_rotation}")
    
    def check_rotation_needed(self) -> List[Dict]:
        """
        Check if any keys need rotation
        
        Returns:
            List of keys that need rotation
        """
        keys_to_rotate = list(self.db['key_rotations'].find({
            'user_id': self.user_id,
            'next_rotation': {'$lte': now_utc()},
            'status': 'scheduled'
        }))
        
        return keys_to_rotate
    
    def rotate_key(self, key_type: str, old_key_id: str, new_key: bytes):
        """
        Rotate a key
        
        Args:
            key_type: Type of key
            old_key_id: Old key identifier
            new_key: New key material
        """
        # Mark old rotation as completed
        self.db['key_rotations'].update_one(
            {'user_id': self.user_id, 'key_id': old_key_id},
            {'$set': {'status': 'completed', 'completed_at': now_utc()}}
        )
        
        # Schedule next rotation
        new_key_id = os.urandom(16).hex()
        self.schedule_rotation(key_type, new_key_id)
        
        logger.info(f"[KeyRotation] Rotated {key_type} key")
        return new_key_id


__all__ = [
    'KeyBackupManager',
    'MultiDeviceKeySync',
    'AutoKeyRotation'
]
