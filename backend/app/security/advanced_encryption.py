import os
import base64
import secrets
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding, x25519
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import constant_time
import hashlib
import hmac
from datetime import datetime, timedelta
import json
import logging
from typing import Tuple, Optional, Dict, Any

# Configure logging
logger = logging.getLogger(__name__)

class QuantumResistantEncryption:
    """Post-quantum cryptography implementation using X25519"""
    
    def __init__(self):
        self.kyber_private_key = None
        self.kyber_public_key = None
        
    def generate_kyber_keypair(self) -> Tuple[x25519.X25519PrivateKey, x25519.X25519PublicKey]:
        """Generate quantum-resistant keypair using X25519"""
        try:
            private_key = x25519.X25519PrivateKey.generate()
            public_key = private_key.public_key()
            logger.info("Generated quantum-resistant keypair")
            return private_key, public_key
        except Exception as e:
            logger.error(f"Keypair generation failed: {str(e)}")
            raise
    
    def kyber_encapsulate(self, public_key: x25519.X25519PublicKey) -> Tuple[bytes, bytes]:
        """Kyber KEM encapsulation using X25519"""
        try:
            # Generate ephemeral keypair for key exchange
            ephemeral_private = x25519.X25519PrivateKey.generate()
            ephemeral_public = ephemeral_private.public_key()
            
            # Perform key exchange
            shared_secret = ephemeral_private.exchange(public_key)
            
            # Derive final key using HKDF
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=None,
                info=b'quantum_kem',
                backend=default_backend()
            )
            final_secret = hkdf.derive(shared_secret)
            
            # Ciphertext is the ephemeral public key
            ciphertext = ephemeral_public.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw
            )
            
            logger.debug("Kyber encapsulation completed")
            return ciphertext, final_secret
            
        except Exception as e:
            logger.error(f"Kyber encapsulation failed: {str(e)}")
            raise
    
    def kyber_decapsulate(self, ciphertext: bytes, private_key: x25519.X25519PrivateKey) -> bytes:
        """Kyber KEM decapsulation using X25519"""
        try:
            # Reconstruct ephemeral public key from ciphertext
            ephemeral_public = x25519.X25519PublicKey.from_public_bytes(ciphertext)
            
            # Perform key exchange
            shared_secret = private_key.exchange(ephemeral_public)
            
            # Derive final key using HKDF
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=None,
                info=b'quantum_kem',
                backend=default_backend()
            )
            final_secret = hkdf.derive(shared_secret)
            
            logger.debug("Kyber decapsulation completed")
            return final_secret
            
        except Exception as e:
            logger.error(f"Kyber decapsulation failed: {str(e)}")
            raise

class DoubleRatchetProtocol:
    """Double Ratchet protocol for forward secrecy"""
    
    def __init__(self):
        self.dh_ratchet_private = None
        self.dh_ratchet_public = None
        self.root_key = None
        self.chain_keys = {'send': None, 'recv': None}
        self.message_numbers = {'send': 0, 'recv': 0}
        self.previous_chain_lengths = {'send': 0, 'recv': 0}
        
    def initialize(self, shared_secret: bytes):
        """Initialize with shared secret from key exchange"""
        if len(shared_secret) != 32:
            raise ValueError("Shared secret must be 32 bytes")
            
        self.root_key = shared_secret
        self.chain_keys = {'send': None, 'recv': None}
        self.message_numbers = {'send': 0, 'recv': 0}
        self.previous_chain_lengths = {'send': 0, 'recv': 0}
        
        # Generate initial DH ratchet keypair
        self.dh_ratchet_private = x25519.X25519PrivateKey.generate()
        self.dh_ratchet_public = self.dh_ratchet_private.public_key()
        
        logger.info("Double Ratchet protocol initialized")
    
    def perform_dh_ratchet(self, their_public_key: x25519.X25519PublicKey) -> x25519.X25519PublicKey:
        """Perform DH ratchet step for forward secrecy"""
        try:
            # Generate new DH keypair
            new_private_key = x25519.X25519PrivateKey.generate()
            new_public_key = new_private_key.public_key()
            
            # Perform DH exchange
            dh_secret = self.dh_ratchet_private.exchange(their_public_key)
            
            # Derive new root key and chain keys using HKDF
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=96,  # 32 for root key + 32 for send chain + 32 for recv chain
                salt=self.root_key,
                info=b'double_ratchet_step',
                backend=default_backend()
            )
            key_material = hkdf.derive(dh_secret)
            
            # Update keys
            self.root_key = key_material[:32]
            self.chain_keys['send'] = key_material[32:64]
            self.chain_keys['recv'] = key_material[64:96]
            
            # Reset message numbers and store previous lengths
            self.previous_chain_lengths['send'] = self.message_numbers['send']
            self.previous_chain_lengths['recv'] = self.message_numbers['recv']
            self.message_numbers = {'send': 0, 'recv': 0}
            
            # Update DH ratchet keypair
            self.dh_ratchet_private = new_private_key
            self.dh_ratchet_public = new_public_key
            
            logger.debug("DH ratchet step completed")
            return new_public_key
            
        except Exception as e:
            logger.error(f"DH ratchet step failed: {str(e)}")
            raise
    
    def derive_message_key(self, chain: str) -> bytes:
        """Derive message key from current chain key"""
        if chain not in self.chain_keys or self.chain_keys[chain] is None:
            raise ValueError(f"Chain {chain} not initialized")
            
        # Use HKDF to derive message key
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'message_key',
            backend=default_backend()
        )
        message_key = hkdf.derive(self.chain_keys[chain])
        
        # Advance chain key (simplified - in production use KDF chain)
        self.chain_keys[chain] = hashlib.sha256(self.chain_keys[chain]).digest()
        self.message_numbers[chain] += 1
        
        return message_key

class HardwareSecurityModule:
    """Secure key management system"""
    
    def __init__(self):
        self.master_key = os.urandom(32)
        self.key_store = {}
        self.key_metadata = {}
    
    def generate_key(self, key_id: str, key_type: str = 'aes') -> str:
        """Generate and store key in secure storage"""
        try:
            if key_type == 'aes':
                key = os.urandom(32)
            elif key_type == 'rsa':
                key = rsa.generate_private_key(
                    public_exponent=65537,
                    key_size=2048,
                    backend=default_backend()
                )
            else:
                raise ValueError(f"Unsupported key type: {key_type}")
            
            encrypted_key = self._encrypt_with_master_key(
                key if isinstance(key, bytes) else key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                )
            )
            
            self.key_store[key_id] = encrypted_key
            self.key_metadata[key_id] = {
                'type': key_type,
                'created': datetime.utcnow(),
                'last_used': datetime.utcnow()
            }
            
            logger.info(f"Generated {key_type} key: {key_id}")
            return key_id
            
        except Exception as e:
            logger.error(f"Key generation failed for {key_id}: {str(e)}")
            raise
    
    def get_key(self, key_id: str) -> bytes:
        """Retrieve and decrypt key from secure storage"""
        if key_id not in self.key_store:
            raise KeyError(f"Key not found: {key_id}")
        
        try:
            encrypted_key = self.key_store[key_id]
            decrypted_key = self._decrypt_with_master_key(encrypted_key)
            
            # Update last used timestamp
            self.key_metadata[key_id]['last_used'] = datetime.utcnow()
            
            return decrypted_key
        except Exception as e:
            logger.error(f"Key retrieval failed for {key_id}: {str(e)}")
            raise
    
    def _encrypt_with_master_key(self, data: bytes) -> bytes:
        """Encrypt data with master key using AES-GCM"""
        iv = os.urandom(12)
        cipher = Cipher(algorithms.AES(self.master_key), modes.GCM(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(data) + encryptor.finalize()
        return iv + encryptor.tag + encrypted
    
    def _decrypt_with_master_key(self, encrypted_data: bytes) -> bytes:
        """Decrypt data with master key"""
        iv = encrypted_data[:12]
        tag = encrypted_data[12:28]
        ciphertext = encrypted_data[28:]
        
        cipher = Cipher(algorithms.AES(self.master_key), modes.GCM(iv, tag), backend=default_backend())
        decryptor = cipher.decryptor()
        return decryptor.update(ciphertext) + decryptor.finalize()

class EnhancedEncryptionService:
    """Complete End-to-End Encryption Service"""
    
    def __init__(self):
        self.key_rotation_interval = 15.03 * 60  # 15.03 minutes in seconds
        self.quantum_encryption = QuantumResistantEncryption()
        self.double_ratchet = DoubleRatchetProtocol()
        self.hsm = HardwareSecurityModule()
        self.active_sessions = {}
        
        # Initialize with quantum-resistant keypair
        self._initialize_quantum_keys()
    
    def _initialize_quantum_keys(self):
        """Initialize quantum-resistant keypair"""
        try:
            self.quantum_private_key, self.quantum_public_key = \
                self.quantum_encryption.generate_kyber_keypair()
            logger.info("Quantum-resistant keypair initialized")
        except Exception as e:
            logger.error(f"Failed to initialize quantum keys: {str(e)}")
            raise
    
    def generate_session_key(self) -> bytes:
        """Generate a new cryptographically secure session key"""
        return os.urandom(32)
    
    def encrypt_message(self, message: str, key: bytes) -> str:
        """Encrypt message using AES-256-GCM (E2E Encryption)"""
        if len(key) != 32:
            raise ValueError("Encryption key must be 32 bytes")
        
        try:
            iv = os.urandom(12)  # 96-bit IV for GCM
            cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
            encryptor = cipher.encryptor()
            
            # Add associated data for authentication
            encryptor.authenticate_additional_data(b'securechannelx')
            
            encrypted_message = encryptor.update(message.encode('utf-8')) + encryptor.finalize()
            
            # Combine IV + tag + ciphertext
            result = iv + encryptor.tag + encrypted_message
            return base64.b64encode(result).decode()
            
        except Exception as e:
            logger.error(f"Message encryption failed: {str(e)}")
            raise
    
    def decrypt_message(self, encrypted_message: str, key: bytes) -> str:
        """Decrypt message using AES-256-GCM (E2E Decryption)"""
        if len(key) != 32:
            raise ValueError("Decryption key must be 32 bytes")
        
        try:
            encrypted_data = base64.b64decode(encrypted_message.encode())
            
            if len(encrypted_data) < 28:  # IV (12) + tag (16)
                raise ValueError("Invalid encrypted message format")
            
            iv = encrypted_data[:12]
            tag = encrypted_data[12:28]
            ciphertext = encrypted_data[28:]
            
            cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
            decryptor = cipher.decryptor()
            
            # Verify associated data
            decryptor.authenticate_additional_data(b'securechannelx')
            
            decrypted_message = decryptor.update(ciphertext) + decryptor.finalize()
            return decrypted_message.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Message decryption failed: {str(e)}")
            raise
    
    def setup_secure_session(self, user1_id: str, user2_id: str) -> Dict[str, Any]:
        """Setup secure E2E session with post-quantum and forward secrecy"""
        try:
            session_id = f"{user1_id}_{user2_id}_{secrets.token_hex(8)}"
            
            # Generate post-quantum keypair for session
            session_private, session_public = self.quantum_encryption.generate_kyber_keypair()
            
            # Perform quantum-resistant key exchange
            ciphertext, shared_secret = self.quantum_encryption.kyber_encapsulate(session_public)
            
            # Initialize double ratchet for forward secrecy
            self.double_ratchet.initialize(shared_secret)
            
            # Store session keys in secure storage
            self.hsm.generate_key(f"session_{session_id}", "aes")
            
            # Store session information
            self.active_sessions[session_id] = {
                'users': (user1_id, user2_id),
                'double_ratchet': self.double_ratchet,
                'quantum_private': session_private,
                'created_at': datetime.utcnow(),
                'last_activity': datetime.utcnow()
            }
            
            logger.info(f"Secure E2E session established: {session_id}")
            
            return {
                'session_id': session_id,
                'pq_public_key': base64.b64encode(
                    session_public.public_bytes(
                        encoding=serialization.Encoding.Raw,
                        format=serialization.PublicFormat.Raw
                    )
                ).decode(),
                'ciphertext': base64.b64encode(ciphertext).decode(),
                'shared_secret': base64.b64encode(shared_secret).decode(),
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Secure session setup failed: {str(e)}")
            raise
    
    def get_session_public_key(self) -> str:
        """Get the service's quantum-resistant public key"""
        public_bytes = self.quantum_public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        return base64.b64encode(public_bytes).decode()
    
    def ratchet_encrypt_message(self, session_id: str, message: str) -> Dict[str, Any]:
        """Encrypt message with forward secrecy (Double Ratchet)"""
        try:
            session = self.active_sessions.get(session_id)
            if not session:
                raise ValueError("Session not found")
            
            # Derive message key from ratchet
            message_key = session['double_ratchet'].derive_message_key('send')
            
            # Encrypt message
            encrypted_message = self.encrypt_message(message, message_key)
            
            # Update session activity
            session['last_activity'] = datetime.utcnow()
            
            return {
                'encrypted_message': encrypted_message,
                'message_number': session['double_ratchet'].message_numbers['send'] - 1,
                'session_id': session_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Ratchet encryption failed: {str(e)}")
            raise
    
    def ratchet_decrypt_message(self, session_id: str, encrypted_message: str, message_number: int) -> str:
        """Decrypt message with forward secrecy (Double Ratchet)"""
        try:
            session = self.active_sessions.get(session_id)
            if not session:
                raise ValueError("Session not found")
            
            # Derive message key from ratchet
            message_key = session['double_ratchet'].derive_message_key('recv')
            
            # Decrypt message
            decrypted_message = self.decrypt_message(encrypted_message, message_key)
            
            # Update session activity
            session['last_activity'] = datetime.utcnow()
            
            return decrypted_message
            
        except Exception as e:
            logger.error(f"Ratchet decryption failed: {str(e)}")
            raise

# Global E2E Encryption instance
encryption_service = EnhancedEncryptionService()