# Deployment Guide for SecureChannelX

This guide explains how to host your **SecureChannelX** application on the cloud using GitHub. We will use **Render** for the backend (Python/Flask) and **Vercel** for the frontend (React/Vite), as they offer excellent free tiers and seamless GitHub integration.

## Prerequisites

1.  **GitHub Account**: Ensure your project is pushed to a GitHub repository.
2.  **MongoDB Atlas Account**: You need a cloud-hosted MongoDB database.
    *   Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
    *   Create a free cluster.
    *   Get your **Connection String** (e.g., `mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority`).
    *   **Important**: Allow access from anywhere (IP `0.0.0.0/0`) in Network Access for cloud hosting.

---

## Part 1: Backend Deployment (Render)

1.  **Sign Up/Login**: Go to [Render](https://render.com/) and log in with GitHub.
2.  **New Web Service**: Click "New +" -> "Web Service".
3.  **Connect Repo**: Select your `SecureChannelX` repository.
4.  **Configure Service**:
    *   **Name**: `securechannelx-backend` (or similar)
    *   **Region**: Choose one close to you (e.g., Singapore, Frankfurt).
    *   **Branch**: `main` (or your working branch).
    *   **Root Directory**: `backend` (Important! This tells Render where your python code is).
    *   **Runtime**: `Python 3`.
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `gunicorn run:app` (Ensure `gunicorn` is in your `requirements.txt`. If not, add it).
5.  **Environment Variables**:
    *   Scroll down to "Environment Variables".
    *   Add `MONGO_URI`: Paste your MongoDB Atlas connection string.
    *   Add `JWT_SECRET_KEY`: Set a strong secret key.
    *   Add `FLASK_APP`: `run.py`
    *   Add `FLASK_ENV`: `production`
    *   Add `FRONTEND_URL`: You will add this later after deploying the frontend (e.g., `https://securechannelx.vercel.app`).
6.  **Deploy**: Click "Create Web Service".
7.  **Copy URL**: Once deployed, copy your backend URL (e.g., `https://securechannelx-backend.onrender.com`).

---

## Part 2: Frontend Deployment (Vercel)

1.  **Sign Up/Login**: Go to [Vercel](https://vercel.com/) and log in with GitHub.
2.  **Add New Project**: Click "Add New..." -> "Project".
3.  **Import Repo**: Import your `SecureChannelX` repository.
4.  **Configure Project**:
    *   **Framework Preset**: It should auto-detect `Vite`.
    *   **Root Directory**: Click "Edit" and select `frontend`.
5.  **Environment Variables**:
    *   Expand "Environment Variables".
    *   Add `VITE_API_URL`: Paste your **Backend URL** from Part 1 (e.g., `https://securechannelx-backend.onrender.com`).
    *   *Note: Ensure your frontend code uses this variable (e.g., `import.meta.env.VITE_API_URL`) instead of hardcoded `localhost`.*
6.  **Deploy**: Click "Deploy".
7.  **Copy URL**: Once finished, you will get a domain like `https://securechannelx.vercel.app`.

---

## Part 3: Final Configuration

1.  **Update Backend CORS**:
    *   Go back to your Render Dashboard -> Environment Variables.
    *   Update/Add `FRONTEND_URL` with your new Vercel URL (e.g., `https://securechannelx.vercel.app`).
    *   *Ensure your Flask app's CORS configuration allows this origin.*

2.  **Test**: Open your Vercel URL and try to log in/register.

## Troubleshooting

*   **CORS Errors**: Check browser console. If you see CORS errors, ensure the backend `CORS` setup includes your Vercel domain.
*   **Socket.IO Connection**: Ensure your Socket.IO client in React connects to the `VITE_API_URL`.
*   **Database Connection**: Check Render logs to see if MongoDB connected successfully.
