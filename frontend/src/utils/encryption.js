// FILE: src/utils/encryption.js

import CryptoJS from "crypto-js";

export class ClientSideEncryption {
  /* -------------------------------------------------------
     Generate 256-bit AES key
  -------------------------------------------------------- */
  static generateKey() {
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  }

  /* -------------------------------------------------------
     AES-GCM ENCRYPTION (secure)
     Returns Base64 JSON: { iv, ciphertext }
  -------------------------------------------------------- */
  static encryptMessage(message, hexKey) {
    const key = CryptoJS.enc.Hex.parse(hexKey);

    // 96-bit GCM IV
    const iv = CryptoJS.lib.WordArray.random(12);

    const encrypted = CryptoJS.AES.encrypt(message, key, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      format: CryptoJS.format.OpenSSL,
    });

    return CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(
        JSON.stringify({
          iv: CryptoJS.enc.Hex.stringify(iv),
          ciphertext: encrypted.toString(),
        })
      )
    );
  }

  /* -------------------------------------------------------
     AES-GCM DECRYPTION (secure)
     Expects Base64 JSON: { iv, ciphertext }
  -------------------------------------------------------- */
  static decryptMessage(encryptedMessage, hexKey) {
    try {
      const json = JSON.parse(
        CryptoJS.enc.Base64.parse(encryptedMessage).toString(CryptoJS.enc.Utf8)
      );

      const key = CryptoJS.enc.Hex.parse(hexKey);
      const iv = CryptoJS.enc.Hex.parse(json.iv);

      const decrypted = CryptoJS.AES.decrypt(json.ciphertext, key, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        format: CryptoJS.format.OpenSSL,
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      console.error("E2E decrypt failed", e);
      throw new Error("Failed to decrypt message");
    }
  }

  /* -------------------------------------------------------
     Derive AES-256 key from password + salt (PBKDF2)
  -------------------------------------------------------- */
  static deriveKey(password, salt) {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 150000,
    }).toString(CryptoJS.enc.Hex);
  }
}
