# 🌟 SecureChannelX Features

## 🔒 Core Security (The "Shield")

The crown jewel of SecureChannelX is its uncompromised security model.

### 1. Direct Message Encryption
*   **Protocol:** Signal Protocol implementation (X3DH Key Agreement + Double Ratchet).
*   **Mechanism:**
    *   **Forward Secrecy:** New keys for every message. If a key is stolen, past messages remain secure.
    *   **Break-in Recovery:** The ratchet "heals" itself if a key is compromised.

### 2. Group Chat Encryption
*   **Protocol:** Sender Key Protocol (Group variant).
*   **Mechanism:**
    *   Each member generates a random 32-byte "Sender Key".
    *   This key is encrypted individually for every other member (pairwise) and distributed via the server.
    *   Messages are encrypted with `AES-256-GCM` using the Sender Key.
    *   Server sees only blobs of ciphertext.

### 3. File Encryption (True E2EE)
*   **Mechanism:**
    1.  User selects a file (e.g., `image.png`).
    2.  Browser generates a random **32-byte AES Key** + **12-byte IV**.
    3.  File is encrypted **in-browser** via Web Crypto API.
    4.  Encrypted blob is uploaded to cloud storage.
    5.  The **Key + IV** are sent *inside* the E2EE message payload to the recipient.
    6.  **Result:** The cloud provider hosts data they cannot read.

### 4. Infrastructure Protection
*   **Honeypots:** Decoy routes (`/admin/phpmyadmin`) ban attackers instantly.
*   **Rate Limiting:** Global limits on API endpoints (`50/minute`) and stricter limits on Auth (`5/minute`).
*   **Blind Indexing:** Profile tokens are hashed so user discovery doesn't leak phone numbers/emails.

---

## 💬 Messaging Experience

### Rich Communication
*   **Text:** Instant delivery with typing indicators.
*   **Replies:** Contextual replies to keep conversations organized.
*   **Reactions:** React with emojis (👍, ❤️, 😂, etc.) to any message.
*   **Media:** High-fidelity image/video sharing with secure hydration.

### Voice & Video (WebRTC)
*   **Peer-to-Peer:** Direct connection between clients.
*   **DTLS-SRTP:** Streams are encrypted and authenticated.
*   **UI:** Modern overlay with "picture-in-picture" local video.

---

## ⚙️ Power Features

### For Performance
*   **Virtual Scrolling:** Render only what is visible. Scroll through 10,000 messages smoothly.
*   **Optimistic Updates:** UI updates instantly; background sync handles the network.

### For Devices
*   **Multi-Device:** Sync messages across browsers.
*   **Session Management:** View IP, OS, and Browser of active sessions. Remote wipe (logout).

---

## 🔮 Roadmap (Future)

*   [ ] **Mobile App:** React Native wrapper for iOS/Android.
*   [ ] **VAPID Push:** Server-side push notifications for closed apps.
*   [ ] **Search:** Client-side full-text search (Lunr implementation).
