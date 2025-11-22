// FILE: src/context/CallContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSocket } from "./SocketContext";
import callApi from "../api/callApi";

const CallContext = createContext();
export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();

  const [inCall, setInCall] = useState(false);
  const [callState, setCallState] = useState("idle"); // idle | ringing | connecting | active | ended
  const [callInfo, setCallInfo] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  /* =========================================================
     CREATE PEER CONNECTION
  ========================================================== */
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    /* ICE candidates */
    pc.onicecandidate = (e) => {
      if (e.candidate && callInfo) {
        socket.emit("webrtc_ice_candidate", {
          call_id: callInfo.call_id,
          candidate: e.candidate,
        });
      }
    };

    /* Remote track received */
    pc.ontrack = (ev) => {
      if (!remoteVideoRef.current) return;
      remoteVideoRef.current.srcObject = ev.streams[0];
    };

    pcRef.current = pc;
    return pc;
  };

  /* =========================================================
     PREPARE LOCAL STREAM
  ========================================================== */
  const setupLocalStream = async (callType = "video") => {
    const constraints =
      callType === "audio"
        ? { audio: true, video: false }
        : { audio: true, video: true };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const pc = pcRef.current;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  };

  /* =========================================================
     START OUTGOING CALL
  ========================================================== */
  const startCall = async (chatId, receiverId, type = "video") => {
    try {
      const data = await callApi.startCall(chatId, receiverId, type);

      setCallInfo(data.call);
      setInCall(true);
      setCallState("connecting");

      createPeerConnection();
      await setupLocalStream(type);

      await createOffer();
    } catch (err) {
      console.error("Call start failed:", err);
    }
  };

  /* =========================================================
     CREATE OFFER (OUTGOING CALL)
  ========================================================== */
  const createOffer = async () => {
    const pc = pcRef.current;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("webrtc_offer", {
      call_id: callInfo.call_id,
      offer,
    });
  };

  /* =========================================================
     CREATE ANSWER (INCOMING CALL)
  ========================================================== */
  const createAnswer = async (offer) => {
    const pc = pcRef.current;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("webrtc_answer", {
      call_id: incomingCall.call_id,
      answer,
    });

    setCallState("active");
  };

  /* =========================================================
     ACCEPT INCOMING CALL
  ========================================================== */
  const acceptCall = async () => {
    if (!incomingCall) return;

    setInCall(true);
    setCallState("connecting");

    setCallInfo(incomingCall);
    createPeerConnection();

    await setupLocalStream(incomingCall.call_type);
    await createAnswer(incomingCall.sdp);

    setIncomingCall(null);
  };

  /* =========================================================
     REJECT CALL
  ========================================================== */
  const rejectCall = () => {
    if (!incomingCall) return;

    socket.emit("call_rejected", { call_id: incomingCall.call_id });
    setIncomingCall(null);
    setCallState("idle");
  };

  /* =========================================================
     END CALL
  ========================================================== */
  const endCall = () => {
    if (callInfo) {
      socket.emit("call_ended", { call_id: callInfo.call_id });
    }

    setInCall(false);
    setCallState("ended");

    if (pcRef.current) pcRef.current.close();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    setTimeout(() => {
      setCallState("idle");
      setCallInfo(null);
    }, 300);
  };

  /* =========================================================
     SOCKET EVENTS
  ========================================================== */
  useEffect(() => {
    if (!socket) return;

    // Someone tries to call you
    socket.on("incoming_call", ({ call }) => {
      setIncomingCall(call);
      setCallState("ringing");
    });

    // Callee accepted
    socket.on("call_accepted", () => {
      setCallState("active");
    });

    // Receive offer
    socket.on("webrtc_offer", async ({ offer }) => {
      if (!incomingCall) return;

      createPeerConnection();
      await setupLocalStream(incomingCall.call_type);
      await createAnswer(offer);
    });

    // Receive answer
    socket.on("webrtc_answer", async ({ answer }) => {
      const pc = pcRef.current;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState("active");
    });

    // Receive ICE
    socket.on("webrtc_ice_candidate", async ({ candidate }) => {
      try {
        await pcRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE error:", err);
      }
    });

    // Call ended
    socket.on("call_ended", () => endCall());

    return () => {
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("webrtc_ice_candidate");
      socket.off("call_ended");
    };
  }, [socket, incomingCall, callInfo]);

  /* =========================================================
     PROVIDER RETURN
  ========================================================== */
  return (
    <CallContext.Provider
      value={{
        inCall,
        callState,
        callInfo,
        incomingCall,

        startCall,
        acceptCall,
        rejectCall,
        endCall,

        localVideoRef,
        remoteVideoRef,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
