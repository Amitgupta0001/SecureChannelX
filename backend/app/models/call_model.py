# backend/app/models/call_model.py

from datetime import datetime
from bson import ObjectId

from app.utils.helpers import now_utc


def call_document(
    chat_id: str,
    caller_id: str,
    receiver_id: str,
    call_type: str,
    status: str = "ringing",
    started_at=None,
    ended_at=None,
    metadata=None
):
    """
    SecureChannelX Call Model
    -------------------------

    call_type: 
        "audio" | "video"

    status:
        "ringing"  - call initiated
        "accepted" - receiver answered
        "missed"   - receiver did not answer
        "ended"    - call ended normally

    metadata:
        {
            "caller_sdp": "...",
            "receiver_sdp": "...",
            "caller_ice": [...],
            "receiver_ice": [...],
            ...
        }
    """

    return {
        "_id": ObjectId(),
        "chat_id": ObjectId(chat_id),

        # Participants
        "caller_id": caller_id,
        "receiver_id": receiver_id,

        # Call info
        "call_type": call_type,     # audio | video
        "status": status,           # ringing | accepted | missed | ended

        # Timestamps
        "started_at": started_at or now_utc(),
        "ended_at": ended_at,
        "duration_seconds": None,   # calculated when ended

        # WebRTC / signaling data
        "call_metadata": metadata or {},

        # Audit
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
