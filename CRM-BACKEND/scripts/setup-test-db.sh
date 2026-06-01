#!/usr/bin/env bash
#
# Provision the isolated integration-test database (acs_db_test).
#
# Reads DATABASE_URL from CRM-BACKEND/.env, drops + recreates acs_db_test on
# the SAME Postgres the app connects to (localhost), loads the schema+seed
# dump, and enables pg_trgm. Idempotent — safe to re-run.
#
#   NOTE: on this machine `localhost:5432` is a native (Homebrew) Postgres,
#   NOT the docker `crm_postgres` container. The integration tests connect
#   via DATABASE_URL (localhost), so the test DB must live there too.
#
# Usage:  bash CRM-BACKEND/scripts/setup-test-db.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BE_DIR/.." && pwd)"
DUMP="$REPO_ROOT/acs_db_final_version.sql"

[ -f "$BE_DIR/.env" ] || { echo "ERROR: $BE_DIR/.env not found" >&2; exit 1; }
[ -f "$DUMP" ] || { echo "ERROR: schema dump not found at $DUMP" >&2; exit 1; }

DEV_URL="$(grep -E '^DATABASE_URL=' "$BE_DIR/.env" | cut -d= -f2- | tr -d '"')"
BASE="${DEV_URL%/acs_db}"
TEST_URL="$BASE/acs_db_test"

echo "Recreating acs_db_test ..."
psql "$BASE/postgres" -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS acs_db_test;" \
  -c "CREATE DATABASE acs_db_test OWNER acs_user;"

echo "Enabling pg_trgm ..."
psql "$TEST_URL" -q -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

echo "Loading schema + seed dump (errors for the materialized view / late objects are expected) ..."
psql "$TEST_URL" -q -v ON_ERROR_STOP=0 -f "$DUMP" > /tmp/acs_db_test_load.log 2>&1 || true

# Apply post-dump migrations so the test schema matches live `acs_db`.
# The dump (acs_db_final_version.sql) is a point-in-time snapshot; any column
# or object added by a migration AFTER the dump date is absent from a fresh
# load and must be re-applied here, or integration tests drift from live.
# Two classes:
#   1. dashboard materialized views — the dump's REFRESH statements fail
#      because the CREATE never lands in load order, so re-create them.
#   2. post-dump column migrations — e.g. verification_reports.call_confirmation
#      (shipped 2026-06-01, after the dump). All are idempotent
#      (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so re-running is safe.
# When a new schema-changing migration ships after the dump, append it here.
echo "Applying post-dump migrations (mat-views + later column additions) ..."
for MIG in \
  2026-05-27_p5_dashboard_kpi_mat_view.sql \
  2026-05-28_p3_1_mv_dashboard_tat.sql \
  2026-06-01_verification_reports_call_confirmation.sql \
  2026-06-02_kyc_verifier_p0_rbac.sql \
  2026-06-02_kyc_verifier_p1_cycles.sql \
  2026-06-02_kyc_verifier_p2_notifications.sql \
  2026-06-02_kyc_verifier_p4_billing.sql; do
  if [ -f "$BE_DIR/migrations/$MIG" ]; then
    psql "$TEST_URL" -q -v ON_ERROR_STOP=0 -f "$BE_DIR/migrations/$MIG" >> /tmp/acs_db_test_load.log 2>&1 || true
  fi
done

TABLES="$(psql "$TEST_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
USERS="$(psql "$TEST_URL" -tAc "SELECT count(*) FROM users;")"
echo "Done. acs_db_test has $TABLES tables and $USERS seeded users."
echo "Full load log: /tmp/acs_db_test_load.log"
