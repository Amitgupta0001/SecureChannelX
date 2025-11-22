# gateway/app.py

import os
import requests
import jwt
import logging
from flask import Flask, request, jsonify, Response

# ---------------------------------------------------------
#  Logging
# ---------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gateway")

app = Flask(__name__)

# ---------------------------------------------------------
#  Microservice Map
# ---------------------------------------------------------
SERVICES = {
    "user": os.getenv("USER_SERVICE_URL", "http://user-service:5001"),
    "chat": os.getenv("CHAT_SERVICE_URL", "http://chat-service:5002"),
    "analytics": os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:5003"),
    "security": os.getenv("SECURITY_SERVICE_URL", "http://security-service:5004"),
}

JWT_SECRET = os.getenv("JWT_SECRET", "your-gateway-secret")
JWT_ALGO = os.getenv("JWT_ALGO", "HS256")

# ---------------------------------------------------------
#  Authentication
# ---------------------------------------------------------
def authenticate_request():
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None, ("Missing or invalid Authorization header", 401)

    token = auth.split(" ")[1]

    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return decoded["sub"], None
    except Exception as e:
        logger.error(f"JWT decode failed: {e}")
        return None, ("Invalid token", 401)

# ---------------------------------------------------------
#  Routing Logic
# ---------------------------------------------------------
def determine_service(path):
    if path.startswith("/api/users"):
        return "user"
    if path.startswith("/api/messages") or path.startswith("/api/chat"):
        return "chat"
    if path.startswith("/api/analytics"):
        return "analytics"
    if path.startswith("/api/security"):
        return "security"
    return None

# ---------------------------------------------------------
#  HTTP Proxy Forwarder
# ---------------------------------------------------------
def forward_request(target_service, user_id):
    svc_url = SERVICES[target_service] + request.path
    logger.info(f"[GATEWAY] → {svc_url}")

    try:
        resp = requests.request(
            method=request.method,
            url=svc_url,
            headers={k: v for k, v in request.headers if k.lower() != "host"},
            params=request.args,
            data=request.get_data(),
            cookies=request.cookies,
            timeout=5,
            allow_redirects=False
        )
        return Response(resp.content, resp.status_code, resp.headers.items())

    except requests.exceptions.Timeout:
        return jsonify({"error": f"{target_service} timed out"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": f"{target_service} unavailable"}), 503

# ---------------------------------------------------------
#  BEFORE REQUEST - Authentication + Routing
# ---------------------------------------------------------
@app.before_request
def gateway_router():
    if request.path in ["/health", "/favicon.ico"]:
        return None

    user_id, err = authenticate_request()
    if err:
        msg, code = err
        return jsonify({"error": msg}), code

    svc = determine_service(request.path)
    
    if not svc:
        return jsonify({"error": "Unknown service"}), 404

    request.user_id = user_id  # pass-through attribute
    return forward_request(svc, user_id)

# ---------------------------------------------------------
#  Health Check
# ---------------------------------------------------------
@app.route("/health")
def health():
    return jsonify({"status": "healthy", "service": "api-gateway"})

# ---------------------------------------------------------
#  Main
# ---------------------------------------------------------
if __name__ == "__main__":
    logger.info("🚀 API Gateway running on port 5000")
    app.run(host="0.0.0.0", port=5000)
