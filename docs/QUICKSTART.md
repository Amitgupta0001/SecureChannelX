# 🚀 Quick Start - Production Deployment

Get SecureChannelX running in production in 5 minutes!

---

## ⚡ Prerequisites

- **Docker**: v24.0+ ([Install](https://docs.docker.com/get-docker/))
- **Docker Compose**: v2.20+ ([Install](https://docs.docker.com/compose/install/))
- **Domain Name**: For production (optional for testing)
- **Server**: 2+ CPU cores, 4+ GB RAM

---

## 🎯 Quick Deploy

### 1. Clone Repository

```bash
git clone https://github.com/Amitgupta0001/SecureChannelX.git
cd SecureChannelX
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Generate secrets (Linux/macOS)
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
python3 -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env

# Or on Windows PowerShell
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env

# Edit .env and update remaining values
nano .env  # or use your preferred editor
```

**Required values in `.env`:**
```env
# Change these:
MONGO_ROOT_PASSWORD=your-secure-password-here
REDIS_PASSWORD=your-redis-password-here
FRONTEND_URL=https://your-domain.com  # or http://localhost:3000 for testing

# Email (optional but recommended):
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### 3. Deploy with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 4. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api/health
- **Health Check**: http://localhost:5000/api/health

---

## 🔧 Using Deploy Script (Recommended)

Make the script executable:
```bash
chmod +x deploy.sh
```

Available commands:
```bash
./deploy.sh start     # Start all services
./deploy.sh health    # Run health checks
./deploy.sh logs      # View logs
./deploy.sh backup    # Backup database
./deploy.sh update    # Update and restart
./deploy.sh stop      # Stop services
```

---

## 🌐 Production Deployment (with SSL)

### 1. Point Domain to Server

Create A record:
```
your-domain.com → YOUR_SERVER_IP
www.your-domain.com → YOUR_SERVER_IP
```

### 2. Setup SSL Certificate

```bash
# Make script executable
chmod +x setup-ssl.sh

# Run setup
./setup-ssl.sh your-domain.com your-email@domain.com
```

### 3. Update URLs in .env

```env
FRONTEND_URL=https://your-domain.com
VITE_API_BASE_URL=https://api.your-domain.com
VITE_SOCKET_URL=https://api.your-domain.com
```

### 4. Start with Reverse Proxy

```bash
# Start with production profile
docker-compose --profile production up -d

# Access via HTTPS
# https://your-domain.com
```

---

## 📊 Verify Deployment

### Check Health

```bash
# Backend health
curl http://localhost:5000/api/health

# Response should be:
# {"status":"healthy","checks":{"database":{"status":"healthy"},...}}

# All services
docker-compose ps

# Should show all services as "healthy"
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

---

## 🔐 Security Checklist

Before going live:

- [ ] Changed all default passwords
- [ ] Generated strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Configured HTTPS/SSL
- [ ] Set FLASK_ENV=production and FLASK_DEBUG=false
- [ ] Configured firewall (allow only 22, 80, 443)
- [ ] Set up automated backups
- [ ] Configured email for password reset
- [ ] Reviewed CORS settings

---

## 💾 Backup & Restore

### Create Backup

```bash
# Make script executable
chmod +x backup-db.sh

# Run backup
./backup-db.sh

# Backup saved to: ./backups/
```

### Restore from Backup

```bash
# Make script executable
chmod +x restore-db.sh

# Restore
./restore-db.sh backups/securechannelx_backup_YYYYMMDD_HHMMSS.gz
```

---

## 🆘 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs backend

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Database Connection Error

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Test connection
docker exec -it securechannelx-mongodb mongosh -u admin -p
```

### Frontend Can't Connect to Backend

1. Check CORS settings in `.env`
2. Verify `FRONTEND_URL` matches actual frontend URL
3. Test API directly:
   ```bash
   curl http://localhost:5000/api/health
   ```

### Port Already in Use

```bash
# Change ports in .env
BACKEND_PORT=5001  # instead of 5000
FRONTEND_PORT=3001 # instead of 3000

# Restart
docker-compose down
docker-compose up -d
```

---

## 📈 Monitoring

### View Metrics

```bash
# Application metrics
curl http://localhost:5000/api/metrics

# System resources
docker stats

# Container health
docker inspect securechannelx-backend --format='{{.State.Health.Status}}'
```

### Set Up Alerts

Configure alerts in your monitoring tool:
- Backend down (health check fails)
- Database connection lost
- High CPU/memory usage
- Disk space low

---

## 🔄 Updates

### Update Application

```bash
# Using deploy script
./deploy.sh update

# Or manually:
git pull
docker-compose pull
docker-compose up -d --build
docker system prune -f
```

---

## 🛑 Shutdown

```bash
# Stop services (keeps data)
docker-compose down

# Stop and remove volumes (DELETES ALL DATA!)
docker-compose down -v
```

---

## 📚 Additional Resources

- **Full Documentation**: [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
- **Checklist**: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
- **Main README**: [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/Amitgupta0001/SecureChannelX/issues)

---

## ⚙️ Advanced Configuration

### Scale Backend Workers

```bash
# Run with 4 backend instances
docker-compose up -d --scale backend=4
```

### Use External Database

Update `.env`:
```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/securechannelx

# Redis Cloud
REDIS_URL=redis://:password@redis-endpoint:port/0
```

### Enable Cloud Storage

Update `.env`:
```env
# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket

# Or Azure Blob
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_CONTAINER_NAME=your-container
```

---

## 📞 Support

- **Documentation**: Full guides in `/docs`
- **Issues**: [Report bugs](https://github.com/Amitgupta0001/SecureChannelX/issues)
- **Discussions**: [Community help](https://github.com/Amitgupta0001/SecureChannelX/discussions)

---

**🎉 Congratulations! SecureChannelX is now running in production!**

For detailed deployment guides and troubleshooting, see [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
