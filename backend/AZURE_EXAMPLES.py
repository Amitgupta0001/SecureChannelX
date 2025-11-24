"""
Example usage of Azure services in SecureChannelX
This file demonstrates how to use the Azure integrations in your routes and services.
"""

# ============================================================
# EXAMPLE 1: Using Azure Key Vault for Secrets
# ============================================================

from app.utils.azure_key_vault import get_secret, set_secret

# Get JWT secret from Key Vault (falls back to .env if not available)
jwt_secret = get_secret("JWT-SECRET-KEY", default=os.getenv("JWT_SECRET_KEY"))

# Store a new secret
api_key = "sk-1234567890"
set_secret("OPENAI-API-KEY", api_key)


# ============================================================
# EXAMPLE 2: Tracking Events with Application Insights
# ============================================================

from app.utils.azure_monitoring import track_event, track_exception, track_metric

# In your auth route
@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        # ... login logic ...
        
        # Track successful login
        track_event("UserLogin", {
            "user_id": user.id,
            "method": "password",
            "success": True
        })
        
        return success({"token": token})
        
    except Exception as e:
        # Track failed login
        track_exception(e, {
            "endpoint": "/login",
            "user_email": request.json.get("email")
        })
        return error("Login failed", 401)


# Track custom metrics
@messages_bp.route("/send", methods=["POST"])
def send_message():
    start_time = time.time()
    
    # ... message sending logic ...
    
    # Track message send latency
    duration_ms = (time.time() - start_time) * 1000
    track_metric("MessageSendLatency", duration_ms, {
        "chat_type": chat.chat_type,
        "encrypted": True
    })
    
    return success({"message": message})


# ============================================================
# EXAMPLE 3: Using Azure Blob Storage for File Uploads
# ============================================================

from app.utils.azure_blob_storage import upload_file, download_file, generate_download_url
from werkzeug.utils import secure_filename
import uuid

@file_upload_bp.route("/upload", methods=["POST"])
def upload_attachment():
    try:
        file = request.files.get("file")
        if not file:
            return error("No file provided", 400)
        
        # Generate unique filename
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        
        # Read file data
        file_data = file.read()
        content_type = file.content_type or "application/octet-stream"
        
        # Upload to Azure Blob Storage (or local filesystem as fallback)
        file_url = upload_file(file_data, unique_filename, content_type)
        
        if not file_url:
            return error("File upload failed", 500)
        
        # Track upload event
        track_event("FileUploaded", {
            "filename": filename,
            "size_bytes": len(file_data),
            "content_type": content_type,
            "storage": "azure" if blob_storage_service.enabled else "local"
        })
        
        return success({
            "file_url": file_url,
            "filename": unique_filename
        })
        
    except Exception as e:
        track_exception(e, {"endpoint": "/upload"})
        return error("Upload failed", 500)


@file_upload_bp.route("/download/<filename>", methods=["GET"])
def download_attachment(filename):
    try:
        # Generate temporary download URL (valid for 1 hour)
        download_url = generate_download_url(filename, expiry_hours=1)
        
        if not download_url:
            return error("File not found", 404)
        
        # Track download event
        track_event("FileDownloaded", {
            "filename": filename
        })
        
        # Redirect to download URL
        return redirect(download_url)
        
    except Exception as e:
        track_exception(e, {"endpoint": "/download"})
        return error("Download failed", 500)


# ============================================================
# EXAMPLE 4: Tracking Database Operations
# ============================================================

from app.utils.azure_monitoring import track_dependency
import time

def get_user_from_db(user_id):
    start_time = time.time()
    success = False
    
    try:
        user = db.users.find_one({"_id": user_id})
        success = True
        return user
    finally:
        duration_ms = (time.time() - start_time) * 1000
        track_dependency(
            dependency_type="MongoDB",
            target="users_collection",
            name="find_one",
            duration_ms=duration_ms,
            success=success
        )


# ============================================================
# EXAMPLE 5: Frontend Integration
# ============================================================

"""
// In your React components (frontend/src/components/ChatWindow.jsx)

import { trackEvent, trackException, trackUserAction } from '../utils/azureMonitoring';

const ChatWindow = () => {
  const sendMessage = async (message) => {
    try {
      // Track user action
      trackUserAction('click', 'send_message_button', {
        message_length: message.length,
        chat_type: chat.chat_type
      });
      
      const response = await messageApi.sendMessage(chatId, message);
      
      // Track successful message send
      trackEvent('MessageSent', {
        chat_id: chatId,
        encrypted: true,
        message_length: message.length
      });
      
    } catch (error) {
      // Track error
      trackException(error, {
        action: 'send_message',
        chat_id: chatId
      });
    }
  };
  
  return (
    // ... component JSX ...
  );
};
"""


# ============================================================
# EXAMPLE 6: User Context Tracking
# ============================================================

"""
// Set user context after login (frontend/src/contexts/AuthContext.jsx)

import { setAuthenticatedUserContext, clearAuthenticatedUserContext } from '../utils/azureMonitoring';

const login = async (credentials) => {
  const response = await authApi.login(credentials);
  const user = response.user;
  
  // Set user context for all telemetry
  setAuthenticatedUserContext(user.user_id, user.organization_id);
  
  // Track login event
  trackEvent('UserLoggedIn', {
    user_id: user.user_id,
    method: 'password'
  });
};

const logout = () => {
  // Clear user context
  clearAuthenticatedUserContext();
  
  trackEvent('UserLoggedOut');
};
"""


# ============================================================
# EXAMPLE 7: Performance Monitoring
# ============================================================

from app.utils.azure_monitoring import track_request
from functools import wraps
import time

def monitor_performance(f):
    """Decorator to monitor route performance"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()
        success = False
        response_code = 500
        
        try:
            result = f(*args, **kwargs)
            response_code = result[1] if isinstance(result, tuple) else 200
            success = 200 <= response_code < 400
            return result
        finally:
            duration_ms = (time.time() - start_time) * 1000
            track_request(
                name=f.__name__,
                url=request.url,
                duration_ms=duration_ms,
                response_code=response_code,
                success=success
            )
    
    return decorated_function


# Use the decorator
@messages_bp.route("/messages/<chat_id>", methods=["GET"])
@monitor_performance
def get_messages(chat_id):
    # ... route logic ...
    return success({"messages": messages})
