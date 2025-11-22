# backend/app/models/chat_model.py

from bson import ObjectId
from app.utils.helpers import now_utc


def chat_document(
    chat_type: str,
    participants: list,
    created_by: str,
    title: str = None,
    description: str = None
):
    """
    SecureChannelX Chat Model
    -------------------------
    chat_type:
        "private" -> 1-to-1 DM
        "group"   -> multi-user chat

    participants:
        list of user_id strings

    created_by:
        user ID of creator

    Additional fields include:
        - group settings (admins, permissions)
        - last message preview
        - timestamps
        - group metadata
    """

    # Normalize participants (ensure ObjectId or consistent UID format)
    normalized_participants = [str(uid) for uid in participants]

    doc = {
        "_id": ObjectId(),

        # Chat type
        "chat_type": chat_type,                # "private" | "group"

        # Members
        "participants": normalized_participants,

        # Metadata
        "title": title if chat_type == "group" else None,
        "description": description if chat_type == "group" else None,
        "created_by": created_by,

        # Time tracking
        "created_at": now_utc(),
        "updated_at": now_utc(),

        # Last message preview
        "last_message_at": None,
        "last_message_preview": None,
    }

    # ----------------------------
    # Add group-specific details
    # ----------------------------
    if chat_type == "group":
        doc["group_settings"] = {
            "admins": [created_by],
            "permissions": {
                "send_messages": True,
                "send_media": True,
                "add_members": True,
                "pin_messages": True
            },
            "group_avatar": None,
            "invite_link": None,
            "max_members": 512
        }

    return doc
