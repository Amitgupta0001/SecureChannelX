// FILE: src/utils/webrtc.js

import { WEBRTC_CONFIG, MEDIA_CONSTRAINTS } from "./constants";
import { logError } from "./errorLogger";

/**
 * WebRTCManager - Manages WebRTC peer connections for audio/video calls
 * @class WebRTCManager
 */
export class WebRTCManager {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.dataChannel = null;
    this.iceCandidateQueue = [];
    this.connectionState = "new";
    
    // Event callbacks
    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onIceCandidate = null;
    this.onConnectionStateChange = null;
    this.onDataChannelMessage = null;
    
    // State flags
    this.isInitiator = false;
    this.isMuted = false;
    this.isVideoOff = false;
    this.isScreenSharing = false;
    
    // Stats tracking
    this.statsInterval = null;
    this.lastStats = null;
  }

  /* ========================================
     INITIALIZATION
  ======================================== */
  async init(isInitiator = false) {
    try {
      this.isInitiator = isInitiator;
      
      if (this.pc) {
        console.warn("⚠️ PeerConnection already exists, closing old one");
        this.close();
      }
      
      this.pc = new RTCPeerConnection(WEBRTC_CONFIG);
      this.setupPeerConnectionListeners();
      
      if (isInitiator) {
        this.createDataChannel();
      }
      
      console.log("✅ WebRTC initialized");
      return true;
    } catch (err) {
      logError(err, { operation: "webrtc_init", isInitiator });
      throw new Error("Failed to initialize WebRTC");
    }
  }

  /* ========================================
     PEER CONNECTION LISTENERS
  ======================================== */
  setupPeerConnectionListeners() {
    if (!this.pc) return;

    // Remote track received
    this.pc.ontrack = (event) => {
      console.log("📹 Remote track received:", event.track.kind);
      
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStream?.(event.streams[0]);
      }
    };

    // ICE candidate generated
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("📡 ICE candidate generated");
        this.onIceCandidate?.(event.candidate);
      } else {
        console.log("📡 All ICE candidates have been sent");
      }
    };

    // Connection state changed
    this.pc.onconnectionstatechange = () => {
      this.connectionState = this.pc.connectionState;
      console.log(`🔗 Connection state: ${this.connectionState}`);
      this.onConnectionStateChange?.(this.connectionState);

      if (this.connectionState === "failed") {
        console.error("🔴 Connection failed, attempting ICE restart");
        this.handleConnectionFailure();
      } else if (this.connectionState === "connected") {
        console.log("✅ WebRTC connection established");
        this.startStatsMonitoring();
      } else if (this.connectionState === "disconnected") {
        console.warn("⚠️ Connection disconnected");
        this.stopStatsMonitoring();
      }
    };

    // ICE connection state changed
    this.pc.oniceconnectionstatechange = () => {
      console.log(`❄️ ICE connection state: ${this.pc.iceConnectionState}`);
      
      if (this.pc.iceConnectionState === "failed") {
        console.error("❄️ ICE connection failed");
      }
    };

    // ICE gathering state changed
    this.pc.onicegatheringstatechange = () => {
      console.log(`❄️ ICE gathering state: ${this.pc.iceGatheringState}`);
    };

    // Signaling state changed
    this.pc.onsignalingstatechange = () => {
      console.log(`📡 Signaling state: ${this.pc.signalingState}`);
    };

    // Negotiation needed (for renegotiation)
    this.pc.onnegotiationneeded = async () => {
      console.log("🔄 Negotiation needed");
      
      if (this.isInitiator && this.pc.signalingState === "stable") {
        try {
          const offer = await this.createOffer();
          // Emit offer through socket or callback
          console.log("📤 Renegotiation offer created");
        } catch (err) {
          logError(err, { operation: "renegotiation" });
        }
      }
    };

    // Data channel received (for callee)
    this.pc.ondatachannel = (event) => {
      console.log("💬 Data channel received");
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };
  }

  /* ========================================
     MEDIA STREAM MANAGEMENT
  ======================================== */
  async getLocalStream(videoEnabled = true, audioEnabled = true, customConstraints = {}) {
    try {
      const constraints = {
        video: videoEnabled
          ? { ...MEDIA_CONSTRAINTS.VIDEO, ...customConstraints.video }
          : false,
        audio: audioEnabled
          ? { ...MEDIA_CONSTRAINTS.AUDIO, ...customConstraints.audio }
          : false,
      };

      console.log("🎥 Requesting media with constraints:", constraints);

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log(
        "✅ Local stream obtained:",
        this.localStream.getTracks().map((t) => `${t.kind}: ${t.label}`)
      );

      // Add tracks to peer connection
      if (this.pc) {
        this.localStream.getTracks().forEach((track) => {
          console.log(`➕ Adding ${track.kind} track to peer connection`);
          this.pc.addTrack(track, this.localStream);
        });
      }

      this.onLocalStream?.(this.localStream);
      return this.localStream;
    } catch (err) {
      console.error("❌ Failed to get local media:", err);

      const errorMessages = {
        NotAllowedError: "Camera/microphone permission denied. Please allow access in browser settings.",
        NotFoundError: "No camera/microphone found on this device.",
        NotReadableError: "Camera/microphone is already in use by another application.",
        OverconstrainedError: "The requested media constraints cannot be satisfied.",
        TypeError: "Invalid media constraints provided.",
      };

      const message = errorMessages[err.name] || "Failed to access media devices";
      
      logError(err, { 
        operation: "get_local_stream", 
        videoEnabled, 
        audioEnabled,
        errorName: err.name 
      });
      
      throw new Error(message);
    }
  }

  async switchCamera(facingMode = "user") {
    if (!this.localStream) {
      throw new Error("No local stream available");
    }

    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      
      if (!videoTrack) {
        throw new Error("No video track found");
      }

      // Stop current video track
      videoTrack.stop();

      // Get new stream with different camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { ...MEDIA_CONSTRAINTS.VIDEO, facingMode },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track in peer connection
      if (this.pc) {
        const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      // Replace in local stream
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);

      console.log(`📹 Camera switched to ${facingMode}`);
      return newVideoTrack;
    } catch (err) {
      logError(err, { operation: "switch_camera", facingMode });
      throw new Error("Failed to switch camera");
    }
  }

  async startScreenShare() {
    try {
      if (this.isScreenSharing) {
        console.warn("⚠️ Already screen sharing");
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia(
        MEDIA_CONSTRAINTS.SCREEN_SHARE
      );

      const screenTrack = screenStream.getVideoTracks()[0];

      // Handle screen share stop (user clicks browser stop button)
      screenTrack.onended = () => {
        console.log("🛑 Screen sharing stopped by user");
        this.stopScreenShare();
      };

      // Replace video track in peer connection
      if (this.pc && this.localStream) {
        const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");

        if (sender) {
          // Store original video track
          this.originalVideoTrack = sender.track;
          await sender.replaceTrack(screenTrack);
        }

        // Replace in local stream
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
        }
        this.localStream.addTrack(screenTrack);
      }

      this.isScreenSharing = true;
      console.log("✅ Screen sharing started");
      
      return screenStream;
    } catch (err) {
      if (err.name === "NotAllowedError") {
        console.log("ℹ️ Screen sharing permission denied by user");
      } else {
        logError(err, { operation: "start_screen_share" });
      }
      throw new Error("Failed to start screen sharing");
    }
  }

  async stopScreenShare() {
    if (!this.isScreenSharing) return;

    try {
      // Restore original video track
      if (this.pc && this.originalVideoTrack) {
        const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
        
        if (sender) {
          await sender.replaceTrack(this.originalVideoTrack);
        }

        // Replace in local stream
        const screenTrack = this.localStream.getVideoTracks()[0];
        if (screenTrack) {
          screenTrack.stop();
          this.localStream.removeTrack(screenTrack);
        }
        
        if (this.originalVideoTrack) {
          this.localStream.addTrack(this.originalVideoTrack);
        }
      }

      this.isScreenSharing = false;
      this.originalVideoTrack = null;
      
      console.log("✅ Screen sharing stopped");
    } catch (err) {
      logError(err, { operation: "stop_screen_share" });
      throw new Error("Failed to stop screen sharing");
    }
  }

  /* ========================================
     OFFER/ANSWER HANDLING
  ======================================== */
  async createOffer() {
    try {
      if (!this.pc) {
        throw new Error("Peer connection not initialized");
      }

      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.pc.setLocalDescription(offer);
      console.log("📤 Offer created and set as local description");

      return offer;
    } catch (err) {
      logError(err, { operation: "create_offer" });
      throw new Error("Failed to create offer");
    }
  }

  async createAnswer() {
    try {
      if (!this.pc) {
        throw new Error("Peer connection not initialized");
      }

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      console.log("📤 Answer created and set as local description");

      return answer;
    } catch (err) {
      logError(err, { operation: "create_answer" });
      throw new Error("Failed to create answer");
    }
  }

  async setRemoteDescription(sdp) {
    try {
      if (!this.pc) {
        throw new Error("Peer connection not initialized");
      }

      if (!sdp || !sdp.type || !sdp.sdp) {
        throw new Error("Invalid SDP");
      }

      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log(`✅ Remote description set (${sdp.type})`);

      // Process queued ICE candidates
      if (this.iceCandidateQueue.length > 0) {
        console.log(`📡 Processing ${this.iceCandidateQueue.length} queued ICE candidates`);
        
        for (const candidate of this.iceCandidateQueue) {
          await this.addIceCandidate(candidate);
        }
        
        this.iceCandidateQueue = [];
      }
    } catch (err) {
      logError(err, { operation: "set_remote_description", sdpType: sdp?.type });
      throw new Error("Failed to set remote description");
    }
  }

  async addIceCandidate(candidate) {
    try {
      if (!this.pc) {
        console.warn("⚠️ Peer connection not initialized, queueing ICE candidate");
        this.iceCandidateQueue.push(candidate);
        return;
      }

      // Queue if remote description not set yet
      if (!this.pc.remoteDescription) {
        console.log("📡 Queueing ICE candidate (remote description not set)");
        this.iceCandidateQueue.push(candidate);
        return;
      }

      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("✅ ICE candidate added");
    } catch (err) {
      // ICE candidates can fail gracefully, don't throw
      console.warn("⚠️ Failed to add ICE candidate:", err.message);
      logError(err, { operation: "add_ice_candidate" });
    }
  }

  /* ========================================
     DATA CHANNEL
  ======================================== */
  createDataChannel(label = "chat", options = {}) {
    if (!this.pc) {
      console.warn("⚠️ Peer connection not initialized");
      return;
    }

    const defaultOptions = {
      ordered: true,
      maxRetransmits: 3,
    };

    this.dataChannel = this.pc.createDataChannel(label, {
      ...defaultOptions,
      ...options,
    });

    this.setupDataChannelListeners();
    console.log(`💬 Data channel "${label}" created`);
  }

  setupDataChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log("💬 Data channel opened");
    };

    this.dataChannel.onclose = () => {
      console.log("💬 Data channel closed");
    };

    this.dataChannel.onmessage = (event) => {
      console.log("💬 Data channel message:", event.data);
      this.onDataChannelMessage?.(event.data);
    };

    this.dataChannel.onerror = (err) => {
      console.error("❌ Data channel error:", err);
      logError(err, { operation: "data_channel" });
    };
  }

  sendDataChannelMessage(message) {
    if (!this.dataChannel) {
      console.warn("⚠️ Data channel not available");
      return false;
    }

    if (this.dataChannel.readyState !== "open") {
      console.warn("⚠️ Data channel not open");
      return false;
    }

    try {
      const data = typeof message === "string" ? message : JSON.stringify(message);
      this.dataChannel.send(data);
      return true;
    } catch (err) {
      logError(err, { operation: "send_data_channel_message" });
      return false;
    }
  }

  /* ========================================
     MEDIA CONTROLS
  ======================================== */
  toggleAudio() {
    if (!this.localStream) {
      console.warn("⚠️ No local stream available");
      return false;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isMuted = !audioTrack.enabled;
      console.log(`🎤 Audio ${this.isMuted ? "muted" : "unmuted"}`);
      return this.isMuted;
    }
    
    console.warn("⚠️ No audio track found");
    return false;
  }

  toggleVideo() {
    if (!this.localStream) {
      console.warn("⚠️ No local stream available");
      return false;
    }

    const videoTrack = this.localStream.getVideoTracks()[0];
    
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.isVideoOff = !videoTrack.enabled;
      console.log(`📹 Video ${this.isVideoOff ? "off" : "on"}`);
      return this.isVideoOff;
    }
    
    console.warn("⚠️ No video track found");
    return false;
  }

  setVolume(volume) {
    if (!this.remoteStream) return;

    // Volume control (0.0 to 1.0)
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    // This would need to be implemented on the audio element
    console.log(`🔊 Volume set to ${(clampedVolume * 100).toFixed(0)}%`);
  }

  /* ========================================
     STATISTICS MONITORING
  ======================================== */
  startStatsMonitoring(interval = 1000) {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.getStats();
        this.lastStats = stats;
      } catch (err) {
        console.error("Failed to get stats:", err);
      }
    }, interval);

    console.log("📊 Stats monitoring started");
  }

  stopStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      console.log("📊 Stats monitoring stopped");
    }
  }

  async getStats() {
    if (!this.pc) return null;

    try {
      const stats = await this.pc.getStats();
      const report = {
        timestamp: Date.now(),
        inbound: {},
        outbound: {},
        connection: {},
      };

      stats.forEach((stat) => {
        if (stat.type === "inbound-rtp") {
          report.inbound[stat.kind] = {
            bytesReceived: stat.bytesReceived,
            packetsReceived: stat.packetsReceived,
            packetsLost: stat.packetsLost,
            jitter: stat.jitter,
          };
        } else if (stat.type === "outbound-rtp") {
          report.outbound[stat.kind] = {
            bytesSent: stat.bytesSent,
            packetsSent: stat.packetsSent,
          };
        } else if (stat.type === "candidate-pair" && stat.state === "succeeded") {
          report.connection = {
            currentRoundTripTime: stat.currentRoundTripTime,
            availableOutgoingBitrate: stat.availableOutgoingBitrate,
          };
        }
      });

      return report;
    } catch (err) {
      logError(err, { operation: "get_stats" });
      return null;
    }
  }

  getConnectionQuality() {
    if (!this.lastStats?.connection) return "unknown";

    const rtt = this.lastStats.connection.currentRoundTripTime;
    
    if (!rtt) return "unknown";
    
    if (rtt < 0.1) return "excellent";
    if (rtt < 0.3) return "good";
    if (rtt < 0.5) return "fair";
    return "poor";
  }

  /* ========================================
     ERROR HANDLING
  ======================================== */
  async handleConnectionFailure() {
    console.error("🔴 Handling connection failure");

    if (this.pc && this.pc.iceConnectionState !== "closed") {
      try {
        // Attempt ICE restart
        this.pc.restartIce();
        console.log("🔄 ICE restart initiated");
      } catch (err) {
        logError(err, { operation: "ice_restart" });
      }
    }
  }

  /* ========================================
     CLEANUP
  ======================================== */
  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }
  }

  close() {
    console.log("🧹 Cleaning up WebRTC resources");

    this.stopStatsMonitoring();
    this.stopLocalStream();

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.iceCandidateQueue = [];
    this.connectionState = "closed";
    this.isScreenSharing = false;
    this.originalVideoTrack = null;

    console.log("✅ WebRTC cleanup complete");
  }
}

/* ========================================
   FACTORY FUNCTION
======================================== */
export function createWebRTC() {
  return new WebRTCManager();
}

export default WebRTCManager;
