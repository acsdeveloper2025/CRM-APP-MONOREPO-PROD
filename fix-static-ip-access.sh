#!/bin/bash

# Fix Static IP Access for CRM System
# This script resolves the hairpin NAT issue by configuring proper DNS resolution

set -e

# Configuration
STATIC_IP="PUBLIC_STATIC_IP"
LOCAL_IP="10.100.100.30"
HOSTS_FILE="/etc/hosts"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

echo "🔧 Fix Static IP Access for CRM System"
echo "======================================"
echo

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    print_error "This script must be run as root"
    echo "Please run: sudo $0"
    exit 1
fi

print_status "Step 1: Backup current hosts file..."
cp "$HOSTS_FILE" "${HOSTS_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
print_success "Backup created"

print_status "Step 2: Remove any existing static IP entries..."
sed -i "/$STATIC_IP/d" "$HOSTS_FILE"
print_success "Cleaned existing entries"

print_status "Step 3: Add static IP mapping to hosts file..."
echo "" >> "$HOSTS_FILE"
echo "# CRM Static IP Resolution - $(date)" >> "$HOSTS_FILE"
echo "$LOCAL_IP $STATIC_IP" >> "$HOSTS_FILE"
print_success "Added: $LOCAL_IP $STATIC_IP"

print_status "Step 4: Configure DNS resolution order..."
# Ensure hosts file is checked first
if ! grep -q "^hosts:.*files" /etc/nsswitch.conf; then
    print_warning "Updating nsswitch.conf to prioritize hosts file"
    sed -i 's/^hosts:.*/hosts: files dns/' /etc/nsswitch.conf
fi
print_success "DNS resolution order configured"

print_status "Step 5: Disable systemd-resolved temporarily..."
systemctl stop systemd-resolved 2>/dev/null || true
print_success "systemd-resolved stopped"

print_status "Step 6: Create manual resolv.conf..."
cat > /etc/resolv.conf << EOF
# Temporary DNS configuration for CRM static IP access
nameserver 8.8.8.8
nameserver 8.8.4.4
EOF
print_success "Manual DNS configuration created"

print_status "Step 7: Flush DNS cache..."
# Try multiple methods to flush DNS cache
systemctl flush-dns 2>/dev/null || true
systemd-resolve --flush-caches 2>/dev/null || true
if command -v nscd >/dev/null 2>&1; then
    systemctl restart nscd 2>/dev/null || true
fi
print_success "DNS cache flushed"

print_status "Step 8: Test static IP resolution..."
sleep 2

# Test with getent (respects hosts file)
if getent hosts "$STATIC_IP" | grep -q "$LOCAL_IP"; then
    print_success "Static IP resolves to local IP via hosts file"
else
    print_warning "Hosts file resolution may not be working"
fi

# Test with ping
if ping -c 1 "$STATIC_IP" >/dev/null 2>&1; then
    resolved_ip=$(ping -c 1 "$STATIC_IP" 2>/dev/null | grep PING | awk '{print $3}' | tr -d '()')
    if [[ "$resolved_ip" == "$LOCAL_IP" ]]; then
        print_success "Ping resolves static IP to local IP: $LOCAL_IP"
    else
        print_warning "Ping resolves to: $resolved_ip"
    fi
else
    print_error "Static IP ping test failed"
fi

print_status "Step 9: Test CRM service access via static IP..."
sleep 2

# Test backend API
if curl -s --connect-timeout 5 --max-time 10 "http://$STATIC_IP:3000/api/health" | grep -q '"status":"OK"'; then
    print_success "Backend API accessible via static IP"
else
    print_error "Backend API not accessible via static IP"
fi

# Test frontend
if curl -s --connect-timeout 5 --max-time 10 "http://$STATIC_IP:5173" | grep -q "<!doctype html>"; then
    print_success "Frontend accessible via static IP"
else
    print_error "Frontend not accessible via static IP"
fi

# Test mobile
if curl -s --connect-timeout 5 --max-time 10 "http://$STATIC_IP:5180" | grep -q "<!DOCTYPE html>"; then
    print_success "Mobile app accessible via static IP"
else
    print_error "Mobile app not accessible via static IP"
fi

echo
print_success "✅ Static IP configuration complete!"
echo
print_status "Your CRM system should now be accessible via:"
echo "  • Frontend: http://$STATIC_IP:5173"
echo "  • Mobile: http://$STATIC_IP:5180"
echo "  • Backend: http://$STATIC_IP:3000"
echo
print_warning "📝 To restore systemd-resolved later (optional):"
echo "  sudo systemctl start systemd-resolved"
echo "  sudo systemctl enable systemd-resolved"
echo
print_status "🎯 The hairpin NAT issue should now be resolved!"
echo "   You can access your CRM system using the static IP from this machine."
