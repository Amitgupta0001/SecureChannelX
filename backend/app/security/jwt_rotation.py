"""
JWT Secret Rotation System
Implements automatic JWT secret rotation with zero-downtime
"""

import os
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import threading
import time

from app.database import get_db
from app.utils.helpers import now_utc

logger = logging.getLogger(__name__)

# Configuration
ROTATION_INTERVAL = timedelta(days=30)  # Rotate every 30 days
GRACE_PERIOD = timedelta(days=7)  # Old secrets valid for 7 days after rotation
MAX_SECRETS = 5  # Keep last 5 secrets for validation


class JWTSecretManager:
    """
    Manages JWT secret rotation with zero-downtime
    
    Features:
    - Automatic secret rotation
    - Grace period for old tokens
    - Multiple secret validation
    - Secure secret generation
    - Audit logging
    """
    
    COLLECTION = "jwt_secrets"
    
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()
        self._lock = threading.Lock()
        self._current_secret = None
        self._valid_secrets = []
        
        # Initialize
        self._initialize()
        
        # Start rotation thread
        self._start_rotation_thread()
    
    def _initialize(self):
        """Initialize secret manager"""
        try:
            # Create index
            self.db[self.COLLECTION].create_index("created_at")
            self.db[self.COLLECTION].create_index("expires_at")
            self.db[self.COLLECTION].create_index("is_active")
            
            # Load current secret
            self._load_secrets()
            
            # Create initial secret if none exists
            if not self._current_secret:
                self._rotate_secret()
            
            logger.info("[JWT-ROTATION] Secret manager initialized")
        
        except Exception as e:
            logger.error(f"[JWT-ROTATION] Initialization failed: {e}")
            raise
    
    def _generate_secret(self, length: int = 64) -> str:
        """Generate cryptographically secure secret"""
        return secrets.token_urlsafe(length)
    
    def _load_secrets(self):
        """Load active secrets from database"""
        try:
            with self._lock:
                # Get current active secret
                current = self.db[self.COLLECTION].find_one(
                    {"is_active": True},
                    sort=[("created_at", -1)]
                )
                
                if current:
                    self._current_secret = current["secret"]
                
                # Get all valid secrets (including grace period)
                cutoff = now_utc()
                valid_docs = self.db[self.COLLECTION].find(
                    {"expires_at": {"$gt": cutoff}},
                    sort=[("created_at", -1)]
                ).limit(MAX_SECRETS)
                
                self._valid_secrets = [doc["secret"] for doc in valid_docs]
                
                logger.info(f"[JWT-ROTATION] Loaded {len(self._valid_secrets)} valid secrets")
        
        except Exception as e:
            logger.error(f"[JWT-ROTATION] Failed to load secrets: {e}")
    
    def _rotate_secret(self):
        """Rotate JWT secret"""
        try:
            with self._lock:
                # Generate new secret
                new_secret = self._generate_secret()
                created_at = now_utc()
                expires_at = created_at + ROTATION_INTERVAL + GRACE_PERIOD
                
                # Deactivate old secrets
                self.db[self.COLLECTION].update_many(
                    {"is_active": True},
                    {"$set": {"is_active": False}}
                )
                
                # Store new secret
                self.db[self.COLLECTION].insert_one({
                    "secret": new_secret,
                    "created_at": created_at,
                    "expires_at": expires_at,
                    "is_active": True,
                    "rotated_by": "automatic",
                    "version": 2
                })
                
                # Update current secret
                self._current_secret = new_secret
                
                # Reload valid secrets
                self._load_secrets()
                
                # Clean up old secrets
                self._cleanup_old_secrets()
                
                logger.info(f"[JWT-ROTATION] Secret rotated successfully")
                
                # Log to audit
                self._audit_log("SECRET_ROTATED", {
                    "created_at": created_at.isoformat(),
                    "expires_at": expires_at.isoformat()
                })
        
        except Exception as e:
            logger.error(f"[JWT-ROTATION] Rotation failed: {e}")
            self._audit_log("SECRET_ROTATION_FAILED", {"error": str(e)})
    
    def _cleanup_old_secrets(self):
        """Remove expired secrets"""
        try:
            cutoff = now_utc()
            result = self.db[self.COLLECTION].delete_many(
                {"expires_at": {"$lt": cutoff}}
            )
            
            if result.deleted_count > 0:
                logger.info(f"[JWT-ROTATION] Cleaned up {result.deleted_count} expired secrets")
        
        except Exception as e:
            logger.error(f"[JWT-ROTATION] Cleanup failed: {e}")
    
    def _should_rotate(self) -> bool:
        """Check if rotation is needed"""
        try:
            current = self.db[self.COLLECTION].find_one(
                {"is_active": True},
                sort=[("created_at", -1)]
            )
            
            if not current:
                return True
            
            age = now_utc() - current["created_at"]
            return age >= ROTATION_INTERVAL
        
        except Exception as e:
            logger.error(f"[JWT-ROTATION] Rotation check failed: {e}")
            return False
    
    def _rotation_worker(self):
        """Background worker for automatic rotation"""
        logger.info("[JWT-ROTATION] Rotation worker started")
        
        while True:
            try:
                # Check every hour
                time.sleep(3600)
                
                if self._should_rotate():
                    logger.info("[JWT-ROTATION] Initiating automatic rotation")
                    self._rotate_secret()
            
            except Exception as e:
                logger.error(f"[JWT-ROTATION] Worker error: {e}")
    
    def _start_rotation_thread(self):
        """Start background rotation thread"""
        thread = threading.Thread(target=self._rotation_worker, daemon=True)
        thread.start()
        logger.info("[JWT-ROTATION] Rotation thread started")
    
    def _audit_log(self, action: str, details: Dict[str, Any]):
        """Log rotation events"""
        try:
            self.db["jwt_rotation_audit"].insert_one({
                "action": action,
                "details": details,
                "timestamp": now_utc()
            })
        except Exception as e:
            logger.error(f"[JWT-ROTATION] Audit log failed: {e}")
    
    # Public API
    
    def get_current_secret(self) -> str:
        """Get current active secret for signing"""
        if not self._current_secret:
            self._load_secrets()
        return self._current_secret
    
    def get_valid_secrets(self) -> List[str]:
        """Get all valid secrets for verification"""
        if not self._valid_secrets:
            self._load_secrets()
        return self._valid_secrets
    
    def force_rotation(self):
        """Manually trigger secret rotation"""
        logger.info("[JWT-ROTATION] Manual rotation triggered")
        self._rotate_secret()
    
    def get_rotation_status(self) -> Dict[str, Any]:
        """Get current rotation status"""
        try:
            current = self.db[self.COLLECTION].find_one(
                {"is_active": True},
                sort=[("created_at", -1)]
            )
            
            if not current:
                return {"status": "no_secret", "message": "No active secret found"}
            
            age = now_utc() - current["created_at"]
            time_until_rotation = ROTATION_INTERVAL - age
            
            return {
                "status": "active",
                "current_secret_age_days": age.days,
                "rotation_in_days": max(0, time_until_rotation.days),
                "valid_secrets_count": len(self._valid_secrets),
                "created_at": current["created_at"].isoformat(),
                "expires_at": current["expires_at"].isoformat()
            }
        
        except Exception as e:
            logger.error(f"[JWT-ROTATION] Status check failed: {e}")
            return {"status": "error", "message": str(e)}


# Global instance
_secret_manager = None


def get_secret_manager(db=None) -> JWTSecretManager:
    """Get global secret manager instance"""
    global _secret_manager
    if _secret_manager is None:
        _secret_manager = JWTSecretManager(db=db)
    return _secret_manager


def get_jwt_secret() -> str:
    """Get current JWT secret for signing"""
    manager = get_secret_manager()
    return manager.get_current_secret()


def get_valid_jwt_secrets() -> List[str]:
    """Get all valid JWT secrets for verification"""
    manager = get_secret_manager()
    return manager.get_valid_secrets()


def force_jwt_rotation():
    """Manually trigger JWT secret rotation"""
    manager = get_secret_manager()
    manager.force_rotation()


def get_jwt_rotation_status() -> Dict[str, Any]:
    """Get JWT rotation status"""
    manager = get_secret_manager()
    return manager.get_rotation_status()
