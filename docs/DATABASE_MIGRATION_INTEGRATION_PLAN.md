# Database Migration Integration Plan for GitHub Actions Deployment

## Executive Summary

**Problem:** The current GitHub Actions deployment pipeline does NOT execute database migrations during production deployments. This means schema changes made in development are not automatically applied to production, leading to potential application failures and manual intervention requirements.

**Solution:** Integrate automated database migration execution into the GitHub Actions deployment workflow using the existing `run-migrations.ts` script and `schema_migrations` tracking table.

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure ✅

**Migration System:**
- ✅ Migration runner script exists: `CRM-BACKEND/scripts/run-migrations.ts`
- ✅ Migration tracking table exists: `schema_migrations` (in development database)
- ✅ Migration directory exists: `CRM-BACKEND/migrations/` (currently empty)
- ✅ NPM scripts configured in `CRM-BACKEND/package.json`:
  - `npm run migrate` - Execute pending schema migrations
  - `npm run migrate:data` - Migrate existing data
  - `npm run migrate:status` - Show migration status
  - `npm run migrate:rollback` - Rollback data migration

**Migration Runner Features:**
- ✅ Automatic `schema_migrations` table creation
- ✅ Checksum validation to prevent re-running migrations
- ✅ Transaction-based execution (ACID compliance)
- ✅ Execution time tracking
- ✅ Success/failure status tracking
- ✅ Reads `.sql` files from `CRM-BACKEND/migrations/` directory
- ✅ Sorts migrations alphabetically for deterministic execution order

**Database Configuration:**
- Development: `postgresql://example_db_user:example_db_password@localhost:5432/acs_db`
- Production: `postgresql://example_db_user:example_db_password@localhost:5432/acs_db` (same credentials)

### 1.2 Current Deployment Workflow

**GitHub Actions Workflow:** `.github/workflows/deploy-production.yml`

**Current Steps:**
1. ✅ Pre-deployment validation (detect changes)
2. ✅ Build and test components
3. ✅ Deploy to production server:
   - Create backup (including database dump)
   - Stop services
   - Update code
   - Install dependencies
   - Build applications
   - Setup environment files
   - Configure nginx
   - Clear caches
   - Start services
   - Health check

**Missing Step:** ❌ **Database migration execution**

### 1.3 Deployment Script Analysis

**Script:** `scripts/deploy-production.sh`

**Current Deployment Flow:**
```
create_backup() → Database backup created ✅
create_release() → Code synced ✅
stop_services() → Services stopped ✅
update_code() → Git checkout ✅
install_dependencies() → npm install ✅
setup_environment_files() → .env files created ✅
configure_nginx() → Nginx configured ✅
build_applications() → npm run build ✅
clear_caches() → Redis/nginx cache cleared ✅
start_services() → Services started ✅
```

**Gap Identified:** No migration execution between `build_applications()` and `start_services()`

---

## 2. Risk Assessment

### 2.1 Current Risks (Without Automated Migrations)

| Risk | Severity | Impact |
|------|----------|--------|
| Schema mismatch between code and database | **CRITICAL** | Application crashes, data corruption |
| Manual migration execution required | **HIGH** | Human error, deployment delays |
| Forgotten migrations | **HIGH** | Production incidents, rollback required |
| Inconsistent database state | **MEDIUM** | Data integrity issues |
| No migration tracking in production | **MEDIUM** | Unknown database state |

### 2.2 Proposed Solution Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration failure during deployment | **HIGH** | Pre-deployment backup, transaction rollback, deployment halt |
| Long-running migrations blocking deployment | **MEDIUM** | Migration timeout, async migration option |
| Migration conflicts (multiple deployments) | **LOW** | Checksum validation, transaction locks |
| Rollback complexity | **MEDIUM** | Database backup before migration, manual rollback procedure |

---

## 3. Proposed Solution Architecture

### 3.1 Migration Execution Strategy

**Approach:** Integrate migration execution into the deployment script BEFORE starting services.

**Execution Point:** After `build_applications()` and BEFORE `start_services()`

**Rationale:**
1. ✅ Code is already updated and built
2. ✅ Services are stopped (no active connections)
3. ✅ Database backup already created
4. ✅ Environment files are configured
5. ✅ If migration fails, services won't start (fail-safe)

### 3.2 Migration Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PIPELINE                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. PRE-DEPLOYMENT                                           │
│     - Create database backup ✅                              │
│     - Create code backup ✅                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. CODE UPDATE                                              │
│     - Stop services ✅                                       │
│     - Update code ✅                                         │
│     - Install dependencies ✅                                │
│     - Build applications ✅                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. DATABASE MIGRATION ⭐ NEW STEP                          │
│     - Check migration status                                 │
│     - Execute pending migrations                             │
│     - Validate migration success                             │
│     - HALT deployment if migration fails                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. POST-DEPLOYMENT                                          │
│     - Clear caches ✅                                        │
│     - Start services ✅                                      │
│     - Health check ✅                                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Migration Execution Logic

**Function:** `run_database_migrations()`

**Pseudo-code:**
```bash
run_database_migrations() {
    print_header "🗄️ Running Database Migrations"
    
    cd "$PROJECT_ROOT/CRM-BACKEND"
    
    # 1. Check migration status
    print_info "Checking migration status..."
    npm run migrate:status
    
    # 2. Execute pending migrations
    print_info "Executing pending migrations..."
    if npm run migrate; then
        print_status "✅ Migrations completed successfully"
    else
        print_error "❌ Migration failed!"
        print_error "Deployment halted. Services will NOT be started."
        print_error "Database backup available at: $BACKUP_PATH"
        exit 1
    fi
    
    # 3. Verify migration success
    print_info "Verifying migration status..."
    npm run migrate:status
}
```

---

## 4. Implementation Plan

### Phase 1: Preparation (Development Environment)

**Tasks:**
1. ✅ Verify `schema_migrations` table exists in development ✅ CONFIRMED
2. ✅ Verify migration runner script works ✅ EXISTS
3. ✅ Test migration execution locally
4. ✅ Create sample migration file for testing
5. ✅ Document migration file naming convention

**Migration File Naming Convention:**
```
Format: <sequence>_<description>.sql
Example: 001_add_user_roles.sql
         002_create_audit_log.sql
         003_add_case_status_index.sql
```

### Phase 2: Production Database Setup

**Tasks:**
1. ❓ Verify `schema_migrations` table exists in production database
2. ❓ If not exists, create `schema_migrations` table in production
3. ❓ Baseline existing production schema (mark all current migrations as executed)
4. ❓ Test migration runner on production database (dry-run)

**Production Database Check Command:**
```bash
ssh -p 2232 root@SERVER_IP \
  "PGPASSWORD=example_db_password psql -h localhost -p 5432 -U example_db_user -d acs_db -c '\dt schema_migrations'"
```

### Phase 3: Deployment Script Integration

**File:** `scripts/deploy-production.sh`

**Changes Required:**
1. Add `run_database_migrations()` function after `build_applications()`
2. Update `main()` function to call `run_database_migrations()`
3. Add migration failure handling
4. Add migration logging to deployment log

**Modified Deployment Flow:**
```bash
main() {
    # ... existing code ...
    
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
    
    # ... existing code ...
}
```

### Phase 4: GitHub Actions Workflow Update

**File:** `.github/workflows/deploy-production.yml`

**Changes Required:**
1. Add migration detection step (check if migrations directory has new files)
2. Add migration summary to deployment summary
3. Add migration failure notification

**Optional Enhancement:**
```yaml
- name: 📊 Check for Pending Migrations
  run: |
    ssh -p ${{ secrets.PRODUCTION_SSH_PORT || '2232' }} \
      -o StrictHostKeyChecking=no \
      ${{ secrets.PRODUCTION_USER }}@${{ secrets.PRODUCTION_HOST }} << 'EOF'
      cd /opt/crm-app/current/CRM-BACKEND
      npm run migrate:status
    EOF
```

### Phase 5: Testing & Validation

**Test Cases:**
1. ✅ Deploy with no pending migrations (should skip migration step)
2. ✅ Deploy with 1 pending migration (should execute successfully)
3. ✅ Deploy with multiple pending migrations (should execute in order)
4. ❌ Deploy with failing migration (should halt deployment)
5. ✅ Deploy after failed migration (should resume from last successful)
6. ✅ Verify migration tracking (check `schema_migrations` table)

---

## 5. Safety Measures

### 5.1 Pre-Migration Safety

1. ✅ **Database Backup:** Already implemented in `create_backup()` function
2. ✅ **Code Backup:** Already implemented in `create_backup()` function
3. ✅ **Services Stopped:** Ensures no active connections during migration
4. ✅ **Transaction-based:** Migration runner uses BEGIN/COMMIT/ROLLBACK

### 5.2 Migration Execution Safety

1. ✅ **Checksum Validation:** Prevents re-running modified migrations
2. ✅ **Atomic Execution:** Each migration runs in a transaction
3. ✅ **Execution Tracking:** Records execution time and success status
4. ✅ **Failure Handling:** Deployment halts if migration fails

### 5.3 Rollback Procedure

**Automatic Rollback (Transaction-level):**
- If migration SQL fails, transaction is automatically rolled back
- Database state remains unchanged

**Manual Rollback (Deployment-level):**
```bash
# 1. Restore database from backup
cd /opt/crm-app/shared/backups
LATEST_BACKUP=$(ls -t | grep "crm-backup-" | head -1)
PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db < "$LATEST_BACKUP/database.sql"

# 2. Restore code from backup
cd /opt/crm-app/current
rm -rf *
cp -r "/opt/crm-app/shared/backups/$LATEST_BACKUP/code/"* .

# 3. Restart services
./start-production.sh
```

---

## 6. Migration Best Practices

### 6.1 Writing Migrations

**DO:**
- ✅ Use descriptive filenames (e.g., `008_add_document_type_mapping.sql`)
- ✅ Include comments explaining the purpose
- ✅ Use `IF NOT EXISTS` for CREATE statements
- ✅ Use `IF EXISTS` for DROP statements
- ✅ Test migrations locally before committing
- ✅ Keep migrations small and focused
- ✅ Use transactions (already handled by migration runner)

**DON'T:**
- ❌ Modify existing migration files (breaks checksum validation)
- ❌ Include data-dependent logic without validation
- ❌ Use database-specific syntax (stick to PostgreSQL standard)
- ❌ Drop tables/columns without backup verification
- ❌ Run long-running migrations during peak hours

### 6.2 Migration File Template

```sql
-- Migration: <Description>
-- Created: <Date>
-- Author: <Name>

-- Purpose:
-- <Explain what this migration does and why>

-- Safety checks
DO $$
BEGIN
    -- Add any pre-migration validation here
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Required table "users" does not exist';
    END IF;
END $$;

-- Migration SQL
CREATE TABLE IF NOT EXISTS new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table(name);

-- Post-migration validation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'new_table') THEN
        RAISE EXCEPTION 'Migration failed: new_table was not created';
    END IF;
END $$;
```

---

## 7. Monitoring & Alerting

### 7.1 Migration Metrics

**Track:**
- Number of pending migrations before deployment
- Migration execution time
- Migration success/failure rate
- Database backup size and duration

**Log Location:**
- Deployment log: `/var/log/crm-app/deployment.log`
- Migration output: Included in deployment log
- GitHub Actions summary: Deployment summary section

### 7.2 Failure Notifications

**Current:** GitHub Actions sends email on workflow failure

**Enhancement:** Add migration-specific failure message to deployment summary

---

## 8. Next Steps

### Immediate Actions (Priority 1)

1. **Verify production database has `schema_migrations` table**
   - If not, create it manually or via initial migration
2. **Test migration runner on production database**
   - Create a test migration file
   - Execute on production (dry-run)
3. **Update `deploy-production.sh` script**
   - Add `run_database_migrations()` function
   - Integrate into deployment flow

### Short-term Actions (Priority 2)

4. **Create migration file template and documentation**
5. **Test full deployment with sample migration**
6. **Update GitHub Actions workflow with migration summary**

### Long-term Enhancements (Priority 3)

7. **Add migration dry-run option**
8. **Implement migration rollback scripts**
9. **Add migration performance monitoring**
10. **Create migration review checklist**

---

## 9. Conclusion

The proposed solution leverages existing infrastructure (`run-migrations.ts`, `schema_migrations` table) and integrates seamlessly into the current deployment pipeline. The implementation is low-risk due to:

1. ✅ Pre-deployment database backups
2. ✅ Transaction-based migration execution
3. ✅ Deployment halt on migration failure
4. ✅ Existing migration tracking system

**Estimated Implementation Time:** 2-4 hours
**Risk Level:** Low (with proper testing)
**Impact:** High (eliminates manual migration execution)

---

## Appendix A: File Locations

- Migration runner: `CRM-BACKEND/scripts/run-migrations.ts`
- Migration directory: `CRM-BACKEND/migrations/`
- Deployment script: `scripts/deploy-production.sh`
- GitHub Actions workflow: `.github/workflows/deploy-production.yml`
- Database config: `CRM-BACKEND/src/config/db.ts`

## Appendix B: Database Credentials

- **Development:** `postgresql://example_db_user:example_db_password@localhost:5432/acs_db`
- **Production:** `postgresql://example_db_user:example_db_password@localhost:5432/acs_db`
- **Environment Variable:** `DATABASE_URL` (set in `.env` files)

