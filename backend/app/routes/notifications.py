# backend/app/routes/notifications.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app import socketio

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")
db = get_db()

# ✅ FIXED: Notification types
NOTIFICATION_TYPES = {
    "message": "New Message",
    "call": "Incoming Call",
    "group_invite": "Group Invitation",
    "friend_request": "Friend Request",
    "group_update": "Group Update",
    "system": "System Notification"
}

# ✅ FIXED: Maximum tokens per user (prevent spam)
MAX_TOKENS_PER_USER = 10


# ============================================================
#                   HELPER FUNCTIONS
# ============================================================
def validate_notification_type(notif_type):
    """✅ FIXED: Validate notification type"""
    if notif_type not in NOTIFICATION_TYPES:
        return False, f"Invalid type. Allowed: {', '.join(NOTIFICATION_TYPES.keys())}"
    return True, None


def get_user_tokens(user_id):
    """✅ FIXED: Safely fetch user's push tokens"""
    try:
        token_doc = db.push_tokens.find_one({"user_id": user_id})
        if not token_doc:
            return []
        
        tokens = token_doc.get("tokens", [])
        return tokens if isinstance(tokens, list) else []
    except Exception as e:
        current_app.logger.error(f"[GET TOKENS ERROR] {e}")
        return []


def send_push_notification(tokens, title, body, data=None):
    """✅ FIXED: Send actual push notifications (Firebase/VAPID)"""
    if not tokens:
        return False
    
    try:
        # ✅ FIXED: Firebase Cloud Messaging example
        import firebase_admin
        from firebase_admin import messaging
        
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            tokens=tokens
        )
        
        response = messaging.send_multicast(message)
        
        if response.failure_count > 0:
            current_app.logger.warning(f"[FCM] Failed to send to {response.failure_count} devices")
        
        return response.success_count > 0
        
    except ImportError:
        current_app.logger.warning("[FCM] Firebase not configured, using Socket.IO only")
        return False
    except Exception as e:
        current_app.logger.error(f"[PUSH SEND ERROR] {e}")
        return False


# ============================================================
#                 REGISTER PUSH TOKEN
# ============================================================
@notifications_bp.route("/register_token", methods=["POST"])
@jwt_required()
def register_token():
    """
    ✅ FIXED: Save push subscription / push token for current user
    
    Body: {
        "token": "<push-token-or-webpush-subscription>",
        "device_type": "web|android|ios" (optional)
    }
    """
    try:
        data = request.get_json() or {}
        token = (data.get("token") or "").strip()
        device_type = (data.get("device_type") or "web").strip()

        # ✅ FIXED: Validate token
        if not token:
            return error("token is required", 400)

        if len(token) < 10:
            return error("token appears invalid (too short)", 400)

        if device_type not in ["web", "android", "ios"]:
            return error("Invalid device_type", 400)

        user_id = get_jwt_identity()

        # ✅ FIXED: Check token count to prevent spam
        token_doc = db.push_tokens.find_one({"user_id": user_id})
        current_tokens = token_doc.get("tokens", []) if token_doc else []

        if len(current_tokens) >= MAX_TOKENS_PER_USER:
            # ✅ FIXED: Remove oldest token if at limit
            db.push_tokens.update_one(
                {"user_id": user_id},
                {"$pop": {"tokens": -1}}  # Remove first (oldest)
            )
            current_app.logger.info(f"[TOKENS] Removed oldest token for user {user_id}")

        # ✅ FIXED: Check if token already exists (avoid duplicates)
        if token in current_tokens:
            return success("Token already registered")

        # ✅ FIXED: Store token with metadata
        db.push_tokens.update_one(
            {"user_id": user_id},
            {
                "$addToSet": {"tokens": token},
                "$set": {
                    "updated_at": now_utc(),
                    "device_type": device_type,
                    "last_token_added": now_utc()
                }
            },
            upsert=True
        )

        current_app.logger.info(f"[PUSH TOKEN] Registered for user {user_id}, device: {device_type}")

        return success("Token registered successfully", {
            "token_count": len(current_tokens) + 1,
            "max_tokens": MAX_TOKENS_PER_USER
        })

    except Exception as e:
        current_app.logger.error(f"[REGISTER TOKEN ERROR] {e}")
        return error("Failed to register token", 500)


# ============================================================
#                 UNREGISTER PUSH TOKEN
# ============================================================
@notifications_bp.route("/unregister_token", methods=["POST"])
@jwt_required()
def unregister_token():
    """
    ✅ FIXED: Remove push token for current user
    
    Body: {
        "token": "<push-token-to-remove>"
    }
    """
    try:
        data = request.get_json() or {}
        token = (data.get("token") or "").strip()

        if not token:
            return error("token is required", 400)

        user_id = get_jwt_identity()

        result = db.push_tokens.update_one(
            {"user_id": user_id},
            {"$pull": {"tokens": token}}
        )

        if result.modified_count == 0:
            return error("Token not found", 404)

        current_app.logger.info(f"[PUSH TOKEN] Unregistered for user {user_id}")

        return success("Token unregistered successfully")

    except Exception as e:
        current_app.logger.error(f"[UNREGISTER TOKEN ERROR] {e}")
        return error("Failed to unregister token", 500)


# ============================================================
#                 GET USER NOTIFICATIONS
# ============================================================
@notifications_bp.route("/list", methods=["GET"])
@jwt_required()
def list_notifications():
    """
    ✅ FIXED: Get user's notification history with pagination
    
    Query params:
    - limit: number of notifications per page (default: 20)
    - skip: number of notifications to skip (default: 0)
    - unread_only: return only unread (default: false)
    """
    try:
        user_id = get_jwt_identity()

        # ✅ FIXED: Pagination
        limit = int(request.args.get("limit", 20))
        skip = int(request.args.get("skip", 0))
        unread_only = request.args.get("unread_only", "false").lower() == "true"

        if limit > 100:
            limit = 100

        # ✅ FIXED: Build query
        query = {"user_id": user_id}
        if unread_only:
            query["is_read"] = False

        # ✅ FIXED: Get total count
        total = db.notifications.count_documents(query)

        # ✅ FIXED: Fetch notifications
        cursor = db.notifications.find(query).sort("created_at", -1).skip(skip).limit(limit)

        notifications = []
        for notif in cursor:
            notif_data = {
                "id": str(notif.get("_id")),
                "notification_id": str(notif.get("_id")),
                "_id": str(notif.get("_id")),
                "user_id": notif.get("user_id"),
                "title": notif.get("title"),
                "body": notif.get("body"),
                "type": notif.get("type", "system"),
                "is_read": notif.get("is_read", False),
                "data": notif.get("data", {}),
                "created_at": (
                    notif.get("created_at").isoformat()
                    if isinstance(notif.get("created_at"), datetime)
                    else notif.get("created_at")
                ),
                "read_at": (
                    notif.get("read_at").isoformat()
                    if notif.get("read_at") and isinstance(notif.get("read_at"), datetime)
                    else None
                )
            }
            notifications.append(notif_data)

        # ✅ FIXED: Get unread count
        unread_count = db.notifications.count_documents({
            "user_id": user_id,
            "is_read": False
        })

        current_app.logger.info(f"[NOTIFICATIONS] User {user_id} fetched {len(notifications)} notifications")

        return success(data={
            "notifications": notifications,
            "total": total,
            "unread_count": unread_count,
            "limit": limit,
            "skip": skip,
            "has_more": (skip + limit) < total
        })

    except Exception as e:
        current_app.logger.error(f"[LIST NOTIFICATIONS ERROR] {e}")
        return error("Failed to fetch notifications", 500)


# ============================================================
#                 MARK NOTIFICATION AS READ
# ============================================================
@notifications_bp.route("/<notification_id>/read", methods=["PUT"])
@jwt_required()
def mark_as_read(notification_id):
    """
    ✅ FIXED: Mark single notification as read
    """
    try:
        user_id = get_jwt_identity()

        try:
            notif_oid = ObjectId(notification_id)
        except:
            return error("Invalid notification_id format", 400)

        notif = db.notifications.find_one({"_id": notif_oid, "user_id": user_id})
        if not notif:
            return error("Notification not found", 404)

        # ✅ FIXED: Only mark if not already read
        if not notif.get("is_read"):
            db.notifications.update_one(
                {"_id": notif_oid},
                {
                    "$set": {
                        "is_read": True,
                        "read_at": now_utc()
                    }
                }
            )

        return success("Notification marked as read")

    except Exception as e:
        current_app.logger.error(f"[MARK READ ERROR] {e}")
        return error("Failed to mark as read", 500)


# ============================================================
#                 MARK ALL AS READ
# ============================================================
@notifications_bp.route("/mark-all-read", methods=["PUT"])
@jwt_required()
def mark_all_as_read():
    """
    ✅ FIXED: Mark all unread notifications as read
    """
    try:
        user_id = get_jwt_identity()

        result = db.notifications.update_many(
            {
                "user_id": user_id,
                "is_read": False
            },
            {
                "$set": {
                    "is_read": True,
                    "read_at": now_utc()
                }
            }
        )

        current_app.logger.info(f"[NOTIFICATIONS] Marked {result.modified_count} as read for user {user_id}")

        return success(f"Marked {result.modified_count} notifications as read")

    except Exception as e:
        current_app.logger.error(f"[MARK ALL READ ERROR] {e}")
        return error("Failed to mark all as read", 500)


# ============================================================
#                 DELETE NOTIFICATION
# ============================================================
@notifications_bp.route("/<notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    """
    ✅ FIXED: Delete (soft delete) a notification
    """
    try:
        user_id = get_jwt_identity()

        try:
            notif_oid = ObjectId(notification_id)
        except:
            return error("Invalid notification_id format", 400)

        result = db.notifications.update_one(
            {"_id": notif_oid, "user_id": user_id},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": now_utc()
                }
            }
        )

        if result.matched_count == 0:
            return error("Notification not found", 404)

        return success("Notification deleted")

    except Exception as e:
        current_app.logger.error(f"[DELETE NOTIFICATION ERROR] {e}")
        return error("Failed to delete notification", 500)


# ============================================================
#                 SEND NOTIFICATION (INTERNAL)
# ============================================================
@notifications_bp.route("/send", methods=["POST"])
@jwt_required()
def send_notification():
    """
    ✅ FIXED: Send notification to user (admin/internal use)
    
    Body: {
        "target_user_id": "<user-id>",
        "title": "New message",
        "body": "You have a new message",
        "type": "message|call|group_invite|...",
        "data": { "chat_id": "...", "sender_id": "..." } (optional)
    }
    """
    try:
        requester_id = get_jwt_identity()
        data = request.get_json() or {}

        target_user_id = data.get("target_user_id")
        title = (data.get("title") or "").strip()
        body = (data.get("body") or "").strip()
        notif_type = data.get("type", "system")
        notif_data = data.get("data", {})

        # ✅ FIXED: Validate all required fields
        if not target_user_id:
            return error("target_user_id is required", 400)

        if not title or not body:
            return error("title and body are required", 400)

        # ✅ FIXED: Validate notification type
        valid_type, error_msg = validate_notification_type(notif_type)
        if not valid_type:
            return error(error_msg, 400)

        # ✅ FIXED: Validate target user exists
        target_user = db.users.find_one({"_id": ObjectId(target_user_id) if isinstance(target_user_id, str) else target_user_id})
        if not target_user:
            return error("Target user not found", 404)

        # ✅ FIXED: Store notification in database
        notif_doc = {
            "user_id": target_user_id,
            "sender_id": requester_id,
            "title": title,
            "body": body,
            "type": notif_type,
            "data": notif_data if isinstance(notif_data, dict) else {},
            "is_read": False,
            "is_deleted": False,
            "created_at": now_utc(),
            "read_at": None,
            "deleted_at": None
        }

        result = db.notifications.insert_one(notif_doc)
        notif_doc["_id"] = str(result.inserted_id)

        # ✅ FIXED: Send real-time Socket.IO notification
        try:
            socketio.emit(
                "notification:received",
                {
                    "notification_id": str(result.inserted_id),
                    "title": title,
                    "body": body,
                    "type": notif_type,
                    "data": notif_data,
                    "timestamp": now_utc().isoformat(),
                    "sender_id": requester_id
                },
                room=f"user:{target_user_id}",
                skip_sid=None
            )
            current_app.logger.info(f"[SOCKET] Sent notification to user {target_user_id}")
        except Exception as socket_error:
            current_app.logger.warning(f"[SOCKET ERROR] {socket_error}")

        # ✅ FIXED: Send push notification via FCM/VAPID
        tokens = get_user_tokens(target_user_id)
        if tokens:
            push_success = send_push_notification(
                tokens,
                title,
                body,
                {
                    "type": notif_type,
                    "notification_id": str(result.inserted_id),
                    **notif_data
                }
            )
            current_app.logger.info(f"[PUSH] Push notification sent: {push_success}")

        current_app.logger.info(f"[NOTIFICATION] Sent to user {target_user_id}, type: {notif_type}")

        return success("Notification sent successfully", {
            "notification_id": str(result.inserted_id),
            "target_user_id": target_user_id,
            "type": notif_type
        })

    except Exception as e:
        current_app.logger.error(f"[SEND NOTIFICATION ERROR] {e}")
        return error("Failed to send notification", 500)


# ============================================================
#                 BATCH SEND NOTIFICATIONS
# ============================================================
@notifications_bp.route("/send-batch", methods=["POST"])
@jwt_required()
def send_batch_notifications():
    """
    ✅ FIXED: Send notifications to multiple users
    
    Body: {
        "target_user_ids": ["user1", "user2", ...],
        "title": "Group update",
        "body": "You were added to...",
        "type": "group_update",
        "data": {}
    }
    """
    try:
        requester_id = get_jwt_identity()
        data = request.get_json() or {}

        target_user_ids = data.get("target_user_ids", [])
        title = (data.get("title") or "").strip()
        body = (data.get("body") or "").strip()
        notif_type = data.get("type", "system")
        notif_data = data.get("data", {})

        # ✅ FIXED: Validate batch
        if not isinstance(target_user_ids, list) or len(target_user_ids) == 0:
            return error("target_user_ids must be a non-empty list", 400)

        if len(target_user_ids) > 1000:
            return error("Too many recipients (max 1000)", 400)

        if not title or not body:
            return error("title and body are required", 400)

        # ✅ FIXED: Validate type
        valid_type, error_msg = validate_notification_type(notif_type)
        if not valid_type:
            return error(error_msg, 400)

        sent_count = 0
        failed = []

        for user_id in target_user_ids:
            try:
                # ✅ FIXED: Insert notification
                notif_doc = {
                    "user_id": user_id,
                    "sender_id": requester_id,
                    "title": title,
                    "body": body,
                    "type": notif_type,
                    "data": notif_data,
                    "is_read": False,
                    "is_deleted": False,
                    "created_at": now_utc()
                }

                db.notifications.insert_one(notif_doc)

                # ✅ FIXED: Send Socket.IO
                try:
                    socketio.emit(
                        "notification:received",
                        {
                            "title": title,
                            "body": body,
                            "type": notif_type,
                            "timestamp": now_utc().isoformat()
                        },
                        room=f"user:{user_id}"
                    )
                except:
                    pass

                # ✅ FIXED: Send push
                tokens = get_user_tokens(user_id)
                if tokens:
                    send_push_notification(tokens, title, body, {"type": notif_type})

                sent_count += 1

            except Exception as item_error:
                current_app.logger.error(f"[BATCH] Error sending to {user_id}: {item_error}")
                failed.append(user_id)

        current_app.logger.info(f"[BATCH NOTIFICATIONS] Sent to {sent_count}/{len(target_user_ids)} users")

        return success(f"Sent to {sent_count} users", {
            "sent_count": sent_count,
            "total_count": len(target_user_ids),
            "failed_count": len(failed),
            "failed_users": failed
        })

    except Exception as e:
        current_app.logger.error(f"[BATCH SEND ERROR] {e}")
        return error("Failed to send batch notifications", 500)


# ============================================================
#                 GET NOTIFICATION STATS
# ============================================================
@notifications_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_notification_stats():
    """
    ✅ FIXED: Get user's notification statistics
    """
    try:
        user_id = get_jwt_identity()

        total = db.notifications.count_documents({"user_id": user_id, "is_deleted": False})
        unread = db.notifications.count_documents({"user_id": user_id, "is_read": False, "is_deleted": False})

        # ✅ FIXED: Count by type
        type_counts = {}
        for notif_type in NOTIFICATION_TYPES.keys():
            count = db.notifications.count_documents({
                "user_id": user_id,
                "type": notif_type,
                "is_deleted": False
            })
            if count > 0:
                type_counts[notif_type] = count

        return success(data={
            "total": total,
            "unread": unread,
            "read": total - unread,
            "by_type": type_counts
        })

    except Exception as e:
        current_app.logger.error(f"[STATS ERROR] {e}")
        return error("Failed to fetch stats", 500)
