#!/bin/bash

###############################################################################
# Complete Case Cleanup Script
# 
# This script removes:
# 1. All cases from database
# 2. All verification tasks from database
# 3. All case attachments from database
# 4. All attachment files from server filesystem
# 5. All case-related Redis cache entries
#
# Usage: ./cleanup-all-cases.sh [development|production]
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if environment parameter is provided
if [ -z "$1" ]; then
    print_error "Environment parameter required!"
    echo "Usage: $0 [development|production]"
    exit 1
fi

ENVIRONMENT=$1

# Validate environment
if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "production" ]; then
    print_error "Invalid environment: $ENVIRONMENT"
    echo "Must be either 'development' or 'production'"
    exit 1
fi

print_info "=========================================="
print_info "COMPLETE CASE CLEANUP - $ENVIRONMENT"
print_info "=========================================="
echo ""

# Configuration based on environment
if [ "$ENVIRONMENT" == "development" ]; then
    DB_HOST="localhost"
    DB_PORT="5432"
    DB_NAME="acs_db"
    DB_USER="example_db_user"
    DB_PASSWORD="example_db_password"
    REDIS_HOST="localhost"
    REDIS_PORT="6379"
    UPLOAD_DIR="./CRM-BACKEND/uploads"
    print_info "Environment: DEVELOPMENT (Local)"
else
    DB_HOST="localhost"
    DB_PORT="5432"
    DB_NAME="acs_db"
    DB_USER="example_db_user"
    DB_PASSWORD="example_db_password"
    REDIS_HOST="localhost"
    REDIS_PORT="6379"
    UPLOAD_DIR="/opt/crm-app/current/CRM-BACKEND/uploads"
    print_info "Environment: PRODUCTION (Server: SERVER_IP)"
fi

echo ""
print_warning "⚠️  WARNING: This will permanently delete:"
echo "   - All cases from database"
echo "   - All verification tasks from database"
echo "   - All case attachments from database"
echo "   - All attachment files from filesystem"
echo "   - All case-related cache entries"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Operation cancelled by user"
    exit 0
fi

echo ""
print_info "Starting cleanup process..."
echo ""

###############################################################################
# Step 1: Get count of records before deletion
###############################################################################

print_info "Step 1: Counting records before deletion..."

CASE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM cases;" | xargs)
TASK_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM verification_tasks;" | xargs)
ATTACHMENT_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM attachments WHERE case_id IS NOT NULL;" | xargs)
VERIFICATION_ATTACHMENT_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM verification_attachments;" | xargs)

print_info "Found:"
echo "   - Cases: $CASE_COUNT"
echo "   - Verification Tasks: $TASK_COUNT"
echo "   - Case Attachments: $ATTACHMENT_COUNT"
echo "   - Verification Attachments: $VERIFICATION_ATTACHMENT_COUNT"
echo ""

if [ "$CASE_COUNT" -eq 0 ] && [ "$TASK_COUNT" -eq 0 ] && [ "$ATTACHMENT_COUNT" -eq 0 ] && [ "$VERIFICATION_ATTACHMENT_COUNT" -eq 0 ]; then
    print_success "No cases found. Database is already clean!"
else
    ###############################################################################
    # Step 2: Backup attachment file paths before deletion
    ###############################################################################

    print_info "Step 2: Backing up attachment file paths..."

    ATTACHMENT_LIST="/tmp/attachments_to_delete_${ENVIRONMENT}_$(date +%Y%m%d_%H%M%S).txt"

    # Get file paths from both attachments and verification_attachments tables
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
        "SELECT \"filePath\" FROM attachments WHERE case_id IS NOT NULL AND \"filePath\" IS NOT NULL
         UNION
         SELECT \"filePath\" FROM verification_attachments WHERE \"filePath\" IS NOT NULL;" > "$ATTACHMENT_LIST"

    ATTACHMENT_FILE_COUNT=$(wc -l < "$ATTACHMENT_LIST" | xargs)
    print_success "Saved $ATTACHMENT_FILE_COUNT attachment file paths to: $ATTACHMENT_LIST"
    echo ""

    ###############################################################################
    # Step 3: Delete attachment files from filesystem
    ###############################################################################

    print_info "Step 3: Deleting attachment files from filesystem..."

    DELETED_FILES=0
    MISSING_FILES=0

    while IFS= read -r file_path; do
        # Trim whitespace
        file_path=$(echo "$file_path" | xargs)
        
        if [ -z "$file_path" ]; then
            continue
        fi

        # Construct full path
        if [[ "$file_path" == /* ]]; then
            # Absolute path
            FULL_PATH="$file_path"
        else
            # Relative path
            FULL_PATH="$UPLOAD_DIR/$file_path"
        fi

        if [ -f "$FULL_PATH" ]; then
            rm -f "$FULL_PATH"
            ((DELETED_FILES++))
            print_success "Deleted: $FULL_PATH"
        else
            ((MISSING_FILES++))
            print_warning "File not found: $FULL_PATH"
        fi
    done < "$ATTACHMENT_LIST"

    print_success "Deleted $DELETED_FILES files from filesystem"
    if [ $MISSING_FILES -gt 0 ]; then
        print_warning "$MISSING_FILES files were already missing"
    fi
    echo ""

    ###############################################################################
    # Step 4: Clean up empty directories
    ###############################################################################

    print_info "Step 4: Cleaning up empty directories..."

    if [ -d "$UPLOAD_DIR" ]; then
        find "$UPLOAD_DIR" -type d -empty -delete 2>/dev/null || true
        print_success "Removed empty directories from: $UPLOAD_DIR"
    fi
    echo ""

    ###############################################################################
    # Step 5: Delete records from database
    ###############################################################################

    print_info "Step 5: Deleting records from database..."

    # Delete in correct order to respect foreign key constraints
    print_info "Deleting verification_attachments..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "DELETE FROM verification_attachments;" > /dev/null
    print_success "Deleted all verification_attachments"

    print_info "Deleting attachments (case-related)..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "DELETE FROM attachments WHERE case_id IS NOT NULL;" > /dev/null
    print_success "Deleted all case attachments"

    print_info "Deleting verification_tasks..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "DELETE FROM verification_tasks;" > /dev/null
    print_success "Deleted all verification_tasks"

    print_info "Deleting cases..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "DELETE FROM cases;" > /dev/null
    print_success "Deleted all cases"

    echo ""

    ###############################################################################
    # Step 6: Reset auto-increment sequences
    ###############################################################################

    print_info "Step 6: Resetting auto-increment sequences..."

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "ALTER SEQUENCE cases_id_seq RESTART WITH 1;" > /dev/null 2>&1 || true
    print_success "Reset cases_id_seq to 1"

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "ALTER SEQUENCE verification_tasks_id_seq RESTART WITH 1;" > /dev/null 2>&1 || true
    print_success "Reset verification_tasks_id_seq to 1"

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "ALTER SEQUENCE attachments_id_seq RESTART WITH 1;" > /dev/null 2>&1 || true
    print_success "Reset attachments_id_seq to 1"

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "ALTER SEQUENCE verification_attachments_id_seq RESTART WITH 1;" > /dev/null 2>&1 || true
    print_success "Reset verification_attachments_id_seq to 1"

    echo ""
fi

###############################################################################
# Step 7: Clear Redis cache
###############################################################################

print_info "Step 7: Clearing Redis cache..."

# Clear all case-related cache keys
CACHE_PATTERNS=(
    "cases:*"
    "case:*"
    "analytics:*"
    "dashboard:*"
    "user:*:cases"
    "mobile:*"
)

CLEARED_KEYS=0

for pattern in "${CACHE_PATTERNS[@]}"; do
    print_info "Clearing cache pattern: $pattern"
    
    # Get all keys matching pattern
    KEYS=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT KEYS "$pattern" 2>/dev/null || echo "")
    
    if [ -n "$KEYS" ]; then
        # Delete keys
        echo "$KEYS" | xargs -r redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL > /dev/null 2>&1 || true
        KEY_COUNT=$(echo "$KEYS" | wc -l | xargs)
        ((CLEARED_KEYS += KEY_COUNT))
        print_success "Cleared $KEY_COUNT keys for pattern: $pattern"
    else
        print_info "No keys found for pattern: $pattern"
    fi
done

print_success "Total cache keys cleared: $CLEARED_KEYS"
echo ""

###############################################################################
# Step 8: Verify cleanup
###############################################################################

print_info "Step 8: Verifying cleanup..."

REMAINING_CASES=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM cases;" | xargs)
REMAINING_TASKS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM verification_tasks;" | xargs)
REMAINING_ATTACHMENTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM attachments WHERE case_id IS NOT NULL;" | xargs)
REMAINING_VERIFICATION_ATTACHMENTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM verification_attachments;" | xargs)

print_info "Remaining records:"
echo "   - Cases: $REMAINING_CASES"
echo "   - Verification Tasks: $REMAINING_TASKS"
echo "   - Case Attachments: $REMAINING_ATTACHMENTS"
echo "   - Verification Attachments: $REMAINING_VERIFICATION_ATTACHMENTS"
echo ""

if [ "$REMAINING_CASES" -eq 0 ] && [ "$REMAINING_TASKS" -eq 0 ] && [ "$REMAINING_ATTACHMENTS" -eq 0 ] && [ "$REMAINING_VERIFICATION_ATTACHMENTS" -eq 0 ]; then
    print_success "✅ Database cleanup verified successfully!"
else
    print_error "⚠️  Warning: Some records still remain in database"
fi

###############################################################################
# Step 9: Summary
###############################################################################

echo ""
print_info "=========================================="
print_info "CLEANUP SUMMARY - $ENVIRONMENT"
print_info "=========================================="
echo ""
print_success "Database Records Deleted:"
echo "   - Cases: $CASE_COUNT"
echo "   - Verification Tasks: $TASK_COUNT"
echo "   - Attachments: $ATTACHMENT_COUNT"
echo ""
print_success "Filesystem Cleanup:"
echo "   - Files Deleted: $DELETED_FILES"
echo "   - Files Missing: $MISSING_FILES"
echo "   - Attachment List: $ATTACHMENT_LIST"
echo ""
print_success "Cache Cleanup:"
echo "   - Keys Cleared: $CLEARED_KEYS"
echo ""
print_success "Sequences Reset:"
echo "   - cases_id_seq: Reset to 1"
echo "   - verification_tasks_id_seq: Reset to 1"
echo "   - attachments_id_seq: Reset to 1"
echo "   - verification_attachments_id_seq: Reset to 1"
echo ""
print_success "✅ Complete case cleanup finished successfully!"
echo ""

