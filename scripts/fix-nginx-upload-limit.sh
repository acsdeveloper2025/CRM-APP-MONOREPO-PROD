#!/bin/bash

# Fix Nginx Upload Limit for Mobile App Form Submissions
# This script increases the client_max_body_size to handle large form submissions with multiple images

set -e

echo "🔧 Fixing Nginx Upload Limit Configuration"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

# Find nginx configuration file
NGINX_CONF=""
if [ -f "/etc/nginx/sites-enabled/crm" ]; then
    NGINX_CONF="/etc/nginx/sites-enabled/crm"
elif [ -f "/etc/nginx/sites-available/crm" ]; then
    NGINX_CONF="/etc/nginx/sites-available/crm"
elif [ -f "/etc/nginx/conf.d/crm.conf" ]; then
    NGINX_CONF="/etc/nginx/conf.d/crm.conf"
else
    # Find any nginx config file with server_name example.com
    NGINX_CONF=$(grep -rl "server_name.*example.com" /etc/nginx/ 2>/dev/null | head -1)
fi

if [ -z "$NGINX_CONF" ]; then
    print_error "Could not find nginx configuration file for CRM"
    print_info "Updating main nginx.conf instead..."
    NGINX_CONF="/etc/nginx/nginx.conf"
fi

print_info "Found nginx configuration: $NGINX_CONF"

# Backup current configuration
BACKUP_FILE="${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONF" "$BACKUP_FILE"
print_info "Backup created: $BACKUP_FILE"

# Check if client_max_body_size already exists
if grep -q "client_max_body_size" "$NGINX_CONF"; then
    print_warning "client_max_body_size already exists in configuration"
    print_info "Updating existing value to 100M..."
    
    # Update existing value
    sed -i 's/client_max_body_size [^;]*;/client_max_body_size 100M;/' "$NGINX_CONF"
else
    print_info "Adding client_max_body_size to configuration..."
    
    # Add to http block if it's nginx.conf
    if [[ "$NGINX_CONF" == *"nginx.conf"* ]]; then
        # Add to http block
        sed -i '/http {/a\    # Increase upload size limit for mobile app form submissions\n    client_max_body_size 100M;\n    client_body_buffer_size 10M;\n    client_body_timeout 300s;' "$NGINX_CONF"
    else
        # Add to server block
        sed -i '/server {/a\    # Increase upload size limit for mobile app form submissions\n    client_max_body_size 100M;\n    client_body_buffer_size 10M;\n    client_body_timeout 300s;' "$NGINX_CONF"
    fi
fi

# Test nginx configuration
print_info "Testing nginx configuration..."
if nginx -t 2>&1; then
    print_info "✅ Nginx configuration test passed"
    
    # Reload nginx
    print_info "Reloading nginx..."
    systemctl reload nginx
    
    print_info "✅ Nginx reloaded successfully"
    echo ""
    echo "=========================================="
    echo "✅ Upload limit increased to 100MB"
    echo "=========================================="
    echo ""
    echo "Configuration changes:"
    echo "  - client_max_body_size: 100M"
    echo "  - client_body_buffer_size: 10M"
    echo "  - client_body_timeout: 300s"
    echo ""
else
    print_error "Nginx configuration test failed!"
    print_info "Restoring backup..."
    cp "$BACKUP_FILE" "$NGINX_CONF"
    print_info "Backup restored"
    exit 1
fi

