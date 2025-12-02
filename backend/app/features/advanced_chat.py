"""
Advanced chat features:
- Sentiment analysis
- Message translation
- Smart reply suggestions
- Polls with voting
- Real-time poll updates
- Comprehensive validation
- Rate limiting
- Access control
- Audit logging
"""

import logging
import traceback
from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from app import socketio
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app.utils.validators import validate_message_content

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

advanced_chat_bp = Blueprint("advanced_chat", __name__, url_prefix="/api/chat")


# ============================================================
#                   CONSTANTS
# ============================================================

MAX_POLL_QUESTION_LENGTH = 500
MAX_POLL_OPTION_LENGTH = 200
MAX_POLL_OPTIONS = 20
MIN_POLL_OPTIONS = 2
MAX_MESSAGE_LENGTH = 65536  # 64KB
MAX_SENTIMENT_ANALYSES_PER_MINUTE = 60
MAX_TRANSLATIONS_PER_MINUTE = 30
MAX_POLLS_PER_MINUTE = 10
POLL_TIMEOUT = 86400  # 24 hours


# ============================================================
#                   AUDIT LOGGING
# ============================================================

class AdvancedChatAuditLogger:
    """✅ ENHANCED: Comprehensive audit logging for advanced features"""
    
    COLLECTION = "advanced_chat_audit_logs"
    
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()
        try:
            self.db[self.COLLECTION].create_index([("timestamp", -1)])
            self.db[self.COLLECTION].create_index([("event", 1)])
            self.db[self.COLLECTION].create_index([("user_id", 1)])
            self.db[self.COLLECTION].create_index([("poll_id", 1)])
            # TTL index: auto-delete logs after 30 days
            self.db[self.COLLECTION].create_index([("timestamp", 1)], expireAfterSeconds=2592000)
        except Exception as e:
            logger.warning(f"[ADVANCED CHAT AUDIT] Index creation failed: {e}")
    
    def log(self, event: str, user_id: str, status: str = "success", 
            details: dict = None, error_msg: str = ""):
        """✅ ENHANCED: Log advanced chat event"""
        try:
            doc = {
                "event": event,
                "user_id": user_id,
                "status": status,
                "details": details or {},
                "error": error_msg,
                "ip_address": request.remote_addr if request else None,
                "timestamp": now_utc()
            }
            self.db[self.COLLECTION].insert_one(doc)
        except Exception as e:
            logger.error(f"[ADVANCED CHAT AUDIT] Failed to log: {e}")


advanced_chat_audit_logger = AdvancedChatAuditLogger()


# ============================================================
#                   RATE LIMITING
# ============================================================

class AdvancedChatRateLimiter:
    """✅ ENHANCED: Rate limiting for advanced features"""
    
    def __init__(self):
        self.operations = {}  # user_id -> [(timestamp, op_type), ...]
    
    def check_limit(self, user_id: str, operation: str, limit: int) -> tuple:
        """✅ ENHANCED: Check if operation is within rate limit"""
        import time
        
        now = time.time()
        
        if user_id not in self.operations:
            self.operations[user_id] = []
        
        # Clean old entries (older than 1 minute)
        cutoff = now - 60
        self.operations[user_id] = [
            (ts, op) for ts, op in self.operations[user_id] if ts > cutoff
        ]
        
        # Count operations
        count = sum(1 for _, op in self.operations[user_id] if op == operation)
        
        if count >= limit:
            return False, f"Rate limit exceeded for {operation} ({limit}/min)"
        
        self.operations[user_id].append((now, operation))
        return True, ""


advanced_chat_rate_limiter = AdvancedChatRateLimiter()


# ============================================================
#                   AI/ML SERVICES
# ============================================================

class ChatAnalyzer:
    """✅ ENHANCED: Sentiment analysis with better heuristics"""
    
    # ✅ ENHANCED: Expanded sentiment dictionaries
    POSITIVE_WORDS = {
        "happy", "good", "great", "awesome", "excellent", "wonderful",
        "fantastic", "love", "amazing", "brilliant", "perfect", "joy",
        "delighted", "grateful", "blessed", "excited", "thrilled"
    }
    
    NEGATIVE_WORDS = {
        "sad", "bad", "terrible", "hate", "awful", "horrible", "worse",
        "angry", "frustrated", "annoyed", "disappointed", "disgusted",
        "depressed", "miserable", "upset", "furious", "despise"
    }
    
    def analyze_sentiment(self, msg: str) -> dict:
        """
        ✅ ENHANCED: Analyze sentiment with confidence score
        
        Returns: {
            sentiment: "positive" | "negative" | "neutral",
            confidence: float (0-1),
            details: dict
        }
        """
        try:
            if not msg or not isinstance(msg, str):
                return {"sentiment": "neutral", "confidence": 0.0, "details": {}}
            
            text_lower = msg.lower()
            words = set(text_lower.split())
            
            # ✅ ENHANCED: Count sentiment words
            positive_count = len(words & self.POSITIVE_WORDS)
            negative_count = len(words & self.NEGATIVE_WORDS)
            total_words = len(words)
            
            if total_words == 0:
                return {"sentiment": "neutral", "confidence": 0.0, "details": {}}
            
            # ✅ ENHANCED: Calculate confidence
            if positive_count > negative_count:
                confidence = min(positive_count / max(total_words, 1), 1.0)
                sentiment = "positive"
            elif negative_count > positive_count:
                confidence = min(negative_count / max(total_words, 1), 1.0)
                sentiment = "negative"
            else:
                confidence = 0.0
                sentiment = "neutral"
            
            return {
                "sentiment": sentiment,
                "confidence": round(confidence, 2),
                "details": {
                    "positive_words": positive_count,
                    "negative_words": negative_count,
                    "total_words": total_words
                }
            }
        
        except Exception as e:
            logger.error(f"[SENTIMENT ANALYSIS] Error: {e}")
            return {"sentiment": "neutral", "confidence": 0.0, "details": {"error": str(e)}}
    
    def smart_reply_suggestions(self, context: str) -> list:
        """✅ ENHANCED: Generate context-aware replies"""
        try:
            if not context or not isinstance(context, str):
                return ["Okay", "Thanks!", "I see"]
            
            context_lower = context.lower()
            
            # ✅ ENHANCED: Context-based suggestions
            if any(w in context_lower for w in ["?", "what", "how", "why", "when"]):
                suggestions = [
                    "Could you provide more details?",
                    "I need to think about that",
                    "That's an interesting question",
                    "Can you clarify?",
                    "Let me know more"
                ]
            elif any(w in context_lower for w in ["thank", "thanks", "appreciate"]):
                suggestions = [
                    "You're welcome!",
                    "Happy to help",
                    "Anytime!",
                    "My pleasure",
                    "No problem"
                ]
            elif any(w in context_lower for w in ["help", "please", "assist"]):
                suggestions = [
                    "Of course!",
                    "I'll help you",
                    "Absolutely",
                    "Let's figure this out",
                    "On it!"
                ]
            else:
                suggestions = [
                    "Okay",
                    "Thanks!",
                    "I see",
                    "Interesting",
                    "Tell me more"
                ]
            
            return suggestions
        
        except Exception as e:
            logger.error(f"[SMART REPLIES] Error: {e}")
            return ["Okay", "Thanks!", "I see"]


class MessageTranslator:
    """✅ ENHANCED: Message translation (mock - replace with real API)"""
    
    SUPPORTED_LANGUAGES = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "ja": "Japanese",
        "zh": "Chinese",
        "ru": "Russian",
        "ar": "Arabic"
    }
    
    def translate_message(self, msg: str, target_lang: str = "es") -> dict:
        """
        ✅ ENHANCED: Translate message
        
        Returns: {
            original: str,
            translated: str,
            target_language: str,
            language_name: str
        }
        """
        try:
            if not msg or not isinstance(msg, str):
                return {
                    "error": "Invalid message",
                    "original": msg,
                    "translated": ""
                }
            
            # ✅ ENHANCED: Validate language code
            if target_lang not in self.SUPPORTED_LANGUAGES:
                return {
                    "error": f"Unsupported language: {target_lang}",
                    "supported": list(self.SUPPORTED_LANGUAGES.keys())
                }
            
            # ✅ ENHANCED: Mock translation (replace with real API like Google Translate)
            # In production, use: from google.cloud import translate_v2
            mock_translations = {
                "es": f"Traducido: {msg}",
                "fr": f"Traduit: {msg}",
                "de": f"Übersetzt: {msg}",
                "it": f"Tradotto: {msg}",
                "pt": f"Traduzido: {msg}",
                "ja": f"翻訳: {msg}",
                "zh": f"翻译: {msg}",
                "ru": f"Переведено: {msg}",
                "ar": f"مترجم: {msg}"
            }
            
            return {
                "original": msg,
                "translated": mock_translations.get(target_lang, f"Translated to {target_lang}: {msg}"),
                "target_language": target_lang,
                "language_name": self.SUPPORTED_LANGUAGES.get(target_lang)
            }
        
        except Exception as e:
            logger.error(f"[TRANSLATION] Error: {e}")
            return {"error": str(e), "original": msg, "translated": ""}


chat_analyzer = ChatAnalyzer()
translator = MessageTranslator()


# ============================================================
#                   VALIDATION HELPERS
# ============================================================

def validate_poll_question(question: str) -> tuple:
    """✅ ENHANCED: Validate poll question"""
    if not question or not isinstance(question, str):
        return False, "Question must be a non-empty string"
    
    question = question.strip()
    
    if len(question) < 3:
        return False, "Question too short (min 3 chars)"
    
    if len(question) > MAX_POLL_QUESTION_LENGTH:
        return False, f"Question too long (max {MAX_POLL_QUESTION_LENGTH} chars)"
    
    return True, question


def validate_poll_options(options: list) -> tuple:
    """✅ ENHANCED: Validate poll options"""
    if not isinstance(options, list):
        return False, "Options must be a list"
    
    if len(options) < MIN_POLL_OPTIONS:
        return False, f"Need at least {MIN_POLL_OPTIONS} options"
    
    if len(options) > MAX_POLL_OPTIONS:
        return False, f"Too many options (max {MAX_POLL_OPTIONS})"
    
    # ✅ ENHANCED: Validate each option
    validated_options = []
    for opt in options:
        if not isinstance(opt, str):
            return False, "Each option must be a string"
        
        opt = opt.strip()
        
        if len(opt) < 1:
            return False, "Options cannot be empty"
        
        if len(opt) > MAX_POLL_OPTION_LENGTH:
            return False, f"Option too long (max {MAX_POLL_OPTION_LENGTH} chars)"
        
        validated_options.append(opt)
    
    # ✅ ENHANCED: Check for duplicates
    if len(validated_options) != len(set(validated_options)):
        return False, "Duplicate options not allowed"
    
    return True, validated_options


# ============================================================
#                   SENTIMENT ANALYSIS ENDPOINT
# ============================================================

@advanced_chat_bp.route("/analyze-sentiment", methods=["POST"])
@jwt_required()
def analyze_sentiment():
    """
    ✅ ENHANCED: Analyze message sentiment
    
    POST /api/chat/analyze-sentiment
    {
        "message": "This is great!"
    }
    
    Response: {
        "sentiment": "positive",
        "confidence": 0.8,
        "details": {...}
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        message = data.get("message", "").strip()
        
        # ✅ ENHANCED: Validate input
        if not message:
            logger.warning(f"[SENTIMENT] Empty message from {user_id}")
            return error("Message is required", 400)
        
        if len(message) > MAX_MESSAGE_LENGTH:
            return error(f"Message too long (max {MAX_MESSAGE_LENGTH} bytes)", 400)
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = advanced_chat_rate_limiter.check_limit(
            user_id, "sentiment", MAX_SENTIMENT_ANALYSES_PER_MINUTE
        )
        if not allowed:
            logger.warning(f"[SENTIMENT] Rate limit for {user_id}")
            return error(msg, 429)
        
        # ✅ ENHANCED: Analyze sentiment
        result = chat_analyzer.analyze_sentiment(message)
        
        advanced_chat_audit_logger.log(
            "SENTIMENT_ANALYSIS", user_id,
            details={
                "message_length": len(message),
                "sentiment": result["sentiment"],
                "confidence": result["confidence"]
            }
        )
        
        logger.info(f"[SENTIMENT] User {user_id}: {result['sentiment']}")
        
        return success("Sentiment analyzed", data=result)
    
    except Exception as e:
        logger.error(f"[SENTIMENT ERROR] {e}")
        logger.error(traceback.format_exc())
        advanced_chat_audit_logger.log(
            "SENTIMENT_ANALYSIS", user_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to analyze sentiment", 500)


# ============================================================
#                   TRANSLATION ENDPOINT
# ============================================================

@advanced_chat_bp.route("/translate", methods=["POST"])
@jwt_required()
def translate_message_endpoint():
    """
    ✅ ENHANCED: Translate message to target language
    
    POST /api/chat/translate
    {
        "message": "Hello!",
        "target_language": "es"
    }
    
    Response: {
        "original": "Hello!",
        "translated": "¡Hola!",
        "target_language": "es",
        "language_name": "Spanish"
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        message = data.get("message", "").strip()
        target_lang = data.get("target_language", "es").lower()
        
        # ✅ ENHANCED: Validate input
        if not message:
            return error("Message is required", 400)
        
        if len(message) > MAX_MESSAGE_LENGTH:
            return error(f"Message too long", 400)
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = advanced_chat_rate_limiter.check_limit(
            user_id, "translate", MAX_TRANSLATIONS_PER_MINUTE
        )
        if not allowed:
            return error(msg, 429)
        
        # ✅ ENHANCED: Translate
        result = translator.translate_message(message, target_lang)
        
        if "error" in result:
            logger.warning(f"[TRANSLATE] Error: {result['error']}")
            return error(result["error"], 400)
        
        advanced_chat_audit_logger.log(
            "MESSAGE_TRANSLATION", user_id,
            details={
                "target_language": target_lang,
                "message_length": len(message)
            }
        )
        
        logger.info(f"[TRANSLATE] User {user_id}: {message} -> {target_lang}")
        
        return success("Message translated", data=result)
    
    except Exception as e:
        logger.error(f"[TRANSLATE ERROR] {e}")
        logger.error(traceback.format_exc())
        advanced_chat_audit_logger.log(
            "MESSAGE_TRANSLATION", user_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to translate message", 500)


# ============================================================
#                   SMART REPLIES ENDPOINT
# ============================================================

@advanced_chat_bp.route("/smart-replies", methods=["POST"])
@jwt_required()
def smart_replies_endpoint():
    """
    ✅ ENHANCED: Generate smart reply suggestions
    
    POST /api/chat/smart-replies
    {
        "conversation_context": "What time is the meeting?"
    }
    
    Response: {
        "suggestions": [
            "Could you provide more details?",
            "I need to think about that",
            ...
        ]
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        context = data.get("conversation_context", "").strip()
        
        # ✅ ENHANCED: Validate input
        if not context:
            return error("Conversation context required", 400)
        
        if len(context) > MAX_MESSAGE_LENGTH:
            return error("Context too long", 400)
        
        # ✅ ENHANCED: Generate suggestions
        suggestions = chat_analyzer.smart_reply_suggestions(context)
        
        advanced_chat_audit_logger.log(
            "SMART_REPLIES", user_id,
            details={"context_length": len(context)}
        )
        
        logger.debug(f"[SMART REPLIES] Generated {len(suggestions)} suggestions for {user_id}")
        
        return success("Smart replies generated", data={"suggestions": suggestions})
    
    except Exception as e:
        logger.error(f"[SMART REPLIES ERROR] {e}")
        logger.error(traceback.format_exc())
        advanced_chat_audit_logger.log(
            "SMART_REPLIES", user_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to generate smart replies", 500)


# ============================================================
#                   POLLS - CREATE
# ============================================================

@advanced_chat_bp.route("/polls", methods=["POST"])
@jwt_required()
def create_poll():
    """
    ✅ ENHANCED: Create new poll
    
    POST /api/chat/polls
    {
        "question": "What's your favorite color?",
        "options": ["Red", "Blue", "Green"],
        "chat_id": "chat_123",
        "allows_multiple": false,
        "is_anonymous": false
    }
    
    Response: {
        "poll_id": "poll_123",
        "question": "...",
        "options": [...],
        ...
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        
        # ✅ ENHANCED: Validate inputs
        valid, question = validate_poll_question(data.get("question", ""))
        if not valid:
            return error(question, 400)
        
        valid, options = validate_poll_options(data.get("options", []))
        if not valid:
            return error(options, 400)
        
        chat_id = str(data.get("chat_id", "")).strip()
        if not chat_id:
            return error("chat_id required", 400)
        
        # ✅ ENHANCED: Rate limiting
        allowed, msg = advanced_chat_rate_limiter.check_limit(
            user_id, "create_poll", MAX_POLLS_PER_MINUTE
        )
        if not allowed:
            return error(msg, 429)
        
        # ✅ ENHANCED: Verify user in chat
        db = get_db()
        chat = db.chats.find_one({
            "_id": ObjectId(chat_id),
            "participants": user_id
        })
        
        if not chat:
            logger.warning(f"[POLL] User {user_id} not in chat {chat_id}")
            return error("Access denied to chat", 403)
        
        # ✅ ENHANCED: Create poll document
        poll_doc = {
            "question": question,
            "options": options,
            "created_by": user_id,
            "chat_id": chat_id,
            "is_anonymous": bool(data.get("is_anonymous", False)),
            "allows_multiple": bool(data.get("allows_multiple", False)),
            "created_at": now_utc(),
            "ends_at": now_utc() + timedelta(hours=24),
            "is_active": True,
            "votes": {},  # user_id -> option_index or [option_indices]
            "metadata": {
                "vote_count": 0,
                "unique_voters": 0
            }
        }
        
        result = db.polls.insert_one(poll_doc)
        poll_id = str(result.inserted_id)
        
        # ✅ ENHANCED: Prepare broadcast
        poll_response = {
            "poll_id": poll_id,
            "question": question,
            "options": options,
            "created_by": user_id,
            "chat_id": chat_id,
            "is_anonymous": poll_doc["is_anonymous"],
            "allows_multiple": poll_doc["allows_multiple"],
            "created_at": poll_doc["created_at"].isoformat(),
            "ends_at": poll_doc["ends_at"].isoformat()
        }
        
        # ✅ ENHANCED: Broadcast to chat
        socketio.emit(
            "poll:created",
            poll_response,
            room=f"chat:{chat_id}"
        )
        
        advanced_chat_audit_logger.log(
            "POLL_CREATED", user_id,
            details={
                "poll_id": poll_id,
                "chat_id": chat_id,
                "option_count": len(options)
            }
        )
        
        logger.info(f"[POLL CREATE] {user_id} created poll {poll_id}")
        
        return success("Poll created successfully", data=poll_response)
    
    except Exception as e:
        logger.error(f"[CREATE POLL ERROR] {e}")
        logger.error(traceback.format_exc())
        advanced_chat_audit_logger.log(
            "POLL_CREATED", user_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to create poll", 500)


# ============================================================
#                   POLLS - CALCULATE RESULTS
# ============================================================

def calculate_poll_results(poll: dict) -> dict:
    """✅ ENHANCED: Calculate poll results with statistics"""
    try:
        votes = poll.get("votes", {})
        options = poll.get("options", [])
        allows_multiple = poll.get("allows_multiple", False)
        
        # ✅ ENHANCED: Initialize counters
        vote_counts = {i: 0 for i in range(len(options))}
        
        # ✅ ENHANCED: Count votes
        for user_id, vote in votes.items():
            if allows_multiple and isinstance(vote, list):
                for idx in vote:
                    if 0 <= idx < len(options):
                        vote_counts[idx] += 1
            elif isinstance(vote, int) and 0 <= vote < len(options):
                vote_counts[vote] += 1
        
        # ✅ ENHANCED: Calculate percentages
        total_votes = sum(vote_counts.values())
        percentages = {}
        
        for idx, count in vote_counts.items():
            if total_votes > 0:
                percentages[idx] = round((count / total_votes) * 100, 2)
            else:
                percentages[idx] = 0.0
        
        return {
            "question": poll.get("question"),
            "options": options,
            "votes": vote_counts,
            "percentages": percentages,
            "total_votes": total_votes,
            "unique_voters": len(votes),
            "allows_multiple": allows_multiple,
            "is_active": poll.get("is_active", True),
            "created_at": poll.get("created_at").isoformat() if poll.get("created_at") else None,
            "ends_at": poll.get("ends_at").isoformat() if poll.get("ends_at") else None
        }
    
    except Exception as e:
        logger.error(f"[CALCULATE RESULTS] Error: {e}")
        return {}


# ============================================================
#                   POLLS - VOTE
# ============================================================

@advanced_chat_bp.route("/polls/<poll_id>/vote", methods=["POST"])
@jwt_required()
def vote_on_poll(poll_id):
    """
    ✅ ENHANCED: Vote on poll
    
    POST /api/chat/polls/{poll_id}/vote
    {
        "option_index": 0
    }
    
    For multiple choice:
    {
        "option_indices": [0, 2]
    }
    
    Response: {
        "results": {
            "votes": {...},
            "percentages": {...},
            "total_votes": 5,
            ...
        }
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        
        # ✅ ENHANCED: Validate poll exists
        db = get_db()
        poll = db.polls.find_one({"_id": ObjectId(poll_id)})
        
        if not poll:
            logger.warning(f"[VOTE] Poll not found: {poll_id}")
            return error("Poll not found", 404)
        
        # ✅ ENHANCED: Check if poll is active
        if not poll.get("is_active", True):
            return error("This poll is closed", 400)
        
        # ✅ ENHANCED: Check poll timeout
        if poll.get("ends_at") and now_utc() > poll["ends_at"]:
            db.polls.update_one(
                {"_id": ObjectId(poll_id)},
                {"$set": {"is_active": False}}
            )
            return error("This poll has expired", 400)
        
        # ✅ ENHANCED: Validate option index
        option_indices = None
        
        if poll.get("allows_multiple", False):
            option_indices = data.get("option_indices", [])
            if not isinstance(option_indices, list) or len(option_indices) == 0:
                return error("option_indices required for multiple-choice polls", 400)
        else:
            option_index = data.get("option_index")
            if option_index is None:
                return error("option_index required", 400)
            option_indices = [option_index]
        
        # ✅ ENHANCED: Validate indices are within range
        options_count = len(poll.get("options", []))
        for idx in option_indices:
            if not isinstance(idx, int) or idx < 0 or idx >= options_count:
                return error(f"Invalid option index: {idx}", 400)
        
        # ✅ ENHANCED: Check for duplicate votes on single-choice
        if not poll.get("allows_multiple", False):
            if user_id in poll.get("votes", {}):
                logger.debug(f"[VOTE] User {user_id} already voted")
                return error("You have already voted on this poll", 400)
        
        # ✅ ENHANCED: Record vote
        vote_key = f"votes.{user_id}"
        
        if poll.get("allows_multiple", False):
            db.polls.update_one(
                {"_id": ObjectId(poll_id)},
                {
                    "$set": {vote_key: option_indices},
                    "$inc": {"metadata.vote_count": len(option_indices)}
                }
            )
        else:
            db.polls.update_one(
                {"_id": ObjectId(poll_id)},
                {
                    "$set": {vote_key: option_indices[0]},
                    "$inc": {"metadata.vote_count": 1}
                }
            )
        
        # ✅ ENHANCED: Recalculate and broadcast results
        updated_poll = db.polls.find_one({"_id": ObjectId(poll_id)})
        results = calculate_poll_results(updated_poll)
        
        chat_id = poll.get("chat_id")
        if chat_id:
            socketio.emit(
                "poll:updated",
                {
                    "poll_id": poll_id,
                    "results": results,
                    "voted_by": user_id if not poll.get("is_anonymous") else "anonymous",
                    "voted_at": now_utc().isoformat()
                },
                room=f"chat:{chat_id}"
            )
        
        advanced_chat_audit_logger.log(
            "POLL_VOTED", user_id,
            details={
                "poll_id": poll_id,
                "options": option_indices,
                "chat_id": chat_id
            }
        )
        
        logger.info(f"[VOTE] User {user_id} voted on poll {poll_id}")
        
        return success("Vote recorded successfully", data={"results": results})
    
    except Exception as e:
        logger.error(f"[VOTE ERROR] {e}")
        logger.error(traceback.format_exc())
        advanced_chat_audit_logger.log(
            "POLL_VOTED", user_id,
            status="failed", error_msg=str(e)
        )
        return error("Failed to record vote", 500)


# ============================================================
#                   POLLS - GET RESULTS
# ============================================================

@advanced_chat_bp.route("/polls/<poll_id>/results", methods=["GET"])
@jwt_required()
def get_poll_results(poll_id):
    """
    ✅ ENHANCED: Get poll results
    
    GET /api/chat/polls/{poll_id}/results
    
    Response: {
        "results": {...},
        "has_voted": bool
    }
    """
    try:
        user_id = get_jwt_identity()
        db = get_db()
        
        poll = db.polls.find_one({"_id": ObjectId(poll_id)})
        
        if not poll:
            return error("Poll not found", 404)
        
        results = calculate_poll_results(poll)
        has_voted = user_id in poll.get("votes", {})
        
        return success("Poll results retrieved", data={
            "results": results,
            "has_voted": has_voted
        })
    
    except Exception as e:
        logger.error(f"[GET RESULTS ERROR] {e}")
        return error("Failed to get results", 500)


# ============================================================
#                   POLLS - CLOSE
# ============================================================

@advanced_chat_bp.route("/polls/<poll_id>/close", methods=["POST"])
@jwt_required()
def close_poll(poll_id):
    """✅ ENHANCED: Close poll (only creator or admin)"""
    try:
        user_id = get_jwt_identity()
        db = get_db()
        
        poll = db.polls.find_one({"_id": ObjectId(poll_id)})
        
        if not poll:
            return error("Poll not found", 404)
        
        # ✅ ENHANCED: Verify authorization
        if poll.get("created_by") != user_id:
            logger.warning(f"[POLL CLOSE] User {user_id} not authorized for poll {poll_id}")
            return error("Only poll creator can close it", 403)
        
        # ✅ ENHANCED: Close poll
        db.polls.update_one(
            {"_id": ObjectId(poll_id)},
            {"$set": {"is_active": False}}
        )
        
        chat_id = poll.get("chat_id")
        if chat_id:
            socketio.emit(
                "poll:closed",
                {
                    "poll_id": poll_id,
                    "closed_by": user_id,
                    "closed_at": now_utc().isoformat()
                },
                room=f"chat:{chat_id}"
            )
        
        advanced_chat_audit_logger.log("POLL_CLOSED", user_id, details={"poll_id": poll_id})
        
        logger.info(f"[POLL CLOSE] {poll_id} closed by {user_id}")
        
        return success("Poll closed successfully")
    
    except Exception as e:
        logger.error(f"[CLOSE POLL ERROR] {e}")
        return error("Failed to close poll", 500)


# ============================================================
#                   INITIALIZATION
# ============================================================

def init_advanced_chat():
    """✅ ENHANCED: Initialize advanced chat features"""
    logger.info("[ADVANCED CHAT] Initialized with sentiment, translation, and polls")


__all__ = [
    "advanced_chat_bp",
    "ChatAnalyzer",
    "MessageTranslator",
    "calculate_poll_results",
    "init_advanced_chat"
]
