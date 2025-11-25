// FILE: src/utils/webrtc.js

import { WEBRTC_CONFIG } from "./constants";

export class WebRTCManager {
  constructor() {
    this.pc = null;
    this.localStream = null;
  }

  /* --------------------------------------------------
     CREATE AND INITIATE PEER CONNECTION
  -------------------------------------------------- */
  createPeerConnection(onRemoteStream, onIceCandidate) {
    this.pc = new RTCPeerConnection(WEBRTC_CONFIG);

    /* Remote stream added */
    this.pc.ontrack = (event) => {
      if (onRemoteStream) onRemoteStream(event.streams[0]);
    };

    /* ICE candidate created locally */
    this.pc.onicecandidate = (event) => {
      if (event.candidate && onIceCandidate) {
        onIceCandidate(event.candidate);
      }
    };

    return this.pc;
  }

  /* --------------------------------------------------
     GET LOCAL AUDIO/VIDEO STREAM
  -------------------------------------------------- */
  async getLocalStream(video = true, audio = true) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video,
        audio,
      });

      return this.localStream;
    } catch (err) {
      console.error("Failed to get local media:", err);
      throw err;
    }
  }

  /* --------------------------------------------------
     ATTACH LOCAL STREAM TO PC
  -------------------------------------------------- */
  attachLocalStreamToPC() {
    if (!this.pc || !this.localStream) return;

    this.localStream.getTracks().forEach((track) => {
      this.pc.addTrack(track, this.localStream);
    });
  }

  /* --------------------------------------------------
     CREATE OFFER (caller)
  -------------------------------------------------- */
  async createOffer() {
    if (!this.pc) throw new Error("PeerConnection missing.");

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    return offer;
  }

  /* --------------------------------------------------
     CREATE ANSWER (callee)
  -------------------------------------------------- */
  async createAnswer() {
    if (!this.pc) throw new Error("PeerConnection missing.");

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return answer;
  }

  /* --------------------------------------------------
     APPLY REMOTE SDP (offer or answer)
  -------------------------------------------------- */
  async setRemoteDescription(sdp) {
    if (!this.pc) throw new Error("PeerConnection missing.");

    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  /* --------------------------------------------------
     ADD REMOTE ICE CANDIDATE
  -------------------------------------------------- */
  async addIceCandidate(candidate) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      console.error("ICE candidate error:", err);
    }
  }

  /* --------------------------------------------------
     END CALL + CLEANUP
  -------------------------------------------------- */
  close() {
    if (this.pc) {
      this.pc.getSenders().forEach((s) => s.track && s.track.stop());
      this.pc.close();
      this.pc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }
}

/* --------------------------------------------------
   FACTORY CREATOR
-------------------------------------------------- */
export function createWebRTC() {
  return new WebRTCManager();
}
