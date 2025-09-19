# CRM System - Production Deployment Guide

This guide provides step-by-step instructions for deploying the CRM system to a production server.

## 📋 Prerequisites

- Ubuntu/Debian server with root or sudo access
- Domain name pointing to your server (optional but recommended)
- Minimum 2GB RAM, 2 CPU cores, 20GB storage
- Internet connection for downloading dependencies

## 🚀 Quick Deployment

### Step 1: Clone Repository
```bash
git clone https://github.com/acsdeveloper2025/CRM-APP-MONOREPO-PROD.git
cd CRM-APP-MONOREPO-PROD
```

### Step 2: Install Dependencies
```bash
./install-dependencies.sh
```

### Step 3: Configure Server
```bash
./configure-server.sh
```

### Step 4: Deploy Application
```bash
# Set environment variables (optional)
export STATIC_IP="your-server-ip"
export DOMAIN_NAME="your-domain.com"
export DB_PASSWORD="secure-password"

# Run the CRM launcher
./crm-network-launcher.sh
```

## 📁 File Structure

```
CRM-APP-MONOREPO-PROD/
├── CRM-BACKEND/                 # Node.js + TypeScript backend
│   ├── .env.template           # Environment template
│   └── .env.example           # Example configuration
├── CRM-FRONTEND/               # React + TypeScript frontend
│   ├── .env.template          # Environment template
│   └── .env.example          # Example configuration
├── CRM-MOBILE/                # React + Capacitor mobile app
│   ├── .env.template         # Environment template
│   └── .env.example         # Example configuration
├── crm-network-launcher.sh   # Main deployment script
├── install-dependencies.sh   # Dependency installation
├── configure-server.sh      # Server configuration
└── PRODUCTION-DEPLOYMENT.md # This file
```

## 🔧 Configuration

### Environment Variables

The system uses template files (`.env.template`) to generate production configurations. Key variables:

- `STATIC_IP`: Your server's public IP address
- `DOMAIN_NAME`: Your domain name (default: crm.allcheckservices.com)
- `DB_PASSWORD`: Database password
- `JWT_SECRET`: JWT signing secret (auto-generated if not provided)
- `GOOGLE_MAPS_API_KEY`: Google Maps API key for location services

### Database Configuration

Default database settings:
- Database: `acs_db`
- User: `acs_user`
- Password: `acs_password`
- Host: `localhost`
- Port: `5432`

### Ports

The system uses these ports:
- **80**: HTTP (Nginx proxy)
- **443**: HTTPS (SSL)
- **3000**: Backend API
- **5173**: Frontend
- **5180**: Mobile app
- **5432**: PostgreSQL
- **6379**: Redis

## 🔒 Security

### Firewall Configuration

The `configure-server.sh` script automatically configures UFW firewall:
- Allows SSH, HTTP, HTTPS
- Allows CRM application ports
- Restricts database access to localhost

### SSL Certificate

SSL certificates can be automatically configured using Let's Encrypt:
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 🌐 Access URLs

After deployment, access your CRM system at:

- **Frontend**: `https://your-domain.com` or `http://your-ip`
- **Mobile**: `https://your-domain.com` or `http://your-ip` (PWA)
- **API**: `https://your-domain.com/api` or `http://your-ip/api`

## 📱 Mobile App

The mobile app is built as a Progressive Web App (PWA) and can be:
1. Accessed via web browser
2. Installed as a native app on mobile devices
3. Built as APK for Android distribution

To build APK:
```bash
cd CRM-MOBILE
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

## 🔍 Troubleshooting

### Common Issues

1. **Port conflicts**: The launcher script automatically resolves port conflicts
2. **Database connection**: Ensure PostgreSQL is running and credentials are correct
3. **Nginx errors**: Check configuration with `sudo nginx -t`
4. **SSL issues**: Ensure domain points to server before running certbot

### Logs

Check application logs:
```bash
# Backend logs
pm2 logs crm-backend

# Frontend logs
pm2 logs crm-frontend

# Mobile logs
pm2 logs crm-mobile

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Service Management

```bash
# Check service status
pm2 status

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# View detailed info
pm2 show crm-backend
```

## 🔄 Updates

To update the application:

1. Pull latest changes:
   ```bash
   git pull origin main
   ```

2. Update dependencies:
   ```bash
   npm install  # In each project directory
   ```

3. Restart services:
   ```bash
   pm2 restart all
   ```

## 📞 Support

For support and issues:
- Check logs for error messages
- Ensure all services are running
- Verify firewall and network configuration
- Check database connectivity

## 🏗️ Architecture

The CRM system consists of:

- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **Frontend**: React + TypeScript + Vite
- **Mobile**: React + TypeScript + Capacitor
- **Proxy**: Nginx reverse proxy
- **Database**: PostgreSQL + Redis
- **Process Manager**: PM2

All components are designed to work together seamlessly with automatic configuration and deployment.
