#!/bin/bash

# 🌐 Domain Setup Status Checker for example.com
# This script checks the status of domain configuration, SSL, and services

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

print_header() {
    echo -e "${BLUE}$1${NC}"
    echo "======================================================"
}

print_header "🌐 CRM Domain Setup Status Check"

# Check 1: DNS Resolution
print_info "1. Checking DNS resolution..."
if command -v nslookup >/dev/null 2>&1; then
    if nslookup example.com | grep -q "PUBLIC_STATIC_IP"; then
        print_status "DNS correctly points to PUBLIC_STATIC_IP"
    else
        print_warning "DNS not pointing to PUBLIC_STATIC_IP or not propagated yet"
        print_info "Current DNS resolution:"
        nslookup example.com | grep -A 2 "Name:"
    fi
else
    print_warning "nslookup not available, skipping DNS check"
fi

echo ""

# Check 2: Nginx Status
print_info "2. Checking Nginx status..."
if systemctl is-active --quiet nginx; then
    print_status "Nginx is running"
    
    # Check if our site is enabled
    if [ -L "/etc/nginx/sites-enabled/example.com" ]; then
        print_status "CRM site configuration is enabled"
    else
        print_error "CRM site configuration is not enabled"
    fi
    
    # Test Nginx configuration
    if sudo nginx -t >/dev/null 2>&1; then
        print_status "Nginx configuration is valid"
    else
        print_error "Nginx configuration has errors"
    fi
else
    print_error "Nginx is not running"
fi

echo ""

# Check 3: SSL Certificate Status
print_info "3. Checking SSL certificate status..."
if [ -f "/etc/letsencrypt/live/example.com/fullchain.pem" ]; then
    print_status "Let's Encrypt certificate found"
    
    # Check certificate expiry
    cert_expiry=$(sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/example.com/fullchain.pem | cut -d= -f2)
    print_info "Certificate expires: $cert_expiry"
    
    # Check if certificate is valid for more than 30 days
    if sudo openssl x509 -checkend 2592000 -noout -in /etc/letsencrypt/live/example.com/fullchain.pem >/dev/null 2>&1; then
        print_status "Certificate is valid for more than 30 days"
    else
        print_warning "Certificate expires within 30 days - renewal needed"
    fi
elif [ -f "/etc/ssl/certs/crm-selfsigned.crt" ]; then
    print_warning "Using self-signed certificate (temporary)"
    print_info "Run ./setup-ssl-certificate.sh to get Let's Encrypt certificate"
else
    print_error "No SSL certificate found"
fi

echo ""

# Check 4: CRM Services Status
print_info "4. Checking CRM services status..."
services_ok=true

# Check Backend (Port 3000)
if netstat -tlnp 2>/dev/null | grep -q ":3000.*LISTEN"; then
    print_status "Backend API is running on port 3000"
else
    print_error "Backend API is not running on port 3000"
    services_ok=false
fi

# Check Frontend (Port 5173)
if netstat -tlnp 2>/dev/null | grep -q ":5173.*LISTEN"; then
    print_status "Frontend is running on port 5173"
else
    print_error "Frontend is not running on port 5173"
    services_ok=false
fi

# Check Mobile (Port 5180)
if netstat -tlnp 2>/dev/null | grep -q ":5180.*LISTEN"; then
    print_status "Mobile app is running on port 5180"
else
    print_error "Mobile app is not running on port 5180"
    services_ok=false
fi

if [ "$services_ok" = false ]; then
    print_info "To start CRM services, run: ./crm-network-launcher.sh"
fi

echo ""

# Check 5: Firewall Status
print_info "5. Checking firewall status..."
if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "80/tcp.*ALLOW"; then
        print_status "Port 80 (HTTP) is allowed"
    else
        print_warning "Port 80 (HTTP) may not be allowed"
    fi
    
    if ufw status | grep -q "443/tcp.*ALLOW"; then
        print_status "Port 443 (HTTPS) is allowed"
    else
        print_warning "Port 443 (HTTPS) may not be allowed"
    fi
else
    print_info "UFW firewall not available"
fi

echo ""

# Check 6: Test HTTP/HTTPS Access
print_info "6. Testing domain access..."

# Test HTTP redirect (should redirect to HTTPS)
if command -v curl >/dev/null 2>&1; then
    http_status=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 10 http://example.com 2>/dev/null || echo "000")
    if [ "$http_status" = "200" ]; then
        print_status "HTTP access working (redirects to HTTPS)"
    elif [ "$http_status" = "000" ]; then
        print_warning "Cannot connect to domain (DNS not propagated or server not accessible)"
    else
        print_warning "HTTP returned status code: $http_status"
    fi
    
    # Test HTTPS access
    https_status=$(curl -s -o /dev/null -w "%{http_code}" -k --max-time 10 https://example.com 2>/dev/null || echo "000")
    if [ "$https_status" = "200" ]; then
        print_status "HTTPS access working"
    elif [ "$https_status" = "000" ]; then
        print_warning "Cannot connect to HTTPS (DNS not propagated or SSL issues)"
    else
        print_warning "HTTPS returned status code: $https_status"
    fi
else
    print_info "curl not available, skipping HTTP/HTTPS tests"
fi

echo ""

# Summary
print_header "📋 Summary"

if systemctl is-active --quiet nginx && [ "$services_ok" = true ]; then
    print_status "All services are running"
else
    print_warning "Some services need attention"
fi

echo ""
print_info "🌐 Access URLs:"
print_info "  • Frontend: https://example.com"
print_info "  • Mobile: https://example.com:5180"
print_info "  • API: https://example.com/api"
echo ""
print_info "🔧 Management Commands:"
print_info "  • Start CRM services: ./crm-network-launcher.sh"
print_info "  • Setup SSL certificate: ./setup-ssl-certificate.sh"
print_info "  • Check Nginx logs: sudo tail -f /var/log/nginx/error.log"
print_info "  • Restart Nginx: sudo systemctl restart nginx"

echo ""
print_status "Status check completed! 🚀"
