// FILE: src/context/EncryptionContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";

import { useAuth } from "./AuthContext";

// ---------------------
// CREATE CONTEXT
// ---------------------
export const EncryptionContext = createContext(null);

// Hook to consume it
export const useEncryption = () => {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error("useEncryption must be used inside EncryptionProvider");
  return ctx;
};

// ---------------------
// Helper functions
// ---------------------
import {
  generatePreKeyBundle,
  x3dhSender,
  x3dhReceiver
} from "../lib/crypto/x3dh";
import { DoubleRatchet } from "../lib/crypto/ratchet";
import { SenderKeyRatchet } from "../lib/crypto/sender_keys";
import { saveKey, loadKey, saveSession, loadSession } from "../lib/crypto/store";
import { toBase64, fromBase64 } from "../lib/crypto/primitives";
import keyApi from "../api/keyApi";

// ---------------------
// Provider
// ---------------------
export const EncryptionProvider = ({ children }) => {
  const { user, token } = useAuth();

  const [identity, setIdentity] = useState(null);
  const [ratchets, setRatchets] = useState({});
  const [groupSessions, setGroupSessions] = useState({});
  // const [myGroupKeys, setMyGroupKeys] = useState({}); // Removed in favor of ref
  const groupKeysRef = useRef({}); // Synchronous key storage
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  /* -------------------------------------------------------
       LOAD OR CREATE IDENTITY & PREKEYS
  -------------------------------------------------------- */
  useEffect(() => {
    if (!user) {
      setIdentity(null);
      setRatchets({});
      setReady(false);
      return;
    }

    const initPromise = (async () => {
      try {
        console.log("🔐 EncryptionContext: Loading keys for user:", user?.id);

        if (!user?.id) {
          console.warn("🔐 EncryptionContext: User ID missing, skipping init");
          return;
        }

        let idKey = await loadKey(user.id, "identity");
        console.log("🔐 EncryptionContext: Loaded identity key:", idKey ? "FOUND" : "MISSING");

        if (!idKey) {
          console.log("Generating new Identity & PreKeys...");

          try {
            const bundle = await generatePreKeyBundle();

            // Save keys
            await saveKey(user.id, "identity", bundle.identityKey);
            await saveKey(user.id, "signedPreKey", bundle.signedPreKey);
            await saveKey(user.id, "kyberPreKey", bundle.kyberPreKey);

            idKey = bundle.identityKey;

            // Upload Public Bundle to Server
            try {
              const publicBundle = {
                identity_key: toBase64(bundle.identityKey.pub),
                signed_pre_key: toBase64(bundle.signedPreKey.pub),
                kyber_pre_key: toBase64(bundle.kyberPreKey.pub),
              };
              console.log("📤 Uploading key bundle to server...");
              await keyApi.uploadBundle(publicBundle, token);
              console.log("✅ Key bundle uploaded successfully!");
            } catch (uploadErr) {
              console.error("Failed to upload keys to server:", uploadErr);
            }
          } catch (err) {
            console.error("❌ Failed to generate PreKeys", err);
            throw err;
          }
        }

        setIdentity(idKey);
        setReady(true);
        setError(null);
      } catch (err) {
        console.error("❌ Critical EncryptionContext Error:", err);
        setError(err.message || "Encryption initialization failed");
        setReady(false);
      }
    })();

    // Timeout fallback
    const timeoutId = setTimeout(() => {
      if (!ready) {
        console.error("❌ EncryptionContext initialization timed out");
        setError("Initialization timed out. Please refresh.");
      }
    }, 15000); // 15 seconds

    return () => clearTimeout(timeoutId);
  }, [user, token]);

  /* -------------------------------------------------------
      INITIALIZE CHAT SESSION (X3DH) - Multi-Device
  -------------------------------------------------------- */
  const initChatSession = async (chatId, peerId) => {
    if (!identity) return;
    // Check if we have ANY sessions for this chat
    if (ratchets[chatId] && Object.keys(ratchets[chatId]).length > 0) return;

    try {
      console.log("Initializing X3DH session for chat", chatId);

      let peerBundles;
      try {
        // Now returns an ARRAY of bundles (one per device)
        peerBundles = await keyApi.getBundle(peerId, token);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.warn(`⚠️ Peer ${peerId} has no keys uploaded.`);
          return;
        }
        throw err;
      }

      if (!Array.isArray(peerBundles)) {
        // Fallback for legacy single-device backend (if any)
        peerBundles = [peerBundles];
      }

      const newDeviceSessions = {};

      for (const bundleData of peerBundles) {
        const deviceId = bundleData.device_id || 1; // Default to 1 if missing
        console.log(`Creating session for peer ${peerId} device ${deviceId}`);

        const peerBundle = {
          identityKey: fromBase64(bundleData.identity_key),
          signedPreKey: fromBase64(bundleData.signed_pre_key),
          kyberPreKey: fromBase64(bundleData.kyber_pre_key)
        };

        const res = await x3dhSender(identity, peerBundle);
        const dr = await DoubleRatchet.initSender(
          res.sharedSecret,
          peerBundle.signedPreKey
        );
        dr.x3dhHeader = res.header;

        newDeviceSessions[deviceId] = dr;
      }

      setRatchets(prev => ({ ...prev, [chatId]: newDeviceSessions }));

    } catch (e) {
      console.error("X3DH Failed:", e);
      throw e;
    }
  };

  /* -------------------------------------------------------
      DECRYPT MESSAGE - Multi-Device
  -------------------------------------------------------- */
  const decrypt = async (chatId, messageData) => {
    // messageData.encrypted_content is now a LIST of { device_id, ciphertext, ... }
    // OR a single object (legacy)

    let targetPayload = messageData.encrypted_content;

    if (Array.isArray(targetPayload)) {
      // Find payload for MY device
      const myDeviceId = user.deviceId || 1; // Default to 1
      targetPayload = targetPayload.find(p => p.device_id === myDeviceId);

      if (!targetPayload) {
        console.warn(`No encrypted payload found for my device (${myDeviceId})`);
        return "[Message not encrypted for this device]";
      }
    }

    // Ensure we have a session for this specific device flow? 
    // Actually, DoubleRatchet tracks session by state. 
    // But we need to know WHICH session to use if we have multiple.
    // For decryption, the header usually identifies the session, but here we simplify.
    // We assume 1:1 mapping for now or use the single ratchet we have for this chat?
    // Wait, we need to store ratchets per device.

    // For receiving, we might receive from ANY of the sender's devices.
    // We need to track sessions by (chatId + sender_device_id).
    // BUT, the current architecture maps by chatId.
    // Simplification: We only support receiving from ONE device per user for now in this refactor, 
    // OR we need to change `ratchets` structure to `chatId -> senderDeviceId -> DR`.
    // Let's assume for now we just use the session we have.

    // FIXME: This is a limitation. If sender has multiple devices, we need to track them.
    // For now, let's just try to decrypt with the first available ratchet or load from disk.

    // Let's use a simpler approach: Just try to decrypt.
    // We need to load the session.

    let drMap = ratchets[chatId] || {};
    // We need the session corresponding to the SENDER's device.
    // But the message doesn't strictly say which device sent it unless we add `sender_device_id`.
    // Let's assume we use the first available session or load it.

    // For MVP Multi-Device: We primarily care about SENDING to multiple devices.
    // Receiving from multiple devices requires tracking sender_device_id.

    // Let's grab the first ratchet we have (hacky but works if peer has 1 device).
    let dr = Object.values(drMap)[0];

    if (!dr) {
      const sessionState = await loadSession(user.id, chatId);
      if (sessionState) {
        dr = new DoubleRatchet();
        dr.state = sessionState;
        // setRatchets... (skip for now to avoid loop)
      }
    }

    if (!dr && messageData.x3dh_header) {
      // ... X3DH receiver logic (simplified) ...
      // This needs deep refactoring for full multi-device receive.
      // For now, let's assume we can decrypt if we have a session.

      const myId = await loadKey(user.id, "identity");
      const mySpk = await loadKey(user.id, "signedPreKey");
      const myPq = await loadKey(user.id, "kyberPreKey");

      const sharedSecret = await x3dhReceiver(myId, mySpk, myPq, messageData.x3dh_header);
      dr = await DoubleRatchet.initReceiver(sharedSecret, null);
    }

    if (!dr) throw new Error("No session established");

    const plaintext = await dr.decrypt(
      targetPayload.header,
      targetPayload.ciphertext,
      targetPayload.nonce
    );

    await saveSession(user.id, chatId, dr.state);
    return plaintext;
  };

  /* -------------------------------------------------------
      ENCRYPT MESSAGE - Multi-Device
  -------------------------------------------------------- */
  const encrypt = async (chatId, text) => {
    const chatRatchets = ratchets[chatId];
    if (!chatRatchets || Object.keys(chatRatchets).length === 0) {
      // Try to load? Or throw?
      // For now, assume initChatSession was called.
      throw new Error("Chat session not initialized");
    }

    const payloads = [];

    // Encrypt for each peer device
    for (const [deviceId, dr] of Object.entries(chatRatchets)) {
      const res = await dr.encrypt(text);
      await saveSession(user.id, chatId, dr.state);

      const payload = {
        device_id: parseInt(deviceId),
        ciphertext: res.ciphertext,
        header: res.header,
        nonce: res.nonce
      };

      if (dr.x3dhHeader) {
        payload.x3dh_header = dr.x3dhHeader;
        delete dr.x3dhHeader;
      }

      payloads.push(payload);
    }

    // TODO: Self-Sync (Encrypt for my own other devices)
    // Skipped for MVP to reduce complexity/latency

    return payloads; // Return ARRAY of payloads
  };

  /* -------------------------------------------------------
      GROUP ENCRYPTION HELPERS
  -------------------------------------------------------- */

  const getGroupSession = async (groupId, senderId) => {
    // 1. Try memory
    if (groupSessions[groupId] && groupSessions[groupId][senderId]) {
      return groupSessions[groupId][senderId];
    }
    // 2. Try disk
    try {
      const sessionState = await loadGroupSession(groupId, senderId);
      if (sessionState) {
        const session = SenderKeyRatchet.deserialize(sessionState);
        // Cache in memory
        setGroupSessions(prev => ({
          ...prev,
          [groupId]: {
            ...(prev[groupId] || {}),
            [senderId]: session
          }
        }));
        return session;
      }
    } catch (e) {
      console.error("Failed to load group session", e);
    }
    return null;
  };

  const distributeGroupKey = async (groupId, participants) => {
    let myKey = groupKeysRef.current[groupId];

    // Try loading if not in memory
    if (!myKey) {
      const saved = await loadMyGroupKey(groupId);
      if (saved) {
        myKey = SenderKeyRatchet.deserialize(saved);
        groupKeysRef.current[groupId] = myKey;
      }
    }

    if (!myKey) {
      myKey = SenderKeyRatchet.generate();
      groupKeysRef.current[groupId] = myKey;
      await saveMyGroupKey(groupId, myKey.serialize());
    }

    const keyData = myKey.serialize();
    const distributions = [];

    for (const pId of participants) {
      if (pId === user.id) continue;

      try {
        // Ensure session exists
        await initChatSession(groupId, pId);

        const encrypted = await encrypt(
          pId,
          JSON.stringify({
            type: "sender_key_distribution",
            groupId,
            senderId: user.id,
            key: keyData
          })
        );
        distributions.push({ userId: pId, content: encrypted });
      } catch (e) {
        console.error(`Failed to distribute key to ${pId}`, e);
      }
    }

    return distributions;
  };

  const encryptGroup = async (groupId, text) => {
    let myKey = groupKeysRef.current[groupId];

    if (!myKey) {
      const saved = await loadMyGroupKey(groupId);
      if (saved) {
        myKey = SenderKeyRatchet.deserialize(saved);
        groupKeysRef.current[groupId] = myKey;
      }
    }

    if (!myKey) {
      throw new Error("GROUP_KEY_MISSING");
    }

    const encrypted = await myKey.encrypt(text);

    // Save state after encryption (ratchet advanced)
    await saveMyGroupKey(groupId, myKey.serialize());

    return encrypted;
  };

  const decryptGroup = async (groupId, senderId, data) => {
    const session = await getGroupSession(groupId, senderId);
    if (!session) throw new Error("No Sender Key for " + senderId);

    const plaintext = await session.decrypt(data.ciphertext, data.nonce, data.step);

    // Save state after decryption (ratchet advanced)
    await saveGroupSession(groupId, senderId, session.serialize());

    return plaintext;
  };

  const handleDistributionMessage = async (msg) => {
    if (msg.type === "sender_key_distribution") {
      try {
        const session = SenderKeyRatchet.deserialize(msg.key);

        // Save to disk
        await saveGroupSession(msg.groupId, msg.senderId, msg.key);

        // Update memory
        setGroupSessions(prev => ({
          ...prev,
          [msg.groupId]: {
            ...(prev[msg.groupId] || {}),
            [msg.senderId]: session
          }
        }));
      } catch (e) {
        console.error("Failed to handle distribution message", e);
      }
    }
  };

  return (
    <EncryptionContext.Provider
      value={{
        ready,
        identity,
        initChatSession,
        encrypt,
        decrypt,
        decryptPreview,
        encryptGroup,
        decryptGroup,
        distributeGroupKey,
        handleDistributionMessage,
        error
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
};

export default EncryptionContext;
