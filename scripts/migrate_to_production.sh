#!/bin/bash

# Production Database Migration Script
# This script will:
# 1. Backup production database
# 2. Clear production database
# 3. Import local database to production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Production server details — ALL CREDENTIALS MUST COME FROM ENV VARS
# Export these before running:
#   PROD_HOST, PROD_PORT, PROD_USER, PROD_PASSWORD
#   PROD_DB_USER, PROD_DB_PASSWORD, PROD_DB_NAME
#   LOCAL_DB_USER, LOCAL_DB_NAME
PROD_HOST="${PROD_HOST:?PROD_HOST is required (export or use a dotenv loader)}"
PROD_PORT="${PROD_PORT:?PROD_PORT is required}"
PROD_USER="${PROD_USER:?PROD_USER is required}"
PROD_PASSWORD="${PROD_PASSWORD:?PROD_PASSWORD is required}"
PROD_DB_USER="${PROD_DB_USER:?PROD_DB_USER is required}"
PROD_DB_PASSWORD="${PROD_DB_PASSWORD:?PROD_DB_PASSWORD is required}"
PROD_DB_NAME="${PROD_DB_NAME:?PROD_DB_NAME is required}"

# Local database details
LOCAL_DB_USER="${LOCAL_DB_USER:?LOCAL_DB_USER is required}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:?LOCAL_DB_NAME is required}"

# File paths
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOCAL_EXPORT="/tmp/local_db_full_export_${TIMESTAMP}.sql"
PROD_BACKUP="/tmp/prod_db_backup_${TIMESTAMP}.sql"
REMOTE_BACKUP="/tmp/prod_db_backup_${TIMESTAMP}.sql"
REMOTE_IMPORT="/tmp/local_db_import_${TIMESTAMP}.sql"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}PRODUCTION DATABASE MIGRATION${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "${RED}WARNING: This will DELETE ALL production data!${NC}"
echo -e "${YELLOW}Production Server: ${PROD_HOST}:${PROD_PORT}${NC}"
echo -e "${YELLOW}Production Database: ${PROD_DB_NAME}${NC}"
echo ""
read -p "Are you absolutely sure you want to proceed? (type 'YES' to continue): " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo -e "${RED}Migration cancelled.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Exporting local database...${NC}"
pg_dump -U ${LOCAL_DB_USER} -d ${LOCAL_DB_NAME} \
    --clean --if-exists --no-owner --no-acl \
    -f ${LOCAL_EXPORT}

if [ ! -f ${LOCAL_EXPORT} ]; then
    echo -e "${RED}Failed to export local database!${NC}"
    exit 1
fi

LOCAL_SIZE=$(ls -lh ${LOCAL_EXPORT} | awk '{print $5}')
echo -e "${GREEN}✓ Local database exported: ${LOCAL_EXPORT} (${LOCAL_SIZE})${NC}"

echo ""
echo -e "${GREEN}Step 2: Backing up production database...${NC}"

# Create backup of production database via SSH
sshpass -p "${PROD_PASSWORD}" ssh -p ${PROD_PORT} -o StrictHostKeyChecking=no ${PROD_USER}@${PROD_HOST} << EOF
export PGPASSWORD="${PROD_DB_PASSWORD}"
pg_dump -U ${PROD_DB_USER} -d ${PROD_DB_NAME} \
    --clean --if-exists --no-owner --no-acl \
    -f ${REMOTE_BACKUP}
echo "Production backup created: ${REMOTE_BACKUP}"
ls -lh ${REMOTE_BACKUP}
EOF

echo -e "${GREEN}✓ Production database backed up${NC}"

echo ""
echo -e "${GREEN}Step 3: Copying local export to production server...${NC}"

# Copy local export to production server
sshpass -p "${PROD_PASSWORD}" scp -P ${PROD_PORT} -o StrictHostKeyChecking=no \
    ${LOCAL_EXPORT} ${PROD_USER}@${PROD_HOST}:${REMOTE_IMPORT}

echo -e "${GREEN}✓ Local export copied to production server${NC}"

echo ""
echo -e "${GREEN}Step 4: Clearing production database and importing local data...${NC}"

# Drop and recreate database, then import
sshpass -p "${PROD_PASSWORD}" ssh -p ${PROD_PORT} -o StrictHostKeyChecking=no ${PROD_USER}@${PROD_HOST} << EOF
export PGPASSWORD="${PROD_DB_PASSWORD}"

echo "Terminating existing connections..."
psql -U ${PROD_DB_USER} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PROD_DB_NAME}' AND pid <> pg_backend_pid();"

echo "Dropping database..."
psql -U ${PROD_DB_USER} -d postgres -c "DROP DATABASE IF EXISTS ${PROD_DB_NAME};"

echo "Creating fresh database..."
psql -U ${PROD_DB_USER} -d postgres -c "CREATE DATABASE ${PROD_DB_NAME} OWNER ${PROD_DB_USER};"

echo "Importing local data..."
psql -U ${PROD_DB_USER} -d ${PROD_DB_NAME} -f ${REMOTE_IMPORT}

echo "Verifying import..."
psql -U ${PROD_DB_USER} -d ${PROD_DB_NAME} -c "\dt"
psql -U ${PROD_DB_USER} -d ${PROD_DB_NAME} -c "SELECT 'cases' as table_name, COUNT(*) as count FROM cases UNION ALL SELECT 'verification_tasks', COUNT(*) FROM verification_tasks UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'clients', COUNT(*) FROM clients UNION ALL SELECT 'products', COUNT(*) FROM products;"

echo "Cleaning up import file..."
rm -f ${REMOTE_IMPORT}
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MIGRATION COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Backup files:${NC}"
echo -e "  Local export: ${LOCAL_EXPORT}"
echo -e "  Production backup: ${REMOTE_BACKUP} (on production server)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Verify the production application is working correctly"
echo -e "  2. Test critical functionality (login, case creation, etc.)"
echo -e "  3. If everything works, you can delete the backup files"
echo -e "  4. Restart the production backend: systemctl restart crm-backend"
echo ""

