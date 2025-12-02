/**
 * SecureChannelX - Advanced Chat API
 * -----------------------------------
 * Advanced chat features API client with:
 *   - Sentiment Analysis
 *   - Message Translation
 *   - Smart Replies
 *   - Polls & Voting
 *   - Message Scheduling
 *   - Auto-deletion
 *   - Message Pinning
 *   - Thread Management
 */

import axios from "axios";

// ✅ FIX: Correct API URL (backend runs on port 5050)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

// ✅ ENHANCEMENT: Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ ENHANCEMENT: Request interceptor for automatic token injection
api.interceptors.request.use(
  (config) => {
    // Auto-inject token from localStorage if not provided
    if (!config.headers.Authorization) {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ ENHANCEMENT: Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle specific error cases
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          console.error("❌ Unauthorized: Invalid or expired token");
          // Optionally redirect to login
          break;
        case 403:
          console.error("❌ Forbidden: Insufficient permissions");
          break;
        case 404:
          console.error("❌ Not found:", data.message || "Resource not found");
          break;
        case 429:
          console.error("❌ Rate limited: Too many requests");
          break;
        case 500:
          console.error("❌ Server error:", data.message || "Internal server error");
          break;
        default:
          console.error(`❌ API Error (${status}):`, data.message || error.message);
      }
    } else if (error.request) {
      console.error("❌ Network error: No response from server");
    } else {
      console.error("❌ Request error:", error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================================
//                   ADVANCED CHAT API
// ============================================================

const advancedChatApi = {
  // ============================================================
  //                   SENTIMENT ANALYSIS
  // ============================================================

  /**
   * ✅ ENHANCED: Analyze message sentiment
   *
   * @param {string} message - Message text to analyze
   * @param {string} [token] - Optional JWT token (auto-injected if not provided)
   * @returns {Promise<object>} - { sentiment: "positive"|"negative"|"neutral", confidence: 0.95 }
   */
  async analyzeSentiment(message, token = null) {
    try {
      if (!message || typeof message !== "string") {
        throw new Error("Message must be a non-empty string");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/chat/analyze-sentiment",
        { message },
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error("[Sentiment Analysis] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   MESSAGE TRANSLATION
  // ============================================================

  /**
   * ✅ ENHANCED: Translate message to target language
   *
   * @param {string} message - Message to translate
   * @param {string} targetLanguage - Target language code (e.g., "es", "fr", "de")
   * @param {string} [sourceLanguage] - Optional source language (auto-detect if not provided)
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { translated_message, original_message, target_language, source_language }
   */
  async translateMessage(message, targetLanguage, sourceLanguage = "auto", token = null) {
    try {
      if (!message || typeof message !== "string") {
        throw new Error("Message must be a non-empty string");
      }

      if (!targetLanguage || typeof targetLanguage !== "string") {
        throw new Error("Target language must be specified");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/chat/translate",
        {
          message,
          target_language: targetLanguage,
          source_language: sourceLanguage,
        },
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error("[Translation] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get supported translation languages
   */
  async getSupportedLanguages(token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get("/api/chat/languages", { headers });
      return response.data;
    } catch (error) {
      console.error("[Languages] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   SMART REPLIES
  // ============================================================

  /**
   * ✅ ENHANCED: Get smart reply suggestions
   *
   * @param {Array<object>} conversationContext - Recent messages for context
   * @param {number} [maxSuggestions=3] - Maximum number of suggestions
   * @param {string} [tone="casual"] - Tone: "casual", "formal", "friendly"
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { suggestions: ["Reply 1", "Reply 2", ...] }
   */
  async getSmartReplies(conversationContext, maxSuggestions = 3, tone = "casual", token = null) {
    try {
      if (!Array.isArray(conversationContext) || conversationContext.length === 0) {
        throw new Error("Conversation context must be a non-empty array");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/chat/smart-replies",
        {
          conversation_context: conversationContext,
          max_suggestions: maxSuggestions,
          tone: tone,
        },
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error("[Smart Replies] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   POLLS & VOTING
  // ============================================================

  /**
   * ✅ ENHANCED: Create a poll in a chat
   *
   * @param {object} pollData - Poll configuration
   * @param {string} pollData.question - Poll question
   * @param {Array<string>} pollData.options - Poll options
   * @param {string} pollData.chatId - Chat/Room ID
   * @param {boolean} [pollData.isAnonymous=false] - Anonymous voting
   * @param {boolean} [pollData.allowsMultiple=false] - Allow multiple selections
   * @param {number} [pollData.expiresInHours] - Poll expiration (hours)
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { poll_id, message, poll }
   */
  async createPoll(pollData, token = null) {
    try {
      const { question, options, chatId, isAnonymous = false, allowsMultiple = false, expiresInHours } = pollData;

      // Validation
      if (!question || typeof question !== "string") {
        throw new Error("Poll question is required");
      }

      if (!Array.isArray(options) || options.length < 2) {
        throw new Error("Poll must have at least 2 options");
      }

      if (options.length > 10) {
        throw new Error("Poll cannot have more than 10 options");
      }

      if (!chatId) {
        throw new Error("Chat ID is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/chat/polls",
        {
          question,
          options,
          room_id: chatId,
          chat_id: chatId, // ✅ Support both naming conventions
          is_anonymous: isAnonymous,
          allows_multiple: allowsMultiple,
          expires_in_hours: expiresInHours,
        },
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error("[Create Poll] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ ENHANCED: Vote on a poll
   *
   * @param {string} pollId - Poll ID
   * @param {number|Array<number>} optionIndex - Option index (or array for multiple)
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { message, results }
   */
  async votePoll(pollId, optionIndex, token = null) {
    try {
      if (!pollId) {
        throw new Error("Poll ID is required");
      }

      if (optionIndex === null || optionIndex === undefined) {
        throw new Error("Option index is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        `/api/chat/polls/${pollId}/vote`,
        { option_index: optionIndex },
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error("[Vote Poll] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get poll results
   */
  async getPollResults(pollId, token = null) {
    try {
      if (!pollId) {
        throw new Error("Poll ID is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/api/chat/polls/${pollId}/results`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Poll Results] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Close/end a poll
   */
  async closePoll(pollId, token = null) {
    try {
      if (!pollId) {
        throw new Error("Poll ID is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.post(`/api/chat/polls/${pollId}/close`, {}, { headers });
      return response.data;
    } catch (error) {
      console.error("[Close Poll] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   MESSAGE SCHEDULING
  // ============================================================

  /**
   * ✅ NEW: Schedule a message for later delivery
   *
   * @param {object} messageData - Message configuration
   * @param {string} messageData.chatId - Chat ID
   * @param {string} messageData.content - Message content
   * @param {Date|string} messageData.scheduledTime - Scheduled delivery time
   * @param {string} [token] - Optional JWT token
   * @returns {Promise<object>} - { scheduled_message_id, message }
   */
  async scheduleMessage(messageData, token = null) {
    try {
      const { chatId, content, scheduledTime } = messageData;

      if (!chatId || !content || !scheduledTime) {
        throw new Error("Chat ID, content, and scheduled time are required");
      }

      // Convert Date to ISO string if needed
      const scheduledTimeStr = scheduledTime instanceof Date ? scheduledTime.toISOString() : scheduledTime;

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post(
        "/api/chat/messages/schedule",
        {
          chat_id: chatId,
          content,
          scheduled_time: scheduledTimeStr,
        },
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error("[Schedule Message] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get scheduled messages
   */
  async getScheduledMessages(chatId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/api/chat/messages/scheduled?chat_id=${chatId}`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Get Scheduled Messages] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Cancel a scheduled message
   */
  async cancelScheduledMessage(messageId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.delete(`/api/chat/messages/scheduled/${messageId}`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Cancel Scheduled Message] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   MESSAGE PINNING
  // ============================================================

  /**
   * ✅ NEW: Pin a message in a chat
   */
  async pinMessage(chatId, messageId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.post(
        `/api/chat/${chatId}/messages/${messageId}/pin`,
        {},
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("[Pin Message] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Unpin a message
   */
  async unpinMessage(chatId, messageId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.delete(`/api/chat/${chatId}/messages/${messageId}/pin`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Unpin Message] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get pinned messages in a chat
   */
  async getPinnedMessages(chatId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/api/chat/${chatId}/pinned`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Get Pinned Messages] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   AUTO-DELETION
  // ============================================================

  /**
   * ✅ NEW: Set auto-delete timer for messages
   */
  async setAutoDeleteTimer(chatId, timerSeconds, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.post(
        `/api/chat/${chatId}/auto-delete`,
        { timer_seconds: timerSeconds },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("[Set Auto-Delete] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Disable auto-delete for a chat
   */
  async disableAutoDelete(chatId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.delete(`/api/chat/${chatId}/auto-delete`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Disable Auto-Delete] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   MESSAGE THREADS
  // ============================================================

  /**
   * ✅ NEW: Create a thread from a message
   */
  async createThread(messageId, initialMessage, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.post(
        `/api/chat/messages/${messageId}/thread`,
        { initial_message: initialMessage },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("[Create Thread] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get thread messages
   */
  async getThreadMessages(threadId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/api/chat/threads/${threadId}/messages`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Get Thread Messages] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Reply to a thread
   */
  async replyToThread(threadId, message, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.post(
        `/api/chat/threads/${threadId}/reply`,
        { message },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("[Reply To Thread] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   MESSAGE REACTIONS (EXTENDED)
  // ============================================================

  /**
   * ✅ NEW: Get all reactions for a message
   */
  async getMessageReactions(messageId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/api/chat/messages/${messageId}/reactions`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Get Message Reactions] Error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get reaction analytics for a chat
   */
  async getReactionAnalytics(chatId, token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/api/chat/${chatId}/analytics/reactions`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Reaction Analytics] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   MESSAGE SEARCH
  // ============================================================

  /**
   * ✅ NEW: Search messages in a chat
   */
  async searchMessages(chatId, query, options = {}, token = null) {
    try {
      const { limit = 20, offset = 0, dateFrom, dateTo } = options;

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = new URLSearchParams({
        query,
        limit,
        offset,
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      });

      const response = await api.get(`/api/chat/${chatId}/search?${params}`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Search Messages] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   CHAT ANALYTICS
  // ============================================================

  /**
   * ✅ NEW: Get chat activity analytics
   */
  async getChatAnalytics(chatId, period = "7d", token = null) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/api/chat/${chatId}/analytics?period=${period}`, { headers });
      return response.data;
    } catch (error) {
      console.error("[Chat Analytics] Error:", error.message);
      throw error;
    }
  },

  // ============================================================
  //                   UTILITY METHODS
  // ============================================================

  /**
   * ✅ NEW: Validate message content
   */
  validateMessage(message) {
    if (!message || typeof message !== "string") {
      return { valid: false, error: "Message must be a non-empty string" };
    }

    if (message.length > 10000) {
      return { valid: false, error: "Message exceeds maximum length (10,000 characters)" };
    }

    if (message.trim().length === 0) {
      return { valid: false, error: "Message cannot be empty" };
    }

    return { valid: true };
  },

  /**
   * ✅ NEW: Format poll results for display
   */
  formatPollResults(poll) {
    const totalVotes = poll.total_votes || 0;

    return poll.options.map((option, index) => {
      const votes = poll.votes?.[index] || 0;
      const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;

      return {
        option,
        votes,
        percentage: parseFloat(percentage),
      };
    });
  },

  /**
   * ✅ NEW: Check if poll has expired
   */
  isPollExpired(poll) {
    if (!poll.expires_at) return false;
    return new Date(poll.expires_at) < new Date();
  },
};

export default advancedChatApi;
