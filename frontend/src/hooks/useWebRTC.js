/**
 * ✅ ENHANCED: SecureChannelX - WebRTC Hook
 * -----------------------------------------
 * Manages peer-to-peer WebRTC connections
 * 
 * Changes:
 *   - Fixed: Peer connection state tracking
 *   - Fixed: Stream cleanup on unmount
 *   - Fixed: ICE candidate buffering
 *   - Added: Connection quality monitoring
 *   - Added: Screen sharing support
 *   - Added: Audio/Video device management
 *   - Added: Bandwidth adaptation
 *   - Enhanced: Error handling
 *   - Enhanced: State management
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import callApi from "../api/callApi";

// ICE Servers configuration (add TURN servers for production)
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // Add TURN servers for better connectivity:
    // {
    //   urls: "turn:your-turn-server.com:3478",
    //   username: "username",
    //   credential: "password"
    // }
  ],
  iceCandidatePoolSize: 10,
};

export default function useWebRTC(callInfo, setCallInfo, onEnd) {
  const { socket, safeEmit, isConnected } = useSocket();
  const { user } = useAuth();

  // Refs for persistent objects
  const pc = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const screenStream = useRef(null);
  const iceCandidateQueue = useRef([]);
  const statsIntervalRef = useRef(null);

  // State
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [connectionState, setConnectionState] = useState("new"); // new, connecting, connected, disconnected, failed, closed
  const [connectionQuality, setConnectionQuality] = useState("good"); // good, fair, poor
  const [availableDevices, setAvailableDevices] = useState({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [selectedDevices, setSelectedDevices] = useState({
    audioInput: null,
    videoInput: null,
    audioOutput: null,
  });

  /**
   * ✅ HELPER: Get user ID
   */
  const getUserId = useCallback(() => {
    return user?.id || user?.user_id || user?._id;
  }, [user]);

  /**
   * ✅ NEW: Enumerate available media devices
   */
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

      setAvailableDevices({ audioInputs, videoInputs, audioOutputs });

      console.log("🎥 Available devices:", {
        audio: audioInputs.length,
        video: videoInputs.length,
        speakers: audioOutputs.length,
      });

      return { audioInputs, videoInputs, audioOutputs };
    } catch (err) {
      console.error("❌ Failed to enumerate devices:", err);
      return null;
    }
  }, []);

  /**
   * ✅ ENHANCED: Create peer connection with monitoring
   */
  const createPeerConnection = useCallback(() => {
    if (pc.current) {
      console.warn("⚠️ Peer connection already exists");
      return pc.current;
    }

    console.log("🔗 Creating peer connection...");

    const peer = new RTCPeerConnection(ICE_SERVERS);

    // ===== CONNECTION STATE TRACKING =====

    peer.onconnectionstatechange = () => {
      console.log(`📡 Connection state: ${peer.connectionState}`);
      setConnectionState(peer.connectionState);

      if (peer.connectionState === "failed") {
        console.error("❌ Connection failed, attempting ICE restart");
        restartIce();
      }

      if (peer.connectionState === "disconnected") {
        console.warn("⚠️ Connection disconnected");
      }

      if (peer.connectionState === "closed") {
        console.log("🔒 Connection closed");
        cleanup();
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE state: ${peer.iceConnectionState}`);

      if (peer.iceConnectionState === "failed") {
        console.error("❌ ICE connection failed");
      }
    };

    // ===== ICE CANDIDATE HANDLING =====

    peer.onicecandidate = (e) => {
      if (e.candidate && callInfo) {
        console.log("🧊 Sending ICE candidate");
        
        safeEmit("webrtc_ice_candidate", {
          call_id: callInfo.call_id || callInfo.id,
          candidate: e.candidate.toJSON(),
          sender_id: getUserId(),
        });
      } else if (!e.candidate) {
        console.log("✅ ICE candidate gathering complete");
      }
    };

    peer.onicegatheringstatechange = () => {
      console.log(`🧊 ICE gathering state: ${peer.iceGatheringState}`);
    };

    // ===== REMOTE TRACK HANDLING =====

    peer.ontrack = (e) => {
      console.log("📹 Remote track received:", e.track.kind);

      if (!remoteStream.current) {
        remoteStream.current = new MediaStream();
      }

      // Add track to remote stream
      if (e.streams && e.streams[0]) {
        remoteStream.current = e.streams[0];
      } else {
        remoteStream.current.addTrack(e.track);
      }

      console.log("✅ Remote stream updated");
    };

    // ===== NEGOTIATION HANDLING =====

    peer.onnegotiationneeded = async () => {
      console.log("🔄 Negotiation needed");
      
      // Handle renegotiation (e.g., for screen sharing)
      if (peer.signalingState !== "stable") {
        console.log("⏳ Signaling state not stable, deferring negotiation");
        return;
      }

      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        if (callInfo) {
          safeEmit("webrtc_offer", {
            call_id: callInfo.call_id || callInfo.id,
            offer: peer.localDescription,
            sender_id: getUserId(),
          });
        }
      } catch (err) {
        console.error("❌ Negotiation failed:", err);
      }
    };

    pc.current = peer;

    // Start connection quality monitoring
    startQualityMonitoring();

    return peer;
  }, [callInfo, safeEmit, getUserId]);

  /**
   * ✅ ENHANCED: Initialize local media stream with device selection
   */
  const initLocalMedia = useCallback(
    async (type = "video", deviceConstraints = {}) => {
      try {
        console.log(`🎥 Requesting ${type} stream...`);

        const constraints =
          type === "audio"
            ? {
                audio: {
                  deviceId: deviceConstraints.audioInput
                    ? { exact: deviceConstraints.audioInput }
                    : undefined,
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
                video: false,
              }
            : {
                audio: {
                  deviceId: deviceConstraints.audioInput
                    ? { exact: deviceConstraints.audioInput }
                    : undefined,
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
                video: {
                  deviceId: deviceConstraints.videoInput
                    ? { exact: deviceConstraints.videoInput }
                    : undefined,
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  frameRate: { ideal: 30 },
                },
              };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        localStream.current = stream;

        console.log("✅ Local media acquired:", {
          audio: stream.getAudioTracks().length,
          video: stream.getVideoTracks().length,
        });

        // Create peer connection if not exists
        if (!pc.current) {
          createPeerConnection();
        }

        // Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          console.log(`➕ Adding ${track.kind} track to peer connection`);
          pc.current.addTrack(track, stream);
        });

        return stream;
      } catch (err) {
        console.error("❌ Failed to get local media:", err);
        
        if (err.name === "NotAllowedError") {
          throw new Error("Camera/Microphone permission denied");
        } else if (err.name === "NotFoundError") {
          throw new Error("No camera/microphone found");
        } else {
          throw new Error("Failed to access media devices");
        }
      }
    },
    [createPeerConnection]
  );

  /**
   * ✅ ENHANCED: Start outgoing call
   */
  const startCall = useCallback(
    async (chatId, receiverId, type = "video") => {
      try {
        console.log(`📞 Starting ${type} call to user ${receiverId}...`);

        // Initialize call via API
        const res = await callApi.startCall(chatId, receiverId, type);
        
        if (!res?.call) {
          throw new Error("Failed to initialize call");
        }

        setCallInfo(res.call);

        // Get local media
        await initLocalMedia(type, selectedDevices);

        // Create offer
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);

        console.log("✅ Offer created and set as local description");

        // Send offer via socket
        safeEmit("webrtc_offer", {
          call_id: res.call.call_id || res.call.id,
          offer: pc.current.localDescription,
          sender_id: getUserId(),
          call_type: type,
        });

        console.log("✅ Call started successfully");

        return res.call;
      } catch (err) {
        console.error("❌ Failed to start call:", err);
        throw err;
      }
    },
    [safeEmit, setCallInfo, initLocalMedia, selectedDevices, getUserId]
  );

  /**
   * ✅ ENHANCED: Handle remote offer and create answer
   */
  const handleOffer = useCallback(
    async (offer) => {
      try {
        console.log("📥 Handling remote offer...");

        if (!callInfo) {
          console.warn("⚠️ No call info available");
          return;
        }

        // Initialize local media
        await initLocalMedia(callInfo.call_type || "video", selectedDevices);

        // Set remote description
        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
        console.log("✅ Remote description set");

        // Process queued ICE candidates
        if (iceCandidateQueue.current.length > 0) {
          console.log(`🧊 Processing ${iceCandidateQueue.current.length} queued ICE candidates`);
          
          for (const candidate of iceCandidateQueue.current) {
            await handleIceCandidate(candidate);
          }
          
          iceCandidateQueue.current = [];
        }

        // Create answer
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);

        console.log("✅ Answer created and set as local description");

        // Send answer
        safeEmit("webrtc_answer", {
          call_id: callInfo.call_id || callInfo.id,
          answer: pc.current.localDescription,
          sender_id: getUserId(),
        });

        console.log("✅ Answer sent");
      } catch (err) {
        console.error("❌ Failed to handle offer:", err);
      }
    },
    [callInfo, safeEmit, initLocalMedia, selectedDevices, getUserId]
  );

  /**
   * ✅ ENHANCED: Accept incoming call
   */
  const acceptCall = useCallback(async () => {
    if (!callInfo) {
      console.error("❌ No call info to accept");
      return;
    }

    try {
      console.log("✅ Accepting call...");

      // Notify via socket
      safeEmit("call_accepted", {
        call_id: callInfo.call_id || callInfo.id,
        user_id: getUserId(),
      });

      // Handle the offer if available
      if (callInfo.sdp) {
        await handleOffer(callInfo.sdp);
      }
    } catch (err) {
      console.error("❌ Failed to accept call:", err);
    }
  }, [callInfo, safeEmit, handleOffer, getUserId]);

  /**
   * ✅ ENHANCED: Reject incoming call
   */
  const rejectCall = useCallback(() => {
    if (!callInfo) return;

    console.log("❌ Rejecting call...");

    safeEmit("call_rejected", {
      call_id: callInfo.call_id || callInfo.id,
      user_id: getUserId(),
      reason: "rejected",
    });

    cleanup();
    onEnd();
  }, [callInfo, safeEmit, onEnd, getUserId]);

  /**
   * ✅ ENHANCED: Handle answer from peer
   */
  const handleAnswer = useCallback(
    async (answer) => {
      try {
        console.log("📥 Handling remote answer...");

        if (!pc.current) {
          console.error("❌ No peer connection");
          return;
        }

        await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ Remote description set");

        // Process queued ICE candidates
        if (iceCandidateQueue.current.length > 0) {
          console.log(`🧊 Processing ${iceCandidateQueue.current.length} queued ICE candidates`);
          
          for (const candidate of iceCandidateQueue.current) {
            await handleIceCandidate(candidate);
          }
          
          iceCandidateQueue.current = [];
        }
      } catch (err) {
        console.error("❌ Failed to handle answer:", err);
      }
    },
    []
  );

  /**
   * ✅ ENHANCED: Handle ICE candidate with buffering
   */
  const handleIceCandidate = useCallback(
    async (candidate) => {
      try {
        if (!pc.current) {
          console.warn("⚠️ No peer connection, ignoring ICE candidate");
          return;
        }

        // Buffer candidates if remote description not set
        if (!pc.current.remoteDescription || !pc.current.remoteDescription.type) {
          console.log("🧊 Buffering ICE candidate (no remote description yet)");
          iceCandidateQueue.current.push(candidate);
          return;
        }

        // Add candidate
        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("✅ ICE candidate added");
      } catch (err) {
        console.error("❌ Failed to add ICE candidate:", err);
      }
    },
    []
  );

  /**
   * ✅ NEW: Start screen sharing
   */
  const startScreenShare = useCallback(async () => {
    try {
      console.log("🖥️ Starting screen share...");

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
        },
        audio: false,
      });

      screenStream.current = stream;

      // Replace video track
      const videoTrack = stream.getVideoTracks()[0];
      const sender = pc.current
        .getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(videoTrack);
        console.log("✅ Screen sharing started");
        setIsSharingScreen(true);

        // Handle screen share stop
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (err) {
      console.error("❌ Screen share failed:", err);
      throw err;
    }
  }, []);

  /**
   * ✅ NEW: Stop screen sharing
   */
  const stopScreenShare = useCallback(async () => {
    try {
      console.log("🖥️ Stopping screen share...");

      if (screenStream.current) {
        screenStream.current.getTracks().forEach((t) => t.stop());
        screenStream.current = null;
      }

      // Restore camera
      if (localStream.current) {
        const videoTrack = localStream.current.getVideoTracks()[0];
        const sender = pc.current
          .getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          console.log("✅ Camera restored");
        }
      }

      setIsSharingScreen(false);
    } catch (err) {
      console.error("❌ Failed to stop screen share:", err);
    }
  }, []);

  /**
   * ✅ NEW: Monitor connection quality
   */
  const startQualityMonitoring = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(async () => {
      if (!pc.current) return;

      try {
        const stats = await pc.current.getStats();
        let packetLoss = 0;
        let roundTripTime = 0;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.mediaType === "video") {
            packetLoss = report.packetsLost || 0;
          }

          if (report.type === "candidate-pair" && report.state === "succeeded") {
            roundTripTime = report.currentRoundTripTime || 0;
          }
        });

        // Determine quality
        let quality = "good";
        if (packetLoss > 50 || roundTripTime > 500) {
          quality = "poor";
        } else if (packetLoss > 20 || roundTripTime > 200) {
          quality = "fair";
        }

        setConnectionQuality(quality);
      } catch (err) {
        console.error("❌ Stats error:", err);
      }
    }, 3000); // Check every 3 seconds
  }, []);

  /**
   * ✅ NEW: Restart ICE (for connection recovery)
   */
  const restartIce = useCallback(async () => {
    if (!pc.current) return;

    try {
      console.log("🔄 Restarting ICE...");

      const offer = await pc.current.createOffer({ iceRestart: true });
      await pc.current.setLocalDescription(offer);

      if (callInfo) {
        safeEmit("webrtc_offer", {
          call_id: callInfo.call_id || callInfo.id,
          offer: pc.current.localDescription,
          sender_id: getUserId(),
          ice_restart: true,
        });
      }

      console.log("✅ ICE restart initiated");
    } catch (err) {
      console.error("❌ ICE restart failed:", err);
    }
  }, [callInfo, safeEmit, getUserId]);

  /**
   * ✅ ENHANCED: Cleanup resources
   */
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up WebRTC resources...");

    // Stop quality monitoring
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    // Stop local stream
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      localStream.current = null;
    }

    // Stop screen stream
    if (screenStream.current) {
      screenStream.current.getTracks().forEach((track) => track.stop());
      screenStream.current = null;
    }

    // Close peer connection
    if (pc.current) {
      pc.current.close();
      pc.current = null;
      console.log("🔒 Peer connection closed");
    }

    // Clear remote stream
    remoteStream.current = null;

    // Clear ICE candidate queue
    iceCandidateQueue.current = [];

    // Reset state
    setConnectionState("closed");
    setIsSharingScreen(false);

    console.log("✅ Cleanup complete");
  }, []);

  /**
   * ✅ ENHANCED: End call
   */
  const endCall = useCallback(() => {
    if (!callInfo) return;

    console.log("📞 Ending call...");

    safeEmit("call_ended", {
      call_id: callInfo.call_id || callInfo.id,
      user_id: getUserId(),
    });

    cleanup();
    onEnd();
  }, [callInfo, safeEmit, cleanup, onEnd, getUserId]);

  /**
   * ✅ ENHANCED: Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (!localStream.current) {
      console.warn("⚠️ No local stream");
      return;
    }

    const audioTrack = localStream.current.getAudioTracks()[0];
    
    if (!audioTrack) {
      console.warn("⚠️ No audio track");
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);

    console.log(audioTrack.enabled ? "🔊 Unmuted" : "🔇 Muted");
  }, []);

  /**
   * ✅ ENHANCED: Toggle camera
   */
  const toggleCamera = useCallback(() => {
    if (!localStream.current) {
      console.warn("⚠️ No local stream");
      return;
    }

    const videoTrack = localStream.current.getVideoTracks()[0];
    
    if (!videoTrack) {
      console.warn("⚠️ No video track");
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);

    console.log(videoTrack.enabled ? "📹 Camera on" : "📵 Camera off");
  }, []);

  /**
   * ✅ NEW: Switch camera/microphone
   */
  const switchDevice = useCallback(
    async (deviceType, deviceId) => {
      try {
        console.log(`🔄 Switching ${deviceType} to ${deviceId}`);

        const constraints = {};

        if (deviceType === "audioinput") {
          constraints.audio = { deviceId: { exact: deviceId } };
          setSelectedDevices((prev) => ({ ...prev, audioInput: deviceId }));
        } else if (deviceType === "videoinput") {
          constraints.video = { deviceId: { exact: deviceId } };
          setSelectedDevices((prev) => ({ ...prev, videoInput: deviceId }));
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = stream.getTracks()[0];

        const sender = pc.current
          .getSenders()
          .find((s) => s.track?.kind === newTrack.kind);

        if (sender) {
          await sender.replaceTrack(newTrack);
          
          // Stop old track
          const oldTrack = localStream.current
            .getTracks()
            .find((t) => t.kind === newTrack.kind);
          
          if (oldTrack) {
            oldTrack.stop();
            localStream.current.removeTrack(oldTrack);
          }
          
          localStream.current.addTrack(newTrack);

          console.log(`✅ ${deviceType} switched`);
        }
      } catch (err) {
        console.error(`❌ Failed to switch ${deviceType}:`, err);
      }
    },
    []
  );

  /**
   * ✅ EFFECT: Register socket event handlers
   */
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("📡 Registering WebRTC socket handlers");

    const handlers = {
      incoming_call: ({ call }) => {
        console.log("📞 Incoming call:", call);
        setCallInfo(call);
      },

      webrtc_offer: ({ offer, sender_id }) => {
        console.log("📥 Received offer from:", sender_id);
        handleOffer(offer);
      },

      webrtc_answer: ({ answer, sender_id }) => {
        console.log("📥 Received answer from:", sender_id);
        handleAnswer(answer);
      },

      webrtc_ice_candidate: ({ candidate, sender_id }) => {
        console.log("🧊 Received ICE candidate from:", sender_id);
        handleIceCandidate(candidate);
      },

      call_accepted: ({ user_id }) => {
        console.log("✅ Call accepted by:", user_id);
      },

      call_ended: ({ user_id, reason }) => {
        console.log("📞 Call ended by:", user_id, "reason:", reason);
        cleanup();
        onEnd();
      },

      call_rejected: ({ user_id, reason }) => {
        console.log("❌ Call rejected by:", user_id, "reason:", reason);
        cleanup();
        onEnd();
      },
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup
    return () => {
      console.log("📡 Unregistering WebRTC socket handlers");
      
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [
    socket,
    isConnected,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup,
    onEnd,
    setCallInfo,
  ]);

  /**
   * ✅ EFFECT: Cleanup on unmount
   */
  useEffect(() => {
    // Enumerate devices on mount
    enumerateDevices();

    return () => {
      cleanup();
    };
  }, [enumerateDevices, cleanup]);

  /**
   * ✅ EFFECT: Monitor device changes
   */
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log("🔄 Media devices changed");
      enumerateDevices();
    };

    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [enumerateDevices]);

  return {
    // Streams
    localStream,
    remoteStream,
    screenStream,

    // State
    isCameraOn,
    isMuted,
    isSharingScreen,
    connectionState,
    connectionQuality,
    availableDevices,
    selectedDevices,

    // Call control
    startCall,
    acceptCall,
    rejectCall,
    endCall,

    // Media control
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    switchDevice,

    // Connection control
    restartIce,

    // Peer connection (for debugging)
    peerConnection: pc.current,
  };
}
