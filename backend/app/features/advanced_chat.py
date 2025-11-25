# backend/app/features/advanced_chat.py

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

from app.database import get_db
from app import socketio

# Utils
from app.utils.response_builder import success, error
from app.utils.helpers import now_utc
from app.utils.validators import validate_message_content

advanced_chat_bp = Blueprint("advanced_chat", __name__, url_prefix="/api/chat")
db = get_db()


# ---------------------------------------------------------
# Mock AI Service (Replace with real LLM / ML models)
# ---------------------------------------------------------
class ChatAnalyzer:
    def analyze_sentiment(self, msg):
        text = msg.lower()
        if any(w in text for w in ["happy", "good", "great", "awesome"]):
            return "positive"
        if any(w in text for w in ["sad", "bad", "terrible", "hate"]):
            return "negative"
        return "neutral"

    def smart_reply_suggestions(self, ctx):
        return ["Okay", "Thanks!", "I see", "Interesting", "Could you explain more?"]


class MessageTranslator:
    def translate_message(self, msg, lang="es"):
        translations = {
            "es": f"Traducido: {msg}",
            "fr": f"Traduit: {msg}",
            "de": f"Übersetzt: {msg}"
        }
        return translations.get(lang, f"Translated: {msg}")


chat_analyzer = ChatAnalyzer()
translator = MessageTranslator()


# ---------------------------------------------------------
# SENTIMENT ANALYSIS
# ---------------------------------------------------------
@advanced_chat_bp.route("/analyze-sentiment", methods=["POST"])
@jwt_required()
def analyze_sentiment():
    try:
        data = request.get_json() or {}
        message = data.get("message")

        if not message:
            return error("Message is required", 400)

        sentiment = chat_analyzer.analyze_sentiment(message)
        return success(data={"sentiment": sentiment})

    except Exception as e:
        current_app.logger.error(f"[SENTIMENT ERROR] {str(e)}")
        return error("Failed to analyze sentiment", 500)


# ---------------------------------------------------------
# TRANSLATION
# ---------------------------------------------------------
@advanced_chat_bp.route("/translate", methods=["POST"])
@jwt_required()
def translate_message():
    try:
        data = request.get_json() or {}
        message = data.get("message")
        lang = data.get("target_language", "es")

        if not message:
            return error("Message is required", 400)

        translated = translator.translate_message(message, lang)

        return success(data={
            "translated_message": translated,
            "original_message": message,
            "target_language": lang
        })

    except Exception as e:
        current_app.logger.error(f"[TRANSLATE ERROR] {str(e)}")
        return error("Failed to translate message", 500)


# ---------------------------------------------------------
# SMART REPLIES
# ---------------------------------------------------------
@advanced_chat_bp.route("/smart-replies", methods=["POST"])
@jwt_required()
def smart_replies():
    try:
        data = request.get_json() or {}
        context = data.get("conversation_context")

        if not context:
            return error("Conversation context required", 400)

        replies = chat_analyzer.smart_reply_suggestions(context)
        return success(data={"suggestions": replies})

    except Exception as e:
        current_app.logger.error(f"[SMART REPLIES ERROR] {str(e)}")
        return error("Failed to generate smart replies", 500)


# ---------------------------------------------------------
# POLLS – Create Poll
# ---------------------------------------------------------
@advanced_chat_bp.route("/polls", methods=["POST"])
@jwt_required()
def create_poll():
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        question = data.get("question")
        options = data.get("options")

        if not question or not options:
            return error("Question and options are required", 400)

        poll = {
            "question": question,
            "options": options,
            "created_by": user_id,
            "room_id": data.get("room_id", "general"),
            "is_anonymous": data.get("is_anonymous", False),
            "allows_multiple": data.get("allows_multiple", False),
            "created_at": now_utc(),
            "is_active": True,
            "votes": {}
        }

        result = db.polls.insert_one(poll)
        poll_id = str(result.inserted_id)

        socketio.emit(
            "new_poll",
            {
                "poll_id": poll_id,
                "question": question,
                "options": options,
                "created_by": user_id,
                "room_id": poll["room_id"]
            },
            room=poll["room_id"]
        )

        return success("Poll created successfully", {"poll_id": poll_id})

    except Exception as e:
        current_app.logger.error(f"[CREATE POLL ERROR] {str(e)}")
        return error("Failed to create poll", 500)


# ---------------------------------------------------------
# Poll Results Calculation Utility
# ---------------------------------------------------------
def calculate_poll_results(poll):
    votes = poll.get("votes", {})
    options = poll.get("options", [])

    count = {i: 0 for i in range(len(options))}

    for _, vote in votes.items():
        if isinstance(vote, list):  # Multiple choice
            for idx in vote:
                if idx in count:
                    count[idx] += 1
        else:  # Single choice
            if vote in count:
                count[vote] += 1

    return {
        "question": poll.get("question"),
        "options": options,
        "votes": count,
        "total_votes": len(votes)
    }


# ---------------------------------------------------------
# VOTE ON POLL
# ---------------------------------------------------------
@advanced_chat_bp.route("/polls/<poll_id>/vote", methods=["POST"])
@jwt_required()
def vote_on_poll(poll_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        option_index = data.get("option_index")
        if option_index is None:
            return error("Option index required", 400)

        poll = db.polls.find_one({"_id": ObjectId(poll_id)})
        if not poll:
            return error("Poll not found", 404)

        # Prevent double voting for single-choice polls
        if not poll.get("allows_multiple", False) and user_id in poll.get("votes", {}):
            return error("You have already voted on this poll", 400)

        # Update vote
        vote_key = f"votes.{user_id}"

        if poll.get("allows_multiple", False):
            db.polls.update_one(
                {"_id": ObjectId(poll_id)},
                {"$addToSet": {vote_key: option_index}}
            )
        else:
            db.polls.update_one(
                {"_id": ObjectId(poll_id)},
                {"$set": {vote_key: option_index}}
            )

        # Fetch updated poll + compute results
        updated_poll = db.polls.find_one({"_id": ObjectId(poll_id)})
        results = calculate_poll_results(updated_poll)

        socketio.emit(
            "poll_updated",
            {"poll_id": poll_id, "results": results},
            room=poll.get("room_id", "general")
        )

        return success("Vote recorded successfully", {"results": results})

    except Exception as e:
        current_app.logger.error(f"[VOTE ERROR] {str(e)}")
        return error("Failed to record vote", 500)
