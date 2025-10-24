#!/bin/bash

###############################################################################
# Run Production Cleanup Script
# 
# This script uploads the cleanup script to production server and executes it
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
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

# Production server details
PROD_SERVER="SERVER_IP"
PROD_PORT="2232"
PROD_USER="root"

print_info "=========================================="
print_info "PRODUCTION CLEANUP - REMOTE EXECUTION"
print_info "=========================================="
echo ""

print_warning "⚠️  This will connect to production server and delete ALL CASES!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Operation cancelled"
    exit 0
fi

echo ""
print_info "Uploading cleanup script to production server..."

# Upload the cleanup script
scp -P $PROD_PORT scripts/cleanup-cases-production.sh ${PROD_USER}@${PROD_SERVER}:/tmp/

print_success "Script uploaded successfully"
echo ""

print_info "Executing cleanup on production server..."
echo ""

# Execute the script on production server
ssh -p $PROD_PORT ${PROD_USER}@${PROD_SERVER} << 'ENDSSH'
chmod +x /tmp/cleanup-cases-production.sh
echo "DELETE ALL CASES" | /tmp/cleanup-cases-production.sh
ENDSSH

echo ""
print_success "=========================================="
print_success "PRODUCTION CLEANUP COMPLETE"
print_success "=========================================="
echo ""

