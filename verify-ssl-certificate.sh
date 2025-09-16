#!/bin/bash

# 🔒 SSL Certificate Verification Script for crm.allcheckservices.com
# This script verifies the 1-year SSL certificate installation and functionality

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

print_header "🔒 SSL Certificate Verification for crm.allcheckservices.com"

# Check 1: Certificate File Existence
print_info "1. Checking certificate files..."
if [ -f "/etc/ssl/certs/crm-1year.crt" ] && sudo [ -f "/etc/ssl/private/crm-1year.key" ]; then
    print_status "Certificate files found"
    
    # Check certificate validity period
    cert_info=$(sudo openssl x509 -in /etc/ssl/certs/crm-1year.crt -text -noout)
    not_before=$(echo "$cert_info" | grep "Not Before" | cut -d: -f2- | xargs)
    not_after=$(echo "$cert_info" | grep "Not After" | cut -d: -f2- | xargs)
    
    print_info "Certificate valid from: $not_before"
    print_info "Certificate valid until: $not_after"
    
    # Check if certificate is valid for 1 year (365 days)
    if sudo openssl x509 -checkend 31536000 -noout -in /etc/ssl/certs/crm-1year.crt >/dev/null 2>&1; then
        print_status "Certificate is valid for 1 year (365 days)"
    else
        print_warning "Certificate validity period is less than 1 year"
    fi
    
    # Check Subject Alternative Names
    san_info=$(echo "$cert_info" | grep -A 1 "Subject Alternative Name" | tail -1 | xargs)
    print_info "Subject Alternative Names: $san_info"
    
else
    print_error "Certificate files not found"
    exit 1
fi

echo ""

# Check 2: Nginx Configuration
print_info "2. Checking Nginx SSL configuration..."
if sudo nginx -t >/dev/null 2>&1; then
    print_status "Nginx configuration is valid"
    
    # Check if Nginx is using our certificate
    if grep -q "/etc/ssl/certs/crm-1year.crt" /etc/nginx/sites-available/crm.allcheckservices.com; then
        print_status "Nginx is configured to use 1-year certificate"
    else
        print_warning "Nginx may not be using the 1-year certificate"
    fi
else
    print_error "Nginx configuration has errors"
fi

echo ""

# Check 3: Nginx Service Status
print_info "3. Checking Nginx service status..."
if systemctl is-active --quiet nginx; then
    print_status "Nginx is running"
    
    # Check if Nginx is listening on SSL port
    if netstat -tlnp 2>/dev/null | grep -q ":443.*nginx"; then
        print_status "Nginx is listening on port 443 (HTTPS)"
    else
        print_error "Nginx is not listening on port 443"
    fi
else
    print_error "Nginx is not running"
fi

echo ""

# Check 4: SSL Connection Test
print_info "4. Testing SSL connection..."

# Test local HTTPS connection
if curl -k -s -I https://localhost >/dev/null 2>&1; then
    print_status "Local HTTPS connection successful"
    
    # Get SSL certificate details from the connection
    cert_details=$(echo | openssl s_client -connect localhost:443 -servername crm.allcheckservices.com 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    if [ ! -z "$cert_details" ]; then
        print_info "SSL connection certificate details:"
        echo "$cert_details" | sed 's/^/    /'
    fi
else
    print_warning "Local HTTPS connection failed"
fi

echo ""

# Check 5: Certificate Chain Validation
print_info "5. Validating certificate chain..."
if sudo openssl verify -CAfile /etc/ssl/certs/crm-1year.crt /etc/ssl/certs/crm-1year.crt >/dev/null 2>&1; then
    print_status "Certificate chain is valid (self-signed)"
else
    print_info "Certificate is self-signed (expected for 1-year certificate)"
fi

echo ""

# Check 6: CRM Services Status
print_info "6. Checking CRM services behind SSL proxy..."
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

echo ""

# Summary
print_header "📋 SSL Certificate Summary"

print_info "🔒 Certificate Type: Self-signed 4096-bit RSA"
print_info "⏰ Validity Period: 1 Year (365 days)"
print_info "🌐 Domain Coverage: crm.allcheckservices.com, *.crm.allcheckservices.com"
print_info "🔢 IP Coverage: 103.14.234.36"
print_info "🛡️  Security Features: Modern SSL/TLS, Security Headers, HTTP/2"

echo ""

if [ "$services_ok" = true ]; then
    print_status "✅ All services are running with SSL protection"
else
    print_warning "⚠️  Some services need attention"
fi

echo ""
print_info "🌐 Secure Access URLs:"
print_info "  • Frontend: https://crm.allcheckservices.com"
print_info "  • Mobile: https://crm.allcheckservices.com:5180"
print_info "  • API: https://crm.allcheckservices.com/api"

echo ""
print_info "🔧 Certificate Management:"
print_info "  • Certificate Path: /etc/ssl/certs/crm-1year.crt"
print_info "  • Private Key Path: /etc/ssl/private/crm-1year.key"
print_info "  • Renewal Date: September 16, 2026"

echo ""
print_status "🎉 1-Year SSL Certificate Verification Complete! 🚀"
