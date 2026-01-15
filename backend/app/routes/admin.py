from flask import Blueprint, request, abort, current_app
from app.database import get_db
from app.utils.helpers import now_utc

bp = Blueprint("admin_honeypot", __name__)

@bp.route("/admin/phpmyadmin")
@bp.route("/wp-admin")
@bp.route("/sql")
@bp.route("/db")
def honeypot():
    """
    🚨 HONEYPOT ROUTE
    Any IP accessing these routes is malicious.
    Instant IP Ban.
    """
    ip = request.remote_addr
    db = get_db()
    
    current_app.logger.warning(f"🚨 [HONEYPOT TRIPPED] IP: {ip} tried to access {request.path}")
    
    # Ban IP
    db.blacklist_ips.insert_one({
        "ip": ip,
        "reason": "Honeypot access",
        "timestamp": now_utc(),
        "path": request.path
    })
    
    # Return fake 404 to confuse scanner
    abort(404)
