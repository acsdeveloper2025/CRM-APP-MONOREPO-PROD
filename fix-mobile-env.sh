#!/bin/bash

# Quick fix script for mobile .env file IP configuration
# This script ensures the mobile app has the correct API URLs for static IP access

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
STATIC_IP="103.14.234.36"
LOCAL_IP="10.100.100.30"
MOBILE_ENV="CRM-MOBILE/.env"

print_status "🔧 Fixing Mobile App Environment Configuration"
print_status "Static IP: $STATIC_IP"
print_status "Local IP: $LOCAL_IP"

# Check if mobile .env exists
if [ ! -f "$MOBILE_ENV" ]; then
    print_error "Mobile .env file not found at $MOBILE_ENV"
    exit 1
fi

# Create backup
BACKUP_FILE="${MOBILE_ENV}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$MOBILE_ENV" "$BACKUP_FILE"
print_status "Backup created: $BACKUP_FILE"

# Update mobile .env with correct configuration
print_status "Updating mobile .env file..."

# Ensure all required environment variables are present and correctly configured
cat > "$MOBILE_ENV" << EOF
# Mobile App Environment Configuration
# Updated for Static IP Internet Access: $STATIC_IP

# Development mode
NODE_ENV=development
VITE_APP_NAME=CRM Mobile

# API Configuration - Priority Order for Mobile App:
# 1. Static IP (Internet Access) - PRIMARY
VITE_API_BASE_URL_STATIC_IP=http://$STATIC_IP:3000/api
VITE_API_BASE_URL_PRODUCTION=http://$STATIC_IP:3000/api

# 2. Local Network (Fallback for local access)
VITE_API_BASE_URL_DEVICE=http://$LOCAL_IP:3000/api
VITE_API_BASE_URL_NETWORK=http://$LOCAL_IP:3000/api

# 3. Localhost (Development fallback)
VITE_API_BASE_URL=http://localhost:3000/api

# WebSocket Configuration
VITE_WS_URL=ws://$STATIC_IP:3001
VITE_WS_URL_NETWORK=ws://$LOCAL_IP:3001

# App Configuration
VITE_APP_VERSION=4.0.0
VITE_APP_BUILD_DATE=$(date +%Y-%m-%d)

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_PUSH_NOTIFICATIONS=true
VITE_ENABLE_BIOMETRIC_AUTH=false

# Debug Configuration
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=info

# Mobile Specific Configuration
VITE_MOBILE_THEME=auto
VITE_ENABLE_HAPTIC_FEEDBACK=true
VITE_CACHE_TIMEOUT=300000

# Security Configuration
VITE_TOKEN_REFRESH_THRESHOLD=300
VITE_MAX_RETRY_ATTEMPTS=3
VITE_REQUEST_TIMEOUT=30000
EOF

print_status "✅ Mobile .env file updated successfully!"

# Verify the configuration
print_status "🔍 Verifying configuration..."

if grep -q "VITE_API_BASE_URL_STATIC_IP=http://$STATIC_IP:3000/api" "$MOBILE_ENV"; then
    print_status "✓ Static IP API URL configured correctly"
else
    print_error "✗ Static IP API URL not configured correctly"
fi

if grep -q "VITE_API_BASE_URL_DEVICE=http://$LOCAL_IP:3000/api" "$MOBILE_ENV"; then
    print_status "✓ Local network API URL configured correctly"
else
    print_error "✗ Local network API URL not configured correctly"
fi

if grep -q "VITE_API_BASE_URL_PRODUCTION=http://$STATIC_IP:3000/api" "$MOBILE_ENV"; then
    print_status "✓ Production API URL configured correctly"
else
    print_error "✗ Production API URL not configured correctly"
fi

print_status "🎉 Mobile app environment configuration completed!"
print_status ""
print_status "📱 Mobile App API Priority Order:"
print_status "1. Static IP (Internet): http://$STATIC_IP:3000/api"
print_status "2. Local Network: http://$LOCAL_IP:3000/api"
print_status "3. Localhost: http://localhost:3000/api"
print_status ""
print_status "🔄 Next Steps:"
print_status "1. Restart the mobile app service if it's running"
print_status "2. Test mobile app access from both local and internet"
print_status "3. Check mobile app logs for API connection status"
print_status ""
print_status "💡 To restore previous configuration:"
print_status "   cp $BACKUP_FILE $MOBILE_ENV"
