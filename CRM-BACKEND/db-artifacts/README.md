# DB Artifacts

Tracked database artifacts generated from the local main database state.

- `backups/`
  - Full gzipped SQL backups.
- `local-main-snapshot.sql`
  - Current deployable SQL snapshot of the canonical sanitized local data state.

These artifacts are intended for controlled environment synchronization, not routine app runtime use.

