<div align="center">

<img src="frontend\public\icons" alt="SecureChannelX Logo" width="150"/>

# SecureChannelX

**A Post-Quantum, End-to-End Encrypted Messaging Platform**

</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/your-username/your-repo/ci.yml?branch=main&style=flat-square)](https://github.com/Amitgupta0001/SecureChannelX/actions)
[![Code Coverage](https://img.shields.io/codecov/c/github/your-username/your-repo?style=flat-square)](https://codecov.io/gh/Amitgupta0001/SecureChannelX)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Security](https://img.shields.io/badge/Security-Post--Quantum-blueviolet.svg?style=flat-square)]()

</div>

---

**SecureChannelX** is a state-of-the-art secure messaging application designed for absolute privacy and resilience. Built with a **Zero-Knowledge Architecture**, it ensures that the server acts only as a blind relay—it cannot read messages, view files, or access user keys.

The platform implements the **Signal Protocol** for forward-secret messaging and integrates **Post-Quantum Cryptography (CRYSTALS-Kyber)** to safeguard communications against the threat of future quantum computers.

<br>

<div align="center">
  <img src="https://via.placeholder.com/800x450.png?text=App+Screenshot+Here" alt="SecureChannelX Application Screenshot" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"/>
</div>

---

## 📋 Table of Contents

- [✨ Core Features](#-core-features)
- [🛡️ Security Architecture](#️-security-architecture)
- [🏗️ Technology Stack](#️-technology-stack)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [🧪 Running Tests](#-running-tests)
- [🚢 Deployment](#-deployment)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [📧 Contact](#-contact)

---

## ✨ Core Features

| Feature | Description | Status |
| :--- | :--- | :---: |
| **End-to-End Encryption** | All messages, files, and calls are encrypted on-device using the Signal Protocol (X3DH + Double Ratchet) with AES-256-GCM. | ✅ |
| **Post-Quantum Security** | Key exchange is augmented with **CRYSTALS-Kyber-1024**, a NIST-selected PQC algorithm, ensuring forward secrecy against quantum attacks. | ✅ |
| **Zero-Knowledge Server** | The backend stores only encrypted blobs of data. User keys, messages, and profiles are never visible to the server. | ✅ |
| **Multi-Device Support** | Seamlessly sync messages across multiple devices, with each device maintaining its own independent encryption session. | ✅ |
| **Secure Group Chats** | E2EE group conversations using the Sender Keys protocol for efficient and scalable security. | ✅ |
| **Voice & Video Calls** | Secure, peer-to-peer WebRTC calls with authenticated signaling and DTLS-SRTP encryption. | ✅ |
| **Encrypted File Sharing** | Securely share images, videos, and documents of any size with robust client-side encryption and chunking. | ✅ |
| **Two-Factor Authentication** | Protect your account with TOTP-based 2FA, adding an extra layer of security. | ✅ |

---

## 🛡️ Security Architecture

SecureChannelX is built on a foundation of modern, audited cryptographic principles.

<details>
<summary><strong>1. Key Generation & Registration (X3DH + Kyber)</strong></summary>

When a user registers, their device generates several key pairs:
- **Identity Key (IK):** A long-term Curve25519 key pair.
- **Signed Pre-Key (SPK):** A medium-term Curve25519 key pair, signed by the IK.
- **One-Time Pre-Keys (OPKs):** A batch of Curve25519 key pairs for single use.
- **Post-Quantum Pre-Key (PQ-PK):** A CRYSTALS-Kyber-1024 key pair, also signed by the IK.

The public components of these keys are uploaded to the server, forming the user's **pre-key bundle**.

</details>

<details>
<summary><strong>2. Secure Session Initialization</strong></summary>

To start a conversation, the initiator (Alice) fetches the recipient's (Bob) pre-key bundle.

1.  **ECDH Agreement:** Alice performs three Elliptic-Curve Diffie-Hellman handshakes:
    - `Alice's IK` + `Bob's SPK`
    - `Alice's EK` (ephemeral key) + `Bob's IK`
    - `Alice's EK` + `Bob's OPK`
2.  **PQC Encapsulation:** Alice generates a shared secret using Bob's public Kyber key and encapsulates it. This secret is only derivable by Bob's private Kyber key.
3.  **Master Secret Derivation:** All four secrets are fed into a Key Derivation Function (KDF) to produce the initial `SharedSecret`.

This hybrid approach ensures that even if an attacker breaks the elliptic curve cryptography, the Kyber-protected secret remains secure.

</details>

<details>
<summary><strong>3. Ongoing Communication (Double Ratchet Algorithm)</strong></summary>

Once a session is established, the Double Ratchet algorithm provides ongoing security:

- **Symmetric Key Ratchet:** Each message is encrypted with a unique message key derived from a constantly evolving chain. This provides message-level forward secrecy.
- **Diffie-Hellman Ratchet:** Periodically, the parties perform a new ECDH handshake to update the underlying root chain, providing self-healing properties. If a session key is compromised, the ratchet quickly recovers to a secure state.

</details>

---

## 🏗️ Technology Stack

<div align="center">

| Category | Technologies |
| :--- | :--- |
| **Frontend** | ![React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/-Vite-646CFF?logo=vite&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/-Tailwind-06B6D4?logo=tailwindcss&logoColor=white) ![Framer Motion](https://img.shields.io/badge/-Framer-0055FF?logo=framer&logoColor=white) |
| **Backend** | ![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white) ![Flask](https://img.shields.io/badge/-Flask-000000?logo=flask&logoColor=white) ![Socket.IO](https://img.shields.io/badge/-Socket.IO-010101?logo=socket.io&logoColor=white) |
| **Database** | ![MongoDB](https://img.shields.io/badge/-MongoDB-47A248?logo=mongodb&logoColor=white) ![Redis](https://img.shields.io/badge/-Redis-DC382D?logo=redis&logoColor=white) |
| **Cryptography** | ![WebAssembly](https://img.shields.io/badge/-WASM-654FF0?logo=webassembly&logoColor=white) `libsignal-protocol` `crystals-kyber` `subtle-crypto` |


</div>

---

## 🚀 Getting Started

Follow these instructions to set up the project locally for development and testing.

### Prerequisites

- **Node.js**: `v18.x` or higher
- **Python**: `v3.9` or higher
- **MongoDB**: Running instance (local or cloud)
- **Redis**: Running instance (optional, for scaling)
- **pnpm** (recommended): `npm install -g pnpm`

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Amitgupta0001/SecureChannelX.git
    cd SecureChannelX
    ```

2.  **Backend Setup:**
    ```bash
    cd backend

    # Create and activate a virtual environment
    python -m venv venv
    # Windows: venv\Scripts\activate
    # Mac/Linux: source venv/bin/activate

    # Install Python dependencies
    pip install -r requirements.txt

    # Create a .env file from the example
    cp .env.example .env
    # --> Edit .env with your MONGODB_URI, SECRET_KEY, etc.

    # Run the backend server
    python run.py
    ```
    > The backend will be running on `http://localhost:5000`.

3.  **Frontend Setup:**
    ```bash
    cd ../frontend

    # Install Node.js dependencies
    pnpm install

    # Create a .env file from the example
    cp .env.example .env
    # --> Ensure VITE_API_BASE and VITE_SOCKET_URL are correct.

    # Run the development server
    pnpm dev
    ```
    > The frontend will be accessible at `http://localhost:5173`.

---

## 🧪 Running Tests

To ensure code quality and stability, run the test suites for both the frontend and backend.

-   **Backend (Flask):**
    ```bash
    cd backend
    pytest
    ```

-   **Frontend (React Testing Library):**
    ```bash
    cd frontend
    pnpm test
    ```

---


## 🗺️ Roadmap

-   [ ] **Disappearing Messages**: Set timers for messages to be automatically deleted.
-   [ ] **Voice Messages**: Securely send and receive encrypted audio clips.
-   [ ] **Desktop Application**: Build a dedicated desktop client using Electron or Tauri.
-   [ ] **Federation**: Allow self-hosted SecureChannelX servers to communicate with each other.

See the [open issues](https://github.com/Amitgupta0001/SecureChannelX/issues) for a full list of proposed features and known issues.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Please read our [**Contributing Guidelines**](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

## 📄 License

Distributed under the MIT License. See `LICENSE.txt` for more information.

---

## 📧 Contact


Project Link: [https://github.com/Amitgupta0001/SecureChannelX](https://github.com/Amitgupta0001/SecureChannelX)

<div align="center">
  <sub>Built with ❤️ by the SecureChannelX Team</sub>
</div>
