# DB Reset And Snapshot Workflow

This backend now includes a repeatable local-main database workflow instead of ad hoc manual SQL.

## Goals

- Preserve master data:
  - `countries`
  - `states`
  - `cities`
  - `areas`
  - `pincodes`
  - `pincodeAreas`
  - `documentTypes`
  - `verificationTypes`
  - `rateTypes`
- Preserve only the canonical Admin auth state.
- Use `roles_v2` as the only role source of truth.
- Remove operational, client, product, and non-rate-type pricing data.
- Normalize preserved numeric IDs to contiguous `1..N`.
- Realign sequences to the latest valid ID.
- Export a deployable snapshot that can be applied in another environment.

## Scripts

- `npm run db:backup`
  - Creates a gzipped full SQL backup under `CRM-BACKEND/db-artifacts/backups/`.

- `npm run db:sync-admin`
  - Re-syncs the Admin legacy role row, RBAC role mapping, and permission coverage.

- `npm run db:reset-local`
  - Resets the local database to the canonical sanitized state.
  - Removes operational/client/rate-config data.
  - Keeps master tables and Admin auth state.
  - Normalizes preserved numeric IDs.

- `npm run db:validate`
  - Validates:
    - only one Admin user remains
    - legacy and RBAC role rows are consistent
    - Admin has complete permissions
    - preserved tables have contiguous IDs
    - preserved FK chains are intact
    - sequences match the latest valid row

- `npm run db:export-snapshot`
  - Exports the current local main state into:
    - `CRM-BACKEND/db-artifacts/local-main-snapshot.sql`
    - `CRM-BACKEND/migrations/20260326_local_main_snapshot_reset.sql`

- `npm run db:prepare-local-main`
  - Runs backup, Admin sync, validation, and snapshot export.

## Production sync

The tracked migration `CRM-BACKEND/migrations/20260326_local_main_snapshot_reset.sql` is the deployable artifact for bringing another environment to the same sanitized local-main data state.

It is intentionally destructive:

- truncates operational and pricing data
- replaces role/auth/master snapshot tables with the canonical local snapshot
- assumes legacy `roles` / `users.roleId` have been removed by migration

Do not run it on an environment unless replacing its data with the local-main snapshot is intended.

## Backups

Always take a backup before running destructive resets or deploying a snapshot:

```sh
cd CRM-BACKEND
npm run db:backup
```
