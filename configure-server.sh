#!/bin/bash

# CRM System Server Configuration Script
# This script configures firewall, hosts file, and other server settings for the CRM system

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration variables
DOMAIN_NAME="${DOMAIN_NAME:-crm.allcheckservices.com}"
SERVER_IP="${SERVER_IP:-$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo '')}"
SSH_PORT="${SSH_PORT:-22}"

# Get server IP if not detected
get_server_ip() {
    if [ -z "$SERVER_IP" ]; then
        print_info "Could not auto-detect server IP. Please enter it manually:"
        read -p "Server IP: " SERVER_IP
        
        if [ -z "$SERVER_IP" ]; then
            print_error "Server IP is required"
            exit 1
        fi
    fi
    
    print_info "Using server IP: $SERVER_IP"
}

# Configure UFW firewall
configure_firewall() {
    print_header "Configuring UFW Firewall"
    
    # Check if UFW is installed
    if ! command -v ufw >/dev/null 2>&1; then
        print_info "Installing UFW..."
        sudo apt update
        sudo apt install -y ufw
    fi
    
    # Reset UFW to defaults
    print_info "Resetting UFW to defaults..."
    sudo ufw --force reset
    
    # Set default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH (be careful not to lock yourself out)
    print_info "Allowing SSH on port $SSH_PORT..."
    sudo ufw allow $SSH_PORT/tcp comment 'SSH'
    
    # Allow HTTP and HTTPS
    print_info "Allowing HTTP and HTTPS..."
    sudo ufw allow 80/tcp comment 'HTTP'
    sudo ufw allow 443/tcp comment 'HTTPS'
    
    # Allow CRM application ports
    print_info "Allowing CRM application ports..."
    sudo ufw allow 3000/tcp comment 'CRM Backend API'
    sudo ufw allow 5173/tcp comment 'CRM Frontend'
    sudo ufw allow 5180/tcp comment 'CRM Mobile'
    
    # Allow database ports (restrict to localhost if needed)
    print_info "Allowing database ports..."
    sudo ufw allow from 127.0.0.1 to any port 5432 comment 'PostgreSQL localhost'
    sudo ufw allow from 127.0.0.1 to any port 6379 comment 'Redis localhost'
    
    # Enable UFW
    print_info "Enabling UFW..."
    sudo ufw --force enable
    
    # Show status
    print_info "UFW Status:"
    sudo ufw status verbose
    
    print_success "Firewall configured successfully"
}

# Configure hosts file
configure_hosts() {
    print_header "Configuring Hosts File"
    
    # Backup original hosts file
    if [ ! -f /etc/hosts.backup ]; then
        sudo cp /etc/hosts /etc/hosts.backup
        print_info "Hosts file backed up to /etc/hosts.backup"
    fi
    
    # Remove existing CRM entries
    sudo sed -i '/# CRM System entries/,/# End CRM System entries/d' /etc/hosts
    
    # Add CRM system entries
    print_info "Adding CRM system entries to hosts file..."
    
    cat << EOF | sudo tee -a /etc/hosts
# CRM System entries
127.0.0.1 $DOMAIN_NAME
127.0.0.1 www.$DOMAIN_NAME
$SERVER_IP $DOMAIN_NAME
$SERVER_IP www.$DOMAIN_NAME
# End CRM System entries
EOF
    
    print_success "Hosts file configured"
}

# Configure Nginx
configure_nginx() {
    print_header "Configuring Nginx"
    
    # Create nginx configuration for domain access
    print_info "Creating Nginx configuration for domain access..."
    
    sudo tee /etc/nginx/sites-available/$DOMAIN_NAME > /dev/null << EOF
# CRM System - Domain Access Configuration
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Frontend (React app)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Mobile App
    location /mobile/ {
        proxy_pass http://127.0.0.1:5180/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # Create nginx configuration for IP access
    print_info "Creating Nginx configuration for IP access..."
    
    sudo tee /etc/nginx/sites-available/ip-access > /dev/null << EOF
# CRM System - IP Access Configuration
server {
    listen 80 default_server;
    server_name $SERVER_IP;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Frontend (React app)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Mobile App
    location /mobile/ {
        proxy_pass http://127.0.0.1:5180/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # Enable sites
    sudo ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
    sudo ln -sf /etc/nginx/sites-available/ip-access /etc/nginx/sites-enabled/
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    if sudo nginx -t; then
        sudo systemctl reload nginx
        print_success "Nginx configured and reloaded"
    else
        print_error "Nginx configuration test failed"
        exit 1
    fi
}

# Configure SSL with Let's Encrypt
configure_ssl() {
    print_header "Configuring SSL Certificate"
    
    print_info "Setting up SSL certificate for $DOMAIN_NAME..."
    print_warning "Make sure your domain points to this server before proceeding"
    
    read -p "Do you want to configure SSL certificate now? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Install certbot if not already installed
        if ! command -v certbot >/dev/null 2>&1; then
            sudo apt update
            sudo apt install -y certbot python3-certbot-nginx
        fi
        
        # Get SSL certificate
        sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email admin@$DOMAIN_NAME
        
        print_success "SSL certificate configured"
    else
        print_info "SSL configuration skipped. You can run 'sudo certbot --nginx -d $DOMAIN_NAME' later"
    fi
}

# Configure system limits
configure_system_limits() {
    print_header "Configuring System Limits"
    
    # Increase file descriptor limits
    print_info "Configuring file descriptor limits..."
    
    cat << EOF | sudo tee -a /etc/security/limits.conf
# CRM System limits
* soft nofile 65536
* hard nofile 65536
root soft nofile 65536
root hard nofile 65536
EOF
    
    # Configure systemd limits
    sudo mkdir -p /etc/systemd/system.conf.d
    cat << EOF | sudo tee /etc/systemd/system.conf.d/limits.conf
[Manager]
DefaultLimitNOFILE=65536
EOF
    
    print_success "System limits configured"
}

# Main configuration function
main() {
    print_header "CRM System Server Configuration"
    print_info "This script will configure firewall, hosts, and other server settings"
    
    # Check if running as root or with sudo
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root"
    elif ! sudo -n true 2>/dev/null; then
        print_error "This script requires sudo privileges"
        exit 1
    fi
    
    get_server_ip
    
    print_info "Configuration settings:"
    echo "  Domain: $DOMAIN_NAME"
    echo "  Server IP: $SERVER_IP"
    echo "  SSH Port: $SSH_PORT"
    echo
    
    read -p "Continue with configuration? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Configuration cancelled"
        exit 0
    fi
    
    configure_firewall
    configure_hosts
    configure_nginx
    configure_system_limits
    configure_ssl
    
    print_header "Configuration Complete!"
    print_success "Server has been configured successfully"
    
    print_info "Next steps:"
    echo "1. Run the dependency installation script if not done already"
    echo "2. Deploy your CRM application code"
    echo "3. Run the CRM network launcher script"
    echo "4. Test all services"
    
    print_info "Access URLs:"
    echo "  Domain: http://$DOMAIN_NAME (or https if SSL configured)"
    echo "  IP: http://$SERVER_IP"
    echo "  Backend API: http://$DOMAIN_NAME/api"
}

# Run main function
main "$@"
