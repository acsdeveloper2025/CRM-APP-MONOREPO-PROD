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

# Stop existing services first
print_header "🛑 Stopping Existing Services"

# Function to stop services using PM2
stop_existing_services() {
    # Check if PM2 is available
    if command -v pm2 >/dev/null 2>&1; then
        print_info "Using PM2 to stop services..."

        local services=("crm-backend" "crm-frontend" "crm-mobile")

        for service in "${services[@]}"; do
            # Check if process exists in PM2
            if pm2 jlist 2>/dev/null | jq -e ".[] | select(.name==\"$service\")" >/dev/null 2>&1; then
                print_info "Stopping $service via PM2..."
                pm2 stop "$service" >/dev/null 2>&1 || true
                pm2 delete "$service" >/dev/null 2>&1 || true
                print_status "$service stopped"
            else
                print_info "$service not found in PM2"
            fi
        done

        print_status "All PM2 services stopped"
    else
        print_warning "PM2 not available, using port-based cleanup..."

        local ports=("3000" "5173" "5180")

        for port in "${ports[@]}"; do
            print_info "Checking port $port..."

            # Find processes using the port (try multiple methods)
            local pids=""

            # Method 1: lsof (most reliable)
            if command -v lsof >/dev/null 2>&1; then
                pids=$(lsof -ti:$port 2>/dev/null)
            fi

            # Method 2: netstat + ps (fallback)
            if [ -z "$pids" ] && command -v netstat >/dev/null 2>&1; then
                pids=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | grep -v '^-$' | head -1)
            fi

            # Method 3: ss command (modern alternative)
            if [ -z "$pids" ] && command -v ss >/dev/null 2>&1; then
                pids=$(ss -tlnp 2>/dev/null | grep ":$port " | sed 's/.*pid=\([0-9]*\).*/\1/' | head -1)
            fi

            if [ -n "$pids" ]; then
                print_info "Found processes on port $port: $pids"

                # Kill the processes
                for pid in $pids; do
                    # Skip if not a valid PID
                    if ! [[ "$pid" =~ ^[0-9]+$ ]]; then
                        continue
                    fi

                    print_info "Stopping process $pid on port $port..."
                    kill -TERM $pid 2>/dev/null || true

                    # Wait a moment for graceful shutdown
                    sleep 2

                    # Force kill if still running
                    if kill -0 $pid 2>/dev/null; then
                        print_info "Force killing process $pid..."
                        kill -KILL $pid 2>/dev/null || true
                    fi
                done

                print_status "Port $port cleared"
            else
                print_status "Port $port is available"
            fi
        done

        # Also kill any CRM-related processes
        print_info "Stopping any remaining CRM processes..."
        pkill -f "CRM-BACKEND" 2>/dev/null || true
        pkill -f "CRM-FRONTEND" 2>/dev/null || true
        pkill -f "CRM-MOBILE" 2>/dev/null || true
        pkill -f "crm-backend" 2>/dev/null || true
        pkill -f "crm-frontend" 2>/dev/null || true
        pkill -f "caseflow-mobile" 2>/dev/null || true

        # Wait for processes to fully terminate
        sleep 3

        print_status "All existing services stopped"
    fi
}

# Stop existing services
stop_existing_services

echo ""

# Start CRM applications
print_header "🚀 Starting CRM Applications"

# Create logs directory
mkdir -p logs

# Check if PM2 is available
if command -v pm2 >/dev/null 2>&1; then
    print_info "Using PM2 to start services..."

    # Check if ecosystem.config.js exists
    if [ -f "ecosystem.config.js" ]; then
        print_info "Starting services using PM2 ecosystem file..."
        pm2 start ecosystem.config.js

        # Save PM2 process list
        pm2 save --force

        # Wait for services to start
        sleep 5

        # Verify services are running
        local all_running=true
        local services=("crm-backend" "crm-frontend" "crm-mobile")

        for service in "${services[@]}"; do
            local status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$service\") | .pm2_env.status" 2>/dev/null)
            if [ "$status" = "online" ]; then
                local pid=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$service\") | .pid" 2>/dev/null)
                print_status "$service started successfully (PID: $pid)"
            else
                print_error "$service failed to start (status: $status)"
                all_running=false
            fi
        done

        if [ "$all_running" = false ]; then
            print_error "Some services failed to start"
            pm2 logs --lines 50
            exit 1
        fi
    else
        print_error "ecosystem.config.js not found"
        exit 1
    fi
else
    print_warning "PM2 not available, using manual process management..."

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
        nohup bash -c "$command" > "../logs/${name}.log" 2>&1 &
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
    start_service "mobile" "CRM-MOBILE" "npm run build && npm run preview:network -- --port 5180" "5180" || exit 1
fi

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
