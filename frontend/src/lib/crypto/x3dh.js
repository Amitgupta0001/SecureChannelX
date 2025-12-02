import {
  generateKeyPairX25519,
  generateKeyPairKyber,
  sharedSecretX25519,
  encapsulateKyber,
  decapsulateKyber,
  hkdfSha256,
  toBase64,
  fromBase64,
} from './primitives';

const INFO_X3DH = new TextEncoder().encode('SCX_X3DH_V1');

const concatBytes = (...arrays) => {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
};

/**
 * Generate a Pre-Key Bundle for the user.
 */
export const generatePreKeyBundle = async () => {
  const identityKey = generateKeyPairX25519();
  const signedPreKey = generateKeyPairX25519();
  const kyberPreKey = await generateKeyPairKyber(); // PQ fallback uses X25519

  return {
    identityKey,
    signedPreKey,
    kyberPreKey,
    // signature: <optional>,
    version: 1,
  };
};

/**
 * Alice (Sender) performs X3DH with Bob's bundle.
 * Returns: { sharedSecret, header }
 */
export const x3dhSender = async (aliceIdentityKey, bobBundle) => {
  if (!aliceIdentityKey?.priv || !aliceIdentityKey?.pub) {
    throw new Error('Invalid Alice identity key');
  }
  if (!bobBundle) throw new Error('Missing Bob bundle');

  const IKb = bobBundle.identityKey?.pub || bobBundle.identityKey; // X25519 pub
  const SPKb = bobBundle.signedPreKey?.pub || bobBundle.signedPreKey; // X25519 pub
  const PQPKb = bobBundle.kyberPreKey?.pub || bobBundle.kyberPreKey; // Kyber/X25519 pub

  if (!IKb || !SPKb || !PQPKb) {
    throw new Error('Incomplete Bob pre-key bundle');
  }

  const EKa = generateKeyPairX25519();

  const dh1 = sharedSecretX25519(aliceIdentityKey.priv, SPKb);
  const dh2 = sharedSecretX25519(EKa.priv, IKb);
  const dh3 = sharedSecretX25519(EKa.priv, SPKb);

  const { ciphertext: ctKyber, sharedSecret: ssKyber } = await encapsulateKyber(PQPKb);

  // Optional: use identity keys as salt to bind to identities
  const salt = concatBytes(aliceIdentityKey.pub, IKb);
  const combined = concatBytes(dh1, dh2, dh3, ssKyber);
  const sharedSecret = hkdfSha256(combined, salt, INFO_X3DH, 32);

  return {
    sharedSecret,
    header: {
      v: 1,
      ek: toBase64(EKa.pub),
      ik: toBase64(aliceIdentityKey.pub),
      pq: toBase64(ctKyber),
    },
  };
};

/**
 * Bob (Receiver) processes Alice's initial message header to derive shared secret.
 */
export const x3dhReceiver = async (bobIdentityKey, bobSignedPreKey, bobKyberPreKey, header) => {
  if (!bobIdentityKey?.priv || !bobSignedPreKey?.priv || !bobKyberPreKey) {
    throw new Error('Invalid Bob keys');
  }

  const EKa = fromBase64(header.ek);
  const IKa = fromBase64(header.ik);
  const ctKyber = fromBase64(header.pq);

  const dh1 = sharedSecretX25519(bobSignedPreKey.priv, IKa);
  const dh2 = sharedSecretX25519(bobIdentityKey.priv, EKa);
  const dh3 = sharedSecretX25519(bobSignedPreKey.priv, EKa);

  const privKyber = bobKyberPreKey.priv || bobKyberPreKey;
  const ssKyber = await decapsulateKyber(ctKyber, privKyber);

  const salt = concatBytes(bobIdentityKey.pub, IKa);
  const combined = concatBytes(dh1, dh2, dh3, ssKyber);
  const sharedSecret = hkdfSha256(combined, salt, INFO_X3DH, 32);

  return sharedSecret;
};
