#!/bin/bash

# Production Database Backup Script
# Creates timestamped backups of the CRM database

set -e

# Configuration
DB_NAME="acs_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="../database-backup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/acs_db_backup_${TIMESTAMP}.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🗄️  Starting database backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if PostgreSQL is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running or not accessible${NC}"
    exit 1
fi

# Create backup
echo -e "${YELLOW}📦 Creating backup: $BACKUP_FILE${NC}"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose --clean --no-owner --no-privileges \
    --format=plain > "$BACKUP_FILE"; then
    
    echo -e "${GREEN}✅ Backup created successfully${NC}"
    
    # Get file size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}📊 Backup size: $BACKUP_SIZE${NC}"
    
    # Compress backup
    echo -e "${YELLOW}🗜️  Compressing backup...${NC}"
    gzip "$BACKUP_FILE"
    COMPRESSED_FILE="${BACKUP_FILE}.gz"
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    echo -e "${GREEN}✅ Compressed backup: $COMPRESSED_SIZE${NC}"
    
    # Clean up old backups (keep last 7 days)
    echo -e "${YELLOW}🧹 Cleaning up old backups...${NC}"
    find "$BACKUP_DIR" -name "acs_db_backup_*.sql.gz" -mtime +7 -delete
    
    echo -e "${GREEN}🎉 Database backup completed successfully!${NC}"
    echo -e "${GREEN}📁 Backup location: $COMPRESSED_FILE${NC}"
    
else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
fi
