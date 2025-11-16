// frontend/src/components/VoiceCall.jsx
import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "../contexts/SocketContext";
import "../styles/VoiceCall.css";

const VoiceCall = ({ callId, callerId, isCaller, callType, onEndCall }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState("Connecting...");
  const { socket } = useSocket();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);

  useEffect(() => {
    startCall();

    socket.on("webrtc_offer", handleReceiveOffer);
    socket.on("webrtc_answer", handleReceiveAnswer);
    socket.on("webrtc_ice_candidate", handleReceiveCandidate);
    socket.on("end_call", handleRemoteEndCall);

    return () => {
      cleanup();
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("webrtc_ice_candidate");
      socket.off("end_call");
    };
  }, []);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
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

    } catch (error) {
      console.error("Error accessing media devices:", error);
      setCallStatus("Failed to access microphone/camera");
    }
  };

  const setupPeerConnection = async (stream) => {
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Send tracks
    stream.getTracks().forEach((track) => {
      pc.current.addTrack(track, stream);
    });

    // Receive remote tracks
    pc.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Send ICE candidates
    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_ice_candidate", {
          call_id: callId,
          candidate: event.candidate,
        });
      }
    };

    pc.current.onconnectionstatechange = () => {
      if (pc.current.connectionState === "connected") {
        setCallStatus("Connected");
      }
    };
  };

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

  const handleReceiveCandidate = async ({ call_id, candidate }) => {
    if (call_id !== callId) return;
    try {
      await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("ICE candidate error:", err);
    }
  };

  const handleRemoteEndCall = ({ call_id }) => {
    if (call_id !== callId) return;
    cleanup();
    onEndCall();
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (pc.current) {
      pc.current.close();
    }
  };

  const endCall = () => {
    socket.emit("end_call", { call_id: callId });
    cleanup();
    onEndCall();
  };

  const toggleMute = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
  };

  return (
    <div className="voice-call-overlay">
      <div className="call-container">

        <div className="call-header">
          <h3>{callType === "video" ? "Video Call" : "Voice Call"}</h3>
          <div className="call-status">{callStatus}</div>
        </div>

        {callType === "video" && (
          <div className="video-feeds">
            <div className="remote-video">
              <video ref={remoteVideoRef} autoPlay playsInline />
            </div>
            <div className="local-video">
              <video ref={localVideoRef} autoPlay playsInline muted />
            </div>
          </div>
        )}

        <div className="call-controls">
          <button onClick={toggleMute} className="control-button mute">
            Mute
          </button>

          {callType === "video" && (
            <button onClick={toggleVideo} className="control-button video">
              Video
            </button>
          )}

          <button onClick={endCall} className="control-button end-call">
            End Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCall;
