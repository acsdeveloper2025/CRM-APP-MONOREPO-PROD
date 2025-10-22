# 🔒 SECURITY FIX CHECKLIST - IMMEDIATE ACTIONS REQUIRED

**Date:** 2025-10-21  
**Priority:** 🚨 CRITICAL  
**Estimated Time:** 2-4 hours  

---

## ⚠️ CRITICAL SECURITY ISSUES FOUND

Your production server credentials and database passwords are **EXPOSED** in documentation files committed to your Git repository.

### 🔴 Exposed Information:

```
Server IP:        49.50.119.155
SSH Port:         2232
Root Password:    Tr54V5&u89m#2n7
Admin1 Password:  Op%rv*$3cr#@nuY
DB User:          acs_user
DB Password:      acs_password
```

**Files Containing Credentials:**
- `PRODUCTION_DEPLOYMENT_GUIDE.md` (Lines 11-15) - **ROOT & ADMIN1 PASSWORDS**
- `scripts/deploy-production.sh` - Database password
- `scripts/health-check.sh` - Database password
- `scripts/rollback.sh` - Database password
- `scripts/monitor-deployment.sh` - Database password
- Multiple documentation files - Server IP, SSH port, usernames

---

## 🚨 STEP 1: CHANGE ALL PASSWORDS IMMEDIATELY (15 minutes)

### 1.1 Change Server Passwords

```bash
# SSH into your production server
ssh root@49.50.119.155 -p 2232

# Change root password
passwd root
# Enter new strong password (use password manager to generate)

# Change admin1 password
passwd admin1
# Enter new strong password

# Verify changes
echo "Passwords changed successfully"
```

### 1.2 Change Database Password

```bash
# On production server, as root or admin1:
sudo -u postgres psql

# In PostgreSQL prompt:
ALTER USER acs_user WITH PASSWORD 'NEW_SECURE_PASSWORD_HERE';
\q

# Update the password in production .env file
sudo nano /opt/crm-app/current/CRM-BACKEND/.env
# Change: DATABASE_URL=postgresql://acs_user:NEW_PASSWORD@localhost:5432/acs_db

# Restart backend service
cd /opt/crm-app/current
./start-production.sh
```

### 1.3 Generate Strong Passwords

Use a password manager or generate strong passwords:
```bash
# Generate random passwords (on your local machine)
openssl rand -base64 32
```

**Store new passwords securely in:**
- Password manager (1Password, LastPass, Bitwarden)
- Encrypted vault
- **NEVER** in plain text files

---

## 🚨 STEP 2: REMOVE CREDENTIALS FROM REPOSITORY (30 minutes)

### 2.1 Remove Passwords from Documentation

**Edit these files and remove ALL passwords:**

1. **PRODUCTION_DEPLOYMENT_GUIDE.md**
   ```bash
   # Remove lines 11-15 containing passwords
   # Replace with:
   **Production Users:**
   - **Username:** root
   - **Password:** [Stored securely - contact system administrator]
   
   - **Username:** admin1  
   - **Password:** [Stored securely - contact system administrator]
   ```

2. **README.md**
   ```bash
   # Remove or update default password reference
   # Change from: Password: admin123
   # To: Password: [Contact administrator for credentials]
   ```

### 2.2 Update Deployment Scripts to Use Environment Variables

**Create a secure credentials file (NOT committed to git):**

```bash
# On production server: /opt/crm-app/current/.env.secrets
cat > /opt/crm-app/current/.env.secrets << 'EOF'
# Database Credentials
DB_HOST=localhost
DB_PORT=5432
DB_NAME=acs_db
DB_USER=acs_user
DB_PASSWORD=YOUR_NEW_SECURE_PASSWORD_HERE

# Redis Credentials
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Server Information
SERVER_IP=49.50.119.155
SSH_PORT=2232
EOF

# Secure the file
chmod 600 /opt/crm-app/current/.env.secrets
chown admin1:admin1 /opt/crm-app/current/.env.secrets
```

**Update scripts to source this file:**

Add to the beginning of each script:
```bash
# Load secure credentials
if [ -f "/opt/crm-app/current/.env.secrets" ]; then
    source /opt/crm-app/current/.env.secrets
fi
```

Then replace hardcoded passwords with variables:
```bash
# OLD (insecure):
PGPASSWORD=acs_password psql ...

# NEW (secure):
PGPASSWORD="${DB_PASSWORD}" psql ...
```

### 2.3 Update .gitignore

```bash
# Add to .gitignore
echo ".env.secrets" >> .gitignore
echo "*.secrets" >> .gitignore
```

### 2.4 Commit Changes

```bash
git add .
git commit -m "security: Remove hardcoded credentials from repository"
git push origin main
```

---

## 🚨 STEP 3: UPDATE GITHUB SECRETS (10 minutes)

### 3.1 Verify GitHub Secrets are Set

Go to: `https://github.com/acsdeveloper2025/CRM-APP-MONOREPO-PROD/settings/secrets/actions`

**Required Secrets:**

| Secret Name | Value | Status |
|-------------|-------|--------|
| `PRODUCTION_SSH_KEY` | SSH private key | ✅ Should exist |
| `PRODUCTION_HOST` | 49.50.119.155 | ✅ Should exist |
| `PRODUCTION_USER` | admin1 | ✅ Should exist |
| `PRODUCTION_SSH_PORT` | 2232 | ⚠️ Add if missing |
| `DB_PASSWORD` | New database password | ⚠️ Add this |

### 3.2 Add New Secrets

1. Click "New repository secret"
2. Add `PRODUCTION_SSH_PORT` = `2232`
3. Add `DB_PASSWORD` = `[your new database password]`

---

## 🚨 STEP 4: AUDIT GIT HISTORY (20 minutes)

### 4.1 Check if Credentials Were Committed Previously

```bash
# Search git history for passwords
git log -p | grep -i "Tr54V5&u89m#2n7"
git log -p | grep -i "Op%rv*$3cr#@nuY"
git log -p | grep -i "acs_password"

# Search for password patterns
git log -p | grep -E "password.*=.*['\"]"
```

### 4.2 If Credentials Found in History

**⚠️ WARNING:** If credentials are in git history, they are **PERMANENTLY EXPOSED** unless you rewrite history.

**Options:**

1. **Change all passwords** (already done in Step 1) ✅
2. **Rewrite git history** (advanced - can break things)
3. **Create new repository** (nuclear option)

**For now, focus on changing passwords. History rewrite can be done later if needed.**

---

## 🚨 STEP 5: IMPLEMENT SSH KEY-BASED AUTH (30 minutes)

### 5.1 Disable Password Authentication

```bash
# On production server
sudo nano /etc/ssh/sshd_config

# Change these settings:
PasswordAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

### 5.2 Ensure SSH Keys are Set Up

```bash
# On your local machine, generate SSH key if you don't have one
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Copy public key to server
ssh-copy-id -p 2232 admin1@49.50.119.155

# Test SSH key login
ssh -p 2232 admin1@49.50.119.155
```

---

## 🚨 STEP 6: ENABLE FIREWALL (15 minutes)

### 6.1 Configure UFW Firewall

```bash
# On production server
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH on custom port
sudo ufw allow 2232/tcp comment 'SSH'

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

---

## 🚨 STEP 7: INSTALL FAIL2BAN (15 minutes)

### 7.1 Install and Configure Fail2Ban

```bash
# Install fail2ban
sudo apt update
sudo apt install fail2ban -y

# Create custom configuration
sudo nano /etc/fail2ban/jail.local

# Add this content:
[sshd]
enabled = true
port = 2232
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600

# Start fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status sshd
```

---

## 🚨 STEP 8: VERIFY SECURITY (20 minutes)

### 8.1 Security Checklist

- [ ] Root password changed
- [ ] Admin1 password changed
- [ ] Database password changed
- [ ] Credentials removed from documentation
- [ ] Changes committed to git
- [ ] GitHub Secrets verified
- [ ] SSH key authentication enabled
- [ ] Password authentication disabled
- [ ] Firewall enabled and configured
- [ ] Fail2Ban installed and running
- [ ] Production services restarted
- [ ] Health checks passing

### 8.2 Test Deployment

```bash
# Trigger a deployment from GitHub Actions
git commit --allow-empty -m "test: verify deployment after security fixes"
git push origin main

# Monitor deployment
# Go to: https://github.com/acsdeveloper2025/CRM-APP-MONOREPO-PROD/actions
```

### 8.3 Verify Application is Running

```bash
# Check health endpoints
curl https://crm.allcheckservices.com/health
curl https://crm.allcheckservices.com/api/health

# Check services on server
ssh -p 2232 admin1@49.50.119.155
ps aux | grep node
```

---

## 📋 COMPLETION CHECKLIST

### Immediate Actions (CRITICAL - Do Now)
- [ ] Step 1: Change all passwords ✅
- [ ] Step 2: Remove credentials from repository ✅
- [ ] Step 3: Update GitHub Secrets ✅
- [ ] Step 4: Audit git history ✅

### Security Hardening (HIGH - Do Today)
- [ ] Step 5: Implement SSH key-based auth ✅
- [ ] Step 6: Enable firewall ✅
- [ ] Step 7: Install Fail2Ban ✅

### Verification (MEDIUM - Do Today)
- [ ] Step 8: Verify security ✅
- [ ] Test deployment pipeline ✅
- [ ] Verify application functionality ✅

---

## 🆘 TROUBLESHOOTING

### If You Get Locked Out

1. **Can't SSH after disabling password auth:**
   ```bash
   # Use your cloud provider's console/VNC access
   # Re-enable password auth temporarily
   sudo nano /etc/ssh/sshd_config
   # Set: PasswordAuthentication yes
   sudo systemctl restart sshd
   ```

2. **Database connection fails:**
   ```bash
   # Check if password was updated in .env
   cat /opt/crm-app/current/CRM-BACKEND/.env | grep DATABASE_URL
   
   # Test database connection
   PGPASSWORD='new_password' psql -h localhost -U acs_user -d acs_db -c "SELECT 1;"
   ```

3. **Services won't start:**
   ```bash
   # Check logs
   tail -f /var/log/crm-app/backend.log
   
   # Restart services
   cd /opt/crm-app/current
   ./start-production.sh
   ```

---

## 📞 SUPPORT

If you encounter issues:

1. **Check logs:**
   - `/var/log/crm-app/deployment.log`
   - `/var/log/crm-app/backend.log`
   - `/var/log/auth.log`

2. **Run health check:**
   ```bash
   /opt/crm-app/current/scripts/health-check.sh
   ```

3. **Rollback if needed:**
   ```bash
   /opt/crm-app/current/scripts/rollback.sh
   ```

---

## ✅ AFTER COMPLETION

Once all steps are complete:

1. **Document new passwords** in your password manager
2. **Update team members** about password changes
3. **Schedule regular security audits** (quarterly)
4. **Implement password rotation policy** (every 90 days)
5. **Monitor logs** for suspicious activity

---

**🎯 GOAL:** Complete all CRITICAL steps within 2 hours.

**⏰ START TIME:** ___________  
**⏰ END TIME:** ___________  
**✅ COMPLETED BY:** ___________

