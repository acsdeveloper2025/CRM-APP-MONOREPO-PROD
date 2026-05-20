# Staging — Docker on `crm.allcheckservices.com`

The staging box (`49.50.119.155:2232` SSH) runs the CRM stack in Docker via Compose. Same images as local Docker (`docker-compose.yml`), but the `runtime` stage target instead of `dev`, plus an `edge` (nginx + TLS) container.

**Status**: All-development environment. No real users. DB can be reset. No PITR / off-box backup discipline.

## Topology

```
External traffic → :443 (edge container) → /api → api container → postgres + redis + worker (via Redis queues)
                                       → /socket.io → api (WS upgrade)
                                       → /uploads → api (storage abstraction)
                                       → /*       → static FE (built into edge image)

Background:    BullMQ producers in api (HTTP path) → Redis → worker drains
File storage:  named volume `crm_uploads` mounted on api + worker (NOT edge)
```

Five long-running containers + one one-shot `migrate`:

| Container | Image | Role |
|---|---|---|
| `crm_edge` | `ghcr.io/acsdeveloper2025/crm-edge` | nginx + TLS + static FE + reverse proxy |
| `crm_api` | `ghcr.io/acsdeveloper2025/crm-api` | `ROLE=api`. HTTP :3000 + Socket.IO |
| `crm_worker` | `ghcr.io/acsdeveloper2025/crm-api` | `ROLE=worker`. BullMQ + interval jobs. Worker probe :3001 (internal) |
| `crm_postgres` | `postgres:18-alpine` | DB. Volume `crm_pgdata` |
| `crm_redis` | `redis:7-alpine` | Cache + BullMQ + Socket.IO pub/sub. AOF on. Volume `crm_redisdata` |
| `crm_migrate` | `ghcr.io/acsdeveloper2025/crm-api` (`-dev` tag) | one-shot. `service_completed_successfully` gate before api/worker. |

## First-time bootstrap (done once)

Performed during the PR4 cutover. Re-document here for the historical record:

```bash
ssh -p 2232 -i ~/.ssh/github_actions_key root@49.50.119.155

# 1. Stop bare-metal
pm2 stop crm-backend && pm2 delete crm-backend
systemctl stop nginx && systemctl disable nginx

# 2. Install Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh

# 3. Install certbot
apt-get update && apt-get install -y certbot

# 4. Cert handling — reuse existing if present
if [ -f /etc/letsencrypt/live/crm.allcheckservices.com/fullchain.pem ]; then
  echo "Cert exists, reusing"
else
  certbot certonly --standalone -d crm.allcheckservices.com \
    --non-interactive --agree-tos -m ops@allcheckservices.com
fi

# 5. Clone repo
mkdir -p /opt/crm-app/docker
cd /opt/crm-app/docker
git clone https://github.com/acsdeveloper2025/CRM-APP-MONOREPO-PROD.git .

# 6. Create .env.staging (copy from existing bare-metal .env, rotate sensitive
#    values if desired). Reuse from /opt/crm-app/current/CRM-BACKEND/.env so
#    existing JWT/MFA/HMAC secrets stay valid.
cp infra/staging/.env.staging.example .env.staging
# … then fill in real values (the bootstrap step is interactive).
chmod 600 .env.staging
chown root:root .env.staging

# 7. Drop firebase secret
mkdir -p secrets
cp /opt/crm-app/current/CRM-BACKEND/config/firebase-service-account.json secrets/
chmod 600 secrets/firebase-service-account.json

# 8. Set up systemd cert renewal timer with edge nginx reload hook
cat > /etc/systemd/system/certbot-renew.service <<'UNIT'
[Unit]
Description=Renew Let's Encrypt certs

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "/usr/local/bin/edge-reload.sh"
UNIT

cat > /etc/systemd/system/certbot-renew.timer <<'UNIT'
[Unit]
Description=Daily Let's Encrypt renewal check

[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
UNIT

cat > /usr/local/bin/edge-reload.sh <<'SH'
#!/usr/bin/env bash
docker compose -f /opt/crm-app/docker/infra/staging/docker-compose.yml \
  --env-file /opt/crm-app/docker/.env.staging \
  kill -s HUP edge
SH
chmod +x /usr/local/bin/edge-reload.sh

systemctl daemon-reload
systemctl enable --now certbot-renew.timer
```

After this, the GH Actions workflow (`staging-deploy.yml`) handles everything else on each push to `main`.

## Redeploy

Automatic on `push: main`. Manual override:

```bash
# From your laptop:
gh workflow run staging-deploy --ref main

# Or with a pinned image tag (rollback):
gh workflow run staging-deploy --ref main -f image_tag=<sha>
```

GH Actions does:

1. Build api + edge images, push to GHCR (tags `:latest` + `:<sha>` + `:<sha>-dev` for the migrate image).
2. SSH to the box, `docker login ghcr.io` with workflow token, run `infra/staging/deploy.sh`.
3. `deploy.sh` pulls images, runs `docker compose up -d --remove-orphans`, waits for healthy.
4. Workflow finishes with external HTTPS smoke test.

Migrations run via the `migrate` one-shot, which `api` and `worker` `depends_on` with `condition: service_completed_successfully`. The schema-migrations table tracks applied files by checksum — same migrations runner the bare-metal deploy used.

## Rollback

```bash
# Rollback to specific image tag:
gh workflow run staging-deploy --ref main -f image_tag=<earlier-sha>

# Hard reset on the box (last resort):
ssh -p 2232 -i ~/.ssh/github_actions_key root@49.50.119.155
cd /opt/crm-app/docker
docker compose -f infra/staging/docker-compose.yml --env-file .env.staging down
git reset --hard <good-sha>
bash infra/staging/deploy.sh
```

If migrations applied a destructive change, restore from `crm_pgdata` volume backup (if you took one) OR re-bootstrap the schema:

```bash
docker compose -f infra/staging/docker-compose.yml --env-file .env.staging down -v
# This wipes pg + redis + uploads. On `up -d` the schema baseline reloads from /docker-entrypoint-initdb.d/.
docker compose -f infra/staging/docker-compose.yml --env-file .env.staging up -d
```

(All-dev environment — re-bootstrap is acceptable.)

## TLS

- Cert path: `/etc/letsencrypt/live/crm.allcheckservices.com/{fullchain,privkey}.pem`
- Renewal: systemd timer `certbot-renew.timer` (daily check, runs `certbot renew` then `edge-reload.sh` on success)
- Reload hook sends `SIGHUP` to nginx in the edge container — no container restart
- Cert validity: 90 days, renewal triggers at <30 days remaining

## Common commands

```bash
# Stack status
docker compose -f /opt/crm-app/docker/infra/staging/docker-compose.yml \
  --env-file /opt/crm-app/docker/.env.staging ps

# Tail logs
docker compose -f /opt/crm-app/docker/infra/staging/docker-compose.yml \
  --env-file /opt/crm-app/docker/.env.staging logs -f api worker

# Shell into a container
docker compose -f /opt/crm-app/docker/infra/staging/docker-compose.yml \
  --env-file /opt/crm-app/docker/.env.staging exec api sh

# Re-run migrations only
docker compose -f /opt/crm-app/docker/infra/staging/docker-compose.yml \
  --env-file /opt/crm-app/docker/.env.staging run --rm migrate

# Restart edge after nginx config change (do NOT happen — nginx.conf is baked
# into the image; rebuild + redeploy via workflow instead).
```

## Limitations / deferrals

| Deferred | Lands in |
|---|---|
| Off-box backups, pg_dump cron, PITR | Never on staging (no real data) |
| S3 / MinIO storage | AWS branch (PR5+) |
| Managed Postgres (RDS) | AWS branch |
| Centralized logging (Loki / CloudWatch) | AWS branch |
| Prometheus `/metrics`, alerting | AWS branch |
| Image signing, SBOM, vuln scanning | AWS branch |
| Multi-replica `api` / `worker` | AWS branch (current Single-host can't scale) |
| Mobile pin migration to intermediate-CA | Prod cutover (`acscrm.allcheckservices.com`) |
