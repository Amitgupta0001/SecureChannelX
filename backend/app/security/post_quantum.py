"""
SecureChannelX - Post-Quantum Cryptography Module
-------------------------------------------------
Implements CRYSTALS-Kyber-1024 for quantum-resistant encryption

Features:
- Hybrid KEM (X25519 + Kyber-1024)
- Quantum-resistant key encapsulation
- Backward compatible with classical crypto
- NIST PQC standard compliant
"""

import os
import logging
from typing import Tuple, Optional
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes, serialization

logger = logging.getLogger(__name__)

# Try to import Kyber, fallback to X25519 only if not available
try:
    from pqcrypto.kem.kyber1024 import generate_keypair, encrypt, decrypt
    KYBER_AVAILABLE = True
    logger.info("[PQC] ✅ CRYSTALS-Kyber-1024 available")
except ImportError:
    KYBER_AVAILABLE = False
    logger.warning("[PQC] ⚠️  Kyber not available, using X25519 only")
    logger.warning("[PQC] Install with: pip install pqcrypto")


class PostQuantumKEM:
    """
    Hybrid Key Encapsulation Mechanism
    Combines X25519 (classical) + Kyber-1024 (post-quantum)
    """
    
    @staticmethod
    def generate_keypair() -> dict:
        """
        Generate hybrid keypair (X25519 + Kyber)
        
        Returns:
            dict: {
                'x25519_private': bytes,
                'x25519_public': bytes,
                'kyber_private': bytes (if available),
                'kyber_public': bytes (if available),
                'hybrid': bool
            }
        """
        try:
            # Generate X25519 keypair
            x25519_private = x25519.X25519PrivateKey.generate()
            x25519_public = x25519_private.public_key()
            
            x25519_priv_bytes = x25519_private.private_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PrivateFormat.Raw,
                encryption_algorithm=serialization.NoEncryption()
            )
            
            x25519_pub_bytes = x25519_public.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw
            )
            
            keypair = {
                'x25519_private': x25519_priv_bytes,
                'x25519_public': x25519_pub_bytes,
                'hybrid': False
            }
            
            # Add Kyber if available
            if KYBER_AVAILABLE:
                kyber_public, kyber_private = generate_keypair()
                keypair['kyber_private'] = kyber_private
                keypair['kyber_public'] = kyber_public
                keypair['hybrid'] = True
                logger.debug("[PQC] Generated hybrid keypair (X25519 + Kyber)")
            else:
                logger.debug("[PQC] Generated X25519 keypair only")
            
            return keypair
            
        except Exception as e:
            logger.error(f"[PQC] Keypair generation failed: {e}")
            raise
    
    @staticmethod
    def encapsulate(public_key: dict) -> Tuple[bytes, bytes]:
        """
        Encapsulate shared secret using hybrid KEM
        
        Args:
            public_key: dict with x25519_public and optionally kyber_public
            
        Returns:
            (ciphertext, shared_secret): Encapsulated key and derived secret
        """
        try:
            # X25519 encapsulation
            ephemeral_private = x25519.X25519PrivateKey.generate()
            ephemeral_public = ephemeral_private.public_key()
            
            peer_x25519_public = x25519.X25519PublicKey.from_public_bytes(
                public_key['x25519_public']
            )
            
            x25519_shared = ephemeral_private.exchange(peer_x25519_public)
            
            ephemeral_pub_bytes = ephemeral_public.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw
            )
            
            # Kyber encapsulation if available
            if KYBER_AVAILABLE and 'kyber_public' in public_key:
                kyber_ciphertext, kyber_shared = encrypt(public_key['kyber_public'])
                
                # Combine both shared secrets with HKDF
                combined_shared = x25519_shared + kyber_shared
                
                shared_secret = HKDF(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=None,
                    info=b"SecureChannelX_Hybrid_KEM_v1"
                ).derive(combined_shared)
                
                # Combine ciphertexts: [x25519_ephemeral_pub][kyber_ciphertext]
                ciphertext = ephemeral_pub_bytes + kyber_ciphertext
                
                logger.debug("[PQC] Hybrid encapsulation (X25519 + Kyber)")
            else:
                # X25519 only
                shared_secret = HKDF(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=None,
                    info=b"SecureChannelX_X25519_KEM_v1"
                ).derive(x25519_shared)
                
                ciphertext = ephemeral_pub_bytes
                logger.debug("[PQC] X25519-only encapsulation")
            
            return ciphertext, shared_secret
            
        except Exception as e:
            logger.error(f"[PQC] Encapsulation failed: {e}")
            raise
    
    @staticmethod
    def decapsulate(ciphertext: bytes, private_key: dict) -> bytes:
        """
        Decapsulate shared secret using hybrid KEM
        
        Args:
            ciphertext: Encapsulated key material
            private_key: dict with x25519_private and optionally kyber_private
            
        Returns:
            shared_secret: Derived shared secret
        """
        try:
            # Extract X25519 ephemeral public key (first 32 bytes)
            ephemeral_pub_bytes = ciphertext[:32]
            ephemeral_public = x25519.X25519PublicKey.from_public_bytes(ephemeral_pub_bytes)
            
            # Reconstruct X25519 private key
            x25519_private = x25519.X25519PrivateKey.from_private_bytes(
                private_key['x25519_private']
            )
            
            x25519_shared = x25519_private.exchange(ephemeral_public)
            
            # Kyber decapsulation if available
            if KYBER_AVAILABLE and 'kyber_private' in private_key:
                kyber_ciphertext = ciphertext[32:]  # Rest is Kyber ciphertext
                kyber_shared = decrypt(kyber_ciphertext, private_key['kyber_private'])
                
                # Combine both shared secrets
                combined_shared = x25519_shared + kyber_shared
                
                shared_secret = HKDF(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=None,
                    info=b"SecureChannelX_Hybrid_KEM_v1"
                ).derive(combined_shared)
                
                logger.debug("[PQC] Hybrid decapsulation (X25519 + Kyber)")
            else:
                # X25519 only
                shared_secret = HKDF(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=None,
                    info=b"SecureChannelX_X25519_KEM_v1"
                ).derive(x25519_shared)
                
                logger.debug("[PQC] X25519-only decapsulation")
            
            return shared_secret
            
        except Exception as e:
            logger.error(f"[PQC] Decapsulation failed: {e}")
            raise
    
    @staticmethod
    def is_quantum_resistant() -> bool:
        """Check if post-quantum cryptography is available"""
        return KYBER_AVAILABLE


# Convenience functions
def generate_pqc_keypair() -> dict:
    """Generate post-quantum resistant keypair"""
    return PostQuantumKEM.generate_keypair()


def pqc_encapsulate(public_key: dict) -> Tuple[bytes, bytes]:
    """Encapsulate using post-quantum KEM"""
    return PostQuantumKEM.encapsulate(public_key)


def pqc_decapsulate(ciphertext: bytes, private_key: dict) -> bytes:
    """Decapsulate using post-quantum KEM"""
    return PostQuantumKEM.decapsulate(ciphertext, private_key)


def is_pqc_available() -> bool:
    """Check if post-quantum cryptography is available"""
    return KYBER_AVAILABLE


__all__ = [
    'PostQuantumKEM',
    'generate_pqc_keypair',
    'pqc_encapsulate',
    'pqc_decapsulate',
    'is_pqc_available',
    'KYBER_AVAILABLE'
]
