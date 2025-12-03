# 📁 SecureChannelX - Project Structure

Complete directory structure and file organization for the SecureChannelX project.

---

## 🗂️ Root Directory

```
SecureChannelX/
├── .github/                    # GitHub configurations
│   └── workflows/
│       └── ci-cd.yml          # CI/CD pipeline
│
├── backend/                    # Backend application (Python/Flask)
│   ├── app/                   # Application code
│   │   ├── config/           # Configuration modules
│   │   ├── database/         # Database utilities
│   │   ├── features/         # Advanced features
│   │   ├── models/           # Data models
│   │   ├── routes/           # API endpoints
│   │   │   ├── __init__.py
│   │   │   ├── auth.py       # Authentication
│   │   │   ├── calls.py      # Voice/Video calls
│   │   │   ├── chats.py      # Chat management
│   │   │   ├── direct_messages.py
│   │   │   ├── file_upload.py
│   │   │   ├── groups.py     # Group management
│   │   │   ├── health.py     # Health checks ✨ NEW
│   │   │   ├── keys.py       # Encryption keys
│   │   │   ├── messages.py   # Message handling
│   │   │   ├── notifications.py
│   │   │   ├── reactions.py
│   │   │   ├── read_receipts.py
│   │   │   ├── security_routes.py
│   │   │   ├── users.py
│   │   │   └── webauthn.py   # WebAuthn/FIDO2
│   │   ├── security/         # Security utilities
│   │   ├── socket/           # Socket.IO handlers
│   │   │   ├── call_events.py
│   │   │   ├── chat_events.py
│   │   │   ├── group_events.py
│   │   │   └── typing_events.py
│   │   ├── utils/            # Utilities
│   │   ├── webrtc/           # WebRTC signaling
│   │   ├── __init__.py
│   │   └── app_factory.py    # App factory pattern
│   ├── certs/                # SSL certificates
│   ├── group_media/          # Group file uploads
│   ├── uploads/              # User file uploads
│   ├── venv/                 # Python virtual environment
│   ├── .env                  # Environment variables (gitignored)
│   ├── .gitignore
│   ├── Dockerfile            # Backend container ✨ NEW
│   ├── requirements.txt      # Python dependencies
│   └── run.py                # Application entry point
│
├── docs/                      # 📚 Documentation ✨ NEW
│   ├── README.md             # Documentation index
│   ├── QUICKSTART.md         # 5-minute quick start
│   ├── PRODUCTION_DEPLOYMENT.md  # Complete deployment guide
│   ├── PRODUCTION_CHECKLIST.md   # Pre-deployment checklist
│   ├── PRODUCTION_READY.md   # Production enhancements
│   └── SECURITY.md           # Security policies
│
├── frontend/                  # Frontend application (React/Vite)
│   ├── public/               # Static assets
│   │   ├── icons/           # PWA icons
│   │   ├── manifest.json    # PWA manifest
│   │   └── service-worker.js
│   ├── src/                  # Source code
│   │   ├── api/             # API layer (13 files)
│   │   ├── components/      # React components (23 files)
│   │   ├── context/         # Context providers (7 files)
│   │   ├── hooks/           # Custom hooks (6 files)
│   │   ├── lib/             # Crypto library (7 files)
│   │   ├── pages/           # Page components (14 files)
│   │   ├── services/        # Services (6 files)
│   │   ├── socket/          # Socket handlers (6 files)
│   │   ├── styles/          # CSS files (3 files)
│   │   ├── utils/           # Utilities (7 files)
│   │   ├── App.jsx          # Root component
│   │   └── main.jsx         # Entry point
│   ├── .env                  # Environment variables (gitignored)
│   ├── .gitignore
│   ├── Dockerfile            # Frontend container ✨ NEW
│   ├── index.html
│   ├── nginx.conf            # Nginx configuration ✨ NEW
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── .dockerignore             # Docker build optimization ✨ NEW
├── .env.example              # Environment template ✨ NEW
├── .gitignore                # Git ignore rules
├── backup-db.sh              # Database backup script ✨ NEW
├── deploy.sh                 # Deployment automation ✨ NEW
├── docker-compose.yml        # Docker orchestration ✨ NEW
├── kubernetes.yaml           # Kubernetes manifests ✨ NEW
├── nginx-proxy.conf          # Reverse proxy config ✨ NEW
├── README.md                 # Project overview
├── restore-db.sh             # Database restore script ✨ NEW
└── setup-ssl.sh              # SSL setup automation ✨ NEW
```

## 📊 Statistics

### Project Overview
- **Total Directories**: 20+
- **Backend Files**: 50+ Python files
- **Frontend Files**: 90+ React/JS files
- **Documentation Files**: 6 markdown files
- **Configuration Files**: 10+ config files
- **Scripts**: 4 shell scripts
- **Docker Files**: 3 (backend, frontend, compose)

### Lines of Code (Approximate)
- **Backend**: ~15,000 lines (Python)
- **Frontend**: ~20,000 lines (JavaScript/React)
- **Configuration**: ~2,000 lines
- **Documentation**: ~5,000 lines
- **Total**: ~42,000+ lines

---

## 🎯 Key Directories Explained

### `/backend/app/routes/`
All API endpoints organized by feature:
- **auth.py**: Authentication (login, register, 2FA)
- **chats.py**: Chat management
- **messages.py**: Message handling
- **groups.py**: Group chat features
- **health.py**: Monitoring endpoints ✨ NEW
- **webauthn.py**: Hardware security keys

### `/frontend/src/`
React application structure:
- **api/**: Backend API integration
- **components/**: Reusable UI components
- **context/**: Global state management
- **lib/**: Cryptography implementation
- **pages/**: Route components
- **socket/**: WebSocket handlers

### `/docs/`
All project documentation:
- Complete deployment guides
- Security policies
- Quick start tutorials
- Production checklists

---

## 🔧 Configuration Files

### Environment Files
- `.env.example` - Template with all options
- `backend/.env` - Backend configuration (gitignored)
- `frontend/.env` - Frontend configuration (gitignored)

### Docker Files
- `backend/Dockerfile` - Backend container
- `frontend/Dockerfile` - Frontend container
- `docker-compose.yml` - Multi-container orchestration
- `.dockerignore` - Build optimization

### Deployment Files
- `kubernetes.yaml` - K8s deployment
- `nginx-proxy.conf` - Reverse proxy
- GitHub Actions workflow

---

## 📝 Important Files

### Backend
- **run.py**: Application entry point
- **app_factory.py**: Flask app factory
- **requirements.txt**: Python dependencies

### Frontend
- **main.jsx**: React entry point
- **App.jsx**: Root component
- **package.json**: Node dependencies
- **vite.config.js**: Build configuration

### Scripts
- **deploy.sh**: Deployment automation
- **backup-db.sh**: Database backups
- **restore-db.sh**: Database restore
- **setup-ssl.sh**: SSL certificate setup

---

## 🚀 Quick Navigation

### For Developers
- Code: `/backend/app/` and `/frontend/src/`
- API Routes: `/backend/app/routes/`
- Components: `/frontend/src/components/`

### For DevOps
- Docker: `docker-compose.yml`, `Dockerfile`s
- Scripts: `*.sh` files
- Config: `nginx-proxy.conf`, `kubernetes.yaml`

### For Documentation
- Guides: `/docs/`
- README: Root and `/docs/README.md`
- API Docs: `/backend/app/routes/`

---

## 🔍 File Naming Conventions

### Python Files
- **Snake case**: `user_authentication.py`
- **Descriptive names**: `encryption_service.py`
- **Clear purpose**: `chat_events.py`

### JavaScript/React Files
- **PascalCase** for components: `ChatWindow.jsx`
- **camelCase** for utilities: `apiClient.js`
- **Descriptive names**: `encryptionContext.jsx`

### Configuration Files
- **Kebab case**: `docker-compose.yml`
- **Dot prefix**: `.env.example`
- **Extensions**: `.yml`, `.yaml`, `.json`, `.conf`

---

## 📦 Dependencies

### Backend (Python)
- Flask 3.0
- Flask-SocketIO 5.3
- PyMongo 4.6
- Cryptography 41.0
- Gunicorn 21.2
- [See requirements.txt for complete list]

### Frontend (Node.js)
- React 18
- Vite 7
- TailwindCSS 3
- Socket.IO Client 4
- [See package.json for complete list]

---

## 🎨 Code Organization Principles

1. **Separation of Concerns**: Features in separate modules
2. **DRY Principle**: Reusable utilities and components
3. **Clear Naming**: Self-documenting code
4. **Consistent Structure**: Similar files in same locations
5. **Documentation**: README in each major directory

---

## 🔄 Version Control

### Gitignored Files
- Environment files (`.env`)
- Virtual environments (`venv/`)
- Node modules (`node_modules/`)
- Build outputs (`dist/`, `build/`)
- Logs (`*.log`)
- Uploads (`uploads/`, `group_media/`)
- Cache files (`__pycache__/`, `.pytest_cache/`)

### Tracked Files
- Source code
- Configuration templates
- Documentation
- Docker configurations
- Deployment scripts

---

## 📈 Growth Path

As the project grows:
- Add `/tests/` for unit tests
- Add `/docs/api/` for API documentation
- Add `/scripts/` for utility scripts
- Add `/monitoring/` for monitoring configs
- Add `/migrations/` for database migrations

---

**Last Updated**: December 2024  
**Version**: 2.0.0 (Production Ready)
