#!/bin/bash

###############################################################################
# Production Case Cleanup Script
# 
# This script is designed to run on the production server (SERVER_IP)
# It removes all cases, tasks, attachments from database, filesystem, and cache
#
# Usage: Run this script on the production server as root
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info "=========================================="
print_info "PRODUCTION CASE CLEANUP"
print_info "Server: SERVER_IP"
print_info "=========================================="
echo ""

# Production configuration — DB credentials must come from env vars
# Required env vars: DB_USER, DB_PASSWORD
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-acs_db}"
DB_USER="${DB_USER:?DB_USER is required (export or source a dotenv file)}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required (export or source a dotenv file)}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
UPLOAD_DIR="${UPLOAD_DIR:-/opt/crm-app/current/CRM-BACKEND/uploads}"

print_warning "⚠️  WARNING: This will permanently delete ALL CASES from PRODUCTION!"
echo ""
echo "This includes:"
echo "   - All cases from database"
echo "   - All verification tasks from database"
echo "   - All case attachments from database"
echo "   - All attachment files from server"
echo "   - All case-related cache entries"
echo ""
read -p "Type 'DELETE ALL CASES' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE ALL CASES" ]; then
    print_info "Operation cancelled"
    exit 0
fi

echo ""
print_info "Starting production cleanup..."
echo ""

# Count records
print_info "Counting records..."
CASE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM cases;" | xargs)
TASK_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM verification_tasks;" | xargs)
ATTACHMENT_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM attachments WHERE case_id IS NOT NULL;" | xargs)
VERIFICATION_ATTACHMENT_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM verification_attachments;" | xargs)

echo "Found: $CASE_COUNT cases, $TASK_COUNT tasks, $ATTACHMENT_COUNT attachments, $VERIFICATION_ATTACHMENT_COUNT verification attachments"
echo ""

if [ "$CASE_COUNT" -eq 0 ]; then
    print_success "No cases found. Database is already clean!"
    exit 0
fi

# Backup attachment paths
print_info "Backing up attachment file paths..."
ATTACHMENT_LIST="/tmp/attachments_production_$(date +%Y%m%d_%H%M%S).txt"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
    "SELECT \"filePath\" FROM attachments WHERE case_id IS NOT NULL AND \"filePath\" IS NOT NULL
     UNION
     SELECT \"filePath\" FROM verification_attachments WHERE \"filePath\" IS NOT NULL;" > "$ATTACHMENT_LIST"
print_success "Saved to: $ATTACHMENT_LIST"
echo ""

# Delete files
print_info "Deleting attachment files..."
DELETED_FILES=0
while IFS= read -r file_path; do
    file_path=$(echo "$file_path" | xargs)
    if [ -z "$file_path" ]; then continue; fi
    
    if [[ "$file_path" == /* ]]; then
        FULL_PATH="$file_path"
    else
        FULL_PATH="$UPLOAD_DIR/$file_path"
    fi
    
    if [ -f "$FULL_PATH" ]; then
        rm -f "$FULL_PATH"
        ((DELETED_FILES++))
    fi
done < "$ATTACHMENT_LIST"
print_success "Deleted $DELETED_FILES files"
echo ""

# Clean empty directories
print_info "Cleaning empty directories..."
if [ -d "$UPLOAD_DIR" ]; then
    find "$UPLOAD_DIR" -type d -empty -delete 2>/dev/null || true
fi
print_success "Done"
echo ""

# Delete from database
print_info "Deleting from database..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
DELETE FROM verification_attachments;
DELETE FROM attachments WHERE case_id IS NOT NULL;
DELETE FROM verification_tasks;
DELETE FROM cases;
ALTER SEQUENCE cases_id_seq RESTART WITH 1;
ALTER SEQUENCE verification_tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE attachments_id_seq RESTART WITH 1;
ALTER SEQUENCE verification_attachments_id_seq RESTART WITH 1;
EOF
print_success "Database cleaned and sequences reset"
echo ""

# Clear Redis cache
print_info "Clearing Redis cache..."
redis-cli -h $REDIS_HOST -p $REDIS_PORT KEYS "cases:*" | xargs -r redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL > /dev/null 2>&1 || true
redis-cli -h $REDIS_HOST -p $REDIS_PORT KEYS "case:*" | xargs -r redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL > /dev/null 2>&1 || true
redis-cli -h $REDIS_HOST -p $REDIS_PORT KEYS "analytics:*" | xargs -r redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL > /dev/null 2>&1 || true
redis-cli -h $REDIS_HOST -p $REDIS_PORT KEYS "dashboard:*" | xargs -r redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL > /dev/null 2>&1 || true
redis-cli -h $REDIS_HOST -p $REDIS_PORT KEYS "mobile:*" | xargs -r redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL > /dev/null 2>&1 || true
print_success "Cache cleared"
echo ""

# Verify
print_info "Verifying cleanup..."
REMAINING=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM cases;" | xargs)
if [ "$REMAINING" -eq 0 ]; then
    print_success "✅ Cleanup verified - 0 cases remaining"
else
    print_error "⚠️  Warning: $REMAINING cases still remain"
fi

echo ""
print_success "=========================================="
print_success "PRODUCTION CLEANUP COMPLETE"
print_success "=========================================="
echo "Deleted: $CASE_COUNT cases, $TASK_COUNT tasks, $ATTACHMENT_COUNT attachments"
echo "Files deleted: $DELETED_FILES"
echo "Attachment list: $ATTACHMENT_LIST"
echo ""

