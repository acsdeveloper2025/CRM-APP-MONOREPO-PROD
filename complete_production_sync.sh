#!/bin/bash

# Complete Production Sync Script
# This script will:
# 1. Transfer development database to production
# 2. Replace production database with development data
# 3. Install dependencies and build all applications
# 4. Start all services

set -e

PROD_SERVER="root@SERVER_IP"
PROD_PORT="2232"
PROD_PASS="Tr54V5&u89m#2n7"
DEV_DB="/Users/mayurkulkarni/Downloads/complete_dev_database_20251023_155012.dump"

echo "========================================="
echo "🔄 COMPLETE PRODUCTION SYNC"
echo "========================================="
echo ""

# Step 1: Transfer database
echo "=== Step 1: Transferring development database to production ==="
sshpass -p "$PROD_PASS" scp -P $PROD_PORT -o StrictHostKeyChecking=no \
  "$DEV_DB" $PROD_SERVER:/tmp/dev_db.dump
echo "✅ Database transferred"
echo ""

# Step 2: Replace database and setup environment
echo "=== Step 2: Replacing production database and setting up environment ==="
sshpass -p "$PROD_PASS" ssh -p $PROD_PORT -o StrictHostKeyChecking=no $PROD_SERVER bash << 'ENDSSH'
set -e

echo "Stopping services..."
pm2 stop all || true

echo "Dropping old database..."
sudo -u postgres psql -c 'DROP DATABASE IF EXISTS acs_db;'

echo "Creating fresh database..."
sudo -u postgres psql -c 'CREATE DATABASE acs_db OWNER example_db_user;'

echo "Importing development data..."
PGPASSWORD=example_db_password pg_restore -h localhost -U example_db_user -d acs_db /tmp/dev_db.dump 2>&1 | tail -20

echo "Clearing Redis cache..."
redis-cli FLUSHALL

echo "✅ Database replaced successfully"
ENDSSH
echo ""

# Step 3: Install dependencies
echo "=== Step 3: Installing dependencies on production ==="
sshpass -p "$PROD_PASS" ssh -p $PROD_PORT -o StrictHostKeyChecking=no $PROD_SERVER bash << 'ENDSSH'
set -e

echo "Installing CRM-BACKEND dependencies..."
cd /opt/crm-app/current/CRM-BACKEND
npm install --production 2>&1 | tail -10

echo "Installing CRM-FRONTEND dependencies..."
cd /opt/crm-app/current/CRM-FRONTEND
npm install --production 2>&1 | tail -10

echo "Installing CRM-MOBILE dependencies..."
cd /opt/crm-app/current/CRM-MOBILE
npm install --legacy-peer-deps 2>&1 | tail -10

echo "✅ Dependencies installed"
ENDSSH
echo ""

# Step 4: Build applications
echo "=== Step 4: Building all applications ==="
sshpass -p "$PROD_PASS" ssh -p $PROD_PORT -o StrictHostKeyChecking=no $PROD_SERVER bash << 'ENDSSH'
set -e

echo "Building CRM-BACKEND..."
cd /opt/crm-app/current/CRM-BACKEND
npm run build 2>&1 | tail -10

echo "Building CRM-FRONTEND..."
cd /opt/crm-app/current/CRM-FRONTEND
npm run build 2>&1 | tail -10

echo "Building CRM-MOBILE..."
cd /opt/crm-app/current/CRM-MOBILE
npm run build 2>&1 | tail -10

echo "✅ All applications built"
ENDSSH
echo ""

# Step 5: Start services
echo "=== Step 5: Starting all services ==="
sshpass -p "$PROD_PASS" ssh -p $PROD_PORT -o StrictHostKeyChecking=no $PROD_SERVER bash << 'ENDSSH'
set -e

pm2 start crm-backend
pm2 start crm-frontend
pm2 start crm-mobile

sleep 10

pm2 list

curl -s http://localhost:3000/health | jq .

echo "✅ All services started"
ENDSSH
echo ""

echo "========================================="
echo "✅ PRODUCTION SYNC COMPLETE!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Verify health: curl https://example.com/api/health"
echo "2. Test web app: https://example.com/"
echo "3. Test mobile app: https://example.com/mobile/"

