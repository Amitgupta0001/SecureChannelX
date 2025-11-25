# backend/app/models/message_model.py

from bson import ObjectId
from app.utils.helpers import now_utc


def message_document(
    chat_id: str,
    sender_id: str,
    message_type: str,
    content: str = "",
    encrypted_content: str = "",
    parent_id: str = None,
    extra: dict = None
):
    """
    SecureChannelX Message Model
    ----------------------------
    General message structure supporting:

    - text messages
    - encrypted messages
    - file messages
    - poll messages
    - call notifications
    - system messages (join, leave, etc.)
    - thread replies
    - message edits
    - reactions

    Fields:
        chat_id        The chat this message belongs to
        sender_id      User who sent the message
        message_type   "text" | "file" | "poll" | "call" | "system"
        content        Plain-text content (optional when encrypted)
        encrypted_content  E2E encrypted ciphertext
        parent_id      Threaded message parent
        extra          Custom metadata: { file_info, poll_id, call_id, ... }
    """

    return {
        "_id": ObjectId(),

        # Location
        "chat_id": ObjectId(chat_id),

        # Sender
        "sender_id": sender_id,

        # Message core
        "message_type": message_type,
        "content": content,
        "encrypted_content": encrypted_content,   # AES-256-GCM ciphertext

        # Threaded messages
        "parent_id": parent_id,                   # reply-to / thread root

        # Metadata for files, calls, polls, etc.
        "extra": extra or {},

        # UX features
        "reactions": [],                          # [{emoji, user_id}]
        "seen_by": [],                            # list of user_ids

        # Edit/delete status
        "is_edited": False,
        "is_deleted": False,

        # Timestamps
        "created_at": now_utc(),
        "updated_at": now_utc()
    }
