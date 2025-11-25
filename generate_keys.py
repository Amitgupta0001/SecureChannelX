#!/usr/bin/env python3
"""
Generate secure random keys for SecureChannelX deployment
Run this script to generate SECRET_KEY and JWT_SECRET_KEY
"""

import secrets

def generate_keys():
    """Generate secure random keys for Flask and JWT"""
    print("=" * 70)
    print("SecureChannelX - Environment Variable Generator")
    print("=" * 70)
    print()
    print("Copy these values to your Render Environment Variables:")
    print()
    print("-" * 70)
    
    secret_key = secrets.token_urlsafe(32)
    jwt_secret_key = secrets.token_urlsafe(32)
    
    print(f"SECRET_KEY={secret_key}")
    print()
    print(f"JWT_SECRET_KEY={jwt_secret_key}")
    print()
    print("-" * 70)
    print()
    print("⚠️  IMPORTANT:")
    print("  - Never commit these keys to version control")
    print("  - Use different keys for development and production")
    print("  - Keep these keys secure and private")
    print()
    print("✅ Next Steps:")
    print("  1. Copy the above values to Render Dashboard → Environment")
    print("  2. Set MONGODB_URI (get from MongoDB Atlas)")
    print("  3. Set FLASK_ENV=production")
    print("  4. Set FRONTEND_URL=https://your-frontend-domain.com")
    print("  5. (Optional) Set REDIS_URL for distributed rate limiting")
    print()
    print("=" * 70)

if __name__ == "__main__":
    generate_keys()
