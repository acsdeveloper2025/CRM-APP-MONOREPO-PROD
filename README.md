# 🚀 CRM Application Monorepo (Production Ready)

[![Node.js](https://img.shields.io/badge/Node.js-22.19.0-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17.6-blue.svg)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0.15-red.svg)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org/)

## 📋 Overview

This repository contains a comprehensive CRM (Customer Relationship Management) system built as a monorepo with three main applications:

- **🔧 Backend API**: `CRM-BACKEND` - Node.js/Express + PostgreSQL + Redis
- **💻 Web Frontend**: `CRM-FRONTEND` - React 19 + Vite + TypeScript
- **📱 Mobile App**: `CRM-MOBILE` - React Native/Capacitor hybrid app

## ✨ Features

- **Complete CRM System** with case management, client tracking, and verification workflows
- **Real-time Updates** via WebSocket connections
- **Mobile-First Design** with responsive web and native mobile apps
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

### Mobile
- **React 18.2.0** (React Native compatible)
- **Capacitor** for native functionality
- **Ionic Components** for mobile UI
- **Cross-platform** (iOS/Android/Web)

## 📋 Prerequisites

- **Node.js 22.19.0+** (Latest LTS)
- **npm 10.9.3+** (Latest)
- **PostgreSQL 17.6+** (Latest)
- **Redis 7.0.15+** (Latest)
- **Git** for version control

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

Use the comprehensive launcher script that handles everything automatically:

```bash
# Clone the repository
git clone https://github.com/acsdeveloper2025/CRM-APP-MONOREPO-PROD.git
cd CRM-APP-MONOREPO-PROD

# Make the launcher executable
chmod +x crm-network-launcher.sh

# Run the automated setup and launch
./crm-network-launcher.sh
```

This script will:
- ✅ Check and install all dependencies
- ✅ Configure network access (localhost + IP)
- ✅ Set up database connections
- ✅ Start all three applications simultaneously
- ✅ Configure CORS and WebSocket origins
- ✅ Provide access URLs for all services

### Option 2: Manual Setup

#### 1. Database Setup

```bash
# Import the complete database
sudo -u postgres psql -d acs_db -f crm_database_complete.sql

# Or use the import script
cd scripts
./import_database.sh acs_db example_db_user localhost 5432
```

#### 2. Backend API Setup

```bash
cd CRM-BACKEND
npm install
cp .env.example .env

# Configure your .env file:
# DATABASE_URL="postgresql://example_db_user:example_db_password@localhost:5432/acs_db"
# REDIS_URL="redis://localhost:6379"

npm run dev
```

#### 3. Frontend Web App Setup

```bash
cd CRM-FRONTEND
npm install
cp .env.example .env

# Configure your .env file:
# VITE_API_URL="http://localhost:3000/api"
# VITE_WS_URL="ws://localhost:3001"

npm run dev
```

#### 4. Mobile App Setup

```bash
cd CRM-MOBILE
npm install --legacy-peer-deps
cp .env.example .env

# Configure your .env file:
# VITE_API_URL="http://localhost:3000/api"

npm run dev
```

## 🌐 Access URLs

After successful setup, access the applications at:

### Localhost Access
- **Frontend Web App**: http://localhost:5173
- **Mobile Web App**: http://localhost:5180
- **Backend API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/api/health

### Network Access (when using launcher script)
- **Frontend Web App**: http://YOUR_IP:5173
- **Mobile Web App**: http://YOUR_IP:5180
- **Backend API**: http://YOUR_IP:3000

## 🔐 Default Admin Credentials

- **Username**: `admin`
- **Password**: `CHANGE_ME_PASSWORD`
- **Role**: `SUPER_ADMIN`
- **Email**: `admin@example.com`

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

### 📱 Mobile (`CRM-MOBILE/`)
- **Capacitor** for native functionality
- **React** for consistent development experience
- **Cross-platform** deployment (iOS/Android/Web)
- **Offline Capabilities** for field work
- **Native Device Features** (camera, GPS, etc.)

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

### Mobile Scripts
- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run android` — Build and run on Android
- `npm run ios` — Build and run on iOS
- `npm run capacitor:sync` — Sync Capacitor plugins

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

# Git-based deployment test - Tue Dec  2 23:50:20 IST 2025
# Git deployment test 2 - Tue Dec  2 23:52:42 IST 2025
# Final git deployment test - Wed Dec  3 00:46:31 IST 2025
