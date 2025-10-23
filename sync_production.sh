#!/bin/bash
set -e

SERVER="root@49.50.119.155"
PORT="2232"
PASS="Tr54V5&u89m#2n7"

echo "========================================="
echo "🔄 SYNCING PRODUCTION WITH DEVELOPMENT"
echo "========================================="
echo ""

# Step 1: Clean production code
echo "=== Step 1: Cleaning production code ==="
sshpass -p "$PASS" ssh -p $PORT $SERVER << 'EOF'
pm2 stop all
cd /opt/crm-app/current
rm -rf CRM-BACKEND CRM-FRONTEND CRM-MOBILE
mkdir -p CRM-BACKEND CRM-FRONTEND CRM-MOBILE
ls -la
EOF
echo "✅ Production cleaned"
echo ""

# Step 2: Trigger GitHub Actions deployment
echo "=== Step 2: Pushing to GitHub to trigger deployment ==="
git add -A
git commit -m "trigger: full production sync" --allow-empty
git push origin main
echo "✅ Code pushed to GitHub"
echo ""

echo "=== Waiting for GitHub Actions deployment (120 seconds) ==="
sleep 120
echo ""

# Step 3: Transfer and import database
echo "=== Step 3: Transferring development database ==="
sshpass -p "$PASS" scp -P $PORT ~/Downloads/complete_dev_database_20251023_155012.dump $SERVER:/tmp/dev_db.dump
echo "✅ Database transferred"
echo ""

# Step 4: Import database
echo "=== Step 4: Importing database on production ==="
sshpass -p "$PASS" ssh -p $PORT $SERVER << 'EOF'
sudo -u postgres psql -c 'DROP DATABASE IF EXISTS acs_db;'
sudo -u postgres psql -c 'CREATE DATABASE acs_db OWNER acs_user;'
PGPASSWORD=acs_password pg_restore -h localhost -U acs_user -d acs_db /tmp/dev_db.dump
redis-cli FLUSHALL
echo "Database imported and cache cleared"
EOF
echo "✅ Database imported"
echo ""

# Step 5: Verify deployment
echo "=== Step 5: Verifying services ==="
sshpass -p "$PASS" ssh -p $PORT $SERVER << 'EOF'
pm2 list
curl -s http://localhost:3000/health | jq .
EOF
echo ""

echo "========================================="
echo "✅ PRODUCTION SYNC COMPLETE!"
echo "========================================="
echo ""
echo "Test URLs:"
echo "- API: https://crm.allcheckservices.com/api/health"
echo "- Web: https://crm.allcheckservices.com/"
echo "- Mobile: https://crm.allcheckservices.com/mobile/"

