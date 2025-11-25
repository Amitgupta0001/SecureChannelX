// FILE: src/context/CallContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSocket } from "./SocketContext";
import callApi from "../api/callApi";   // correct path

const CallContext = createContext();
export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const token = localStorage.getItem("access_token");

  const [inCall, setInCall] = useState(false);
  const [callState, setCallState] = useState("idle");
  const [callInfo, setCallInfo] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  /* ================================
        Start Outgoing Call
  =================================*/
  const startCall = async (chatId, receiverId, type = "video") => {
    try {
      const data = await callApi.startCall(chatId, receiverId, type, token);

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

  /* ================================
        Accept Incoming Call
  =================================*/
  const acceptCall = async () => {
    if (!incomingCall) return;

    setInCall(true);
    setCallState("connecting");
    setCallInfo(incomingCall);

    createPeerConnection();
    await setupLocalStream(incomingCall.call_type);
    await createAnswer(incomingCall.sdp);

    // Socket event via callApi
    await callApi.acceptCallViaSocket(socket, incomingCall.call_id);

    setIncomingCall(null);
  };

  /* ================================
        Reject Call
  =================================*/
  const rejectCall = async () => {
    if (!incomingCall) return;

    await callApi.rejectCallViaSocket(socket, incomingCall.call_id);
    setIncomingCall(null);
    setCallState("idle");
  };

  /* ================================
        End Call
  =================================*/
  const endCall = async () => {
    if (callInfo) {
      await callApi.endCallViaSocket(socket, callInfo.call_id);
    }

    setInCall(false);
    setCallState("ended");

    if (pcRef.current) pcRef.current.close();
    if (localStreamRef.current)
      localStreamRef.current.getTracks().forEach((t) => t.stop());

    setTimeout(() => {
      setCallState("idle");
      setCallInfo(null);
    }, 300);
  };

  /* ================================
        WebRTC Implementation
  =================================*/

  const createPeerConnection = () => {
    if (pcRef.current) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && callInfo) {
        callApi.sendIceCandidate(socket, {
          call_id: callInfo.call_id,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pcRef.current = pc;
  };

  const setupLocalStream = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      if (pcRef.current) {
        stream.getTracks().forEach(track => {
          pcRef.current.addTrack(track, stream);
        });
      }
    } catch (err) {
      console.error("Failed to access media devices", err);
      alert("Could not access camera/microphone");
    }
  };

  const createOffer = async () => {
    if (!pcRef.current) return;
    try {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      // Send offer via socket
      if (callInfo) {
        callApi.sendOffer(socket, {
          call_id: callInfo.call_id,
          sdp: offer
        });
      }
    } catch (err) {
      console.error("Error creating offer", err);
    }
  };

  const createAnswer = async (remoteSdp) => {
    if (!pcRef.current) return;
    try {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(remoteSdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);

      if (callInfo) {
        callApi.sendAnswer(socket, {
          call_id: callInfo.call_id,
          sdp: answer
        });
      }
    } catch (err) {
      console.error("Error creating answer", err);
    }
  };

  // Handle incoming socket events for signaling
  useEffect(() => {
    if (!socket) return;

    socket.on("call:incoming", (data) => {
      setIncomingCall(data);
    });

    socket.on("call:accepted", async (data) => {
      if (data.sdp && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        setCallState("connected");
      }
    });

    socket.on("call:ice_candidate", async (data) => {
      if (data.candidate && pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding ICE candidate", e);
        }
      }
    });

    socket.on("call:ended", () => {
      endCall();
    });

    return () => {
      socket.off("call:incoming");
      socket.off("call:accepted");
      socket.off("call:ice_candidate");
      socket.off("call:ended");
    };
  }, [socket, callInfo]);

  /* ================================
        Provider
  =================================*/
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
