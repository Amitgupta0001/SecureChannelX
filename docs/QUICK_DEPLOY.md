# 🚀 Quick Deploy Buttons

One-click deployment to Vercel + Render!

---

## ☁️ Deploy to Cloud Platforms

### Option 1: Vercel (Frontend) + Render (Backend) - RECOMMENDED ⭐

**Frontend (React/Vite) → Vercel:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Amitgupta0001/SecureChannelX&project-name=securechannelx&repository-name=SecureChannelX&root-directory=frontend&env=VITE_API_BASE_URL,VITE_SOCKET_URL&envDescription=Your%20Render%20backend%20URL&envLink=https://github.com/Amitgupta0001/SecureChannelX/blob/main/docs/VERCEL_RENDER_DEPLOYMENT.md)

**Backend (Flask/Python) → Render:**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Amitgupta0001/SecureChannelX)

---

## 📋 Before You Deploy

### Required Services (All Have Free Tiers!)

1. **MongoDB Atlas** (Database)
   - Sign up: https://www.mongodb.com/cloud/atlas
   - Create free 512MB cluster
   - Get connection string

2. **Upstash Redis** (Cache)
   - Sign up: https://upstash.com
   - Create free database
   - Get Redis URL

3. **GitHub Account**
   - Fork this repository
   - Connect to Vercel and Render

---

## 🎯 Deployment Steps

### Step 1: Fork Repository

```bash
# Fork this repository on GitHub
# Or clone and push to your own repository
```

### Step 2: Setup Database & Cache

1. **MongoDB Atlas**:
   - Create cluster
   - Create database user
   - Whitelist all IPs (0.0.0.0/0)
   - Copy connection string

2. **Upstash Redis**:
   - Create database
   - Copy Redis URL

### Step 3: Deploy Frontend to Vercel

1. Click **"Deploy with Vercel"** button above
2. Connect GitHub repository
3. Set root directory: `frontend`
4. Add environment variables:
   ```
   VITE_API_BASE_URL=https://YOUR-APP.onrender.com
   VITE_SOCKET_URL=https://YOUR-APP.onrender.com
   ```
5. Deploy!

### Step 4: Deploy Backend to Render

1. Click **"Deploy to Render"** button above
2. Connect GitHub repository
3. It will use `render.yaml` configuration
4. Add environment variables:
   ```
   MONGODB_URI=<from MongoDB Atlas>
   REDIS_URL=<from Upstash>
   FRONTEND_URL=<from Vercel>
   ```
5. Deploy!

### Step 5: Update Frontend URLs

1. Go back to Vercel
2. Update environment variables with your Render URL
3. Redeploy frontend

---

## ⚙️ Environment Variables

### Frontend (Vercel)

| Variable | Example | Required |
|----------|---------|----------|
| `VITE_API_BASE_URL` | `https://app.onrender.com` | ✅ Yes |
| `VITE_SOCKET_URL` | `https://app.onrender.com` | ✅ Yes |
| `VITE_APP_NAME` | `SecureChannelX` | ⚪ Optional |
| `VITE_ENABLE_PWA` | `true` | ⚪ Optional |

### Backend (Render)

| Variable | Example | Required |
|----------|---------|----------|
| `SECRET_KEY` | Auto-generated | ✅ Yes |
| `JWT_SECRET_KEY` | Auto-generated | ✅ Yes |
| `MONGODB_URI` | `mongodb+srv://...` | ✅ Yes |
| `REDIS_URL` | `redis://...` | ✅ Yes |
| `FRONTEND_URL` | `https://app.vercel.app` | ✅ Yes |
| `MAIL_USERNAME` | `your@email.com` | ⚪ Optional |
| `MAIL_PASSWORD` | `app-password` | ⚪ Optional |

---

## 💰 Cost

| Service | Free Tier | What You Get |
|---------|-----------|--------------|
| **Vercel** | Free | 100GB bandwidth, unlimited deployments |
| **Render** | Free | 750 hours/month, 1 web service |
| **MongoDB Atlas** | Free | 512MB storage |
| **Upstash Redis** | Free | 10,000 commands/day |
| **Total** | **$0/month** | Perfect for development! |

---

## 📚 Detailed Guide

For complete step-by-step instructions, see:

**[docs/VERCEL_RENDER_DEPLOYMENT.md](VERCEL_RENDER_DEPLOYMENT.md)**

Includes:
- Detailed setup instructions
- MongoDB Atlas configuration
- Redis Cloud setup
- Environment variable guide
- Troubleshooting
- Custom domain setup

---

## ✅ Post-Deployment Checklist

- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Render
- [ ] MongoDB Atlas connected
- [ ] Redis connected
- [ ] Environment variables configured
- [ ] Health check passes: `/api/health`
- [ ] User registration works
- [ ] Login works
- [ ] Messages work
- [ ] WebSocket connects

---

## 🐛 Quick Troubleshooting

### Frontend can't connect to backend

**Check:**
1. `VITE_API_BASE_URL` is correct Render URL
2. `FRONTEND_URL` in Render matches Vercel URL
3. Both include `https://` protocol

### Database connection failed

**Check:**
1. MongoDB Atlas IP whitelist includes `0.0.0.0/0`
2. Connection string has correct password
3. Database name is in connection string

### WebSocket won't connect

**Check:**
1. `VITE_SOCKET_URL` matches backend URL
2. Render backend is running (not sleeping)
3. Browser console for errors

---

## 🔄 Auto-Deployment

Both platforms auto-deploy on git push:

```bash
git add .
git commit -m "Update feature"
git push origin main

# Automatically triggers:
# ✅ Vercel rebuilds frontend
# ✅ Render rebuilds backend
```

---

## 📞 Need Help?

1. Check [Full Deployment Guide](VERCEL_RENDER_DEPLOYMENT.md)
2. Review [Troubleshooting Section](VERCEL_RENDER_DEPLOYMENT.md#-common-issues--solutions)
3. [Open GitHub Issue](https://github.com/Amitgupta0001/SecureChannelX/issues)

---

**🎉 Happy deploying!**

Your SecureChannelX will be live in ~10 minutes!
