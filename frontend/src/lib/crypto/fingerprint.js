import { sha512, toBase64 } from './primitives';

// Generate a numeric fingerprint from two identity keys
export const generateFingerprint = async (keyA, keyB) => {
    if (!keyA || !keyB) return null;

    // Deterministic ordering
    let first = keyA;
    let second = keyB;
    for (let i = 0; i < keyA.length; i++) {
        if (keyA[i] < keyB[i]) break;
        if (keyA[i] > keyB[i]) {
            first = keyB;
            second = keyA;
            break;
        }
    }

    // Concatenate
    const combined = new Uint8Array(first.length + second.length);
    combined.set(first);
    combined.set(second, first.length);

    // Hash with SHA-512
    const hash = await sha512(combined);

    // Format: first 32 bytes -> hex groups
    const hex = Array.from(hash.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return hex.match(/.{1,4}/g).join(' ').toUpperCase();
};
