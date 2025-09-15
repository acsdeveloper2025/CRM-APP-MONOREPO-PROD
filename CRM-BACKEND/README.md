# CRM Application (ACS) — Local Development (No Docker)

This repository contains a multi-app CRM stack:

- Backend API: `crm-backend` (Node.js/Express + PostgreSQL + Redis)
- Web Frontend: `crm-frontend` (React + Vite + TypeScript)
- Mobile App: `caseflow-mobile` (React Native/Capacitor)

Docker is no longer required for local development. Run all services directly on your machine.

## Prerequisites

- Node.js 18+
- npm 9+ (or Yarn/PNPM)
- PostgreSQL 14+
- Redis 7+

## Quick Start

### 1) Backend API (crm-backend)

```bash
cd CRM-BACKEND
npm install
cp .env.example .env
# Ensure DATABASE_URL points to your local SQL Server (localhost:1433)
# Ensure REDIS_URL is redis://localhost:6379

# Initialize database
npm run db:generate
npm run db:migrate
npm run db:seed

# Start the server
npm run dev        # for development (nodemon)
# or
npm run build && npm start   # for a compiled run
```

Health check: http://localhost:3000/health

### 2) Web Frontend (crm-frontend)

```bash
cd CRM-FRONTEND
npm install
cp .env.example .env.local
# Set VITE_API_URL and VITE_WS_URL to http://localhost:3000
npm run dev
```

Frontend will be available at http://localhost:5173.

## Detailed Local Setup (SQL Server, Redis, Troubleshooting)

See the step-by-step guide with OS-specific notes:

- docs/LOCAL_SETUP.md

## Useful backend scripts

- `npm run dev` — start in development (ts-node + nodemon)
- `npm run build && npm start` — compile TypeScript and run Node.js
- `npm run db:generate` — generate Prisma client
- `npm run db:migrate` — apply Prisma migrations (development)
- `npm run db:seed` — seed the database
- `npm run db:reset` — reset database and re-apply migrations
- `npm run test` — run backend tests

## Notes

- If Prisma type errors appear in dev, run `npm run db:generate` and restart `npm run dev`.
- Ensure SQL Server is reachable on `localhost:1433` and Redis on `localhost:6379`.
- For macOS where local SQL Server is not available, use a remote SQL Server and update `DATABASE_URL` accordingly.

