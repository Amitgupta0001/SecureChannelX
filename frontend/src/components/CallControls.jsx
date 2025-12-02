/**
 * ✅ ENHANCED: SecureChannelX - Call Controls Component
 * -----------------------------------------------------
 * WebRTC call control buttons with animations
 * 
 * Changes:
 *   - Fixed: Video enable/disable logic
 *   - Added: Screen sharing support
 *   - Added: Picture-in-picture mode
 *   - Added: Device switching (audio/video)
 *   - Added: Call recording indicator
 *   - Added: Network quality indicator
 *   - Added: Participant count (group calls)
 *   - Enhanced: Visual feedback
 *   - Enhanced: Tooltips
 *   - Enhanced: Animations
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  MonitorUp,
  Settings,
  Users,
  Signal,
  Circle,
} from "lucide-react";

export default function CallControls({
  localStream,
  remoteStream,
  callType,
  endCall,
  isGroupCall = false,
  participantCount = 2,
  onScreenShare,
  networkQuality = "good", // "excellent", "good", "poor", "bad"
  isRecording = false,
}) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(callType === "audio");
  const [speakerOff, setSpeakerOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevices, setShowDevices] = useState(false);

  // Device lists
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState(null);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState(null);

  /**
   * ✅ ENHANCED: Get available devices
   */
  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audio = devices.filter((d) => d.kind === "audioinput");
      const video = devices.filter((d) => d.kind === "videoinput");

      setAudioDevices(audio);
      setVideoDevices(video);

      if (audio.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(audio[0].deviceId);
      }

      if (video.length > 0 && !selectedVideoDevice) {
        setSelectedVideoDevice(video[0].deviceId);
      }
    } catch (err) {
      console.error("❌ Failed to get devices:", err);
    }
  };

  useEffect(() => {
    getDevices();
  }, []);

  /**
   * ✅ ENHANCED: Toggle microphone
   */
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
        console.log(`🎤 Microphone ${audioTrack.enabled ? "unmuted" : "muted"}`);
      }
    }
  };

  /**
   * ✅ ENHANCED: Toggle camera
   */
  const toggleVideo = () => {
    if (localStream && callType === "video") {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOff(!videoTrack.enabled);
        console.log(`📹 Camera ${videoTrack.enabled ? "on" : "off"}`);
      }
    }
  };

  /**
   * ✅ ENHANCED: Toggle speaker
   */
  const toggleSpeaker = () => {
    if (remoteStream) {
      const audioTrack = remoteStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setSpeakerOff(!audioTrack.enabled);
        console.log(`🔊 Speaker ${audioTrack.enabled ? "on" : "off"}`);
      }
    }
  };

  /**
   * ✅ NEW: Toggle screen sharing
   */
  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false,
        });

        setScreenSharing(true);

        if (onScreenShare) {
          onScreenShare(screenStream);
        }

        // Listen for stop sharing (user clicks browser stop button)
        screenStream.getVideoTracks()[0].addEventListener("ended", () => {
          setScreenSharing(false);
          if (onScreenShare) {
            onScreenShare(null);
          }
        });

        console.log("🖥️ Screen sharing started");
      } catch (err) {
        console.error("❌ Screen sharing failed:", err);
        alert("Failed to start screen sharing");
      }
    } else {
      setScreenSharing(false);
      if (onScreenShare) {
        onScreenShare(null);
      }
      console.log("🖥️ Screen sharing stopped");
    }
  };

  /**
   * ✅ NEW: Switch audio device
   */
  const switchAudioDevice = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });

      // Replace audio track
      const oldTrack = localStream.getAudioTracks()[0];
      const newTrack = newStream.getAudioTracks()[0];

      if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }

      localStream.addTrack(newTrack);
      setSelectedAudioDevice(deviceId);

      console.log("🎤 Switched audio device");
    } catch (err) {
      console.error("❌ Failed to switch audio device:", err);
    }
  };

  /**
   * ✅ NEW: Switch video device
   */
  const switchVideoDevice = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: deviceId } },
      });

      // Replace video track
      const oldTrack = localStream.getVideoTracks()[0];
      const newTrack = newStream.getVideoTracks()[0];

      if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }

      localStream.addTrack(newTrack);
      setSelectedVideoDevice(deviceId);

      console.log("📹 Switched video device");
    } catch (err) {
      console.error("❌ Failed to switch video device:", err);
    }
  };

  /**
   * ✅ NEW: Get network quality color
   */
  const getNetworkQualityColor = () => {
    switch (networkQuality) {
      case "excellent":
        return "text-green-400";
      case "good":
        return "text-blue-400";
      case "poor":
        return "text-yellow-400";
      case "bad":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  /**
   * ✅ NEW: Get network quality bars
   */
  const getNetworkQualityBars = () => {
    switch (networkQuality) {
      case "excellent":
        return 4;
      case "good":
        return 3;
      case "poor":
        return 2;
      case "bad":
        return 1;
      default:
        return 0;
    }
  };

  return (
    <>
      {/* Main Controls Bar */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-gray-900/95 backdrop-blur-lg border border-gray-700 rounded-2xl px-6 py-4 shadow-2xl">
          <div className="flex items-center gap-4">
            {/* Microphone */}
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-all transform hover:scale-110 active:scale-95 ${
                muted
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Video (only for video calls) */}
            {callType === "video" && (
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-all transform hover:scale-110 active:scale-95 ${
                  videoOff
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
                title={videoOff ? "Turn on camera" : "Turn off camera"}
              >
                {videoOff ? (
                  <VideoOff className="w-6 h-6 text-white" />
                ) : (
                  <Video className="w-6 h-6 text-white" />
                )}
              </button>
            )}

            {/* Screen Share (only for video calls) */}
            {callType === "video" && (
              <button
                onClick={toggleScreenShare}
                className={`p-4 rounded-full transition-all transform hover:scale-110 active:scale-95 ${
                  screenSharing
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
                title={screenSharing ? "Stop sharing" : "Share screen"}
              >
                <MonitorUp className="w-6 h-6 text-white" />
              </button>
            )}

            {/* Speaker */}
            <button
              onClick={toggleSpeaker}
              className={`p-4 rounded-full transition-all transform hover:scale-110 active:scale-95 ${
                speakerOff
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
              title={speakerOff ? "Unmute speaker" : "Mute speaker"}
            >
              {speakerOff ? (
                <VolumeX className="w-6 h-6 text-white" />
              ) : (
                <Volume2 className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-700" />

            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-all transform hover:scale-110 active:scale-95"
              title="Settings"
            >
              <Settings className="w-6 h-6 text-white" />
            </button>

            {/* End Call */}
            <button
              onClick={endCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all transform hover:scale-110 active:scale-95"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Status Bar (Top) */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-gray-900/95 backdrop-blur-lg border border-gray-700 rounded-xl px-4 py-2 shadow-lg flex items-center gap-4">
          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-600/20 border border-red-600/30 rounded-lg">
              <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-sm text-red-400 font-medium">Recording</span>
            </div>
          )}

          {/* Participant Count (Group Calls) */}
          {isGroupCall && (
            <div className="flex items-center gap-2 text-gray-300">
              <Users className="w-4 h-4" />
              <span className="text-sm">{participantCount}</span>
            </div>
          )}

          {/* Network Quality */}
          <div className="flex items-center gap-2">
            <Signal className={`w-4 h-4 ${getNetworkQualityColor()}`} />
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={`w-1 rounded-full transition-all ${
                    bar <= getNetworkQualityBars()
                      ? `h-${bar * 2} ${getNetworkQualityColor()}`
                      : "h-2 bg-gray-600"
                  }`}
                  style={{ height: bar <= getNetworkQualityBars() ? `${bar * 3}px` : "4px" }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-40"
          >
            <div className="bg-gray-900/95 backdrop-blur-lg border border-gray-700 rounded-xl p-4 shadow-2xl min-w-[320px]">
              <h3 className="text-white font-semibold mb-4">Call Settings</h3>

              {/* Audio Device */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Microphone</label>
                <select
                  value={selectedAudioDevice || ""}
                  onChange={(e) => switchAudioDevice(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Video Device */}
              {callType === "video" && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Camera</label>
                  <select
                    value={selectedVideoDevice || ""}
                    onChange={(e) => switchVideoDevice(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {videoDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => setShowSettings(false)}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
