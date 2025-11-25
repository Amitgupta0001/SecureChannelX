// FILE: src/components/CallControls.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

export default function CallControls({ localStream, callType, endCall }) {
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  const toggleMute = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!localStream || callType !== "video") return;
    const videoTrack = localStream.getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  return (
    <div className="absolute bottom-10 w-full flex justify-center gap-6 z-50">
      {/* MUTE / UNMUTE */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={toggleMute}
        className="p-4 rounded-full bg-[#111827] border border-[#1f2937] hover:bg-[#1f2937] text-white transition"
      >
        {muted ? <MicOff className="text-red-400" /> : <Mic />}
      </motion.button>

      {/* CAMERA ON / OFF */}
      {callType === "video" && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleVideo}
          className="p-4 rounded-full bg-[#111827] border border-[#1f2937] hover:bg-[#1f2937] text-white transition"
        >
          {cameraOn ? <Video /> : <VideoOff className="text-red-400" />}
        </motion.button>
      )}

      {/* END CALL */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={endCall}
        className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl transition"
      >
        <PhoneOff className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
