# backend/app/models/call_model.py

"""
SecureChannelX Call Model (Enhanced Version)
---------------------------------------------
Supports:
  - Audio & Video calls
  - Call status tracking
  - WebRTC signaling data
  - Call recording
  - Call history
  - Missed call tracking
  - Call duration metrics
  - Call quality metrics
"""

from datetime import datetime
from bson import ObjectId
from app.utils.helpers import now_utc
from app.database import get_db
import logging

logger = logging.getLogger(__name__)

# ============================================================
#                   CONSTANTS
# ============================================================

CALL_TYPES = ["audio", "video"]
CALL_STATUSES = ["ringing", "accepted", "rejected", "missed", "ended", "failed"]
MIN_CALL_DURATION = 1  # seconds


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_call_data(
    chat_id: str,
    caller_id: str,
    receiver_id: str,
    call_type: str
) -> tuple:
    """✅ ENHANCED: Validate call data before creation"""
    errors = []
    
    # ✅ ENHANCED: Chat ID validation
    if not chat_id or not isinstance(chat_id, str):
        errors.append("Valid chat_id required")
    
    # ✅ ENHANCED: Caller ID validation
    if not caller_id or not isinstance(caller_id, str):
        errors.append("Valid caller_id required")
    
    # ✅ ENHANCED: Receiver ID validation
    if not receiver_id or not isinstance(receiver_id, str):
        errors.append("Valid receiver_id required")
    
    # ✅ ENHANCED: Ensure caller != receiver
    if caller_id == receiver_id:
        errors.append("Caller and receiver must be different")
    
    # ✅ ENHANCED: Call type validation
    if call_type not in CALL_TYPES:
        errors.append(f"Invalid call_type: {call_type}")
    
    if errors:
        return False, errors
    
    return True, []


# ============================================================
#                   CALL DOCUMENT FACTORY
# ============================================================

def call_document(
    chat_id: str,
    caller_id: str,
    receiver_id: str,
    call_type: str,
    status: str = "ringing",
    started_at: datetime = None,
    ended_at: datetime = None,
    metadata: dict = None,
    is_recorded: bool = False
) -> dict:
    """
    ✅ ENHANCED: Create call document with full tracking
    """
    
    # ✅ ENHANCED: Validate inputs
    valid, errors = validate_call_data(chat_id, caller_id, receiver_id, call_type)
    if not valid:
        raise ValueError(f"Invalid call data: {', '.join(errors)}")
    
    now = now_utc()
    
    # ✅ ENHANCED: Ensure status is valid
    if status not in CALL_STATUSES:
        status = "ringing"
    
    # ✅ ENHANCED: Create comprehensive call document
    doc = {
        "_id": ObjectId(),
        
        # ============= REFERENCES =============
        "chat_id": str(chat_id),
        
        # ============= PARTICIPANTS =============
        "caller_id": str(caller_id),
        "receiver_id": str(receiver_id),  # Can be single user or group_id
        
        # ============= CALL INFO =============
        "call_type": call_type,  # audio | video
        "status": status,  # ringing | accepted | rejected | missed | ended | failed
        "is_group_call": False,  # True for group/conference calls
        
        # ============= TIMESTAMPS =============
        "initiated_at": now,
        "started_at": started_at,  # When WebRTC connection established
        "accepted_at": None,  # When receiver answered
        "ended_at": ended_at,
        "duration_seconds": None,  # Calculated on end
        
        # ============= CALL METRICS =============
        "call_metrics": {
            "ring_duration_seconds": 0,
            "actual_duration_seconds": 0,
            "attempted": True,
            "connected": status == "accepted",
            "completed": status == "ended"
        },
        
        # ============= RECORDING & STORAGE =============
        "is_recorded": is_recorded,
        "recording_url": None,
        "recording_file_id": None,
        "recording_duration_seconds": None,
        "storage_location": None,  # S3, local, etc
        
        # ============= WEBRTC SIGNALING DATA =============
        "call_metadata": metadata or {},
        "webrtc_data": {
            "ice_candidates": [],  # List of ICE candidates
            "local_sdp": None,  # Local SDP offer/answer
            "remote_sdp": None,  # Remote SDP offer/answer
            "connection_state": "new",  # new | connecting | connected | disconnected | failed | closed
            "connection_quality": None,  # excellent | good | fair | poor | failed
        },
        
        # ============= BANDWIDTH & QUALITY METRICS =============
        "quality_metrics": {
            "video_codec": None,
            "audio_codec": None,
            "video_resolution": None,  # e.g., "1280x720"
            "audio_sample_rate": None,  # Hz
            "frame_rate": None,  # FPS
            "bitrate_kbps": None,
            "latency_ms": None,
            "packet_loss_percent": None,
            "jitter_ms": None,
        },
        
        # ============= CALL FAILURE INFO =============
        "failure_reason": None,  # Why call failed/ended
        "error_code": None,
        "error_message": None,
        
        # ============= PARTICIPANT STATES =============
        "participant_states": {
            str(caller_id): {
                "role": "caller",
                "state": "initiating",
                "joined_at": None,
                "left_at": None,
                "audio_enabled": True,
                "video_enabled": call_type == "video",
                "screen_sharing": False,
            },
            str(receiver_id): {
                "role": "receiver",
                "state": "ringing",
                "joined_at": None,
                "left_at": None,
                "audio_enabled": True,
                "video_enabled": call_type == "video",
                "screen_sharing": False,
            }
        },
        
        # ============= CALL FEATURES =============
        "features": {
            "supports_screen_sharing": True,
            "supports_recording": True,
            "supports_transcription": False,
            "supports_transcription_language": None,
            "recording_consent_given": False,
        },
        
        # ============= AUDIT & COMPLIANCE =============
        "created_at": now,
        "updated_at": now,
        "created_by": str(caller_id),
        
        # ============= ADMIN METADATA =============
        "is_test_call": False,
        "is_emergency_call": False,
        "notes": None,
    }
    
    return doc


# ============================================================
#                   CALL HELPER FUNCTIONS
# ============================================================

def get_call_duration(call: dict) -> int:
    """✅ ENHANCED: Calculate call duration in seconds"""
    if not call.get("started_at") or not call.get("ended_at"):
        return 0
    
    duration = (call["ended_at"] - call["started_at"]).total_seconds()
    return max(0, int(duration))


def is_call_missed(call: dict) -> bool:
    """✅ ENHANCED: Check if call was missed"""
    return call.get("status") == "missed"


def is_call_active(call: dict) -> bool:
    """✅ ENHANCED: Check if call is still active"""
    return call.get("status") in ["ringing", "accepted"]


def is_call_completed(call: dict) -> bool:
    """✅ ENHANCED: Check if call was completed successfully"""
    return call.get("status") == "ended" and get_call_duration(call) > MIN_CALL_DURATION


def get_call_status_emoji(call: dict) -> str:
    """✅ ENHANCED: Get emoji for call status"""
    status_emoji = {
        "ringing": "📞",
        "accepted": "✅",
        "rejected": "❌",
        "missed": "📵",
        "ended": "✔️",
        "failed": "⚠️"
    }
    return status_emoji.get(call.get("status"), "❓")


def format_call_duration(seconds: int) -> str:
    """✅ ENHANCED: Format call duration for display"""
    if seconds < 60:
        return f"{seconds}s"
    elif seconds < 3600:
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}m {secs}s"
    else:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours}h {minutes}m"


def get_connection_quality_description(quality: str) -> str:
    """✅ ENHANCED: Get human-readable quality description"""
    quality_map = {
        "excellent": "Excellent - Crystal clear 🌟",
        "good": "Good - Clear connection ✅",
        "fair": "Fair - Some audio issues ⚠️",
        "poor": "Poor - Significant issues ❌",
        "failed": "Failed - No connection ❌"
    }
    return quality_map.get(quality, "Unknown")


# ============================================================
#                   CALL CLASS
# ============================================================

class Call:
    """✅ ENHANCED: Call model class"""
    
    @staticmethod
    def create(chat_id: str, caller_id: str, receiver_id: str, call_type: str, **kwargs) -> str:
        """Create a new call"""
        try:
            doc = call_document(chat_id, caller_id, receiver_id, call_type, **kwargs)
            db = get_db()
            result = db.calls.insert_one(doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"[CALL CREATE] Error: {e}")
            raise

    @staticmethod
    def find_by_id(call_id: str) -> dict:
        """Find call by ID"""
        try:
            db = get_db()
            return db.calls.find_one({"_id": ObjectId(str(call_id))})
        except Exception as e:
            logger.error(f"[CALL FIND] Error: {e}")
            return None

    @staticmethod
    def find_by_user(user_id: str) -> list:
        """Find calls for a user"""
        try:
            db = get_db()
            return list(db.calls.find({
                "$or": [{"caller_id": str(user_id)}, {"receiver_id": str(user_id)}]
            }))
        except Exception as e:
            logger.error(f"[CALL FIND USER] Error: {e}")
            return []


__all__ = [
    "Call",
    "call_document",
    "validate_call_data",
    "get_call_duration",
    "is_call_missed",
    "is_call_active",
    "is_call_completed",
    "get_call_status_emoji",
    "format_call_duration",
    "get_connection_quality_description"
]
