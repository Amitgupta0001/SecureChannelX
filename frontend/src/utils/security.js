/**
 * Security Integration Module
 * Exports all security utilities for easy import
 */

// Certificate Pinning
export {
    verifyCertificatePinning,
    secureFetch,
    getExpectedPins,
    applySecurityHeaders,
    SECURITY_HEADERS
} from './certificatePinning';

// WebAuthn/FIDO2
export {
    isWebAuthnSupported,
    registerWebAuthnCredential,
    authenticateWithWebAuthn,
    listWebAuthnCredentials,
    removeWebAuthnCredential,
    hasWebAuthnCredentials
} from './webauthn';

// Re-export default objects
import CertificatePinning from './certificatePinning';
import WebAuthn from './webauthn';

export { CertificatePinning, WebAuthn };
