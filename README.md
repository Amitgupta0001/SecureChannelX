# SecureChannelX 🔒

> **The World's Most Secure, End-to-End Encrypted Messaging Platform.**
> Built for privacy, speed, and resilience.

![Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Security](https://img.shields.io/badge/Security-Military%20Grade-blue)
![Encryption](https://img.shields.io/badge/Encryption-AES256%20%2B%20Signal%20Protocol-violet)

**SecureChannelX** is a next-generation messaging application that combines the usability of WhatsApp with the security of Signal. It features a Zero-Knowledge architecture where the server acts purely as a relay—your messages, files, and keys are encrypted on your device before they ever touch the network.

---

## ✨ System Highlights

| Feature | Description |
| :--- | :--- |
| **🛡️ Zero-Knowledge** | Server cannot read messages or files. Keys never leave your device. |
| **🔐 End-to-End Encryption** | Powered by **Signal Protocol (X3DH + Double Ratchet)** and **AES-256-GCM**. |
| **📞 Voice & Video Calls** | Crystal clear, P2P encrypted calls via **WebRTC**. |
| **📂 Secure File Sharing** | Share images/videos/docs up to 100MB. Encrypted locally before upload. |
| **🚀 High Performance** | **Socket.IO** for real-time delivery + **Redis** scaling + Virtualized scrolling. |
| **📱 PWA Ready** | Installable on Mobile/Desktop with offline support. |

---

## 🛠️ Technology Stack

### Frontend
*   **Framework:** React 18 + Vite
*   **Styling:** Tailwind CSS + Framer Motion
*   **State:** Context API + React Hooks
*   **Cryptography:** `libsignal-protocol`, `Web Crypto API`
*   **Real-time:** `socket.io-client`

### Backend
*   **Core:** Python 3.9+ (Flask)
*   **Database:** MongoDB (NoSQL for flexible schema)
*   **Real-time:** Flask-SocketIO + Redis (Pub/Sub)
*   **Security:** `cryptography`, `argon2`, `pyjwt`

---

## 🚀 Quick Start

### Prerequisites
*   **Node.js** (v18+)
*   **Python** (v3.9+)
*   **MongoDB** (Running locally or remote)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python run.py
```
*Server starts on `http://localhost:5050`*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*App starts on `http://localhost:5173`*

---

## 🧪 Testing
We use **Playwright** for End-to-End (E2E) testing of critical encryption flows.

```bash
cd frontend
npx playwright test
```

---

## 📜 License
MIT License. Open Source software.

---
*Built with ❤️ by the SecureChannelX Team*
