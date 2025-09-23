#!/bin/bash

# CRM Deployment Environment Setup Script
# This script prepares the production server for automated deployments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/home/admin1/Downloads/CRM-APP-MONOREPO-PROD"
BACKUP_DIR="/home/admin1/backups"
LOG_DIR="/home/admin1/logs"

# Utility functions
print_header() {
    echo -e "${CYAN}$1${NC}"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as correct user
check_user() {
    if [ "$USER" != "admin1" ]; then
        print_error "This script must be run as user 'admin1'"
        exit 1
    fi
    print_status "Running as correct user: $USER"
}

# Install required system packages
install_system_packages() {
    print_header "📦 Installing System Packages"
    
    # Update package list
    print_info "Updating package list..."
    sudo apt update
    
    # Install required packages
    local packages=("jq" "curl" "git" "build-essential" "nginx" "postgresql" "redis-server" "certbot" "python3-certbot-nginx")
    
    for package in "${packages[@]}"; do
        if dpkg -l | grep -q "^ii  $package "; then
            print_status "$package is already installed"
        else
            print_info "Installing $package..."
            sudo apt install -y "$package"
            print_status "$package installed successfully"
        fi
    done
}

# Setup Node.js
setup_nodejs() {
    print_header "🟢 Setting up Node.js"
    
    # Check if Node.js is installed and version
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -ge 18 ]; then
            print_status "Node.js $(node --version) is already installed"
            return 0
        else
            print_warning "Node.js version is too old: $(node --version)"
        fi
    fi
    
    # Install Node.js 18.x
    print_info "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    print_status "Node.js $(node --version) installed successfully"
    print_status "npm $(npm --version) installed successfully"
}

# Create required directories
create_directories() {
    print_header "📁 Creating Required Directories"
    
    local directories=("$BACKUP_DIR" "$LOG_DIR" "$PROJECT_ROOT/logs")
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            print_info "Creating directory: $dir"
            mkdir -p "$dir"
            chown admin1:admin1 "$dir"
            print_status "Directory created: $dir"
        else
            print_status "Directory already exists: $dir"
        fi
    done
}

# Configure system services
configure_system_services() {
    print_header "⚙️ Configuring System Services"
    
    local services=("nginx" "postgresql" "redis-server")
    
    for service in "${services[@]}"; do
        print_info "Configuring $service..."
        
        # Enable service
        sudo systemctl enable "$service"
        
        # Start service if not running
        if ! systemctl is-active --quiet "$service"; then
            sudo systemctl start "$service"
        fi
        
        if systemctl is-active --quiet "$service"; then
            print_status "$service is running and enabled"
        else
            print_error "Failed to start $service"
            exit 1
        fi
    done
}

# Setup PostgreSQL database
setup_postgresql() {
    print_header "🐘 Setting up PostgreSQL"
    
    # Check if database already exists
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw acs_db; then
        print_status "Database 'acs_db' already exists"
        return 0
    fi
    
    print_info "Creating PostgreSQL user and database..."
    
    # Create user and database
    sudo -u postgres psql << EOF
CREATE USER acs_user WITH PASSWORD 'acs_password';
CREATE DATABASE acs_db OWNER acs_user;
GRANT ALL PRIVILEGES ON DATABASE acs_db TO acs_user;
\q
EOF
    
    print_status "PostgreSQL database setup completed"
}

# Configure Redis
configure_redis() {
    print_header "🔴 Configuring Redis"
    
    # Check if Redis is accessible
    if redis-cli ping >/dev/null 2>&1; then
        print_status "Redis is running and accessible"
    else
        print_error "Redis is not accessible"
        exit 1
    fi
    
    # Configure Redis for production (optional)
    print_info "Redis configuration is ready for production use"
}

# Setup SSL certificates
setup_ssl_certificates() {
    print_header "🔒 Setting up SSL Certificates"
    
    # Check if certificates already exist
    if sudo certbot certificates 2>/dev/null | grep -q "crm.allcheckservices.com"; then
        print_status "SSL certificates already exist for crm.allcheckservices.com"
        return 0
    fi
    
    print_warning "SSL certificates not found. You need to set them up manually:"
    print_info "Run: sudo certbot --nginx -d crm.allcheckservices.com"
    print_info "This requires DNS to be properly configured first"
}

# Configure Nginx
configure_nginx() {
    print_header "🌐 Configuring Nginx"
    
    # Create nginx configuration for CRM
    local nginx_config="/etc/nginx/sites-available/crm"
    
    if [ ! -f "$nginx_config" ]; then
        print_info "Creating Nginx configuration..."
        
        sudo tee "$nginx_config" > /dev/null << 'EOF'
server {
    listen 80;
    server_name crm.allcheckservices.com 49.50.119.155;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.allcheckservices.com 49.50.119.155;
    
    # SSL configuration (will be managed by certbot)
    ssl_certificate /etc/letsencrypt/live/crm.allcheckservices.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.allcheckservices.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Frontend (React)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Mobile App
    location /mobile/ {
        proxy_pass http://localhost:5180/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
        
        # Enable the site
        sudo ln -sf "$nginx_config" /etc/nginx/sites-enabled/
        
        # Remove default site if it exists
        sudo rm -f /etc/nginx/sites-enabled/default
        
        # Test nginx configuration
        if sudo nginx -t; then
            print_status "Nginx configuration is valid"
            sudo systemctl reload nginx
            print_status "Nginx reloaded successfully"
        else
            print_error "Nginx configuration is invalid"
            exit 1
        fi
    else
        print_status "Nginx configuration already exists"
    fi
}

# Setup deployment scripts permissions
setup_script_permissions() {
    print_header "🔧 Setting up Script Permissions"
    
    if [ -d "$PROJECT_ROOT/scripts" ]; then
        print_info "Making deployment scripts executable..."
        chmod +x "$PROJECT_ROOT/scripts"/*.sh
        print_status "Deployment scripts are now executable"
    else
        print_warning "Scripts directory not found. This is normal if running before first deployment."
    fi
    
    if [ -f "$PROJECT_ROOT/start-production.sh" ]; then
        chmod +x "$PROJECT_ROOT/start-production.sh"
        print_status "Production startup script is executable"
    else
        print_warning "Production startup script not found. This is normal if running before first deployment."
    fi
}

# Setup log rotation
setup_log_rotation() {
    print_header "📋 Setting up Log Rotation"
    
    local logrotate_config="/etc/logrotate.d/crm-deployment"
    
    if [ ! -f "$logrotate_config" ]; then
        print_info "Creating log rotation configuration..."
        
        sudo tee "$logrotate_config" > /dev/null << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 admin1 admin1
}

$PROJECT_ROOT/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 admin1 admin1
    postrotate
        # Restart services if needed
        /bin/true
    endscript
}
EOF
        
        print_status "Log rotation configured"
    else
        print_status "Log rotation already configured"
    fi
}

# Setup cron jobs for maintenance
setup_cron_jobs() {
    print_header "⏰ Setting up Cron Jobs"
    
    # Add cron job for SSL certificate renewal
    local cron_line="0 12 * * * /usr/bin/certbot renew --quiet"
    
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        print_info "Adding SSL certificate renewal cron job..."
        (crontab -l 2>/dev/null; echo "$cron_line") | crontab -
        print_status "SSL certificate renewal cron job added"
    else
        print_status "SSL certificate renewal cron job already exists"
    fi
}

# Final verification
verify_setup() {
    print_header "✅ Verifying Setup"
    
    local checks_passed=true
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        print_status "Node.js: $(node --version)"
    else
        print_error "Node.js not found"
        checks_passed=false
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        print_status "npm: $(npm --version)"
    else
        print_error "npm not found"
        checks_passed=false
    fi
    
    # Check services
    local services=("nginx" "postgresql" "redis-server")
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            print_status "$service: running"
        else
            print_error "$service: not running"
            checks_passed=false
        fi
    done
    
    # Check directories
    local directories=("$BACKUP_DIR" "$LOG_DIR")
    for dir in "${directories[@]}"; do
        if [ -d "$dir" ]; then
            print_status "Directory exists: $dir"
        else
            print_error "Directory missing: $dir"
            checks_passed=false
        fi
    done
    
    if [ "$checks_passed" = true ]; then
        print_header "🎉 Setup Completed Successfully!"
        print_info "Your server is now ready for automated deployments."
        print_info ""
        print_info "Next steps:"
        print_info "1. Configure GitHub secrets (see DEPLOYMENT-SETUP.md)"
        print_info "2. Set up SSL certificates: sudo certbot --nginx -d crm.allcheckservices.com"
        print_info "3. Push code to main branch to trigger first deployment"
    else
        print_header "❌ Setup Incomplete"
        print_error "Please fix the issues above before proceeding."
        exit 1
    fi
}

# Main function
main() {
    print_header "🚀 CRM Deployment Environment Setup"
    print_header "===================================="
    
    check_user
    install_system_packages
    setup_nodejs
    create_directories
    configure_system_services
    setup_postgresql
    configure_redis
    configure_nginx
    setup_ssl_certificates
    setup_script_permissions
    setup_log_rotation
    setup_cron_jobs
    verify_setup
}

# Execute main function
main "$@"
