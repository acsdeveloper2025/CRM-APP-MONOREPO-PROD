# Local Development Setup (No Docker)

This guide explains how to run the CRM app locally without Docker. You will run PostgreSQL, Redis, and the Node.js backend directly on your machine.

## Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL 14+
- Redis 7+

## Overview

- Backend API: crm-backend (Express + PostgreSQL)
- Database: PostgreSQL on localhost:5432 (database: acs_db)
- Cache/Queue: Redis on localhost:6379
- Frontend (optional): crm-frontend hitting http://localhost:3000

## 1) Install PostgreSQL

### Windows (Developer/Express)
1. Download SQL Server Developer or Express from Microsoft
2. Install and enable TCP/IP via SQL Server Configuration Manager
3. Ensure the service listens on port 1433
4. Create database:
   - With SSMS: New Database -> acs_backend
   - Or run: `CREATE DATABASE acs_backend;`

### macOS
- Option A (recommended): Use a remote SQL Server (on Windows/Linux) and point DATABASE_URL to it
- Option B: Azure SQL Edge via Docker is typical; if Docker is disallowed, use a Windows VM/Parallels for SQL Server

### Linux (Ubuntu/Debian)
1. Install SQL Server (2019+): https://learn.microsoft.com/sql/linux/quickstart-install-connect-ubuntu
2. Enable TCP 1433
3. Create the database: `CREATE DATABASE acs_backend;`

## 2) Install Redis

- Windows: Use Memurai or recent Redis for Windows builds, or WSL Ubuntu `sudo apt install redis-server`
- macOS: `brew install redis` then `brew services start redis`
- Linux: `sudo apt install redis-server` then `sudo systemctl enable --now redis-server`

Verify: `redis-cli PING` -> PONG

## 3) Configure backend environment

From repository root:

```bash
cd CRM-BACKEND
cp .env.example .env
# Edit .env if needed
```

Ensure these values:

```ini
PORT=3000
DATABASE_URL="postgresql://acs_user:acs_password@localhost:5432/acs_db"
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret
JWT_REFRESH_SECRET=dev-refresh-secret
```

## 4) Install dependencies and initialize DB

```bash
cd CRM-BACKEND
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

If you see an old failed migration named `_`, resolve it and retry:

```bash
npx prisma migrate resolve --rolled-back "_"
npm run db:migrate
```

## 5) Run the backend

- Dev mode (ts-node + nodemon):
```bash
npm run dev
```
- Production-like run:
```bash
npm run build && npm start
```

Check health: http://localhost:3000/health

## 6) Run the frontend (optional)

```bash
cd ../CRM-FRONTEND
cp .env.example .env.local
# Set VITE_API_URL and VITE_WS_URL to http://localhost:3000
npm install
npm run dev
```

## Troubleshooting

- Prisma types mismatch in dev
  - Run `npm run db:generate`
  - Restart `npm run dev`
- Migration failures
  - Ensure PostgreSQL reachable on 5432
  - Check database credentials and permissions
- Redis connection errors
  - Confirm `redis-cli PING` returns PONG
- Permission/ports
  - On Windows, allow SQL Server through firewall and enable TCP/IP

## Screenshots/Commands

- Windows: Download PostgreSQL from postgresql.org; Redis from GitHub releases
- macOS: Install via Homebrew: `brew install postgresql redis`
- Linux: Install via package manager: `apt install postgresql redis-server`

