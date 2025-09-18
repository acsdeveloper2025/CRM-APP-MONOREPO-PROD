#!/bin/bash

# Update Hosts File for CRM Static IP Resolution
# This fixes the hairpin NAT issue

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
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🔧 CRM Hosts File Updater"
echo "========================="
echo

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    print_error "This script must be run as root"
    echo "Please run: sudo $0"
    exit 1
fi

print_status "Creating backup of hosts file..."
cp "$HOSTS_FILE" "${HOSTS_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
print_success "Backup created"

print_status "Checking for existing static IP entry..."
if grep -q "$STATIC_IP" "$HOSTS_FILE"; then
    print_warning "Static IP entry already exists, removing old entry..."
    sed -i "/$STATIC_IP/d" "$HOSTS_FILE"
fi

print_status "Adding static IP mapping..."
echo "" >> "$HOSTS_FILE"
echo "# CRM Static IP Resolution (added $(date))" >> "$HOSTS_FILE"
echo "$LOCAL_IP $STATIC_IP" >> "$HOSTS_FILE"

print_success "Added: $LOCAL_IP $STATIC_IP"

print_status "Verifying entry..."
if grep -q "$LOCAL_IP $STATIC_IP" "$HOSTS_FILE"; then
    print_success "Hosts file updated successfully!"
else
    print_error "Failed to verify hosts file entry"
    exit 1
fi

echo
print_status "Testing DNS resolution..."
if ping -c 1 "$STATIC_IP" >/dev/null 2>&1; then
    print_success "Static IP $STATIC_IP now resolves correctly!"
else
    print_warning "DNS resolution test inconclusive, but entry was added"
fi

echo
print_success "✅ Hosts file configuration complete!"
echo
print_status "The static IP $STATIC_IP now resolves to $LOCAL_IP on this machine"
print_status "This fixes the hairpin NAT routing issue"
echo
print_status "Your CRM system should now work with static IP URLs:"
echo "  • Frontend: http://$STATIC_IP:5173"
echo "  • Mobile: http://$STATIC_IP:5180" 
echo "  • Backend: http://$STATIC_IP:3000"
echo
