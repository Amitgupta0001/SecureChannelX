import { hkdfSha256, encryptAesGcm, decryptAesGcm, getRandomBytes, toBase64, fromBase64 } from './primitives';

// Constants
const KDF_CK_INFO = new Uint8Array([0x01]); // For Chain Key step
const KDF_MK_INFO = new Uint8Array([0x02]); // For Message Key derivation

export class SenderKeyRatchet {
    constructor(chainKey, step = 0) {
        this.chainKey = chainKey;
        this.step = step;
    }

    static generate() {
        const chainKey = getRandomBytes(32);
        return new SenderKeyRatchet(chainKey, 0);
    }

    static deserialize(json) {
        const data = JSON.parse(json);
        return new SenderKeyRatchet(fromBase64(data.chainKey), data.step);
    }

    serialize() {
        return JSON.stringify({
            chainKey: toBase64(this.chainKey),
            step: this.step
        });
    }

    // Derive Message Key and Next Chain Key
    ratchet() {
        // MK = HKDF(CK, "0x02")
        // NextCK = HKDF(CK, "0x01")
        // We use HKDF with empty salt and info

        // Note: HKDF usually returns one output. We need two separate derivations or one long one?
        // Signal uses HMAC-SHA256. HKDF uses HMAC.
        // Let's use HKDF for simplicity.

        // Derive Message Key
        const messageKey = hkdfSha256(this.chainKey, new Uint8Array(0), KDF_MK_INFO, 32);

        // Derive Next Chain Key
        const nextChainKey = hkdfSha256(this.chainKey, new Uint8Array(0), KDF_CK_INFO, 32);

        return { messageKey, nextChainKey };
    }

    async encrypt(plaintext) {
        const { messageKey, nextChainKey } = this.ratchet();

        // Encrypt content
        // We use AES-GCM with the Message Key
        const { ciphertext, nonce } = encryptAesGcm(messageKey, new TextEncoder().encode(plaintext));

        // Update state
        this.chainKey = nextChainKey;
        const currentStep = this.step;
        this.step++;

        return {
            ciphertext: toBase64(ciphertext),
            nonce: toBase64(nonce),
            step: currentStep
        };
    }

    async decrypt(ciphertext, nonce, step) {
        // If step > this.step, we need to fast-forward
        // In a real implementation, we'd handle out-of-order messages by keeping a buffer of skipped keys.
        // For MVP, we'll assume mostly ordered or just fast-forward (losing old keys).
        // WARNING: Fast-forwarding without saving skipped keys means we can't read old messages if they arrive late.
        // We'll implement basic fast-forwarding.

        let currChainKey = this.chainKey;
        let msgKey = null;

        if (step < this.step) {
            throw new Error("Message from the past (step " + step + " < " + this.step + "). Replay or late?");
        }

        // Fast forward
        let stepsToAdvance = step - this.step;
        while (stepsToAdvance > 0) {
            // Derive and discard (or store in skipped keys)
            const next = hkdfSha256(currChainKey, new Uint8Array(0), KDF_CK_INFO, 32);
            currChainKey = next;
            stepsToAdvance--;
        }

        // Derive actual key for this step
        msgKey = hkdfSha256(currChainKey, new Uint8Array(0), KDF_MK_INFO, 32);

        // Update state to AFTER this message
        // Next Chain Key
        this.chainKey = hkdfSha256(currChainKey, new Uint8Array(0), KDF_CK_INFO, 32);
        this.step = step + 1;

        // Decrypt
        const plaintextBytes = decryptAesGcm(msgKey, fromBase64(ciphertext), fromBase64(nonce));
        return new TextDecoder().decode(plaintextBytes);
    }
}
