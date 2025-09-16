#!/bin/bash

# Test script for Static IP Internet Access
# Tests all CRM system endpoints via static IP

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
BACKEND_PORT="3000"
FRONTEND_PORT="5173"
MOBILE_PORT="5180"

echo "🧪 Testing CRM System Static IP Access"
echo "======================================"
echo ""

# Test 1: Local Backend Health Check
print_info "Testing local backend health..."
if curl -s --max-time 5 "http://localhost:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
    print_status "Local backend is responding"
elif curl -s --max-time 5 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    print_status "Local backend is responding (alternative endpoint)"
else
    print_error "Local backend is not responding"
    print_info "Make sure backend service is running: ./crm-network-launcher.sh"
fi

# Test 2: Local Network Backend Access
print_info "Testing local network backend access..."
if curl -s --max-time 5 "http://$LOCAL_IP:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
    print_status "Local network backend is accessible"
elif curl -s --max-time 5 "http://$LOCAL_IP:$BACKEND_PORT/health" >/dev/null 2>&1; then
    print_status "Local network backend is accessible (alternative endpoint)"
else
    print_warning "Local network backend is not accessible"
    print_info "Check firewall settings and network configuration"
fi

# Test 3: Static IP Backend Access
print_info "Testing static IP backend access..."
if curl -s --max-time 10 "http://$STATIC_IP:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
    print_status "Static IP backend is accessible from internet!"
elif curl -s --max-time 10 "http://$STATIC_IP:$BACKEND_PORT/health" >/dev/null 2>&1; then
    print_status "Static IP backend is accessible from internet! (alternative endpoint)"
else
    print_error "Static IP backend is not accessible"
    print_info "Check router port forwarding and firewall settings"
fi

# Test 4: Frontend Access
print_info "Testing frontend access..."
if curl -s --max-time 5 "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
    print_status "Local frontend is accessible"
else
    print_warning "Local frontend is not responding"
fi

if curl -s --max-time 10 "http://$STATIC_IP:$FRONTEND_PORT" >/dev/null 2>&1; then
    print_status "Static IP frontend is accessible from internet!"
else
    print_warning "Static IP frontend is not accessible"
fi

# Test 5: Mobile App Access
print_info "Testing mobile app access..."
if curl -s --max-time 5 "http://localhost:$MOBILE_PORT" >/dev/null 2>&1; then
    print_status "Local mobile app is accessible"
else
    print_warning "Local mobile app is not responding"
fi

if curl -s --max-time 10 "http://$STATIC_IP:$MOBILE_PORT" >/dev/null 2>&1; then
    print_status "Static IP mobile app is accessible from internet!"
else
    print_warning "Static IP mobile app is not accessible"
fi

# Test 6: Port Status Check
print_info "Checking port status..."
for port in $BACKEND_PORT $FRONTEND_PORT $MOBILE_PORT; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port 2>/dev/null)
        print_status "Port $port is active (PID: $pid)"
    else
        print_error "Port $port is not active"
    fi
done

# Test 7: Firewall Status
print_info "Checking firewall status..."
if command -v ufw >/dev/null 2>&1; then
    if sudo ufw status | grep -q "Status: active"; then
        print_status "UFW firewall is active"
        
        # Check if required ports are allowed
        for port in $BACKEND_PORT $FRONTEND_PORT; do
            if sudo ufw status | grep -q "$port"; then
                print_status "Port $port is allowed through firewall"
            else
                print_warning "Port $port may not be allowed through firewall"
            fi
        done
    else
        print_warning "UFW firewall is not active"
    fi
else
    print_info "UFW not found - using alternative firewall or none"
fi

echo ""
echo "🌐 Access URLs Summary:"
echo "======================"
echo ""
echo "📍 Localhost Access:"
echo "  Frontend:  http://localhost:$FRONTEND_PORT"
echo "  Mobile:    http://localhost:$MOBILE_PORT"
echo "  Backend:   http://localhost:$BACKEND_PORT"
echo ""
echo "🏠 Local Network Access:"
echo "  Frontend:  http://$LOCAL_IP:$FRONTEND_PORT"
echo "  Mobile:    http://$LOCAL_IP:$MOBILE_PORT"
echo "  Backend:   http://$LOCAL_IP:$BACKEND_PORT"
echo ""
echo "🌍 Internet Access (Static IP):"
echo "  Frontend:  http://$STATIC_IP:$FRONTEND_PORT"
echo "  Mobile:    http://$STATIC_IP:$MOBILE_PORT"
echo "  Backend:   http://$STATIC_IP:$BACKEND_PORT"
echo ""

# Test 8: Configuration Verification
print_info "Verifying configuration files..."

# Check backend CORS
if [ -f "CRM-BACKEND/.env" ]; then
    if grep -q "$STATIC_IP" "CRM-BACKEND/.env"; then
        print_status "Backend CORS includes static IP"
    else
        print_warning "Backend CORS may not include static IP"
    fi
fi

# Check frontend API URL
if [ -f "CRM-FRONTEND/.env" ]; then
    if grep -q "$STATIC_IP" "CRM-FRONTEND/.env"; then
        print_status "Frontend configured for static IP"
    else
        print_warning "Frontend may not be configured for static IP"
    fi
fi

# Check mobile API URL
if [ -f "CRM-MOBILE/.env" ]; then
    if grep -q "VITE_API_BASE_URL_STATIC_IP=http://$STATIC_IP:3000/api" "CRM-MOBILE/.env"; then
        print_status "Mobile app configured for static IP"
    else
        print_warning "Mobile app may not be configured for static IP"
    fi
fi

echo ""
echo "🎯 Test Results Summary:"
echo "========================"
echo ""
print_info "If all tests passed, your CRM system is ready for internet access!"
print_info "If some tests failed, check the specific error messages above."
echo ""
print_info "Next Steps:"
echo "1. Test access from external devices using the static IP URLs"
echo "2. Verify mobile app functionality from different networks"
echo "3. Monitor logs for any connection issues"
echo ""
print_info "Troubleshooting:"
echo "- If backend tests fail: Check if services are running"
echo "- If static IP tests fail: Check router port forwarding"
echo "- If firewall tests fail: Run ./setup-static-ip-access.sh"
