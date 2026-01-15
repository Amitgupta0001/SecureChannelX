"""
SecureChannelX - Database Backup Strategy
-----------------------------------------
Automated backup and restore for MongoDB

Features:
- Scheduled backups
- Incremental backups
- Encrypted backups
- Backup rotation
- Restore functionality
"""

import os
import subprocess
import logging
from datetime import datetime, timedelta
from typing import Optional, List
import json
import tarfile
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class DatabaseBackupManager:
    """
    Manages database backups with encryption and rotation
    """
    
    def __init__(self, backup_dir: str = "./backups", encryption_key: bytes = None):
        self.backup_dir = backup_dir
        self.encryption_key = encryption_key or Fernet.generate_key()
        self.fernet = Fernet(self.encryption_key)
        self.max_backups = 30  # Keep 30 days of backups
        
        # Create backup directory
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def create_backup(self, db_name: str = "SecureChannelX") -> str:
        """
        Create encrypted database backup
        
        Args:
            db_name: Database name to backup
            
        Returns:
            Path to backup file
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{db_name}_{timestamp}"
        backup_path = os.path.join(self.backup_dir, backup_name)
        
        try:
            # Create MongoDB dump
            logger.info(f"[Backup] Creating backup: {backup_name}")
            
            subprocess.run([
                "mongodump",
                "--db", db_name,
                "--out", backup_path,
                "--gzip"
            ], check=True, capture_output=True)
            
            # Compress backup
            tar_path = f"{backup_path}.tar.gz"
            with tarfile.open(tar_path, "w:gz") as tar:
                tar.add(backup_path, arcname=backup_name)
            
            # Encrypt backup
            encrypted_path = f"{tar_path}.enc"
            with open(tar_path, 'rb') as f:
                encrypted_data = self.fernet.encrypt(f.read())
            
            with open(encrypted_path, 'wb') as f:
                f.write(encrypted_data)
            
            # Clean up unencrypted files
            os.remove(tar_path)
            import shutil
            shutil.rmtree(backup_path)
            
            # Create metadata
            metadata = {
                'timestamp': timestamp,
                'db_name': db_name,
                'size': os.path.getsize(encrypted_path),
                'encrypted': True
            }
            
            with open(f"{encrypted_path}.meta", 'w') as f:
                json.dump(metadata, f)
            
            logger.info(f"[Backup] ✅ Backup created: {encrypted_path}")
            
            # Rotate old backups
            self.rotate_backups()
            
            return encrypted_path
            
        except Exception as e:
            logger.error(f"[Backup] ❌ Backup failed: {e}")
            raise
    
    def restore_backup(self, backup_file: str, db_name: str = "SecureChannelX"):
        """
        Restore database from encrypted backup
        
        Args:
            backup_file: Path to encrypted backup file
            db_name: Database name to restore to
        """
        try:
            logger.info(f"[Backup] Restoring from: {backup_file}")
            
            # Decrypt backup
            with open(backup_file, 'rb') as f:
                encrypted_data = f.read()
            
            decrypted_data = self.fernet.decrypt(encrypted_data)
            
            # Extract tar
            tar_path = backup_file.replace('.enc', '')
            with open(tar_path, 'wb') as f:
                f.write(decrypted_data)
            
            # Extract backup
            extract_path = tar_path.replace('.tar.gz', '')
            with tarfile.open(tar_path, 'r:gz') as tar:
                tar.extractall(self.backup_dir)
            
            # Restore to MongoDB
            subprocess.run([
                "mongorestore",
                "--db", db_name,
                "--gzip",
                "--drop",  # Drop existing collections
                os.path.join(self.backup_dir, os.path.basename(extract_path), db_name)
            ], check=True, capture_output=True)
            
            # Clean up
            os.remove(tar_path)
            import shutil
            shutil.rmtree(extract_path)
            
            logger.info("[Backup] ✅ Restore completed")
            
        except Exception as e:
            logger.error(f"[Backup] ❌ Restore failed: {e}")
            raise
    
    def rotate_backups(self):
        """
        Remove old backups based on retention policy
        """
        backups = self.list_backups()
        
        if len(backups) > self.max_backups:
            # Sort by timestamp
            backups.sort(key=lambda x: x['timestamp'])
            
            # Remove oldest backups
            to_remove = backups[:len(backups) - self.max_backups]
            
            for backup in to_remove:
                try:
                    os.remove(backup['path'])
                    meta_file = f"{backup['path']}.meta"
                    if os.path.exists(meta_file):
                        os.remove(meta_file)
                    logger.info(f"[Backup] Removed old backup: {backup['path']}")
                except Exception as e:
                    logger.error(f"[Backup] Failed to remove backup: {e}")
    
    def list_backups(self) -> List[dict]:
        """
        List all available backups
        
        Returns:
            List of backup metadata
        """
        backups = []
        
        for file in os.listdir(self.backup_dir):
            if file.endswith('.enc'):
                backup_path = os.path.join(self.backup_dir, file)
                meta_path = f"{backup_path}.meta"
                
                if os.path.exists(meta_path):
                    with open(meta_path, 'r') as f:
                        metadata = json.load(f)
                        metadata['path'] = backup_path
                        backups.append(metadata)
        
        return backups
    
    def schedule_backup(self, interval_hours: int = 24):
        """
        Schedule automatic backups
        
        Args:
            interval_hours: Backup interval in hours
        """
        import schedule
        
        def backup_job():
            try:
                self.create_backup()
            except Exception as e:
                logger.error(f"[Backup] Scheduled backup failed: {e}")
        
        schedule.every(interval_hours).hours.do(backup_job)
        logger.info(f"[Backup] Scheduled backups every {interval_hours} hours")


# Global backup manager
_backup_manager = None


def get_backup_manager(backup_dir: str = "./backups", encryption_key: bytes = None):
    """Get global backup manager instance"""
    global _backup_manager
    if _backup_manager is None:
        _backup_manager = DatabaseBackupManager(backup_dir, encryption_key)
    return _backup_manager


__all__ = ['DatabaseBackupManager', 'get_backup_manager']
