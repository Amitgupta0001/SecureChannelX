// FILE: src/sockets/callHandlers.js

/**
 * Centralized Socket.IO WebRTC Call Signaling Handlers
 * Matches backend:
 *   backend/app/socket/call_events.py  ✔
 *   backend/app/routes/calls.py        ✔
 */

export default function registerCallHandlers(socket, {
  onIncomingCall,
  onOffer,
  onAnswer,
  onIceCandidate,
  onCallEnded
}) {

  if (!socket) return;

  /* ----------------------------------------------
   * 1) Incoming Call Event (callee only)
   * server → client
   * ---------------------------------------------- */
  socket.on("call:incoming", ({ call }) => {
    console.log("📞 Incoming call:", call);
    if (onIncomingCall) onIncomingCall(call);
  });

  /* ----------------------------------------------
   * 2) WebRTC Offer (caller → server → callee)
   * ---------------------------------------------- */
  socket.on("call:offer", (data) => {
    console.log("📡 Received offer:", data);
    if (onOffer) onOffer(data);
  });

  /* ----------------------------------------------
   * 3) WebRTC Answer (callee → server → caller)
   * ---------------------------------------------- */
  socket.on("call:answer", (data) => {
    console.log("📡 Received answer:", data);
    if (onAnswer) onAnswer(data);
  });

  /* ----------------------------------------------
   * 4) ICE Candidate forwarding
   * ---------------------------------------------- */
  socket.on("call:ice", (data) => {
    console.log("❄ ICE Candidate:", data);
    if (onIceCandidate) onIceCandidate(data);
  });

  /* ----------------------------------------------
   * 5) Call Ended (system or other user)
   * ---------------------------------------------- */
  socket.on("call:ended", (payload) => {
    console.log("☎ Call ended:", payload);
    if (onCallEnded) onCallEnded(payload);
  });
}


/* --------------------------------------------------
   Client → Server Emitters
   These match backend call_events.py exactly
--------------------------------------------------- */

export const CallSignaling = {

  /* Send WebRTC Offer */
  sendOffer(socket, { chat_id, caller_id, callee_id, sdp }) {
    socket.emit("call:offer", {
      chat_id,
      caller_id,
      callee_id,
      sdp
    });
  },

  /* Send WebRTC Answer */
  sendAnswer(socket, { caller_id, callee_id, sdp }) {
    socket.emit("call:answer", {
      caller_id,
      callee_id,
      sdp
    });
  },

  /* Send ICE Candidate */
  sendIceCandidate(socket, { to, candidate }) {
    socket.emit("call:ice", {
      to,
      candidate
    });
  },

  /* End Call */
  endCall(socket, { call_id, chat_id, ended_by }) {
    socket.emit("call:end", {
      call_id,
      chat_id,
      ended_by
    });
  }
};
