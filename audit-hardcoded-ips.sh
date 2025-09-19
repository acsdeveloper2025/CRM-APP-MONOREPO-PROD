#!/bin/bash

# Comprehensive audit script for hardcoded IP addresses
# This script checks for any remaining hardcoded IPs in the codebase

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
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

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to check for hardcoded IPs in files
check_hardcoded_ips() {
    local directory="$1"
    local description="$2"
    
    print_header "Checking $description"
    
    # Define patterns to search for
    local patterns=(
        "103\.14\.234\.36"
        "10\.100\.100\.30"
        "localhost:3000"
        "localhost:5173"
        "localhost:5180"
        "127\.0\.0\.1:3000"
        "127\.0\.0\.1:5173"
        "127\.0\.0\.1:5180"
    )
    
    local found_issues=false
    
    for pattern in "${patterns[@]}"; do
        print_info "Searching for pattern: $pattern"
        
        # Search in source files, excluding node_modules, dist, and .git
        local matches=$(find "$directory" -type f \( \
            -name "*.ts" -o \
            -name "*.tsx" -o \
            -name "*.js" -o \
            -name "*.jsx" -o \
            -name "*.json" -o \
            -name "*.env*" -o \
            -name "*.conf" -o \
            -name "*.config.*" \
        \) \
        -not -path "*/node_modules/*" \
        -not -path "*/dist/*" \
        -not -path "*/.git/*" \
        -not -path "*/build/*" \
        -exec grep -l "$pattern" {} \; 2>/dev/null || true)
        
        if [ -n "$matches" ]; then
            found_issues=true
            print_warning "Found hardcoded pattern '$pattern' in:"
            echo "$matches" | while read -r file; do
                if [ -n "$file" ]; then
                    echo "  - $file"
                    # Show the actual lines with the pattern
                    grep -n "$pattern" "$file" | head -3 | sed 's/^/    /'
                fi
            done
            echo
        fi
    done
    
    if [ "$found_issues" = false ]; then
        print_success "No hardcoded IP patterns found in $description"
    fi
    
    echo
}

# Function to check environment files specifically
check_env_files() {
    print_header "Checking Environment Files"
    
    local env_files=(
        "CRM-BACKEND/.env"
        "CRM-BACKEND/.env.template"
        "CRM-FRONTEND/.env"
        "CRM-FRONTEND/.env.template"
        "CRM-MOBILE/.env"
        "CRM-MOBILE/.env.template"
    )
    
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            print_info "Checking $env_file"
            
            # Check for hardcoded IPs that should be templated
            local hardcoded_found=false
            
            # Check for specific patterns that should be templated
            if grep -q "103\.14\.234\.36" "$env_file" && ! grep -q "{{" "$env_file"; then
                print_warning "Found hardcoded IP PUBLIC_STATIC_IP in $env_file (should use template variables)"
                hardcoded_found=true
            fi
            
            if grep -q "10\.100\.100\.30" "$env_file"; then
                print_warning "Found hardcoded IP 10.100.100.30 in $env_file"
                hardcoded_found=true
            fi
            
            if [ "$hardcoded_found" = false ]; then
                print_success "$env_file looks good"
            fi
        else
            print_warning "$env_file not found"
        fi
    done
    
    echo
}

# Function to check configuration files
check_config_files() {
    print_header "Checking Configuration Files"
    
    local config_files=(
        "CRM-BACKEND/src/config/index.ts"
        "CRM-FRONTEND/vite.config.ts"
        "CRM-MOBILE/vite.config.ts"
        "crm-network-launcher.sh"
    )
    
    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            print_info "Checking $config_file"
            
            # Check for hardcoded localhost references that should be configurable
            if grep -q "localhost:3000" "$config_file" && ! grep -q "process.env\|import.meta.env\|\${" "$config_file"; then
                print_warning "Found hardcoded localhost:3000 in $config_file (should be configurable)"
            else
                print_success "$config_file looks good"
            fi
        else
            print_warning "$config_file not found"
        fi
    done
    
    echo
}

# Function to check service files
check_service_files() {
    print_header "Checking Service Files"
    
    # Check frontend services
    if [ -d "CRM-FRONTEND/src/services" ]; then
        local service_files=$(find CRM-FRONTEND/src/services -name "*.ts" -o -name "*.tsx")
        
        for service_file in $service_files; do
            print_info "Checking $service_file"
            
            # Check if hardcoded IPs are properly handled with environment variables
            if grep -q "103\.14\.234\.36" "$service_file"; then
                if grep -q "import.meta.env.VITE_STATIC_IP" "$service_file"; then
                    print_success "$service_file uses environment variable for static IP"
                else
                    print_warning "$service_file has hardcoded IP without environment variable fallback"
                fi
            else
                print_success "$service_file looks good"
            fi
        done
    fi
    
    echo
}

# Main audit function
main() {
    print_header "CRM System - Hardcoded IP Address Audit"
    echo "This script checks for hardcoded IP addresses that should be configurable"
    echo
    
    # Check each component
    check_hardcoded_ips "CRM-BACKEND/src" "Backend Source Code"
    check_hardcoded_ips "CRM-FRONTEND/src" "Frontend Source Code"
    check_hardcoded_ips "CRM-MOBILE/src" "Mobile App Source Code"
    
    # Check specific file types
    check_env_files
    check_config_files
    check_service_files
    
    print_header "Audit Summary"
    print_info "Audit completed. Review any warnings above."
    print_info "All hardcoded IPs should be replaced with environment variables or template placeholders."
    
    echo
    print_info "Template variables that should be used:"
    echo "  - {{STATIC_IP}} for server IP addresses"
    echo "  - {{API_BASE_URL}} for API endpoints"
    echo "  - {{WS_URL}} for WebSocket URLs"
    echo "  - {{CORS_ORIGINS}} for CORS configuration"
    echo
    
    print_success "Audit completed successfully!"
}

# Run the audit
main "$@"
