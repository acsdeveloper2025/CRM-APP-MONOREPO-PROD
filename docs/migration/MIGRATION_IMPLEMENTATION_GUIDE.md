# Database Migration Implementation Guide

## Step-by-Step Implementation

This guide provides the exact code changes needed to integrate database migrations into the GitHub Actions deployment pipeline.

---

## Step 1: Add Migration Function to Deployment Script

**File:** `scripts/deploy-production.sh`

**Location:** Add this function after the `build_applications()` function (around line 356)

```bash
# Run database migrations
run_database_migrations() {
    print_header "🗄️ Running Database Migrations"
    
    cd "$PROJECT_ROOT/CRM-BACKEND"
    
    # Check if migrations directory exists
    if [ ! -d "migrations" ]; then
        print_warning "Migrations directory not found, skipping migrations"
        return 0
    fi
    
    # Count migration files
    local migration_count=$(find migrations -name "*.sql" 2>/dev/null | wc -l)
    print_info "Found $migration_count migration file(s)"
    
    # Check migration status
    print_info "Checking migration status..."
    if npm run migrate:status 2>&1 | tee -a "$LOG_FILE"; then
        print_status "Migration status check completed"
    else
        print_warning "Could not check migration status (this is normal for first run)"
    fi
    
    # Execute pending migrations
    print_info "Executing pending migrations..."
    if npm run migrate 2>&1 | tee -a "$LOG_FILE"; then
        print_status "✅ Database migrations completed successfully"
    else
        local exit_code=$?
        print_error "❌ Database migration failed with exit code: $exit_code"
        print_error "Deployment HALTED - Services will NOT be started"
        print_error "Database backup available at: $(cat /tmp/current_backup_path 2>/dev/null || echo 'Unknown')"
        print_error ""
        print_error "To rollback:"
        print_error "  1. Restore database: PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db < BACKUP_PATH/database.sql"
        print_error "  2. Restore code: cp -r BACKUP_PATH/code/* $PROJECT_ROOT/"
        print_error "  3. Restart services: cd $PROJECT_ROOT && ./start-production.sh"
        exit 1
    fi
    
    # Verify migration success
    print_info "Verifying migration status..."
    npm run migrate:status 2>&1 | tee -a "$LOG_FILE"
    
    print_status "Database migrations completed"
}
```

---

## Step 2: Update Main Deployment Function

**File:** `scripts/deploy-production.sh`

**Location:** Update the `main()` function (around line 629-661)

**Change:**
```bash
# Main deployment function
main() {
    print_header "🚀 CRM Production Deployment Started"
    print_header "======================================"

    # Initialize
    create_directories
    parse_deployment_info

    # Pre-deployment
    create_backup
    create_release
    stop_services

    # Deployment
    update_code
    install_dependencies
    setup_environment_files
    configure_nginx
    build_applications
    
    # ⭐ NEW: Run database migrations
    run_database_migrations
    
    clear_caches

    # Post-deployment
    start_services

    # Cleanup after successful deployment
    cleanup_old_deployments

    print_header "🎉 Deployment Completed Successfully!"
    print_status "Deployment completed at $(date)"
    print_status "Commit: $COMMIT_SHA"
    print_status "Author: $AUTHOR"
    print_status "Release: $RELEASE_NAME"
}
```

---

## Step 3: Create Sample Migration File (For Testing)

**File:** `CRM-BACKEND/migrations/001_test_migration_system.sql`

```sql
-- Migration: Test Migration System
-- Created: 2025-10-24
-- Author: System
-- Purpose: Verify that the migration system is working correctly

-- This migration creates a test table to verify the migration system
-- It can be safely removed after confirming migrations work in production

-- Create test table
CREATE TABLE IF NOT EXISTS migration_test (
    id SERIAL PRIMARY KEY,
    test_message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test record
INSERT INTO migration_test (test_message) 
VALUES ('Migration system is working correctly!')
ON CONFLICT DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_migration_test_created_at 
ON migration_test(created_at);

-- Validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'migration_test'
    ) THEN
        RAISE EXCEPTION 'Migration failed: migration_test table was not created';
    END IF;
    
    RAISE NOTICE 'Migration validation passed: migration_test table created successfully';
END $$;
```

---

## Step 4: Update GitHub Actions Workflow (Optional Enhancement)

**File:** `.github/workflows/deploy-production.yml`

**Location:** Add after the "📋 Deployment Summary" step (around line 74-81)

```yaml
      - name: 🗄️ Check for Database Changes
        id: db_changes
        run: |
          # Check if migration files changed
          if git diff --name-only HEAD~1 HEAD | grep -E '^CRM-BACKEND/migrations/.*\.sql$'; then
            echo "migrations_changed=true" >> $GITHUB_OUTPUT
            echo "🔄 Database migrations detected"
          else
            echo "migrations_changed=false" >> $GITHUB_OUTPUT
            echo "ℹ️ No database migrations"
          fi

      - name: 📋 Deployment Summary
        run: |
          echo "## 📋 Deployment Plan" >> $GITHUB_STEP_SUMMARY
          echo "| Component | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-----------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Backend | ${{ steps.changes.outputs.backend == 'true' && '🔄 Deploy' || '⏭️ Skip' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Frontend | ${{ steps.changes.outputs.frontend == 'true' && '🔄 Deploy' || '⏭️ Skip' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Mobile | ${{ steps.changes.outputs.mobile == 'true' && '🔄 Deploy' || '⏭️ Skip' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Database | ${{ steps.db_changes.outputs.migrations_changed == 'true' && '🗄️ Migrate' || '⏭️ Skip' }} |" >> $GITHUB_STEP_SUMMARY
```

**Location:** Add after the "📊 Deployment Summary" step (around line 286-298)

```yaml
      - name: 📊 Deployment Summary
        if: always()
        run: |
          echo "## 🚀 Deployment Complete" >> $GITHUB_STEP_SUMMARY
          echo "- **Timestamp:** $(date -u)" >> $GITHUB_STEP_SUMMARY
          echo "- **Commit:** ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Author:** ${{ github.event.head_commit.author.name }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Status:** ${{ job.status }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### 🗄️ Database Migrations" >> $GITHUB_STEP_SUMMARY
          echo "Check deployment logs for migration details" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### 🔗 Quick Links" >> $GITHUB_STEP_SUMMARY
          echo "- [Production Site](https://example.com)" >> $GITHUB_STEP_SUMMARY
          echo "- [API Health](https://example.com/health)" >> $GITHUB_STEP_SUMMARY
          echo "- [Mobile App](https://example.com/mobile/)" >> $GITHUB_STEP_SUMMARY
```

---

## Step 5: Verify Production Database Setup

**Run this command to check if production has the schema_migrations table:**

```bash
ssh -p 2232 root@SERVER_IP << 'EOF'
  PGPASSWORD=example_db_password psql -h localhost -p 5432 -U example_db_user -d acs_db -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'schema_migrations'
    ) as table_exists;
  "
EOF
```

**If the table doesn't exist, create it:**

```bash
ssh -p 2232 root@SERVER_IP << 'EOF'
  cd /opt/crm-app/current/CRM-BACKEND
  npm run migrate:status
EOF
```

This will automatically create the `schema_migrations` table if it doesn't exist.

---

## Step 6: Testing Procedure

### 6.1 Local Testing

**Test 1: Verify migration runner works**
```bash
cd CRM-BACKEND
npm run migrate:status
```

**Expected Output:**
```
[INFO] 📋 Migration Status:
[INFO] Total migrations: 1
[INFO] Executed: 0
[INFO] Pending: 1
[INFO]   001_test_migration_system.sql: ⏳ Pending
```

**Test 2: Execute migration locally**
```bash
npm run migrate
```

**Expected Output:**
```
[INFO] 🚀 Starting multi-verification migrations...
[INFO] Migrations tracking table ready
[INFO] Executing migration: 001_test_migration_system.sql
[INFO] ✅ Migration 001_test_migration_system.sql completed successfully
[INFO] ✅ All migrations completed successfully
```

**Test 3: Verify migration was recorded**
```bash
npm run migrate:status
```

**Expected Output:**
```
[INFO] 📋 Migration Status:
[INFO] Total migrations: 1
[INFO] Executed: 1
[INFO] Pending: 0
[INFO]   001_test_migration_system.sql: ✅ Executed
```

### 6.2 Production Testing

**Test 1: Dry-run deployment (without actual deployment)**
```bash
# SSH to production server
ssh -p 2232 root@SERVER_IP

# Navigate to project
cd /opt/crm-app/current/CRM-BACKEND

# Check migration status
npm run migrate:status
```

**Test 2: Full deployment with migration**
```bash
# Commit and push the migration file
git add CRM-BACKEND/migrations/001_test_migration_system.sql
git commit -m "test: Add test migration to verify migration system"
git push origin main

# Monitor GitHub Actions workflow
# Check deployment logs for migration execution
```

**Test 3: Verify migration in production database**
```bash
ssh -p 2232 root@SERVER_IP << 'EOF'
  PGPASSWORD=example_db_password psql -h localhost -p 5432 -U example_db_user -d acs_db -c "
    SELECT * FROM schema_migrations ORDER BY executed_at DESC LIMIT 5;
  "
EOF
```

---

## Step 7: Rollback Procedure

### Automatic Rollback (Transaction-level)

If a migration fails, the transaction is automatically rolled back by the migration runner. No manual intervention needed.

### Manual Rollback (Full Deployment)

**If deployment fails after migration:**

```bash
# 1. SSH to production server
ssh -p 2232 root@SERVER_IP

# 2. Find latest backup
cd /opt/crm-app/shared/backups
LATEST_BACKUP=$(ls -t | grep "crm-backup-" | head -1)
echo "Latest backup: $LATEST_BACKUP"

# 3. Restore database
PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db < "$LATEST_BACKUP/database.sql"

# 4. Restore code
cd /opt/crm-app/current
rm -rf *
cp -r "/opt/crm-app/shared/backups/$LATEST_BACKUP/code/"* .

# 5. Restart services
./start-production.sh

# 6. Verify services are running
pm2 list
```

---

## Step 8: Migration File Naming Convention

**Format:** `<sequence>_<description>.sql`

**Examples:**
- `001_test_migration_system.sql`
- `002_add_document_type_table.sql`
- `003_add_client_document_mapping.sql`
- `004_create_document_type_indexes.sql`
- `005_migrate_existing_document_data.sql`

**Rules:**
1. Use 3-digit sequence numbers (001, 002, 003, ...)
2. Use lowercase with underscores for description
3. Keep descriptions concise but descriptive
4. Never modify existing migration files (breaks checksum)
5. Always test locally before committing

---

## Step 9: Migration File Template

**Use this template for new migrations:**

```sql
-- Migration: <Brief Description>
-- Created: <YYYY-MM-DD>
-- Author: <Your Name>
-- Purpose: <Detailed explanation of what this migration does and why>

-- Pre-migration validation (optional)
DO $$
BEGIN
    -- Add any checks here to ensure prerequisites are met
    -- Example: Check if required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Required table "users" does not exist';
    END IF;
END $$;

-- Main migration SQL
-- Add your schema changes here

-- Example: Create table
CREATE TABLE IF NOT EXISTS new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example: Create index
CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table(name);

-- Example: Add column to existing table
ALTER TABLE existing_table 
ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);

-- Post-migration validation (optional)
DO $$
BEGIN
    -- Verify migration succeeded
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'new_table') THEN
        RAISE EXCEPTION 'Migration failed: new_table was not created';
    END IF;
    
    RAISE NOTICE 'Migration validation passed';
END $$;
```

---

## Step 10: Monitoring & Troubleshooting

### Check Migration Status

**Development:**
```bash
cd CRM-BACKEND
npm run migrate:status
```

**Production:**
```bash
ssh -p 2232 root@SERVER_IP << 'EOF'
  cd /opt/crm-app/current/CRM-BACKEND
  npm run migrate:status
EOF
```

### View Migration History

**Query:**
```sql
SELECT 
    id,
    filename,
    executed_at,
    execution_time_ms,
    success
FROM schema_migrations
ORDER BY executed_at DESC
LIMIT 10;
```

### Check Deployment Logs

**Production:**
```bash
ssh -p 2232 root@SERVER_IP
tail -f /var/log/crm-app/deployment.log
```

### Common Issues

**Issue 1: Migration fails with "relation already exists"**
- **Solution:** Use `IF NOT EXISTS` in CREATE statements

**Issue 2: Migration fails with "column already exists"**
- **Solution:** Use `ADD COLUMN IF NOT EXISTS` in ALTER statements

**Issue 3: Migration checksum mismatch**
- **Solution:** Never modify existing migration files. Create a new migration instead.

**Issue 4: Migration timeout**
- **Solution:** Break large migrations into smaller chunks or run during off-peak hours

---

## Summary

This implementation guide provides all the code changes needed to integrate database migrations into the deployment pipeline. The key changes are:

1. ✅ Add `run_database_migrations()` function to `deploy-production.sh`
2. ✅ Call the function in the `main()` deployment flow
3. ✅ Create test migration file to verify the system works
4. ✅ (Optional) Update GitHub Actions workflow to show migration status

**Estimated Time:** 1-2 hours
**Risk Level:** Low (with proper testing)
**Rollback:** Automatic (transaction-based) + Manual (database backup)

