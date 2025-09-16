#!/bin/bash

# Complete Mobile App Static IP Configuration Script
# Configures the mobile app for proper static IP usage with fallback support

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
STATIC_IP="PUBLIC_STATIC_IP"
LOCAL_IP="10.100.100.30"
MOBILE_ENV="CRM-MOBILE/.env"

print_header() {
    echo -e "${CYAN}================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================${NC}"
    echo
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header "🔧 Mobile App Static IP Configuration"

print_status "Static IP: $STATIC_IP"
print_status "Local IP: $LOCAL_IP"
print_status "Mobile Environment File: $MOBILE_ENV"
echo

# Step 1: Backup current configuration
print_status "Step 1: Creating backup of current configuration..."
if [ -f "$MOBILE_ENV" ]; then
    BACKUP_FILE="${MOBILE_ENV}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$MOBILE_ENV" "$BACKUP_FILE"
    print_success "Backup created: $BACKUP_FILE"
else
    print_warning "Mobile .env file not found, will create new one"
fi

# Step 2: Update mobile .env configuration
print_status "Step 2: Updating mobile .env configuration..."

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
VITE_WS_URL=ws://$STATIC_IP:3000
VITE_WS_URL_NETWORK=ws://$LOCAL_IP:3000

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

# Google Maps Configuration (optional)
# VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
EOF

print_success "Mobile .env file updated successfully!"

# Step 3: Verify configuration
print_status "Step 3: Verifying configuration..."

# Check static IP API URL
if grep -q "VITE_API_BASE_URL_STATIC_IP=http://$STATIC_IP:3000/api" "$MOBILE_ENV"; then
    print_success "Static IP API URL configured correctly"
else
    print_error "Static IP API URL not configured correctly"
fi

# Check local network API URL
if grep -q "VITE_API_BASE_URL_DEVICE=http://$LOCAL_IP:3000/api" "$MOBILE_ENV"; then
    print_success "Local network API URL configured correctly"
else
    print_error "Local network API URL not configured correctly"
fi

# Check WebSocket URLs
if grep -q "VITE_WS_URL=ws://$STATIC_IP:3000" "$MOBILE_ENV"; then
    print_success "Static IP WebSocket URL configured correctly"
else
    print_error "Static IP WebSocket URL not configured correctly"
fi

if grep -q "VITE_WS_URL_NETWORK=ws://$LOCAL_IP:3000" "$MOBILE_ENV"; then
    print_success "Local network WebSocket URL configured correctly"
else
    print_error "Local network WebSocket URL not configured correctly"
fi

# Step 4: Test API connectivity
print_status "Step 4: Testing API connectivity..."

# Test static IP API
print_status "Testing static IP API connectivity..."
if curl -s --connect-timeout 5 --max-time 10 "http://$STATIC_IP:3000/api/health" > /dev/null 2>&1; then
    print_success "Static IP API is reachable"
else
    print_warning "Static IP API is not reachable (may require hosts file configuration)"
fi

# Test local network API
print_status "Testing local network API connectivity..."
if curl -s --connect-timeout 5 --max-time 10 "http://$LOCAL_IP:3000/api/health" > /dev/null 2>&1; then
    print_success "Local network API is reachable"
else
    print_error "Local network API is not reachable"
fi

# Step 5: Check backend CORS configuration
print_status "Step 5: Checking backend CORS configuration..."

BACKEND_ENV="CRM-BACKEND/.env"
if [ -f "$BACKEND_ENV" ]; then
    if grep -q "$STATIC_IP" "$BACKEND_ENV"; then
        print_success "Backend CORS includes static IP"
    else
        print_warning "Backend CORS may not include static IP"
        print_status "Consider updating backend CORS to include: http://$STATIC_IP:5180"
    fi
else
    print_warning "Backend .env file not found"
fi

# Step 6: Display configuration summary
echo
print_header "📊 Configuration Summary"

echo -e "${CYAN}Mobile App API Priority Order:${NC}"
echo -e "  1. Static IP (Internet):     ${GREEN}http://$STATIC_IP:3000/api${NC}"
echo -e "  2. Local Network:            ${YELLOW}http://$LOCAL_IP:3000/api${NC}"
echo -e "  3. Localhost (Development):  ${BLUE}http://localhost:3000/api${NC}"
echo

echo -e "${CYAN}WebSocket Configuration:${NC}"
echo -e "  Static IP WebSocket:         ${GREEN}ws://$STATIC_IP:3000${NC}"
echo -e "  Local Network WebSocket:     ${YELLOW}ws://$LOCAL_IP:3000${NC}"
echo

echo -e "${CYAN}Mobile App Access URLs:${NC}"
echo -e "  Static IP (Internet):        ${GREEN}http://$STATIC_IP:5180${NC}"
echo -e "  Local Network:               ${YELLOW}http://$LOCAL_IP:5180${NC}"
echo -e "  Localhost:                   ${BLUE}http://localhost:5180${NC}"
echo

# Step 7: Next steps
print_header "🚀 Next Steps"

echo -e "${CYAN}1. Restart Mobile App Service:${NC}"
echo -e "   ${BLUE}cd CRM-MOBILE && npm run dev${NC}"
echo

echo -e "${CYAN}2. Test Mobile App Access:${NC}"
echo -e "   Local Network: ${YELLOW}http://$LOCAL_IP:5180${NC}"
echo -e "   Static IP:     ${GREEN}http://$STATIC_IP:5180${NC} (if hosts file configured)"
echo

echo -e "${CYAN}3. Configure Hosts File (if needed):${NC}"
echo -e "   ${BLUE}sudo ./update-hosts.sh${NC}"
echo

echo -e "${CYAN}4. Test Login Functionality:${NC}"
echo -e "   Username: ${YELLOW}nikhil.parab${NC}"
echo -e "   Password: ${YELLOW}nikhil123${NC}"
echo

print_success "✅ Mobile app static IP configuration completed!"

# Step 8: Restore instructions
echo
print_header "🔄 Restore Instructions"
echo -e "${CYAN}To restore previous configuration:${NC}"
if [ -f "$BACKUP_FILE" ]; then
    echo -e "   ${BLUE}cp $BACKUP_FILE $MOBILE_ENV${NC}"
else
    echo -e "   ${YELLOW}No backup file created${NC}"
fi
echo
