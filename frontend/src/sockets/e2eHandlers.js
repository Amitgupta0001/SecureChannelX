// FILE: src/sockets/e2eHandlers.js
// Centralized E2E Encryption socket handlers
// Matches backend: advanced_encryption.py, hardening.py, security_routes.py

export default function registerE2EHandlers(
  socket,
  {
    onSessionKey,
    onSessionKeyRotated,
    onPublicKey,
    onEncryptedMessage,
    onHandshake,
    onDeviceTrust
  }
) {
  if (!socket) return;

  /* ---------------------------------------------------------
      🔑 INITIAL SESSION KEY (sent after login)
  --------------------------------------------------------- */
  socket.on("e2e:session_key", (data) => {
    console.log("🔐 Received session key", data);
    onSessionKey && onSessionKey(data.key);
  });

  /* ---------------------------------------------------------
      ♻ SESSION KEY ROTATION
  --------------------------------------------------------- */
  socket.on("e2e:session_key_rotated", (data) => {
    console.log("♻ Session key rotated", data);
    onSessionKeyRotated && onSessionKeyRotated(data.new_key);
  });

  /* ---------------------------------------------------------
      🔒 PUBLIC KEY EXCHANGE (client ↔ client through server)
  --------------------------------------------------------- */
  socket.on("e2e:pubkey", (data) => {
    console.log("📡 Received public key", data);
    onPublicKey && onPublicKey(data);
  });

  /* ---------------------------------------------------------
      📨 ENCRYPTED MESSAGE (raw cipher text)
  --------------------------------------------------------- */
  socket.on("e2e:encrypted_message", (data) => {
    console.log("🔒 Encrypted message received", data);
    onEncryptedMessage && onEncryptedMessage(data);
  });

  /* ---------------------------------------------------------
      🤝 HANDSHAKE (E2E handshake)
  --------------------------------------------------------- */
  socket.on("e2e:handshake", (data) => {
    console.log("🤝 E2E handshake", data);
    onHandshake && onHandshake(data);
  });

  /* ---------------------------------------------------------
      📱 DEVICE TRUST UPDATE (new device added, removed, trusted)
  --------------------------------------------------------- */
  socket.on("e2e:device_trust", (data) => {
    console.log("📱 Device trust update", data);
    onDeviceTrust && onDeviceTrust(data);
  });
}

/* -------------------------------------------------------------
   🔥 CLIENT → SERVER EMITTERS
   EXACT match for backend events in advanced_encryption.py
------------------------------------------------------------- */
export const E2EEmit = {
  /** Send client's public key */
  sendPublicKey(socket, { user_id, public_key }) {
    socket.emit("e2e:pubkey", { user_id, public_key });
  },

  /** Send encrypted payload through server relay */
  sendEncrypted(socket, { chat_id, to, ciphertext }) {
    socket.emit("e2e:encrypted_message", { chat_id, to, ciphertext });
  },

  /** Trigger handshake (public key + metadata exchange) */
  sendHandshake(socket, payload) {
    socket.emit("e2e:handshake", payload);
  }
};
