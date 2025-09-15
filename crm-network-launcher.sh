#!/bin/bash

# CRM Application Network Launcher v1.0
# Single script to configure network access and start all services
# Combines network detection, configuration, and service startup

set -e  # Exit on any error

# Handle command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "CRM Application Network Launcher v1.0"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo "  --version, -v  Show version information"
    echo "  --stop         Stop all running CRM services"

    echo ""
    echo "This script will:"
    echo "  1. Auto-detect your network IP address"
    echo "  2. Configure all CRM apps for network access"
    echo "  3. Install dependencies if needed"
    echo "  4. Start all services (Backend, Frontend, Mobile)"
    echo "  5. Provide access URLs for localhost and network"
    echo ""
    echo "Access URLs after running (FIXED PORTS):"
    echo "  • Frontend:  http://localhost:5173 or http://YOUR_IP:5173 (PORT 5173 FIXED)"
    echo "  • Mobile:    http://localhost:5180 or http://YOUR_IP:5180 (PORT 5180 FIXED)"
    echo "  • Backend:   http://localhost:3000 or http://YOUR_IP:3000 (PORT 3000 FIXED)"
    echo ""
    echo "Note: This script uses FIXED PORTS and will forcefully free them if occupied."
    echo ""
    exit 0
fi

if [ "$1" = "--version" ] || [ "$1" = "-v" ]; then
    echo "CRM Application Network Launcher v1.0"
    echo "Compatible with CRM Backend, Frontend, and Mobile applications"
    exit 0
fi

# Function to clean up old backup files (keep only last 7 days)
cleanup_old_backups() {
    print_info "Cleaning up old backup files (keeping last 7 days)..."

    # Find all backup files older than 7 days
    local old_backups=$(find . -name "*.backup.*" -type f -mtime +7 2>/dev/null)
    local cleanup_count=0

    for backup_file in $old_backups; do
        if [ -f "$backup_file" ]; then
            rm -f "$backup_file"
            cleanup_count=$((cleanup_count + 1))
        fi
    done

    if [ $cleanup_count -gt 0 ]; then
        print_status "Cleaned up $cleanup_count old backup files"
    else
        print_info "No old backup files to clean up"
    fi
}

# Function to clean up ALL backup files created during this session
cleanup_all_session_backups() {
    print_info "🧹 Cleaning up all backup files created during this session..."

    # Find all backup files created today
    local today_backups=$(find . -name "*.backup.*" -type f 2>/dev/null)
    local cleanup_count=0

    for backup_file in $today_backups; do
        if [ -f "$backup_file" ]; then
            rm -f "$backup_file"
            cleanup_count=$((cleanup_count + 1))
        fi
    done

    if [ $cleanup_count -gt 0 ]; then
        print_status "✅ Cleaned up $cleanup_count backup files"
    else
        print_info "No backup files to clean up"
    fi
}

if [ "$1" = "--clean-backups" ]; then
    echo "🧹 Cleaning up old backup files..."

    # Find all backup files older than 7 days
    old_backups=$(find . -name "*.backup.*" -type f -mtime +7 2>/dev/null)
    cleanup_count=0

    for backup_file in $old_backups; do
        if [ -f "$backup_file" ]; then
            rm -f "$backup_file"
            cleanup_count=$((cleanup_count + 1))
        fi
    done

    if [ $cleanup_count -gt 0 ]; then
        echo "✅ Cleaned up $cleanup_count old backup files"
    else
        echo "ℹ️  No old backup files to clean up"
    fi

    echo "✅ Backup cleanup completed!"
    exit 0
fi

if [ "$1" = "--stop" ]; then
    echo "🛑 Stopping all CRM services..."

    # Function to stop a service by PID file
    stop_service_by_pid() {
        local name=$1
        local pid_file="logs/${name}.pid"

        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                echo "🛑 Stopping $name (PID: $pid)..."
                kill "$pid"
                rm -f "$pid_file"
                echo "✅ $name stopped"
            else
                echo "⚠️  $name process (PID: $pid) not found"
                rm -f "$pid_file"
            fi
        else
            echo "ℹ️  No PID file found for $name"
        fi
    }

    # Function to stop services by port
    stop_service_by_port() {
        local port=$1
        local name=$2

        local pid=$(lsof -ti:$port 2>/dev/null)
        if [ -n "$pid" ]; then
            echo "🛑 Stopping $name on port $port (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            echo "✅ $name stopped"
        else
            echo "ℹ️  No process found on port $port for $name"
        fi
    }

    # Stop services by PID files first
    echo "🔍 Stopping services by PID files..."
    stop_service_by_pid "backend"
    stop_service_by_pid "frontend"
    stop_service_by_pid "mobile"

    echo ""
    echo "🔍 Stopping any remaining services by port..."

    # Stop services by port as backup
    stop_service_by_port 3000 "Backend API"
    stop_service_by_port 5173 "Frontend Web"
    stop_service_by_port 5180 "Mobile Web"

    # Kill any remaining npm/node processes related to our apps
    echo ""
    echo "🧹 Cleaning up any remaining processes..."

    # Kill any remaining vite dev servers
    pkill -f "vite.*--host" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "nodemon.*src/index.ts" 2>/dev/null || true

    # Clean up log files
    if [ -d "logs" ]; then
        echo "🗑️  Cleaning up log files..."
        rm -f logs/*.pid
    fi

    echo ""
    echo "✅ All CRM services stopped successfully!"
    exit 0
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Main header
print_header "🚀 CRM Application Network Launcher"
print_header "===================================="
echo ""

# Function to get the local IP address
get_local_ip() {
    local ip=""
    
    # Method 1: Using hostname -I (Linux)
    if command -v hostname >/dev/null 2>&1; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    # Method 2: Using ifconfig (macOS/Linux)
    if [ -z "$ip" ] && command -v ifconfig >/dev/null 2>&1; then
        ip=$(ifconfig | grep -E "inet.*broadcast" | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    fi
    
    # Method 3: Using ip command (Linux)
    if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
        ip=$(ip route get 1.1.1.1 | grep -oP 'src \K\S+' 2>/dev/null)
    fi
    
    # Method 4: Using route command (macOS)
    if [ -z "$ip" ] && command -v route >/dev/null 2>&1; then
        ip=$(route get default | grep interface | awk '{print $2}' | xargs ifconfig | grep -E "inet.*broadcast" | awk '{print $2}' | head -1)
    fi
    
    echo "$ip"
}

# Function to forcefully free a port by killing existing processes
force_free_port() {
    local port=$1
    local service_name=$2

    # Get all PIDs using the port (can be multiple)
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        print_warning "Port $port is occupied by PID(s) $pids. Freeing port for $service_name..."

        # Kill all processes using the port
        for pid in $pids; do
            if [ -n "$pid" ]; then
                print_info "  Killing process $pid..."
                # First try graceful kill
                kill "$pid" 2>/dev/null || true
            fi
        done

        # Wait a moment for graceful shutdown
        sleep 2

        # Check if any processes are still running and force kill if necessary
        local remaining_pids=$(lsof -ti:$port 2>/dev/null)
        if [ -n "$remaining_pids" ]; then
            print_info "Force killing remaining processes on port $port..."
            for pid in $remaining_pids; do
                if [ -n "$pid" ]; then
                    print_info "  Force killing process $pid..."
                    kill -9 "$pid" 2>/dev/null || true
                fi
            done
            sleep 1
        fi

        # Final verification
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_error "Failed to free port $port"
            return 1
        else
            print_status "Port $port is now available for $service_name"
            return 0
        fi
    else
        print_status "Port $port is available for $service_name"
        return 0
    fi
}

# Function to check and ensure all required ports are available
ensure_ports_available() {
    print_header "🔧 Ensuring Required Ports Are Available"

    # Define required ports - THESE NEVER CHANGE
    local backend_port=3000
    local frontend_port=5173
    local mobile_port=5180

    print_info "Required ports: Backend($backend_port), Frontend($frontend_port), Mobile($mobile_port)"

    # Force free each required port
    force_free_port $backend_port "Backend API" || return 1
    force_free_port $frontend_port "Frontend Web" || return 1
    force_free_port $mobile_port "Mobile Web" || return 1

    # Additional cleanup for stubborn npm/node processes
    print_info "Performing additional cleanup for npm/node processes..."
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "vite.*--host" 2>/dev/null || true
    pkill -f "nodemon.*src/index.ts" 2>/dev/null || true
    sleep 1

    # Final verification that all ports are truly free
    local final_check_failed=false
    for port in $backend_port $frontend_port $mobile_port; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_error "Port $port is still occupied after cleanup"
            final_check_failed=true
        fi
    done

    if [ "$final_check_failed" = true ]; then
        print_error "Some ports are still occupied. Please manually stop conflicting services."
        return 1
    fi

    print_status "All required ports are now available"
    return 0
}

# Function to check if directory exists
check_directory() {
    local dir=$1
    local name=$2
    if [ -d "$dir" ]; then
        print_status "$name directory found"
        return 0
    else
        print_error "$name directory not found at $dir"
        return 1
    fi
}

# Function to check if npm is installed and dependencies are ready
check_dependencies() {
    local dir=$1
    local name=$2
    
    if [ ! -f "$dir/package.json" ]; then
        print_error "$name package.json not found"
        return 1
    fi
    
    if [ ! -d "$dir/node_modules" ]; then
        print_warning "$name dependencies not installed. Installing..."
        cd "$dir" && npm install
        cd - > /dev/null
    fi
    
    print_status "$name dependencies ready"
    return 0
}

# Get current network IP
print_header "📡 Network Detection"
NETWORK_IP=$(get_local_ip)

if [ -z "$NETWORK_IP" ]; then
    print_warning "Could not automatically detect network IP address"
    echo "Please enter your network IP address manually:"
    read -p "Network IP: " NETWORK_IP
fi

print_status "Network IP: $NETWORK_IP"
echo ""

# Validate directories
print_header "🔍 Checking Project Structure"
check_directory "CRM-BACKEND" "Backend" || exit 1
check_directory "CRM-FRONTEND" "Frontend" || exit 1
check_directory "CRM-MOBILE" "Mobile" || exit 1
echo ""

# Check dependencies
print_header "📦 Checking Dependencies"
check_dependencies "CRM-BACKEND" "Backend" || exit 1
check_dependencies "CRM-FRONTEND" "Frontend" || exit 1
check_dependencies "CRM-MOBILE" "Mobile" || exit 1
echo ""

# Check database connectivity for backend
print_header "🗄️  Checking Database Connectivity"
print_info "Checking if PostgreSQL is accessible..."

# Extract database URL from backend .env
if [ -f "CRM-BACKEND/.env" ]; then
    DB_URL=$(grep "DATABASE_URL" CRM-BACKEND/.env | cut -d'=' -f2- | tr -d '"')
    if [ -n "$DB_URL" ]; then
        print_info "Database URL configured: ${DB_URL}"

        # Try to connect to PostgreSQL (basic check)
        if command -v psql >/dev/null 2>&1; then
            if echo "SELECT 1;" | psql "$DB_URL" >/dev/null 2>&1; then
                print_status "Database connection successful"
            else
                print_warning "Database connection failed - backend may not start properly"
                print_info "Make sure PostgreSQL is running and accessible"
                print_info "You can continue, but backend startup may fail"
            fi
        else
            print_info "psql not found - skipping database connectivity test"
            print_info "Ensure PostgreSQL is running for backend to work"
        fi
    else
        print_warning "No DATABASE_URL found in backend .env file"
    fi
else
    print_warning "Backend .env file not found"
fi
echo ""

# Ensure all required ports are available (force free if needed)
ensure_ports_available || {
    print_error "Failed to free required ports. Cannot proceed."
    exit 1
}
echo ""

# Function to create smart backup (only one per day per file)
create_smart_backup() {
    local file=$1
    local backup_date=$(date +%Y%m%d)
    local backup_file="${file}.backup.${backup_date}"

    # Only create backup if one doesn't exist for today
    if [ ! -f "$backup_file" ]; then
        cp "$file" "$backup_file"
        return 0
    else
        return 1
    fi
}



# Function to update all environment and config files
update_all_env_files() {
    print_info "Updating all environment and configuration files..."

    # Find all .env files in all projects
    local env_files=$(find . -name ".env" -not -path "./node_modules/*" -not -path "*/.git/*" 2>/dev/null)
    local config_files=$(find . -name "*.config.*" -not -path "./node_modules/*" -not -path "*/.git/*" 2>/dev/null)

    # Update .env files
    for env_file in $env_files; do
        if [ -f "$env_file" ]; then
            print_info "  Processing: $env_file"
            # Create smart backup
            if create_smart_backup "$env_file"; then
                print_info "    Backup created: ${env_file}.backup.$(date +%Y%m%d)"
            fi

            # Update any hardcoded IPs in environment variables (more comprehensive patterns)
            sed -i.tmp -E "s|=http://192\.168\.[0-9]+\.[0-9]+:([0-9]+)|=http://$NETWORK_IP:\1|g" "$env_file"
            sed -i.tmp -E "s|=http://172\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+)|=http://$NETWORK_IP:\1|g" "$env_file"
            sed -i.tmp -E "s|=http://10\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+)|=http://$NETWORK_IP:\1|g" "$env_file"
            sed -i.tmp -E "s|=ws://192\.168\.[0-9]+\.[0-9]+:([0-9]+)|=ws://$NETWORK_IP:\1|g" "$env_file"
            sed -i.tmp -E "s|=ws://172\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+)|=ws://$NETWORK_IP:\1|g" "$env_file"
            sed -i.tmp -E "s|=ws://10\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+)|=ws://$NETWORK_IP:\1|g" "$env_file"

            # Also update URLs with /api suffix
            sed -i.tmp -E "s|=http://192\.168\.[0-9]+\.[0-9]+:([0-9]+)/api|=http://$NETWORK_IP:\1/api|g" "$env_file"
            sed -i.tmp -E "s|=http://172\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+)/api|=http://$NETWORK_IP:\1/api|g" "$env_file"
            sed -i.tmp -E "s|=http://10\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+)/api|=http://$NETWORK_IP:\1/api|g" "$env_file"

            rm -f "$env_file.tmp"
        fi
    done

    # Update config files
    for config_file in $config_files; do
        if [ -f "$config_file" ]; then
            if grep -q -E "(192\.168\.[0-9]+\.[0-9]+|172\.[0-9]+\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+)" "$config_file"; then
                print_info "  Processing: $config_file"
                # Create smart backup
                if create_smart_backup "$config_file"; then
                    print_info "    Backup created: ${config_file}.backup.$(date +%Y%m%d)"
                fi

                # Update hardcoded IPs in config files
                sed -i.tmp -E "s|http://192\.168\.[0-9]+\.[0-9]+:([0-9]+)|http://$NETWORK_IP:\1|g" "$config_file"
                sed -i.tmp -E "s|http://172\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+)|http://$NETWORK_IP:\1|g" "$config_file"
                sed -i.tmp -E "s|http://10\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+)|http://$NETWORK_IP:\1|g" "$config_file"

                rm -f "$config_file.tmp"
            fi
        fi
    done
}

# Configure network access
print_header "🔧 Configuring Network Access"

# Clean up old backup files first
cleanup_old_backups

# Update all environment files first
update_all_env_files

# Update Backend .env file with specific CORS settings
BACKEND_ENV="CRM-BACKEND/.env"
if [ -f "$BACKEND_ENV" ]; then
    # Create smart backup
    if create_smart_backup "$BACKEND_ENV"; then
        print_info "Backend .env backup created: ${BACKEND_ENV}.backup.$(date +%Y%m%d)"
    fi

    # Update CORS_ORIGIN to include both localhost and network IP
    sed -i.tmp "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://localhost:5173,http://localhost:5180,http://127.0.0.1:5173,http://127.0.0.1:5180,http://$NETWORK_IP:5173,http://$NETWORK_IP:5180|g" "$BACKEND_ENV"

    # Update WebSocket CORS_ORIGIN to include both localhost and network IP
    sed -i.tmp "s|WS_CORS_ORIGIN=.*|WS_CORS_ORIGIN=http://localhost:5173,http://localhost:5180,http://127.0.0.1:5173,http://127.0.0.1:5180,http://$NETWORK_IP:5173,http://$NETWORK_IP:5180|g" "$BACKEND_ENV"

    rm -f "$BACKEND_ENV.tmp"
    print_status "Backend CORS and WebSocket CORS updated to support both localhost and $NETWORK_IP"
else
    print_error "Backend .env file not found at $BACKEND_ENV"
    exit 1
fi

# Update Frontend .env file
FRONTEND_ENV="CRM-FRONTEND/.env"
if [ -f "$FRONTEND_ENV" ]; then
    # Create smart backup
    if create_smart_backup "$FRONTEND_ENV"; then
        print_info "Frontend .env backup created: ${FRONTEND_ENV}.backup.$(date +%Y%m%d)"
    fi

    # Update API URLs
    sed -i.tmp "s|VITE_API_BASE_URL_NETWORK=.*|VITE_API_BASE_URL_NETWORK=http://$NETWORK_IP:3000/api|g" "$FRONTEND_ENV"
    sed -i.tmp "s|VITE_WS_URL_NETWORK=.*|VITE_WS_URL_NETWORK=ws://$NETWORK_IP:3000|g" "$FRONTEND_ENV"
    sed -i.tmp "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=http://$NETWORK_IP:3000/api|g" "$FRONTEND_ENV"
    sed -i.tmp "s|VITE_WS_URL=.*|VITE_WS_URL=ws://$NETWORK_IP:3000|g" "$FRONTEND_ENV"
    rm -f "$FRONTEND_ENV.tmp"
    print_status "Frontend API URLs updated to use $NETWORK_IP"
else
    print_error "Frontend .env file not found at $FRONTEND_ENV"
    exit 1
fi

# Update Mobile .env file
MOBILE_ENV="CRM-MOBILE/.env"
if [ -f "$MOBILE_ENV" ]; then
    # Create smart backup
    if create_smart_backup "$MOBILE_ENV"; then
        print_info "Mobile .env backup created: ${MOBILE_ENV}.backup.$(date +%Y%m%d)"
    fi

    # Update API URLs
    sed -i.tmp "s|VITE_API_BASE_URL_DEVICE=.*|VITE_API_BASE_URL_DEVICE=http://$NETWORK_IP:3000/api|g" "$MOBILE_ENV"
    rm -f "$MOBILE_ENV.tmp"
    print_status "Mobile app API URL updated to use $NETWORK_IP"
else
    print_error "Mobile .env file not found at $MOBILE_ENV"
    exit 1
fi

# Function to update hardcoded IPs in all source files
update_hardcoded_ips() {
    local project_dir=$1
    local project_name=$2

    print_info "Scanning $project_name for hardcoded IP addresses..."

    # Find all relevant source files (excluding node_modules, .git, dist, build)
    local files=$(find "$project_dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.vue" \) \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -not -path "*/build/*" \
        -not -path "*/.next/*" \
        -not -path "*/.vite/*" 2>/dev/null)

    local updated_count=0

    for file in $files; do
        if [ -f "$file" ]; then
            # Check if file contains any hardcoded IP patterns
            if grep -q -E "(192\.168\.[0-9]+\.[0-9]+|172\.[0-9]+\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+)" "$file"; then
                # Create smart backup
                if create_smart_backup "$file"; then
                    print_info "    Backup created: ${file}.backup.$(date +%Y%m%d)"
                fi

                # Update all common private IP ranges to current network IP
                sed -i.tmp -E "s|http://192\.168\.[0-9]+\.[0-9]+:3000|http://$NETWORK_IP:3000|g" "$file"
                sed -i.tmp -E "s|http://172\.[0-9]+\.[0-9]+\.[0-9]+:3000|http://$NETWORK_IP:3000|g" "$file"
                sed -i.tmp -E "s|http://10\.[0-9]+\.[0-9]+\.[0-9]+:3000|http://$NETWORK_IP:3000|g" "$file"
                sed -i.tmp -E "s|ws://192\.168\.[0-9]+\.[0-9]+:3000|ws://$NETWORK_IP:3000|g" "$file"
                sed -i.tmp -E "s|ws://172\.[0-9]+\.[0-9]+\.[0-9]+:3000|ws://$NETWORK_IP:3000|g" "$file"
                sed -i.tmp -E "s|ws://10\.[0-9]+\.[0-9]+\.[0-9]+:3000|ws://$NETWORK_IP:3000|g" "$file"

                # Also update API URLs with /api suffix
                sed -i.tmp -E "s|http://192\.168\.[0-9]+\.[0-9]+:3000/api|http://$NETWORK_IP:3000/api|g" "$file"
                sed -i.tmp -E "s|http://172\.[0-9]+\.[0-9]+\.[0-9]+:3000/api|http://$NETWORK_IP:3000/api|g" "$file"
                sed -i.tmp -E "s|http://10\.[0-9]+\.[0-9]+\.[0-9]+:3000/api|http://$NETWORK_IP:3000/api|g" "$file"

                # Update fallback URLs in quotes (for authentication and API services)
                sed -i.tmp -E "s|'http://192\.168\.[0-9]+\.[0-9]+:3000/api'|'http://$NETWORK_IP:3000/api'|g" "$file"
                sed -i.tmp -E "s|'http://172\.[0-9]+\.[0-9]+\.[0-9]+:3000/api'|'http://$NETWORK_IP:3000/api'|g" "$file"
                sed -i.tmp -E "s|'http://10\.[0-9]+\.[0-9]+\.[0-9]+:3000/api'|'http://$NETWORK_IP:3000/api'|g" "$file"

                # Update fallback URLs in double quotes
                sed -i.tmp -E "s|\"http://192\.168\.[0-9]+\.[0-9]+:3000/api\"|\"http://$NETWORK_IP:3000/api\"|g" "$file"
                sed -i.tmp -E "s|\"http://172\.[0-9]+\.[0-9]+\.[0-9]+:3000/api\"|\"http://$NETWORK_IP:3000/api\"|g" "$file"
                sed -i.tmp -E "s|\"http://10\.[0-9]+\.[0-9]+\.[0-9]+:3000/api\"|\"http://$NETWORK_IP:3000/api\"|g" "$file"

                rm -f "$file.tmp"
                updated_count=$((updated_count + 1))
                print_info "  Updated: $(basename "$file")"
            fi
        fi
    done

    if [ $updated_count -gt 0 ]; then
        print_status "$project_name: Updated $updated_count files with hardcoded IPs"
    else
        print_info "$project_name: No hardcoded IPs found to update"
    fi
}

# Function to update critical authentication and API service files
update_critical_files() {
    print_info "Updating critical authentication and API service files..."

    # Critical files that often contain hardcoded fallback URLs
    local critical_files=(
        "CRM-MOBILE/context/AuthContext.tsx"
        "CRM-MOBILE/services/apiService.ts"
        "CRM-MOBILE/services/networkService.ts"
        "CRM-MOBILE/services/tokenRefreshService.ts"
        "CRM-FRONTEND/src/services/api.ts"
        "CRM-FRONTEND/src/services/auth.ts"
    )

    local updated_count=0

    for file in "${critical_files[@]}"; do
        if [ -f "$file" ]; then
            # Check if file contains any hardcoded IP patterns
            if grep -q -E "(192\.168\.[0-9]+\.[0-9]+|172\.[0-9]+\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+)" "$file"; then
                print_info "  Processing critical file: $file"

                # Create smart backup
                if create_smart_backup "$file"; then
                    print_info "    Backup created: ${file}.backup.$(date +%Y%m%d)"
                fi

                # Update all IP patterns in critical files
                sed -i.tmp -E "s|http://192\.168\.[0-9]+\.[0-9]+:3000/api|http://$NETWORK_IP:3000/api|g" "$file"
                sed -i.tmp -E "s|http://172\.[0-9]+\.[0-9]+\.[0-9]+:3000/api|http://$NETWORK_IP:3000/api|g" "$file"
                sed -i.tmp -E "s|http://10\.[0-9]+\.[0-9]+\.[0-9]+:3000/api|http://$NETWORK_IP:3000/api|g" "$file"

                # Update quoted fallback URLs
                sed -i.tmp -E "s|'http://192\.168\.[0-9]+\.[0-9]+:3000/api'|'http://$NETWORK_IP:3000/api'|g" "$file"
                sed -i.tmp -E "s|'http://172\.[0-9]+\.[0-9]+\.[0-9]+:3000/api'|'http://$NETWORK_IP:3000/api'|g" "$file"
                sed -i.tmp -E "s|'http://10\.[0-9]+\.[0-9]+\.[0-9]+:3000/api'|'http://$NETWORK_IP:3000/api'|g" "$file"

                sed -i.tmp -E "s|\"http://192\.168\.[0-9]+\.[0-9]+:3000/api\"|\"http://$NETWORK_IP:3000/api\"|g" "$file"
                sed -i.tmp -E "s|\"http://172\.[0-9]+\.[0-9]+\.[0-9]+:3000/api\"|\"http://$NETWORK_IP:3000/api\"|g" "$file"
                sed -i.tmp -E "s|\"http://10\.[0-9]+\.[0-9]+\.[0-9]+:3000/api\"|\"http://$NETWORK_IP:3000/api\"|g" "$file"

                rm -f "$file.tmp"
                updated_count=$((updated_count + 1))
                print_info "    ✓ Updated: $(basename "$file")"
            fi
        else
            print_warning "  Critical file not found: $file"
        fi
    done

    if [ $updated_count -gt 0 ]; then
        print_status "Updated $updated_count critical authentication/API files"
    else
        print_info "No critical files needed IP updates"
    fi
}

# Update hardcoded IPs in all projects
print_header "🔄 Updating Hardcoded IP Addresses"
update_critical_files
update_hardcoded_ips "CRM-BACKEND" "Backend"
update_hardcoded_ips "CRM-FRONTEND" "Frontend"
update_hardcoded_ips "CRM-MOBILE" "Mobile"

echo ""

# Function to validate all IP updates were successful
validate_ip_updates() {
    print_info "Validating IP address updates..."

    local validation_failed=false

    # Check .env files for old IPs
    local env_files=$(find . -name ".env" -not -path "./node_modules/*" -not -path "*/.git/*" 2>/dev/null)
    for env_file in $env_files; do
        if [ -f "$env_file" ]; then
            # Check for any remaining old IP patterns (excluding localhost)
            local old_ips=$(grep -E "(192\.168\.[0-9]+\.[0-9]+|172\.[0-9]+\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+)" "$env_file" | grep -v "$NETWORK_IP" | grep -v "localhost" | grep -v "127.0.0.1" || true)
            if [ -n "$old_ips" ]; then
                print_warning "  Found old IPs in $env_file:"
                echo "$old_ips" | sed 's/^/    /'
                validation_failed=true
            else
                print_info "  ✓ $env_file - All IPs updated correctly"
            fi
        fi
    done

    # Check critical source files
    local critical_files=(
        "CRM-MOBILE/context/AuthContext.tsx"
        "CRM-MOBILE/services/apiService.ts"
        "CRM-MOBILE/services/networkService.ts"
        "CRM-MOBILE/services/tokenRefreshService.ts"
        "CRM-FRONTEND/src/services/api.ts"
        "CRM-FRONTEND/src/services/auth.ts"
    )

    for file in "${critical_files[@]}"; do
        if [ -f "$file" ]; then
            local old_ips=$(grep -E "(192\.168\.[0-9]+\.[0-9]+|172\.[0-9]+\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+)" "$file" | grep -v "$NETWORK_IP" | grep -v "localhost" | grep -v "127.0.0.1" || true)
            if [ -n "$old_ips" ]; then
                print_warning "  Found old IPs in $file:"
                echo "$old_ips" | sed 's/^/    /'
                validation_failed=true
            else
                print_info "  ✓ $(basename "$file") - All IPs updated correctly"
            fi
        fi
    done

    if [ "$validation_failed" = true ]; then
        print_error "⚠️  Some IP addresses were not updated correctly!"
        print_info "Please check the files listed above and update them manually if needed."
        return 1
    else
        print_status "✅ All IP address updates validated successfully!"
        return 0
    fi
}

# Verify network configuration
print_header "🔍 Verifying Network Configuration"
print_info "Testing network connectivity to $NETWORK_IP..."

# Test if the network IP is reachable
if ping -c 1 -W 1000 "$NETWORK_IP" >/dev/null 2>&1; then
    print_status "Network IP $NETWORK_IP is reachable"
else
    print_warning "Network IP $NETWORK_IP may not be reachable"
    print_info "This might affect network access from other devices"
fi

# Validate all IP updates
echo ""
validate_ip_updates

# Display configuration summary
print_info "Configuration Summary:"
echo "  • Backend will accept connections from: localhost and $NETWORK_IP"
echo "  • Frontend will connect to: http://$NETWORK_IP:3000/api"
echo "  • Mobile will connect to: http://$NETWORK_IP:3000/api (when accessed from network)"
echo "  • WebSocket connections allowed from: localhost and $NETWORK_IP"
echo ""

# Create logs directory
mkdir -p logs

# Function to start a service with port verification
start_service() {
    local name=$1
    local dir=$2
    local command=$3
    local expected_port=$4

    print_info "Starting $name on port $expected_port..."

    # Verify port is free before starting
    if lsof -Pi :$expected_port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_error "Port $expected_port is still occupied. Cannot start $name."
        return 1
    fi

    cd "$dir" || {
        print_error "Failed to change to $dir directory"
        return 1
    }

    # Start the service in background with proper output redirection
    nohup $command > "../logs/${name}.log" 2>&1 &
    local pid=$!

    # Store PID for cleanup
    echo $pid > "../logs/${name}.pid"

    # Give the process a moment to start
    sleep 1

    # Check if process is still running immediately after start
    if ! kill -0 "$pid" 2>/dev/null; then
        print_error "$name process died immediately after start"
        print_info "Check logs at: logs/${name}.log"
        rm -f "../logs/${name}.pid"
        cd - > /dev/null
        return 1
    fi

    # Wait longer for service to start and verify
    print_info "Waiting for $name to start..."
    local attempts=0
    local max_attempts=10

    while [ $attempts -lt $max_attempts ]; do
        sleep 3

        # Check if process is still running
        if ! kill -0 "$pid" 2>/dev/null; then
            print_error "$name process died during startup"
            print_info "Check logs at: logs/${name}.log"
            print_info "Last few lines of log:"
            tail -5 "../logs/${name}.log" 2>/dev/null || echo "No log file found"
            rm -f "../logs/${name}.pid"
            cd - > /dev/null
            return 1
        fi

        # Check if port is being used (don't worry about PID matching for nodemon/child processes)
        local actual_pid=$(lsof -ti:$expected_port 2>/dev/null)
        if [ -n "$actual_pid" ]; then
            # Port is bound - this is good! Our process (or its child) is using it
            # For backend, also test HTTP connectivity
            if [ "$name" = "backend" ]; then
                if curl -s "http://localhost:$expected_port/health" >/dev/null 2>&1; then
                    print_status "$name started successfully (Parent PID: $pid, Port PID: $actual_pid) - HTTP OK"
                else
                    print_status "$name started successfully (Parent PID: $pid, Port PID: $actual_pid) - Port bound"
                fi
            else
                print_status "$name started successfully (Parent PID: $pid, Port PID: $actual_pid)"
            fi
            cd - > /dev/null
            return 0
        fi

        # Check if process is still running
        if ! kill -0 "$pid" 2>/dev/null; then
            print_error "$name process died during startup"
            print_info "Check logs at: logs/${name}.log"
            print_info "Last few lines of log:"
            tail -5 "../logs/${name}.log" 2>/dev/null || echo "No log file found"
            rm -f "../logs/${name}.pid"
            cd - > /dev/null
            return 1
        fi

        attempts=$((attempts + 1))
        print_info "Attempt $attempts/$max_attempts - waiting for $name to bind to port $expected_port..."
    done

    print_error "$name failed to start on port $expected_port after $max_attempts attempts"
    print_info "Process is running but not listening on expected port"
    print_info "Check logs at: logs/${name}.log"
    print_info "Last few lines of log:"
    tail -10 "../logs/${name}.log" 2>/dev/null || echo "No log file found"

    # Clean up failed start
    kill "$pid" 2>/dev/null || true
    rm -f "../logs/${name}.pid"
    cd - > /dev/null
    return 1

    cd - > /dev/null
    return 0
}

# Start services on exact ports (NO PORT CHANGES ALLOWED)
print_header "🚀 Starting Services on Fixed Ports"

# Define exact ports - THESE NEVER CHANGE
BACKEND_PORT=3000
FRONTEND_PORT=5173
MOBILE_PORT=5180

print_info "Starting services on fixed ports: Backend($BACKEND_PORT), Frontend($FRONTEND_PORT), Mobile($MOBILE_PORT)"

# Start Backend on exact port 3000
if ! start_service "backend" "CRM-BACKEND" "npm run dev" "$BACKEND_PORT"; then
    print_error "Failed to start Backend on port $BACKEND_PORT"
    exit 1
fi

# Start Frontend on exact port 5173
if ! start_service "frontend" "CRM-FRONTEND" "npm run dev" "$FRONTEND_PORT"; then
    print_error "Failed to start Frontend on port $FRONTEND_PORT"
    # Stop backend if frontend fails
    ./crm-network-launcher.sh --stop > /dev/null 2>&1
    exit 1
fi

# Start Mobile App on exact port 5180
if ! start_service "mobile" "CRM-MOBILE" "npm run dev" "$MOBILE_PORT"; then
    print_error "Failed to start Mobile on port $MOBILE_PORT"
    # Stop other services if mobile fails
    ./crm-network-launcher.sh --stop > /dev/null 2>&1
    exit 1
fi

# Final verification that all services are running on correct ports
print_info "Performing final port verification..."
sleep 2

# Verify all services are running on expected ports
backend_running=$(lsof -ti:$BACKEND_PORT 2>/dev/null)
frontend_running=$(lsof -ti:$FRONTEND_PORT 2>/dev/null)
mobile_running=$(lsof -ti:$MOBILE_PORT 2>/dev/null)

if [ -z "$backend_running" ]; then
    print_error "Backend is not running on port $BACKEND_PORT"
    exit 1
fi

if [ -z "$frontend_running" ]; then
    print_error "Frontend is not running on port $FRONTEND_PORT"
    exit 1
fi

if [ -z "$mobile_running" ]; then
    print_error "Mobile is not running on port $MOBILE_PORT"
    exit 1
fi

print_status "All services verified running on correct ports!"
print_status "Backend: Port $BACKEND_PORT (PID: $backend_running)"
print_status "Frontend: Port $FRONTEND_PORT (PID: $frontend_running)"
print_status "Mobile: Port $MOBILE_PORT (PID: $mobile_running)"

# Clean up all backup files now that services are running successfully
cleanup_all_session_backups

# Test network connectivity to backend
print_info "Testing backend network connectivity..."
if curl -s --max-time 5 "http://$NETWORK_IP:$BACKEND_PORT/health" >/dev/null 2>&1; then
    print_status "Backend is accessible via network IP: http://$NETWORK_IP:$BACKEND_PORT"
elif curl -s --max-time 5 "http://$NETWORK_IP:$BACKEND_PORT/" >/dev/null 2>&1; then
    print_status "Backend is responding via network IP: http://$NETWORK_IP:$BACKEND_PORT"
else
    print_warning "Backend may not be accessible via network IP"
    print_info "This could be due to firewall settings or network configuration"
    print_info "Try accessing http://$NETWORK_IP:$BACKEND_PORT from another device to verify"
fi

echo ""
print_header "🎉 CRM Application Started Successfully!"
print_header "======================================"
echo ""

# Display service status with exact ports
print_header "📋 Service Status:"
echo "• Backend API:     Running on port $BACKEND_PORT (FIXED)"
echo "• Frontend Web:    Running on port $FRONTEND_PORT (FIXED)"
echo "• Mobile Web:      Running on port $MOBILE_PORT (FIXED)"
echo ""

print_header "🌐 Access URLs (Fixed Ports):"
echo ""
print_info "📍 Localhost Access:"
echo "• Frontend:        http://localhost:$FRONTEND_PORT"
echo "• Mobile:          http://localhost:$MOBILE_PORT"
echo "• Backend API:     http://localhost:$BACKEND_PORT"
echo ""

print_info "📍 Network Access:"
echo "• Frontend:        http://$NETWORK_IP:$FRONTEND_PORT"
echo "• Mobile:          http://$NETWORK_IP:$MOBILE_PORT"
echo "• Backend API:     http://$NETWORK_IP:$BACKEND_PORT"
echo ""

print_info "📱 For mobile devices on the same network:"
echo "• Open browser and go to: http://$NETWORK_IP:$MOBILE_PORT"
echo "• The mobile app will automatically connect to: http://$NETWORK_IP:$BACKEND_PORT/api"
echo ""

print_header "📊 Monitoring & Control:"
echo "• View Backend logs:   tail -f logs/backend.log"
echo "• View Frontend logs:  tail -f logs/frontend.log"
echo "• View Mobile logs:    tail -f logs/mobile.log"
echo ""
echo "• Stop all services:   ./crm-network-launcher.sh --stop"
echo "• Or kill processes:   pkill -f 'npm run dev'"
echo ""

print_header "💡 Important Notes:"
echo "• FIXED PORTS: Backend(3000), Frontend(5173), Mobile(5180) - NEVER CHANGE"
echo "• Port conflicts are automatically resolved by stopping existing services"
echo "• Make sure your firewall allows connections on ports 3000, 5173, and 5180"
echo "• All devices must be on the same network to access via IP address"
echo "• Temporary configuration backups created and cleaned up automatically"
echo "• All hardcoded IP addresses updated to current network IP: $NETWORK_IP"
echo "• Use Ctrl+C to stop this script (services will continue running)"
echo ""

print_header "🔧 Configuration Changes Applied:"
echo "• Environment files (.env) updated with network IP: $NETWORK_IP"
echo "• Source code files scanned and hardcoded IPs updated"
echo "• CORS origins configured for both localhost and network access"
echo "• WebSocket origins configured for both localhost and network access"
echo "• All temporary backup files automatically cleaned up after successful startup"
echo ""

print_header "🔧 Troubleshooting:"
echo "• If services fail to start, check the log files in ./logs/"
echo "• If ports are in use, stop conflicting services first"
echo "• If network access fails, check firewall settings"
echo "• For mobile testing, ensure WiFi network allows device communication"
echo ""

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    print_info "Script terminated. Services are still running in background."
    print_info "Use './crm-network-launcher.sh --stop' to stop all services."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

print_header "🎯 Services are now running!"
print_info "Press Ctrl+C to exit this script (services will continue running)"
print_info "Or wait here to monitor startup messages..."

# Keep script running to show any immediate startup issues
sleep 10

print_status "All services appear to be running successfully!"
print_info "You can now access the applications using the URLs above."
echo ""
print_info "This script will now exit. Services will continue running in background."
print_info "Use './crm-network-launcher.sh --stop' when you want to stop all services."
