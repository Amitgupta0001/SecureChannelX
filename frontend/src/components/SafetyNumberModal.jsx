import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Copy } from "lucide-react";
import { generateFingerprint } from "../lib/crypto/fingerprint";
import { useEncryption } from "../context/EncryptionContext";
import { loadKey } from "../lib/crypto/store";
import { fromBase64 } from "../lib/crypto/primitives";
import keyApi from "../api/keyApi";
import { useAuth } from "../context/AuthContext";

export default function SafetyNumberModal({ isOpen, onClose, peerId, peerName }) {
    const { user, token } = useAuth();
    const { identity } = useEncryption();
    const [fingerprint, setFingerprint] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && user && peerId && identity) {
            (async () => {
                setLoading(true);
                try {
                    // Get Peer Identity Key
                    // We might have it in session, or need to fetch bundle
                    // Let's fetch bundle to be sure (or check if we have it stored?)
                    // For now, fetch bundle.
                    const peerBundle = await keyApi.getBundle(peerId, token);
                    const peerIdentityKey = fromBase64(peerBundle.identity_key);

                    // My Identity Key
                    const myIdentityKey = identity.pub; // identity is KeyPair

                    const fp = generateFingerprint(myIdentityKey, peerIdentityKey);
                    setFingerprint(fp);
                } catch (e) {
                    console.error("Failed to generate fingerprint", e);
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [isOpen, user, peerId, identity, token]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-[#30363d] bg-[#0d1117]">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                            Verify Safety Number
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-[#21262d] transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        <div className="text-center space-y-2">
                            <p className="text-gray-300">
                                To verify the security of your end-to-end encryption with <span className="font-bold text-white">{peerName}</span>, compare the numbers below with their device.
                            </p>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <div className="bg-[#0d1117] p-4 rounded-lg border border-[#30363d] text-center">
                                <div className="font-mono text-2xl text-blue-400 tracking-wider grid grid-cols-4 gap-2">
                                    {fingerprint ? fingerprint.split(' ').map((chunk, i) => (
                                        <span key={i}>{chunk}</span>
                                    )) : "Error"}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-center">
                            <button
                                onClick={() => navigator.clipboard.writeText(fingerprint)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg transition text-sm"
                            >
                                <Copy className="w-4 h-4" /> Copy to Clipboard
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
