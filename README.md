# 🚀 CRM Application Monorepo (Production Ready)

[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-blue.svg)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0.15-red.svg)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org/)

## 📋 Overview

This repository contains a comprehensive CRM (Customer Relationship Management) system built as a monorepo with two main applications:

- **🔧 Backend API**: `CRM-BACKEND` - Node.js/Express + PostgreSQL + Redis
- **💻 Web Frontend**: `CRM-FRONTEND` - React 19 + Vite + TypeScript

## ✨ Features

- **Complete CRM System** with case management, client tracking, and verification workflows
- **Real-time Updates** via WebSocket connections
- **Responsive Web Design** with modern UI/UX
- **Advanced Security** with JWT authentication, role-based access control
- **Comprehensive Database** with 34+ tables and complete data relationships
- **Network Access** configured for both localhost and network IP access
- **Production Ready** with latest stable versions of all dependencies

## 🛠️ Technology Stack

### Backend

- **Node.js 22.19.0** (Latest LTS)
- **Express.js** with TypeScript
- **PostgreSQL 17.6** (Latest)
- **Redis 7.0.15** for caching and sessions
- **JWT Authentication** with refresh tokens
- **WebSocket** for real-time updates

### Frontend

- **React 19.1.1** (Latest)
- **Vite** for fast development and building
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **React Router** for navigation

## 📋 Prerequisites

- **Node.js ≥ 20** (canonical version pinned in `.nvmrc` to `20`; any Node ≥ 20 satisfies the engines floor — use `nvm use` / `fnm use` if you have a version manager, else just ensure `node --version` reports 20 or higher)
- **PostgreSQL 18**
- **Redis 7**
- **Git**

Optional (only needed if exercising PDF / Office rendition code paths locally):

- **Poppler** (`pdftohtml`) — `brew install poppler` / `apt install poppler-utils`
- **LibreOffice** — `brew install libreoffice` / `apt install libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress`

## 🚀 Quick Start

From a fresh clone:

```bash
nvm use                  # picks Node 20 from .nvmrc
npm install              # installs root + backend + frontend deps
npm run setup            # one-shot: copies .env files, creates DB, loads schema, runs migrations
npm run dev              # starts backend (:3000) + frontend (:5173) in one terminal
```

That's it. Backend health at <http://localhost:3000/health>, frontend at <http://localhost:5173>.

### Useful repo-root scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start backend + frontend together (color-coded logs) |
| `npm run dev:be` | Backend only |
| `npm run dev:fe` | Frontend only |
| `npm run db:reset` | Wipe + reload local DB from `acs_db_final_version.sql` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run lint` | Lint backend + frontend |
| `npm run typecheck` | TypeScript check backend + frontend |

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

## 🌐 Access URLs

After successful setup, access the applications at:

### Localhost Access

- **Frontend Web App**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/api/health

### Network Access (when using launcher script)

- **Frontend Web App**: http://YOUR_IP:5173
- **Backend API**: http://YOUR_IP:3000

## 🔐 Admin Account Setup

- Create a local admin account through your seed or bootstrap workflow.
- Keep credentials in local environment variables or a private password manager.
- Do not commit usernames, passwords, or seeded production-like accounts to the repository.

## 📊 Database Information

- **Database Name**: `acs_db`
- **Tables**: 34+ comprehensive tables
- **Sample Data**: Pre-loaded with users, roles, clients, and test cases
- **Admin User**: Configured and ready to use
- **Relationships**: Complete foreign key relationships and constraints

## 🏗️ Architecture

This monorepo contains three interconnected applications:

### 🔧 Backend (`CRM-BACKEND/`)

- **REST API** with comprehensive endpoints
- **WebSocket Server** for real-time updates
- **Authentication** with JWT and refresh tokens
- **Database ORM** with PostgreSQL
- **Redis Caching** for performance
- **Audit Logging** for security compliance

### 💻 Frontend (`CRM-FRONTEND/`)

- **React 19** with modern hooks and features
- **Vite** for fast development and building
- **TypeScript** for type safety
- **Tailwind CSS** for responsive design
- **React Query** for efficient data fetching
- **Real-time Updates** via WebSocket

## 🛠️ Development Scripts

### Backend Scripts

- `npm run dev` — Start in development (ts-node + nodemon)
- `npm run build && npm start` — Compile TypeScript and run Node.js
- `npm run db:generate` — Generate Prisma client
- `npm run db:migrate` — Apply Prisma migrations (development)
- `npm run db:seed` — Seed the database
- `npm run db:reset` — Reset database and re-apply migrations
- `npm run test` — Run backend tests

### Frontend Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm run lint` — Run ESLint
- `npm run type-check` — Run TypeScript checks

## 📚 Documentation

Comprehensive project documentation is organized in the `project-documentation/` directory:

- **[Project Documentation Index](project-documentation/README.md)** - Complete documentation overview
- **API Documentation** - API implementation, testing, and gap analysis reports
- **Database Reports** - Schema changes, migrations, and audit reports
- **System Reports** - Rate limiting, WebSocket, Docker, and port configuration
- **Audit Reports** - Codebase fixes, security audits, and compliance reports
- **Setup Guides** - Detailed setup instructions and troubleshooting guides

## Troubleshooting

- **Port conflicts**: Ensure ports 3000, 5173, 5174, 5432, 6379 are available
- **Database connection**: Verify PostgreSQL is running and credentials are correct
- **Redis connection**: Ensure Redis server is running on localhost:6379
- **Build errors**: Clear node_modules and reinstall dependencies

## Notes

- If Prisma type errors appear in dev, run `npm run db:generate` and restart `npm run dev`.
- Ensure PostgreSQL is reachable on `localhost:5432` and Redis on `localhost:6379`.
- PostgreSQL can be installed via Homebrew on macOS, apt on Linux, or downloaded from postgresql.org on Windows.
- For detailed setup instructions, see individual app README files and the [project documentation](project-documentation/README.md).

## 📚 Documentation

### Quick Start

- [Local Setup Guide](docs/LOCAL_SETUP.md) - Development environment setup
- [Project Documentation](project-documentation/README.md) - Complete documentation index

### Organized Documentation Structure

All project documentation has been organized into categories:

- **📊 [Comprehensive Reports](project-documentation/comprehensive-reports/)** - Major project overviews and audit reports
- **🔧 [Cleanup Scripts](project-documentation/scripts/cleanup/)** - Data maintenance and cleanup tools
- **🚀 [Deployment](project-documentation/deployment/)** - Production deployment guides
- **🗄️ [Database](project-documentation/database-reports/)** - Schema documentation and migration reports
- **🔌 [API Documentation](project-documentation/api-docs/)** - API endpoints and testing reports
- **🔍 [Audit Reports](project-documentation/audit-reports/)** - Code quality and fix reports
- **⚙️ [System Reports](project-documentation/system-reports/)** - Infrastructure and configuration
- **🚀 [Setup Guides](project-documentation/setup-guides/)** - Installation and configuration guides

### Quick Access

- **[Complete Documentation Index](project-documentation/DOCUMENTATION_INDEX.md)** - Full file listing with descriptions
- **[Cleanup Summary](project-documentation/scripts/cleanup/cleanup-summary.md)** - Recent data cleanup documentation

# Git-based deployment test - Tue Dec 2 23:50:20 IST 2025

# Git deployment test 2 - Tue Dec 2 23:52:42 IST 2025

# Final git deployment test - Wed Dec 3 00:46:31 IST 2025
