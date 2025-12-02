import {
  hkdfSha256,
  encryptAesGcm,
  decryptAesGcm,
  getRandomBytes,
  toBase64,
  fromBase64,
} from './primitives';

// Constants
const KDF_CK_INFO = new Uint8Array([0x01]); // For Chain Key step
const KDF_MK_INFO = new Uint8Array([0x02]); // For Message Key derivation
const MAX_SKIPPED = 100; // basic cap for skipped keys

export class SenderKeyRatchet {
  constructor(chainKey, step = 0, skipped = {}) {
    this.chainKey = chainKey;
    this.step = step;
    this.skipped = skipped; // map: step -> base64(key)
  }

  static generate() {
    const chainKey = getRandomBytes(32);
    return new SenderKeyRatchet(chainKey, 0, {});
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const skipped = data.skipped || {};
    return new SenderKeyRatchet(fromBase64(data.chainKey), data.step, skipped);
  }

  serialize() {
    return JSON.stringify({
      chainKey: toBase64(this.chainKey),
      step: this.step,
      skipped: this.skipped,
    });
  }

  // Derive Message Key and Next Chain Key
  ratchetFrom(chainKey) {
    const messageKey = hkdfSha256(chainKey, new Uint8Array(0), KDF_MK_INFO, 32);
    const nextChainKey = hkdfSha256(chainKey, new Uint8Array(0), KDF_CK_INFO, 32);
    return { messageKey, nextChainKey };
  }

  async encrypt(plaintext) {
    const { messageKey, nextChainKey } = this.ratchetFrom(this.chainKey);

    const { ciphertext, nonce } = await encryptAesGcm(
      messageKey,
      new TextEncoder().encode(plaintext)
    );

    this.chainKey = nextChainKey;
    const currentStep = this.step;
    this.step++;

    return {
      ciphertext: toBase64(ciphertext),
      nonce: toBase64(nonce),
      step: currentStep,
    };
  }

  async decrypt(ciphertext, nonce, step) {
    if (step < this.step) {
      // Maybe we stored the skipped key
      const keyB64 = this.skipped[step];
      if (!keyB64) {
        throw new Error(`Message from the past (step ${step} < ${this.step}).`);
      }
      const msgKey = fromBase64(keyB64);
      const plaintextBytes = await decryptAesGcm(
        msgKey,
        fromBase64(ciphertext),
        fromBase64(nonce)
      );
      delete this.skipped[step];
      return new TextDecoder().decode(plaintextBytes);
    }

    // Fast-forward
    let currChainKey = this.chainKey;
    let s = this.step;
    while (s < step) {
      const { nextChainKey, messageKey } = this.ratchetFrom(currChainKey);
      // Save skipped key
      this._saveSkippedKey(s, messageKey);
      currChainKey = nextChainKey;
      s++;
    }

    // Derive key for target step
    const { nextChainKey, messageKey } = this.ratchetFrom(currChainKey);

    // Update state to AFTER this message
    this.chainKey = nextChainKey;
    this.step = step + 1;

    const plaintextBytes = await decryptAesGcm(
      messageKey,
      fromBase64(ciphertext),
      fromBase64(nonce)
    );
    return new TextDecoder().decode(plaintextBytes);
  }

  _saveSkippedKey(step, key) {
    try {
      this.skipped[step] = toBase64(key);
      // Enforce cap
      const keys = Object.keys(this.skipped);
      if (keys.length > MAX_SKIPPED) {
        const oldest = Math.min(...keys.map((k) => parseInt(k, 10)));
        delete this.skipped[oldest];
      }
    } catch {}
  }
}
