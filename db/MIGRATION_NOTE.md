# Database Migration Baseline

**Date:** 2025-11-29
**Dump File:** database-latest-20251129133455.dump

This database dump represents the new baseline state for the production environment.
It includes all schema changes and data up to this point, including the new Dedupe functionality and table updates.

## Instructions

To apply this migration:

1. Stop the application services.
2. Drop the existing database or use `--clean` option (included in restore command).
3. Restore using `pg_restore`:
   ```bash
   pg_restore -U $DB_USER -h $DB_HOST -d $DB_NAME db/database-latest-20251129133455.dump --clean --no-owner
   ```
4. Restart application services.
