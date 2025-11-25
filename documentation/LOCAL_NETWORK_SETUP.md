# 🌐 How to Run SecureChannelX on Local WiFi Network

This guide explains how to run **SecureChannelX** on your main computer and access it from other devices (phones, laptops) connected to the **same WiFi network**.

---

## 1️⃣ Get Your Local IP Address
You need the local IP address of the computer running the server.

### Windows
1. Open Command Prompt (`cmd`) or PowerShell.
2. Run:
   ```powershell
   ipconfig
   ```
3. Look for **IPv4 Address** under your active adapter (Wi-Fi or Ethernet).
   *   Example: `192.168.1.10` or `10.230.255.71`
   *   *We will refer to this as `YOUR_LOCAL_IP`.*

### Mac / Linux
1. Open Terminal.
2. Run:
   ```bash
   ifconfig
   ```
3. Look for `inet` address (usually `192.168.x.x`).

---

## 2️⃣ Configure Backend

1.  Open `backend/app/app_factory.py`.
2.  Find the `cors_allowed_origins` list (around line 40 and line 78).
3.  Add your local IP address to the list so other devices are allowed to connect.

    ```python
    cors_allowed_origins = [
        "http://localhost:5173",
        "http://YOUR_LOCAL_IP:5173",  # <--- Add this (e.g., http://192.168.1.10:5173)
    ]
    ```

4.  **Restart the Backend**:
    ```bash
    cd backend
    python run.py
    ```
    *The backend listens on `0.0.0.0` by default, so it's ready to accept external connections.*

---

## 3️⃣ Configure Frontend

1.  Open `frontend/.env`.
2.  Update `VITE_API_BASE` to point to your computer's IP instead of `localhost`.

    ```env
    VITE_API_BASE=http://YOUR_LOCAL_IP:5050
    # Example: VITE_API_BASE=http://192.168.1.10:5050
    ```

3.  **Run Frontend with Host Flag**:
    You must tell Vite to expose the server to the network.

    ```bash
    cd frontend
    npm run dev -- --host
    ```

---

## 4️⃣ Access from Other Devices

1.  Connect your phone or other laptop to the **same WiFi**.
2.  Open a browser (Chrome, Safari, etc.).
3.  Go to:
    ```
    http://YOUR_LOCAL_IP:5173
    ```
    *(Example: `http://192.168.1.10:5173`)*

---

## ⚠️ Troubleshooting

*   **Firewall**: If it doesn't connect, your Windows Firewall might be blocking it.
    *   Try temporarily disabling the firewall or allowing "Python" and "Node.js" through public/private networks.
*   **Connection Refused**: Make sure both backend (`python run.py`) and frontend (`npm run dev -- --host`) are running.
*   **Mixed Content Error**: Since we are using HTTP (not HTTPS) locally, some browsers might complain. This is normal for local development.
