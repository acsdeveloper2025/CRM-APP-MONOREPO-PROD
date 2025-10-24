# Database Migration Integration - Quick Checklist

## Pre-Implementation Checklist

### ✅ Verify Existing Infrastructure

- [ ] Confirm `CRM-BACKEND/scripts/run-migrations.ts` exists
- [ ] Confirm `CRM-BACKEND/migrations/` directory exists
- [ ] Confirm `schema_migrations` table exists in development database
- [ ] Test migration runner locally: `cd CRM-BACKEND && npm run migrate:status`
- [ ] Verify NPM scripts work: `npm run migrate`, `npm run migrate:status`

### ❓ Check Production Database

- [ ] SSH to production server: `ssh -p 2232 root@49.50.119.155`
- [ ] Check if `schema_migrations` table exists in production
- [ ] If not, run: `cd /opt/crm-app/current/CRM-BACKEND && npm run migrate:status`
- [ ] Verify production database credentials work

---

## Implementation Checklist

### Step 1: Add Migration Function

**File:** `scripts/deploy-production.sh`

- [ ] Add `run_database_migrations()` function after `build_applications()` (line ~356)
- [ ] Copy function code from implementation guide
- [ ] Verify function includes:
  - [ ] Migration status check
  - [ ] Migration execution
  - [ ] Error handling (exit on failure)
  - [ ] Logging to deployment log

### Step 2: Update Main Function

**File:** `scripts/deploy-production.sh`

- [ ] Update `main()` function (line ~629)
- [ ] Add `run_database_migrations()` call after `build_applications()`
- [ ] Verify order: `build_applications()` → `run_database_migrations()` → `clear_caches()`

### Step 3: Create Test Migration

**File:** `CRM-BACKEND/migrations/001_test_migration_system.sql`

- [ ] Create migration file
- [ ] Copy template from implementation guide
- [ ] Verify SQL syntax is valid
- [ ] Test locally: `cd CRM-BACKEND && npm run migrate`

### Step 4: Update GitHub Actions (Optional)

**File:** `.github/workflows/deploy-production.yml`

- [ ] Add migration detection step (line ~74)
- [ ] Update deployment summary to include migration status (line ~286)
- [ ] Verify YAML syntax is valid

---

## Testing Checklist

### Local Testing

- [ ] **Test 1:** Check migration status
  ```bash
  cd CRM-BACKEND
  npm run migrate:status
  ```
  Expected: Shows pending migration

- [ ] **Test 2:** Execute migration
  ```bash
  npm run migrate
  ```
  Expected: Migration executes successfully

- [ ] **Test 3:** Verify migration recorded
  ```bash
  npm run migrate:status
  ```
  Expected: Shows migration as executed

- [ ] **Test 4:** Verify database changes
  ```bash
  PGPASSWORD=acs_password psql -h localhost -U acs_user -d acs_db -c "\dt migration_test"
  ```
  Expected: Table exists

- [ ] **Test 5:** Check migration history
  ```bash
  PGPASSWORD=acs_password psql -h localhost -U acs_user -d acs_db -c "SELECT * FROM schema_migrations;"
  ```
  Expected: Shows executed migration

### Production Testing (Dry-run)

- [ ] **Test 1:** SSH to production
  ```bash
  ssh -p 2232 root@49.50.119.155
  ```

- [ ] **Test 2:** Check migration status on production
  ```bash
  cd /opt/crm-app/current/CRM-BACKEND
  npm run migrate:status
  ```

- [ ] **Test 3:** Verify deployment script syntax
  ```bash
  bash -n /opt/crm-app/current/scripts/deploy-production.sh
  ```
  Expected: No syntax errors

### Full Deployment Testing

- [ ] **Test 1:** Commit changes
  ```bash
  git add scripts/deploy-production.sh
  git add CRM-BACKEND/migrations/001_test_migration_system.sql
  git commit -m "feat: Add automated database migration to deployment pipeline"
  ```

- [ ] **Test 2:** Push to GitHub
  ```bash
  git push origin main
  ```

- [ ] **Test 3:** Monitor GitHub Actions
  - [ ] Check workflow starts
  - [ ] Check build & test passes
  - [ ] Check deployment starts

- [ ] **Test 4:** Monitor deployment logs
  ```bash
  ssh -p 2232 root@49.50.119.155 "tail -f /var/log/crm-app/deployment.log"
  ```
  - [ ] Look for "🗄️ Running Database Migrations"
  - [ ] Verify migration executes
  - [ ] Verify "✅ Database migrations completed successfully"

- [ ] **Test 5:** Verify migration in production database
  ```bash
  ssh -p 2232 root@49.50.119.155 "PGPASSWORD=acs_password psql -h localhost -U acs_user -d acs_db -c 'SELECT * FROM schema_migrations ORDER BY executed_at DESC LIMIT 5;'"
  ```
  Expected: Shows test migration

- [ ] **Test 6:** Verify services started
  ```bash
  ssh -p 2232 root@49.50.119.155 "pm2 list"
  ```
  Expected: All services running

- [ ] **Test 7:** Health check
  ```bash
  curl https://crm.allcheckservices.com/health
  ```
  Expected: Returns healthy status

---

## Failure Testing Checklist

### Test Migration Failure Scenario

- [ ] **Test 1:** Create intentionally failing migration
  ```sql
  -- File: CRM-BACKEND/migrations/002_test_failure.sql
  -- This migration will fail intentionally
  CREATE TABLE invalid_syntax ERROR;
  ```

- [ ] **Test 2:** Commit and push
  ```bash
  git add CRM-BACKEND/migrations/002_test_failure.sql
  git commit -m "test: Add failing migration to test error handling"
  git push origin main
  ```

- [ ] **Test 3:** Verify deployment halts
  - [ ] Check GitHub Actions shows failure
  - [ ] Check deployment log shows migration error
  - [ ] Verify services are NOT started

- [ ] **Test 4:** Verify database unchanged
  ```bash
  ssh -p 2232 root@49.50.119.155 "PGPASSWORD=acs_password psql -h localhost -U acs_user -d acs_db -c 'SELECT * FROM schema_migrations ORDER BY executed_at DESC LIMIT 5;'"
  ```
  Expected: Failing migration NOT recorded

- [ ] **Test 5:** Remove failing migration
  ```bash
  git rm CRM-BACKEND/migrations/002_test_failure.sql
  git commit -m "test: Remove failing migration"
  git push origin main
  ```

- [ ] **Test 6:** Verify deployment succeeds
  - [ ] Check GitHub Actions shows success
  - [ ] Verify services started

---

## Rollback Testing Checklist

### Test Manual Rollback Procedure

- [ ] **Test 1:** Find latest backup
  ```bash
  ssh -p 2232 root@49.50.119.155 "ls -lt /opt/crm-app/shared/backups | head -5"
  ```

- [ ] **Test 2:** Verify backup contains database dump
  ```bash
  ssh -p 2232 root@49.50.119.155 "ls -lh /opt/crm-app/shared/backups/crm-backup-*/database.sql"
  ```

- [ ] **Test 3:** Verify backup contains code
  ```bash
  ssh -p 2232 root@49.50.119.155 "ls -lh /opt/crm-app/shared/backups/crm-backup-*/code/"
  ```

- [ ] **Test 4:** Document rollback time
  - [ ] Time to restore database: _____ minutes
  - [ ] Time to restore code: _____ minutes
  - [ ] Time to restart services: _____ minutes
  - [ ] Total rollback time: _____ minutes

---

## Post-Implementation Checklist

### Documentation

- [ ] Update team documentation with migration process
- [ ] Document migration file naming convention
- [ ] Document rollback procedure
- [ ] Create migration file template
- [ ] Add migration examples to documentation

### Monitoring

- [ ] Set up alerts for migration failures
- [ ] Monitor deployment logs for migration execution
- [ ] Track migration execution time
- [ ] Review migration history weekly

### Team Training

- [ ] Train team on creating migration files
- [ ] Train team on testing migrations locally
- [ ] Train team on rollback procedure
- [ ] Train team on troubleshooting migration failures

---

## Cleanup Checklist

### Remove Test Migration (Optional)

After confirming the system works, you can remove the test migration:

- [ ] **Option 1:** Keep test migration for reference
  - No action needed

- [ ] **Option 2:** Remove test migration
  ```bash
  # Create cleanup migration
  cat > CRM-BACKEND/migrations/999_cleanup_test_migration.sql << 'EOF'
  -- Cleanup test migration table
  DROP TABLE IF EXISTS migration_test;
  EOF
  
  # Commit and deploy
  git add CRM-BACKEND/migrations/999_cleanup_test_migration.sql
  git commit -m "chore: Cleanup test migration table"
  git push origin main
  ```

---

## Success Criteria

### Deployment Pipeline

- [x] Migrations execute automatically during deployment
- [x] Failed migrations halt deployment
- [x] Services do NOT start if migration fails
- [x] Migration execution logged to deployment log
- [x] Migration history tracked in `schema_migrations` table

### Safety

- [x] Database backup created before migration
- [x] Transaction rollback on migration failure
- [x] Deployment halts on migration failure
- [x] Rollback procedure documented and tested

### Monitoring

- [x] Migration status visible in deployment logs
- [x] Migration failures trigger alerts
- [x] Migration history queryable in database

---

## Common Issues & Solutions

### Issue 1: Migration runner not found

**Symptom:** `npm run migrate` fails with "command not found"

**Solution:**
```bash
cd CRM-BACKEND
npm install
npm run migrate:status
```

### Issue 2: Database connection failed

**Symptom:** Migration fails with "connection refused"

**Solution:**
- Verify `DATABASE_URL` in `.env` file
- Check PostgreSQL is running: `systemctl status postgresql`
- Verify credentials: `PGPASSWORD=acs_password psql -h localhost -U acs_user -d acs_db -c "SELECT 1"`

### Issue 3: Migration checksum mismatch

**Symptom:** Migration fails with "checksum mismatch"

**Solution:**
- Never modify existing migration files
- Create a new migration to fix issues
- If absolutely necessary, delete migration record from `schema_migrations` table

### Issue 4: Migration timeout

**Symptom:** Migration takes too long and times out

**Solution:**
- Break large migrations into smaller chunks
- Run long migrations during off-peak hours
- Increase timeout in migration runner

---

## Quick Reference Commands

### Local Development

```bash
# Check migration status
cd CRM-BACKEND && npm run migrate:status

# Execute migrations
npm run migrate

# Rollback data migration
npm run migrate:rollback
```

### Production

```bash
# SSH to production
ssh -p 2232 root@49.50.119.155

# Check migration status
cd /opt/crm-app/current/CRM-BACKEND && npm run migrate:status

# View deployment logs
tail -f /var/log/crm-app/deployment.log

# Check services
pm2 list

# View migration history
PGPASSWORD=acs_password psql -h localhost -U acs_user -d acs_db -c "SELECT * FROM schema_migrations ORDER BY executed_at DESC LIMIT 10;"
```

---

**Checklist Version:** 1.0  
**Last Updated:** 2025-10-24  
**Status:** Ready for Use

