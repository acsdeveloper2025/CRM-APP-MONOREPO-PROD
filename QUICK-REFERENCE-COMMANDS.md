# 🚀 QUICK REFERENCE - SERVER COMMANDS

**Server:** example.com (SERVER_IP:2232)  
**Updated:** 2025-10-21

---

## 🔑 SSH ACCESS (KEY-BASED ONLY)

### Connect to Server

```bash
# Method 1: Direct (will ask for SSH key passphrase)
ssh -p 2232 root@SERVER_IP

# Method 2: Using ssh-agent (ask passphrase once)
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa
ssh -p 2232 root@SERVER_IP

# Method 3: Add to macOS Keychain (permanent)
ssh-add --apple-use-keychain ~/.ssh/id_rsa
ssh -p 2232 root@SERVER_IP
```

---

## 🔄 REBOOT SERVER

### Option 1: Immediate Reboot
```bash
ssh -p 2232 root@SERVER_IP
sudo reboot
```

### Option 2: Scheduled Reboot
```bash
# Reboot in 60 minutes
ssh -p 2232 root@SERVER_IP "sudo shutdown -r +60"

# Reboot at 11 PM
ssh -p 2232 root@SERVER_IP "sudo shutdown -r 23:00"

# Cancel scheduled reboot
ssh -p 2232 root@SERVER_IP "sudo shutdown -c"
```

### Option 3: One-Line Reboot (with ssh-agent)
```bash
eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_rsa && ssh -p 2232 root@SERVER_IP "sudo reboot"
```

---

## ✅ POST-REBOOT VERIFICATION

```bash
# Check new kernel
ssh -p 2232 root@SERVER_IP "uname -r"

# Check all services
ssh -p 2232 root@SERVER_IP << 'EOF'
echo "=== Services Status ==="
systemctl status nginx --no-pager | head -3
systemctl status postgresql --no-pager | head -3
systemctl status redis-server --no-pager | head -3
systemctl status fail2ban --no-pager | head -3

echo ""
echo "=== Application Processes ==="
ps aux | grep -E "CRM-BACKEND|CRM-FRONTEND|CRM-MOBILE" | grep -v grep

echo ""
echo "=== Application Health ==="
curl -s https://example.com/api/health

echo ""
echo "=== Firewall Status ==="
ufw status

echo ""
echo "=== Fail2Ban Status ==="
fail2ban-client status
EOF
```

---

## 🛡️ FAIL2BAN COMMANDS

```bash
# Check overall status
ssh -p 2232 root@SERVER_IP "sudo fail2ban-client status"

# Check SSH jail
ssh -p 2232 root@SERVER_IP "sudo fail2ban-client status sshd"

# View banned IPs
ssh -p 2232 root@SERVER_IP "sudo fail2ban-client status sshd | grep 'Banned IP'"

# Unban an IP
ssh -p 2232 root@SERVER_IP "sudo fail2ban-client set sshd unbanip 1.2.3.4"

# View Fail2Ban logs
ssh -p 2232 root@SERVER_IP "sudo tail -50 /var/log/fail2ban.log"
```

---

## 🔥 FIREWALL COMMANDS

```bash
# Check firewall status
ssh -p 2232 root@SERVER_IP "sudo ufw status numbered"

# Check firewall logs
ssh -p 2232 root@SERVER_IP "sudo tail -50 /var/log/ufw.log"

# Reload firewall
ssh -p 2232 root@SERVER_IP "sudo ufw reload"
```

---

## 📊 MONITORING COMMANDS

```bash
# System resources
ssh -p 2232 root@SERVER_IP << 'EOF'
echo "=== System Resources ==="
uptime
free -h
df -h /
EOF

# Application status
ssh -p 2232 root@SERVER_IP << 'EOF'
echo "=== Application Status ==="
curl -s http://localhost:3000/health
curl -s -I http://localhost:5173/
curl -s -I http://localhost:5180/
EOF

# Check logs
ssh -p 2232 root@SERVER_IP << 'EOF'
echo "=== Recent Nginx Errors ==="
tail -20 /var/log/nginx/error.log

echo ""
echo "=== Recent Auth Logs ==="
tail -20 /var/log/auth.log
EOF
```

---

## 🔧 SERVICE MANAGEMENT

```bash
# Restart services
ssh -p 2232 root@SERVER_IP << 'EOF'
sudo systemctl restart nginx
sudo systemctl restart postgresql
sudo systemctl restart redis-server
sudo systemctl restart fail2ban
EOF

# Check service status
ssh -p 2232 root@SERVER_IP << 'EOF'
systemctl status nginx postgresql redis-server fail2ban --no-pager
EOF

# View service logs
ssh -p 2232 root@SERVER_IP "sudo journalctl -u nginx -n 50"
```

---

## 🌐 APPLICATION HEALTH CHECKS

```bash
# Backend health
curl https://example.com/api/health

# Frontend
curl -I https://example.com/

# Mobile
curl -I https://example.com/mobile/

# All at once
ssh -p 2232 root@SERVER_IP << 'EOF'
echo "Backend:"; curl -s http://localhost:3000/health | head -1
echo "Frontend:"; curl -s -I http://localhost:5173/ | head -1
echo "Mobile:"; curl -s -I http://localhost:5180/ | head -1
EOF
```

---

## 🔐 SECURITY CHECKS

```bash
# Check SSH configuration
ssh -p 2232 root@SERVER_IP "grep -E '^PasswordAuthentication|^PermitRootLogin|^PubkeyAuthentication' /etc/ssh/sshd_config"

# Check open ports
ssh -p 2232 root@SERVER_IP "sudo netstat -tlnp | grep LISTEN"

# Check recent SSH logins
ssh -p 2232 root@SERVER_IP "sudo tail -50 /var/log/auth.log | grep 'Accepted\|Failed'"

# Check Fail2Ban bans
ssh -p 2232 root@SERVER_IP "sudo fail2ban-client status sshd"
```

---

## 📦 UPDATE COMMANDS

```bash
# Check for updates
ssh -p 2232 root@SERVER_IP "sudo apt update && apt list --upgradable"

# Apply updates
ssh -p 2232 root@SERVER_IP "sudo apt update && sudo apt upgrade -y"

# Check if reboot required
ssh -p 2232 root@SERVER_IP "[ -f /var/run/reboot-required ] && echo 'Reboot required' || echo 'No reboot needed'"
```

---

## 🚨 EMERGENCY COMMANDS

### If Locked Out (SSH Key Issues)

1. **Use cloud provider console/VNC**
2. **Temporarily enable password auth:**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Change: PasswordAuthentication yes
   sudo systemctl restart sshd
   ```
3. **Add new SSH key**
4. **Disable password auth again**

### If Fail2Ban Blocks You

```bash
# From another IP or console
sudo fail2ban-client set sshd unbanip YOUR_IP

# Or temporarily disable Fail2Ban
sudo systemctl stop fail2ban
```

### If Application Down

```bash
# Restart all CRM services
ssh -p 2232 root@SERVER_IP << 'EOF'
cd /opt/crm-app/current
./start-production.sh
EOF
```

### If Nginx Down

```bash
# Check configuration
ssh -p 2232 root@SERVER_IP "sudo nginx -t"

# Restart Nginx
ssh -p 2232 root@SERVER_IP "sudo systemctl restart nginx"
```

---

## 📝 USEFUL ONE-LINERS

```bash
# Complete system status
ssh -p 2232 root@SERVER_IP "uptime && free -h && df -h / && systemctl status nginx postgresql redis-server fail2ban --no-pager | grep Active"

# Check all application health
ssh -p 2232 root@SERVER_IP "curl -s http://localhost:3000/health && curl -s -I http://localhost:5173/ | head -1 && curl -s -I http://localhost:5180/ | head -1"

# Security status
ssh -p 2232 root@SERVER_IP "ufw status && fail2ban-client status && grep -E '^PasswordAuthentication|^PermitRootLogin' /etc/ssh/sshd_config"

# Recent activity
ssh -p 2232 root@SERVER_IP "tail -20 /var/log/auth.log && tail -20 /var/log/fail2ban.log"
```

---

## 🎯 COMMON TASKS

### Deploy New Code
```bash
# Trigger GitHub Actions deployment
git push origin main

# Or manual deployment
ssh -p 2232 root@SERVER_IP << 'EOF'
cd /opt/crm-app/current
git pull origin main
npm install
npm run build
./start-production.sh
EOF
```

### Backup Database
```bash
ssh -p 2232 root@SERVER_IP << 'EOF'
PGPASSWORD=example_db_password pg_dump -h localhost -U example_db_user -d acs_db > /opt/crm-app/shared/backups/manual-backup-$(date +%Y%m%d_%H%M%S).sql
EOF
```

### View Application Logs
```bash
ssh -p 2232 root@SERVER_IP "tail -f /opt/crm-app/current/CRM-BACKEND/logs/*.log"
```

### Check Disk Usage
```bash
ssh -p 2232 root@SERVER_IP "du -sh /opt/crm-app/* && df -h /"
```

---

## 📞 QUICK TROUBLESHOOTING

### Problem: Can't SSH to server
```bash
# Check if server is up
ping SERVER_IP

# Check if SSH port is open
nc -zv SERVER_IP 2232

# Check if you're banned by Fail2Ban
# (Use cloud console to unban)
```

### Problem: Application not responding
```bash
# Check if processes are running
ssh -p 2232 root@SERVER_IP "ps aux | grep -E 'CRM-BACKEND|CRM-FRONTEND|CRM-MOBILE'"

# Restart applications
ssh -p 2232 root@SERVER_IP "cd /opt/crm-app/current && ./start-production.sh"
```

### Problem: High memory usage
```bash
# Check memory
ssh -p 2232 root@SERVER_IP "free -h && ps aux --sort=-%mem | head -10"

# Restart services if needed
ssh -p 2232 root@SERVER_IP "sudo systemctl restart nginx postgresql redis-server"
```

---

## 🔗 IMPORTANT URLS

```
Production:  https://example.com
Backend API: https://example.com/api/
Mobile App:  https://example.com/mobile/
Health:      https://example.com/api/health
```

---

## 📚 DOCUMENTATION FILES

```
CI-CD-SECURITY-AUDIT-REPORT.md
SECURITY-FIX-CHECKLIST.md
PRODUCTION-SERVER-STATUS-REPORT.md
SYSTEM-UPDATES-FAIL2BAN-REPORT.md
ALL-SECURITY-TASKS-COMPLETED-REPORT.md
QUICK-REFERENCE-COMMANDS.md (this file)
```

---

**Last Updated:** 2025-10-21 20:15 IST  
**Server Status:** ✅ OPERATIONAL  
**Security Level:** 🛡️ HIGH (9/10)

