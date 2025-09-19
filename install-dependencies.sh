#!/bin/bash

# CRM System Dependencies Installation Script
# This script installs all required dependencies for the CRM system on a fresh Ubuntu/Debian server

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

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. This is not recommended for production."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        print_error "Cannot detect OS. This script supports Ubuntu/Debian only."
        exit 1
    fi
    
    print_info "Detected OS: $OS $VER"
    
    if [[ "$OS" != *"Ubuntu"* ]] && [[ "$OS" != *"Debian"* ]]; then
        print_error "This script supports Ubuntu/Debian only. Detected: $OS"
        exit 1
    fi
}

# Update system packages
update_system() {
    print_header "Updating System Packages"
    sudo apt update
    sudo apt upgrade -y
    print_success "System packages updated"
}

# Install Node.js and npm
install_nodejs() {
    print_header "Installing Node.js and npm"
    
    # Check if Node.js is already installed
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_info "Node.js already installed: $NODE_VERSION"
        
        # Check if version is 18 or higher
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            print_success "Node.js version is compatible"
            return
        else
            print_warning "Node.js version is too old. Installing latest LTS..."
        fi
    fi
    
    # Install Node.js 20 LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    print_success "Node.js installed: $NODE_VERSION"
    print_success "npm installed: $NPM_VERSION"
}

# Install PostgreSQL
install_postgresql() {
    print_header "Installing PostgreSQL"
    
    if command -v psql >/dev/null 2>&1; then
        print_info "PostgreSQL already installed"
        return
    fi
    
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    print_success "PostgreSQL installed and started"
    
    # Create database and user
    print_info "Setting up database..."
    sudo -u postgres psql -c "CREATE DATABASE acs_db;" 2>/dev/null || print_info "Database acs_db already exists"
    sudo -u postgres psql -c "CREATE USER example_db_user WITH PASSWORD 'example_db_password';" 2>/dev/null || print_info "User example_db_user already exists"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE acs_db TO example_db_user;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER USER example_db_user CREATEDB;" 2>/dev/null || true
    
    print_success "Database setup completed"
}

# Install Redis
install_redis() {
    print_header "Installing Redis"

    if command -v redis-server >/dev/null 2>&1; then
        print_info "Redis already installed"
        return
    fi

    sudo apt install -y redis-server

    # Configure Redis for production security
    print_info "Configuring Redis security..."
    sudo sed -i 's/^# requirepass foobared/requirepass redis_production_password_change_me/' /etc/redis/redis.conf
    sudo sed -i 's/^bind 127.0.0.1 ::1/bind 127.0.0.1/' /etc/redis/redis.conf

    sudo systemctl start redis-server
    sudo systemctl enable redis-server

    print_success "Redis installed, configured, and started"
}

# Install Nginx
install_nginx() {
    print_header "Installing Nginx"
    
    if command -v nginx >/dev/null 2>&1; then
        print_info "Nginx already installed"
        return
    fi
    
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    print_success "Nginx installed and started"
}

# Install PM2 for process management
install_pm2() {
    print_header "Installing PM2"
    
    if command -v pm2 >/dev/null 2>&1; then
        print_info "PM2 already installed"
        return
    fi
    
    sudo npm install -g pm2
    
    # Setup PM2 startup
    pm2 startup | grep -E "sudo.*pm2" | bash || true
    
    print_success "PM2 installed"
}

# Install additional tools
install_tools() {
    print_header "Installing Additional Tools"
    
    sudo apt install -y \
        curl \
        wget \
        git \
        unzip \
        build-essential \
        python3 \
        python3-pip \
        certbot \
        python3-certbot-nginx \
        ufw \
        htop \
        nano \
        vim
    
    print_success "Additional tools installed"
}

# Install project dependencies
install_project_dependencies() {
    print_header "Installing Project Dependencies"
    
    # Backend dependencies
    if [ -d "CRM-BACKEND" ]; then
        print_info "Installing backend dependencies..."
        cd CRM-BACKEND
        npm install
        cd ..
        print_success "Backend dependencies installed"
    fi
    
    # Frontend dependencies
    if [ -d "CRM-FRONTEND" ]; then
        print_info "Installing frontend dependencies..."
        cd CRM-FRONTEND
        npm install
        cd ..
        print_success "Frontend dependencies installed"
    fi
    
    # Mobile dependencies
    if [ -d "CRM-MOBILE" ]; then
        print_info "Installing mobile dependencies..."
        cd CRM-MOBILE
        npm install
        cd ..
        print_success "Mobile dependencies installed"
    fi
}

# Main installation function
main() {
    print_header "CRM System Dependencies Installation"
    print_info "This script will install all required dependencies for the CRM system"
    
    check_root
    detect_os
    
    print_info "Starting installation..."
    
    update_system
    install_nodejs
    install_postgresql
    install_redis
    install_nginx
    install_pm2
    install_tools
    
    # Install project dependencies if in project directory
    if [ -f "package.json" ] || [ -d "CRM-BACKEND" ]; then
        install_project_dependencies
    else
        print_info "Not in project directory. Skipping project dependencies."
        print_info "Run this script from the project root to install project dependencies."
    fi
    
    print_header "Installation Complete!"
    print_success "All dependencies have been installed successfully"
    
    print_info "Next steps:"
    echo "1. Configure your environment variables"
    echo "2. Run the CRM network launcher script"
    echo "3. Configure firewall and SSL certificates"
    
    print_info "Services status:"
    sudo systemctl status postgresql --no-pager -l || true
    sudo systemctl status redis-server --no-pager -l || true
    sudo systemctl status nginx --no-pager -l || true
}

# Run main function
main "$@"
