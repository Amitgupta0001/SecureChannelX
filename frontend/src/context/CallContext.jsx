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

  // (Other functions stay the same: createOffer, createAnswer, setupLocalStream, createPeerConnection)

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
