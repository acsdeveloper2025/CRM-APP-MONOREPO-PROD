#!/bin/bash

# CRM Production Health Check Script
# Validates that all services are running correctly after deployment

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
LOG_DIR="/var/log/crm-app"
LOG_FILE="$LOG_DIR/health-check.log"
BACKEND_ENV_FILE="$PROJECT_ROOT/CRM-BACKEND/.env"

# Ensure log directory exists
mkdir -p "$LOG_DIR"
TIMEOUT=30
MAX_RETRIES=5
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-}"
DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
FRONTEND_LOCAL_URL="${FRONTEND_LOCAL_URL:-http://localhost:5173}"

load_existing_backend_env() {
    if [ ! -f "$BACKEND_ENV_FILE" ]; then
        return 0
    fi

    set -a
    # shellcheck disable=SC1090
    . "$BACKEND_ENV_FILE"
    set +a

    if [ -n "${DATABASE_URL:-}" ]; then
        eval "$(
            python3 - <<'PY'
import os
import shlex
from urllib.parse import urlparse, unquote

database_url = os.environ.get("DATABASE_URL", "")
if database_url:
    parsed = urlparse(database_url)
    values = {
        "PARSED_DB_HOST": parsed.hostname or "",
        "PARSED_DB_PORT": str(parsed.port or ""),
        "PARSED_DB_NAME": parsed.path.lstrip("/") or "",
        "PARSED_DB_USER": unquote(parsed.username or ""),
        "PARSED_DB_PASSWORD": unquote(parsed.password or ""),
    }
    for key, value in values.items():
        print(f"{key}={shlex.quote(value)}")
PY
        )"
    fi

    DB_HOST="${DB_HOST:-${PARSED_DB_HOST:-localhost}}"
    DB_PORT="${DB_PORT:-${PARSED_DB_PORT:-5432}}"
    DB_NAME="${DB_NAME:-${PARSED_DB_NAME:-acs_db}}"
    DB_USER="${DB_USER:-${PARSED_DB_USER:-}}"
    DB_PASSWORD="${DB_PASSWORD:-${PARSED_DB_PASSWORD:-}}"

    if [ -z "$PUBLIC_BASE_URL" ] && [ -n "${CORS_ORIGIN:-}" ]; then
        PUBLIC_BASE_URL=$(printf '%s' "$CORS_ORIGIN" | cut -d',' -f1)
    fi

    PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://example.com}"
}

load_existing_backend_env

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

# Check if a service is running (PM2-based)
check_service_process() {
    local service_name=$1
    local pm2_name="crm-${service_name}"

    # Check if PM2 is available
    if command -v pm2 >/dev/null 2>&1; then
        # Check if process exists in PM2
        local pm2_status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$pm2_name\") | .pm2_env.status" 2>/dev/null)

        if [ "$pm2_status" = "online" ]; then
            local pid=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$pm2_name\") | .pid" 2>/dev/null)
            print_status "$service_name process is running via PM2 (PID: $pid)"
            return 0
        elif [ -n "$pm2_status" ]; then
            print_error "$service_name process is in PM2 but status is: $pm2_status"
            return 1
        else
            print_error "$service_name process not found in PM2"
            return 1
        fi
    else
        # Fallback to PID file check if PM2 is not available
        local pid_file="$PROJECT_ROOT/logs/${service_name}.pid"

        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                print_status "$service_name process is running (PID: $pid)"
                return 0
            else
                print_error "$service_name process is not running (stale PID file)"
                return 1
            fi
        else
            print_error "$service_name PID file not found"
            return 1
        fi
    fi
}

# Check HTTP endpoint with retries
check_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local description=$3
    local retry_count=0
    
    print_info "Checking $description: $url"
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
        
        if [ "$response" = "$expected_status" ]; then
            print_status "$description is responding correctly (HTTP $response)"
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $MAX_RETRIES ]; then
                print_warning "$description check failed (HTTP $response), retrying in 5 seconds... ($retry_count/$MAX_RETRIES)"
                sleep 5
            else
                print_error "$description is not responding correctly (HTTP $response)"
                return 1
            fi
        fi
    done
}

# Check database connectivity
check_database() {
    print_info "Checking database connectivity..."
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        print_status "Database connection successful"
        
        # Check if we can query users table
        local user_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)
        if [ -n "$user_count" ] && [ "$user_count" -gt 0 ]; then
            print_status "Database contains $user_count users"
        else
            print_warning "Database connection works but user table seems empty"
        fi
        return 0
    else
        print_error "Database connection failed"
        return 1
    fi
}

# Check Redis connectivity
check_redis() {
    print_info "Checking Redis connectivity..."
    
    if redis-cli ping >/dev/null 2>&1; then
        print_status "Redis connection successful"
        
        # Get Redis info
        local redis_version=$(redis-cli info server | grep "redis_version" | cut -d: -f2 | tr -d '\r')
        print_info "Redis version: $redis_version"
        return 0
    else
        print_error "Redis connection failed"
        return 1
    fi
}

# Check system services
check_system_services() {
    print_header "🔍 Checking System Services"
    
    local services=("nginx" "postgresql" "redis-server")
    local all_services_ok=true
    
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            print_status "$service is running"
        else
            print_error "$service is not running"
            all_services_ok=false
        fi
    done
    
    if [ "$all_services_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

# Check application processes
check_application_processes() {
    print_header "🔍 Checking Application Processes"
    
    local services=("backend" "frontend")
    local all_processes_ok=true
    
    for service in "${services[@]}"; do
        if ! check_service_process "$service"; then
            all_processes_ok=false
        fi
    done
    
    if [ "$all_processes_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

# Check HTTP endpoints
check_http_endpoints() {
    print_header "🌐 Checking HTTP Endpoints"
    
    local endpoints_ok=true
    
    # Wait a bit for services to fully initialize
    print_info "Waiting 10 seconds for services to initialize..."
    sleep 10
    
    # Check main endpoints
    if ! check_endpoint "${PUBLIC_BASE_URL}/health" 200 "Health Check Endpoint"; then
        endpoints_ok=false
    fi
    # Check frontend endpoint on the local preview service. Public `/` currently
    # returns 403 from nginx, which is an edge-policy response rather than a
    # frontend process failure.
    if ! check_endpoint "$FRONTEND_LOCAL_URL" 200 "Frontend Application"; then
        print_error "Frontend health check failed"
        return 1
    fi
    if ! check_endpoint "${PUBLIC_BASE_URL}/api/health" 200 "Backend API Health"; then
        endpoints_ok=false
    fi
    
    # Check API authentication endpoint
    local auth_response=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"username":"invalid","password":"invalid"}' \
        "${PUBLIC_BASE_URL}/api/auth/login" 2>/dev/null || echo "000")
    
    if [ "$auth_response" = "401" ] || [ "$auth_response" = "400" ]; then
        print_status "API authentication endpoint is responding correctly (HTTP $auth_response)"
    else
        print_error "API authentication endpoint is not responding correctly (HTTP $auth_response)"
        endpoints_ok=false
    fi
    
    if [ "$endpoints_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

# Check SSL certificate
check_ssl_certificate() {
    print_header "🔒 Checking SSL Certificate"
    
    if command -v openssl >/dev/null 2>&1; then
        local server_host=$(printf '%s' "$PUBLIC_BASE_URL" | sed -E 's#^https?://##; s#/.*$##')
        local cert_info=$(echo | openssl s_client -servername "$server_host" -connect "${server_host}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        
        if [ -n "$cert_info" ]; then
            local not_after=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
            print_status "SSL certificate is valid until: $not_after"
            return 0
        else
            print_error "Could not retrieve SSL certificate information"
            return 1
        fi
    else
        print_warning "OpenSSL not available, skipping SSL certificate check"
        return 0
    fi
}

# Check disk space
check_disk_space() {
    print_header "💾 Checking Disk Space"
    
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -lt 80 ]; then
        print_status "Disk usage is acceptable: ${disk_usage}%"
        return 0
    elif [ "$disk_usage" -lt 90 ]; then
        print_warning "Disk usage is high: ${disk_usage}%"
        return 0
    else
        print_error "Disk usage is critical: ${disk_usage}%"
        return 1
    fi
}

# Check memory usage
check_memory_usage() {
    print_header "🧠 Checking Memory Usage"
    
    local memory_info=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    local memory_usage=${memory_info%.*}
    
    if [ "$memory_usage" -lt 80 ]; then
        print_status "Memory usage is acceptable: ${memory_usage}%"
        return 0
    elif [ "$memory_usage" -lt 90 ]; then
        print_warning "Memory usage is high: ${memory_usage}%"
        return 0
    else
        print_error "Memory usage is critical: ${memory_usage}%"
        return 1
    fi
}

# Generate health report
generate_health_report() {
    local overall_status=$1
    local report_file="/tmp/health-report.json"
    
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "overall_status": "$overall_status",
    "checks": {
        "system_services": "$(systemctl is-active nginx postgresql redis-server | tr '\n' ',' | sed 's/,$//')",
        "application_processes": "$([ -f "$PROJECT_ROOT/logs/backend.pid" ] && echo "backend:running" || echo "backend:stopped"),$([ -f "$PROJECT_ROOT/logs/frontend.pid" ] && echo "frontend:running" || echo "frontend:stopped")",
        "database": "$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1 && echo "connected" || echo "failed")",
        "redis": "$(redis-cli ping >/dev/null 2>&1 && echo "connected" || echo "failed")",
        "disk_usage": "$(df -h / | awk 'NR==2 {print $5}')",
        "memory_usage": "$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
    },
    "urls": {
        "frontend": "${FRONTEND_LOCAL_URL}/",
        "api": "${PUBLIC_BASE_URL}/api/health",
        "health": "${PUBLIC_BASE_URL}/health"
    }
}
EOF
    
    print_info "Health report generated: $report_file"
}

# Main health check function
main() {
    print_header "🏥 CRM Production Health Check"
    print_header "==============================="
    
    local overall_health=true
    
    # Run all health checks
    if ! check_system_services; then
        overall_health=false
    fi
    
    if ! check_database; then
        overall_health=false
    fi
    
    if ! check_redis; then
        overall_health=false
    fi
    
    if ! check_application_processes; then
        overall_health=false
    fi
    
    if ! check_http_endpoints; then
        overall_health=false
    fi
    
    if ! check_ssl_certificate; then
        overall_health=false
    fi
    
    if ! check_disk_space; then
        overall_health=false
    fi
    
    if ! check_memory_usage; then
        overall_health=false
    fi
    
    # Generate report
    if [ "$overall_health" = true ]; then
        generate_health_report "healthy"
        print_header "🎉 All Health Checks Passed!"
        print_status "CRM application is running correctly"
        exit 0
    else
        generate_health_report "unhealthy"
        print_header "⚠️ Some Health Checks Failed!"
        print_error "Please review the issues above"
        exit 1
    fi
}

# Execute main function
main "$@"
