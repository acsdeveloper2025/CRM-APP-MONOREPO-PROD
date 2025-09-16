# 🌐 Domain Setup Guide: crm.allcheckservices.com

This guide explains how to set up the domain `crm.allcheckservices.com` to redirect to your CRM server at IP `103.14.234.36`.

## 📋 **Prerequisites**

- Domain `allcheckservices.com` registered and accessible
- Server running at IP `103.14.234.36`
- SSL certificate for HTTPS (recommended)
- Firewall configured to allow ports 3000, 5173, 5180

## 🔧 **1. DNS Configuration**

### **A. Add DNS Records**

In your domain provider's DNS management panel, add these records:

```dns
# Main subdomain
Type: A
Name: crm
Value: 103.14.234.36
TTL: 300

# Optional: www subdomain
Type: CNAME
Name: www.crm
Value: crm.allcheckservices.com
TTL: 300
```

### **B. Verify DNS Propagation**

```bash
# Check DNS resolution
nslookup crm.allcheckservices.com
dig crm.allcheckservices.com

# Expected result: 103.14.234.36
```

## 🔒 **2. SSL Certificate Setup (Recommended)**

### **Option A: Let's Encrypt (Free)**

```bash
# Install certbot
sudo apt update
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d crm.allcheckservices.com -d www.crm.allcheckservices.com

# Certificate will be saved to:
# /etc/letsencrypt/live/crm.allcheckservices.com/
```

### **Option B: Self-Signed Certificate (Development)**

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

## 🌐 **3. Nginx Reverse Proxy Setup**

Create `/etc/nginx/sites-available/crm.allcheckservices.com`:

```nginx
server {
    listen 80;
    server_name crm.allcheckservices.com www.crm.allcheckservices.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.allcheckservices.com www.crm.allcheckservices.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/crm.allcheckservices.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.allcheckservices.com/privkey.pem;
    
    # Frontend (Port 5173)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Mobile App (Port 5180)
    location /mobile {
        proxy_pass http://127.0.0.1:5180;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # API Backend (Port 3000)
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket Support
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/crm.allcheckservices.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔧 **4. Firewall Configuration**

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow direct access to application ports (optional)
sudo ufw allow 3000/tcp
sudo ufw allow 5173/tcp
sudo ufw allow 5180/tcp
```

## ✅ **5. CRM Application Updates**

The CRM system has been updated to automatically detect and handle the domain:

### **Smart URL Detection Logic:**
- `crm.allcheckservices.com` → Uses HTTPS with domain
- `www.crm.allcheckservices.com` → Uses HTTPS with domain
- `103.14.234.36` → Uses HTTP with static IP
- `10.100.100.30` → Uses HTTP with local network IP
- `localhost` → Uses HTTP with localhost

### **Updated Services:**
- ✅ Frontend API Service
- ✅ Frontend WebSocket Service
- ✅ Mobile Case Status Service
- ✅ Backend CORS Configuration

## 🌐 **6. Access URLs**

After setup, your CRM will be accessible via:

### **Production Domain Access:**
- **Frontend**: `https://crm.allcheckservices.com`
- **Mobile**: `https://crm.allcheckservices.com/mobile`
- **API**: `https://crm.allcheckservices.com/api`

### **Direct IP Access (Backup):**
- **Frontend**: `http://103.14.234.36:5173`
- **Mobile**: `http://103.14.234.36:5180`
- **API**: `http://103.14.234.36:3000`

## 🔍 **7. Testing & Verification**

```bash
# Test domain resolution
curl -I https://crm.allcheckservices.com

# Test API endpoint
curl https://crm.allcheckservices.com/api/health

# Test WebSocket connection
wscat -c wss://crm.allcheckservices.com/socket.io/
```

## 🚨 **8. Troubleshooting**

### **Common Issues:**

1. **DNS not resolving**: Wait 24-48 hours for full propagation
2. **SSL certificate errors**: Verify certificate paths in Nginx config
3. **502 Bad Gateway**: Check if CRM services are running on correct ports
4. **CORS errors**: Verify domain is added to backend CORS configuration

### **Debug Commands:**

```bash
# Check CRM services status
./crm-network-launcher.sh --status

# Check Nginx status
sudo systemctl status nginx

# Check SSL certificate
sudo certbot certificates

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## 🎯 **9. Production Checklist**

- [ ] DNS records configured and propagated
- [ ] SSL certificate installed and valid
- [ ] Nginx reverse proxy configured
- [ ] Firewall rules updated
- [ ] CRM services running and accessible
- [ ] Domain access tested from external network
- [ ] Mobile app tested with domain URL
- [ ] WebSocket connections working
- [ ] API endpoints responding correctly

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all services are running: `./crm-network-launcher.sh`
3. Check logs for specific error messages
4. Test direct IP access as fallback

---

**🎉 Your CRM system will be accessible worldwide via `https://crm.allcheckservices.com`!**
