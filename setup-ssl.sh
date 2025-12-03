#!/bin/bash

# ============================================================
# SecureChannelX - SSL Certificate Setup Script
# ============================================================
# Automated SSL certificate generation using Let's Encrypt
# Usage: ./setup-ssl.sh your-domain.com
# ============================================================

set -e

DOMAIN=$1
EMAIL=${2:-admin@$DOMAIN}
CERT_DIR="./ssl"

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain> [email]"
    echo "Example: $0 example.com admin@example.com"
    exit 1
fi

echo "Setting up SSL for domain: $DOMAIN"
echo "Contact email: $EMAIL"

# Create certificate directory
mkdir -p "$CERT_DIR"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update
        sudo apt-get install -y certbot
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install certbot
    else
        echo "Please install certbot manually: https://certbot.eff.org/"
        exit 1
    fi
fi

# Option 1: Standalone mode (requires port 80 to be free)
echo "Obtaining SSL certificate..."
sudo certbot certonly --standalone \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

# Copy certificates
echo "Copying certificates..."
sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/"
sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/"
sudo cp "/etc/letsencrypt/live/$DOMAIN/chain.pem" "$CERT_DIR/"

# Set permissions
sudo chown -R $USER:$USER "$CERT_DIR"
chmod 644 "$CERT_DIR/fullchain.pem"
chmod 644 "$CERT_DIR/chain.pem"
chmod 600 "$CERT_DIR/privkey.pem"

echo "✓ SSL certificates installed successfully!"
echo ""
echo "Certificates are located in: $CERT_DIR"
echo ""
echo "To renew certificates automatically, add this to crontab:"
echo "0 0 * * * /usr/bin/certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/*.pem $PWD/$CERT_DIR/ && docker-compose restart nginx-proxy"
