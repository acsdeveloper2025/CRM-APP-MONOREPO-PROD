#!/bin/bash

# CRM System Static IP Access Setup Script
# Configures your CRM system for internet access via static IP: 103.14.234.36

set -e

echo "🌐 Setting up CRM System for Static IP Internet Access..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STATIC_IP="103.14.234.36"
LOCAL_IP="10.100.100.30"
FRONTEND_PORT="5173"
BACKEND_PORT="3000"
WEBSOCKET_PORT="3001"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if running as root for firewall commands
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Run as regular user, it will ask for sudo when needed."
   exit 1
fi

print_status "Configuring CRM System for Static IP: $STATIC_IP"

# 1. Configure UFW Firewall
print_status "Configuring firewall rules..."
sudo ufw allow $BACKEND_PORT/tcp comment "CRM Backend API - Internet Access"
sudo ufw allow $FRONTEND_PORT/tcp comment "CRM Frontend - Internet Access"
sudo ufw allow $WEBSOCKET_PORT/tcp comment "CRM WebSocket - Internet Access"

# Allow SSH (important for remote access)
sudo ufw allow ssh comment "SSH Access"

# Enable firewall if not already enabled
sudo ufw --force enable

print_success "Firewall configured successfully"

# 2. Check if services are running
print_status "Checking service status..."

BACKEND_RUNNING=$(pgrep -f "node.*dist/index.js" || echo "")
FRONTEND_RUNNING=$(pgrep -f "vite.*CRM-FRONTEND" || echo "")

if [ -z "$BACKEND_RUNNING" ]; then
    print_warning "Backend service not running. Please start it first."
else
    print_success "Backend service is running (PID: $BACKEND_RUNNING)"
fi

if [ -z "$FRONTEND_RUNNING" ]; then
    print_warning "Frontend service not running. Please start it first."
else
    print_success "Frontend service is running (PID: $FRONTEND_RUNNING)"
fi

# 3. Test local connectivity
print_status "Testing local connectivity..."

if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/api/health" | grep -q "200"; then
    print_success "Backend API is accessible locally"
else
    print_error "Backend API is not accessible locally"
fi

if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FRONTEND_PORT" | grep -q "200"; then
    print_success "Frontend is accessible locally"
else
    print_error "Frontend is not accessible locally"
fi

# 4. Display access URLs
print_status "🔗 Your CRM System Access URLs:"
echo ""
echo "📱 INTERNET ACCESS (from anywhere):"
echo "   Frontend:  http://$STATIC_IP:$FRONTEND_PORT"
echo "   Backend:   http://$STATIC_IP:$BACKEND_PORT"
echo "   WebSocket: ws://$STATIC_IP:$WEBSOCKET_PORT"
echo ""
echo "🏠 LOCAL NETWORK ACCESS:"
echo "   Frontend:  http://$LOCAL_IP:$FRONTEND_PORT"
echo "   Backend:   http://$LOCAL_IP:$BACKEND_PORT"
echo "   WebSocket: ws://$LOCAL_IP:$WEBSOCKET_PORT"
echo ""
echo "🖥️ LOCALHOST ACCESS:"
echo "   Frontend:  http://localhost:$FRONTEND_PORT"
echo "   Backend:   http://localhost:$BACKEND_PORT"
echo "   WebSocket: ws://localhost:$WEBSOCKET_PORT"

print_success "✅ Static IP access setup completed!"
print_status "Next steps:"
echo "1. Restart your CRM services to apply the new configuration"
echo "2. Test access from external devices using: http://$STATIC_IP:$FRONTEND_PORT"
echo "3. Configure your mobile app to use the static IP URLs"
echo "4. Ensure your router/ISP allows incoming connections on these ports"
