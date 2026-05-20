# Local Docker (development)

PR3 of the Docker migration. Two ways to run the CRM stack locally:

1. **Native** (PR1) — `npm run dev` on the host. Fast iteration, native tooling.
2. **Docker** (this doc) — `docker compose up`. Consistent environment, zero local install of Postgres/Redis/Chromium/LibreOffice.

You can switch between them at will. They produce the same `acs_db` schema and serve on the same host ports (`:3000`, `:5173`).

---

## Quick start (just Postgres + Redis in Docker)

Best for most devs. Containerized DBs, host-side Node:

```bash
docker compose up -d              # starts postgres + redis only
npm run setup                     # one-shot bootstrap (idempotent)
npm run dev                       # BE :3000 + FE :5173 on host
```

Stop with `docker compose down`. Wipe state with `docker compose down -v`.

---

## Full stack in containers

Slower first boot (image build pulls Chromium + LibreOffice — ~1 GB). Use when:

- You don't want Node / native binaries on the host.
- You're testing the actual container topology end-to-end.
- You want to repro a Docker-only bug.

```bash
docker compose --profile full up --build
```

Brings up six containers:

| Container | Purpose | Host port |
|---|---|---|
| `crm_postgres` | Postgres 18 | `5432` |
| `crm_redis` | Redis 7 (AOF on, `noeviction`) | `6379` |
| `crm_migrate` | One-shot — runs pending migrations then exits 0. `api`+`worker` won't start until it does. | — |
| `crm_api` | Backend, `ROLE=api` (HTTP + Socket.IO, no workers) | `3000` |
| `crm_worker` | Backend, `ROLE=worker` (BullMQ + intervals, no HTTP). Health probe on `3001`. | `3001` |
| `crm_fe` | Vite dev server (HMR) | `5173` |

Hot reload works for both BE and FE — `CRM-BACKEND/src` and `CRM-FRONTEND/src` are bind-mounted. Edit a file, container restarts in ~3 s.

### Useful commands

```bash
# Tail logs (one or all services)
docker compose logs -f api
docker compose logs -f api worker

# Open a shell in a running container
docker compose exec api sh

# Rebuild after Dockerfile / dependency changes
docker compose --profile full up --build

# Reset everything (drops Postgres + Redis state, keeps uploads on host)
docker compose down -v

# Re-run migrations against an already-running stack
docker compose run --rm migrate
```

### Reading the role

Each backend container logs its role on boot:

```
🚀 [LOADED] src/index.ts IS RUNNING! role=api
🚀 [LOADED] src/index.ts IS RUNNING! role=worker
```

`ROLE=all` is the default when unset — only used by native dev. Containers explicitly set `ROLE` via `environment:` in compose.

---

## What's inside the image

`infra/Dockerfile.api` is multi-stage:

- `base` — `node:20-bookworm-slim` + Chromium + Poppler (`pdftohtml`) + LibreOffice (headless writer/calc/impress) + fonts (`liberation`, `noto`, `noto-cjk`, `dejavu`). `TZ=Asia/Kolkata`. Non-root `node` user.
- `deps` — full `npm ci` (prod + dev).
- `build` — `tsc → dist/`.
- `runtime` — slim. Prod deps + compiled `dist` + raw `migrations/`. Used by staging (PR4).
- `dev` — full deps + source + `ts-node-dev`. Used by local compose AND by the `migrate` service in every environment (migrations are `.ts`, ts-node is a devDep).

`infra/Dockerfile.fe` is similarly two-target:

- `dev` — `vite --host 0.0.0.0 --port 5173`. HMR via bind-mount.
- `runtime` — `nginx:alpine` + built static `dist/`. Used by staging `edge` container.

Both use the **repo root** as build context so the Dockerfile can `COPY CRM-BACKEND/...` / `COPY CRM-FRONTEND/...` directly.

---

## Environment & secrets

Compose injects DB / Redis URLs via `environment:` (pointing at container DNS like `postgres:5432`) and loads everything else from `CRM-BACKEND/.env` / `CRM-FRONTEND/.env` via `env_file:`. The host's `.env` files keep working unchanged — Compose just overrides the connection strings.

No secrets are baked into the images. Staging (PR4) will switch to Docker secrets for sensitive values; for local dev, `.env` is fine.

---

## Volumes

| Volume | Lifecycle | Behaviour |
|---|---|---|
| `crm_pgdata` | named volume | Persists Postgres data across restarts. Wiped on `down -v`. |
| `crm_redisdata` | named volume | Persists Redis AOF across restarts. Wiped on `down -v`. |
| `./CRM-BACKEND/uploads` | bind-mount | Generated files visible on host. Survives everything except manual `rm`. |
| `./CRM-BACKEND/src` etc. | bind-mounts | Live source for hot reload. |

---

## Troubleshooting

**Image build is slow on first run.** Expected (~3-5 min). Chromium + LibreOffice are heavy. Subsequent builds hit the layer cache and finish in seconds unless `package.json` changed.

**Port already in use.** Either stop the conflicting service or remove the `ports:` mapping from the relevant service and use `docker compose exec <svc> wget …` for internal access.

**Schema dump not loading.** Postgres only runs `/docker-entrypoint-initdb.d/*` on **first run** (when the data volume is empty). To force a reload: `docker compose down -v` first.

**Migrations failed in `migrate` container.** Read `docker compose logs migrate`. The schema-migrations checksum guard catches drift between repo and DB — investigate the specific failing file. `api` + `worker` will not start until `migrate` exits 0.

**Worker health probe `:3001` not responding.** Check `docker compose logs worker` for the line `Worker health probe listening on :3001/health`. If absent, the container probably crashed during BullMQ init — usually a Redis-not-ready race resolved by `docker compose down && up`.

**File uploads not visible on host.** Check the bind-mount is mounted correctly: `docker compose exec api ls /app/uploads`. The host path `./CRM-BACKEND/uploads/` is the same directory.

**HMR not triggering in FE container.** Vite HMR uses WebSocket on `:5173`. If you're behind a corporate proxy that strips WS upgrade headers, switch back to native `npm run dev` for FE.

---

## Limitations (intentional)

- **No `edge` / nginx in dev.** TLS isn't needed locally; vite dev server speaks HTTP directly and the BE exposes `:3000` to host. Edge appears in PR4 staging.
- **No TLS, no certbot.** Local dev only.
- **`STORAGE_BACKEND=local` only.** S3 / MinIO comes with the AWS branch (PR5+).
- **No mobile app in compose.** Mobile is a separate React Native app, shipped via APK/AAB. Not containerizable.
