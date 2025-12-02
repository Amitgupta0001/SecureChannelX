// FILE: src/socket/e2eHandlers.js
// Centralized E2E Encryption socket handlers
// Matches backend: advanced_encryption.py, hardening.py, security_routes.py

export default function registerE2EHandlers(socket, callbacks = {}) {
  if (!socket) {
    console.warn("⚠ registerE2EHandlers: socket is null");
    return;
  }

  const {
    onSessionKey,
    onSessionKeyRotated,
    onPublicKey,
    onEncryptedMessage,
    onHandshake,
    onDeviceTrust,
  } = callbacks;

  const safeCall = (fn, data, eventName) => {
    try {
      fn?.(data);
    } catch (err) {
      console.error(`❌ Error in ${eventName} handler:`, err);
    }
  };

  /* ---------------------------------------------------------
      🔑 INITIAL SESSION KEY
  --------------------------------------------------------- */
  socket.on("e2e:session_key", (data) => {
    console.log("🔐 Received session key", data);
    safeCall(onSessionKey, data?.key, "e2e:session_key");
  });

  /* ---------------------------------------------------------
      ♻️ SESSION KEY ROTATION
  --------------------------------------------------------- */
  socket.on("e2e:session_key_rotated", (data) => {
    console.log("♻️ Session key rotated", data);
    safeCall(onSessionKeyRotated, data?.new_key, "e2e:session_key_rotated");
  });

  /* ---------------------------------------------------------
      🔒 PUBLIC KEY EXCHANGE
  --------------------------------------------------------- */
  socket.on("e2e:pubkey", (data) => {
    console.log("📡 Received public key", data);
    safeCall(onPublicKey, data, "e2e:pubkey");
  });

  /* ---------------------------------------------------------
      📨 ENCRYPTED MESSAGE
  --------------------------------------------------------- */
  socket.on("e2e:encrypted_message", (data) => {
    console.log("🔒 Encrypted message received", data);
    safeCall(onEncryptedMessage, data, "e2e:encrypted_message");
  });

  /* ---------------------------------------------------------
      🤝 HANDSHAKE
  --------------------------------------------------------- */
  socket.on("e2e:handshake", (data) => {
    console.log("🤝 E2E handshake", data);
    safeCall(onHandshake, data, "e2e:handshake");
  });

  /* ---------------------------------------------------------
      📱 DEVICE TRUST UPDATE
  --------------------------------------------------------- */
  socket.on("e2e:device_trust", (data) => {
    console.log("📱 Device trust update", data);
    safeCall(onDeviceTrust, data, "e2e:device_trust");
  });
}

/* -------------------------------------------------------------
   🔥 CLIENT → SERVER EMITTERS
------------------------------------------------------------- */
export const E2EEmit = {
  sendPublicKey(socket, { user_id, public_key }) {
    if (!socket?.connected || !user_id || !public_key) return;
    socket.emit("e2e:pubkey", { user_id, public_key });
  },

  sendEncrypted(socket, { chat_id, to, ciphertext }) {
    if (!socket?.connected || !chat_id || !to || !ciphertext) return;
    socket.emit("e2e:encrypted_message", { chat_id, to, ciphertext });
  },

  sendHandshake(socket, payload) {
    if (!socket?.connected || !payload) return;
    socket.emit("e2e:handshake", payload);
  },
};
