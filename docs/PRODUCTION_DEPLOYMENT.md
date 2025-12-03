# 🚀 SecureChannelX - Production Deployment Guide

> **Complete guide for deploying SecureChannelX to production environments**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Environment Configuration](#environment-configuration)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Database Setup](#database-setup)
8. [Monitoring & Logging](#monitoring--logging)
9. [Security Checklist](#security-checklist)
10. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

### Required Software

- **Docker**: v24.0+ ([Install](https://docs.docker.com/get-docker/))
- **Docker Compose**: v2.20+ ([Install](https://docs.docker.com/compose/install/))
- **Git**: Latest version
- **Domain Name**: For production deployment
- **SSL Certificate**: Free via Let's Encrypt or purchased

### Recommended Server Specs

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 50+ GB SSD |
| Bandwidth | 100 Mbps | 1 Gbps |

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Amitgupta0001/SecureChannelX.git
cd SecureChannelX
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Generate Secure Secrets

```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Generate JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Update .env file with generated secrets
```

### 4. Configure Environment Variables

Edit `.env` and update all `CHANGE_THIS_*` placeholders with your actual values.

### 5. Start the Application

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

---

## ⚙️ Environment Configuration

### Critical Environment Variables

#### Security (REQUIRED)

```env
# Generate these with: python -c "import secrets; print(secrets.token_urlsafe(64))"
SECRET_KEY=your-super-secret-flask-key-at-least-64-characters-long
JWT_SECRET_KEY=your-super-secret-jwt-key-at-least-64-characters-long
```

#### Database (REQUIRED)

```env
# MongoDB
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-secure-mongo-password
MONGODB_URI=mongodb://admin:your-secure-mongo-password@mongodb:27017/securechannelx?authSource=admin

# Redis
REDIS_PASSWORD=your-secure-redis-password
REDIS_URL=redis://:your-secure-redis-password@redis:6379/0
```

#### URLs (REQUIRED for production)

```env
FRONTEND_URL=https://your-domain.com
VITE_API_BASE_URL=https://api.your-domain.com
VITE_SOCKET_URL=https://api.your-domain.com
```

#### Email (RECOMMENDED)

```env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
```

---

## 🐳 Docker Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Production deployment with all services
docker-compose up -d

# Scale backend workers
docker-compose up -d --scale backend=3

# Update containers
docker-compose pull
docker-compose up -d --remove-orphans

# Stop services
docker-compose down

# Stop and remove volumes (DANGER: deletes all data)
docker-compose down -v
```

### Option 2: Manual Docker Build

```bash
# Build backend
cd backend
docker build -t securechannelx-backend .

# Build frontend
cd ../frontend
docker build -t securechannelx-frontend .

# Run backend
docker run -d \
  --name backend \
  -p 5000:5000 \
  --env-file ../.env \
  securechannelx-backend

# Run frontend
docker run -d \
  --name frontend \
  -p 3000:80 \
  securechannelx-frontend
```

---

## ☁️ Cloud Deployment

### AWS EC2 Deployment

#### 1. Launch EC2 Instance

- **AMI**: Ubuntu 22.04 LTS
- **Instance Type**: t3.medium (minimum)
- **Security Group**: Allow ports 22, 80, 443

#### 2. Connect and Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repository
git clone https://github.com/Amitgupta0001/SecureChannelX.git
cd SecureChannelX

# Configure environment
cp .env.example .env
nano .env  # Edit and save

# Deploy
docker-compose up -d
```

### DigitalOcean Droplet

Similar to EC2, but use:
```bash
# Create droplet with Docker pre-installed
doctl compute droplet create securechannelx \
  --image docker-20-04 \
  --size s-2vcpu-4gb \
  --region nyc3
```

### Google Cloud Platform (GCP)

```bash
# Create Compute Engine instance
gcloud compute instances create securechannelx \
  --machine-type=n1-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --zone=us-central1-a

# SSH and deploy (same as EC2)
```

### Azure VM

```bash
# Create VM
az vm create \
  --resource-group SecureChannelX \
  --name securechannelx-vm \
  --image UbuntuLTS \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys

# SSH and deploy (same as EC2)
```

---

## 🔒 SSL/TLS Setup

### Option 1: Let's Encrypt (Free, Recommended)

#### Using Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal (already enabled)
sudo certbot renew --dry-run
```

#### Update Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # ... rest of config
}
```

### Option 2: Self-Signed Certificate (Development Only)

```bash
# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/certs/key.pem \
  -out backend/certs/cert.pem \
  -subj "/CN=localhost"

# Update .env
USE_TLS=true
TLS_CERT_FILE=/app/certs/cert.pem
TLS_KEY_FILE=/app/certs/key.pem
```

---

## 🗄️ Database Setup

### MongoDB Atlas (Cloud)

1. **Create Account**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. **Create Cluster**: Choose region nearest to your users
3. **Setup User**: Database Access → Add Database User
4. **Whitelist IP**: Network Access → Add IP Address (0.0.0.0/0 for testing)
5. **Get Connection String**: Clusters → Connect → Connect Your Application

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/securechannelx?retryWrites=true&w=majority
```

### Redis Cloud

1. **Create Account**: [Redis Cloud](https://redis.com/try-free/)
2. **Create Database**: Select region and plan
3. **Get Credentials**: Copy endpoint and password

```env
REDIS_URL=redis://:password@redis-endpoint:port/0
```

### Self-Hosted MongoDB

```bash
# Install MongoDB
sudo apt install -y mongodb-org

# Start service
sudo systemctl start mongod
sudo systemctl enable mongod

# Create admin user
mongosh admin
db.createUser({
  user: "admin",
  pwd: "secure-password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})
```

---

## 📊 Monitoring & Logging

### Health Checks

```bash
# Backend health
curl http://localhost:5000/api/health

# Frontend health
curl http://localhost:3000/health

# Docker health status
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Prometheus & Grafana (Optional)

Add to `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## 🛡️ Security Checklist

### Pre-Deployment

- [ ] Change all default passwords
- [ ] Generate strong random secrets (64+ characters)
- [ ] Review and update `.env` file
- [ ] Enable HTTPS/TLS
- [ ] Set up firewall rules
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up 2FA for admin accounts

### Post-Deployment

- [ ] Test all authentication flows
- [ ] Verify SSL certificate
- [ ] Check file upload limits
- [ ] Monitor error logs
- [ ] Set up automated backups
- [ ] Configure monitoring alerts
- [ ] Review security headers
- [ ] Run security scan (e.g., OWASP ZAP)

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Fail2ban (brute force protection)
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check configuration
docker-compose config

# Rebuild container
docker-compose up -d --build --force-recreate backend
```

#### 2. Database Connection Failed

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Test connection
docker exec -it securechannelx-mongodb mongosh -u admin -p

# Check environment variables
docker exec securechannelx-backend env | grep MONGODB
```

#### 3. Socket.IO Connection Issues

```bash
# Check CORS configuration
# Ensure FRONTEND_URL matches actual frontend URL

# Check if Socket.IO is running
curl http://localhost:5000/socket.io/

# Test WebSocket connection
wscat -c ws://localhost:5000/socket.io/?EIO=4&transport=websocket
```

#### 4. Frontend Can't Connect to Backend

```bash
# Check API URL configuration
docker exec securechannelx-frontend cat /usr/share/nginx/html/assets/*.js | grep VITE_API

# Check network
docker network inspect securechannelx_securechannelx-network

# Test API from frontend container
docker exec securechannelx-frontend wget -O- http://backend:5000/api/health
```

### Performance Optimization

```bash
# Scale backend workers
docker-compose up -d --scale backend=4

# Monitor resource usage
docker stats

# Clean up unused resources
docker system prune -a
```

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [MongoDB Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)
- [Nginx Optimization](https://nginx.org/en/docs/http/ngx_http_core_module.html)
- [Let's Encrypt](https://letsencrypt.org/)
- [OWASP Security](https://owasp.org/www-project-top-ten/)

---

## 📞 Support

- **Documentation**: [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/Amitgupta0001/SecureChannelX/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Amitgupta0001/SecureChannelX/discussions)

---

**Built with ❤️ for Privacy and Security**

© 2024 SecureChannelX. Licensed under MIT.
