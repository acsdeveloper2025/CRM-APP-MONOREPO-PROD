#!/bin/bash

# CRM Deployment Monitoring Script
# Continuously monitors the health and status of the CRM application

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
LOG_FILE="/home/admin1/logs/monitoring.log"
ALERT_LOG="/home/admin1/logs/alerts.log"
CHECK_INTERVAL=60  # seconds
ALERT_THRESHOLD=3  # consecutive failures before alert

# Counters for consecutive failures
BACKEND_FAILURES=0
FRONTEND_FAILURES=0
MOBILE_FAILURES=0
DATABASE_FAILURES=0
REDIS_FAILURES=0

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

print_alert() {
    echo -e "${RED}🚨 ALERT: $1${NC}" | tee -a "$LOG_FILE" | tee -a "$ALERT_LOG"
}

# Get current timestamp
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Check if a service process is running
check_service_process() {
    local service_name=$1
    local pid_file="$PROJECT_ROOT/logs/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Check HTTP endpoint
check_endpoint() {
    local url=$1
    local timeout=${2:-10}
    
    local response=$(curl -s -w "%{http_code}" -o /dev/null --max-time "$timeout" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Check database connectivity
check_database() {
    if PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db -c "SELECT 1;" >/dev/null 2>&1; then
        DATABASE_FAILURES=0
        return 0
    else
        DATABASE_FAILURES=$((DATABASE_FAILURES + 1))
        return 1
    fi
}

# Check Redis connectivity
check_redis() {
    if redis-cli ping >/dev/null 2>&1; then
        REDIS_FAILURES=0
        return 0
    else
        REDIS_FAILURES=$((REDIS_FAILURES + 1))
        return 1
    fi
}

# Monitor backend service
monitor_backend() {
    local status="✅ OK"
    local details=""
    
    # Check process
    if ! check_service_process "backend"; then
        status="❌ PROCESS DOWN"
        details="Backend process is not running"
        BACKEND_FAILURES=$((BACKEND_FAILURES + 1))
    # Check HTTP endpoint
    elif ! check_endpoint "https://example.com/api/health"; then
        status="❌ ENDPOINT DOWN"
        details="Backend API endpoint not responding"
        BACKEND_FAILURES=$((BACKEND_FAILURES + 1))
    else
        BACKEND_FAILURES=0
        # Get additional info
        local memory_usage=$(ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem -C node | grep "CRM-BACKEND" | awk '{print $4}' | head -1)
        details="Memory: ${memory_usage:-N/A}%"
    fi
    
    echo "$(get_timestamp) | Backend | $status | $details"
    
    # Alert if threshold reached
    if [ $BACKEND_FAILURES -ge $ALERT_THRESHOLD ]; then
        print_alert "Backend service has failed $BACKEND_FAILURES consecutive times"
    fi
}

# Monitor frontend service
monitor_frontend() {
    local status="✅ OK"
    local details=""
    
    # Check process
    if ! check_service_process "frontend"; then
        status="❌ PROCESS DOWN"
        details="Frontend process is not running"
        FRONTEND_FAILURES=$((FRONTEND_FAILURES + 1))
    # Check HTTP endpoint
    elif ! check_endpoint "https://example.com/"; then
        status="❌ ENDPOINT DOWN"
        details="Frontend endpoint not responding"
        FRONTEND_FAILURES=$((FRONTEND_FAILURES + 1))
    else
        FRONTEND_FAILURES=0
        local memory_usage=$(ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem -C node | grep "CRM-FRONTEND" | awk '{print $4}' | head -1)
        details="Memory: ${memory_usage:-N/A}%"
    fi
    
    echo "$(get_timestamp) | Frontend | $status | $details"
    
    if [ $FRONTEND_FAILURES -ge $ALERT_THRESHOLD ]; then
        print_alert "Frontend service has failed $FRONTEND_FAILURES consecutive times"
    fi
}

# Monitor mobile service
monitor_mobile() {
    local status="✅ OK"
    local details=""
    
    # Check process
    if ! check_service_process "mobile"; then
        status="❌ PROCESS DOWN"
        details="Mobile process is not running"
        MOBILE_FAILURES=$((MOBILE_FAILURES + 1))
    # Check HTTP endpoint
    elif ! check_endpoint "https://example.com/mobile/"; then
        status="❌ ENDPOINT DOWN"
        details="Mobile endpoint not responding"
        MOBILE_FAILURES=$((MOBILE_FAILURES + 1))
    else
        MOBILE_FAILURES=0
        local memory_usage=$(ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem -C node | grep "CRM-MOBILE" | awk '{print $4}' | head -1)
        details="Memory: ${memory_usage:-N/A}%"
    fi
    
    echo "$(get_timestamp) | Mobile | $status | $details"
    
    if [ $MOBILE_FAILURES -ge $ALERT_THRESHOLD ]; then
        print_alert "Mobile service has failed $MOBILE_FAILURES consecutive times"
    fi
}

# Monitor database
monitor_database() {
    local status="✅ OK"
    local details=""
    
    if ! check_database; then
        status="❌ CONNECTION FAILED"
        details="Cannot connect to PostgreSQL database"
    else
        # Get database info
        local db_size=$(PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db -t -c "SELECT pg_size_pretty(pg_database_size('acs_db'));" 2>/dev/null | xargs || echo "N/A")
        local active_connections=$(PGPASSWORD=example_db_password psql -h localhost -U example_db_user -d acs_db -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | xargs || echo "N/A")
        details="Size: $db_size, Active connections: $active_connections"
    fi
    
    echo "$(get_timestamp) | Database | $status | $details"
    
    if [ $DATABASE_FAILURES -ge $ALERT_THRESHOLD ]; then
        print_alert "Database has failed $DATABASE_FAILURES consecutive times"
    fi
}

# Monitor Redis
monitor_redis() {
    local status="✅ OK"
    local details=""
    
    if ! check_redis; then
        status="❌ CONNECTION FAILED"
        details="Cannot connect to Redis server"
    else
        # Get Redis info
        local memory_usage=$(redis-cli info memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "N/A")
        local connected_clients=$(redis-cli info clients | grep "connected_clients" | cut -d: -f2 | tr -d '\r' || echo "N/A")
        details="Memory: $memory_usage, Clients: $connected_clients"
    fi
    
    echo "$(get_timestamp) | Redis | $status | $details"
    
    if [ $REDIS_FAILURES -ge $ALERT_THRESHOLD ]; then
        print_alert "Redis has failed $REDIS_FAILURES consecutive times"
    fi
}

# Monitor system resources
monitor_system() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}')
    local load_average=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    
    echo "$(get_timestamp) | System | ✅ OK | CPU: ${cpu_usage}%, Memory: ${memory_usage}%, Disk: ${disk_usage}, Load: ${load_average}"
}

# Monitor SSL certificate
monitor_ssl() {
    local status="✅ OK"
    local details=""
    
    if command -v openssl >/dev/null 2>&1; then
        local cert_info=$(echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        
        if [ -n "$cert_info" ]; then
            local not_after=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
            local expiry_timestamp=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
            local current_timestamp=$(date +%s)
            local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
            
            if [ $days_until_expiry -lt 7 ]; then
                status="⚠️ EXPIRING SOON"
                details="SSL certificate expires in $days_until_expiry days"
                print_alert "SSL certificate expires in $days_until_expiry days"
            elif [ $days_until_expiry -lt 30 ]; then
                status="⚠️ RENEWAL NEEDED"
                details="SSL certificate expires in $days_until_expiry days"
            else
                details="SSL certificate expires in $days_until_expiry days"
            fi
        else
            status="❌ CERTIFICATE ERROR"
            details="Could not retrieve SSL certificate information"
        fi
    else
        status="⚠️ CANNOT CHECK"
        details="OpenSSL not available"
    fi
    
    echo "$(get_timestamp) | SSL | $status | $details"
}

# Generate monitoring report
generate_report() {
    local report_file="/tmp/monitoring-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "services": {
        "backend": {
            "process_running": $(check_service_process "backend" && echo "true" || echo "false"),
            "endpoint_responding": $(check_endpoint "https://example.com/api/health" && echo "true" || echo "false"),
            "consecutive_failures": $BACKEND_FAILURES
        },
        "frontend": {
            "process_running": $(check_service_process "frontend" && echo "true" || echo "false"),
            "endpoint_responding": $(check_endpoint "https://example.com/" && echo "true" || echo "false"),
            "consecutive_failures": $FRONTEND_FAILURES
        },
        "mobile": {
            "process_running": $(check_service_process "mobile" && echo "true" || echo "false"),
            "endpoint_responding": $(check_endpoint "https://example.com/mobile/" && echo "true" || echo "false"),
            "consecutive_failures": $MOBILE_FAILURES
        },
        "database": {
            "connected": $(check_database && echo "true" || echo "false"),
            "consecutive_failures": $DATABASE_FAILURES
        },
        "redis": {
            "connected": $(check_redis && echo "true" || echo "false"),
            "consecutive_failures": $REDIS_FAILURES
        }
    },
    "system": {
        "cpu_usage": "$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%",
        "memory_usage": "$(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')",
        "disk_usage": "$(df -h / | awk 'NR==2 {print $5}')",
        "load_average": "$(uptime | awk -F'load average:' '{print $2}' | xargs)"
    }
}
EOF
    
    echo "$report_file"
}

# Main monitoring loop
monitor_loop() {
    print_header "🔍 Starting CRM Deployment Monitoring"
    print_info "Check interval: ${CHECK_INTERVAL} seconds"
    print_info "Alert threshold: ${ALERT_THRESHOLD} consecutive failures"
    print_info "Press Ctrl+C to stop monitoring"
    echo ""
    
    # Print header
    echo "Timestamp           | Service  | Status           | Details"
    echo "-------------------|----------|------------------|------------------"
    
    while true; do
        # Monitor all services
        monitor_backend
        monitor_frontend
        monitor_mobile
        monitor_database
        monitor_redis
        monitor_system
        monitor_ssl
        
        # Generate report every 10 minutes
        local current_minute=$(date +%M)
        if [ $((current_minute % 10)) -eq 0 ] && [ $(date +%S) -lt 10 ]; then
            local report_file=$(generate_report)
            print_info "Monitoring report generated: $report_file"
        fi
        
        echo "-------------------|----------|------------------|------------------"
        
        # Wait for next check
        sleep "$CHECK_INTERVAL"
    done
}

# Handle script termination
cleanup() {
    print_info "Monitoring stopped at $(get_timestamp)"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Main function
main() {
    # Create log directories
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$ALERT_LOG")"
    
    # Check if running as correct user
    if [ "$USER" != "admin1" ]; then
        print_error "This script should be run as user 'admin1'"
        exit 1
    fi
    
    # Start monitoring
    monitor_loop
}

# Execute main function
main "$@"
