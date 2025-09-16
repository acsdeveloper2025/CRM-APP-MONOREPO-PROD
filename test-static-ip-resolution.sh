#!/bin/bash

# Test Static IP Resolution After Hosts File Update
# Comprehensive testing of CRM system with static IP

set -e

# Configuration
STATIC_IP="PUBLIC_STATIC_IP"
LOCAL_IP="10.100.100.30"

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

test_dns_resolution() {
    print_status "Testing DNS resolution for $STATIC_IP..."
    
    if ping -c 1 "$STATIC_IP" >/dev/null 2>&1; then
        print_success "Static IP $STATIC_IP resolves correctly"
        
        # Get the resolved IP
        resolved_ip=$(ping -c 1 "$STATIC_IP" 2>/dev/null | grep PING | awk '{print $3}' | tr -d '()')
        if [[ "$resolved_ip" == "$LOCAL_IP" ]]; then
            print_success "Static IP correctly resolves to local IP: $LOCAL_IP"
        else
            print_warning "Static IP resolves to: $resolved_ip (expected: $LOCAL_IP)"
        fi
    else
        print_error "Static IP $STATIC_IP does not resolve"
        return 1
    fi
}

test_backend_api() {
    print_status "Testing backend API via static IP..."
    
    local response
    if response=$(curl -s --connect-timeout 5 --max-time 10 "http://$STATIC_IP:3000/api/health" 2>/dev/null); then
        if echo "$response" | grep -q '"status":"OK"'; then
            print_success "Backend API accessible via static IP"
            return 0
        else
            print_error "Backend API returned unexpected response"
            echo "Response: $response"
            return 1
        fi
    else
        print_error "Backend API not accessible via static IP"
        return 1
    fi
}

test_frontend_access() {
    print_status "Testing frontend access via static IP..."
    
    if curl -s --connect-timeout 5 --max-time 10 "http://$STATIC_IP:5173" | grep -q "<!doctype html>" 2>/dev/null; then
        print_success "Frontend accessible via static IP"
        return 0
    else
        print_error "Frontend not accessible via static IP"
        return 1
    fi
}

test_mobile_access() {
    print_status "Testing mobile app access via static IP..."
    
    if curl -s --connect-timeout 5 --max-time 10 "http://$STATIC_IP:5180" | grep -q "<!DOCTYPE html>" 2>/dev/null; then
        print_success "Mobile app accessible via static IP"
        return 0
    else
        print_error "Mobile app not accessible via static IP"
        return 1
    fi
}

test_websocket_connection() {
    print_status "Testing WebSocket connection via static IP..."
    
    # Use netcat to test WebSocket port
    if timeout 3 bash -c "</dev/tcp/$STATIC_IP/3000" 2>/dev/null; then
        print_success "WebSocket port accessible via static IP"
        return 0
    else
        print_error "WebSocket port not accessible via static IP"
        return 1
    fi
}

test_mobile_api() {
    print_status "Testing mobile API endpoints via static IP..."
    
    local response
    if response=$(curl -s --connect-timeout 5 --max-time 10 -X POST "http://$STATIC_IP:3000/api/mobile/auth/version-check" \
        -H "Content-Type: application/json" \
        -d '{"currentVersion": "4.0.0", "platform": "WEB", "buildNumber": "1"}' 2>/dev/null); then
        
        if echo "$response" | grep -q '"success":true'; then
            print_success "Mobile API accessible via static IP"
            return 0
        else
            print_error "Mobile API returned unexpected response"
            echo "Response: $response"
            return 1
        fi
    else
        print_error "Mobile API not accessible via static IP"
        return 1
    fi
}

check_hosts_file() {
    print_status "Checking hosts file entry..."
    
    if grep -q "$LOCAL_IP $STATIC_IP" /etc/hosts; then
        print_success "Hosts file entry found: $LOCAL_IP $STATIC_IP"
        return 0
    else
        print_error "Hosts file entry not found"
        print_status "Current hosts file content:"
        cat /etc/hosts
        return 1
    fi
}

check_services_running() {
    print_status "Checking if CRM services are running..."
    
    local services_ok=true
    
    if netstat -tlnp 2>/dev/null | grep -q ":3000.*LISTEN"; then
        print_success "Backend service running on port 3000"
    else
        print_error "Backend service not running on port 3000"
        services_ok=false
    fi
    
    if netstat -tlnp 2>/dev/null | grep -q ":5173.*LISTEN"; then
        print_success "Frontend service running on port 5173"
    else
        print_error "Frontend service not running on port 5173"
        services_ok=false
    fi
    
    if netstat -tlnp 2>/dev/null | grep -q ":5180.*LISTEN"; then
        print_success "Mobile service running on port 5180"
    else
        print_error "Mobile service not running on port 5180"
        services_ok=false
    fi
    
    if [[ "$services_ok" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

main() {
    echo "🧪 CRM Static IP Resolution Test"
    echo "================================="
    echo
    
    local tests_passed=0
    local total_tests=7
    
    # Run all tests
    check_hosts_file && ((tests_passed++)) || true
    check_services_running && ((tests_passed++)) || true
    test_dns_resolution && ((tests_passed++)) || true
    test_backend_api && ((tests_passed++)) || true
    test_frontend_access && ((tests_passed++)) || true
    test_mobile_access && ((tests_passed++)) || true
    test_mobile_api && ((tests_passed++)) || true
    
    echo
    echo "================================="
    echo "Test Results: $tests_passed/$total_tests passed"
    
    if [[ $tests_passed -eq $total_tests ]]; then
        print_success "🎉 All tests passed! Static IP resolution is working correctly."
        echo
        print_status "Your CRM system is now accessible via static IP:"
        echo "  • Frontend: http://$STATIC_IP:5173"
        echo "  • Mobile: http://$STATIC_IP:5180"
        echo "  • Backend: http://$STATIC_IP:3000"
        echo
        print_status "✅ The hairpin NAT issue has been resolved!"
        return 0
    else
        print_error "❌ Some tests failed. Please check the issues above."
        return 1
    fi
}

main "$@"
