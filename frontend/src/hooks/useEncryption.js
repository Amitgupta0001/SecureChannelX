// frontend/src/hooks/useEncryption.js
import { useState, useEffect, useCallback } from 'react';
import { ClientSideEncryption } from '../utils/encryption';

export const useEncryption = (userId) => {
    const [encryptionKey, setEncryptionKey] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        initializeEncryption();
    }, [userId]);

    const initializeEncryption = async () => {
        try {
            // Generate or retrieve encryption key
            let key = localStorage.getItem(`encryption_key_${userId}`);
            
            if (!key) {
                key = ClientSideEncryption.generateKey();
                localStorage.setItem(`encryption_key_${userId}`, key);
            }
            
            setEncryptionKey(key);
            setIsInitialized(true);
        } catch (error) {
            console.error('Failed to initialize encryption:', error);
        }
    };

    const encryptMessage = useCallback((message) => {
        if (!encryptionKey) throw new Error('Encryption not initialized');
        return ClientSideEncryption.encryptMessage(message, encryptionKey);
    }, [encryptionKey]);

    const decryptMessage = useCallback((encryptedMessage) => {
        if (!encryptionKey) throw new Error('Encryption not initialized');
        return ClientSideEncryption.decryptMessage(encryptedMessage, encryptionKey);
    }, [encryptionKey]);

    return {
        encryptMessage,
        decryptMessage,
        isInitialized
    };
};