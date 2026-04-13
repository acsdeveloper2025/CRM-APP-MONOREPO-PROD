#!/bin/bash

# Production Service Startup Script
# Starts backend in PM2 fork mode; frontend served by nginx

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting CRM Production Services${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/CRM-BACKEND"

if [ ! -f "$BACKEND_DIR/dist/index.js" ]; then
    echo -e "${RED}❌ Backend not built! Run: cd CRM-BACKEND && npm run build${NC}"
    exit 1
fi

# Clean slate — delete any existing PM2 processes
pm2 delete crm-backend 2>/dev/null || true

# Kill any process on port 3000
kill -9 $(lsof -t -i:3000) 2>/dev/null || true
sleep 1

# Start backend in fork mode from the CRM-BACKEND directory.
# module-alias requires -r flag; cluster mode breaks it.
cd "$BACKEND_DIR"
pm2 start dist/index.js \
    --name crm-backend \
    --node-args='-r module-alias/register' \
    --restart-delay 5000 \
    --max-restarts 10

# Wait for startup
sleep 8

# Verify health
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    pm2 logs crm-backend --lines 20 --nostream 2>&1
    exit 1
fi

pm2 save
echo ""
pm2 list
echo -e "${GREEN}✅ All services started successfully${NC}"
