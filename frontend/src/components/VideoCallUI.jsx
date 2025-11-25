// FILE: src/components/VideoCallUI.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Video, VideoOff, Mic, MicOff, Repeat } from "lucide-react";
import callApi from "../api/callApi";

export default function VideoCallUI({
  callId,
  isIncoming,
  callerName,
  socket,
  token,
  onClose,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const pcRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [connecting, setConnecting] = useState(true);

  // Initialize PeerConnection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.ontrack = (ev) => {
      if (!remoteStream) {
        const stream = new MediaStream();
        setRemoteStream(stream);
        remoteVideoRef.current.srcObject = stream;
      }
      remoteVideoRef.current.srcObject.addTrack(ev.track);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        callApi.sendICECandidate(socket, callId, ev.candidate);
      }
    };

    pcRef.current = pc;
    return pc;
  };

  // Start local camera
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: "user" },
    });
    setLocalStream(stream);
    localVideoRef.current.srcObject = stream;
    return stream;
  };

  // Create offer (outgoing call)
  const createOffer = async () => {
    const pc = pcRef.current;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    callApi.sendWebRTCOffer(socket, callId, offer);
  };

  // Accept offer from caller (incoming call)
  const createAnswer = async (offer) => {
    const pc = pcRef.current;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    callApi.sendWebRTCAnswer(socket, callId, answer);
  };

  // End call
  const endCall = () => {
    callApi.endCallViaSocket(socket, callId, "call_ended");

    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    if (pcRef.current) pcRef.current.close();

    onClose();
  };

  // Setup WebRTC handlers
  useEffect(() => {
    createPeerConnection();
    startCamera().then((stream) => {
      stream.getTracks().forEach((track) =>
        pcRef.current.addTrack(track, stream)
      );
    });

    // Incoming call
    socket.on("webrtc_offer", async ({ offer }) => {
      await createAnswer(offer);
    });

    // Caller receives answer
    socket.on("webrtc_answer", async ({ answer }) => {
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
      setConnecting(false);
    });

    // ICE updates
    socket.on("webrtc_ice_candidate", async ({ candidate }) => {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {}
    });

    // Call accepted
    socket.on("call_accepted", () => {
      createOffer();
    });

    // Call ended
    socket.on("call_ended", () => {
      endCall();
    });

    return () => {
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("webrtc_ice_candidate");
      socket.off("call_accepted");
      socket.off("call_ended");
    };
  }, []);

  // Accept call
  const acceptCall = () => {
    callApi.acceptCallViaSocket(socket, callId);
    setConnecting(true);
  };

  // Reject call
  const rejectCall = () => {
    callApi.rejectCallViaSocket(socket, callId, "rejected");
    endCall();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black text-white flex flex-col z-50"
      >
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Local video (preview) */}
        <motion.video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute bottom-6 right-6 w-36 h-60 rounded-xl shadow-lg object-cover border border-gray-700"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        />

        {/* Call status */}
        <div className="absolute top-6 w-full text-center">
          <div className="text-lg font-semibold">
            {callerName || "Video Call"}
          </div>
          <div className="text-sm text-gray-300 mt-1">
            {isIncoming
              ? "Incoming video call…"
              : connecting
              ? "Connecting…"
              : "Connected"}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-10 w-full flex items-center justify-center gap-6">
          {/* Mute */}
          <button
            onClick={() => {
              setMuted(!muted);
              localStream.getAudioTracks()[0].enabled = muted;
            }}
            className="p-4 rounded-full bg-[#111827] hover:bg-[#1f2937] border border-[#1f2937]"
          >
            {muted ? <MicOff /> : <Mic />}
          </button>

          {/* Video on/off */}
          <button
            onClick={() => {
              setVideoEnabled(!videoEnabled);
              localStream.getVideoTracks()[0].enabled = !videoEnabled;
            }}
            className="p-4 rounded-full bg-[#111827] hover:bg-[#1f2937] border border-[#1f2937]"
          >
            {videoEnabled ? <Video /> : <VideoOff />}
          </button>

          {/* Switch Camera (placeholder) */}
          <button className="p-4 rounded-full bg-[#111827] hover:bg-[#1f2937] border border-[#1f2937]">
            <Repeat />
          </button>

          {/* End Call */}
          <button
            onClick={endCall}
            className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>

        {/* Accept / Reject (Incoming Call) */}
        {isIncoming && (
          <div className="absolute bottom-32 w-full flex justify-center gap-10">
            <button
              onClick={rejectCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 shadow-xl"
            >
              <PhoneOff />
            </button>
            <button
              onClick={acceptCall}
              className="p-4 rounded-full bg-green-600 hover:bg-green-700 shadow-xl"
            >
              <Video />
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
