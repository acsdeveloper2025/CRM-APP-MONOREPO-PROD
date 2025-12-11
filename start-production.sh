#!/bin/bash

# Production Service Startup Script
# Starts backend and frontend services using PM2

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting CRM Production Services${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Start Backend
echo -e "${GREEN}Starting Backend...${NC}"
cd CRM-BACKEND
pm2 start dist/index.js --name crm-backend --time
cd ..

# Start Frontend (using serve to serve the built files)
echo -e "${GREEN}Starting Frontend...${NC}"
cd CRM-FRONTEND
pm2 serve dist 5173 --name crm-frontend --spa
cd ..

# Save PM2 process list
pm2 save

echo -e "${GREEN}✅ All services started successfully${NC}"
echo ""
echo "Service Status:"
pm2 list
