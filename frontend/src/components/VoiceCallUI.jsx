// FILE: src/components/VoiceCallUI.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneOff,
  Phone,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";

import callApi from "../api/callApi";

export default function VoiceCallUI({
  callId,
  isIncoming,
  callerName,
  socket,
  token,
  onClose,
}) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);

  const [connecting, setConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const durationRef = useRef(null);

  // Setup peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.ontrack = (ev) => {
      if (remoteStreamRef.current) {
        remoteStreamRef.current.srcObject = ev.streams[0];
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        callApi.sendICECandidate(socket, callId, ev.candidate);
      }
    };

    pcRef.current = pc;
    return pc;
  };

  // Setup local audio mic
  const startLocalAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStreamRef.current = stream;

    stream.getTracks().forEach((t) => pcRef.current.addTrack(t, stream));

    return stream;
  };

  // Create offer (outgoing)
  const createOffer = async () => {
    const pc = pcRef.current;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    callApi.sendWebRTCOffer(socket, callId, offer);
  };

  // Answer incoming call
  const createAnswer = async (offer) => {
    const pc = pcRef.current;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    callApi.sendWebRTCAnswer(socket, callId, answer);
  };

  // End call entirely
  const endCall = () => {
    callApi.endCallViaSocket(socket, callId, "ended");

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (pcRef.current) pcRef.current.close();

    clearInterval(durationRef.current);

    onClose();
  };

  // Time counter
  const startTimer = () => {
    durationRef.current = setInterval(() => {
      setCallDuration((t) => t + 1);
    }, 1000);
  };

  // Format duration (mm:ss)
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Register WebRTC + call events
  useEffect(() => {
    // create peer connection
    createPeerConnection();

    // start local mic
    startLocalAudio();

    socket.on("webrtc_offer", async ({ offer }) => {
      await createAnswer(offer);
      setConnecting(false);
      startTimer();
    });

    socket.on("webrtc_answer", async ({ answer }) => {
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
      setConnecting(false);
      startTimer();
    });

    socket.on("webrtc_ice_candidate", async ({ candidate }) => {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {}
    });

    socket.on("call_accepted", () => {
      createOffer();
    });

    socket.on("call_rejected", () => {
      endCall();
    });

    socket.on("call_ended", () => {
      endCall();
    });

    return () => {
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("webrtc_ice_candidate");
      socket.off("call_accepted");
      socket.off("call_rejected");
      socket.off("call_ended");
    };
  }, []);

  // Answer incoming call
  const acceptCall = () => {
    callApi.acceptCallViaSocket(socket, callId);
    setConnecting(true);
  };

  const rejectCall = () => {
    callApi.rejectCallViaSocket(socket, callId);
    endCall();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="voicecall"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#0D1117] text-white z-50 flex flex-col items-center justify-center"
      >
        {/* Caller Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-32 h-32 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#3b82f6] flex items-center justify-center text-4xl font-bold shadow-xl"
        >
          {callerName?.[0] || "U"}
        </motion.div>

        {/* Caller Name */}
        <div className="mt-5 text-2xl font-semibold">{callerName}</div>

        {/* Call Status */}
        <div className="mt-1 text-gray-400">
          {isIncoming
            ? "Incoming voice call…"
            : connecting
            ? "Connecting…"
            : `Call in progress (${formatTime(callDuration)})`}
        </div>

        {/* Hidden audio for remote stream */}
        <audio ref={remoteStreamRef} autoPlay />

        {/* Incoming controls */}
        {isIncoming ? (
          <div className="flex gap-10 mt-12">
            {/* Reject */}
            <button
              onClick={rejectCall}
              className="p-5 bg-red-600 rounded-full hover:bg-red-700 transition shadow-xl"
            >
              <PhoneOff className="w-7 h-7" />
            </button>

            {/* Accept */}
            <button
              onClick={acceptCall}
              className="p-5 bg-green-600 rounded-full hover:bg-green-700 transition shadow-xl"
            >
              <Phone className="w-7 h-7" />
            </button>
          </div>
        ) : (
          /* In-call controls */
          <div className="absolute bottom-16 flex justify-center gap-6">
            {/* Mute */}
            <button
              onClick={() => {
                setMuted(!muted);
                localStreamRef.current.getAudioTracks()[0].enabled = muted;
              }}
              className="p-4 rounded-full bg-[#111827] border border-[#1f2937] hover:bg-[#1f2937] transition"
            >
              {muted ? <MicOff /> : <Mic />}
            </button>

            {/* Speaker */}
            <button
              onClick={() => {
                setSpeakerOn(!speakerOn);
                remoteStreamRef.current.muted = !speakerOn;
              }}
              className="p-4 rounded-full bg-[#111827] border border-[#1f2937] hover:bg-[#1f2937] transition"
            >
              {speakerOn ? <Volume2 /> : <VolumeX />}
            </button>

            {/* End Call */}
            <button
              onClick={endCall}
              className="p-5 bg-red-600 hover:bg-red-700 rounded-full shadow-xl"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
