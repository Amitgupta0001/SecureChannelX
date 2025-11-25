"""
Azure Application Insights Integration
Provides comprehensive monitoring, logging, and telemetry tracking.
Cost: FREE tier (5GB/month) - sufficient for most applications
"""

import os
import logging
from typing import Dict, Any, Optional
from opencensus.ext.azure.log_exporter import AzureLogHandler
from opencensus.ext.azure import metrics_exporter
from opencensus.stats import aggregation as aggregation_module
from opencensus.stats import measure as measure_module
from opencensus.stats import stats as stats_module
from opencensus.stats import view as view_module
from opencensus.tags import tag_map as tag_map_module

class AzureMonitoringService:
    """
    Application Insights integration with automatic fallback to console logging.
    Zero cost for local development, free tier for production.
    """
    
    def __init__(self):
        self.enabled = False
        self.connection_string = os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING")
        self.logger = logging.getLogger(__name__)
        
        # Only initialize if connection string is provided and not a placeholder
        if self.connection_string and not self.connection_string.startswith("InstrumentationKey=your-"):
            self._initialize_monitoring()
        else:
            print("📝 Application Insights disabled - using console logging")
            self._setup_console_logging()
    
    def _initialize_monitoring(self):
        """Initialize Application Insights monitoring."""
        try:
            # Setup Azure Log Handler
            azure_handler = AzureLogHandler(connection_string=self.connection_string)
            azure_handler.setLevel(logging.INFO)
            
            # Configure logger
            self.logger.setLevel(logging.INFO)
            self.logger.addHandler(azure_handler)
            
            # Setup metrics exporter
            self.metrics_exporter = metrics_exporter.new_metrics_exporter(
                connection_string=self.connection_string
            )
            
            self.enabled = True
            print("✅ Azure Application Insights initialized")
            
        except Exception as e:
            print(f"⚠️  Application Insights unavailable: {str(e)}")
            print("📝 Falling back to console logging")
            self._setup_console_logging()
    
    def _setup_console_logging(self):
        """Setup console logging as fallback."""
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        self.logger.setLevel(logging.INFO)
    
    def track_event(self, event_name: str, properties: Optional[Dict[str, Any]] = None):
        """
        Track a custom event.
        
        Args:
            event_name: Name of the event
            properties: Additional properties to track
        """
        properties = properties or {}
        
        if self.enabled:
            self.logger.info(
                f"EVENT: {event_name}",
                extra={'custom_dimensions': properties}
            )
        else:
            # Console fallback
            props_str = ", ".join(f"{k}={v}" for k, v in properties.items())
            self.logger.info(f"📊 EVENT: {event_name} | {props_str}")
    
    def track_exception(self, exception: Exception, properties: Optional[Dict[str, Any]] = None):
        """
        Track an exception with full stack trace.
        
        Args:
            exception: The exception to track
            properties: Additional context
        """
        properties = properties or {}
        
        if self.enabled:
            self.logger.exception(
                f"EXCEPTION: {str(exception)}",
                extra={'custom_dimensions': properties}
            )
        else:
            # Console fallback
            props_str = ", ".join(f"{k}={v}" for k, v in properties.items())
            self.logger.exception(f"❌ EXCEPTION | {props_str}")
    
    def track_metric(self, metric_name: str, value: float, properties: Optional[Dict[str, Any]] = None):
        """
        Track a custom metric.
        
        Args:
            metric_name: Name of the metric
            value: Metric value
            properties: Additional properties
        """
        properties = properties or {}
        
        if self.enabled:
            self.logger.info(
                f"METRIC: {metric_name}={value}",
                extra={'custom_dimensions': properties}
            )
        else:
            # Console fallback
            self.logger.info(f"📈 METRIC: {metric_name}={value}")
    
    def track_request(self, name: str, url: str, duration_ms: float, 
                     response_code: int, success: bool, properties: Optional[Dict[str, Any]] = None):
        """
        Track an HTTP request.
        
        Args:
            name: Request name
            url: Request URL
            duration_ms: Request duration in milliseconds
            response_code: HTTP response code
            success: Whether request was successful
            properties: Additional properties
        """
        properties = properties or {}
        properties.update({
            'url': url,
            'duration_ms': duration_ms,
            'response_code': response_code,
            'success': success
        })
        
        if self.enabled:
            self.logger.info(
                f"REQUEST: {name}",
                extra={'custom_dimensions': properties}
            )
        else:
            # Console fallback
            status = "✅" if success else "❌"
            self.logger.info(
                f"{status} REQUEST: {name} | {url} | {response_code} | {duration_ms}ms"
            )
    
    def track_dependency(self, dependency_type: str, target: str, name: str,
                        duration_ms: float, success: bool, properties: Optional[Dict[str, Any]] = None):
        """
        Track a dependency call (database, external API, etc.).
        
        Args:
            dependency_type: Type of dependency (e.g., 'MongoDB', 'Redis', 'HTTP')
            target: Target of the dependency
            name: Name of the operation
            duration_ms: Duration in milliseconds
            success: Whether the call was successful
            properties: Additional properties
        """
        properties = properties or {}
        properties.update({
            'type': dependency_type,
            'target': target,
            'duration_ms': duration_ms,
            'success': success
        })
        
        if self.enabled:
            self.logger.info(
                f"DEPENDENCY: {name}",
                extra={'custom_dimensions': properties}
            )
        else:
            # Console fallback
            status = "✅" if success else "❌"
            self.logger.info(
                f"{status} DEPENDENCY: {dependency_type} | {target} | {name} | {duration_ms}ms"
            )


# Global instance
monitoring_service = AzureMonitoringService()


# Convenience functions
def track_event(event_name: str, properties: Optional[Dict[str, Any]] = None):
    """Track a custom event."""
    monitoring_service.track_event(event_name, properties)


def track_exception(exception: Exception, properties: Optional[Dict[str, Any]] = None):
    """Track an exception."""
    monitoring_service.track_exception(exception, properties)


def track_metric(metric_name: str, value: float, properties: Optional[Dict[str, Any]] = None):
    """Track a custom metric."""
    monitoring_service.track_metric(metric_name, value, properties)


def track_request(name: str, url: str, duration_ms: float, 
                 response_code: int, success: bool, properties: Optional[Dict[str, Any]] = None):
    """Track an HTTP request."""
    monitoring_service.track_request(name, url, duration_ms, response_code, success, properties)


def track_dependency(dependency_type: str, target: str, name: str,
                    duration_ms: float, success: bool, properties: Optional[Dict[str, Any]] = None):
    """Track a dependency call."""
    monitoring_service.track_dependency(dependency_type, target, name, duration_ms, success, properties)
