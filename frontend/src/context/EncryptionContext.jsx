// FILE: src/context/EncryptionContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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
  const [myGroupKeys, setMyGroupKeys] = useState({});
  const [ready, setReady] = useState(false);

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

    (async () => {
      let idKey = await loadKey(user.id, "identity");

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
              one_time_pre_keys: bundle.oneTimePreKeys.map((k) =>
                toBase64(k.pub)
              ),
            };
            await keyApi.uploadBundle(publicBundle, token);
          } catch (uploadErr) {
            console.error("Failed to upload keys to server:", uploadErr);
          }
        } catch (err) {
          console.error("❌ Failed to generate PreKeys", err);
          setReady(false);
          return;
        }
      }

      setIdentity(idKey);
      setReady(true);
    })();
  }, [user, token]);

  /* -------------------------------------------------------
      IMPORTANT FIX:
      ❌ Removed the second useEffect that called initIdentity()
      because initIdentity() DOES NOT EXIST and created a crash.
  -------------------------------------------------------- */

  /* -------------------------------------------------------
      INITIALIZE CHAT SESSION (X3DH)
  -------------------------------------------------------- */
  const initChatSession = async (chatId, peerId) => {
    if (!identity) return;
    if (ratchets[chatId]) return;

    try {
      console.log("Initializing X3DH session for chat", chatId);

      const peerBundleData = await keyApi.getBundle(peerId, token);

      const peerBundle = {
        identityKey: fromBase64(peerBundleData.identity_key),
        signedPreKey: fromBase64(peerBundleData.signed_pre_key),
        kyberPreKey: fromBase64(peerBundleData.kyber_pre_key)
      };

      const res = await x3dhSender(identity, peerBundle);

      const dr = await DoubleRatchet.initSender(
        res.sharedSecret,
        peerBundle.signedPreKey
      );

      dr.x3dhHeader = res.header;

      setRatchets(prev => ({ ...prev, [chatId]: dr }));

    } catch (e) {
      console.error("X3DH Failed:", e);
      throw e;
    }
  };

  /* -------------------------------------------------------
      DECRYPT MESSAGE
  -------------------------------------------------------- */
  const decrypt = async (chatId, messageData) => {
    let dr = ratchets[chatId];

    if (!dr) {
      const sessionState = await loadSession(user.id, chatId);
      if (sessionState) {
        dr = new DoubleRatchet();
        dr.state = sessionState;
        setRatchets(prev => ({ ...prev, [chatId]: dr }));
      }
    }

    if (!dr && messageData.x3dh_header) {
      console.log("New session request received via X3DH");

      const myId = await loadKey(user.id, "identity");
      const mySpk = await loadKey(user.id, "signedPreKey");
      const myPq = await loadKey(user.id, "kyberPreKey");

      const sharedSecret = await x3dhReceiver(
        myId,
        mySpk,
        myPq,
        messageData.x3dh_header
      );

      dr = await DoubleRatchet.initReceiver(sharedSecret, null);
      setRatchets(prev => ({ ...prev, [chatId]: dr }));
    }

    if (!dr) throw new Error("No session established and no X3DH header found");

    const plaintext = await dr.decrypt(
      messageData.header,
      messageData.ciphertext,
      messageData.nonce
    );

    await saveSession(user.id, chatId, dr.state);
    return plaintext;
  };

  /* -------------------------------------------------------
      DECRYPT PREVIEW (does not mutate ratchet)
  -------------------------------------------------------- */
  const decryptPreview = async (chatId, messageData) => {
    let dr = ratchets[chatId];

    if (!dr) {
      const sessionState = await loadSession(user.id, chatId);
      if (sessionState) {
        dr = new DoubleRatchet();
        dr.state = sessionState;
      }
    }

    if (!dr) return "Encrypted Message";

    const cloneDr = new DoubleRatchet();
    cloneDr.state = JSON.parse(JSON.stringify(dr.state));

    try {
      return await cloneDr.decrypt(
        messageData.header,
        messageData.ciphertext,
        messageData.nonce
      );
    } catch {
      return "Encrypted Message";
    }
  };

  /* -------------------------------------------------------
      ENCRYPT MESSAGE
  -------------------------------------------------------- */
  const encrypt = async (chatId, text) => {
    let dr = ratchets[chatId];

    if (!dr) {
      const sessionState = await loadSession(user.id, chatId);
      if (sessionState) {
        dr = new DoubleRatchet();
        dr.state = sessionState;
        setRatchets(prev => ({ ...prev, [chatId]: dr }));
      }
    }

    if (!dr) throw new Error("Chat session not initialized");

    const res = await dr.encrypt(text);

    await saveSession(user.id, chatId, dr.state);

    if (dr.x3dhHeader) {
      res.x3dh_header = dr.x3dhHeader;
      delete dr.x3dhHeader;
    }

    return res;
  };

  /* -------------------------------------------------------
      GROUP ENCRYPTION HELPERS
  -------------------------------------------------------- */

  const getGroupSession = async (groupId, senderId) => {
    if (groupSessions[groupId] && groupSessions[groupId][senderId]) {
      return groupSessions[groupId][senderId];
    }
    return null;
  };

  const distributeGroupKey = async (groupId, participants) => {
    let myKey = myGroupKeys[groupId];
    if (!myKey) {
      myKey = SenderKeyRatchet.generate();
      setMyGroupKeys(prev => ({ ...prev, [groupId]: myKey }));
      throw new Error("GROUP_KEY_MISSING");
    }

    const keyData = myKey.serialize();

    const distributions = [];

    for (const pId of participants) {
      if (pId === user.id) continue;

      await initChatSession(pId, pId);

      try {
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
    let myKey = myGroupKeys[groupId];
    if (!myKey) {
      myKey = SenderKeyRatchet.generate();
      setMyGroupKeys(prev => ({ ...prev, [groupId]: myKey }));
      throw new Error("GROUP_KEY_MISSING");
    }

    return await myKey.encrypt(text);
  };

  const decryptGroup = async (groupId, senderId, data) => {
    const session = await getGroupSession(groupId, senderId);
    if (!session) throw new Error("No Sender Key for " + senderId);

    return await session.decrypt(data.ciphertext, data.nonce, data.step);
  };

  const handleDistributionMessage = async (msg) => {
    if (msg.type === "sender_key_distribution") {
      const session = SenderKeyRatchet.deserialize(msg.key);
      setGroupSessions(prev => ({
        ...prev,
        [msg.groupId]: {
          ...(prev[msg.groupId] || {}),
          [msg.senderId]: session
        }
      }));
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
        handleDistributionMessage
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
};

export default EncryptionContext;
