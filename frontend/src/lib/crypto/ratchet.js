import {
    generateKeyPairX25519,
    sharedSecretX25519,
    hkdfSha256,
    encryptAesGcm,
    decryptAesGcm,
    toBase64,
    fromBase64
} from './primitives';

const INFO_ROOT = new TextEncoder().encode('SCX_DR_ROOT_V1');
const INFO_CHAIN = new TextEncoder().encode('SCX_DR_CHAIN_V1');
const INFO_MESSAGE = new TextEncoder().encode('SCX_DR_MESSAGE_V1');

const MAX_SKIPPED = 1000;

export class DoubleRatchet {
    constructor() {
        this.state = {
            rootKey: null,
            sendChainKey: null,
            recvChainKey: null,
            dhPrivate: null, // X25519 private key
            dhPublic: null,  // X25519 public key
            remoteDhPublic: null, // Remote's current public key
            Ns: 0, // Send message number
            Nr: 0, // Recv message number
            PN: 0, // Previous chain length
            skipped: {} // Map of skipped keys: "pubKey|msgNum" -> key
        };
    }

    static async initSender(sharedSecret, bobPublicKey) {
        const dr = new DoubleRatchet();
        dr.state.rootKey = sharedSecret;
        dr.state.remoteDhPublic = bobPublicKey;

        // Initialize DH pair
        const kp = generateKeyPairX25519();
        dr.state.dhPrivate = kp.priv;
        dr.state.dhPublic = kp.pub;

        // Perform initial ratchet step (DH1)
        // Sender (Alice) has Bob's public key, so she can start the first DH ratchet immediately
        // to derive a sending chain.
        // DH = DH(AlicePriv, BobPub)
        const dhOut = sharedSecretX25519(dr.state.dhPrivate, dr.state.remoteDhPublic);
        const derived = hkdfSha256(dhOut, dr.state.rootKey, INFO_ROOT, 64);

        dr.state.rootKey = derived.slice(0, 32);
        dr.state.sendChainKey = derived.slice(32, 64);

        return dr;
    }

    static async initReceiver(sharedSecret, alicePublicKey) {
        const dr = new DoubleRatchet();
        dr.state.rootKey = sharedSecret;
        dr.state.remoteDhPublic = alicePublicKey; // Alice's initial public key (from X3DH header)

        // Receiver (Bob) starts with just the root key. 
        // He waits for the first message to trigger the ratchet.
        // However, he needs a DH pair to receive.
        // In X3DH, Bob's SPK was used.
        // The first ratchet step happens when Bob receives a message with a NEW public key from Alice.
        // Alice generated a new key in initSender.
        // So Bob needs to have a "current" key pair that matches what Alice thinks he has.
        // Alice used Bob's SPK. So Bob needs to initialize with SPK as his current DH pair?
        // Or does Alice send a new key?
        // Standard Signal: Alice sends her new DH key in the header.
        // Bob receives it. Bob sees it differs from his last known remote key (which was... none?).
        // Wait, Bob needs to know what key Alice used.
        // Alice used Bob's Signed PreKey.
        // So Bob's "current" DH key pair is his SPK.

        // We will handle this by passing Bob's SPK private key to initReceiver if possible,
        // OR we treat the first ratchet as a special case.
        // Let's assume initReceiver is called with the SPK key pair as the initial "dhPrivate/dhPublic".

        return dr;
    }

    // Helper to set initial key pair (e.g. SPK)
    setInitialKeyPair(priv, pub) {
        this.state.dhPrivate = priv;
        this.state.dhPublic = pub;
    }

    async encrypt(plaintext) {
        const { sendChainKey } = this.state;
        if (!sendChainKey) {
            // This happens if we are receiver and haven't ratcheted yet, 
            // OR if we are sender and init failed.
            // If we are receiver trying to reply, we need to perform a DH ratchet first?
            // No, if we are receiver, we should have received a message first which sets up the chain.
            // If we are starting a fresh session as sender, initSender sets up sendChainKey.
            throw new Error("Send chain not initialized");
        }

        // 1. Advance Chain
        const { nextChainKey, messageKey } = this._kdfChain(sendChainKey);
        this.state.sendChainKey = nextChainKey;

        // 2. Encrypt
        const header = {
            dh: toBase64(this.state.dhPublic),
            pn: this.state.PN,
            n: this.state.Ns
        };

        const aad = new TextEncoder().encode(JSON.stringify(header)); // Bind header to ciphertext
        const { ciphertext, nonce } = encryptAesGcm(messageKey, new TextEncoder().encode(plaintext), aad);

        this.state.Ns++;

        return {
            header,
            ciphertext: toBase64(ciphertext),
            nonce: toBase64(nonce)
        };
    }

    async decrypt(header, ciphertextBase64, nonceBase64) {
        const remotePublic = fromBase64(header.dh);
        const msgNum = header.n;
        const prevNum = header.pn;

        // 1. Check if skipped
        const skippedKey = this.state.skipped[`${header.dh}|${msgNum}`];
        if (skippedKey) {
            delete this.state.skipped[`${header.dh}|${msgNum}`];
            return this._decryptWithKey(skippedKey, ciphertextBase64, nonceBase64, header);
        }

        // 2. Check if DHRatchet needed
        // If header.dh != remoteDhPublic, then ratchet
        // Note: remoteDhPublic might be null initially
        let isNewKey = false;
        if (!this.state.remoteDhPublic) {
            isNewKey = true;
        } else {
            // Compare bytes
            if (this.state.remoteDhPublic.toString() !== remotePublic.toString()) {
                isNewKey = true;
            }
        }

        if (isNewKey) {
            // Ratchet Step

            // A. Skip messages in previous chain
            if (this.state.recvChainKey) {
                // We need to fast-forward the previous chain to handle any missing messages
                // The previous chain length is given by header.pn
                // Our current count is this.state.Nr
                while (this.state.Nr < prevNum) {
                    const { nextChainKey, messageKey } = this._kdfChain(this.state.recvChainKey);
                    this.state.recvChainKey = nextChainKey;
                    // Store skipped key
                    this.state.skipped[`${toBase64(this.state.remoteDhPublic)}|${this.state.Nr}`] = messageKey;
                    this.state.Nr++;
                }
            }

            // B. Perform DH Ratchet
            await this._dhRatchet(remotePublic);

            // C. Reset counts
            this.state.PN = this.state.Ns; // Not really used for receiving, but good for state tracking
            this.state.Ns = 0;
            this.state.Nr = 0;
            this.state.remoteDhPublic = remotePublic;
        }

        // 3. Advance Chain to msgNum
        while (this.state.Nr < msgNum) {
            const { nextChainKey, messageKey } = this._kdfChain(this.state.recvChainKey);
            this.state.recvChainKey = nextChainKey;
            this.state.skipped[`${toBase64(this.state.remoteDhPublic)}|${this.state.Nr}`] = messageKey;
            this.state.Nr++;
        }

        // 4. Derive actual key
        const { nextChainKey, messageKey } = this._kdfChain(this.state.recvChainKey);
        this.state.recvChainKey = nextChainKey;
        this.state.Nr++;

        return this._decryptWithKey(messageKey, ciphertextBase64, nonceBase64, header);
    }

    async _dhRatchet(remotePublic) {
        // 1. DH(MyPriv, RemotePub) -> Root KDF -> New Root, RecvChain
        const dh1 = sharedSecretX25519(this.state.dhPrivate, remotePublic);
        const derived1 = hkdfSha256(dh1, this.state.rootKey, INFO_ROOT, 64);
        this.state.rootKey = derived1.slice(0, 32);
        this.state.recvChainKey = derived1.slice(32, 64);

        // 2. Generate new key pair
        const kp = generateKeyPairX25519();
        this.state.dhPrivate = kp.priv;
        this.state.dhPublic = kp.pub;

        // 3. DH(MyNewPriv, RemotePub) -> Root KDF -> New Root, SendChain
        const dh2 = sharedSecretX25519(this.state.dhPrivate, remotePublic);
        const derived2 = hkdfSha256(dh2, this.state.rootKey, INFO_ROOT, 64);
        this.state.rootKey = derived2.slice(0, 32);
        this.state.sendChainKey = derived2.slice(32, 64);
    }

    _kdfChain(chainKey) {
        // HMAC-SHA256 or HKDF
        // Using HKDF for simplicity and strength
        const nextChainKey = hkdfSha256(chainKey, undefined, INFO_CHAIN, 32);
        const messageKey = hkdfSha256(chainKey, undefined, INFO_MESSAGE, 32);
        return { nextChainKey, messageKey };
    }

    _decryptWithKey(key, ciphertextBase64, nonceBase64, header) {
        const ciphertext = fromBase64(ciphertextBase64);
        const nonce = fromBase64(nonceBase64);
        const aad = new TextEncoder().encode(JSON.stringify(header));

        const plaintextBytes = decryptAesGcm(key, ciphertext, nonce, aad);
        return new TextDecoder().decode(plaintextBytes);
    }

    serialize() {
        // Convert all bytes to base64 for storage
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
