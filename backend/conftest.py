"""
SecureChannelX - Test Configuration
-----------------------------------
Pytest configuration and fixtures
"""

import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))


@pytest.fixture
def app():
    """Create Flask app for testing"""
    from app.app_factory import create_app
    
    app = create_app()
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    
    yield app


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create CLI runner"""
    return app.test_cli_runner()
