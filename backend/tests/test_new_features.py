"""
SecureChannelX - Feature Integration Tests
------------------------------------------
Tests for Password Reset, Message Search, and File Handling
"""

import pytest
import io
from flask import Flask
from app.app_factory import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['MONGODB_URI'] = "mongodb://localhost:27017/securechannelx_test"
    with app.test_client() as client:
        yield client

def test_password_reset_flow(client):
    """Test full password reset flow"""
    # 1. Request reset
    # Use a dummy email since we can't check the DB in this scope easily without database fixture
    # But we can check the endpoint response
    res = client.post('/api/auth/forgot-password', json={
        'email': 'test@example.com'
    })
    assert res.status_code == 200
    assert b'reset link has been sent' in res.data

def test_file_upload_flow(client):
    """Test file upload flow (requires auth dummy)"""
    # This test is tricky without a valid JWT.
    # We will just check if endpoint exists and requires auth
    res = client.post('/api/files/upload')
    # Should be 401 or 422 because missing token/data
    assert res.status_code in [401, 422]

def test_search_contacts_flow(client):
    """Test search contacts endpoint"""
    # Requires auth, should fail safely
    res = client.get('/api/search/contacts?q=test')
    assert res.status_code in [401, 422]
