# 🚀 CRM Production Deployment Guide

## 📋 Production Server Information

**Server Details:**
- **Domain:** example.com
- **Static IP:** SERVER_IP
- **OS:** Linux (Ubuntu/CentOS)

**Production Users:**
- **Username:** root
- **Password:** Tr54V5&u89m#2n7

- **Username:** admin1  
- **Password:** Op%rv*$3cr#@nuY

## 🔧 Deployment Instructions

### **Step 1: Connect to Production Server**

```bash
# Option 1: Connect as root
ssh root@SERVER_IP

# Option 2: Connect as admin1
ssh admin1@SERVER_IP
```

### **Step 2: Clone Repository**

```bash
# Clone the repository
git clone https://github.com/acsdeveloper2025/CRM-APP-MONOREPO-PROD.git
cd CRM-APP-MONOREPO-PROD
```

### **Step 3: Run Deployment**

**As root user:**
```bash
./scripts/deploy-production.sh
```

**As admin1 user:**
```bash
./scripts/deploy-production.sh
# (Will use sudo for privileged operations)
```

### **Step 4: Start Production Services**

**As root user:**
```bash
./start-production.sh
```

**As admin1 user:**
```bash
./start-production.sh
```

## 📁 Production Directory Structure

```
/opt/crm-app/
├── current/                 # Symlink to current release
├── releases/               # All deployment releases
│   ├── 20250924-120000/   # Timestamped releases
│   └── 20250924-130000/
├── shared/
│   └── backups/           # Database and code backups
└── logs/                  # Application logs

/var/log/crm-app/
├── deployment.log         # Deployment logs
├── backend.log           # Backend service logs
├── frontend.log          # Frontend service logs
└── mobile.log            # Mobile app logs
```

## 🔒 Security & Permissions

**Root User:**
- Full system access
- Direct file operations
- No sudo required

**Admin1 User:**
- Uses sudo for privileged operations
- Proper ownership management
- Secure deployment process

## 🌐 Application URLs

After successful deployment:

- **Frontend:** https://example.com/
- **Mobile App:** https://example.com/mobile/
- **Backend API:** https://example.com/api/
- **Health Check:** https://example.com/health

## 🔑 Default Login Credentials

- **Username:** admin
- **Password:** CHANGE_ME_PASSWORD

## 📊 Monitoring & Logs

**Service Status:**
```bash
systemctl status nginx
systemctl status postgresql
systemctl status redis
```

**Application Logs:**
```bash
tail -f /var/log/crm-app/backend.log
tail -f /var/log/crm-app/frontend.log
tail -f /var/log/crm-app/deployment.log
```

## 🔄 Deployment Process

The deployment process is fully automated through GitHub Actions and includes:

1. **Backup:** Automatic backup of current deployment and database
2. **Stop Services:** Gracefully stop all running services
3. **Update Code:** Pull latest code from GitHub repository
4. **Install Dependencies:** Install/update npm packages for all applications
5. **Build Applications:**
   - Frontend (React + Vite)
   - Backend (Node.js + TypeScript)
   - Mobile (Capacitor + Firebase)
6. **🗄️ Database Migrations:** **NEW!** Automatically execute pending schema migrations
7. **Clear Caches:** Clear Redis cache and Node.js require cache
8. **Start Services:** Start all application services using PM2
9. **Health Checks:** Verify all endpoints are responding correctly
10. **Cleanup:** Remove old releases and backups (keep latest 3)

### 🗄️ Database Migration System

**Status:** ✅ **INTEGRATED AND OPERATIONAL** (as of October 24, 2025)

The deployment pipeline now includes **automated database migration execution** to ensure schema changes are applied consistently across environments.

**How It Works:**

1. **Migration Detection:** GitHub Actions detects changes in `CRM-BACKEND/migrations/*.sql`
2. **Pre-Deployment Check:** Workflow shows migration status in deployment summary
3. **Automatic Execution:** Deployment script runs migrations after building applications
4. **Fail-Safe:** Deployment halts if migration fails, preventing broken deployments
5. **Verification:** Migration status is checked and logged after execution

**Migration Files Location:**
```
CRM-BACKEND/migrations/
├── 001_test_migration_system.sql
├── 006_add_trigger_applicant_type_to_verification_tasks.sql
└── 999_cleanup_test_migration.sql
```

**Migration Tracking:**
- All migrations are tracked in the `schema_migrations` table
- Each migration records: filename, execution time, success status, checksum
- Migrations are executed in alphabetical order
- Already-executed migrations are automatically skipped

**Manual Migration Commands:**

```bash
# Check migration status
cd /opt/crm-app/current/CRM-BACKEND
npm run migrate:status

# Execute pending migrations manually
npm run migrate

# View migration history
PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db \
  -c "SELECT * FROM schema_migrations ORDER BY executed_at DESC LIMIT 10;"
```

**Creating New Migrations:**

1. Create a new `.sql` file in `CRM-BACKEND/migrations/`
2. Use numeric prefix for ordering (e.g., `007_add_new_feature.sql`)
3. Include idempotency checks (IF NOT EXISTS, DO $$ blocks)
4. Test locally before committing
5. Commit and push - GitHub Actions will deploy automatically

**Migration Best Practices:**

✅ **DO:**
- Use `IF NOT EXISTS` for CREATE statements
- Use `ADD COLUMN IF NOT EXISTS` for ALTER TABLE
- Check for existing constraints before adding them
- Include rollback instructions in comments
- Test migrations on development database first

❌ **DON'T:**
- Drop tables without backup
- Modify existing migration files after deployment
- Skip migration testing
- Use hardcoded values (use variables/functions)

**Example Idempotent Migration:**

```sql
-- Add new column with idempotency check
ALTER TABLE my_table
ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);

-- Add constraint with existence check
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'my_constraint'
    ) THEN
        ALTER TABLE my_table
        ADD CONSTRAINT my_constraint CHECK (new_column IS NOT NULL);
    END IF;
END $$;
```

**Rollback Procedure:**

If a migration fails or causes issues:

```bash
# 1. Restore database from backup
PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db \
  < /opt/crm-app/shared/backups/BACKUP_PATH/database.sql

# 2. Restore code from backup
cp -r /opt/crm-app/shared/backups/BACKUP_PATH/code/* /opt/crm-app/current/

# 3. Restart services
cd /opt/crm-app/current
./start-production.sh
```

**Migration Verification:**

After deployment, verify migrations executed successfully:

```bash
# Check latest migrations
ssh -p 2232 root@SERVER_IP "cd /opt/crm-app/current/CRM-BACKEND && npm run migrate:status"

# View deployment logs
ssh -p 2232 root@SERVER_IP "tail -100 /var/log/crm-app/deployment.log | grep -A 20 'Running Database Migrations'"
```

## 🚨 Troubleshooting

**Permission Issues:**
```bash
# Fix ownership (as root)
chown -R admin1:admin1 /opt/crm-app
chown -R admin1:admin1 /var/log/crm-app
```

**Service Issues:**
```bash
# Restart services
systemctl restart nginx
systemctl restart postgresql
systemctl restart redis
```

**Deployment Rollback:**
```bash
# List releases
ls -la /opt/crm-app/releases/

# Rollback to previous release
ln -sfn /opt/crm-app/releases/PREVIOUS_RELEASE /opt/crm-app/current
./start-production.sh
```

## 📱 Mobile App Deployment

The mobile app includes:
- ✅ Firebase production configuration
- ✅ Real push notifications
- ✅ Production API endpoints
- ✅ Optimized builds for Android/iOS

**Mobile Build Commands:**
```bash
cd CRM-MOBILE
npm run build:prod
npx cap sync android
npx cap sync ios
```

## 🎯 Success Indicators

✅ All services running
✅ Website accessible at domain
✅ API responding to health checks
✅ Mobile app builds successfully
✅ Firebase integration working
✅ SSL certificate valid
✅ Database connectivity confirmed

---

**🚀 Your CRM application is now ready for production deployment!**
