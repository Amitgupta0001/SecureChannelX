import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const EncryptionContext = createContext();

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
};

export const EncryptionProvider = ({ children }) => {
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      initializeEncryption();
    } else {
      setEncryptionKey(null);
      setIsInitialized(false);
    }
  }, [user]);

  const initializeEncryption = async () => {
    try {
      // Generate or retrieve encryption key
      let key = localStorage.getItem(`encryption_key_${user.id}`);
      
      if (!key) {
        // Generate a new key (in production, use proper crypto)
        key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        localStorage.setItem(`encryption_key_${user.id}`, key);
      }
      
      setEncryptionKey(key);
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      setIsInitialized(false);
    }
  };

  const encryptMessage = async (message) => {
    if (!encryptionKey) throw new Error('Encryption not initialized');
    
    // Simple XOR encryption for demo (replace with proper crypto in production)
    let result = '';
    for (let i = 0; i < message.length; i++) {
      result += String.fromCharCode(message.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length));
    }
    return btoa(result); // Base64 encode
  };

  const decryptMessage = async (encryptedMessage) => {
    if (!encryptionKey) throw new Error('Encryption not initialized');
    
    try {
      // Decode from Base64
      const decoded = atob(encryptedMessage);
      
      // Simple XOR decryption for demo (replace with proper crypto in production)
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length));
      }
      return result;
    } catch (error) {
      throw new Error('Failed to decrypt message');
    }
  };

  const value = {
    encryptMessage,
    decryptMessage,
    isInitialized,
    encryptionKey
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
};