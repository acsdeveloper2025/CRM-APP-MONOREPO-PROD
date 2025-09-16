#!/bin/bash

# CRM System Internet Access Setup Script
# This script configures your CRM system for internet accessibility

set -e

echo "🌐 Setting up CRM System for Internet Access..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Get local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')
print_status "Detected local IP: $LOCAL_IP"

# Update firewall rules
print_status "Configuring firewall rules..."
sudo ufw allow 3000/tcp comment "CRM Backend API"
sudo ufw allow 5173/tcp comment "CRM Frontend"
sudo ufw allow 3001/tcp comment "CRM WebSocket"

# Check if services are running
print_status "Checking service status..."

if ! pgrep -f "node.*dist/index.js" > /dev/null; then
    print_warning "Backend service not running. Please start it first."
fi

if ! pgrep -f "vite.*CRM-FRONTEND" > /dev/null; then
    print_warning "Frontend service not running. Please start it first."
fi

# Create environment backup
print_status "Creating environment backup..."
cp CRM-BACKEND/.env CRM-BACKEND/.env.backup.$(date +%Y%m%d_%H%M%S)
cp CRM-FRONTEND/.env CRM-FRONTEND/.env.backup.$(date +%Y%m%d_%H%M%S)
cp CRM-MOBILE/.env CRM-MOBILE/.env.backup.$(date +%Y%m%d_%H%M%S)

print_status "✅ Basic setup completed!"
print_status "Next steps:"
echo "1. Choose your tunneling solution (Ngrok or Cloudflare)"
echo "2. Update the URLs in the environment files"
echo "3. Restart your services"
echo "4. Test the internet accessibility"

echo ""
print_status "🔗 Your local URLs:"
echo "Frontend: http://$LOCAL_IP:5173"
echo "Backend:  http://$LOCAL_IP:3000"
echo "WebSocket: http://$LOCAL_IP:3001"
