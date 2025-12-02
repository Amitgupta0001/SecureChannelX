"""
SecureChannelX - Logging Configuration
---------------------------------------
Centralized logging setup
"""

import os
import logging
import sys
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path

def setup_logging(app):
    """
    ✅ ENHANCED: Configure application logging
    
    Features:
      - Console output (development)
      - File rotation (production)
      - Structured logging
      - Multiple log levels
    """
    
    # Create logs directory
    logs_dir = Path("app/logs")
    logs_dir.mkdir(exist_ok=True)
    
    # Get log level from environment
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Remove default handlers
    app.logger.handlers.clear()
    
    # ✅ Console Handler (always)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level))
    console_formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    app.logger.addHandler(console_handler)
    
    # ✅ File Handler (production)
    if os.getenv("FLASK_ENV") == "production":
        # Main application log
        file_handler = RotatingFileHandler(
            'app/logs/app.log',
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=10
        )
        file_handler.setLevel(logging.INFO)
        file_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s [%(filename)s:%(lineno)d]: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        app.logger.addHandler(file_handler)
        
        # Error log
        error_handler = RotatingFileHandler(
            'app/logs/error.log',
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=10
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_formatter)
        app.logger.addHandler(error_handler)
        
        # Security audit log
        security_handler = TimedRotatingFileHandler(
            'app/logs/security.log',
            when='midnight',
            interval=1,
            backupCount=30
        )
        security_handler.setLevel(logging.WARNING)
        security_handler.setFormatter(file_formatter)
        
        # Add security logger
        security_logger = logging.getLogger('security')
        security_logger.addHandler(security_handler)
    
    # Set log level
    app.logger.setLevel(getattr(logging, log_level))
    
    app.logger.info(f"[LOGGING] Logging configured (level: {log_level})")
    
    return app