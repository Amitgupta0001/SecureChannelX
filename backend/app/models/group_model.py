# backend/app/models/group_model.py

from bson import ObjectId
from app.utils.helpers import now_utc


def group_document(
    title: str,
    created_by: str,
    description: str = None,
    members: list = None
):
    """
    SecureChannelX Group Model
    --------------------------
    This model is used when groups are stored as standalone
    documents (in addition to chat documents).

    Fields:
        - title: Group name
        - description: Optional group description
        - created_by: User who created the group
        - members: List of user_id strings
        - admin_ids: List of admin user IDs
        - settings: Permissions and group configurations
    """

    member_list = members or [created_by]

    return {
        "_id": ObjectId(),

        # Basic group metadata
        "title": title,
        "description": description,
        "created_by": created_by,

        # Members & admins
        "members": [str(uid) for uid in member_list],
        "admin_ids": [str(created_by)],

        # Timestamps
        "created_at": now_utc(),
        "updated_at": now_utc(),

        # Group settings
        "settings": {
            "allow_media": True,
            "allow_polls": True,
            "allow_reactions": True,
            "allow_threads": True,
            "invite_link": None,   # generated on demand
            "group_avatar": None,  # image URL
            "max_members": 512,
            "permissions": {
                "send_messages": True,
                "send_media": True,
                "add_members": True,
                "pin_messages": True,
                "promote_members": True
            }
        }
    }
