// frontend/src/components/calls/CallControls.jsx
import React from "react";

const CallControls = ({ localStream, callType, endCall }) => {
  const toggleMute = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
  };

  const toggleVideo = () => {
    if (!localStream || callType !== "video") return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
  };

  return (
    <div className="call-controls">
      <button onClick={toggleMute} className="control-button mute">
        Mute
      </button>

      {callType === "video" && (
        <button onClick={toggleVideo} className="control-button video">
          Camera
        </button>
      )}

      <button onClick={endCall} className="control-button end-call">
        End Call
      </button>
    </div>
  );
};

export default CallControls;
