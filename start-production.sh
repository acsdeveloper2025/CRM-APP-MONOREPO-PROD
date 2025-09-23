#!/bin/bash

# CRM Production Startup Script
# Domain: example.com
# Static IP: SERVER_IP
# System Users: admin1, root (or current user with appropriate permissions)

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

print_status() {
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

print_header "🚀 CRM Production Environment Startup"
print_header "====================================="
echo ""

# Check if running as authorized production user
CURRENT_USER=$(whoami)
if [ "$CURRENT_USER" = "admin1" ] || [ "$CURRENT_USER" = "root" ]; then
    print_status "Running as production user: $CURRENT_USER"
else
    print_error "This script must be run as 'root' or 'admin1' user"
    print_info "Current user: $CURRENT_USER"
    print_info "Switch to root: su -"
    print_info "Or run as admin1: su - admin1"
    exit 1
fi

# Check system services
print_header "🔍 Checking System Services"
services=("nginx" "postgresql" "redis-server")
for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        print_status "$service is running"
    else
        print_warning "$service is not running, attempting to start..."
        sudo systemctl start "$service"
        if systemctl is-active --quiet "$service"; then
            print_status "$service started successfully"
        else
            print_error "Failed to start $service"
            exit 1
        fi
    fi
done

echo ""

# Check SSL certificate
print_header "🔒 Checking SSL Certificate"
if sudo certbot certificates | grep -q "example.com"; then
    expiry_date=$(sudo certbot certificates | grep "Expiry Date" | awk '{print $3, $4}')
    print_status "SSL certificate is valid until: $expiry_date"
else
    print_error "SSL certificate not found"
    exit 1
fi

echo ""

# Check database connectivity
print_header "🗄️  Checking Database Connectivity"
if PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db -c "SELECT 1;" >/dev/null 2>&1; then
    print_status "Database connection successful"
else
    print_error "Database connection failed"
    exit 1
fi

echo ""

# Start CRM applications
print_header "🚀 Starting CRM Applications"

# Create logs directory
mkdir -p logs

# Function to start a service
start_service() {
    local name=$1
    local dir=$2
    local command=$3
    local port=$4

    print_info "Starting $name on port $port..."
    
    cd "$dir" || {
        print_error "Failed to change to $dir directory"
        return 1
    }
    
    # Start the service in background
    nohup $command > "../logs/${name}.log" 2>&1 &
    local pid=$!
    
    # Store PID
    echo $pid > "../logs/${name}.pid"
    
    # Wait for service to start
    sleep 3
    
    if kill -0 "$pid" 2>/dev/null; then
        print_status "$name started successfully (PID: $pid)"
        cd - > /dev/null
        return 0
    else
        print_error "$name failed to start"
        cd - > /dev/null
        return 1
    fi
}

# Start all services
start_service "backend" "CRM-BACKEND" "npm run start:prod" "3000" || exit 1
start_service "frontend" "CRM-FRONTEND" "npm run build && npm run preview -- --host 0.0.0.0 --port 5173" "5173" || exit 1
start_service "mobile" "CRM-MOBILE" "npm run build && npm run preview -- --host 0.0.0.0 --port 5180" "5180" || exit 1

echo ""

# Wait for services to fully initialize
print_info "Waiting for services to initialize..."
sleep 10

# Test endpoints
print_header "🧪 Testing Production Endpoints"

endpoints=(
    "https://example.com/health"
    "https://example.com/"
    "https://example.com/mobile/"
)

for endpoint in "${endpoints[@]}"; do
    if curl -s -f "$endpoint" >/dev/null; then
        print_status "$(basename "$endpoint") endpoint is responding"
    else
        print_warning "$(basename "$endpoint") endpoint may not be ready yet"
    fi
done

echo ""

print_header "🎉 Production Environment Status"
print_header "================================"
echo ""
print_status "Domain: https://example.com"
print_status "Static IP: SERVER_IP"
print_status "SSL Certificate: Valid until $(sudo certbot certificates | grep "Expiry Date" | awk '{print $3, $4}')"
print_status "Auto-renewal: Configured (daily at 12:00 PM)"
print_status "Redis Version: $(redis-server --version | awk '{print $3}' | cut -d'=' -f2)"
echo ""
print_info "Access URLs:"
echo "  • Frontend Dashboard: https://example.com"
echo "  • Mobile App: https://example.com/mobile/"
echo "  • Backend API: https://example.com/api/"
echo "  • Health Check: https://example.com/health"
echo ""
print_info "Default Login Credentials:"
echo "  • Username: admin"
echo "  • Password: CHANGE_ME_PASSWORD"
echo ""
print_info "Service Logs:"
echo "  • Backend: logs/backend.log"
echo "  • Frontend: logs/frontend.log"
echo "  • Mobile: logs/mobile.log"
echo ""
print_status "🚀 CRM Production Environment is ready!"
