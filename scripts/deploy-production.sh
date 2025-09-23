#!/bin/bash

# CRM Production Deployment Script
# This script handles the complete deployment process for the CRM monorepo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Utility functions (will be updated with logging after LOG_FILE is set)
print_header() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${CYAN}$1${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${CYAN}$1${NC}"
    fi
}

print_success() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${GREEN}✅ $1${NC}"
    fi
}

print_warning() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${YELLOW}⚠️  $1${NC}"
    fi
}

print_error() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${RED}❌ $1${NC}"
    fi
}

print_info() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${BLUE}ℹ️  $1${NC}"
    fi
}

print_status() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${GREEN}$1${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${GREEN}$1${NC}"
    fi
}

# Configuration
DEPLOYMENT_INFO_FILE="$1"

# Production deployment paths - for production server only
CRM_ROOT="/opt/crm-app"
PROJECT_ROOT="$CRM_ROOT/current"
RELEASES_DIR="$CRM_ROOT/releases"
BACKUP_DIR="$CRM_ROOT/shared/backups"
LOG_DIR="/var/log/crm-app"
LOG_FILE="$LOG_DIR/deployment.log"

# Check if running as authorized production user
if [ "$USER" = "root" ]; then
    print_success "Running as root user"
    SUDO_CMD=""
elif [ "$USER" = "admin1" ]; then
    print_success "Running as admin1 user"
    SUDO_CMD="sudo"
else
    print_error "This script must be run as 'root' or 'admin1' user"
    print_info "Current user: $USER"
    print_info "Switch to root: su -"
    print_info "Or run as admin1: su - admin1"
    exit 1
fi
MAX_BACKUPS=5

# Ensure required directories exist
$SUDO_CMD mkdir -p "$BACKUP_DIR"
$SUDO_CMD mkdir -p "$LOG_DIR"
$SUDO_CMD mkdir -p "$RELEASES_DIR"

# Set proper ownership if running as admin1
if [ "$USER" = "admin1" ]; then
    $SUDO_CMD chown -R admin1:admin1 "$CRM_ROOT" 2>/dev/null || true
    $SUDO_CMD chown -R admin1:admin1 "$LOG_DIR" 2>/dev/null || true
fi



# Error handling
handle_error() {
    local exit_code=$?
    print_error "Deployment failed at line $1 with exit code $exit_code"
    print_error "Check the log file: $LOG_FILE"
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$PROJECT_ROOT/logs"
}

# Parse deployment info
parse_deployment_info() {
    if [ ! -f "$DEPLOYMENT_INFO_FILE" ]; then
        print_error "Deployment info file not found: $DEPLOYMENT_INFO_FILE"
        exit 1
    fi
    
    COMMIT_SHA=$(jq -r '.commit_sha' "$DEPLOYMENT_INFO_FILE")
    COMMIT_MESSAGE=$(jq -r '.commit_message' "$DEPLOYMENT_INFO_FILE")
    AUTHOR=$(jq -r '.author' "$DEPLOYMENT_INFO_FILE")
    TIMESTAMP=$(jq -r '.timestamp' "$DEPLOYMENT_INFO_FILE")
    BACKEND_CHANGED=$(jq -r '.components.backend' "$DEPLOYMENT_INFO_FILE")
    FRONTEND_CHANGED=$(jq -r '.components.frontend' "$DEPLOYMENT_INFO_FILE")
    MOBILE_CHANGED=$(jq -r '.components.mobile' "$DEPLOYMENT_INFO_FILE")
    FORCE_REBUILD=$(jq -r '.force_rebuild' "$DEPLOYMENT_INFO_FILE")
    
    print_info "Deployment Info:"
    print_info "  Commit: $COMMIT_SHA"
    print_info "  Author: $AUTHOR"
    print_info "  Timestamp: $TIMESTAMP"
    print_info "  Backend Changed: $BACKEND_CHANGED"
    print_info "  Frontend Changed: $FRONTEND_CHANGED"
    print_info "  Mobile Changed: $MOBILE_CHANGED"
    print_info "  Force Rebuild: $FORCE_REBUILD"
}

# Create backup
create_backup() {
    print_header "📦 Creating Backup"
    
    local backup_name="crm-backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    print_info "Creating backup: $backup_name"
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Backup current code
    if [ -d "$PROJECT_ROOT" ]; then
        cp -r "$PROJECT_ROOT" "$backup_path/code"
        print_status "Code backup created"
    fi
    
    # Backup database
    print_info "Creating database backup..."
    PGPASSWORD=acs_password pg_dump -h localhost -U acs_user -d acs_db > "$backup_path/database.sql"
    print_status "Database backup created"
    
    # Store backup info
    cat > "$backup_path/backup-info.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "commit_sha_before": "$(cd "$PROJECT_ROOT" && git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "backup_type": "pre-deployment",
    "deployment_commit": "$COMMIT_SHA"
}
EOF
    
    # Clean old backups
    print_info "Cleaning old backups (keeping last $MAX_BACKUPS)..."
    cd "$BACKUP_DIR"
    ls -t | grep "crm-backup-" | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -rf
    
    print_status "Backup completed: $backup_path"
    echo "$backup_path" > /tmp/current_backup_path
}

# Stop services
stop_services() {
    print_header "🛑 Stopping Services"
    
    local services=("backend" "frontend" "mobile")
    
    for service in "${services[@]}"; do
        local pid_file="$PROJECT_ROOT/logs/${service}.pid"
        
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                print_info "Stopping $service (PID: $pid)..."
                kill "$pid"
                
                # Wait for graceful shutdown
                local count=0
                while kill -0 "$pid" 2>/dev/null && [ $count -lt 30 ]; do
                    sleep 1
                    count=$((count + 1))
                done
                
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    print_warning "Force killing $service..."
                    kill -9 "$pid"
                fi
                
                rm -f "$pid_file"
                print_status "$service stopped"
            else
                print_info "$service was not running"
                rm -f "$pid_file"
            fi
        else
            print_info "$service PID file not found"
        fi
    done
}

# Update code
update_code() {
    print_header "📥 Updating Code"

    cd "$PROJECT_ROOT"

    # Reset to specific commit
    print_info "Resetting to commit: $COMMIT_SHA"
    git reset --hard "$COMMIT_SHA"

    # Clean untracked files
    git clean -fd

    print_status "Code updated successfully"
}

# Install dependencies
install_dependencies() {
    print_header "📦 Installing Dependencies"
    
    local components=()
    
    # Determine which components need dependency updates
    if [ "$BACKEND_CHANGED" = "true" ] || [ "$FORCE_REBUILD" = "true" ]; then
        components+=("CRM-BACKEND")
    fi
    
    if [ "$FRONTEND_CHANGED" = "true" ] || [ "$FORCE_REBUILD" = "true" ]; then
        components+=("CRM-FRONTEND")
    fi
    
    if [ "$MOBILE_CHANGED" = "true" ] || [ "$FORCE_REBUILD" = "true" ]; then
        components+=("CRM-MOBILE")
    fi
    
    # If no specific components changed, update all
    if [ ${#components[@]} -eq 0 ]; then
        components=("CRM-BACKEND" "CRM-FRONTEND" "CRM-MOBILE")
    fi
    
    for component in "${components[@]}"; do
        if [ -d "$PROJECT_ROOT/$component" ]; then
            print_info "Installing dependencies for $component..."
            cd "$PROJECT_ROOT/$component"

            # Clear npm cache
            npm cache clean --force

            # Remove node_modules and package-lock.json for fresh install
            rm -rf node_modules package-lock.json

            # Install dependencies with special handling for mobile
            if [ "$component" = "CRM-MOBILE" ]; then
                print_info "Installing mobile dependencies with legacy peer deps support..."
                npm install --production=false --legacy-peer-deps
            else
                npm install --production=false
            fi

            print_status "$component dependencies installed"
        fi
    done
}

# Build applications
build_applications() {
    print_header "🏗️ Building Applications"
    
    # Build backend
    if [ "$BACKEND_CHANGED" = "true" ] || [ "$FORCE_REBUILD" = "true" ]; then
        print_info "Building backend..."
        cd "$PROJECT_ROOT/CRM-BACKEND"
        npm run build
        print_status "Backend built successfully"
    fi
    
    # Build frontend
    if [ "$FRONTEND_CHANGED" = "true" ] || [ "$FORCE_REBUILD" = "true" ]; then
        print_info "Building frontend..."
        cd "$PROJECT_ROOT/CRM-FRONTEND"
        npm run build
        print_status "Frontend built successfully"
    fi
    
    # Build mobile
    if [ "$MOBILE_CHANGED" = "true" ] || [ "$FORCE_REBUILD" = "true" ]; then
        print_info "Building mobile..."
        cd "$PROJECT_ROOT/CRM-MOBILE"
        npm run build
        print_status "Mobile built successfully"
    fi
}

# Clear caches
clear_caches() {
    print_header "🧹 Clearing Caches"
    
    # Clear Redis cache
    print_info "Clearing Redis cache..."
    redis-cli FLUSHALL
    print_status "Redis cache cleared"
    
    # Clear Node.js require cache (will be cleared on restart)
    print_info "Node.js require cache will be cleared on service restart"
    
    # Clear nginx cache if configured
    if [ -d "/var/cache/nginx" ]; then
        print_info "Clearing nginx cache..."
        sudo rm -rf /var/cache/nginx/*
        print_status "Nginx cache cleared"
    fi
}

# Start services
start_services() {
    print_header "🚀 Starting Services"
    
    cd "$PROJECT_ROOT"
    
    # Use the existing production startup script
    if [ -f "start-production.sh" ]; then
        print_info "Starting services using production script..."
        chmod +x start-production.sh
        ./start-production.sh
        print_status "Services started successfully"
    else
        print_error "Production startup script not found!"
        exit 1
    fi
}

# Create new release
create_release() {
    print_header "📦 Creating New Release"

    # Create timestamped release directory
    RELEASE_NAME="$(date +%Y%m%d_%H%M%S)_${COMMIT_SHA:0:8}"
    NEW_RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"

    print_info "Creating release: $RELEASE_NAME"
    mkdir -p "$NEW_RELEASE_DIR"

    # Clone the repository to new release directory
    print_info "Cloning repository to new release..."
    cd "$RELEASES_DIR"

    # Try SSH first, fallback to copying from current deployment
    print_info "Attempting SSH clone..."

    # Set up SSH environment
    export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

    if git clone git@github.com:acsdeveloper2025/CRM-APP-MONOREPO-PROD.git "$RELEASE_NAME"; then
        print_success "Repository cloned successfully via SSH"
    else
        print_warning "SSH clone failed, copying from current deployment..."
        print_info "SSH clone error was logged above"
        # Copy from current deployment and initialize as git repo
        if [ -L "$PROJECT_ROOT" ] && [ -d "$PROJECT_ROOT" ]; then
            # Copy from current symlinked deployment
            cp -r "$PROJECT_ROOT/." "$RELEASE_NAME/"
            cd "$RELEASE_NAME"
            # Ensure it's a git repository
            if [ ! -d ".git" ]; then
                git init
                git remote add origin git@github.com:acsdeveloper2025/CRM-APP-MONOREPO-PROD.git
            fi
            print_success "Copied from current deployment"
        elif [ -d "/home/admin1/Downloads/CRM-APP-MONOREPO-PROD" ]; then
            # Fallback to old Downloads location if it still exists
            cp -r "/home/admin1/Downloads/CRM-APP-MONOREPO-PROD/." "$RELEASE_NAME/"
            cd "$RELEASE_NAME"
            # Ensure it's a git repository
            if [ ! -d ".git" ]; then
                git init
                git remote add origin git@github.com:acsdeveloper2025/CRM-APP-MONOREPO-PROD.git
            fi
            print_success "Copied from legacy deployment location"
        else
            print_error "Failed to clone repository and no existing deployment found"
            return 1
        fi
    fi

    # Update symlink to point to new release
    rm -f "$PROJECT_ROOT"
    ln -sf "$NEW_RELEASE_DIR" "$PROJECT_ROOT"

    print_status "New release created: $NEW_RELEASE_DIR"
    print_status "Current symlink updated to: $NEW_RELEASE_DIR"
}

# Main deployment function
main() {
    print_header "🚀 CRM Production Deployment Started"
    print_header "======================================"

    # Initialize
    create_directories
    parse_deployment_info

    # Pre-deployment
    create_backup
    create_release
    stop_services

    # Deployment
    update_code
    install_dependencies
    build_applications
    clear_caches

    # Post-deployment
    start_services

    print_header "🎉 Deployment Completed Successfully!"
    print_status "Deployment completed at $(date)"
    print_status "Commit: $COMMIT_SHA"
    print_status "Author: $AUTHOR"
    print_status "Release: $RELEASE_NAME"
}

# Execute main function
main "$@"
