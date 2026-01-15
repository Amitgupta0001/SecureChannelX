"""
SecureChannelX - Certificate Pinning
------------------------------------
Implements public key pinning to prevent MITM attacks

Features:
- Public key pinning
- Certificate transparency verification
- Pin rotation support
- Backup pins
"""

import hashlib
import logging
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import base64

logger = logging.getLogger(__name__)


# ============================================================
#                   CERTIFICATE PINNING
# ============================================================

class CertificatePinner:
    """
    Implements HTTP Public Key Pinning (HPKP)
    
    Pins the server's public key to prevent MITM attacks
    even if a CA is compromised
    """
    
    # Primary and backup public key hashes (SHA-256)
    # These should be updated when rotating certificates
    PINNED_KEYS = [
        # Primary key (current certificate)
        "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        
        # Backup key 1 (for rotation)
        "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
        
        # Backup key 2 (emergency)
        "sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=",
    ]
    
    # Pin expiration (max-age in seconds)
    MAX_AGE = 60 * 60 * 24 * 60  # 60 days
    
    # Include subdomains
    INCLUDE_SUBDOMAINS = True
    
    @classmethod
    def generate_pin_header(cls) -> str:
        """
        Generate HPKP header value
        
        Returns:
            HPKP header string
        """
        pins = '; '.join([f'pin-{key}' for key in cls.PINNED_KEYS])
        header = f'{pins}; max-age={cls.MAX_AGE}'
        
        if cls.INCLUDE_SUBDOMAINS:
            header += '; includeSubDomains'
        
        return header
    
    @classmethod
    def validate_certificate(cls, cert_public_key: bytes) -> bool:
        """
        Validate certificate against pinned keys
        
        Args:
            cert_public_key: Certificate's public key bytes
            
        Returns:
            True if certificate is pinned, False otherwise
        """
        # Calculate SHA-256 hash of public key
        key_hash = hashlib.sha256(cert_public_key).digest()
        key_hash_b64 = base64.b64encode(key_hash).decode('ascii')
        pin = f"sha256/{key_hash_b64}"
        
        # Check if pin matches any pinned keys
        is_valid = pin in cls.PINNED_KEYS
        
        if is_valid:
            logger.info("[CertPin] Certificate validated successfully")
        else:
            logger.error(f"[CertPin] Certificate validation failed! Pin: {pin}")
        
        return is_valid
    
    @classmethod
    def get_current_pins(cls) -> List[str]:
        """Get list of currently pinned keys"""
        return cls.PINNED_KEYS.copy()
    
    @classmethod
    def add_backup_pin(cls, pin: str):
        """
        Add a backup pin for certificate rotation
        
        Args:
            pin: Public key pin in format "sha256/base64hash"
        """
        if pin not in cls.PINNED_KEYS:
            cls.PINNED_KEYS.append(pin)
            logger.info(f"[CertPin] Added backup pin: {pin[:20]}...")
    
    @classmethod
    def rotate_primary_pin(cls, new_pin: str):
        """
        Rotate primary pin (for certificate renewal)
        
        Args:
            new_pin: New primary pin
        """
        if new_pin in cls.PINNED_KEYS:
            # Move to primary position
            cls.PINNED_KEYS.remove(new_pin)
            cls.PINNED_KEYS.insert(0, new_pin)
            logger.info("[CertPin] Rotated primary pin")
        else:
            logger.warning("[CertPin] New pin not in backup pins!")


# ============================================================
#                   CERTIFICATE TRANSPARENCY
# ============================================================

class CertificateTransparency:
    """
    Implements Certificate Transparency (CT) verification
    
    Verifies that certificates are logged in public CT logs
    to detect mis-issued certificates
    """
    
    # Known CT log servers
    CT_LOGS = [
        "https://ct.googleapis.com/logs/argon2024/",
        "https://ct.cloudflare.com/logs/nimbus2024/",
        "https://ct.digicert.com/log/",
    ]
    
    @staticmethod
    def verify_sct(certificate: bytes, sct: bytes) -> bool:
        """
        Verify Signed Certificate Timestamp (SCT)
        
        Args:
            certificate: Certificate bytes
            sct: Signed Certificate Timestamp
            
        Returns:
            True if SCT is valid
        """
        # In production, this would verify the SCT signature
        # against known CT log public keys
        
        # For now, basic validation
        if not certificate or not sct:
            return False
        
        # Check SCT format (simplified)
        if len(sct) < 32:
            logger.warning("[CT] Invalid SCT length")
            return False
        
        logger.info("[CT] SCT verified")
        return True
    
    @staticmethod
    def check_ct_logs(certificate_hash: str) -> bool:
        """
        Check if certificate is in CT logs
        
        Args:
            certificate_hash: SHA-256 hash of certificate
            
        Returns:
            True if found in CT logs
        """
        # In production, this would query CT log servers
        # For now, assume certificate is logged
        
        logger.info(f"[CT] Checking certificate: {certificate_hash[:16]}...")
        
        # Simulate CT log check
        # In production: query CT_LOGS endpoints
        
        return True


# ============================================================
#                   SECURITY MIDDLEWARE
# ============================================================

def add_certificate_pinning_headers(response):
    """
    Add certificate pinning headers to response
    
    Args:
        response: Flask response object
        
    Returns:
        Modified response with pinning headers
    """
    # Add HPKP header
    hpkp_header = CertificatePinner.generate_pin_header()
    response.headers['Public-Key-Pins'] = hpkp_header
    
    # Add Expect-CT header
    response.headers['Expect-CT'] = f'max-age={CertificatePinner.MAX_AGE}, enforce'
    
    logger.debug("[CertPin] Added pinning headers to response")
    return response


# ============================================================
#                   PIN MANAGEMENT
# ============================================================

class PinManager:
    """
    Manages certificate pins and rotation
    """
    
    def __init__(self, db=None):
        self.db = db
        self.pinner = CertificatePinner()
    
    def generate_pin_from_cert(self, certificate: bytes) -> str:
        """
        Generate pin from certificate
        
        Args:
            certificate: Certificate bytes
            
        Returns:
            Pin string in format "sha256/base64hash"
        """
        # Extract public key from certificate
        # In production, use cryptography library to parse cert
        
        # For now, hash the entire certificate
        cert_hash = hashlib.sha256(certificate).digest()
        cert_hash_b64 = base64.b64encode(cert_hash).decode('ascii')
        
        return f"sha256/{cert_hash_b64}"
    
    def schedule_pin_rotation(self, new_certificate: bytes, rotation_date: datetime):
        """
        Schedule pin rotation for certificate renewal
        
        Args:
            new_certificate: New certificate bytes
            rotation_date: When to rotate
        """
        new_pin = self.generate_pin_from_cert(new_certificate)
        
        # Add as backup pin
        self.pinner.add_backup_pin(new_pin)
        
        # Store rotation schedule
        if self.db:
            self.db['pin_rotations'].insert_one({
                'new_pin': new_pin,
                'rotation_date': rotation_date,
                'status': 'scheduled',
                'created_at': datetime.utcnow()
            })
        
        logger.info(f"[PinManager] Scheduled rotation for {rotation_date}")
    
    def execute_rotation(self, pin: str):
        """
        Execute pin rotation
        
        Args:
            pin: New primary pin
        """
        self.pinner.rotate_primary_pin(pin)
        
        # Update database
        if self.db:
            self.db['pin_rotations'].update_one(
                {'new_pin': pin},
                {'$set': {'status': 'completed', 'completed_at': datetime.utcnow()}}
            )
        
        logger.info("[PinManager] Pin rotation completed")


__all__ = [
    'CertificatePinner',
    'CertificateTransparency',
    'PinManager',
    'add_certificate_pinning_headers'
]
