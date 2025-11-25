import sys
import os
import json
import time
import uuid
import requests
import socketio

# Configuration
BASE_URL = "http://localhost:5050"
API_URL = f"{BASE_URL}/api"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

def log(msg, color=RESET):
    print(f"{color}{msg}{RESET}")

def run_test():
    log("🚀 Starting Backend Verification Test...", GREEN)

    # 1. Register a User
    username = f"testuser_{uuid.uuid4().hex[:8]}"
    email = f"{username}@example.com"
    password = "TestPassword123!"

    log(f"1. Registering user: {username}...")
    try:
        res = requests.post(f"{API_URL}/auth/register", json={
            "username": username,
            "email": email,
            "password": password
        })
        if res.status_code != 200:
            log(f"❌ Registration failed: {res.text}", RED)
            return
        user_id = res.json()["data"]["user_id"]
        log(f"✅ Registered with ID: {user_id}", GREEN)
    except Exception as e:
        log(f"❌ Connection failed: {e}", RED)
        return

    # 2. Login
    log("2. Logging in...")
    res = requests.post(f"{API_URL}/auth/login", json={
        "username": username,
        "password": password
    })
    if res.status_code != 200:
        log(f"❌ Login failed: {res.text}", RED)
        return
    
    token = res.json()["data"]["access_token"]
    log("✅ Login successful, token received", GREEN)

    # 3. Create a Chat (Self-Chat for simplicity)
    # We need a chat_id to send a message.
    # Let's try to create a chat with ourselves or just use a dummy ID if the backend allows?
    # Usually we need a valid chat. Let's register a second user.
    
    username2 = f"testuser_{uuid.uuid4().hex[:8]}"
    email2 = f"{username2}@example.com"
    requests.post(f"{API_URL}/auth/register", json={
        "username": username2,
        "email": email2,
        "password": password
    })
    # Get user2 ID? We need to search for them or just know it.
    # Let's search or just use the ID returned.
    res2 = requests.post(f"{API_URL}/auth/login", json={"username": username2, "password": password})
    user2_id = res2.json()["data"]["user"]["id"]

    log(f"3. Creating chat with {username2} ({user2_id})...")
    # Assuming there is a create chat route. Let's check chats.py later, but usually POST /api/chats
    # Headers with token
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.post(f"{API_URL}/chats", json={"partner_id": user2_id}, headers=headers)
    
    if res.status_code not in [200, 201]:
        log(f"❌ Create chat failed: {res.text}", RED)
        # Fallback: maybe the route is different?
        return

    chat_id = res.json()["data"]["chat_id"]
    log(f"✅ Chat created: {chat_id}", GREEN)

    # 4. Connect Socket
    log("4. Connecting to Socket.IO...")
    sio = socketio.Client()

    received_events = []

    @sio.on('connect')
    def on_connect():
        log("✅ Socket connected!", GREEN)

    @sio.on('message:new')
    def on_message(data):
        log(f"📩 Message received: {data}", GREEN)
        received_events.append(data)

    @sio.on('error')
    def on_error(data):
        log(f"❌ Socket error: {data}", RED)

    try:
        # Pass token in auth or headers? Flask-SocketIO usually looks in query or auth
        # Based on auth.py: verify_jwt_in_request() checks headers.
        # SocketIO client sends extra_headers
        sio.connect(BASE_URL, headers={"Authorization": f"Bearer {token}"}, wait_timeout=5)
    except Exception as e:
        log(f"❌ Socket connection failed: {e}", RED)
        return

    # 5. Send Message
    log("5. Sending encrypted message...")
    encrypted_payload = {
        "iv": "dummy_iv",
        "ciphertext": "dummy_ciphertext_base64",
        "authTag": "dummy_tag"
    }
    
    sio.emit("message:send", {
        "chat_id": chat_id,
        "content": encrypted_payload,
        "message_type": "text"
    })

    # Wait for response
    time.sleep(2)

    # 6. Verify
    if len(received_events) > 0:
        msg = received_events[0]["message"]
        if msg["encrypted_content"]["ciphertext"] == "dummy_ciphertext_base64":
            log("✅ VERIFICATION SUCCESSFUL: Message sent and received correctly.", GREEN)
        else:
            log("❌ Content mismatch", RED)
    else:
        log("❌ No message received back", RED)

    sio.disconnect()

if __name__ == "__main__":
    try:
        import requests
    except ImportError:
        print("Installing requests...")
        os.system("pip install requests")
        import requests
        
    run_test()
