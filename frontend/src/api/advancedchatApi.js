// FILE: src/api/advancedChatApi.js
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default {
  // -------------------------------
  // 1. Sentiment Analysis
  // POST /api/chat/analyze-sentiment
  // -------------------------------
  async analyzeSentiment(message, token) {
    const res = await axios.post(
      `${API}/api/chat/analyze-sentiment`,
      { message },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data; // { sentiment: "positive" | "negative" | "neutral" }
  },

  // -------------------------------
  // 2. Translation
  // POST /api/chat/translate
  // -------------------------------
  async translateMessage(message, targetLanguage, token) {
    const res = await axios.post(
      `${API}/api/chat/translate`,
      { message, target_language: targetLanguage },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data; 
    /*
      {
        translated_message: "...",
        original_message: "...",
        target_language: "es"
      }
    */
  },

  // -------------------------------
  // 3. Smart Replies
  // POST /api/chat/smart-replies
  // -------------------------------
  async getSmartReplies(conversationContext, token) {
    const res = await axios.post(
      `${API}/api/chat/smart-replies`,
      { conversation_context: conversationContext },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data; 
    /*
      { suggestions: ["Okay", "Thanks!", ...] }
    */
  },

  // -------------------------------
  // 4. Create Poll
  // POST /api/chat/polls
  // -------------------------------
  async createPoll(question, options, roomId, isAnonymous, allowsMultiple, token) {
    const res = await axios.post(
      `${API}/api/chat/polls`,
      {
        question,
        options,
        room_id: roomId,
        is_anonymous: isAnonymous,
        allows_multiple: allowsMultiple,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data; 
    /*
      { poll_id: "...", message: "Poll created successfully" }
    */
  },

  // -------------------------------
  // 5. Vote on Poll
  // POST /api/chat/polls/:poll_id/vote
  // -------------------------------
  async votePoll(pollId, optionIndex, token) {
    const res = await axios.post(
      `${API}/api/chat/polls/${pollId}/vote`,
      { option_index: optionIndex },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
    /*
      {
        message: "Vote recorded successfully",
        results: { ...updatedPollResults }
      }
    */
  },
};
