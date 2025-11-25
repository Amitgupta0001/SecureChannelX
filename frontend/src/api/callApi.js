// FILE: src/api/callApi.js
import axios from "axios";
import { API_BASE } from "../utils/constants";

const API = API_BASE;

export default {
  // -------------------------------------------------------
  // 1️⃣ Start a call (Backend Call System)
  // POST /calls/start
  // Body: { chat_id, receiver_id, call_type }
  // -------------------------------------------------------
  async startCall(chatId, receiverId, callType, token) {
    const res = await axios.post(
      `${API}/api/calls/start`,
      {
        chat_id: chatId,
        receiver_id: receiverId,
        call_type: callType, // "audio" or "video"
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
    /*
      {
        call: {
          _id: "...",
          chat_id: "...",
          caller_id: "...",
          receiver_id: "...",
          call_type: "audio|video",
          status: "ringing",
          started_at: "...",
          ...
        }
      }
    */
  },

  // -------------------------------------------------------
  // 2️⃣ Call History for a chat
  // GET /calls/history/:chat_id
  // -------------------------------------------------------
  async getCallHistory(chatId, token) {
    const res = await axios.get(`${API}/api/calls/history/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
    /*
      { calls: [ ... ] }
    */
  },

  // -------------------------------------------------------
  // 3️⃣ WebRTC: initiate raw peer-to-peer call
  // POST /api/calls/initiate
  // Body: { callee_id, type }
  // -------------------------------------------------------
  async initiateWebRTCCall(calleeId, callType, token) {
    const res = await axios.post(
      `${API}/api/calls/initiate`,
      { callee_id: calleeId, type: callType },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
    /*
      {
        call_id: "<generated-call-id>",
        message: "Call initiated"
      }
    */
  },

  // -------------------------------------------------------
  // 4️⃣ Get WebRTC call status
  // GET /api/calls/:call_id
  // -------------------------------------------------------
  async getWebRTCCallStatus(callId, token) {
    const res = await axios.get(`${API}/api/calls/${callId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
    /*
      {
        call_id: "...",
        status: "ringing|connected|...",
        call_type: "audio|video",
        duration: 0
      }
    */
  },

  // -------------------------------------------------------
  // 5️⃣ Accept WebRTC Call (Socket does most work)
  // The backend listens to socket event: "call_accepted"
  // -------------------------------------------------------
  async acceptCallViaSocket(socket, callId) {
    socket.emit("call_accepted", { call_id: callId });
  },

  // -------------------------------------------------------
  // 6️⃣ Reject WebRTC Call (Socket event)
  // -------------------------------------------------------
  async rejectCallViaSocket(socket, callId, reason = "User rejected call") {
    socket.emit("call_rejected", { call_id: callId, reason });
  },

  // -------------------------------------------------------
  // 7️⃣ End WebRTC Call (Socket event)
  // -------------------------------------------------------
  async endCallViaSocket(socket, callId, reason = "call_ended") {
    socket.emit("end_call", { call_id: callId, reason });
  },

  // -------------------------------------------------------
  // 8️⃣ Send WebRTC offer SDP
  // -------------------------------------------------------
  async sendWebRTCOffer(socket, callId, offer) {
    socket.emit("webrtc_offer", { call_id: callId, offer });
  },

  // -------------------------------------------------------
  // 9️⃣ Send WebRTC answer SDP
  // -------------------------------------------------------
  async sendWebRTCAnswer(socket, callId, answer) {
    socket.emit("webrtc_answer", { call_id: callId, answer });
  },

  // -------------------------------------------------------
  // 🔟 Send ICE Candidate
  // -------------------------------------------------------
  async sendICECandidate(socket, callId, candidate) {
    socket.emit("webrtc_ice_candidate", { call_id: callId, candidate });
  },
};
