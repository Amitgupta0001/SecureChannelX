# Redis Setup Guide for SecureChannelX

## Why Redis?
Redis provides distributed rate limiting, session caching, and better performance for production deployments.

## Installation

### Windows
```powershell
# Option 1: Using Chocolatey
choco install redis-64

# Option 2: Using Windows Subsystem for Linux (WSL)
wsl --install
# Then in WSL:
sudo apt update
sudo apt install redis-server

# Option 3: Download from GitHub
# https://github.com/microsoftarchive/redis/releases
# Download Redis-x64-3.0.504.msi and install
```

### Linux
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### macOS
```bash
brew install redis
brew services start redis
```

### Docker (Recommended for Development)
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

## Configuration

### 1. Update Backend .env
```env
# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Optional: Redis password (production)
# REDIS_URL=redis://:password@localhost:6379/0

# Optional: Redis Sentinel (high availability)
# REDIS_SENTINEL_HOSTS=localhost:26379,localhost:26380
```

### 2. Verify Redis Connection
```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis info
redis-cli info

# Monitor Redis commands (useful for debugging)
redis-cli monitor
```

### 3. Backend Integration (Already Configured!)
The backend is already set up to use Redis if available. It will:
- ✅ Use Redis if `REDIS_URL` is configured
- ✅ Fall back to in-memory storage if Redis is unavailable
- ✅ No code changes needed!

## Testing

### Test Rate Limiting with Redis
```bash
# Start Redis
redis-server

# Start backend
cd backend
python run.py

# Test rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:5050/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
  echo "Request $i"
done

# After 10 requests, you should see rate limit errors
```

### Monitor Redis Usage
```bash
# In another terminal
redis-cli monitor

# You'll see rate limit keys being created:
# "SETEX" "rl:127.0.0.1:/api/auth/login" "60" "1"
```

## Production Configuration

### Redis Security
```bash
# Edit redis.conf
sudo nano /etc/redis/redis.conf

# Set password
requirepass your-strong-password-here

# Bind to localhost only (if on same server)
bind 127.0.0.1

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""

# Restart Redis
sudo systemctl restart redis
```

### Update .env for Production
```env
REDIS_URL=redis://:your-strong-password@localhost:6379/0
```

### Redis Persistence
```bash
# Redis automatically saves data to disk
# Check persistence settings in redis.conf:

# Save after 900 seconds if at least 1 key changed
save 900 1

# Save after 300 seconds if at least 10 keys changed
save 300 10

# Save after 60 seconds if at least 10000 keys changed
save 60 10000
```

## Benefits of Redis

### Performance
- ✅ In-memory storage (extremely fast)
- ✅ Distributed rate limiting across multiple servers
- ✅ Session caching
- ✅ Reduced database load

### Scalability
- ✅ Horizontal scaling support
- ✅ Master-slave replication
- ✅ Redis Sentinel for high availability
- ✅ Redis Cluster for sharding

### Features
- ✅ Persistent rate limiting (survives server restarts)
- ✅ Shared state across multiple backend instances
- ✅ Real-time analytics
- ✅ Pub/Sub for real-time features

## Monitoring

### Redis CLI Commands
```bash
# Check memory usage
redis-cli info memory

# Check connected clients
redis-cli client list

# Check slow queries
redis-cli slowlog get 10

# Check key count
redis-cli dbsize

# Get specific key
redis-cli get "rl:127.0.0.1:/api/auth/login"
```

### Redis Desktop Manager (GUI)
- Download: https://resp.app/
- Connect to localhost:6379
- Visual interface for monitoring

## Troubleshooting

### Redis Not Starting
```bash
# Check if Redis is running
sudo systemctl status redis

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Check port availability
sudo netstat -tulpn | grep 6379
```

### Connection Refused
```bash
# Check if Redis is listening
redis-cli ping

# If fails, check firewall
sudo ufw allow 6379

# Check Redis config
redis-cli config get bind
```

### High Memory Usage
```bash
# Check memory
redis-cli info memory

# Set max memory limit in redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis
```

## Cost

### Development
- ✅ **FREE** - Run locally

### Production Options
1. **Self-Hosted**: FREE (just server costs)
2. **Redis Cloud**: FREE tier (30MB)
3. **AWS ElastiCache**: From $15/month
4. **Azure Cache for Redis**: From $16/month
5. **Google Cloud Memorystore**: From $25/month

## Summary

✅ **Installation**: 5 minutes  
✅ **Configuration**: Already done in backend  
✅ **Testing**: 2 minutes  
✅ **Production**: Optional, but recommended  

**Your backend is already Redis-ready! Just install and configure the connection string.**
