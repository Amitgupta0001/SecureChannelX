import os
import requests
import jwt
import logging
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gateway")

app = Flask(__name__)

# ---------------------------------------------------------
# CORS FIX
# ---------------------------------------------------------
CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:3000"]}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Type", "Authorization"]
)


@app.before_request
def allow_preflight():
    if request.method == "OPTIONS":
        return Response(status=200)


# ---------------------------------------------------------
# Microservices
# ---------------------------------------------------------
SERVICES = {
    "auth": os.getenv("AUTH_SERVICE_URL", "http://security-service:5004"),
    "chat": os.getenv("CHAT_SERVICE_URL", "http://chat-service:5002"),
    "groups": os.getenv("GROUP_SERVICE_URL", "http://chat-service:5002"),
    "messages": os.getenv("MESSAGE_SERVICE_URL", "http://chat-service:5002"),
    "security": os.getenv("SECURITY_SERVICE_URL", "http://security-service:5004"),
}

JWT_SECRET = os.getenv("JWT_SECRET", "your-gateway-secret")
JWT_ALGO = os.getenv("JWT_ALGO", "HS256")


# ---------------------------------------------------------
# Authentication
# ---------------------------------------------------------
OPEN_ROUTES = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/security/verify-2fa",
    "/health"
]


def authenticate_request():
    if request.path in OPEN_ROUTES:
        return "anonymous", None

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
# Routing rules
# ---------------------------------------------------------
def determine_service(path):

    if path.startswith("/api/auth"):
        return "auth"

    if path.startswith("/api/chats"):
        return "chat"

    if path.startswith("/api/groups"):
        return "groups"

    if path.startswith("/api/messages"):
        return "messages"

    if path.startswith("/api/security"):
        return "security"

    return None


# ---------------------------------------------------------
# Proxy
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

        response = Response(resp.content, resp.status_code)
        for h, v in resp.headers.items():
            if h.lower() not in ["content-length", "connection", "keep-alive"]:
                response.headers[h] = v

        return response

    except requests.exceptions.Timeout:
        return jsonify({"error": f"{target_service} timed out"}), 504

    except requests.exceptions.ConnectionError:
        return jsonify({"error": f"{target_service} unavailable"}), 503


# ---------------------------------------------------------
# Main Router
# ---------------------------------------------------------
@app.before_request
def route():
    if request.method == "OPTIONS":
        return None

    user_id, err = authenticate_request()
    if err:
        msg, code = err
        return jsonify({"error": msg}), code

    svc = determine_service(request.path)
    if not svc:
        return jsonify({"error": f"No route for {request.path}"}), 404

    return forward_request(svc, user_id)


# ---------------------------------------------------------
@app.route("/health")
def health():
    return jsonify({"status": "gateway OK"})


if __name__ == "__main__":
    logger.info("🚀 API Gateway running on port 5000")
    app.run(host="0.0.0.0", port=5050)
