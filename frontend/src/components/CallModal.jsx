import React, { useContext, useEffect, useRef } from 'react';
import { WebRTCContext } from '../context/WebRTCContext';
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CallModal = () => {
    const { call, activeCall, localStream, remoteStream, answerCall, endCall } = useContext(WebRTCContext);

    const localVideoRef = useRef();
    const remoteVideoRef = useRef();

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    if (!call) return null;

    // Incoming Call Screen
    if (call.isIncoming && !activeCall) {
        return (
            <AnimatePresence>
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-[#1f2c33] p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 border border-gray-700"
                    >
                        <div className="w-24 h-24 rounded-full bg-gray-700 overflow-hidden animate-pulse border-4 border-[#00a884]">
                            <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${call.callerId}`} alt="" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl text-white font-bold">Incoming {call.type} call...</h2>
                            <p className="text-gray-400 text-sm">Caller ID: {call.callerId.slice(0, 8)}...</p>
                        </div>

                        <div className="flex gap-8">
                            <button
                                onClick={endCall}
                                className="p-4 bg-red-500 rounded-full hover:bg-red-600 transition shadow-lg"
                            >
                                <PhoneOff className="w-8 h-8 text-white" />
                            </button>
                            <button
                                onClick={answerCall}
                                className="p-4 bg-green-500 rounded-full hover:bg-green-600 transition shadow-lg animate-bounce"
                            >
                                <Phone className="w-8 h-8 text-white" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        );
    }

    // Active Call Screen
    if (activeCall) {
        return (
            <div className="fixed inset-0 z-50 bg-[#0b141a] flex flex-col">
                <div className="relative flex-1 bg-black flex items-center justify-center">
                    {/* Remote Video */}
                    {remoteStream ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="text-gray-500 animate-pulse">Connecting...</div>
                    )}

                    {/* Local Video (PIP) */}
                    <div className="absolute top-4 right-4 w-32 h-48 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>

                {/* Controls */}
                <div className="h-24 bg-[#1f2c33] flex items-center justify-center gap-6">
                    <button className="p-4 bg-gray-700 rounded-full hover:bg-gray-600 text-white">
                        <MicOff className="w-6 h-6" />
                    </button>
                    <button
                        onClick={endCall}
                        className="p-4 bg-red-600 rounded-full hover:bg-red-700 text-white shadow-lg"
                    >
                        <PhoneOff className="w-8 h-8" />
                    </button>
                    <button className="p-4 bg-gray-700 rounded-full hover:bg-gray-600 text-white">
                        <VideoOff className="w-6 h-6" />
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default CallModal;
