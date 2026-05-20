# 🚀 CRM Application Monorepo

[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue.svg)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://typescriptlang.org/)

CRM (Customer Relationship Management) platform for field-execution workflows: case management, client tracking, verification capture, PDF report generation, push notifications. Deployed at <https://crm.allcheckservices.com>.

## Workspaces

- **`CRM-BACKEND/`** — Node.js + Express 5 + TypeScript REST API. PostgreSQL via `pg`. Redis (cache, BullMQ, Socket.IO pub/sub, rate-limit). Puppeteer + Poppler + LibreOffice for PDF/Office rendering. Socket.IO for realtime. JWT auth + TOTP MFA. Three queue workers (audit-log, notification, reverse-geocode).
- **`CRM-FRONTEND/`** — React 19 + Vite 7 + TypeScript SPA. Tailwind + shadcn/ui. TanStack Query. Socket.IO client. Served as static `dist/` behind nginx in production.

The companion mobile app (`crm-mobile-native`, React Native) lives in a separate repository and consumes this backend.

## Prerequisites

- **Node.js ≥ 20** (canonical version pinned in `.nvmrc` to `20`; use `nvm use` / `fnm use` if you have a version manager)
- **PostgreSQL 17**
- **Redis 7**
- **Git**

Optional (only needed if exercising PDF / Office rendition paths locally):

- **Poppler** (`pdftohtml`) — `brew install poppler` / `apt install poppler-utils`
- **LibreOffice** — `brew install libreoffice` / `apt install libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress`

## Quick start

From a fresh clone:

```bash
nvm use                  # picks Node 20 from .nvmrc
npm install              # installs root + backend + frontend deps
npm run setup            # one-shot: copies .env files, creates DB, loads schema, runs migrations
npm run dev              # starts backend (:3000) + frontend (:5173) in one terminal
```

Backend health: <http://localhost:3000/health>. Frontend: <http://localhost:5173>.

Prefer Docker for local dev? See **[`docs/local-docker.md`](docs/local-docker.md)** — `docker compose up` brings up Postgres + Redis (the 80% pain reliever), or `docker compose --profile full up` runs the whole stack inside Docker.

### Useful repo-root scripts

| Command | What it does |
|---|---|
| `npm run dev` | Backend + frontend together (color-coded logs) |
| `npm run dev:be` / `npm run dev:fe` | One side only |
| `npm run db:reset` | Wipe + reload local DB from `acs_db_final_version.sql` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run lint` / `npm run typecheck` | Code quality gates across BE + FE |

### Manual setup (if `npm run setup` fails)

```bash
cd CRM-BACKEND
cp .env.example .env       # edit DATABASE_URL, REDIS_URL as needed
npm run db:reset-local
npm run migrate
cd ../CRM-FRONTEND
cp .env.example .env       # edit VITE_API_BASE_URL if backend is on a non-default host
cd ..
npm run dev
```

## Architecture

```
                  ┌─────────────┐
                  │   Browser   │
                  └──────┬──────┘
                         │ HTTPS
                  ┌──────▼──────┐
       ┌──────────│    edge     │  nginx + TLS + static FE + reverse proxy
       │          └──────┬──────┘
       │     /api        │      /socket.io
       │                 ▼
       │          ┌─────────────┐         ┌─────────────┐
       │          │     api     │◄────────│   worker    │
       │          │ ROLE=api    │  Redis  │ ROLE=worker │
       │          │ HTTP+WS     │  (pub/  │ BullMQ ×3   │
       │          │             │   sub)  │ intervals   │
       │          └──────┬──────┘         └──────┬──────┘
       │                 │                       │
       │          ┌──────▼───────────────────────▼──────┐
       │          │           postgres + redis           │
       │          └──────────────────────────────────────┘
       │
       └─→ /uploads → api → storage (local volume → S3 on AWS)
```

- **`api`** serves HTTP requests + Socket.IO. No background work — keeps the request path responsive.
- **`worker`** drains the three BullMQ queues (audit-log, notification, reverse-geocode) + runs interval jobs (DB maintenance, metrics cleanup). Push delivery (FCM, APNS) lives here.
- Same Docker image runs as either, gated by the `ROLE` env var. `ROLE=all` (the default) preserves native-dev behaviour.

## Documentation

Local-facing docs live in **`docs/`**:

| File | What |
|---|---|
| **[docs/local-docker.md](docs/local-docker.md)** | Local Docker setup — daily commands, profiles, hot reload, troubleshooting |
| **[docs/staging.md](docs/staging.md)** | Staging deploy runbook — bootstrap, redeploy, rollback, TLS |
| **[docs/postgres-upgrade-runbook.md](docs/postgres-upgrade-runbook.md)** | PG major-version upgrade procedure |
| **[docs/aws-migration-notes.md](docs/aws-migration-notes.md)** | Parking lot for the future AWS sprint |
| **[docs/SECURITY.md](docs/SECURITY.md)** | Security guidelines |
| **[docs/API_CATALOG.md](docs/API_CATALOG.md)** | API endpoint catalog |
| **[CRM-FRONTEND/README.md](CRM-FRONTEND/README.md)** | Frontend-specific notes (HTTP client policy, etc.) |

## Deployment

`main` branch auto-deploys to staging via `.github/workflows/staging-deploy.yml`:

1. Builds api + edge Docker images, tagged `:<sha>` + `:latest`
2. Pushes to GitHub Container Registry (`ghcr.io/acsdeveloper2025/`)
3. SSHes into the staging box, runs `infra/staging/deploy.sh`
4. Smoke-tests `https://crm.allcheckservices.com/_edge_health`

Manual trigger: `gh workflow run staging-deploy --ref main`.
Rollback to any past commit: `gh workflow run staging-deploy --ref main -f image_tag=<sha>`.

Future AWS work lives on the `aws` branch — see [`docs/aws-migration-notes.md`](docs/aws-migration-notes.md).

## Troubleshooting

- **Port already in use**: ensure `3000` (BE), `3001` (worker probe), `5173` (FE), `5432` (Postgres), `6379` (Redis) are free.
- **`npm run setup` fails on DB connect**: verify Postgres is running and that your `CRM-BACKEND/.env` matches: a role + password that can connect to a database named `acs_db`.
- **Redis connection refused**: `brew services start redis` (macOS) or `systemctl start redis-server` (Linux).
- **Build errors after dep changes**: `rm -rf */node_modules && npm install`.
- **Docker stack on macOS won't build**: ensure `docker-buildx` plugin is installed (`brew install docker-buildx`) — without it, multi-stage `--target` builds OOM during tsc. See [docs/local-docker.md](docs/local-docker.md).
- **Migrations failed**: `npm run db:reset` resets the DB to the schema baseline and re-applies migrations cleanly.
