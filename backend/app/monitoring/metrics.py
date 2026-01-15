"""
SecureChannelX - Enhanced Monitoring & Metrics
----------------------------------------------
Real-time security monitoring with Prometheus metrics

Features:
- Prometheus metrics
- Real-time security monitoring
- Anomaly detection
- Alert system
"""

import logging
import time
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict, deque

from prometheus_client import Counter, Histogram, Gauge, Summary, generate_latest, REGISTRY

logger = logging.getLogger(__name__)


# ============================================================
#                   PROMETHEUS METRICS
# ============================================================

# Authentication metrics
login_attempts_total = Counter(
    'login_attempts_total',
    'Total login attempts',
    ['status', 'method']
)

login_failures_total = Counter(
    'login_failures_total',
    'Total failed login attempts',
    ['reason']
)

two_fa_attempts_total = Counter(
    'two_fa_attempts_total',
    'Total 2FA attempts',
    ['status']
)

# Message metrics
messages_sent_total = Counter(
    'messages_sent_total',
    'Total messages sent',
    ['type']
)

messages_received_total = Counter(
    'messages_received_total',
    'Total messages received'
)

message_send_latency = Histogram(
    'message_send_latency_seconds',
    'Message send latency',
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
)

# Encryption metrics
encryption_operations_total = Counter(
    'encryption_operations_total',
    'Total encryption operations',
    ['operation']
)

encryption_time = Histogram(
    'encryption_time_seconds',
    'Encryption operation time',
    ['operation'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
)

# Key management metrics
key_operations_total = Counter(
    'key_operations_total',
    'Total key operations',
    ['operation']
)

key_rotations_total = Counter(
    'key_rotations_total',
    'Total key rotations',
    ['key_type']
)

# Security events
security_events_total = Counter(
    'security_events_total',
    'Total security events',
    ['event_type', 'severity']
)

rate_limit_exceeded_total = Counter(
    'rate_limit_exceeded_total',
    'Total rate limit violations',
    ['endpoint']
)

# System metrics
active_users = Gauge(
    'active_users',
    'Number of currently active users'
)

active_connections = Gauge(
    'active_connections',
    'Number of active WebSocket connections'
)

database_query_time = Summary(
    'database_query_time_seconds',
    'Database query execution time'
)


# ============================================================
#                   SECURITY MONITORING
# ============================================================

class SecurityMonitor:
    """
    Real-time security monitoring and alerting
    """
    
    def __init__(self, db=None):
        self.db = db
        self.failed_login_tracker = defaultdict(list)
        self.suspicious_ips = set()
        self.alert_thresholds = {
            'failed_logins': 5,  # 5 failures in 5 minutes
            'failed_logins_window': 300,  # 5 minutes
            'rate_limit_violations': 10,
            'suspicious_activity_score': 50
        }
    
    def track_failed_login(self, username: str, ip_address: str):
        """
        Track failed login attempt
        """
        now = time.time()
        
        # Track by IP
        self.failed_login_tracker[ip_address].append(now)
        
        # Clean old entries
        cutoff = now - self.alert_thresholds['failed_logins_window']
        self.failed_login_tracker[ip_address] = [
            t for t in self.failed_login_tracker[ip_address]
            if t > cutoff
        ]
        
        # Check if threshold exceeded
        if len(self.failed_login_tracker[ip_address]) >= self.alert_thresholds['failed_logins']:
            self.alert_brute_force(username, ip_address)
            self.suspicious_ips.add(ip_address)
        
        # Update metrics
        login_failures_total.labels(reason='invalid_credentials').inc()
    
    def alert_brute_force(self, username: str, ip_address: str):
        """
        Alert on potential brute force attack
        """
        alert = {
            'type': 'brute_force_attempt',
            'severity': 'critical',
            'username': username,
            'ip_address': ip_address,
            'attempts': len(self.failed_login_tracker[ip_address]),
            'timestamp': datetime.utcnow(),
            'message': f"Potential brute force attack from {ip_address}"
        }
        
        logger.critical(f"[SecurityMonitor] ALERT: {alert['message']}")
        
        # Store alert
        if self.db:
            self.db['security_alerts'].insert_one(alert)
        
        # Update metrics
        security_events_total.labels(
            event_type='brute_force',
            severity='critical'
        ).inc()
        
        # Send notification (email, Slack, etc.)
        self.send_alert_notification(alert)
    
    def detect_anomalies(self, user_id: str, activity: Dict) -> float:
        """
        Detect anomalous behavior using simple scoring
        
        Returns:
            Anomaly score (0-100)
        """
        score = 0
        
        # Check for unusual login location
        if activity.get('unusual_location'):
            score += 20
        
        # Check for unusual time
        if activity.get('unusual_time'):
            score += 15
        
        # Check for rapid requests
        if activity.get('rapid_requests'):
            score += 25
        
        # Check for unusual device
        if activity.get('new_device'):
            score += 10
        
        # Check for suspicious patterns
        if activity.get('suspicious_pattern'):
            score += 30
        
        if score >= self.alert_thresholds['suspicious_activity_score']:
            self.alert_suspicious_activity(user_id, activity, score)
        
        return score
    
    def alert_suspicious_activity(self, user_id: str, activity: Dict, score: float):
        """
        Alert on suspicious activity
        """
        alert = {
            'type': 'suspicious_activity',
            'severity': 'high',
            'user_id': user_id,
            'activity': activity,
            'anomaly_score': score,
            'timestamp': datetime.utcnow()
        }
        
        logger.warning(f"[SecurityMonitor] Suspicious activity detected for user {user_id} (score: {score})")
        
        if self.db:
            self.db['security_alerts'].insert_one(alert)
        
        security_events_total.labels(
            event_type='suspicious_activity',
            severity='high'
        ).inc()
    
    def send_alert_notification(self, alert: Dict):
        """
        Send alert notification (email, Slack, etc.)
        """
        # In production, integrate with:
        # - Email (SendGrid, AWS SES)
        # - Slack
        # - PagerDuty
        # - SMS (Twilio)
        
        logger.info(f"[SecurityMonitor] Alert notification sent: {alert['type']}")
    
    def get_security_dashboard_data(self) -> Dict:
        """
        Get data for security dashboard
        """
        return {
            'failed_login_attempts': dict(self.failed_login_tracker),
            'suspicious_ips': list(self.suspicious_ips),
            'recent_alerts': self.get_recent_alerts(limit=10)
        }
    
    def get_recent_alerts(self, limit: int = 10) -> List[Dict]:
        """Get recent security alerts"""
        if not self.db:
            return []
        
        alerts = list(self.db['security_alerts'].find(
            {},
            {'_id': 0}
        ).sort('timestamp', -1).limit(limit))
        
        return alerts


# ============================================================
#                   METRICS EXPORTER
# ============================================================

class MetricsExporter:
    """
    Export Prometheus metrics
    """
    
    @staticmethod
    def get_metrics() -> str:
        """
        Get Prometheus metrics in text format
        
        Returns:
            Metrics in Prometheus text format
        """
        return generate_latest(REGISTRY).decode('utf-8')
    
    @staticmethod
    def record_login_attempt(success: bool, method: str = 'password'):
        """Record login attempt"""
        status = 'success' if success else 'failure'
        login_attempts_total.labels(status=status, method=method).inc()
    
    @staticmethod
    def record_message_sent(message_type: str = 'text'):
        """Record message sent"""
        messages_sent_total.labels(type=message_type).inc()
    
    @staticmethod
    def record_encryption_operation(operation: str, duration: float):
        """Record encryption operation"""
        encryption_operations_total.labels(operation=operation).inc()
        encryption_time.labels(operation=operation).observe(duration)
    
    @staticmethod
    def record_key_operation(operation: str):
        """Record key operation"""
        key_operations_total.labels(operation=operation).inc()
    
    @staticmethod
    def update_active_users(count: int):
        """Update active users count"""
        active_users.set(count)
    
    @staticmethod
    def update_active_connections(count: int):
        """Update active connections count"""
        active_connections.set(count)


# ============================================================
#                   PERFORMANCE MONITOR
# ============================================================

class PerformanceMonitor:
    """
    Monitor application performance
    """
    
    def __init__(self):
        self.request_times = deque(maxlen=1000)
        self.slow_requests = []
    
    def record_request(self, endpoint: str, duration: float):
        """Record request duration"""
        self.request_times.append(duration)
        
        # Track slow requests (>1 second)
        if duration > 1.0:
            self.slow_requests.append({
                'endpoint': endpoint,
                'duration': duration,
                'timestamp': datetime.utcnow()
            })
            logger.warning(f"[Performance] Slow request: {endpoint} ({duration:.2f}s)")
    
    def get_average_response_time(self) -> float:
        """Get average response time"""
        if not self.request_times:
            return 0.0
        return sum(self.request_times) / len(self.request_times)
    
    def get_slow_requests(self, limit: int = 10) -> List[Dict]:
        """Get recent slow requests"""
        return sorted(
            self.slow_requests,
            key=lambda x: x['timestamp'],
            reverse=True
        )[:limit]


# Global instances
_security_monitor = None
_performance_monitor = None


def get_security_monitor(db=None):
    """Get global security monitor instance"""
    global _security_monitor
    if _security_monitor is None:
        _security_monitor = SecurityMonitor(db)
    return _security_monitor


def get_performance_monitor():
    """Get global performance monitor instance"""
    global _performance_monitor
    if _performance_monitor is None:
        _performance_monitor = PerformanceMonitor()
    return _performance_monitor


__all__ = [
    'SecurityMonitor',
    'MetricsExporter',
    'PerformanceMonitor',
    'get_security_monitor',
    'get_performance_monitor'
]
