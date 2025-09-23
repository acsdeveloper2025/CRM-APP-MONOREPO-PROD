# 🚀 CRM Production Deployment Guide

## 📋 Production Server Information

**Server Details:**
- **Domain:** crm.allcheckservices.com
- **Static IP:** 49.50.119.155
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
ssh root@49.50.119.155

# Option 2: Connect as admin1
ssh admin1@49.50.119.155
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

- **Frontend:** https://crm.allcheckservices.com/
- **Mobile App:** https://crm.allcheckservices.com/mobile/
- **Backend API:** https://crm.allcheckservices.com/api/
- **Health Check:** https://crm.allcheckservices.com/health

## 🔑 Default Login Credentials

- **Username:** admin
- **Password:** admin123

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

1. **Backup:** Automatic backup of current deployment and database
2. **Clone:** Fresh code from GitHub repository
3. **Build:** 
   - Frontend (React + Vite)
   - Backend (Node.js)
   - Mobile (Capacitor + Firebase)
4. **Deploy:** Symlink to new release
5. **Services:** Restart all application services
6. **Verify:** Health checks and service validation

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
