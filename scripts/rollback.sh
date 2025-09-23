#!/bin/bash

# CRM Production Rollback Script
# Rolls back to the previous working version in case of deployment failure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/opt/crm-app/current"
BACKUP_DIR="/opt/crm-app/shared/backups"
LOG_FILE="/var/log/crm-app/rollback.log"

# Utility functions
print_header() {
    echo -e "${CYAN}$1${NC}" | tee -a "$LOG_FILE"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    local exit_code=$?
    print_error "Rollback failed at line $1 with exit code $exit_code"
    print_error "Manual intervention required!"
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

# Find the latest backup
find_latest_backup() {
    print_info "Looking for the latest backup..."
    
    if [ -f "/tmp/current_backup_path" ]; then
        BACKUP_PATH=$(cat /tmp/current_backup_path)
        if [ -d "$BACKUP_PATH" ]; then
            print_status "Found current deployment backup: $BACKUP_PATH"
            return 0
        fi
    fi
    
    # Find the most recent backup
    BACKUP_PATH=$(ls -t "$BACKUP_DIR"/crm-backup-* 2>/dev/null | head -n1)
    
    if [ -n "$BACKUP_PATH" ] && [ -d "$BACKUP_PATH" ]; then
        print_status "Found latest backup: $BACKUP_PATH"
        return 0
    else
        print_error "No backup found in $BACKUP_DIR"
        return 1
    fi
}

# Stop current services
stop_services() {
    print_header "🛑 Stopping Current Services"
    
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

# Restore code from backup
restore_code() {
    print_header "📦 Restoring Code from Backup"
    
    if [ ! -d "$BACKUP_PATH/code" ]; then
        print_error "Code backup not found in $BACKUP_PATH"
        return 1
    fi
    
    print_info "Backing up current failed deployment..."
    local failed_backup="$BACKUP_DIR/failed-deployment-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$failed_backup"
    cp -r "$PROJECT_ROOT" "$failed_backup/code" 2>/dev/null || true
    
    print_info "Restoring code from backup..."
    
    # Remove current code
    rm -rf "$PROJECT_ROOT"
    
    # Restore from backup
    cp -r "$BACKUP_PATH/code" "$PROJECT_ROOT"
    
    # Set proper permissions
    chown -R admin1:admin1 "$PROJECT_ROOT"
    
    print_status "Code restored successfully"
}

# Restore database from backup
restore_database() {
    print_header "🗄️ Restoring Database from Backup"
    
    local db_backup="$BACKUP_PATH/database.sql"
    
    if [ ! -f "$db_backup" ]; then
        print_warning "Database backup not found, skipping database restore"
        return 0
    fi
    
    print_info "Creating current database backup before restore..."
    PGPASSWORD=example_db_password pg_dump -h localhost -U example_db_user -d acs_db > "$BACKUP_DIR/pre-rollback-db-$(date +%Y%m%d-%H%M%S).sql"
    
    print_info "Restoring database from backup..."
    
    # Drop and recreate database
    PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d postgres -c "DROP DATABASE IF EXISTS acs_db;"
    PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d postgres -c "CREATE DATABASE acs_db;"
    
    # Restore from backup
    PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db < "$db_backup"
    
    print_status "Database restored successfully"
}

# Clear caches
clear_caches() {
    print_header "🧹 Clearing Caches"
    
    # Clear Redis cache
    print_info "Clearing Redis cache..."
    redis-cli FLUSHALL
    print_status "Redis cache cleared"
    
    # Clear nginx cache if configured
    if [ -d "/var/cache/nginx" ]; then
        print_info "Clearing nginx cache..."
        sudo rm -rf /var/cache/nginx/*
        print_status "Nginx cache cleared"
    fi
}

# Reinstall dependencies
reinstall_dependencies() {
    print_header "📦 Reinstalling Dependencies"
    
    local components=("CRM-BACKEND" "CRM-FRONTEND" "CRM-MOBILE")
    
    for component in "${components[@]}"; do
        if [ -d "$PROJECT_ROOT/$component" ]; then
            print_info "Reinstalling dependencies for $component..."
            cd "$PROJECT_ROOT/$component"
            
            # Clear npm cache
            npm cache clean --force
            
            # Remove node_modules
            rm -rf node_modules
            
            # Install dependencies
            npm install --production=false
            
            print_status "$component dependencies reinstalled"
        fi
    done
}

# Rebuild applications
rebuild_applications() {
    print_header "🏗️ Rebuilding Applications"
    
    # Build backend
    if [ -d "$PROJECT_ROOT/CRM-BACKEND" ]; then
        print_info "Building backend..."
        cd "$PROJECT_ROOT/CRM-BACKEND"
        npm run build
        print_status "Backend built successfully"
    fi
    
    # Build frontend
    if [ -d "$PROJECT_ROOT/CRM-FRONTEND" ]; then
        print_info "Building frontend..."
        cd "$PROJECT_ROOT/CRM-FRONTEND"
        npm run build
        print_status "Frontend built successfully"
    fi
    
    # Build mobile
    if [ -d "$PROJECT_ROOT/CRM-MOBILE" ]; then
        print_info "Building mobile..."
        cd "$PROJECT_ROOT/CRM-MOBILE"
        npm run build
        print_status "Mobile built successfully"
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
        return 1
    fi
}

# Verify rollback
verify_rollback() {
    print_header "🏥 Verifying Rollback"
    
    # Wait for services to start
    sleep 15
    
    # Check if health check script exists and run it
    if [ -f "/tmp/health-check.sh" ]; then
        print_info "Running health checks..."
        if /tmp/health-check.sh; then
            print_status "Health checks passed"
            return 0
        else
            print_error "Health checks failed"
            return 1
        fi
    else
        # Basic endpoint check
        print_info "Running basic endpoint check..."
        if curl -s -f "https://example.com/health" >/dev/null; then
            print_status "Basic health check passed"
            return 0
        else
            print_error "Basic health check failed"
            return 1
        fi
    fi
}

# Create rollback report
create_rollback_report() {
    local rollback_status=$1
    local report_file="/tmp/rollback-report.json"
    
    # Get backup info if available
    local backup_info=""
    if [ -f "$BACKUP_PATH/backup-info.json" ]; then
        backup_info=$(cat "$BACKUP_PATH/backup-info.json")
    fi
    
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "rollback_status": "$rollback_status",
    "backup_used": "$BACKUP_PATH",
    "backup_info": $backup_info,
    "rollback_reason": "deployment_failure",
    "services_status": {
        "backend": "$([ -f "$PROJECT_ROOT/logs/backend.pid" ] && echo "running" || echo "stopped")",
        "frontend": "$([ -f "$PROJECT_ROOT/logs/frontend.pid" ] && echo "running" || echo "stopped")",
        "mobile": "$([ -f "$PROJECT_ROOT/logs/mobile.pid" ] && echo "running" || echo "stopped")"
    }
}
EOF
    
    print_info "Rollback report created: $report_file"
}

# Main rollback function
main() {
    print_header "🔄 CRM Production Rollback Started"
    print_header "==================================="
    
    local rollback_success=true
    
    # Find backup
    if ! find_latest_backup; then
        print_error "Cannot proceed with rollback - no backup found"
        exit 1
    fi
    
    # Execute rollback steps
    stop_services
    
    if ! restore_code; then
        rollback_success=false
    fi
    
    # Only restore database if backup exists and restore_code succeeded
    if [ "$rollback_success" = true ]; then
        restore_database || rollback_success=false
    fi
    
    if [ "$rollback_success" = true ]; then
        clear_caches
        reinstall_dependencies || rollback_success=false
    fi
    
    if [ "$rollback_success" = true ]; then
        rebuild_applications || rollback_success=false
    fi
    
    if [ "$rollback_success" = true ]; then
        start_services || rollback_success=false
    fi
    
    if [ "$rollback_success" = true ]; then
        verify_rollback || rollback_success=false
    fi
    
    # Create report
    if [ "$rollback_success" = true ]; then
        create_rollback_report "success"
        print_header "🎉 Rollback Completed Successfully!"
        print_status "Application has been rolled back to previous working version"
        print_status "Backup used: $BACKUP_PATH"
        exit 0
    else
        create_rollback_report "failed"
        print_header "❌ Rollback Failed!"
        print_error "Manual intervention is required"
        print_error "Check logs and contact system administrator"
        exit 1
    fi
}

# Execute main function
main "$@"
