// FILE: src/hooks/useWebRTC.js
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import callApi from "../api/callApi";

export default function useWebRTC(callInfo, setCallInfo, onEnd) {
  const { socket, safeEmit } = useSocket();

  const pc = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  /* ---------------------------------------------------------
      CREATE PEER CONNECTION
  --------------------------------------------------------- */
  const createPeerConnection = () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.onicecandidate = (e) => {
      if (e.candidate && callInfo) {
        safeEmit("webrtc_ice_candidate", {
          call_id: callInfo.call_id,
          candidate: e.candidate,
        });
      }
    };

    peer.ontrack = (e) => {
      if (!remoteStream.current) remoteStream.current = new MediaStream();
      remoteStream.current = e.streams[0];
    };

    pc.current = peer;
    return peer;
  };

  /* ---------------------------------------------------------
      PREPARE LOCAL MEDIA STREAM
  --------------------------------------------------------- */
  const initLocalMedia = async (type = "video") => {
    const constraints =
      type === "audio"
        ? { audio: true, video: false }
        : { audio: true, video: true };

    localStream.current = await navigator.mediaDevices.getUserMedia(
      constraints
    );

    createPeerConnection();
    localStream.current.getTracks().forEach((track) => {
      pc.current.addTrack(track, localStream.current);
    });

    return localStream.current;
  };

  /* ---------------------------------------------------------
      START OUTGOING CALL
  --------------------------------------------------------- */
  const startCall = useCallback(
    async (chatId, receiverId, type = "video") => {
      const res = await callApi.startCall(chatId, receiverId, type);
      if (!res?.call) return;

      setCallInfo(res.call);

      await initLocalMedia(type);

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);

      safeEmit("webrtc_offer", {
        call_id: res.call.call_id,
        offer,
      });
    },
    [safeEmit, setCallInfo]
  );

  /* ---------------------------------------------------------
      HANDLE REMOTE OFFER → CREATE ANSWER
  --------------------------------------------------------- */
  const handleOffer = useCallback(
    async (offer) => {
      await initLocalMedia(callInfo.call_type);

      await pc.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      safeEmit("webrtc_answer", {
        call_id: callInfo.call_id,
        answer,
      });
    },
    [callInfo, safeEmit]
  );

  /* ---------------------------------------------------------
      ACCEPT INCOMING CALL
  --------------------------------------------------------- */
  const acceptCall = useCallback(async () => {
    safeEmit("call_accepted", { call_id: callInfo.call_id });
    await handleOffer(callInfo.sdp);
  }, [callInfo, handleOffer, safeEmit]);

  /* ---------------------------------------------------------
      REJECT INCOMING CALL
  --------------------------------------------------------- */
  const rejectCall = useCallback(() => {
    safeEmit("call_rejected", { call_id: callInfo.call_id });
    onEnd();
  }, [callInfo, safeEmit, onEnd]);

  /* ---------------------------------------------------------
      HANDLE ANSWER FROM PEER
  --------------------------------------------------------- */
  const handleAnswer = useCallback(async (answer) => {
    await pc.current.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  }, []);

  /* ---------------------------------------------------------
      ADD REMOTE ICE CANDIDATE
  --------------------------------------------------------- */
  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      await pc.current.addIceCandidate(candidate);
    } catch (err) {
      console.error("ICE error:", err);
    }
  }, []);

  /* ---------------------------------------------------------
      END CALL
  --------------------------------------------------------- */
  const endCall = useCallback(() => {
    safeEmit("call_ended", { call_id: callInfo?.call_id });
    onEnd();

    if (pc.current) pc.current.close();
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
    }
  }, [callInfo, safeEmit, onEnd]);

  /* ---------------------------------------------------------
      SOCKET EVENTS
  --------------------------------------------------------- */
  useEffect(() => {
    if (!socket) return;

    const events = {
      incoming_call: ({ call }) => setCallInfo(call),

      webrtc_offer: ({ offer }) => handleOffer(offer),

      webrtc_answer: ({ answer }) => handleAnswer(answer),

      webrtc_ice_candidate: ({ candidate }) =>
        handleIceCandidate(candidate),

      call_accepted: () => {},

      call_ended: () => endCall(),
    };

    Object.entries(events).forEach(([key, fn]) =>
      socket.on(key, fn)
    );

    return () => {
      Object.entries(events).forEach(([key, fn]) =>
        socket.off(key, fn)
      );
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate, endCall]);

  /* ---------------------------------------------------------
      UI CONTROLS (mic/camera)
  --------------------------------------------------------- */
  const toggleMute = () => {
    if (!localStream.current) return;
    const audioTrack = localStream.current.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  const toggleCamera = () => {
    if (!localStream.current) return;
    const videoTrack = localStream.current.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);
  };

  return {
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    isMuted,
    isCameraOn,
  };
}
