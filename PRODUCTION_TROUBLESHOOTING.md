# 🚨 Production Troubleshooting Guide

## 🔧 Common Issues and Solutions

### **Frontend Failed to Start**

**❌ Error:** `frontend failed to start`

**🔍 Diagnosis:**
```bash
# Check if frontend is built
ls -la /opt/crm-app/current/CRM-FRONTEND/dist/

# Check frontend logs
tail -f /var/log/crm-app/frontend.log

# Check if port 5173 is available
netstat -tulpn | grep 5173
```

**✅ Solutions:**

1. **Ensure Frontend is Built:**
```bash
cd /opt/crm-app/current/CRM-FRONTEND
npm run build
```

2. **Kill Conflicting Processes:**
```bash
# Find process using port 5173
sudo lsof -i :5173
# Kill the process
sudo kill -9 <PID>
```

3. **Restart Frontend Service:**
```bash
cd /opt/crm-app/current
./start-production.sh
```

### **Backend Connection Issues**

**❌ Error:** `backend failed to start` or API not responding

**🔍 Diagnosis:**
```bash
# Check backend logs
tail -f /var/log/crm-app/backend.log

# Check if backend is built
ls -la /opt/crm-app/current/CRM-BACKEND/dist/

# Check database connection
PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db -c "SELECT 1;"
```

**✅ Solutions:**

1. **Build Backend:**
```bash
cd /opt/crm-app/current/CRM-BACKEND
npm run build
```

2. **Check Database:**
```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
```

3. **Restart Backend:**
```bash
cd /opt/crm-app/current/CRM-BACKEND
npm run start
```

### **Database Connection Failed**

**❌ Error:** `Database connection failed`

**🔍 Diagnosis:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check if database exists
sudo -u postgres psql -l | grep acs_db

# Test connection
PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db
```

**✅ Solutions:**

1. **Restart PostgreSQL:**
```bash
sudo systemctl restart postgresql
sudo systemctl enable postgresql
```

2. **Create Database if Missing:**
```bash
sudo -u postgres createdb acs_db
sudo -u postgres psql -c "CREATE USER example_db_user WITH PASSWORD 'example_db_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE acs_db TO example_db_user;"
```

### **SSL Certificate Issues**

**❌ Error:** SSL certificate problems

**🔍 Diagnosis:**
```bash
# Check certificate status
sudo certbot certificates

# Check nginx configuration
sudo nginx -t

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/example.com/cert.pem -text -noout | grep "Not After"
```

**✅ Solutions:**

1. **Renew Certificate:**
```bash
sudo certbot renew
sudo systemctl reload nginx
```

2. **Fix Nginx Configuration:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### **Port Conflicts**

**❌ Error:** Services can't bind to ports

**🔍 Diagnosis:**
```bash
# Check what's using ports
sudo netstat -tulpn | grep -E ":(3000|5173|5180|80|443)"

# Check for zombie processes
ps aux | grep -E "(node|npm|vite)"
```

**✅ Solutions:**

1. **Kill Conflicting Processes:**
```bash
# Kill all node processes
sudo pkill -f node
sudo pkill -f npm
sudo pkill -f vite

# Or kill specific ports
sudo lsof -ti:3000 | xargs sudo kill -9
sudo lsof -ti:5173 | xargs sudo kill -9
sudo lsof -ti:5180 | xargs sudo kill -9
```

### **Permission Issues**

**❌ Error:** Permission denied errors

**🔍 Diagnosis:**
```bash
# Check file ownership
ls -la /opt/crm-app/
ls -la /var/log/crm-app/

# Check current user
whoami
```

**✅ Solutions:**

1. **Fix Ownership (as root):**
```bash
chown -R admin1:admin1 /opt/crm-app
chown -R admin1:admin1 /var/log/crm-app
chmod +x /opt/crm-app/current/start-production.sh
```

2. **Run as Correct User:**
```bash
# Switch to admin1
su - admin1
# Or run with sudo
sudo -u admin1 ./start-production.sh
```

## 🔄 Service Management Commands

### **Restart All Services:**
```bash
cd /opt/crm-app/current
./start-production.sh
```

### **Stop All Services:**
```bash
# Kill all CRM processes
sudo pkill -f "CRM-"
sudo pkill -f "crm-"
```

### **Check Service Status:**
```bash
# System services
sudo systemctl status nginx postgresql redis

# Application processes
ps aux | grep -E "(CRM-|crm-)"

# Port usage
sudo netstat -tulpn | grep -E ":(3000|5173|5180)"
```

### **View Logs:**
```bash
# Application logs
tail -f /var/log/crm-app/backend.log
tail -f /var/log/crm-app/frontend.log
tail -f /var/log/crm-app/mobile.log

# System logs
sudo journalctl -u nginx -f
sudo journalctl -u postgresql -f
```

## 🚀 Quick Recovery Commands

### **Complete Restart:**
```bash
# Stop everything
sudo pkill -f node
sudo systemctl restart nginx postgresql redis

# Start CRM
cd /opt/crm-app/current
./start-production.sh
```

### **Emergency Rollback:**
```bash
# List available releases
ls -la /opt/crm-app/releases/

# Rollback to previous release
ln -sfn /opt/crm-app/releases/PREVIOUS_RELEASE /opt/crm-app/current
cd /opt/crm-app/current
./start-production.sh
```

## 📞 Support Information

**Production Server:**
- Domain: example.com
- IP: SERVER_IP
- Users: root, admin1

**Application URLs:**
- Frontend: https://example.com
- Mobile: https://example.com/mobile/
- API: https://example.com/api/
- Health: https://example.com/health

**Log Locations:**
- Application: /var/log/crm-app/
- Deployment: /var/log/crm-app/deployment.log
- Nginx: /var/log/nginx/
- System: journalctl
