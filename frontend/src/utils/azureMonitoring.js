/**
 * Azure Application Insights - Frontend Monitoring
 * Tracks client-side telemetry, errors, and user interactions
 * Cost: FREE tier (5GB/month) - sufficient for most applications
 */

import { ApplicationInsights } from '@microsoft/applicationinsights-web';

class AzureMonitoringService {
  constructor() {
    this.appInsights = null;
    this.enabled = false;
    
    // Only initialize if connection string is provided and not a placeholder
    const connectionString = import.meta.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING;
    
    if (connectionString && !connectionString.startsWith('InstrumentationKey=your-')) {
      this.initializeAppInsights(connectionString);
    } else {
      console.log('📝 Application Insights disabled - using console logging');
    }
  }

  initializeAppInsights(connectionString) {
    try {
      this.appInsights = new ApplicationInsights({
        config: {
          connectionString: connectionString,
          enableAutoRouteTracking: true, // Track page views automatically
          enableCorsCorrelation: true,
          enableRequestHeaderTracking: true,
          enableResponseHeaderTracking: true,
          disableFetchTracking: false,
          disableAjaxTracking: false,
        }
      });

      this.appInsights.loadAppInsights();
      this.appInsights.trackPageView(); // Track initial page view
      
      this.enabled = true;
      console.log('✅ Azure Application Insights initialized');
    } catch (error) {
      console.warn('⚠️  Application Insights unavailable:', error);
      console.log('📝 Falling back to console logging');
      this.enabled = false;
    }
  }

  /**
   * Track a custom event
   * @param {string} eventName - Name of the event
   * @param {Object} properties - Additional properties
   */
  trackEvent(eventName, properties = {}) {
    if (this.enabled && this.appInsights) {
      this.appInsights.trackEvent({ name: eventName }, properties);
    } else {
      // Console fallback
      const propsStr = Object.entries(properties)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      console.log(`📊 EVENT: ${eventName}${propsStr ? ' | ' + propsStr : ''}`);
    }
  }

  /**
   * Track an exception/error
   * @param {Error} error - The error object
   * @param {Object} properties - Additional context
   */
  trackException(error, properties = {}) {
    if (this.enabled && this.appInsights) {
      this.appInsights.trackException({ exception: error }, properties);
    } else {
      // Console fallback
      const propsStr = Object.entries(properties)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      console.error(`❌ EXCEPTION: ${error.message}${propsStr ? ' | ' + propsStr : ''}`, error);
    }
  }

  /**
   * Track a custom metric
   * @param {string} metricName - Name of the metric
   * @param {number} value - Metric value
   * @param {Object} properties - Additional properties
   */
  trackMetric(metricName, value, properties = {}) {
    if (this.enabled && this.appInsights) {
      this.appInsights.trackMetric({ name: metricName, average: value }, properties);
    } else {
      // Console fallback
      console.log(`📈 METRIC: ${metricName}=${value}`);
    }
  }

  /**
   * Track a page view
   * @param {string} pageName - Name of the page
   * @param {string} url - Page URL
   */
  trackPageView(pageName, url = window.location.href) {
    if (this.enabled && this.appInsights) {
      this.appInsights.trackPageView({ name: pageName, uri: url });
    } else {
      // Console fallback
      console.log(`📄 PAGE VIEW: ${pageName} | ${url}`);
    }
  }

  /**
   * Track user interaction
   * @param {string} action - Action performed (e.g., 'click', 'submit')
   * @param {string} target - Target element or component
   * @param {Object} properties - Additional properties
   */
  trackUserAction(action, target, properties = {}) {
    this.trackEvent(`UserAction:${action}`, {
      target,
      ...properties
    });
  }

  /**
   * Set authenticated user context
   * @param {string} userId - User ID
   * @param {string} accountId - Account/Organization ID (optional)
   */
  setAuthenticatedUserContext(userId, accountId = null) {
    if (this.enabled && this.appInsights) {
      this.appInsights.setAuthenticatedUserContext(userId, accountId, true);
      console.log(`✅ User context set: ${userId}`);
    }
  }

  /**
   * Clear user context (on logout)
   */
  clearAuthenticatedUserContext() {
    if (this.enabled && this.appInsights) {
      this.appInsights.clearAuthenticatedUserContext();
      console.log('✅ User context cleared');
    }
  }
}

// Create global instance
const azureMonitoring = new AzureMonitoringService();

// Export convenience functions
export const trackEvent = (eventName, properties) => 
  azureMonitoring.trackEvent(eventName, properties);

export const trackException = (error, properties) => 
  azureMonitoring.trackException(error, properties);

export const trackMetric = (metricName, value, properties) => 
  azureMonitoring.trackMetric(metricName, value, properties);

export const trackPageView = (pageName, url) => 
  azureMonitoring.trackPageView(pageName, url);

export const trackUserAction = (action, target, properties) => 
  azureMonitoring.trackUserAction(action, target, properties);

export const setAuthenticatedUserContext = (userId, accountId) => 
  azureMonitoring.setAuthenticatedUserContext(userId, accountId);

export const clearAuthenticatedUserContext = () => 
  azureMonitoring.clearAuthenticatedUserContext();

export default azureMonitoring;
