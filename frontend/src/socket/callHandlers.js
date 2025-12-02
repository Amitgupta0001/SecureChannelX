// FILE: src/socket/callHandlers.js

/**
 * Centralized Socket.IO WebRTC Call Signaling Handlers
 * Matches backend:
 *   backend/app/socket/call_events.py  ✔
 *   backend/app/routes/calls.py        ✔
 */

export default function registerCallHandlers(socket, callbacks = {}) {
  if (!socket) {
    console.warn("⚠ registerCallHandlers: socket is null");
    return;
  }

  const { onIncomingCall, onOffer, onAnswer, onIceCandidate, onCallEnded } = callbacks;

  const safeCall = (fn, data, eventName) => {
    try {
      fn?.(data);
    } catch (err) {
      console.error(`❌ Error in ${eventName} handler:`, err);
    }
  };

  /* ----------------------------------------------
   * 1) Incoming Call Event
   * ---------------------------------------------- */
  socket.on("call:incoming", (data) => {
    console.log("📞 Incoming call:", data);
    safeCall(onIncomingCall, data?.call, "call:incoming");
  });

  /* ----------------------------------------------
   * 2) WebRTC Offer
   * ---------------------------------------------- */
  socket.on("call:offer", (data) => {
    console.log("📡 Received offer:", data);
    safeCall(onOffer, data, "call:offer");
  });

  /* ----------------------------------------------
   * 3) WebRTC Answer
   * ---------------------------------------------- */
  socket.on("call:answer", (data) => {
    console.log("📡 Received answer:", data);
    safeCall(onAnswer, data, "call:answer");
  });

  /* ----------------------------------------------
   * 4) ICE Candidate
   * ---------------------------------------------- */
  socket.on("call:ice", (data) => {
    console.log("❄️ ICE Candidate:", data);
    safeCall(onIceCandidate, data, "call:ice");
  });

  /* ----------------------------------------------
   * 5) Call Ended
   * ---------------------------------------------- */
  socket.on("call:ended", (data) => {
    console.log("☎️ Call ended:", data);
    safeCall(onCallEnded, data, "call:ended");
  });
}

/* --------------------------------------------------
   CLIENT → SERVER EMITTERS
--------------------------------------------------- */
export const CallSignaling = {
  sendOffer(socket, { chat_id, caller_id, callee_id, sdp }) {
    if (!socket?.connected) return console.warn("⚠ Socket offline: sendOffer");
    socket.emit("call:offer", { chat_id, caller_id, callee_id, sdp });
  },

  sendAnswer(socket, { caller_id, callee_id, sdp }) {
    if (!socket?.connected) return console.warn("⚠ Socket offline: sendAnswer");
    socket.emit("call:answer", { caller_id, callee_id, sdp });
  },

  sendIceCandidate(socket, { to, candidate }) {
    if (!socket?.connected) return console.warn("⚠ Socket offline: sendIceCandidate");
    socket.emit("call:ice", { to, candidate });
  },

  endCall(socket, { call_id, chat_id, ended_by }) {
    if (!socket?.connected) return console.warn("⚠ Socket offline: endCall");
    socket.emit("call:end", { call_id, chat_id, ended_by });
  },
};
