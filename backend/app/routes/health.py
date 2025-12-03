"""
Health Check and Monitoring Routes
"""

from flask import Blueprint, jsonify
import os
from datetime import datetime
from app.database import get_db

health_bp = Blueprint('health', __name__)


@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for monitoring and load balancers
    Returns 200 if all systems are operational
    """
    health_status = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '2.0.0',
        'environment': os.getenv('FLASK_ENV', 'development'),
        'checks': {}
    }
    
    all_healthy = True
    
    # Database check
    try:
        db = get_db()
        db.command('ping')
        health_status['checks']['database'] = {
            'status': 'healthy',
            'type': 'mongodb'
        }
    except Exception as e:
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        all_healthy = False
    
    # Redis check
    try:
        from app.utils.redis_client import get_redis_client
        redis_client = get_redis_client()
        if redis_client.is_redis:
            redis_client.set('health_check', '1', ex=10)
            health_status['checks']['redis'] = {
                'status': 'healthy',
                'type': 'redis'
            }
        else:
            health_status['checks']['redis'] = {
                'status': 'fallback',
                'type': 'memory'
            }
    except Exception as e:
        health_status['checks']['redis'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        # Redis is optional, don't mark as unhealthy
    
    # Set overall status
    if not all_healthy:
        health_status['status'] = 'unhealthy'
        return jsonify(health_status), 503
    
    return jsonify(health_status), 200


@health_bp.route('/ready', methods=['GET'])
def readiness_check():
    """
    Readiness check for Kubernetes
    Returns 200 when application is ready to serve traffic
    """
    try:
        # Check if database is accessible
        db = get_db()
        db.command('ping')
        
        return jsonify({
            'status': 'ready',
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'not ready',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503


@health_bp.route('/live', methods=['GET'])
def liveness_check():
    """
    Liveness check for Kubernetes
    Returns 200 if application is alive
    """
    return jsonify({
        'status': 'alive',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@health_bp.route('/metrics', methods=['GET'])
def metrics():
    """
    Basic metrics endpoint
    Can be extended with Prometheus metrics
    """
    try:
        # Database stats
        db = get_db()
        stats = {
            'timestamp': datetime.utcnow().isoformat(),
            'uptime': 'N/A',  # Can be calculated if needed
            'database': {
                'users': db.users.estimated_document_count(),
                'messages': db.messages.estimated_document_count(),
                'chats': db.chats.estimated_document_count()
            }
        }
        
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500
