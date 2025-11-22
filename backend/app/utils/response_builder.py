# backend/app/utils/response_builder.py

from flask import jsonify, request
from datetime import datetime
import uuid


# ---------------------------------------------------------
#  Internal Helpers
# ---------------------------------------------------------

def _base_response(success: bool, message=None, data=None, status=200, error_code=None):
    """
    Standardized API response used across the backend.
    """
    return jsonify({
        "success": success,
        "message": message,
        "data": data,
        "error_code": error_code,
        "status_code": status,
        "timestamp": datetime.utcnow().isoformat(),
        "request_id": request.headers.get("X-Request-ID", str(uuid.uuid4()))
    }), status


# ---------------------------------------------------------
#  Success Responses
# ---------------------------------------------------------

def success(message="OK", data=None, status=200):
    return _base_response(
        success=True,
        message=message,
        data=data,
        status=status
    )


# ---------------------------------------------------------
#  Error Responses
# ---------------------------------------------------------

def error(message="An error occurred", status=400, error_code="GENERIC_ERROR"):
    return _base_response(
        success=False,
        message=message,
        data=None,
        status=status,
        error_code=error_code
    )


def unauthorized(message="Unauthorized", code="UNAUTHORIZED"):
    return error(message, status=401, error_code=code)


def forbidden(message="Forbidden", code="FORBIDDEN"):
    return error(message, status=403, error_code=code)


def not_found(message="Not found", code="NOT_FOUND"):
    return error(message, status=404, error_code=code)


def server_error(message="Internal server error", code="SERVER_ERROR"):
    return error(message, status=500, error_code=code)


# ---------------------------------------------------------
#  Pagination Response
# ---------------------------------------------------------

def paginated(data, page, per_page, total_count, message="OK"):
    total_pages = (total_count + per_page - 1) // per_page

    return success(
        message=message,
        data={
            "items": data,
            "page": page,
            "per_page": per_page,
            "total": total_count,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    )
