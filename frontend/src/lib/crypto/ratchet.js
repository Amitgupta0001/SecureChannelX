import {
  generateKeyPairX25519,
  sharedSecretX25519,
  hkdfSha256,
  encryptAesGcm,
  decryptAesGcm,
  toBase64,
  fromBase64,
} from './primitives';

const INFO_ROOT = new TextEncoder().encode('SCX_DR_ROOT_V1');
const INFO_CHAIN = new TextEncoder().encode('SCX_DR_CHAIN_V1');
const INFO_MESSAGE = new TextEncoder().encode('SCX_DR_MESSAGE_V1');

const MAX_SKIPPED = 1000;

const bytesEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export class DoubleRatchet {
  constructor() {
    this.state = {
      rootKey: null,
      sendChainKey: null,
      recvChainKey: null,
      dhPrivate: null,
      dhPublic: null,
      remoteDhPublic: null,
      Ns: 0,
      Nr: 0,
      PN: 0,
      skipped: {}, // key: "pubBase64|msgNum" -> base64(messageKey)
    };
  }

  static async initSender(sharedSecret, bobPublicKey) {
    const dr = new DoubleRatchet();
    dr.state.rootKey = sharedSecret;
    dr.state.remoteDhPublic = bobPublicKey;

    const kp = generateKeyPairX25519();
    dr.state.dhPrivate = kp.priv;
    dr.state.dhPublic = kp.pub;

    const dhOut = sharedSecretX25519(dr.state.dhPrivate, dr.state.remoteDhPublic);
    const derived = hkdfSha256(dhOut, dr.state.rootKey, INFO_ROOT, 64);

    dr.state.rootKey = derived.slice(0, 32);
    dr.state.sendChainKey = derived.slice(32, 64);

    return dr;
  }

  static async initReceiver(sharedSecret, alicePublicKey) {
    const dr = new DoubleRatchet();
    dr.state.rootKey = sharedSecret;
    dr.state.remoteDhPublic = alicePublicKey;
    // Receiver will establish chains upon first received message header
    return dr;
  }

  setInitialKeyPair(priv, pub) {
    this.state.dhPrivate = priv;
    this.state.dhPublic = pub;
  }

  async encrypt(plaintext) {
    const { sendChainKey } = this.state;
    if (!sendChainKey) {
      throw new Error('Send chain not initialized');
    }

    const { nextChainKey, messageKey } = this._kdfChain(sendChainKey);
    this.state.sendChainKey = nextChainKey;

    const header = {
      dh: toBase64(this.state.dhPublic),
      pn: this.state.PN,
      n: this.state.Ns,
    };

    const aad = new TextEncoder().encode(JSON.stringify(header));
    const { ciphertext, nonce } = await encryptAesGcm(
      messageKey,
      new TextEncoder().encode(plaintext),
      aad
    );

    this.state.Ns++;

    return {
      header,
      ciphertext: toBase64(ciphertext),
      nonce: toBase64(nonce),
    };
  }

  async decrypt(header, ciphertextBase64, nonceBase64) {
    const remotePublic = fromBase64(header.dh);
    const msgNum = header.n;
    const prevNum = header.pn;

    // 1. Skipped?
    const keyId = `${toBase64(remotePublic)}|${msgNum}`;
    const skippedKeyB64 = this.state.skipped[keyId];
    if (skippedKeyB64) {
      delete this.state.skipped[keyId];
      return await this._decryptWithKey(
        fromBase64(skippedKeyB64),
        ciphertextBase64,
        nonceBase64,
        header
      );
    }

    // 2. New DH ratchet?
    const isNewKey =
      !this.state.remoteDhPublic || !bytesEqual(this.state.remoteDhPublic, remotePublic);

    if (isNewKey) {
      // Skip remaining in old chain
      if (this.state.recvChainKey) {
        while (this.state.Nr < prevNum && this.state.Nr < MAX_SKIPPED) {
          const { nextChainKey, messageKey } = this._kdfChain(this.state.recvChainKey);
          this.state.recvChainKey = nextChainKey;
          this._saveSkippedKey(`${toBase64(this.state.remoteDhPublic)}|${this.state.Nr}`, messageKey);
          this.state.Nr++;
        }
      }

      await this._dhRatchet(remotePublic);

      this.state.PN = this.state.Ns;
      this.state.Ns = 0;
      this.state.Nr = 0;
      this.state.remoteDhPublic = remotePublic;
    }

    // 3. Fast-forward to msgNum
    while (this.state.Nr < msgNum && this.state.Nr < MAX_SKIPPED) {
      const { nextChainKey, messageKey } = this._kdfChain(this.state.recvChainKey);
      this.state.recvChainKey = nextChainKey;
      this._saveSkippedKey(`${toBase64(this.state.remoteDhPublic)}|${this.state.Nr}`, messageKey);
      this.state.Nr++;
    }

    // 4. Decrypt with current key
    const { nextChainKey, messageKey } = this._kdfChain(this.state.recvChainKey);
    this.state.recvChainKey = nextChainKey;
    this.state.Nr++;

    return await this._decryptWithKey(messageKey, ciphertextBase64, nonceBase64, header);
  }

  async _dhRatchet(remotePublic) {
    const dh1 = sharedSecretX25519(this.state.dhPrivate, remotePublic);
    const derived1 = hkdfSha256(dh1, this.state.rootKey, INFO_ROOT, 64);
    this.state.rootKey = derived1.slice(0, 32);
    this.state.recvChainKey = derived1.slice(32, 64);

    const kp = generateKeyPairX25519();
    this.state.dhPrivate = kp.priv;
    this.state.dhPublic = kp.pub;

    const dh2 = sharedSecretX25519(this.state.dhPrivate, remotePublic);
    const derived2 = hkdfSha256(dh2, this.state.rootKey, INFO_ROOT, 64);
    this.state.rootKey = derived2.slice(0, 32);
    this.state.sendChainKey = derived2.slice(32, 64);
  }

  _kdfChain(chainKey) {
    const nextChainKey = hkdfSha256(chainKey, undefined, INFO_CHAIN, 32);
    const messageKey = hkdfSha256(chainKey, undefined, INFO_MESSAGE, 32);
    return { nextChainKey, messageKey };
  }

  async _decryptWithKey(key, ciphertextBase64, nonceBase64, header) {
    const ciphertext = fromBase64(ciphertextBase64);
    const nonce = fromBase64(nonceBase64);
    const aad = new TextEncoder().encode(JSON.stringify(header));
    const plaintextBytes = await decryptAesGcm(key, ciphertext, nonce, aad);
    return new TextDecoder().decode(plaintextBytes);
  }

  _saveSkippedKey(id, key) {
    try {
      this.state.skipped[id] = toBase64(key);
      const keys = Object.keys(this.state.skipped);
      if (keys.length > MAX_SKIPPED) {
        delete this.state.skipped[keys[0]];
      }
    } catch {}
  }

  serialize() {
    return JSON.stringify(this.state, (k, v) => {
      if (v instanceof Uint8Array) return { type: 'bytes', data: toBase64(v) };
      return v;
    });
  }

  static deserialize(json) {
    const dr = new DoubleRatchet();
    dr.state = JSON.parse(json, (k, v) => {
      if (v && v.type === 'bytes') return fromBase64(v.data);
      return v;
    });
    return dr;
  }
}
