#!/bin/bash

# Production Service Startup Script
# Starts backend and frontend services using PM2 with ecosystem config

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting CRM Production Services${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if ecosystem.config.js exists
if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}❌ ecosystem.config.js not found!${NC}"
    exit 1
fi

# Start services using PM2 ecosystem config
echo -e "${GREEN}Starting services from ecosystem.config.js...${NC}"
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

echo -e "${GREEN}✅ All services started successfully${NC}"
echo ""
echo "Service Status:"
pm2 list
