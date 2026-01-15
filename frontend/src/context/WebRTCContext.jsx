import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { useSocket } from "./SocketContext";
import { AuthContext } from "./AuthContext";

const WebRTCContext = createContext(null);

export const WebRTCProvider = ({ children }) => {
    const { socket, safeEmit } = useSocket();
    const { user } = useContext(AuthContext);

    const [call, setCall] = useState(null); // { isIncoming, callerId, roomId, type: 'audio'|'video' }
    const [activeCall, setActiveCall] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    const peerConnection = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const servers = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" } // Free backup
        ],
    };

    /**
     * 📞 Initiate Call
     */
    const startCall = async (recipientId, type = "video") => {
        setActiveCall(true);
        setCall({ isIncoming: false, recipientId, type });

        // Get Stream
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video',
                audio: true
            });
            setLocalStream(stream);

            // Signal call
            safeEmit("call:invite", {
                recipient_id: recipientId,
                call_type: type
            });

        } catch (e) {
            console.error("Failed to get media", e);
            endCall();
            alert("Could not access camera/microphone");
        }
    };

    /**
     * 📞 Accept Call
     */
    const answerCall = async () => {
        setActiveCall(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: call.type === 'video',
                audio: true
            });
            setLocalStream(stream);

            // Create Peer Connection
            createPeerConnection(stream);

            // Signal Answer
            safeEmit("call:answer", {
                caller_id: call.callerId,
                accepted: true
            });

        } catch (e) {
            console.error("Failed to answer", e);
            endCall();
        }
    };

    /**
     * 🛑 End Call
     */
    const endCall = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        if (activeCall && call) {
            const target = call.isIncoming ? call.callerId : call.recipientId;
            safeEmit("call:end", { target_id: target });
        }

        setLocalStream(null);
        setRemoteStream(null);
        setActiveCall(false);
        setCall(null);
    };

    /**
     * 🛠 Create Peer Connection & Bind Events
     */
    const createPeerConnection = (stream) => {
        const pc = new RTCPeerConnection(servers);

        // Add local tracks
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // Handle remote tracks
        pc.ontrack = (event) => {
            console.log("Remote Stream Received");
            setRemoteStream(event.streams[0]);
        };

        // Handle ICE Candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const target = call.isIncoming ? call.callerId : call.recipientId;
                safeEmit("call:ice-candidate", {
                    target_id: target,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.current = pc;
    };

    // Socket Listeners
    useEffect(() => {
        if (!socket) return;

        socket.on("call:incoming", ({ caller_id, call_type }) => {
            setCall({
                isIncoming: true,
                callerId: caller_id,
                type: call_type
            });
        });

        socket.on("call:answered", async ({ accepted }) => {
            if (accepted) {
                // Initializer creates offer
                const pc = new RTCPeerConnection(servers);
                peerConnection.current = pc;

                localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

                pc.onicecandidate = (e) => {
                    if (e.candidate) safeEmit("call:ice-candidate", { target_id: call.recipientId, candidate: e.candidate });
                };
                pc.ontrack = (e) => setRemoteStream(e.streams[0]);

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                safeEmit("call:offer", {
                    target_id: call.recipientId,
                    sdp: offer
                });
            } else {
                endCall();
                alert("Call declined");
            }
        });

        socket.on("call:offer", async ({ sdp }) => {
            if (!peerConnection.current) return;
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));

            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);

            safeEmit("call:answer-sdp", {
                target_id: call.callerId,
                sdp: answer
            });
        });

        socket.on("call:answer-sdp", async ({ sdp }) => {
            if (!peerConnection.current) return;
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
        });

        socket.on("call:ice-candidate", async ({ candidate }) => {
            if (!peerConnection.current) return;
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on("call:ended", () => {
            endCall();
        });

        return () => {
            socket.off("call:incoming");
            socket.off("call:answered");
            socket.off("call:offer");
            socket.off("call:answer-sdp");
            socket.off("call:ice-candidate");
            socket.off("call:ended");
        };
    }, [socket, call, localStream]);

    return (
        <WebRTCContext.Provider value={{
            call, activeCall, localStream, remoteStream, startCall, answerCall, endCall
        }}>
            {children}
        </WebRTCContext.Provider>
    );
};

export { WebRTCContext };
