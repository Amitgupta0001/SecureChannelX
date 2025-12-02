import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

/**
 * ✅ Encryption API Service
 * Handles all encryption-related API calls
 */
const encryptionApi = {
  /**
   * Upload encryption keys to server
   */
  uploadKeys: async (token, identityKey, signedPreKey, preKeys) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/encryption/keys/upload`,
        {
          identity_key: identityKey,
          signed_pre_key: {
            key_id: signedPreKey.keyId,
            public_key: signedPreKey.keyPair.publicKey,
            signature: signedPreKey.signature,
          },
          pre_keys: preKeys,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("❌ Failed to upload keys:", error);
      throw error;
    }
  },

  /**
   * Get pre-key bundle for a user
   */
  getPreKeyBundle: async (userId, token) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/encryption/keys/bundle/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("❌ Failed to get pre-key bundle:", error);
      throw error;
    }
  },

  /**
   * Rotate pre-keys
   */
  rotatePreKeys: async (token, newPreKeys) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/encryption/keys/rotate`,
        {
          pre_keys: newPreKeys,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("❌ Failed to rotate keys:", error);
      throw error;
    }
  },

  /**
   * Get public identity key for a user
   */
  getPublicIdentityKey: async (userId, token) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/encryption/keys/identity/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("❌ Failed to get identity key:", error);
      throw error;
    }
  },

  /**
   * Verify safety number
   */
  verifySafetyNumber: async (userId, safetyNumber, token) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/encryption/verify`,
        {
          user_id: userId,
          safety_number: safetyNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("❌ Failed to verify safety number:", error);
      throw error;
    }
  },
};

export default encryptionApi;