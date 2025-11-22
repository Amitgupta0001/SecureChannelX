# backend/app/routes/notifications.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app import socketio

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")
db = get_db()


# ======================================================
#                 REGISTER PUSH TOKEN
# ======================================================
@notifications_bp.route("/register_token", methods=["POST"])
@jwt_required()
def register_token():
    """
    Save push subscription / push token for the current user.
    Body: {
        "token": "<push-token-or-webpush-subscription-object>"
    }
    """

    try:
        data = request.get_json() or {}
        token = data.get("token")

        if not token:
            return error("token is required", 400)

        user_id = get_jwt_identity()

        db.push_tokens.update_one(
            {"user_id": user_id},
            {"$addToSet": {"tokens": token}, "$set": {"updated_at": now_utc()}},
            upsert=True
        )

        return success("Token registered successfully")

    except Exception as e:
        current_app.logger.error(f"[NOTIFICATION TOKEN ERROR] {str(e)}")
        return error("Failed to register token", 500)


# ======================================================
#                 SEND NOTIFICATION
# ======================================================
@notifications_bp.route("/send", methods=["POST"])
@jwt_required()
def send_notification():
    """
    Send a notification to a single user.
    Body:
        {
            "user_id": "<target user>",
            "title": "New message",
            "body": "You have a new DM"
        }
    """

    try:
        data = request.get_json() or {}

        user_id = data.get("user_id")
        title = data.get("title")
        body = data.get("body")

        if not user_id or not title or not body:
            return error("user_id, title, and body are required", 400)

        # Store internal database record (optional)
        db.notifications.insert_one({
            "user_id": user_id,
            "title": title,
            "body": body,
            "created_at": now_utc()
        })

        # Real-time Socket.IO push (optional)
        socketio.emit(
            "notification",
            {
                "title": title,
                "body": body,
                "user_id": user_id,
                "timestamp": now_utc().isoformat()
            },
            room=f"user:{user_id}"
        )

        # NOTE: Real push delivery (Firebase / APNs / VAPID) would happen here

        return success("Notification sent")

    except Exception as e:
        current_app.logger.error(f"[NOTIFICATION SEND ERROR] {str(e)}")
        return error("Failed to send notification", 500)
