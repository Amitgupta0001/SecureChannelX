
# 🔐 SecureChannelX  
A Modern, End-to-End Encrypted Chat & File Sharing Web App  
Built with **React + Vite + Tailwind + Flask + Flask-SocketIO + MongoDB**

SecureChannelX is a full-stack, military-grade secure communication platform designed for:
- Encrypted messaging  
- Encrypted file sharing  
- Real-time chat  
- Typing indicators  
- Poll creation  
- Emoji reactions  
- Modern UI/UX  
- WebRTC (optional module)  
- PWA support (installable app)  

This project implements **forward secrecy**, **post-quantum-ready encryption**, and **JWT-based authentication**.

---

# 🚀 Features

## 🔑 Authentication
- JWT-based login & registration  
- Secure password hashing using bcrypt  
- Optional 2FA using TOTP (pyotp)

## 💬 Real-time Chat
- Socket.IO with safe fallback (polling → websocket)  
- Online/offline indicators  
- Typing indicators  
- Message list + bubble UI  
- Encrypted messages  
- Room-based communication  

## 📁 Encrypted File Sharing
- File upload modal  
- Secure backend file handling  
- Preview before sending  

## 😀 Chat Enhancements
- Emoji picker (modal)  
- Poll creation system  
- Message search  
- Smooth UI/UX  
- Mobile-friendly  

## 📱 PWA Support
- Offline caching via Service Worker  
- Installable on phone & desktop  
- Manifest.json included  
- Icons included  

## 🔐 Security
- End-to-end encryption pipeline  
- Forward secrecy (ratchet compatible)  
- Post-quantum support  
- Secure JWT config  
- Sanitized inputs  
- CORS protection  

---

# 📂 Project Structure

```
SecureChannelX/
│
├── backend/
│   ├── app.py
│   ├── .env
│   ├── requirements.txt
│   ├── app/
│   │   ├── routes/
│   │   ├── database/
│   │   ├── models/
│   │   ├── features/
│   │   └── utils/
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── public/
│   │   ├── manifest.json
│   │   ├── service-worker.js
│   │   └── icons/
│   ├── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── context/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── styles/
```

---

# ⚙️ Backend Setup

### 1️⃣ Create virtual environment
```bash
cd backend
python -m venv venv
venv/Scripts/activate
```

### 2️⃣ Install dependencies
```bash
pip install -r requirements.txt
```

### 3️⃣ Clean `.env` file
```
SECRET_KEY=your-secure-secret-key
JWT_SECRET_KEY=your-jwt-secret-key
MONGODB_URI=mongodb://localhost:27017/securechannelx
REDIS_URL=redis://localhost:6379
```

### 4️⃣ Run backend
```bash
python app.py
```

Backend runs at:
```
http://localhost:5050
```

---

# ⚙️ Frontend Setup

### 1️⃣ Install dependencies
```bash
cd frontend
npm install
```

### 2️⃣ Add frontend `.env`
```
VITE_API_URL=http://localhost:5050
VITE_WS_URL=http://localhost:5050
```

### 3️⃣ Run frontend
```bash
npm run dev
```

Frontend runs at:
```
http://localhost:5173
```

---

# 🔌 Socket.IO Notes

- Backend uses `threading` mode (Python 3.14 compatible)
- Werkzeug server fallback forces polling → websocket upgrade  
- Frontend uses:
```
transports: ["polling", "websocket"]
```

This guarantees:
✔ Stable chat  
✔ No crashes  
✔ Correct connection lifecycle  

---

# 📱 PWA Features

Project includes:

- `/public/manifest.json`  
- `/public/service-worker.js`  
- Icons  
- Auto-registration  

You can install SecureChannelX on laptop or phone.

---

# 👨‍💻 Developer

**Amit Kumar Gupta**  
Full-stack engineer • Security researcher  
Creator of SecureChannelX  

---

# 📜 License
For educational, academic, and portfolio use.

---

# ⭐ Summary

SecureChannelX is now:

✔ Fully working  
✔ Clean  
✔ Real-time enabled  
✔ Secure  
✔ Mobile compatible  
✔ PWA-ready  

If you want a **deployment guide, Dockerfile, or architecture diagram**, just ask!
