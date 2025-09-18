# 🌐 CRM System Internet Access Setup Guide

## 📋 Overview
This guide helps you configure your CRM system for internet access using your static IP address `103.14.234.36`.

## 🚀 Quick Start

### Step 1: Run the Updated CRM Launcher
```bash
./crm-network-launcher.sh
```

When prompted, choose:
- **Option 2**: Internet Access via Static IP (103.14.234.36)
- **Option 3**: Both Local and Internet Access (recommended)

### Step 2: Configure Firewall (One-time setup)
```bash
# Run the firewall setup script
./setup-static-ip-access.sh
```

## 🔧 Manual Configuration Steps

### 1. Firewall Configuration
```bash
# Allow CRM ports through firewall
sudo ufw allow 3000/tcp comment "CRM Backend API"
sudo ufw allow 5173/tcp comment "CRM Frontend"
sudo ufw allow 3001/tcp comment "CRM WebSocket"

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 2. Router/Network Configuration
Ensure your router forwards these ports to your local machine (10.100.100.30):
- Port 3000 → 10.100.100.30:3000 (Backend API)
- Port 5173 → 10.100.100.30:5173 (Frontend)
- Port 3001 → 10.100.100.30:3001 (WebSocket)

## 🌐 Access URLs

### Internet Access (from anywhere):
- **Frontend Web App**: http://103.14.234.36:5173
- **Mobile Web App**: http://103.14.234.36:5180
- **Backend API**: http://103.14.234.36:3000

### Local Network Access:
- **Frontend Web App**: http://10.100.100.30:5173
- **Mobile Web App**: http://10.100.100.30:5180
- **Backend API**: http://10.100.100.30:3000

### Localhost Access:
- **Frontend Web App**: http://localhost:5173
- **Mobile Web App**: http://localhost:5180
- **Backend API**: http://localhost:3000

## 📱 Mobile App Configuration

The mobile app will automatically use the correct API endpoint based on your configuration:

1. **Static IP Priority**: http://103.14.234.36:3000/api
2. **Local Network Fallback**: http://10.100.100.30:3000/api
3. **Localhost Fallback**: http://localhost:3000/api

## 🔒 Security Considerations

### 1. Firewall Rules
- Only necessary ports (3000, 5173, 3001) are exposed
- SSH access is maintained for remote management
- All other ports remain blocked

### 2. CORS Configuration
The backend is configured to accept requests from:
- localhost (127.0.0.1)
- Local network IP (10.100.100.30)
- Static IP (103.14.234.36)

### 3. Authentication
- JWT tokens are required for all API access
- No changes to existing authentication mechanisms
- All security features remain intact

## 🛠️ Troubleshooting

### Issue: Cannot access from internet
**Solution:**
1. Check if ports are open: `sudo ufw status`
2. Verify router port forwarding
3. Test local access first: `curl http://10.100.100.30:3000/api/health`

### Issue: Mobile app not connecting
**Solution:**
1. Check mobile app logs in browser console
2. Verify API URL in mobile .env file
3. Test API directly: `curl http://103.14.234.36:3000/api/health`

### Issue: CORS errors
**Solution:**
1. Check backend CORS configuration in CRM-BACKEND/.env
2. Restart backend service
3. Clear browser cache

## 📊 Service Management

### Start Services:
```bash
./crm-network-launcher.sh
```

### Stop Services:
```bash
./crm-network-launcher.sh --stop
```

### Check Service Status:
```bash
# Check running processes
ps aux | grep -E "(node|npm)"

# Check port usage
sudo netstat -tlnp | grep -E "(3000|5173|3001)"
```

### View Logs:
```bash
tail -f logs/backend.log
tail -f logs/frontend.log
tail -f logs/mobile.log
```

## 🔄 Configuration Files Updated

The launcher automatically updates these files:
- `CRM-BACKEND/.env` - CORS and API configuration
- `CRM-FRONTEND/.env` - API endpoints
- `CRM-MOBILE/.env` - Mobile API configuration
- Source code files with hardcoded IPs

## ✅ Verification Steps

1. **Test Local Access:**
   ```bash
   curl http://localhost:3000/api/health
   curl http://10.100.100.30:3000/api/health
   ```

2. **Test Internet Access:**
   ```bash
   curl http://103.14.234.36:3000/api/health
   ```

3. **Test Frontend:**
   - Open http://103.14.234.36:5173 in browser
   - Login should work normally
   - All features should be accessible

4. **Test Mobile:**
   - Open http://103.14.234.36:5180 in mobile browser
   - App should load and connect to API
   - All mobile features should work

## 📞 Support

If you encounter issues:
1. Check the logs in the `logs/` directory
2. Verify firewall and network configuration
3. Test each component individually
4. Ensure all services are running on correct ports

## 🎯 Next Steps

1. Test access from external devices/networks
2. Consider setting up HTTPS with SSL certificates
3. Monitor system performance and logs
4. Set up automated backups of configuration files
