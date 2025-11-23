from flask_mail import Message
from flask import current_app
from app import mail

def send_email(to, subject, body):
    """
    Sends an email using Flask-Mail.
    If MAIL_SERVER is not configured or in debug mode, it might just log to console depending on config.
    """
    try:
        msg = Message(
            subject=subject,
            recipients=[to],
            body=body,
            sender=current_app.config.get("MAIL_USERNAME", "noreply@securechannelx.com")
        )
        mail.send(msg)
        current_app.logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send email to {to}: {str(e)}")
        # For development/debugging when SMTP isn't set up, print the body
        print(f"\n[EMAIL DEBUG] To: {to}\nSubject: {subject}\nBody:\n{body}\n")
        return False
