"""
SecureChannelX Response Builder
-------------------------------
Standardized API responses for the application.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from flask import jsonify, request
from http import HTTPStatus

logger = logging.getLogger(__name__)

class ResponseBuilder:
    """✅ ENHANCED: Fluent API for building responses"""
    
    def __init__(self):
        self.data = {
            "success": True,
            "message": "OK",
            "data": None,
            "errors": [],
            "error_code": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request.headers.get("X-Request-ID", str(uuid.uuid4()))
        }
        self.status_code = HTTPStatus.OK
    
    def success(self, message: str = "OK") -> "ResponseBuilder":
        """Set success state"""
        self.data["success"] = True
        self.data["message"] = message
        self.data["error_code"] = None
        self.data["errors"] = []
        return self
    
    def error(self, message: str, error_code: str = "GENERIC_ERROR", errors: List[str] = None) -> "ResponseBuilder":
        """Set error state"""
        self.data["success"] = False
        self.data["message"] = message
        self.data["error_code"] = error_code
        self.data["errors"] = errors or []
        return self
    
    def with_data(self, data: Any) -> "ResponseBuilder":
        """Set response data"""
        self.data["data"] = data
        return self
    
    def with_status(self, status_code: int) -> "ResponseBuilder":
        """Set HTTP status code"""
        self.status_code = status_code
        self.data["status_code"] = status_code
        return self
    
    def with_message(self, message: str) -> "ResponseBuilder":
        """Set message"""
        self.data["message"] = message
        return self
    
    def with_errors(self, errors: List[str]) -> "ResponseBuilder":
        """Set error list"""
        self.data["errors"] = errors
        return self
    
    def build(self) -> Tuple[Dict, int]:
        """Build response dictionary and status code"""
        return self.data, self.status_code
    
    def as_response(self):
        """Build Flask response"""
        data, status = self.build()
        return jsonify(data), status


# ============================================================
#                   HELPER FUNCTIONS
# ============================================================

def success(
    message: str = "OK",
    data: Any = None,
    status: int = HTTPStatus.OK
) -> Tuple[Any, int]:
    """Standard success response"""
    return ResponseBuilder().success(message).with_data(data).with_status(status).as_response()

def created(
    message: str = "Resource created successfully",
    data: Any = None
) -> Tuple[Any, int]:
    """Created response (201)"""
    return ResponseBuilder().success(message).with_data(data).with_status(HTTPStatus.CREATED).as_response()

def error(
    message: str = "An error occurred",
    status: int = HTTPStatus.BAD_REQUEST,
    error_code: str = "GENERIC_ERROR",
    errors: List[str] = None
) -> Tuple[Any, int]:
    """Standard error response"""
    return ResponseBuilder().error(message, error_code, errors).with_status(status).as_response()

def bad_request(
    message: str = "Bad request",
    error_code: str = "BAD_REQUEST",
    errors: List[str] = None
) -> Tuple[Any, int]:
    """Bad request error (400)"""
    return error(message, HTTPStatus.BAD_REQUEST, error_code, errors)

def unauthorized(
    message: str = "Unauthorized",
    error_code: str = "UNAUTHORIZED"
) -> Tuple[Any, int]:
    """Unauthorized error (401)"""
    return error(message, HTTPStatus.UNAUTHORIZED, error_code)

def forbidden(
    message: str = "Forbidden",
    error_code: str = "FORBIDDEN"
) -> Tuple[Any, int]:
    """Forbidden error (403)"""
    return error(message, HTTPStatus.FORBIDDEN, error_code)

def not_found(
    message: str = "Resource not found",
    error_code: str = "NOT_FOUND"
) -> Tuple[Any, int]:
    """Not found error (404)"""
    return error(message, HTTPStatus.NOT_FOUND, error_code)

def conflict(
    message: str = "Resource conflict",
    error_code: str = "CONFLICT"
) -> Tuple[Any, int]:
    """Conflict error (409)"""
    return error(message, HTTPStatus.CONFLICT, error_code)

def server_error(
    message: str = "Internal server error",
    error_code: str = "INTERNAL_ERROR"
) -> Tuple[Any, int]:
    """Internal server error (500)"""
    return error(message, HTTPStatus.INTERNAL_SERVER_ERROR, error_code)
