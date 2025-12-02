import { sha512 } from './primitives';

// Generate a numeric fingerprint from two identity keys (Uint8Array)
export const generateFingerprint = (keyA, keyB) => {
  if (!keyA || !keyB) return null;

  // Deterministic ordering
  let first = keyA;
  let second = keyB;
  const len = Math.min(keyA.length, keyB.length);
  for (let i = 0; i < len; i++) {
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

  // SHA-512 (synchronous from noble)
  const hash = sha512(combined);

  // Format: first 32 bytes -> 4-char uppercase hex groups
  const hex = Array.from(hash.slice(0, 32))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hex.match(/.{1,4}/g).join(' ').toUpperCase();
};
