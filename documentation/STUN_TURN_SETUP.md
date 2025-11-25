# STUN/TURN Server Configuration for WebRTC Calls

## Why STUN/TURN?

**STUN** (Session Traversal Utilities for NAT): Helps discover your public IP address
**TURN** (Traversal Using Relays around NAT): Relays traffic when direct connection fails

**Without STUN/TURN**: Calls may fail behind firewalls/NAT (corporate networks, some ISPs)
**With STUN/TURN**: 99%+ call success rate

---

## Quick Setup (Free Options)

### Option 1: Google STUN Servers (Free, STUN only)
**Best for**: Development and most users
**Limitation**: No TURN (relay), may fail in restrictive networks

Already configured in your project! No setup needed.

### Option 2: Twilio TURN (Free Tier)
**Best for**: Production with high reliability
**Free Tier**: 10GB/month bandwidth

#### Setup Steps:
1. Sign up at https://www.twilio.com/
2. Go to Console → Programmable Video → Settings
3. Copy your credentials
4. Update frontend `.env`:

```env
VITE_TWILIO_ACCOUNT_SID=your-account-sid
VITE_TWILIO_AUTH_TOKEN=your-auth-token
```

### Option 3: Xirsys (Free Tier)
**Best for**: Small to medium apps
**Free Tier**: 500MB/month

1. Sign up at https://xirsys.com/
2. Create a channel
3. Get ICE servers list
4. Add to configuration

### Option 4: Self-Hosted coturn (Free, Unlimited)
**Best for**: Complete control, no bandwidth limits
**Requires**: Your own server

See "Self-Hosted Setup" section below.

---

## Frontend Configuration

### File: `frontend/.env`
```env
# STUN/TURN Configuration
VITE_USE_CUSTOM_ICE_SERVERS=true

# Twilio (if using)
VITE_TWILIO_ACCOUNT_SID=your-account-sid
VITE_TWILIO_AUTH_TOKEN=your-auth-token

# Or direct ICE servers
VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:your-turn-server.com:3478","username":"user","credential":"pass"}]'
```

### File: `frontend/src/config/webrtc.js` (NEW)
Create this file:

```javascript
// WebRTC ICE Server Configuration

// Free STUN servers (always available)
const FREE_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Get ICE servers from environment or use defaults
export const getICEServers = () => {
  // Option 1: Use custom ICE servers from env
  if (import.meta.env.VITE_ICE_SERVERS) {
    try {
      return JSON.parse(import.meta.env.VITE_ICE_SERVERS);
    } catch (e) {
      console.error('Invalid ICE servers config:', e);
    }
  }

  // Option 2: Use Twilio (if configured)
  if (import.meta.env.VITE_TWILIO_ACCOUNT_SID) {
    return getTwilioICEServers();
  }

  // Option 3: Default to free STUN servers
  return FREE_STUN_SERVERS;
};

// Fetch Twilio TURN credentials
const getTwilioICEServers = async () => {
  try {
    const response = await fetch('/api/webrtc/ice-servers');
    const data = await response.json();
    return data.iceServers || FREE_STUN_SERVERS;
  } catch (error) {
    console.error('Failed to get Twilio ICE servers:', error);
    return FREE_STUN_SERVERS;
  }
};

// WebRTC configuration
export const RTC_CONFIGURATION = {
  iceServers: getICEServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all', // 'all' or 'relay' (force TURN)
};

// Connection quality monitoring
export const monitorConnection = (peerConnection) => {
  peerConnection.addEventListener('iceconnectionstatechange', () => {
    console.log('ICE Connection State:', peerConnection.iceConnectionState);
    
    switch (peerConnection.iceConnectionState) {
      case 'connected':
        console.log('✅ WebRTC connection established');
        break;
      case 'disconnected':
        console.warn('⚠️ WebRTC connection lost, attempting reconnect...');
        break;
      case 'failed':
        console.error('❌ WebRTC connection failed');
        break;
    }
  });

  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log('ICE Gathering State:', peerConnection.iceGatheringState);
  });
};
```

---

## Backend API for Twilio (Optional)

### File: `backend/app/routes/webrtc.py` (NEW)
```python
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import os
from twilio.rest import Client

webrtc_bp = Blueprint("webrtc", __name__, url_prefix="/api/webrtc")

@webrtc_bp.route("/ice-servers", methods=["GET"])
@jwt_required()
def get_ice_servers():
    """
    Get TURN credentials from Twilio
    Credentials are temporary and expire after 24 hours
    """
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    
    if not account_sid or not auth_token:
        # Return free STUN servers if Twilio not configured
        return jsonify({
            "iceServers": [
                {"urls": "stun:stun.l.google.com:19302"},
                {"urls": "stun:stun1.l.google.com:19302"}
            ]
        })
    
    try:
        client = Client(account_sid, auth_token)
        token = client.tokens.create()
        
        return jsonify({
            "iceServers": token.ice_servers,
            "ttl": 86400  # 24 hours
        })
    except Exception as e:
        print(f"Twilio error: {e}")
        # Fallback to STUN
        return jsonify({
            "iceServers": [
                {"urls": "stun:stun.l.google.com:19302"}
            ]
        })
```

Register in `app_factory.py`:
```python
from app.routes.webrtc import webrtc_bp
app.register_blueprint(webrtc_bp)
```

---

## Self-Hosted coturn Setup

### Installation (Ubuntu/Debian)
```bash
# Install coturn
sudo apt update
sudo apt install coturn

# Enable coturn
sudo nano /etc/default/coturn
# Uncomment: TURNSERVER_ENABLED=1

# Configure coturn
sudo nano /etc/turnserver.conf
```

### Configuration (`/etc/turnserver.conf`)
```conf
# Listening port
listening-port=3478
tls-listening-port=5349

# External IP (your server's public IP)
external-ip=YOUR_PUBLIC_IP

# Relay IP (usually same as external)
relay-ip=YOUR_PUBLIC_IP

# Realm (your domain)
realm=turn.yourdomain.com

# Authentication
lt-cred-mech
user=username:password

# Logging
log-file=/var/log/turnserver.log
verbose

# Security
fingerprint
no-multicast-peers

# Performance
max-bps=1000000
```

### Start coturn
```bash
sudo systemctl start coturn
sudo systemctl enable coturn
sudo systemctl status coturn
```

### Firewall Configuration
```bash
# Allow TURN ports
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp

# Allow relay ports
sudo ufw allow 49152:65535/udp
```

### Use in Frontend
```env
VITE_ICE_SERVERS='[{"urls":"stun:turn.yourdomain.com:3478"},{"urls":"turn:turn.yourdomain.com:3478","username":"username","credential":"password"}]'
```

---

## Testing

### Test STUN/TURN Connectivity
Visit: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

1. Add your ICE servers
2. Click "Gather candidates"
3. Check results:
   - `srflx`: STUN working ✅
   - `relay`: TURN working ✅

### Test in Your App
```javascript
// In browser console
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:your-server:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
});

pc.createDataChannel('test');
pc.createOffer().then(offer => pc.setLocalDescription(offer));

pc.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('ICE Candidate:', event.candidate.type);
    // Should see: host, srflx (STUN), relay (TURN)
  }
};
```

---

## Cost Comparison

| Provider | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Google STUN** | ✅ Unlimited | N/A | Development |
| **Twilio** | 10GB/month | $0.40/GB | Production |
| **Xirsys** | 500MB/month | $10/month | Small apps |
| **Self-hosted** | ✅ Unlimited | Server cost | Full control |

**Recommendation**: 
- Development: Google STUN (free, already configured)
- Production: Twilio or self-hosted coturn

---

## Monitoring

### Check Connection Quality
```javascript
setInterval(() => {
  peerConnection.getStats().then(stats => {
    stats.forEach(report => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        console.log('Active connection:', report.localCandidateId);
      }
    });
  });
}, 5000);
```

### Common Issues

**Issue**: Calls fail in corporate networks
**Solution**: Add TURN server (relay)

**Issue**: High latency
**Solution**: Use geographically closer TURN server

**Issue**: Connection drops frequently
**Solution**: Increase `iceCandidatePoolSize`

---

## Summary

✅ **Already Configured**: Google STUN servers (works for 80% of users)  
✅ **Quick Upgrade**: Add Twilio for 99%+ success rate (10 minutes)  
✅ **Full Control**: Self-host coturn (30 minutes setup)  

**Your app already works for most users! TURN is optional for maximum reliability.**
