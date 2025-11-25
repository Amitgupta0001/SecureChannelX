# SecureChannelX

**SecureChannelX** is a next-generation, military-grade encrypted messaging application designed for absolute privacy and security. It features **End-to-End Encryption (E2EE)** using the Signal Protocol (Double Ratchet, X3DH) and incorporates **Post-Quantum Cryptography (Kyber)** to protect against future quantum computing threats.

![SecureChannelX Banner](https://via.placeholder.com/1200x400?text=SecureChannelX+Encrypted+Messaging)

## 🚀 Key Features

*   **🔒 End-to-End Encryption**: Messages are encrypted on the device and can only be read by the intended recipient. The server has zero knowledge of the message content.
*   **🛡️ Post-Quantum Security**: Utilizes **CRYSTALS-Kyber** (NIST-standardized) for key encapsulation, ensuring your data remains secure even against quantum computers.
*   **🔑 Double Ratchet Algorithm**: Provides **Forward Secrecy** (old messages remain secure if a key is compromised) and **Post-Compromise Security** (future messages are secure after a compromise).
*   **👥 Group Chats**: Secure, encrypted group messaging with efficient sender key distribution.
*   **⚡ Real-Time Communication**: Instant messaging powered by **Socket.IO**.
*   **📂 File Sharing**: Securely share images and documents (Encrypted).
*   **🎨 Modern UI**: A sleek, responsive interface built with **React** and **Tailwind CSS**, inspired by leading chat apps.

## 🛠️ Tech Stack

### Frontend
*   **React** (Vite)
*   **Tailwind CSS** (Styling)
*   **Socket.IO Client** (Real-time)
*   **Framer Motion** (Animations)
*   **Crypto Libraries**: `@noble/curves`, `crystals-kyber-js`

### Backend
*   **Python** (Flask)
*   **MongoDB** (Database)
*   **Flask-SocketIO** (WebSockets)
*   **Flask-JWT-Extended** (Authentication)
*   **PyCryptodome** (Crypto primitives)

## 📦 Installation & Setup

### Prerequisites
*   Node.js (v16+)
*   Python (v3.8+)
*   MongoDB (Local or Atlas)

### 1. Clone the Repository
```bash
git clone https://github.com/Amitgupta0001/SecureChannelX.git
cd SecureChannelX
```

### 2. Backend Setup
```bash
cd backend
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python run.py
```
The backend will start at `http://localhost:5050`.

### 3. Frontend Setup
```bash
cd frontend
# Install dependencies
npm install

# Run the development server
npm run dev
```
The frontend will start at `http://localhost:5173`.

## 🔐 Security Architecture

1.  **Registration**: User generates Identity Keys (Ed25519) and Kyber Key Pairs locally. Public keys are uploaded to the server.
2.  **Session Init (X3DH)**: When Alice wants to message Bob, she fetches Bob's "PreKey Bundle" from the server and performs an Extended Triple Diffie-Hellman handshake to derive a shared secret.
3.  **Messaging (Double Ratchet)**: Every message sent rotates the encryption keys. This ensures that even if a key is stolen, it cannot be used to decrypt past or future messages.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

---
**Developed by [Amitgupta0001](https://github.com/Amitgupta0001)**
