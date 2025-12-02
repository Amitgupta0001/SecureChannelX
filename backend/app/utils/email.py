"""
SecureChannelX Email Service
-----------------------------
Simple email service with SMTP and console fallback
"""

import os
import logging
from typing import Tuple
from flask import current_app

logger = logging.getLogger(__name__)

# Try to import Flask-Mail
try:
    from flask_mail import Mail, Message as MailMessage
    FLASK_MAIL_AVAILABLE = True
except ImportError:
    FLASK_MAIL_AVAILABLE = False
    logger.warning("[EMAIL] flask-mail not installed. Using console fallback.")


def send_email(
    to_email: str,
    subject: str,
    body: str,
    html: bool = True
) -> Tuple[bool, str]:
    """
    Send email using SMTP or console fallback
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        body: Email body (HTML or plain text)
        html: Whether body is HTML (default: True)
    
    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        # Check if Flask-Mail is available and configured
        if FLASK_MAIL_AVAILABLE and os.getenv("MAIL_USERNAME"):
            return _send_via_smtp(to_email, subject, body, html)
        else:
            return _send_via_console(to_email, subject, body, html)
    
    except Exception as e:
        logger.error(f"[EMAIL ERROR] {e}")
        return False, str(e)


def _send_via_smtp(to_email: str, subject: str, body: str, html: bool) -> Tuple[bool, str]:
    """Send email via SMTP using Flask-Mail"""
    try:
        mail = current_app.extensions.get("mail")
        if not mail:
            logger.warning("[EMAIL] Flask-Mail not initialized, using console fallback")
            return _send_via_console(to_email, subject, body, html)
        
        msg = MailMessage(
            subject=subject,
            sender=os.getenv("MAIL_DEFAULT_SENDER", "noreply@securechannelx.com"),
            recipients=[to_email],
            html=body if html else None,
            body=body if not html else None
        )
        
        mail.send(msg)
        logger.info(f"[EMAIL] ✅ Email sent to {to_email} via SMTP")
        return True, "Email sent successfully"
    
    except Exception as e:
        logger.error(f"[EMAIL SMTP ERROR] {e}")
        logger.info("[EMAIL] Falling back to console logging")
        return _send_via_console(to_email, subject, body, html)


def _send_via_console(to_email: str, subject: str, body: str, html: bool) -> Tuple[bool, str]:
    """Log email to console (development/testing)"""
    try:
        print("\n" + "="*80)
        print("📧 EMAIL (Console Mode - Development)")
        print("="*80)
        print(f"From: {os.getenv('MAIL_DEFAULT_SENDER', 'noreply@securechannelx.com')}")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print("-"*80)
        print(f"Body ({'HTML' if html else 'Plain Text'}):")
        print(body)
        print("="*80 + "\n")
        
        logger.info(f"[EMAIL] ✅ Email logged to console for {to_email}")
        return True, "Email logged to console"
    
    except Exception as e:
        logger.error(f"[EMAIL CONSOLE ERROR] {e}")
        return False, str(e)


def initialize_mail(app):
    """Initialize email service for Flask app"""
    try:
        if FLASK_MAIL_AVAILABLE:
            from flask_mail import Mail
            mail = Mail(app)
            logger.info("[EMAIL INIT] ✅ Flask-Mail initialized")
            return mail
        
        logger.info("[EMAIL INIT] ✅ Email service ready (console mode)")
        return None
    
    except Exception as e:
        logger.error(f"[EMAIL INIT] ❌ Error: {e}")
        return None


__all__ = ["send_email", "initialize_mail"]
