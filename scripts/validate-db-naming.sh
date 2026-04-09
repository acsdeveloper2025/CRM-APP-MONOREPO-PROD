#!/bin/bash
# Database Naming Convention Validator
# Checks that ALL table names and column names are snake_case.
# Run this in CI/CD or before migrations to prevent naming regressions.
#
# Usage: ./scripts/validate-db-naming.sh [DATABASE_URL]

set -e

DB_URL="${1:-${DATABASE_URL:-postgresql://acs_user:acs_password@localhost:5432/acs_db}}"

echo "🔍 Validating database naming conventions..."

# Check for camelCase column names
CAMEL_COLUMNS=$(psql "$DB_URL" -t -A -c "
  SELECT table_name || '.' || column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name ~ '[A-Z]'
  ORDER BY table_name, column_name;
" 2>/dev/null)

# Check for camelCase table names
CAMEL_TABLES=$(psql "$DB_URL" -t -A -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name ~ '[A-Z]'
  ORDER BY table_name;
" 2>/dev/null)

ERRORS=0

if [ -n "$CAMEL_COLUMNS" ]; then
  echo "❌ FAIL: Found camelCase columns (must be snake_case):"
  echo "$CAMEL_COLUMNS" | while read -r col; do
    echo "  - $col"
  done
  ERRORS=$((ERRORS + $(echo "$CAMEL_COLUMNS" | wc -l)))
fi

if [ -n "$CAMEL_TABLES" ]; then
  echo "❌ FAIL: Found camelCase tables (must be snake_case):"
  echo "$CAMEL_TABLES" | while read -r tbl; do
    echo "  - $tbl"
  done
  ERRORS=$((ERRORS + $(echo "$CAMEL_TABLES" | wc -l)))
fi

if [ "$ERRORS" -eq 0 ]; then
  echo "✅ PASS: All table and column names are snake_case."
  exit 0
else
  echo ""
  echo "❌ $ERRORS naming violations found. Fix them before deploying."
  exit 1
fi
