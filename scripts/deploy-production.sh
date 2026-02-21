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
MAX_BACKUPS=3

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
    FORCE_REBUILD=$(jq -r '.force_rebuild' "$DEPLOYMENT_INFO_FILE")
    RESTORE_DATABASE=$(jq -r '.restore_database // false' "$DEPLOYMENT_INFO_FILE")

    # Force rebuild all components for now
    FORCE_REBUILD="true"
    
    print_info "Deployment Info:"
    print_info "  Commit: $COMMIT_SHA"
    print_info "  Author: $AUTHOR"
    print_info "  Timestamp: $TIMESTAMP"
    print_info "  Backend Changed: $BACKEND_CHANGED"
    print_info "  Frontend Changed: $FRONTEND_CHANGED"
    print_info "  Force Rebuild: $FORCE_REBUILD (FORCED FOR ALL COMPONENTS)"
    print_info "  Restore Database: $RESTORE_DATABASE"
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
    PGPASSWORD=example_db_password pg_dump -h localhost -U example_db_user -d acs_db > "$backup_path/database.sql"
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

    # Check if PM2 is available
    if command -v pm2 >/dev/null 2>&1; then
        print_info "Using PM2 to stop services..."

        local services=("crm-backend" "crm-frontend")

        for service in "${services[@]}"; do
            # Check if process exists in PM2
            if pm2 jlist 2>/dev/null | jq -e ".[] | select(.name==\"$service\")" >/dev/null 2>&1; then
                print_info "Stopping $service via PM2..."
                pm2 stop "$service" >/dev/null 2>&1 || true
                pm2 delete "$service" >/dev/null 2>&1 || true
                print_status "$service stopped"
            else
                print_info "$service not found in PM2"
            fi
        done

        # Save PM2 process list
        pm2 save --force >/dev/null 2>&1 || true
    else
        # Fallback to PID file method
        print_info "PM2 not available, using PID files..."

        local services=("backend" "frontend")

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
    fi
}

# Update code
update_code() {
    print_header "📥 Updating Code"

    cd "$PROJECT_ROOT"

    # Check if this is a git repository
    if [ -d ".git" ]; then
        print_info "Fetching latest changes from repository..."
        git fetch origin

        # Checkout specific commit
        print_info "Checking out commit: $COMMIT_SHA"
        git checkout "$COMMIT_SHA"

        print_status "Code updated successfully"
    else
        print_info "Not a git repository, code already synced from release"
    fi
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
    
    # If no specific components changed, update all
    if [ ${#components[@]} -eq 0 ]; then
        components=("CRM-BACKEND" "CRM-FRONTEND")
    fi
    
    for component in "${components[@]}"; do
        if [ -d "$PROJECT_ROOT/$component" ]; then
            print_info "Installing dependencies for $component..."
            cd "$PROJECT_ROOT/$component"

            # Clear npm cache
            npm cache clean --force

            # Remove node_modules and package-lock.json for fresh install
            rm -rf node_modules package-lock.json

            # Install dependencies
            npm install --production=false

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
}

# Run database migrations
run_database_migrations() {
    print_header "🗄️ Running Database Migrations"

    cd "$PROJECT_ROOT/CRM-BACKEND"

    # Check if migrations directory exists
    if [ ! -d "migrations" ]; then
        print_warning "Migrations directory not found, skipping migrations"
        return 0
    fi

    # Count migration files
    local migration_count=$(find migrations -name "*.sql" 2>/dev/null | wc -l)
    print_info "Found $migration_count migration file(s)"

    # Check migration status
    print_info "Checking migration status..."
    if npm run migrate:status 2>&1 | tee -a "$LOG_FILE"; then
        print_status "Migration status check completed"
    else
        print_warning "Could not check migration status (this is normal for first run)"
    fi

    # Execute pending migrations
    print_info "Executing pending migrations..."
    if npm run migrate 2>&1 | tee -a "$LOG_FILE"; then
        print_status "✅ Database migrations completed successfully"
    else
        local exit_code=$?
        print_error "❌ Database migration failed with exit code: $exit_code"
        print_error "Deployment HALTED - Services will NOT be started"
        print_error "Database backup available at: $(cat /tmp/current_backup_path 2>/dev/null || echo 'Unknown')"
        print_error ""
        print_error "To rollback:"
        print_error "  1. Restore database: PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db < BACKUP_PATH/database.sql"
        print_error "  2. Restore code: cp -r BACKUP_PATH/code/* $PROJECT_ROOT/"
        print_error "  3. Restart services: cd $PROJECT_ROOT && ./start-production.sh"
        exit 1
    fi

    # Verify migration success
    print_info "Verifying migration status..."
    npm run migrate:status 2>&1 | tee -a "$LOG_FILE"

    print_status "Database migrations completed"
}

# Restore database from dump
restore_database_from_dump() {
    print_header "🗄️ Restoring Database from Dump"

    if [ "$RESTORE_DATABASE" != "true" ]; then
        print_info "Database restoration not requested, skipping"
        return 0
    fi

    local dump_file="/tmp/acs_db_final_version.sql"

    if [ ! -f "$dump_file" ]; then
        print_error "Database dump file not found: $dump_file"
        exit 1
    fi

    print_info "Importing database dump: $dump_file"
    
    # 1. Clear database schema to ensure a blank slate
    print_info "Clearing database schema (public)..."
    if PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null; then
        print_success "Database schema cleared"
    else
        print_error "Failed to clear database schema"
        exit 1
    fi

    # 2. Import the dump with strict error handling
    if PGPASSWORD=example_db_password psql -v ON_ERROR_STOP=1 -h localhost -U example_db_user -d acs_db < "$dump_file" > /dev/null; then
        print_success "Database restored successfully from dump"
    else
        print_error "Database restoration failed"
        exit 1
    fi
}

# Setup environment files
setup_environment_files() {
    print_header "⚙️ Setting Up Environment Files"

    # Backend environment
    if [ ! -f "$PROJECT_ROOT/CRM-BACKEND/.env" ]; then
        print_info "Creating backend .env file..."
        cat > "$PROJECT_ROOT/CRM-BACKEND/.env" << 'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://example_db_user:example_db_password@localhost:5432/acs_db
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-key-here-change-in-production
JWT_REFRESH_EXPIRES_IN=30d
CORS_ORIGIN=https://example.com
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_KEY
GEMINI_API_KEY=your-gemini-api-key-here
EOF
        print_status "Backend .env file created"
    else
        print_info "Backend .env file already exists"
    fi

    # Frontend environment
    if [ ! -f "$PROJECT_ROOT/CRM-FRONTEND/.env" ]; then
        print_info "Creating frontend .env file..."
        cat > "$PROJECT_ROOT/CRM-FRONTEND/.env" << 'EOF'
VITE_API_BASE_URL=https://example.com/api
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_KEY
NODE_ENV=production
EOF
        print_status "Frontend .env file created"
    else
        print_info "Frontend .env file already exists"
    fi

    print_status "Environment files setup completed"
}

# Configure nginx for mobile app
configure_nginx() {
    print_header "🌐 Configuring Nginx"

    # Fix mobile app proxy configuration to prevent redirect loop
    print_info "Ensuring mobile app nginx configuration is correct..."

    # Check if the mobile proxy configuration needs fixing
    if grep -q "proxy_pass http://crm_mobile/;" /etc/nginx/sites-enabled/* 2>/dev/null; then
        print_info "Fixing mobile app proxy configuration..."
        sed -i 's|proxy_pass http://crm_mobile/;|proxy_pass http://crm_mobile/mobile/;|' /etc/nginx/sites-enabled/*

        # Test nginx configuration
        if nginx -t; then
            print_info "Reloading nginx configuration..."
            systemctl reload nginx
            print_status "Nginx configuration updated successfully"
        else
            print_error "Nginx configuration test failed!"
            return 1
        fi
    else
        print_info "Mobile app nginx configuration is already correct"
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

        # Run startup script with timeout to prevent hanging
        if timeout 120 ./start-production.sh; then
            print_status "Services started successfully"
        else
            local exit_code=$?
            if [ $exit_code -eq 124 ]; then
                print_error "Startup script timed out after 120 seconds"
                exit 1
            else
                print_error "Startup script failed with exit code: $exit_code"
                exit 1
            fi
        fi
    else
        print_error "Production startup script not found!"
        exit 1
    fi
}

# Create new release (simplified - no tarball extraction)
create_release() {
    print_header "📦 Creating New Release"
    
    # Get commit SHA from deployment info
    local COMMIT_SHA=$(jq -r '.commit_sha // "unknown"' "$DEPLOYMENT_INFO_FILE")
    
    # Create timestamped release directory
    RELEASE_NAME="$(date +%Y%m%d_%H%M%S)_${COMMIT_SHA:0:8}"
    NEW_RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
    
    print_info "Creating release: $RELEASE_NAME"
    mkdir -p "$NEW_RELEASE_DIR"
    # This preserves uploads, logs, and other runtime directories
    print_info "Using rsync to sync files (preserving existing directories)..."
    rsync -av --exclude='node_modules' \
              --exclude='dist' \
              --exclude='build' \
              --exclude='.env' \
              --exclude='.env.local' \
              --exclude='.env.production' \
              --exclude='uploads' \
              --exclude='logs' \
              --exclude='*.log' \
              "$NEW_RELEASE_DIR/" "$PROJECT_ROOT/"

    print_status "New release created: $NEW_RELEASE_DIR"
    print_status "Code synced to: $PROJECT_ROOT"
}

# Update code (Legacy function, now handled by create_release)
update_code() {
    print_info "Code update handled by release creation (tarball extraction)"
}

# Cleanup old releases and backups
cleanup_old_deployments() {
    print_header "🧹 Cleaning Up Old Deployments"

    # Keep only the latest 3 releases
    print_info "Cleaning up old releases (keeping latest 3)..."
    cd "$RELEASES_DIR"

    # Count current releases
    local release_count=$(ls -1 | wc -l)
    print_info "Current releases: $release_count"

    if [ "$release_count" -gt 3 ]; then
        # Remove old releases (keep latest 3)
        local releases_to_remove=$(ls -1t | tail -n +4)
        if [ -n "$releases_to_remove" ]; then
            echo "$releases_to_remove" | xargs -r rm -rf
            local removed_count=$(echo "$releases_to_remove" | wc -l)
            print_status "Removed $removed_count old releases"
        fi
    else
        print_info "No old releases to remove (have $release_count, keeping 3)"
    fi

    # Clean up old backups (already handled in create_backup, but ensure consistency)
    print_info "Cleaning up old backups (keeping latest $MAX_BACKUPS)..."
    cd "$BACKUP_DIR"

    # Count current backups
    local backup_count=$(ls -1 | grep "crm-backup-" | wc -l)
    print_info "Current backups: $backup_count"

    if [ "$backup_count" -gt "$MAX_BACKUPS" ]; then
        # Remove old backups
        local backups_to_remove=$(ls -t | grep "crm-backup-" | tail -n +$((MAX_BACKUPS + 1)))
        if [ -n "$backups_to_remove" ]; then
            echo "$backups_to_remove" | xargs -r rm -rf
            local removed_backup_count=$(echo "$backups_to_remove" | wc -l)
            print_status "Removed $removed_backup_count old backups"
        fi
    else
        print_info "No old backups to remove (have $backup_count, keeping $MAX_BACKUPS)"
    fi

    # Show disk space savings
    print_info "Checking disk space after cleanup..."
    local releases_size=$(du -sh "$RELEASES_DIR" | cut -f1)
    local backups_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    print_status "Current releases size: $releases_size"
    print_status "Current backups size: $backups_size"

    # Show overall disk usage
    local disk_usage=$(df -h / | tail -1 | awk '{print $5}')
    print_status "Overall disk usage: $disk_usage"
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
    setup_environment_files
    configure_nginx
    build_applications

    # Database operations
    restore_database_from_dump
    run_database_migrations

    clear_caches

    # Post-deployment
    start_services

    # Cleanup after successful deployment
    cleanup_old_deployments

    print_header "🎉 Deployment Completed Successfully!"
    print_status "Deployment completed at $(date)"
    print_status "Commit: $COMMIT_SHA"
    print_status "Author: $AUTHOR"
    print_status "Release: $RELEASE_NAME"
}

# Execute main function
main "$@"
