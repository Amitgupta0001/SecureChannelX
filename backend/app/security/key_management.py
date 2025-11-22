# app/security/key_management.py

import os
import base64
import secrets
from datetime import datetime, timedelta

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

from app.database import get_db
from app.security.advanced_encryption import encryption_service


class KeyManagementService:
    """
    SecureChannelX Key Management System
    -----------------------------------

    - Generates AES-256 session keys
    - Stores & rotates them in MongoDB
    - Integrates with PQC + Double Ratchet
    - Provides AES-GCM authenticated encryption
    - Automatically rotates expired keys
    """

    KEY_ROTATION_MINUTES = 15       # Each AES key lives 15 minutes
    SESSION_EXPIRY_HOURS = 24       # Mongo cleanup TTL

    def __init__(self):
        pass

    # -------------------------------------------------------------
    # 1. SESSION KEY GENERATION
    # -------------------------------------------------------------
    def generate_session_key(self):
        """Return a secure 32-byte AES-256 key."""
        return os.urandom(32)

    def create_new_session(self, user_id):
        """Create brand-new session and store in MongoDB."""

        db = get_db()

        key = self.generate_session_key()
        key_hex = key.hex()

        record = {
            "user_id": str(user_id),
            "session_key": key_hex,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=self.KEY_ROTATION_MINUTES),
            "is_active": True
        }

        db.session_keys.insert_one(record)
        return key_hex

    # -------------------------------------------------------------
    # 2. KEY RETRIEVAL (AUTO-ROTATE)
    # -------------------------------------------------------------
    def get_latest_active_key(self, user_id):
        """Fetch latest valid key; auto-rotate if expired."""

        db = get_db()

        key_doc = db.session_keys.find_one(
            {"user_id": str(user_id), "is_active": True},
            sort=[("created_at", -1)]
        )

        if not key_doc:
            return self.create_new_session(user_id)

        if key_doc["expires_at"] <= datetime.utcnow():
            # rotate
            self.deactivate_user_keys(user_id)
            return self.create_new_session(user_id)

        return key_doc["session_key"]

    # -------------------------------------------------------------
    # 3. DEACTIVATE KEYS
    # -------------------------------------------------------------
    def deactivate_user_keys(self, user_id):
        db = get_db()
        db.session_keys.update_many(
            {"user_id": str(user_id)},
            {"$set": {"is_active": False}}
        )

    # -------------------------------------------------------------
    # 4. AES-256-GCM ENCRYPTION
    # -------------------------------------------------------------
    def encrypt_with_aes(self, plaintext, key_hex):
        """AES-256-GCM authenticated encryption."""

        if not isinstance(key_hex, str) or len(key_hex) != 64:
            raise ValueError("Invalid AES key: must be 64-char hex")

        key = bytes.fromhex(key_hex)
        iv = os.urandom(12)

        cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
        encryptor = cipher.encryptor()

        encryptor.authenticate_additional_data(b"securechannelx")

        if isinstance(plaintext, str):
            plaintext = plaintext.encode()

        ciphertext = encryptor.update(plaintext) + encryptor.finalize()

        packet = iv + encryptor.tag + ciphertext
        return base64.b64encode(packet).decode()

    # -------------------------------------------------------------
    # 5. AES-256-GCM DECRYPTION
    # -------------------------------------------------------------
    def decrypt_with_aes(self, encrypted_text, key_hex):
        """AES-256-GCM decryption with authentication."""

        if not isinstance(key_hex, str) or len(key_hex) != 64:
            raise ValueError("Invalid AES key: must be 64-char hex")

        key = bytes.fromhex(key_hex)
        raw = base64.b64decode(encrypted_text)

        if len(raw) < 28:
            raise ValueError("Invalid ciphertext")

        iv = raw[:12]
        tag = raw[12:28]
        ciphertext = raw[28:]

        cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
        decryptor = cipher.decryptor()
        decryptor.authenticate_additional_data(b"securechannelx")

        try:
            plaintext = decryptor.update(ciphertext) + decryptor.finalize()
            return plaintext.decode()
        except Exception:
            raise ValueError("Message authentication failed (tampered or wrong key)")

    # -------------------------------------------------------------
    # 6. POST-QUANTUM + DOUBLE-RATCHET SESSION
    # -------------------------------------------------------------
    def create_post_quantum_session(self, user1, user2):
        """Creates full PQC+Ratchet FWD-secure E2E session."""
        return encryption_service.setup_secure_session(user1, user2)

    def ratchet_encrypt(self, session_id, message):
        """Encrypt FWD-secure message."""
        return encryption_service.ratchet_encrypt_message(session_id, message)

    def ratchet_decrypt(self, session_id, encrypted_message, msg_num):
        """Decrypt FWD-secure message."""
        return encryption_service.ratchet_decrypt_message(session_id, encrypted_message, msg_num)

    # -------------------------------------------------------------
    # 7. Clean expired keys
    # -------------------------------------------------------------
    def cleanup_expired(self):
        """Delete keys older than 24h (safety)."""
        db = get_db()
        threshold = datetime.utcnow() - timedelta(hours=self.SESSION_EXPIRY_HOURS)
        db.session_keys.delete_many({"created_at": {"$lt": threshold}})


# GLOBAL KMS
kms = KeyManagementService()

__all__ = ["kms", "KeyManagementService"]
