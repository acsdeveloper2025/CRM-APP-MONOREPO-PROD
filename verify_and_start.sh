#!/bin/bash

SERVER="root@SERVER_IP"
PORT="2232"
PASS="Tr54V5&u89m#2n7"

echo "========================================="
echo "🔍 VERIFYING AND STARTING PRODUCTION"
echo "========================================="
echo ""

# Check if code exists
echo "=== Checking if code was deployed ==="
sshpass -p "$PASS" ssh -p $PORT $SERVER 'test -f /opt/crm-app/current/CRM-BACKEND/package.json && echo "✅ CRM-BACKEND exists" || echo "❌ CRM-BACKEND missing"'
sshpass -p "$PASS" ssh -p $PORT $SERVER 'test -f /opt/crm-app/current/CRM-FRONTEND/package.json && echo "✅ CRM-FRONTEND exists" || echo "❌ CRM-FRONTEND missing"'
sshpass -p "$PASS" ssh -p $PORT $SERVER 'test -f /opt/crm-app/current/CRM-MOBILE/package.json && echo "✅ CRM-MOBILE exists" || echo "❌ CRM-MOBILE missing"'
echo ""

# If code doesn't exist, wait for GitHub Actions
echo "=== Waiting for GitHub Actions (if needed) ==="
sleep 30
echo ""

# Start services
echo "=== Starting all services ==="
sshpass -p "$PASS" ssh -p $PORT $SERVER << 'EOF'
pm2 start crm-backend
pm2 start crm-frontend
pm2 start crm-mobile
sleep 10
pm2 list
EOF
echo ""

# Verify health
echo "=== Verifying health ==="
sleep 5
curl -s https://example.com/api/health | jq .
echo ""

echo "========================================="
echo "✅ VERIFICATION COMPLETE!"
echo "========================================="

