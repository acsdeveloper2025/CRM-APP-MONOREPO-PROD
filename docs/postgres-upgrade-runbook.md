# Postgres major-version upgrade runbook

Whenever you bump `postgres:17-alpine` → `postgres:18-alpine` (or 18→19), follow this. Major upgrades are NOT auto-applied by changing the image tag — Postgres won't start against a data dir initialized by an older `major`.

## The two paths

| Path | Use when | Downtime | Risk |
|---|---|---|---|
| **A. Dump-restore** | Staging / dev. Small DB (<10 GB). All-dev framing. | 5–15 min | Lowest. Fresh data dir, no compat surprises. |
| **B. `pg_upgrade --link`** | Real prod with sizeable data, want fastest in-place upgrade. | 1–3 min | Medium. Old data dir untouched; revert by repointing volume. |

Staging today fits A. Prod (AWS RDS) will use the managed upgrade path, not B.

---

## Path A — dump-restore (staging, the simple one)

Memory rule: staging is all-dev, no real users. DB can be reset. This is the recommended path until that changes.

### Pre-flight (T-1 day)

1. **Read the upgrade release notes** for the target version. Search for:
   - Dropped types or operators (e.g. PG12 dropped `:=` for assignment in PL/pgSQL)
   - Default behaviour changes (PG18 changed `/var/lib/postgresql/data` layout — that's why we're on 17)
   - New keywords that collide with existing column names
   - Extension compatibility (`btree_gist`, `pg_trgm`, `pgcrypto` — all should track PG)
2. **Test in local dev compose first.** Update `docker-compose.yml`'s postgres image, `docker compose down -v && docker compose up`. Make sure `migrate` runs clean and `npm run dev` boots without errors.
3. **Capture a dump** from the running staging cluster:
   ```bash
   ssh -p 2232 -i ~/.ssh/github_actions_key root@49.50.119.155 \
     'docker exec crm_postgres pg_dump --no-owner --no-acl --clean --if-exists -U acs_user acs_db' \
     > /tmp/staging-pre-upgrade-$(date +%Y%m%d).sql
   wc -l /tmp/staging-pre-upgrade-*.sql      # sanity check line count
   ```

### Cutover (T-0)

1. **Update the compose image tag** in `infra/staging/docker-compose.yml`:
   ```yaml
   postgres:
     image: postgres:18-alpine  # was 17
   ```
2. **If the new postgres image needs a different mount path** (e.g. PG18 wants `/var/lib/postgresql` instead of `/var/lib/postgresql/data`), update the volume mount too:
   ```yaml
   volumes:
     - pgdata:/var/lib/postgresql  # was /var/lib/postgresql/data
   ```
3. Commit + push:
   ```bash
   git commit -m "chore(db): bump postgres 17 -> 18 (major upgrade)"
   git push origin main
   ```
4. **WAIT for CI to build images and reach the SSH deploy step**, then watch `gh run watch` until just before `deploy.sh` runs compose up. (Or pause CI by deleting the workflow temporarily — easier path.)
5. Before deploy.sh runs (or via a maintenance window): **wipe the old PG data volume** since dump-restore needs a fresh init:
   ```bash
   ssh -p 2232 -i ~/.ssh/github_actions_key root@49.50.119.155 'cd /opt/crm-app/docker && set -a && source .env.staging && set +a && docker compose -f infra/staging/docker-compose.yml down -v'
   ```
   This drops `crm_pgdata`. Schema baseline (`acs_db_final_version.sql`) auto-reloads on next `up` via `docker-entrypoint-initdb.d`.
6. **Re-deploy** (will pick up the new image + fresh init):
   ```bash
   gh workflow run staging-deploy -f image_tag=<commit-sha>
   ```
7. **Verify** schema reloaded + migrations applied:
   ```bash
   ssh -p 2232 -i ~/.ssh/github_actions_key root@49.50.119.155 \
     'docker exec crm_postgres psql -U acs_user -d acs_db -tA -c "SELECT version();"'
   # Expect: PostgreSQL 18.x ...
   ```
8. **Smoke**: `curl https://crm.allcheckservices.com/api/health/ready`

### Rollback

If anything goes wrong (migrations fail, app errors out, etc.) before announcing the upgrade is good:

```bash
git revert <upgrade-commit-sha>
git push origin main
# Wait for CI to rebuild + redeploy with old image
# Volume is fresh-initialized again from the schema baseline
```

For staging this is cheap because no real user data is at stake.

---

## Path B — `pg_upgrade --link` (production, future)

Use this when AWS prod is up and there's actual data to preserve. The RDS managed-upgrade flow handles this for you on RDS — DO NOT do it manually if you're on RDS. This section is for self-hosted-postgres-in-container scenarios.

### High-level idea

Bring up the NEW Postgres image with access to BOTH the old data dir and a new (empty) data dir. Run `pg_upgrade --link` which:
1. Reads the old cluster's catalog
2. Copies catalog to the new cluster
3. **Hard-links** the actual data files (`-link` flag — no copy, near-instant)
4. New cluster takes over

Old data dir is now consumed by hard links — DO NOT delete it for at least one validation cycle.

### Sketch (not load-bearing — adapt per major version)

```bash
# 1. Stop the app side (api + worker only — keep postgres up for now)
ssh -p 2232 ... 'cd /opt/crm-app/docker && docker compose stop api worker edge'

# 2. Final pg_dump as safety net
docker exec crm_postgres pg_dumpall -U acs_user > /opt/crm-app/backups/pre-pg-upgrade-$(date +%s).sql

# 3. Stop crm_postgres
docker compose stop postgres

# 4. Move the old volume out of the way (rename, don't delete)
docker volume create crm_pgdata_new
# bring up a temporary postgres container with both volumes mounted
docker run --rm \
  -v crm_pgdata:/var/lib/postgresql/old \
  -v crm_pgdata_new:/var/lib/postgresql/new \
  postgres:18-alpine \
  /usr/lib/postgresql/18/bin/pg_upgrade \
    --old-datadir=/var/lib/postgresql/old/data \
    --new-datadir=/var/lib/postgresql/new/data \
    --old-bindir=/usr/lib/postgresql/17/bin \
    --new-bindir=/usr/lib/postgresql/18/bin \
    --link

# 5. Swap volumes in compose: pgdata → pgdata_new
# 6. Bring stack back up against the new volume
# 7. Run analyze + vacuum
docker exec crm_postgres psql -U acs_user -d acs_db -c "ANALYZE;"
```

Notes:
- `pg_upgrade` MUST run with the SAME `acs_user` ownership on both data dirs.
- The new container must have BOTH PG major versions' binaries available — which the `postgres:NEW-alpine` image does NOT (it only ships the new). For production use, build a custom upgrade image with both, OR use `tianon/postgres-upgrade:OLD-to-NEW` (community image).
- `--link` means the old cluster is now dependent on the same data files. If you start the OLD postgres again, you'll corrupt the NEW. Document this clearly in your runbook.

For real production, use **managed Postgres** (RDS / Aiven / Neon). They run `pg_upgrade` for you, provide a rollback snapshot, and handle the rollback semantics correctly.

---

## Why we are on PG17 (2026-05-20 context)

The PR4 staging cutover initially used `postgres:18-alpine`. The image's data dir convention changed (docker-library/postgres#1259): PG18 wants the mount at `/var/lib/postgresql` (parent), not `/var/lib/postgresql/data`. Existing volume layout incompatible. We downgraded to PG17 for staging to match the bare-metal cluster being replaced and to match what AWS RDS offers.

When PG18 stabilizes on the official Docker image OR when AWS RDS offers PG18 — re-evaluate. Use the runbook above.

---

## Pre-checks every time, regardless of path

```bash
# Disk space — pg_upgrade --link doesn't double, but dump-restore can
df -h / | head -2

# Extensions in use
docker exec crm_postgres psql -U acs_user -d acs_db -c "SELECT * FROM pg_extension;"

# Active connections — pg_upgrade refuses if any are open
docker exec crm_postgres psql -U acs_user -d acs_db -c "SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL;"

# Largest tables (impact estimate)
docker exec crm_postgres psql -U acs_user -d acs_db -c "
  SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
  FROM pg_tables WHERE schemaname='public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

## Post-upgrade hardening

- Run `ANALYZE` on the whole DB (table stats reset by upgrade).
- Run `VACUUM (FREEZE, ANALYZE)` on partitioned tables (`audit_logs`, `notifications`, etc.).
- Check `pg_stat_user_indexes` for sudden full-scans that weren't there before — query planner may have regressed.
- Watch the app's slow-query logs (`SLOW_QUERY_MS=500` threshold) for the first 24h.

## Don't-regress notes

- Never start the OLD Postgres binary against a data dir touched by `pg_upgrade --link` — corrupts both.
- Never delete the old data volume until you've verified the new one for ≥1 week.
- TZ-aware partitioned tables (`audit_logs` partitioned monthly on `created_at`) may need a fresh `attach` if the upgrade reorganizes catalog OIDs — verify partition list post-upgrade.
- The `acs_db_final_version.sql` baseline file commits a SPECIFIC PG major version's dump format. When you bump PG major, regenerate the baseline from the new running cluster (`sudo -u postgres pg_dump --no-owner --no-acl --clean --if-exists acs_db > acs_db_final_version.sql`) and commit it. Otherwise `docker compose down -v && up` will fail with the same kind of error PR4 caught (forward-FK + version-specific syntax).
