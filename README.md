# 🔐 **SecureChannelX**

### *A Modern, End-to-End Encrypted Messaging & File-Sharing Platform*

Built with **React + Vite + Tailwind + Flask + Flask-SocketIO + MongoDB + Redis**

SecureChannelX is a **military-grade secure communication platform** supporting:

* 🔒 End-to-end encrypted messaging
* 📁 Encrypted file sharing
* ⚡ Real-time chat via Socket.IO
* 📱 Installable PWA
* 📡 WebRTC voice/video calls
* 🛡 Fully protected backend
* 🔑 TOTP-based 2FA
* ⚙ Modular, scalable architecture

Designed for **security, speed, and modern UX**.

---

# 🚀 **Features**

## 🔑 Authentication

* JWT authentication
* Secure password hashing (bcrypt)
* TOTP-based 2FA (Google Authenticator / Authy)
* Session key rotation via socket

---

## 💬 Messaging System

* Real-time chat w/ Socket.IO
* Typing indicators
* Read receipts
* Reactions (emoji)
* Smart replies (AI-ready)
* Threaded replies
* Polls
* Message search
* Group chat system
* Direct messaging (DM)

---

## 📁 File Sharing

* Encrypted file uploads
* Modal upload UI
* Preview before sending
* Secure backend storage

---

## 🧠 End-to-End Encryption (E2EE)

* AES-256 client-side encryption
* Forward secrecy mechanism
* Key rotation
* Optional post-quantum KEM (backend capable)

---

## 🎥 WebRTC Calling (Optional)

* Voice calls
* Video calls
* Mute/camera toggle
* ICE + STUN support

---

## 📱 Progressive Web App (PWA)

* Offline caching
* Installation prompt
* Manifest + icons
* Service worker

---

## 🔧 Admin & Security Tools

* Admin dashboard
* Security Center
* Active devices
* Session keys
* Audit logs
* Client-side error logging
* Device fingerprinting

---

# 📂 **Project Structure**

```
SecureChannelX/
│
├── backend/
│   ├── app.py
│   ├── .env
│   ├── requirements.txt
│   ├── app/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── features/
│   │   ├── sockets/
│   │   ├── utils/
│   │   ├── security/
│   │   └── encryption/
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── .env
│   ├── public/
│   │   ├── manifest.json
│   │   ├── service-worker.js
│   │   └── icons/
│   ├── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── contexts/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       ├── sockets/
│       ├── utils/
│       └── styles/
```

---

# ⚙️ **Backend Setup**

### 1️⃣ Create venv

```bash
cd backend
python -m venv venv
source venv/bin/activate   # macOS/Linux
venv\Scripts\activate      # Windows
```

### 2️⃣ Install dependencies

```bash
pip install -r requirements.txt
```

### 3️⃣ Create `.env`

```env
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key
MONGO_URI=mongodb://localhost:27017/securechannelx
REDIS_URL=redis://localhost:6379/0

MAIL_SERVER=smtp.gmail.com
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### 4️⃣ Run backend

```bash
python app.py
```

Backend URL:

```
http://localhost:5050
```

---

# ⚙️ **Frontend Setup**

### 1️⃣ Install dependencies

```bash
cd frontend
npm install
```

### 2️⃣ Add `.env`

```env
VITE_API_BASE=http://localhost:5050
VITE_SOCKET_URL=http://localhost:5050
```

### 3️⃣ Run dev server

```bash
npm run dev
```

Frontend runs at:

```
http://localhost:3000
```

---

# 🔌 **Socket.IO Notes**

Frontend uses:

```js
io(VITE_SOCKET_URL, {
  transports: ["websocket", "polling"],
  auth: { token }
});
```

Backend (Flask-SocketIO):

* Uses **threading mode** → stable on Python 3.12–3.14
* Supports:

  * connection events
  * typing
  * message delivery
  * reactions
  * group events
  * call signaling

All integrated and tested.

---

# 📱 **PWA Included**

### ✔ `manifest.json`

### ✔ `service-worker.js`

### ✔ Installable on Android / Desktop

### ✔ Offline caching

### ✔ Push notifications (optional)

---

# 🛡 Security Highlights

* End-to-end AES-256 encryption
* PBKDF2-based key derivation
* JWT with refresh support
* Secure error logging
* Device management
* IP + device audit logs
* Rate limiting (backend supported)

---

# 👨‍💻 Developer

**Amit Kumar Gupta**
Full-stack Engineer • Security Researcher
Creator of SecureChannelX

---

# 📜 License

Released for **learning, academic, and portfolio use**.

---

# ⭐ Summary

SecureChannelX is now:

✔ Fully working
✔ Real-time enabled
✔ Secure & encrypted
✔ Supports groups & DM
✔ Modern UI (React + Tailwind)
✔ WebRTC ready
✔ PWA installable
✔ Production-grade architecture

---
