#!/bin/bash

# Static IP Routing Configuration Helper
# Helps diagnose and configure static IP routing issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Configuration
STATIC_IP="103.14.234.36"
LOCAL_IP="10.100.100.30"
GATEWAY="10.100.100.254"

echo "🔧 Static IP Routing Configuration Helper"
echo "========================================"
echo ""
echo "Static IP: $STATIC_IP"
echo "Local IP:  $LOCAL_IP"
echo "Gateway:   $GATEWAY"
echo ""

# Test 1: Check if static IP is assigned to this machine
print_info "Checking if static IP is assigned to this machine..."
if ip addr show | grep -q "$STATIC_IP"; then
    print_status "Static IP $STATIC_IP is assigned to this machine"
    STATIC_IP_LOCAL=true
else
    print_warning "Static IP $STATIC_IP is NOT assigned to this machine"
    print_info "This means the static IP is managed by your router/ISP"
    STATIC_IP_LOCAL=false
fi

# Test 2: Check routing table
print_info "Checking routing table..."
echo "Current routing table:"
ip route show | head -10

# Test 3: Check if we can reach the static IP
print_info "Testing connectivity to static IP..."
if ping -c 1 -W 1000 "$STATIC_IP" >/dev/null 2>&1; then
    print_status "Can ping static IP $STATIC_IP"
else
    print_warning "Cannot ping static IP $STATIC_IP"
fi

# Test 4: Check NAT/iptables configuration
print_info "Checking NAT/iptables configuration..."
if command -v iptables >/dev/null 2>&1; then
    if sudo iptables -t nat -L | grep -q "DNAT\|REDIRECT"; then
        print_info "NAT rules found:"
        sudo iptables -t nat -L | grep -E "(DNAT|REDIRECT)" | head -5
    else
        print_info "No NAT rules found"
    fi
else
    print_info "iptables not available"
fi

# Test 5: Check if services are accessible via different IPs
echo ""
print_info "Testing service accessibility..."

# Test localhost
if curl -s --max-time 3 "http://localhost:3000/api/health" >/dev/null 2>&1; then
    print_status "Backend accessible via localhost"
else
    print_error "Backend NOT accessible via localhost"
fi

# Test local IP
if curl -s --max-time 3 "http://$LOCAL_IP:3000/api/health" >/dev/null 2>&1; then
    print_status "Backend accessible via local IP ($LOCAL_IP)"
else
    print_error "Backend NOT accessible via local IP ($LOCAL_IP)"
fi

# Test static IP (if local)
if [ "$STATIC_IP_LOCAL" = true ]; then
    if curl -s --max-time 3 "http://$STATIC_IP:3000/api/health" >/dev/null 2>&1; then
        print_status "Backend accessible via static IP ($STATIC_IP)"
    else
        print_error "Backend NOT accessible via static IP ($STATIC_IP)"
    fi
fi

echo ""
print_info "🔧 Configuration Recommendations:"
echo ""

if [ "$STATIC_IP_LOCAL" = true ]; then
    echo "✅ GOOD: Static IP is assigned to this machine"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Your CRM system should be accessible via: http://$STATIC_IP:5173"
    echo "2. If not working, check firewall: sudo ufw status"
    echo "3. Test from external network to confirm internet access"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend:  http://$STATIC_IP:5173"
    echo "   Mobile:    http://$STATIC_IP:5180"
    echo "   Backend:   http://$STATIC_IP:3000"
else
    echo "⚠️  ISSUE: Static IP is NOT assigned to this machine"
    echo ""
    echo "📋 Required Configuration:"
    echo ""
    echo "🔧 Option 1: Router Port Forwarding"
    echo "   Configure your router to forward these ports:"
    echo "   - $STATIC_IP:3000 → $LOCAL_IP:3000 (Backend)"
    echo "   - $STATIC_IP:5173 → $LOCAL_IP:5173 (Frontend)"
    echo "   - $STATIC_IP:5180 → $LOCAL_IP:5180 (Mobile)"
    echo ""
    echo "🔧 Option 2: Assign Static IP to This Machine"
    echo "   Contact your ISP or network admin to:"
    echo "   - Assign $STATIC_IP directly to this machine"
    echo "   - Configure routing from $STATIC_IP to $LOCAL_IP"
    echo ""
    echo "🔧 Option 3: Use Local Network Access (Immediate)"
    echo "   Your CRM is working perfectly on local network:"
    echo "   - Frontend:  http://$LOCAL_IP:5173"
    echo "   - Mobile:    http://$LOCAL_IP:5180"
    echo "   - Backend:   http://$LOCAL_IP:3000"
    echo ""
    echo "💡 RECOMMENDED: Use local network access while configuring static IP routing"
fi

echo ""
print_info "🧪 Quick Test Commands:"
echo ""
echo "Test local access:"
echo "  curl http://$LOCAL_IP:3000/api/health"
echo "  curl http://$LOCAL_IP:5173"
echo ""
echo "Test static IP access (if configured):"
echo "  curl http://$STATIC_IP:3000/api/health"
echo "  curl http://$STATIC_IP:5173"
echo ""
echo "Open in browser:"
echo "  Local:     http://$LOCAL_IP:5173"
echo "  Static IP: http://$STATIC_IP:5173 (if configured)"
