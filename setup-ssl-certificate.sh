#!/bin/bash

# 🔒 SSL Certificate Setup Script for example.com
# This script will obtain and configure Let's Encrypt SSL certificates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

print_info "🔒 SSL Certificate Setup for example.com"
echo "======================================================"

# Step 1: Check DNS resolution
print_info "Step 1: Checking DNS resolution..."
if nslookup example.com | grep -q "PUBLIC_STATIC_IP"; then
    print_status "DNS is correctly configured and pointing to PUBLIC_STATIC_IP"
else
    print_warning "DNS may not be fully propagated yet."
    print_info "Please ensure your DNS A record is set:"
    print_info "  Type: A"
    print_info "  Name: crm"
    print_info "  Value: PUBLIC_STATIC_IP"
    print_info "  TTL: 300"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Exiting. Please configure DNS first and try again."
        exit 1
    fi
fi

# Step 2: Stop Nginx temporarily for standalone mode
print_info "Step 2: Temporarily stopping Nginx for certificate generation..."
sudo systemctl stop nginx

# Step 3: Generate Let's Encrypt certificate
print_info "Step 3: Generating Let's Encrypt SSL certificate..."
if sudo certbot certonly --standalone \
    -d example.com \
    -d www.example.com \
    --email admin@allcheckservices.com \
    --agree-tos \
    --non-interactive; then
    print_status "SSL certificate generated successfully!"
else
    print_error "Failed to generate SSL certificate. Starting Nginx with self-signed certificate."
    sudo systemctl start nginx
    exit 1
fi

# Step 4: Update Nginx configuration to use Let's Encrypt certificates
print_info "Step 4: Updating Nginx configuration to use Let's Encrypt certificates..."
sudo sed -i 's|ssl_certificate /etc/ssl/certs/crm-selfsigned.crt;|ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;|' /etc/nginx/sites-available/example.com
sudo sed -i 's|ssl_certificate_key /etc/ssl/private/crm-selfsigned.key;|ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;|' /etc/nginx/sites-available/example.com

# Step 5: Test Nginx configuration
print_info "Step 5: Testing Nginx configuration..."
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Step 6: Start Nginx
print_info "Step 6: Starting Nginx with SSL certificates..."
sudo systemctl start nginx

# Step 7: Set up automatic renewal
print_info "Step 7: Setting up automatic certificate renewal..."
if ! sudo crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --reload-hook 'systemctl reload nginx'") | sudo crontab -
    print_status "Automatic renewal cron job added"
else
    print_info "Automatic renewal cron job already exists"
fi

# Step 8: Test SSL certificate
print_info "Step 8: Testing SSL certificate..."
sleep 5
if curl -s -I https://example.com | grep -q "HTTP/2 200\|HTTP/1.1 200"; then
    print_status "SSL certificate is working correctly!"
else
    print_warning "SSL certificate test failed. Please check manually."
fi

# Step 9: Display certificate information
print_info "Step 9: Certificate information:"
sudo certbot certificates

print_status "🎉 SSL Certificate Setup Complete!"
echo ""
print_info "Your CRM system is now accessible via:"
print_info "  • https://example.com"
print_info "  • https://www.example.com"
echo ""
print_info "Certificate will auto-renew every 60 days."
print_info "You can manually renew with: sudo certbot renew"
echo ""
print_status "Setup completed successfully! 🚀"
