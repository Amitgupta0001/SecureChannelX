import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "../../contexts/SocketContext";
import CallControls from "./CallControls";
import "../../styles/components/VoiceCall.css";

const VideoCall = ({ callId, callerId, isCaller, onEndCall }) => {
  const { socket } = useSocket();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState("Connecting...");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);

  // --------------------------
  // USE EFFECT → SETUP + CLEANUP
  // --------------------------
  useEffect(() => {
    startVideoCall();

    socket.on("webrtc_offer", handleReceiveOffer);
    socket.on("webrtc_answer", handleReceiveAnswer);
    socket.on("webrtc_ice_candidate", handleReceiveCandidate);
    socket.on("end_call", handleRemoteEnd);

    return () => {
      cleanup();
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("webrtc_ice_candidate");
      socket.off("end_call");
    };
  }, []);

  // --------------------------
  // INITIALIZE CALL
  // --------------------------
  const startVideoCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      await setupPeerConnection(stream);

      if (isCaller) {
        await createOffer();
      }

    } catch (err) {
      console.error("Error starting video call:", err);
      setCallStatus("Failed to access camera/mic");
    }
  };

  // --------------------------
  // SETUP WEBRTC PEER CONNECTION
  // --------------------------
  const setupPeerConnection = async (stream) => {
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Send tracks
    stream.getTracks().forEach(track => {
      pc.current.addTrack(track, stream);
    });

    // Receive remote stream
    pc.current.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    // ICE candidates
    pc.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("webrtc_ice_candidate", {
          call_id: callId,
          candidate: e.candidate,
        });
      }
    };

    // Update connection state
    pc.current.onconnectionstatechange = () => {
      if (pc.current.connectionState === "connected") {
        setCallStatus("Connected");
      }
    };
  };

  // --------------------------
  // OFFER → ANSWER FLOW
  // --------------------------
  const createOffer = async () => {
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);

    socket.emit("webrtc_offer", {
      call_id: callId,
      offer,
    });
  };

  const handleReceiveOffer = async ({ call_id, offer }) => {
    if (call_id !== callId) return;

    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);

    socket.emit("webrtc_answer", {
      call_id: callId,
      answer,
    });

    setCallStatus("Connecting...");
  };

  const handleReceiveAnswer = async ({ call_id, answer }) => {
    if (call_id !== callId) return;

    await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
    setCallStatus("Connected");
  };

  // --------------------------
  // ICE CANDIDATES
  // --------------------------
  const handleReceiveCandidate = async ({ call_id, candidate }) => {
    if (call_id !== callId) return;

    try {
      await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  };

  // --------------------------
  // END CALL
  // --------------------------
  const endCall = () => {
    socket.emit("end_call", { call_id: callId });
    cleanup();
    onEndCall();
  };

  const handleRemoteEnd = ({ call_id }) => {
    if (call_id !== callId) return;
    cleanup();
    onEndCall();
  };

  // --------------------------
  // CLEANUP
  // --------------------------
  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (pc.current) pc.current.close();
  };

  return (
    <div className="voice-call-overlay">
      <div className="call-container">
        <div className="call-header">
          <h3>Video Call</h3>
          <div className="call-status">{callStatus}</div>
        </div>

        <div className="video-feeds">
          <div className="remote-video">
            <video ref={remoteVideoRef} autoPlay playsInline />
          </div>

          <div className="local-video">
            <video ref={localVideoRef} autoPlay playsInline muted />
          </div>
        </div>

        <CallControls
          localStream={localStream}
          callType="video"
          endCall={endCall}
        />
      </div>
    </div>
  );
};

export default VideoCall;
