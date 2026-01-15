/**
 * SecureChannelX - Content Security Policy
 * -----------------------------------------
 * Strict CSP configuration for frontend security
 */

export const CSP_CONFIG = {
    // Default source - only allow same origin
    'default-src': ["'self'"],

    // Scripts - allow self and WebAssembly
    'script-src': [
        "'self'",
        "'wasm-unsafe-eval'", // For WebAssembly
    ],

    // Styles - allow self and inline (for React)
    'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for React inline styles
    ],

    // Images - allow self, data URIs, and HTTPS
    'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:',
    ],

    // Fonts - allow self and data URIs
    'font-src': [
        "'self'",
        'data:',
    ],

    // Connect - allow self and WebSocket
    'connect-src': [
        "'self'",
        'ws://localhost:5050',
        'wss://localhost:5050',
        'http://localhost:5050',
        'https://localhost:5050',
        // Add production URLs here
    ],

    // Media - allow self
    'media-src': ["'self'"],

    // Objects - disallow all
    'object-src': ["'none'"],

    // Base URI - restrict to self
    'base-uri': ["'self'"],

    // Form actions - restrict to self
    'form-action': ["'self'"],

    // Frame ancestors - prevent embedding
    'frame-ancestors': ["'none'"],

    // Upgrade insecure requests
    'upgrade-insecure-requests': [],

    // Block mixed content
    'block-all-mixed-content': [],
};

/**
 * Generate CSP meta tag content
 */
export function generateCSPContent() {
    const directives = Object.entries(CSP_CONFIG)
        .map(([key, values]) => {
            if (values.length === 0) {
                return key;
            }
            return `${key} ${values.join(' ')}`;
        })
        .join('; ');

    return directives;
}

/**
 * Apply CSP to document
 */
export function applyCSP() {
    // Check if CSP meta tag already exists
    let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');

    if (!cspMeta) {
        cspMeta = document.createElement('meta');
        cspMeta.httpEquiv = 'Content-Security-Policy';
        document.head.appendChild(cspMeta);
    }

    cspMeta.content = generateCSPContent();

    console.log('✅ Content Security Policy applied');
}

/**
 * Report CSP violations
 */
export function setupCSPReporting() {
    // Listen for CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
        console.error('CSP Violation:', {
            blockedURI: event.blockedURI,
            violatedDirective: event.violatedDirective,
            originalPolicy: event.originalPolicy,
            sourceFile: event.sourceFile,
            lineNumber: event.lineNumber,
        });

        // Send to backend for logging
        fetch('/api/security/csp-violation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blockedURI: event.blockedURI,
                violatedDirective: event.violatedDirective,
                sourceFile: event.sourceFile,
                lineNumber: event.lineNumber,
                timestamp: new Date().toISOString(),
            }),
        }).catch(err => console.error('Failed to report CSP violation:', err));
    });
}

// Auto-apply on import
if (typeof document !== 'undefined') {
    applyCSP();
    setupCSPReporting();
}

export default { applyCSP, setupCSPReporting, generateCSPContent };
