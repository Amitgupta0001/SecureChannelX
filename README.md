# SecureChannelX

<div align="center">

![SecureChannelX Logo](https://via.placeholder.com/150?text=SCX)

**Military-Grade End-to-End Encrypted Messaging Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-Operational-brightgreen.svg)]()
[![Security](https://img.shields.io/badge/Security-Post--Quantum-blueviolet.svg)]()

</div>

---

## 📖 Overview

**SecureChannelX** is a state-of-the-art secure messaging application designed for absolute privacy and resilience. Built with a **Zero-Knowledge Architecture**, it ensures that the server acts only as a blind relay—it cannot read messages, view files, or access user keys.

The platform implements the **Signal Protocol** (X3DH + Double Ratchet) for forward-secret messaging and integrates **Post-Quantum Cryptography (Kyber-1024)** to protect against future quantum computing threats.

### 🌟 Key Features

*   **🔐 End-to-End Encryption**: All messages and files are encrypted on the device before transmission using AES-256-GCM and Curve25519.
*   **🛡️ Post-Quantum Security**: Key exchange protected by Kyber-1024, ensuring long-term data confidentiality.
*   **📱 Multi-Device Support**: Seamlessly sync messages across multiple devices with independent encryption sessions.
*   **👥 Secure Groups**: E2EE group chats using the Sender Keys protocol for efficiency and scalability.
*   **📞 Voice & Video Calls**: Peer-to-peer WebRTC calls with authenticated signaling.
*   **📂 Encrypted File Sharing**: Securely share images, videos, and documents with client-side encryption.
*   **👻 Zero-Knowledge Server**: The backend stores only encrypted blobs. We cannot see your data even if we wanted to.

---

## 🏗️ Technology Stack

### Frontend
*   **Framework**: React (Vite)
*   **Styling**: Tailwind CSS + Framer Motion
*   **State Management**: Context API
*   **Cryptography**: `libsignal`, `crystals-kyber` (WASM), `subtle-crypto`

### Backend
*   **Server**: Flask (Python)
*   **Real-time**: Flask-SocketIO
*   **Database**: MongoDB (Data), Redis (Rate Limiting & Pub/Sub)
*   **Auth**: JWT (JSON Web Tokens)

---

## 🚀 Getting Started

Follow these instructions to set up the project locally for development.

### Prerequisites
*   **Node.js** (v16+)
*   **Python** (v3.8+)
*   **MongoDB** (Running locally on port 27017)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python run.py
```
*Server runs on `http://localhost:5050`*

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
*App runs on `http://localhost:5173`*

---

## 🔒 Security Architecture

### Encryption Pipeline
1.  **Registration**: User generates Identity Key, Signed PreKey, and Kyber PreKey locally. Public keys are uploaded to the server.
2.  **Session Init (X3DH)**: Sender fetches recipient's bundle, verifies signature, and derives a shared secret using ECDH + Kyber encapsulation.
3.  **Messaging (Double Ratchet)**: Each message uses a unique ephemeral key. Compromising one key does not compromise past or future messages.

### Multi-Device Sync
*   Each device has its own Identity Key.
*   Messages are encrypted individually for every device in a conversation (Sender's other devices + Recipient's devices).
*   Device revocation immediately wipes keys from the server.

---

## 📦 Deployment

### Environment Variables
Configure these in your production environment (e.g., Render, AWS, Heroku):

| Variable | Description |
| :--- | :--- |
| `MONGODB_URI` | MongoDB Connection String |
| `SECRET_KEY` | Flask Session Secret (32+ chars) |
| `JWT_SECRET_KEY` | JWT Signing Key (32+ chars) |
| `FRONTEND_URL` | URL of the deployed frontend |
| `REDIS_URL` | Redis Connection String (Optional, for scaling) |

### Optional: STUN/TURN
For reliable calls behind NAT/Firewalls, configure Twilio or self-hosted TURN servers in `frontend/.env`.

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a Pull Request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with ❤️ by the SecureChannelX Team</sub>
</div>
