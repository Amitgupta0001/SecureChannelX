"""
Test Security Headers Middleware
--------------------------------
Tests for security headers implementation
"""

import pytest


class TestSecurityHeaders:
    """Test security headers middleware"""
    
    def test_security_headers_present(self, client):
        """Test that security headers are present"""
        response = client.get('/api/health')
        
        # Check CSP
        assert 'Content-Security-Policy' in response.headers
        assert "default-src 'self'" in response.headers['Content-Security-Policy']
        
        # Check HSTS
        assert 'Strict-Transport-Security' in response.headers
        assert 'max-age=31536000' in response.headers['Strict-Transport-Security']
        
        # Check X-Frame-Options
        assert response.headers.get('X-Frame-Options') == 'DENY'
        
        # Check X-Content-Type-Options
        assert response.headers.get('X-Content-Type-Options') == 'nosniff'
        
        # Check X-XSS-Protection
        assert 'X-XSS-Protection' in response.headers
        
        # Check Referrer-Policy
        assert 'Referrer-Policy' in response.headers
        
        # Check Permissions-Policy
        assert 'Permissions-Policy' in response.headers
        
        print("✅ All security headers present")
    
    def test_csp_prevents_inline_scripts(self, client):
        """Test CSP configuration"""
        response = client.get('/api/health')
        csp = response.headers.get('Content-Security-Policy', '')
        
        # Should allow self
        assert "default-src 'self'" in csp
        
        # Should allow WebSocket
        assert 'ws:' in csp or 'wss:' in csp
        
        # Should prevent object embedding
        assert "object-src 'none'" in csp
        
        print("✅ CSP configured correctly")
    
    def test_hsts_configuration(self, client):
        """Test HSTS configuration"""
        response = client.get('/api/health')
        hsts = response.headers.get('Strict-Transport-Security', '')
        
        # Should have long max-age
        assert 'max-age=31536000' in hsts
        
        # Should include subdomains
        assert 'includeSubDomains' in hsts
        
        # Should be preloadable
        assert 'preload' in hsts
        
        print("✅ HSTS configured correctly")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
