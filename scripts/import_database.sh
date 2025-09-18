#!/bin/bash

# =====================================================
# CRM Database Import Script
# Purpose: Import the complete CRM database structure into PostgreSQL
# Usage: ./import_database.sh [database_name] [username] [host] [port]
# =====================================================

# Default values
DB_NAME=${1:-"crm_database"}
DB_USER=${2:-"postgres"}
DB_HOST=${3:-"localhost"}
DB_PORT=${4:-"5432"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}CRM Database Import Script${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# Check if SQL file exists
if [ ! -f "crm_database_complete.sql" ]; then
    echo -e "${RED}Error: crm_database_complete.sql file not found!${NC}"
    echo "Please make sure the SQL file is in the current directory."
    exit 1
fi

echo -e "${YELLOW}Database Configuration:${NC}"
echo "  Database Name: $DB_NAME"
echo "  Username: $DB_USER"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo ""

# Prompt for password
echo -e "${YELLOW}Please enter the PostgreSQL password for user '$DB_USER':${NC}"
read -s DB_PASSWORD
echo ""

# Test connection
echo -e "${BLUE}Testing database connection...${NC}"
export PGPASSWORD="$DB_PASSWORD"

if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to PostgreSQL server!${NC}"
    echo "Please check your connection parameters and try again."
    exit 1
fi

echo -e "${GREEN}✓ Connection successful!${NC}"
echo ""

# Check if database exists
echo -e "${BLUE}Checking if database '$DB_NAME' exists...${NC}"
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${YELLOW}Warning: Database '$DB_NAME' already exists!${NC}"
    echo -e "${YELLOW}Do you want to drop and recreate it? (y/N):${NC}"
    read -r CONFIRM
    
    if [[ $CONFIRM =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Dropping existing database...${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Database dropped successfully!${NC}"
        else
            echo -e "${RED}Error: Failed to drop database!${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Import cancelled by user.${NC}"
        exit 0
    fi
fi

# Create database
echo -e "${BLUE}Creating database '$DB_NAME'...${NC}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database created successfully!${NC}"
else
    echo -e "${RED}Error: Failed to create database!${NC}"
    exit 1
fi

# Import SQL file
echo -e "${BLUE}Importing CRM database structure...${NC}"
echo "This may take a few minutes..."
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f crm_database_complete.sql

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Database import completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}Error: Database import failed!${NC}"
    echo "Please check the error messages above."
    exit 1
fi

# Verify import
echo -e "${BLUE}Verifying database import...${NC}"
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo "  Tables created: $TABLE_COUNT"

# Check for key tables
KEY_TABLES=("cases" "users" "clients" "verification_attachments" "residenceVerificationReports" "businessVerificationReports")
MISSING_TABLES=()

for table in "${KEY_TABLES[@]}"; do
    EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name = '$table';")
    if [ "$EXISTS" != "1" ]; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All key tables created successfully!${NC}"
else
    echo -e "${YELLOW}Warning: Some key tables are missing:${NC}"
    for table in "${MISSING_TABLES[@]}"; do
        echo "  - $table"
    done
fi

# Show sample data
echo ""
echo -e "${BLUE}Sample data verification:${NC}"
USER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM users;")
ROLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM roles;")
CLIENT_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM clients;")

echo "  Users: $USER_COUNT"
echo "  Roles: $ROLE_COUNT"
echo "  Clients: $CLIENT_COUNT"

# Connection string
echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}DATABASE IMPORT COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}======================================================${NC}"
echo ""
echo -e "${YELLOW}Connection Details:${NC}"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Username: $DB_USER"
echo ""
echo -e "${YELLOW}Connection String for your application:${NC}"
echo "postgresql://$DB_USER:YOUR_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo -e "${YELLOW}Default Admin Login:${NC}"
echo "  Username: admin"
echo "  Password: CHANGE_ME_PASSWORD"
echo ""
echo -e "${BLUE}You can now start your CRM application!${NC}"

# Cleanup
unset PGPASSWORD
