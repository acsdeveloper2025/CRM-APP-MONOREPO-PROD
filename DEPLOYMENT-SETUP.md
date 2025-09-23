# 🚀 CRM Production Deployment Pipeline Setup Guide

This guide will help you set up a complete automated deployment pipeline for your CRM monorepo using GitHub Actions.

## 📋 Prerequisites

- GitHub repository: `https://github.com/acsdeveloper2025/CRM-APP-MONOREPO-PROD.git`
- Production server with SSH access
- Node.js 18+ installed on production server
- PostgreSQL and Redis running on production server
- Nginx configured with SSL certificates

## 🔐 Step 1: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add the following secrets:

### Required Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `PRODUCTION_SSH_KEY` | Private SSH key for server access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `PRODUCTION_HOST` | Production server IP or domain | `SERVER_IP` or `example.com` |
| `PRODUCTION_USER` | SSH username | `admin1` |
| `PRODUCTION_PATH` | Full path to project directory | `/home/admin1/Downloads/CRM-APP-MONOREPO-PROD` |

### How to Generate SSH Key

1. **On your local machine**, generate a new SSH key pair:
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_actions_key
```

2. **Copy the public key to your production server**:
```bash
ssh-copy-id -i ~/.ssh/github_actions_key.pub admin1@SERVER_IP
```

3. **Add the private key to GitHub Secrets**:
```bash
cat ~/.ssh/github_actions_key
```
Copy the entire output (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) and paste it as the `PRODUCTION_SSH_KEY` secret.

## 🛠️ Step 2: Server Preparation

### Install Required Tools

SSH into your production server and install necessary tools:

```bash
# Install jq for JSON parsing
sudo apt update
sudo apt install -y jq curl

# Ensure Node.js 18+ is installed
node --version
npm --version

# Ensure PostgreSQL and Redis are running
sudo systemctl status postgresql
sudo systemctl status redis-server
```

### Create Required Directories

```bash
# Create backup directory
sudo mkdir -p /home/admin1/backups
sudo chown admin1:admin1 /home/admin1/backups

# Create logs directory
sudo mkdir -p /home/admin1/logs
sudo chown admin1:admin1 /home/admin1/logs

# Ensure project directory exists and has correct permissions
sudo chown -R admin1:admin1 /home/admin1/Downloads/CRM-APP-MONOREPO-PROD
```

### Make Scripts Executable

```bash
cd /home/admin1/Downloads/CRM-APP-MONOREPO-PROD
chmod +x scripts/*.sh
chmod +x start-production.sh
```

## 🔧 Step 3: Environment Configuration

### Update Environment Variables

Ensure your `.env` files in each component (CRM-BACKEND, CRM-FRONTEND, CRM-MOBILE) have the correct production values:

**CRM-BACKEND/.env:**
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://example_db_user:example_db_password@localhost:5432/acs_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-production-jwt-secret
CORS_ORIGIN=https://example.com,https://SERVER_IP
```

**CRM-FRONTEND/.env:**
```env
VITE_API_BASE_URL=https://example.com/api
VITE_NODE_ENV=production
```

**CRM-MOBILE/.env:**
```env
VITE_API_BASE_URL_STATIC_IP=https://example.com/api
VITE_NODE_ENV=production
```

## 🚀 Step 4: Test the Deployment Pipeline

### Manual Test

1. **Push a test commit to main branch**:
```bash
git add .
git commit -m "test: trigger deployment pipeline"
git push origin main
```

2. **Monitor the GitHub Actions workflow**:
   - Go to your repository → Actions tab
   - Watch the "🚀 Production Deployment Pipeline" workflow

3. **Check deployment logs on server**:
```bash
tail -f /home/admin1/logs/deployment.log
```

### Manual Deployment (if needed)

You can also run the deployment manually on the server:

```bash
cd /home/admin1/Downloads/CRM-APP-MONOREPO-PROD

# Create a mock deployment info file
cat > /tmp/deployment-info.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit_sha": "$(git rev-parse HEAD)",
  "commit_message": "Manual deployment",
  "author": "admin1",
  "branch": "main",
  "workflow_run_id": "manual",
  "components": {
    "backend": true,
    "frontend": true,
    "mobile": true
  },
  "force_rebuild": true
}
EOF

# Run deployment
./scripts/deploy-production.sh /tmp/deployment-info.json
```

## 🏥 Step 5: Health Monitoring

### Automated Health Checks

The pipeline includes automated health checks that verify:
- ✅ System services (nginx, postgresql, redis)
- ✅ Application processes (backend, frontend, mobile)
- ✅ Database connectivity
- ✅ Redis connectivity
- ✅ HTTP endpoints
- ✅ SSL certificate validity
- ✅ Disk and memory usage

### Manual Health Check

```bash
./scripts/health-check.sh
```

### Health Check Endpoints

- **Main Health**: https://example.com/health
- **API Health**: https://example.com/api/health
- **Frontend**: https://example.com/
- **Mobile**: https://example.com/mobile/

## 🔄 Step 6: Rollback Procedures

### Automatic Rollback

The pipeline automatically rolls back if deployment fails. You can also trigger manual rollback:

```bash
./scripts/rollback.sh
```

### Manual Rollback Steps

1. **Find available backups**:
```bash
ls -la /home/admin1/backups/
```

2. **Restore specific backup**:
```bash
# Edit rollback.sh to use specific backup if needed
./scripts/rollback.sh
```

## 📊 Step 7: Monitoring and Logging

### Log Files

- **Deployment**: `/home/admin1/logs/deployment.log`
- **Health Check**: `/home/admin1/logs/health-check.log`
- **Rollback**: `/home/admin1/logs/rollback.log`
- **Backend**: `/home/admin1/Downloads/CRM-APP-MONOREPO-PROD/logs/backend.log`
- **Frontend**: `/home/admin1/Downloads/CRM-APP-MONOREPO-PROD/logs/frontend.log`
- **Mobile**: `/home/admin1/Downloads/CRM-APP-MONOREPO-PROD/logs/mobile.log`

### Monitor Deployment

```bash
# Watch deployment logs in real-time
tail -f /home/admin1/logs/deployment.log

# Check service status
ps aux | grep node

# Check service logs
tail -f /home/admin1/Downloads/CRM-APP-MONOREPO-PROD/logs/backend.log
```

## 🔧 Step 8: Customization

### Modify Deployment Behavior

Edit the workflow file `.github/workflows/deploy-production.yml` to:
- Add more test steps
- Modify deployment conditions
- Add notifications (Slack, email, etc.)
- Customize build processes

### Add Environment-Specific Configurations

Create different deployment workflows for staging/production:
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`

## 🚨 Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   - Verify SSH key is correctly added to GitHub secrets
   - Ensure public key is in server's `~/.ssh/authorized_keys`
   - Check server firewall settings

2. **Permission Denied**
   - Ensure scripts are executable: `chmod +x scripts/*.sh`
   - Check file ownership: `chown -R admin1:admin1 /path/to/project`

3. **Service Start Failed**
   - Check if ports are already in use: `netstat -tlnp | grep :3000`
   - Verify environment variables are set correctly
   - Check application logs for errors

4. **Database Connection Failed**
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check database credentials in `.env` files
   - Test connection manually: `psql -h localhost -U example_db_user -d acs_db`

### Emergency Procedures

1. **Stop all services immediately**:
```bash
pkill -f "npm run dev"
pkill -f "node"
```

2. **Quick rollback**:
```bash
./scripts/rollback.sh
```

3. **Manual service restart**:
```bash
./start-production.sh
```

## 📞 Support

For issues with the deployment pipeline:
1. Check GitHub Actions logs
2. Review server logs in `/home/admin1/logs/`
3. Run health checks manually
4. Contact system administrator if needed

---

**🎉 Your CRM deployment pipeline is now ready!** Every push to the main branch will automatically deploy to production with proper health checks and rollback capabilities.
