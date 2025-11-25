# FILE: backend/app/utils/email.py
"""
Email service with multiple configuration options:
1. Gmail SMTP (for development/small scale)
2. SendGrid API (recommended for production)
3. Console logging (for development without email)

Configure via environment variables in .env file.
"""

import os
from flask import current_app

# Try to import email libraries
try:
    from flask_mail import Mail, Message as MailMessage
    FLASK_MAIL_AVAILABLE = True
except ImportError:
    FLASK_MAIL_AVAILABLE = False
    print("[WARNING] flask-mail not installed. Email sending disabled.")

try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail as SendGridMail
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False


def send_email(to_email, subject, body):
    """
    Send email using configured method.
    
    Priority:
    1. SendGrid (if SENDGRID_API_KEY is set)
    2. SMTP (if MAIL_SERVER is configured)
    3. Console logging (fallback)
    
    Args:
        to_email (str): Recipient email address
        subject (str): Email subject
        body (str): Email body (plain text or HTML)
    """
    
    # Option 1: SendGrid (Production recommended)
    if SENDGRID_AVAILABLE and os.getenv('SENDGRID_API_KEY'):
        try:
            return _send_via_sendgrid(to_email, subject, body)
        except Exception as e:
            print(f"[ERROR] SendGrid email failed: {e}")
            print("[INFO] Falling back to console logging")
    
    # Option 2: SMTP (Gmail, etc.)
    elif FLASK_MAIL_AVAILABLE and os.getenv('MAIL_SERVER'):
        try:
            return _send_via_smtp(to_email, subject, body)
        except Exception as e:
            print(f"[ERROR] SMTP email failed: {e}")
            print("[INFO] Falling back to console logging")
    
    # Option 3: Console logging (Development fallback)
    return _log_to_console(to_email, subject, body)


def _send_via_sendgrid(to_email, subject, body):
    """Send email via SendGrid API"""
    message = SendGridMail(
        from_email=os.getenv('MAIL_DEFAULT_SENDER', 'noreply@securechannelx.com'),
        to_emails=to_email,
        subject=subject,
        html_content=body
    )
    
    sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
    response = sg.send(message)
    
    print(f"✅ Email sent via SendGrid to {to_email}")
    print(f"   Status: {response.status_code}")
    return True


def _send_via_smtp(to_email, subject, body):
    """Send email via SMTP (Gmail, etc.)"""
    # Get Flask-Mail instance from app context
    mail = current_app.extensions.get('mail')
    
    if not mail:
        raise RuntimeError("Flask-Mail not initialized")
    
    msg = MailMessage(
        subject=subject,
        sender=os.getenv('MAIL_DEFAULT_SENDER', os.getenv('MAIL_USERNAME')),
        recipients=[to_email],
        html=body
    )
    
    mail.send(msg)
    print(f"✅ Email sent via SMTP to {to_email}")
    return True


def _log_to_console(to_email, subject, body):
    """Log email to console (development fallback)"""
    print("\n" + "="*80)
    print("📧 EMAIL (Console Mode - No actual email sent)")
    print("="*80)
    print(f"To: {to_email}")
    print(f"Subject: {subject}")
    print("-"*80)
    print(body)
    print("="*80 + "\n")
    return True


def initialize_mail(app):
    """
    Initialize email service based on configuration.
    Call this from app_factory.py
    """
    # Check if SendGrid is configured
    if os.getenv('SENDGRID_API_KEY'):
        print("✅ Email service: SendGrid API")
        return
    
    # Check if SMTP is configured
    if os.getenv('MAIL_SERVER') and FLASK_MAIL_AVAILABLE:
        mail = Mail(app)
        print(f"✅ Email service: SMTP ({os.getenv('MAIL_SERVER')})")
        return mail
    
    # Fallback to console
    print("📝 Email service: Console logging (development mode)")
    print("   Configure SENDGRID_API_KEY or MAIL_SERVER for production")
    return None
