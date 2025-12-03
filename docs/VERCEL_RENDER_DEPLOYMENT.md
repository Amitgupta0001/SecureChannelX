# 🚀 Deploy SecureChannelX to Vercel + Render

Complete guide for deploying SecureChannelX with:
- **Frontend**: Vercel (React/Vite)
- **Backend**: Render (Flask/Python)
- **Database**: MongoDB Atlas (Cloud)
- **Cache**: Redis Cloud (Upstash)

---

## ✅ Can You Deploy to Vercel + Render?

**YES!** This is actually an excellent deployment strategy:

| Component | Platform | Why It's Great |
|-----------|----------|----------------|
| **Frontend** | Vercel | ✅ Perfect for React/Vite, CDN, auto-deploy |
| **Backend** | Render | ✅ Free tier, Docker support, auto-deploy |
| **Database** | MongoDB Atlas | ✅ Free 512MB, managed, global |
| **Cache** | Redis Cloud (Upstash) | ✅ Free tier, serverless |

---

## 📋 Prerequisites

Before you start:
- [x] GitHub account
- [x] Vercel account (free)
- [x] Render account (free)
- [x] MongoDB Atlas account (free)
- [x] Upstash account (free for Redis)

---

## 🗂️ Step 1: Prepare for GitHub

### 1.1 Update .gitignore

Your `.gitignore` already excludes sensitive files, but verify:

```bash
# Check .gitignore includes:
cat .gitignore | grep -E "\.env|node_modules|venv|__pycache__"
```

**Must be gitignored:**
- `.env` files
- `node_modules/`
- `venv/`
- `__pycache__/`
- `*.pyc`
- `uploads/`
- `group_media/`

### 1.2 Remove Sensitive Data

```powershell
# Remove any .env files from git history (if previously committed)
git rm --cached .env backend/.env frontend/.env -f
git rm --cached backend/.env.production -f

# Commit changes
git add .gitignore
git commit -m "Update gitignore for deployment"
```

### 1.3 Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for deployment to Vercel and Render"

# Create repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/SecureChannelX.git
git branch -M main
git push -u origin main
```

---

## 🗄️ Step 2: Setup MongoDB Atlas (Database)

### 2.1 Create Free Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up / Log in
3. Click **"Build a Database"**
4. Select **FREE** tier (M0)
5. Choose region closest to users
6. Name cluster: `securechannelx-cluster`

### 2.2 Create Database User

1. Go to **Database Access**
2. Click **"Add New Database User"**
3. Choose **Password** authentication
4. Username: `securechannelx`
5. Password: Generate strong password (save it!)
6. User Privileges: **Read and write to any database**
7. Click **Add User**

### 2.3 Whitelist IP Addresses

1. Go to **Network Access**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - Required for Render/Vercel
4. Click **Confirm**

### 2.4 Get Connection String

1. Go to **Database** → **Connect**
2. Choose **"Connect your application"**
3. Copy connection string:
   ```
   mongodb+srv://securechannelx:<password>@securechannelx-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password
5. Add database name: `...net/securechannelx?retryWrites...`

**Final format:**
```
mongodb+srv://securechannelx:YOUR_PASSWORD@cluster.xxxxx.mongodb.net/securechannelx?retryWrites=true&w=majority
```

---

## 🔴 Step 3: Setup Redis Cloud (Upstash)

### 3.1 Create Free Database

1. Go to [Upstash](https://upstash.com/)
2. Sign up / Log in
3. Click **"Create Database"**
4. Choose **Redis**
5. Name: `securechannelx-redis`
6. Type: **Regional**
7. Region: Same as your backend
8. Click **Create**

### 3.2 Get Connection String

1. Click on your database
2. Copy **REST URL** or **Redis URL**
3. Format: `redis://default:PASSWORD@endpoint:PORT`

Example:
```
redis://default:AX_PASSWORD_HERE@region.upstash.io:6379
```

---

## 🎨 Step 4: Deploy Frontend to Vercel

### 4.1 Connect GitHub to Vercel

1. Go to [Vercel](https://vercel.com/)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Select **`SecureChannelX`** repository

### 4.2 Configure Build Settings

**Framework Preset:** Vite
**Root Directory:** `frontend`
**Build Command:** `npm run build`
**Output Directory:** `dist`
**Install Command:** `npm install`

### 4.3 Add Environment Variables

Click **"Environment Variables"** and add:

```env
VITE_API_BASE_URL=https://securechannelx-api.onrender.com
VITE_SOCKET_URL=https://securechannelx-api.onrender.com
VITE_APP_NAME=SecureChannelX
VITE_ENABLE_PWA=true
```

⚠️ **Replace `securechannelx-api` with your actual Render service name**

### 4.4 Deploy

1. Click **"Deploy"**
2. Wait for deployment (~2 minutes)
3. Get your URL: `https://securechannelx.vercel.app`

---

## 🖥️ Step 5: Deploy Backend to Render

### 5.1 Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select **`SecureChannelX`** repository

### 5.2 Configure Service

**Name:** `securechannelx-api`
**Region:** Same as MongoDB/Redis
**Branch:** `main`
**Root Directory:** `backend`
**Runtime:** `Python 3`
**Build Command:** `pip install -r requirements.txt`
**Start Command:** `gunicorn -w 4 -b 0.0.0.0:$PORT --worker-class eventlet run:app`

### 5.3 Add Environment Variables

Click **"Environment"** and add ALL of these:

```env
# Python
PYTHON_VERSION=3.11

# Flask
FLASK_ENV=production
FLASK_DEBUG=false
SECRET_KEY=<GENERATE_STRONG_SECRET>
JWT_SECRET_KEY=<GENERATE_STRONG_SECRET>

# Database (from MongoDB Atlas)
MONGODB_URI=mongodb+srv://securechannelx:PASSWORD@cluster.xxxxx.mongodb.net/securechannelx?retryWrites=true&w=majority

# Redis (from Upstash)
REDIS_URL=redis://default:PASSWORD@endpoint.upstash.io:6379

# CORS (from Vercel)
FRONTEND_URL=https://securechannelx.vercel.app

# Email (Optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_USE_TLS=true

# File Upload
MAX_CONTENT_LENGTH=104857600
```

**Generate secrets with:**
```powershell
# Run this to generate secrets
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 5.4 Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (~5 minutes)
3. Get your URL: `https://securechannelx-api.onrender.com`

---

## 🔗 Step 6: Update Frontend URLs

### 6.1 Update Vercel Environment Variables

Go back to Vercel → Your Project → Settings → Environment Variables

Update these with your **actual Render URL**:

```env
VITE_API_BASE_URL=https://YOUR-RENDER-APP.onrender.com
VITE_SOCKET_URL=https://YOUR-RENDER-APP.onrender.com
```

### 6.2 Redeploy Frontend

1. Go to **Deployments** tab
2. Click **"Redeploy"** on latest deployment
3. Or push a new commit to trigger auto-deploy

---

## ✅ Step 7: Verify Deployment

### 7.1 Check Backend

```bash
# Health check
curl https://YOUR-RENDER-APP.onrender.com/api/health

# Should return:
# {"status":"healthy","checks":{"database":{"status":"healthy"}}}
```

### 7.2 Check Frontend

Visit: `https://YOUR-VERCEL-APP.vercel.app`

Should see:
- ✅ Login page loads
- ✅ Can register user
- ✅ Can send messages
- ✅ WebSocket connects

### 7.3 Test Features

1. **Register** a new account
2. **Login** successfully
3. **Create** a chat
4. **Send** a message
5. **Upload** a file (if cloud storage configured)

---

## ⚙️ Additional Configuration

### File Uploads (Required for Production)

Render's filesystem is ephemeral. Use cloud storage:

#### Option 1: AWS S3

Add to Render environment variables:
```env
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=securechannelx-uploads
AWS_REGION=us-east-1
```

#### Option 2: Azure Blob Storage

```env
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_CONTAINER_NAME=securechannelx-uploads
```

### Custom Domain (Optional)

#### Vercel:
1. Go to **Settings** → **Domains**
2. Add your domain
3. Update DNS records

#### Render:
1. Go to **Settings** → **Custom Domain**
2. Add your domain
3. Update DNS records

---

## 🔒 Security Checklist

Before going live:

- [ ] Change all default passwords
- [ ] Generate strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Use HTTPS URLs everywhere
- [ ] Configure CORS properly (only allow your frontend URL)
- [ ] Enable 2FA for MongoDB Atlas
- [ ] Enable 2FA for Render account
- [ ] Review security logs
- [ ] Set up monitoring alerts

---

## 💰 Cost Breakdown

| Service | Free Tier | What You Get |
|---------|-----------|--------------|
| **Vercel** | 100GB bandwidth/month | Unlimited deployments |
| **Render** | 750 hours/month | 1 web service |
| **MongoDB Atlas** | 512MB storage | Shared cluster |
| **Upstash Redis** | 10,000 commands/day | Serverless Redis |
| **Total** | **$0/month** | Perfect for development |

### Scaling Costs:
- **Render**: $7/month for always-on
- **MongoDB Atlas**: $9/month for 2GB
- **Upstash Redis**: $10/month for 1GB
- **Total**: ~$26/month for production

---

## 🐛 Common Issues & Solutions

### Issue 1: CORS Errors

**Error:** `Access to fetch blocked by CORS policy`

**Solution:**
1. Check `FRONTEND_URL` in Render environment variables
2. Make sure it matches your Vercel URL exactly
3. Include protocol: `https://`
4. Redeploy backend

### Issue 2: Database Connection Failed

**Error:** `MongoServerError: Authentication failed`

**Solution:**
1. Verify MongoDB Atlas username/password
2. Check IP whitelist includes `0.0.0.0/0`
3. Verify connection string format
4. Check database name in connection string

### Issue 3: WebSocket Connection Failed

**Error:** `WebSocket connection failed`

**Solution:**
1. Render supports WebSockets on all plans
2. Check `VITE_SOCKET_URL` matches backend URL
3. Verify Socket.IO configuration
4. Check browser console for errors

### Issue 4: File Upload Fails

**Error:** `File upload failed`

**Solution:**
1. Configure S3 or Azure Blob Storage
2. Render filesystem is ephemeral
3. Files will be lost on restart without cloud storage
4. Update environment variables

### Issue 5: Render Service Sleeps

**Issue:** Free tier sleeps after 15 min inactivity

**Solutions:**
1. Upgrade to paid plan ($7/month)
2. Use a cron job to ping every 10 minutes
3. Use UptimeRobot for monitoring (keeps it awake)

---

## 🔄 Auto-Deployment Setup

Both platforms support auto-deployment:

### Vercel:
- ✅ Automatically deploys on push to `main`
- ✅ Preview deployments for PRs
- ✅ Instant rollback

### Render:
- ✅ Automatically deploys on push to `main`
- ✅ Can configure deploy hooks
- ✅ Manual deploys available

**Workflow:**
```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# Automatic deployment triggers:
# 1. Vercel rebuilds frontend (~2 min)
# 2. Render rebuilds backend (~5 min)
```

---

## 📊 Monitoring & Logs

### Vercel Logs:
1. Go to project → **Deployments**
2. Click deployment → **View Function Logs**
3. Real-time logs available

### Render Logs:
1. Go to service → **Logs** tab
2. Real-time streaming logs
3. Filter by time range

### MongoDB Atlas Logs:
1. Go to cluster → **Metrics**
2. View performance metrics
3. Set up alerts

---

## 🎯 Next Steps After Deployment

1. **Custom Domain**
   - Configure on Vercel and Render
   - Update environment variables

2. **SSL Certificate**
   - Automatic with Vercel
   - Automatic with Render
   - Free Let's Encrypt

3. **Monitoring**
   - Set up Sentry for error tracking
   - Configure uptime monitoring
   - Set up performance monitoring

4. **Backups**
   - MongoDB Atlas automatic backups
   - Cloud storage for files
   - Regular database exports

5. **Scaling**
   - Monitor usage metrics
   - Upgrade tiers as needed
   - Optimize performance

---

## 📚 Helpful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
- [Upstash Redis Docs](https://docs.upstash.com/redis)

---

## ✅ Deployment Checklist

### Pre-Deployment:
- [ ] Code pushed to GitHub
- [ ] .env files gitignored
- [ ] MongoDB Atlas cluster created
- [ ] Redis Cloud database created

### Vercel (Frontend):
- [ ] Repository connected
- [ ] Build settings configured
- [ ] Environment variables added
- [ ] Deployment successful
- [ ] Frontend accessible

### Render (Backend):
- [ ] Repository connected
- [ ] Build/start commands configured
- [ ] All environment variables added
- [ ] Deployment successful
- [ ] Health check passing

### Post-Deployment:
- [ ] Frontend URLs updated
- [ ] Backend health check passes
- [ ] User registration works
- [ ] Login works
- [ ] Messages send/receive
- [ ] WebSocket connects

---

**🎉 You're all set! Your SecureChannelX is now live on Vercel + Render!**

Access your app at: `https://your-app.vercel.app`
