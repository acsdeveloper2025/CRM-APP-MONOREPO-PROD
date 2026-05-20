# AWS Migration Notes (parking lot)

Scaffolding for the `aws` branch that will host the real prod stack on `acscrm.allcheckservices.com`. **Not actively in use** — populate when the AWS migration sprint starts.

## Decisions to lock before migration

| Question | Likely answer | Decide before |
|---|---|---|
| Orchestrator | ECS Fargate (vs EKS) | Start of AWS sprint |
| Postgres | RDS for PostgreSQL **17** (matches staging; 18 image broke the data-dir mount during PR4 cutover, see Lessons below) | Bootstrap |
| Redis | ElastiCache (single-shard, AOF enabled) | Bootstrap |
| Object storage | S3 (vs R2) — pick S3 for AWS-native IAM | Bootstrap |
| Image registry | ECR (with ECR pull-through cache to GHCR for first cut) | Bootstrap |
| Edge TLS | ACM cert behind ALB | Bootstrap |
| DNS | Route 53 → ALB | DNS cutover |
| Secrets | AWS Secrets Manager + IAM task role | Bootstrap |
| Log shipping | CloudWatch Logs (FireLens for app logs) | Day-2 |
| Metrics | CloudWatch + Container Insights | Day-2 |
| Backup | RDS automated snapshots + 30-day PITR | Bootstrap |
| Region | ap-south-1 (Mumbai) — matches Asia/Kolkata TZ | Bootstrap |

## Mobile pin migration (load-bearing)

Prod hostname `acscrm.allcheckservices.com` will be NEW — mobile clients today pin `crm.allcheckservices.com` (per `project_ssl_pinning.md`). Migration plan:

1. **Audit current pins** in `crm-mobile-native/src/config/sslPins.ts` (or wherever — confirm path before starting).
2. **Ship a mobile release that dual-pins**:
   - Existing leaf SPKI for `crm.allcheckservices.com` (kept until adoption ≥95%)
   - New intermediate CA SPKI (long-term stable — pick DigiCert / Sectigo, not Let's Encrypt which rotates intermediates)
   - Plus the new prod hostname's leaf
3. **Wait for adoption** — monitor app analytics for ≥95% installs on the dual-pin build.
4. **Issue new cert for `acscrm.allcheckservices.com`** under the same intermediate CA.
5. **Cut DNS** for the user-facing prod traffic to the new ALB.
6. **Ship a follow-up mobile release** that drops the old `crm.allcheckservices.com` pin.

Estimated timeline: 4-6 weeks total (dominated by mobile rollout).

## Image reuse contract

The exact same `crm-api` and `crm-edge` images shipping to staging today MUST run on AWS without modification. Memory rule #3.

- No baked-in hostnames in the image
- No baked-in secrets
- All env arrives at runtime
- `VITE_API_BASE_URL` is the one build-time exception (Vite bakes it); pass via `--build-arg` per environment.

If we ever break this contract in a hot-path, the AWS migration cost balloons. Treat as load-bearing.

## Compose → ECS task definition

`docker compose convert --format ecs` works against the staging compose file with minor edits:

- Resource limits already in `deploy.resources.limits` block (Compose ignores them, ECS uses them).
- Replace named volumes (`pgdata`, `redisdata`, `uploads`) with:
  - `pgdata` → drop (managed RDS)
  - `redisdata` → drop (managed ElastiCache)
  - `uploads` → EFS or replaced by S3 via `STORAGE_BACKEND=s3` env flip
- Replace `secrets:` block with ECS task definition secret references (Secrets Manager ARNs).
- Replace `depends_on: { condition: service_completed_successfully }` with ECS task chain or initContainer pattern.
- `migrate` service becomes a one-shot ECS RunTask, scheduled by the deploy pipeline before the api/worker services roll.

## Cost projections (placeholder — fill in when planning)

| Resource | Est. monthly |
|---|---|
| RDS db.t4g.medium Postgres 18 | TBD |
| ElastiCache cache.t4g.small Redis 7 | TBD |
| ECS Fargate (api 2× + worker 2× + edge 2×) | TBD |
| ALB | TBD |
| S3 (uploads + monthly turnover) | TBD |
| Data transfer | TBD |
| Total | TBD |

## Migration sequencing (suggested)

1. Branch `aws` off `main`.
2. Provision AWS infra via Terraform / Pulumi (separate repo or `infra/aws/`).
3. Mirror images from GHCR to ECR (or use ECR pull-through cache).
4. Run a `staging-on-aws` deploy first — same images, AWS infra, dummy DNS. Verify.
5. Mobile pin migration (above) runs in parallel — own track, 4-6 weeks.
6. Once mobile adoption ≥95% AND aws-staging clean for 1 week: cut prod DNS for `acscrm.allcheckservices.com`.
7. Keep `crm.allcheckservices.com` (this staging) running for a soak period.
8. Eventually decommission staging or repurpose for ephemeral CI environments.

## Open questions parked here

- Do we want a separate prod-like staging on AWS (`acscrm-staging.allcheckservices.com`)? Cost vs safety trade-off.
- Multi-region? Current single-region (ap-south-1) is fine for India-only ops.
- Secrets rotation cadence — set policy before going live.

## Lessons from PR4 staging cutover (carry forward to AWS)

These bit us during the staging Docker bring-up; same images will run on AWS so the fixes carry over but the environment specifics may resurface.

1. **PG18 image broke the data-dir mount layout** (docker-library/postgres#1259). Use `postgres:17-alpine` or RDS for Postgres 17. PG18 wants `/var/lib/postgresql/` mounted (parent dir) instead of `/var/lib/postgresql/data/`. Revisit when RDS PG18 GA and we have time to migrate.
2. **`npm ci --omit=dev` runs husky's `prepare` script and explodes** because husky is a devDep. Fix: `npm pkg delete scripts.prepare` BEFORE `npm ci` in the runtime stage of the Dockerfile. Same fix applies to ECS task definition builds.
3. **Compose `--env-file` does NOT populate shell env for interpolation in v2.** ECS doesn't have this problem (env vars come from task definition `environment:`/`secrets:`), but if you ever shim Compose-on-EC2 for testing: `set -a && source .env && set +a` before `docker compose up`.
4. **`pg_isready` defaults to unix socket which is open during initdb.d**. For container healthchecks, force TCP: `pg_isready -h localhost`. RDS doesn't expose this — its healthchecks are AWS-managed. But initial DB seed (load `acs_db_final_version.sql` via `psql`) must complete before `migrate` runs. RDS bootstrap script needs to block on data load completion.
5. **`pg_dump` output ordering matters.** The pre-cutover dump had a forward FK reference (FK statement at line 5455, referenced CREATE TABLE at line 9468). Use `--no-owner --no-acl --clean --if-exists` and trust pg_dump's native ordering. AWS RDS imports via standard `psql` so same rules apply.
6. **nginx baked-in `default_server` collides with mounted overlay.** Either don't bake a fallback OR don't declare `default_server` in either layer. Same applies if ECS uses a sidecar nginx with a config volume.
7. **GHCR auth on ECS**: the workflow's `GITHUB_TOKEN`-based login doesn't translate. ECR pull-through cache to GHCR is the cleanest path; alternative is a long-lived GHCR deploy token in Secrets Manager (rotate quarterly).
8. **TZ=Asia/Kolkata must be set on every container that does time math** (api/worker/migrate/postgres). RDS exposes a parameter group for timezone — set it. ECS task definitions inherit container ENV settings — bake `TZ=Asia/Kolkata` into the api image base or explicitly set in task def.
