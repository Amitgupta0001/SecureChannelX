"""
Test Post-Quantum Cryptography Implementation
---------------------------------------------
Tests for CRYSTALS-Kyber hybrid KEM
"""

import pytest
from app.security.post_quantum import (
    PostQuantumKEM,
    generate_pqc_keypair,
    pqc_encapsulate,
    pqc_decapsulate,
    is_pqc_available,
    KYBER_AVAILABLE
)


class TestPostQuantumCrypto:
    """Test post-quantum cryptography functions"""
    
    def test_kyber_availability(self):
        """Test if Kyber is available"""
        # Should be True after installing pqcrypto
        available = is_pqc_available()
        assert isinstance(available, bool)
        print(f"✅ Kyber available: {available}")
    
    def test_keypair_generation(self):
        """Test hybrid keypair generation"""
        keypair = generate_pqc_keypair()
        
        # Check required keys
        assert 'x25519_private' in keypair
        assert 'x25519_public' in keypair
        assert 'hybrid' in keypair
        
        # Check key lengths
        assert len(keypair['x25519_private']) == 32
        assert len(keypair['x25519_public']) == 32
        
        # If Kyber available, check Kyber keys
        if keypair['hybrid']:
            assert 'kyber_private' in keypair
            assert 'kyber_public' in keypair
            print("✅ Hybrid keypair (X25519 + Kyber)")
        else:
            print("✅ X25519-only keypair")
    
    def test_encapsulation_decapsulation(self):
        """Test key encapsulation and decapsulation"""
        # Generate keypair
        keypair = generate_pqc_keypair()
        
        # Encapsulate
        ciphertext, shared_secret1 = pqc_encapsulate(keypair)
        
        # Check outputs
        assert isinstance(ciphertext, bytes)
        assert isinstance(shared_secret1, bytes)
        assert len(shared_secret1) == 32  # 256-bit key
        
        # Decapsulate
        shared_secret2 = pqc_decapsulate(ciphertext, keypair)
        
        # Shared secrets should match
        assert shared_secret1 == shared_secret2
        print("✅ Encapsulation/Decapsulation successful")
    
    def test_different_keypairs_different_secrets(self):
        """Test that different keypairs produce different secrets"""
        keypair1 = generate_pqc_keypair()
        keypair2 = generate_pqc_keypair()
        
        ciphertext1, secret1 = pqc_encapsulate(keypair1)
        ciphertext2, secret2 = pqc_encapsulate(keypair2)
        
        # Different keypairs should produce different secrets
        assert secret1 != secret2
        print("✅ Different keypairs produce different secrets")
    
    def test_ciphertext_length(self):
        """Test ciphertext length is correct"""
        keypair = generate_pqc_keypair()
        ciphertext, _ = pqc_encapsulate(keypair)
        
        # X25519 ephemeral public key is 32 bytes
        # If hybrid, Kyber ciphertext is added
        assert len(ciphertext) >= 32
        
        if keypair['hybrid']:
            # Kyber-1024 ciphertext is 1568 bytes
            assert len(ciphertext) == 32 + 1568
            print("✅ Hybrid ciphertext length correct")
        else:
            assert len(ciphertext) == 32
            print("✅ X25519 ciphertext length correct")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
