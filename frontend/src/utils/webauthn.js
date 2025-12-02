/**
 * WebAuthn/FIDO2 Implementation
 * Hardware token authentication support (YubiKey, etc.)
 */

/**
 * Check if WebAuthn is supported
 */
export const isWebAuthnSupported = () => {
    return (
        window.PublicKeyCredential !== undefined &&
        navigator.credentials !== undefined &&
        navigator.credentials.create !== undefined
    );
};

/**
 * Register a new WebAuthn credential
 */
export const registerWebAuthnCredential = async (username, userId) => {
    if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn is not supported in this browser');
    }

    try {
        // Generate challenge from server
        const challengeResponse = await fetch('/api/auth/webauthn/register/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId }),
        });

        if (!challengeResponse.ok) {
            throw new Error('Failed to get registration challenge');
        }

        const challengeData = await challengeResponse.json();

        // Convert base64 to ArrayBuffer
        const challenge = Uint8Array.from(atob(challengeData.challenge), c => c.charCodeAt(0));
        const userIdBuffer = Uint8Array.from(atob(challengeData.userId), c => c.charCodeAt(0));

        // Create credential options
        const publicKeyCredentialCreationOptions = {
            challenge: challenge,
            rp: {
                name: 'SecureChannelX',
                id: window.location.hostname,
            },
            user: {
                id: userIdBuffer,
                name: username,
                displayName: username,
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' },  // ES256
                { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'cross-platform', // External authenticators
                userVerification: 'preferred',
                requireResidentKey: false,
            },
            timeout: 60000,
            attestation: 'direct',
        };

        // Create credential
        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions,
        });

        if (!credential) {
            throw new Error('Failed to create credential');
        }

        // Prepare credential data for server
        const credentialData = {
            id: credential.id,
            rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
            type: credential.type,
            response: {
                clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
                attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject))),
            },
        };

        // Send to server for verification and storage
        const verifyResponse = await fetch('/api/auth/webauthn/register/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                userId,
                credential: credentialData,
            }),
        });

        if (!verifyResponse.ok) {
            throw new Error('Failed to verify credential');
        }

        const result = await verifyResponse.json();
        console.info('[WEBAUTHN] Registration successful');
        return result;
    } catch (error) {
        console.error('[WEBAUTHN] Registration failed:', error);
        throw error;
    }
};

/**
 * Authenticate with WebAuthn credential
 */
export const authenticateWithWebAuthn = async (username) => {
    if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn is not supported in this browser');
    }

    try {
        // Get challenge from server
        const challengeResponse = await fetch('/api/auth/webauthn/login/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!challengeResponse.ok) {
            throw new Error('Failed to get authentication challenge');
        }

        const challengeData = await challengeResponse.json();

        // Convert base64 to ArrayBuffer
        const challenge = Uint8Array.from(atob(challengeData.challenge), c => c.charCodeAt(0));
        const allowCredentials = challengeData.allowCredentials.map(cred => ({
            id: Uint8Array.from(atob(cred.id), c => c.charCodeAt(0)),
            type: 'public-key',
            transports: cred.transports || ['usb', 'nfc', 'ble'],
        }));

        // Get credential options
        const publicKeyCredentialRequestOptions = {
            challenge: challenge,
            allowCredentials: allowCredentials,
            timeout: 60000,
            userVerification: 'preferred',
            rpId: window.location.hostname,
        };

        // Get credential
        const assertion = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions,
        });

        if (!assertion) {
            throw new Error('Failed to get assertion');
        }

        // Prepare assertion data for server
        const assertionData = {
            id: assertion.id,
            rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))),
            type: assertion.type,
            response: {
                clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
                authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))),
                signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature))),
                userHandle: assertion.response.userHandle
                    ? btoa(String.fromCharCode(...new Uint8Array(assertion.response.userHandle)))
                    : null,
            },
        };

        // Send to server for verification
        const verifyResponse = await fetch('/api/auth/webauthn/login/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                assertion: assertionData,
            }),
        });

        if (!verifyResponse.ok) {
            throw new Error('Failed to verify assertion');
        }

        const result = await verifyResponse.json();
        console.info('[WEBAUTHN] Authentication successful');
        return result;
    } catch (error) {
        console.error('[WEBAUTHN] Authentication failed:', error);
        throw error;
    }
};

/**
 * List registered WebAuthn credentials
 */
export const listWebAuthnCredentials = async () => {
    try {
        const response = await fetch('/api/auth/webauthn/credentials', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to list credentials');
        }

        return await response.json();
    } catch (error) {
        console.error('[WEBAUTHN] Failed to list credentials:', error);
        throw error;
    }
};

/**
 * Remove a WebAuthn credential
 */
export const removeWebAuthnCredential = async (credentialId) => {
    try {
        const response = await fetch(`/api/auth/webauthn/credentials/${credentialId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to remove credential');
        }

        console.info('[WEBAUTHN] Credential removed');
        return await response.json();
    } catch (error) {
        console.error('[WEBAUTHN] Failed to remove credential:', error);
        throw error;
    }
};

/**
 * Check if user has WebAuthn credentials
 */
export const hasWebAuthnCredentials = async (username) => {
    try {
        const response = await fetch(`/api/auth/webauthn/has-credentials?username=${encodeURIComponent(username)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.hasCredentials || false;
    } catch (error) {
        console.error('[WEBAUTHN] Failed to check credentials:', error);
        return false;
    }
};

export default {
    isWebAuthnSupported,
    registerWebAuthnCredential,
    authenticateWithWebAuthn,
    listWebAuthnCredentials,
    removeWebAuthnCredential,
    hasWebAuthnCredentials,
};
