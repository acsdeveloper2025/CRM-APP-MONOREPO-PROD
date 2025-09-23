#!/bin/bash

# Deploy CRM Application as Root User
# This script runs the deployment with root privileges

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header "🚀 CRM Production Deployment (Root Mode)"
print_header "========================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_warning "Not running as root. Attempting to use sudo..."
    
    # Check if sudo is available
    if command -v sudo >/dev/null 2>&1; then
        print_info "Re-running script with sudo..."
        exec sudo "$0" "$@"
    else
        print_error "This script requires root privileges"
        print_info "Please run as: sudo $0"
        exit 1
    fi
fi

print_success "Running as root user"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_info "Script directory: $SCRIPT_DIR"
print_info "Project root: $PROJECT_ROOT"

# Change to project directory
cd "$PROJECT_ROOT"

# Run the deployment script
print_header "🚀 Starting Production Deployment"
exec "$SCRIPT_DIR/deploy-production.sh" "$@"
