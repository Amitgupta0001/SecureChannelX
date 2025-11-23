# 🔐 **SecureChannelX**

### *A Modern, End-to-End Encrypted Messaging & File-Sharing Platform*

Built with **React + Vite + Tailwind + Flask + Flask-SocketIO + MongoDB + Redis**

SecureChannelX is a **military-grade secure communication platform** supporting:

* 🔒 End-to-end encrypted messaging (AES-256-GCM)
* 📁 Encrypted file sharing
* ⚡ Real-time chat via Socket.IO
* 📱 Installable PWA
* 📡 WebRTC voice/video calls
* 🛡 Fully protected backend with JWT authentication
* 🔑 TOTP-based 2FA (Google Authenticator / Authy)
* ⚙ Modular, scalable architecture
* 🔄 Password reset via email
* 👥 User management and chat creation

Designed for **security, speed, and modern UX**.

---

# 🚀 **Features**

## 🔑 Authentication & Security

* JWT authentication with secure token management
* Secure password hashing (bcrypt)
* TOTP-based 2FA (Google Authenticator / Authy)
* Session key rotation via socket
* Password reset flow with email verification
* Device management and fingerprinting
* Audit logging for security events
* Client-side error logging

---

## 💬 Messaging System

* Real-time chat with Socket.IO
* Private (1-on-1) and group chats
* Create new chats with user selection modal
* Typing indicators
* Read receipts
* Reactions (emoji)
* Threaded replies
* Message search, edit, and delete
* Polls
* Group chat system with member management
* Direct messaging (DM)

---

## 📁 File Sharing

* Encrypted file uploads
* Modal upload UI with preview
* Secure backend storage
* File encryption before transmission

---

## 🧠 End-to-End Encryption (E2EE)

* AES-256-GCM client-side encryption
* Forward secrecy mechanism
* Automatic key rotation
* Session key management
* Encrypted message storage

---

## 🎥 WebRTC Calling

* Voice calls
* Video calls
* Mute/camera toggle
* ICE + STUN support
* Call signaling via Socket.IO

---

## 📱 Progressive Web App (PWA)

* Offline caching
* Installation prompt
* Manifest + icons
* Service worker
* Mobile-responsive design

---

## 🔧 Admin & Security Tools

* Security Center dashboard
* Active devices management
* Session keys viewer
* Audit logs
* Client-side error logging
* Device fingerprinting
* 2FA setup and management

---

# 📂 **Project Structure**

```
SecureChannelX/
│
├── backend/
│   ├── run.py                 # Application entry point
│   ├── .env                   # Environment variables
│   ├── requirements.txt       # Python dependencies
│   └── app/
│       ├── app_factory.py     # Flask app factory
│       ├── database.py        # MongoDB connection
│       ├── routes/            # API endpoints
│       │   ├── auth.py        # Authentication routes
│       │   ├── security_routes.py  # 2FA, logout, devices
│       │   ├── chats.py       # Chat management
│       │   ├── groups.py      # Group management
│       │   ├── messages.py    # Message CRUD
│       │   ├── users.py       # User list
│       │   ├── calls.py       # WebRTC signaling
│       │   └── ...
│       ├── models/            # Database models
│       ├── features/          # Advanced features
│       ├── sockets/           # Socket.IO handlers
│       ├── utils/             # Helper functions
│       ├── security/          # Security utilities
│       └── encryption/        # Encryption logic
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── .env                   # Frontend environment
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   ├── service-worker.js  # Service worker
│   │   └── icons/             # App icons
│   └── src/
│       ├── App.jsx            # Main app component
│       ├── main.jsx           # Entry point
│       ├── context/           # React contexts
│       │   ├── AuthContext.jsx
│       │   ├── ChatContext.jsx
│       │   ├── SocketContext.jsx
│       │   └── ...
│       ├── components/        # Reusable components
│       │   ├── ChatList.jsx
│       │   ├── ChatWindow.jsx
│       │   ├── NewChatModal.jsx
│       │   └── ...
│       ├── pages/             # Page components
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── ChatRoom.jsx
│       │   ├── TwoFactorAuth.jsx
│       │   └── ...
│       ├── hooks/             # Custom React hooks
│       ├── api/               # API client functions
│       ├── services/          # Business logic
│       ├── sockets/           # Socket.IO handlers
│       └── utils/             # Utility functions
```

---

# ⚙️ **Backend Setup**

### 1️⃣ Install MongoDB

Ensure MongoDB is running on `localhost:27017`

```bash
# Windows
mongod

# macOS/Linux
sudo systemctl start mongod
```

### 2️⃣ Create virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate   # macOS/Linux
venv\Scripts\activate      # Windows
```

### 3️⃣ Install dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Create `.env` file

```env
# Security Keys (REQUIRED - generate with: python -c "import secrets; print(secrets.token_hex(32))")
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Database
MONGO_URI=mongodb://localhost:27017/securechat

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# Email (for password reset)
MAIL_SERVER=smtp.gmail.com
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# Debug mode (set to False in production)
FLASK_DEBUG=True
```

**⚠️ IMPORTANT**: Generate secure random keys:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 5️⃣ Run backend

```bash
python run.py
```

Backend runs at: **http://localhost:5050**

---

# ⚙️ **Frontend Setup**

### 1️⃣ Install dependencies

```bash
cd frontend
npm install
```

### 2️⃣ Create `.env` file

```env
VITE_API_BASE=http://localhost:5050
VITE_SOCKET_URL=http://localhost:5050
VITE_WEBSOCKET_URL=ws://localhost:5050
```

### 3️⃣ Run development server

```bash
npm run dev
```

Frontend runs at: **http://localhost:3000**

### 4️⃣ Build for production

```bash
npm run build
```

---

# 🔌 **Socket.IO Integration**

Frontend connection:

```javascript
io(VITE_SOCKET_URL, {
  transports: ["websocket", "polling"],
  auth: { token: localStorage.getItem("access_token") }
});
```

Backend events supported:
* `connection` - Client connects
* `join_chat` - Join chat room
* `leave_chat` - Leave chat room
* `message:send` - Send message
* `message:new` - Receive message
* `typing:start` / `typing:stop` - Typing indicators
* `reaction:add` - Add reaction
* `message:seen` - Mark as read
* `group:create` / `group:member_added` - Group events
* `call:offer` / `call:answer` / `call:ice_candidate` - WebRTC signaling

---

# 📱 **PWA Features**

### ✅ Installable on Desktop & Mobile
### ✅ Offline caching with Service Worker
### ✅ App manifest with icons
### ✅ Add to Home Screen support
### ✅ Push notifications (optional)

---

# 🛡 **Security Highlights**

* **End-to-end AES-256-GCM encryption** for all messages
* **PBKDF2-based key derivation** for password hashing
* **JWT with secure token management** and refresh support
* **TOTP-based 2FA** for enhanced account security
* **Secure session management** with device tracking
* **Audit logging** for all security events
* **Rate limiting** support (backend ready)
* **Input validation** and sanitization
* **CORS protection** with allowed origins
* **Secure password reset** flow with email verification

---

# 🚀 **Getting Started**

1. **Clone the repository**
   ```bash
   git clone https://github.com/Amitgupta0001/SecureChannelX.git
   cd SecureChannelX
   ```

2. **Set up backend** (see Backend Setup above)

3. **Set up frontend** (see Frontend Setup above)

4. **Create a user account**
   - Navigate to http://localhost:3000/register
   - Register with username, email, and password

5. **Login and start chatting**
   - Login at http://localhost:3000/login
   - Click the "+" button to create a new chat
   - Select a user and start messaging!

---

# 🔧 **API Endpoints**

### Authentication
* `POST /api/auth/register` - Register new user
* `POST /api/auth/login` - Login user
* `POST /api/auth/forgot-password` - Request password reset
* `POST /api/auth/reset-password` - Reset password with token
* `GET /api/auth/profile` - Get user profile

### Security
* `POST /api/security/setup-2fa` - Setup 2FA
* `POST /api/security/verify-2fa` - Verify 2FA code
* `POST /api/security/enable-2fa` - Enable 2FA
* `POST /api/security/disable-2fa` - Disable 2FA
* `POST /api/security/logout` - Logout user
* `GET /api/security/devices` - Get active devices
* `GET /api/security/audit-logs` - Get audit logs

### Chats
* `POST /api/chats/create` - Create new chat
* `GET /api/chats/list` - Get user's chats
* `GET /api/chats/:id` - Get chat details

### Messages
* `GET /api/messages/:chat_id` - Get chat messages
* `POST /api/messages/:chat_id` - Send message
* `GET /api/messages/search` - Search messages
* `PUT /api/messages/:id` - Edit message
* `DELETE /api/messages/:id` - Delete message
* `POST /api/messages/:id/thread` - Create thread message
* `GET /api/messages/:id/thread` - Get thread messages

### Users
* `GET /api/users/list` - Get all users (for chat creation)

### Groups
* `POST /api/groups/create` - Create group
* `GET /api/groups/list` - Get user's groups
* `POST /api/groups/:id/add` - Add member to group

---

# 🐛 **Troubleshooting**

### Backend won't start
* Ensure MongoDB is running
* Check `.env` file has valid SECRET_KEY and JWT_SECRET_KEY
* Verify Python version (3.8+)

### Frontend can't connect to backend
* Ensure backend is running on port 5050
* Check `.env` file has correct VITE_API_BASE
* Clear browser cache (Ctrl+Shift+R)

### Login not working
* Check browser console for errors
* Verify SECRET_KEY and JWT_SECRET_KEY are set in backend/.env
* Restart backend server after changing .env

### Chat list shows "No chats yet"
* This is normal for new users
* Click the "+" button to create a new chat
* Select a user from the list

---

# 👨‍💻 **Developer**

**Amit Kumar Gupta**  
Full-stack Engineer • Security Researcher  
Creator of SecureChannelX

GitHub: [@Amitgupta0001](https://github.com/Amitgupta0001)

---

# 📜 **License**

Released for **learning, academic, and portfolio use**.

---

# 🙏 **Acknowledgments**

Built with:
* React + Vite + TailwindCSS
* Flask + Flask-SocketIO
* MongoDB + PyMongo
* Socket.IO
* WebRTC
* Framer Motion
* Axios

---

**⭐ Star this repo if you find it useful!**
