# CRM Frontend

React 19 + Vite 7 + TypeScript SPA for the ACS Check Services CRM. Served to operators on `https://crm.allcheckservices.com`.

## Setup

This is a workspace inside the [monorepo](../README.md). Use the root scripts:

```bash
# from repo root
npm install
npm run setup          # one-shot: env, DB, migrations
npm run dev            # backend + frontend together
```

To run only the frontend (assumes backend is reachable):

```bash
npm --prefix CRM-FRONTEND run dev          # http://localhost:5173
```

Build / typecheck / lint:

```bash
npm --prefix CRM-FRONTEND run build
npm --prefix CRM-FRONTEND run type-check
npm --prefix CRM-FRONTEND run lint
```

## Environment

Copy `.env.example` → `.env`. Three baked variables (Vite bakes them at build time):

| Var | What |
|---|---|
| `VITE_API_BASE_URL` | Backend HTTP origin + `/api`. `http://localhost:3000/api` in dev. |
| `VITE_API_TIMEOUT` | Axios timeout in ms (30000 default). |
| `VITE_GOOGLE_MAPS_API_KEY` | Maps JS API key. IP-restricted in Google Cloud Console. |

## HTTP Client Policy

**All network requests must go through `src/services/api.ts`.**

Direct usage of `fetch`, `axios.create`, or `new Axios` is prohibited in components and other services.

This ensures:

- Consistent authentication (token refresh)
- Centralized error handling
- Caching and metrics
- Unified retry logic
- Tenant scope-header injection

### Enforcement

- **`axios.create` / `new Axios`**: **Error**. The build will fail.
- **`fetch`**: **Warning**. Existing usages should refactor to `apiService` over time.

Carve-outs documented in `src/services/api.ts`.

## Tech stack

- React 19, Vite 7, TypeScript 5
- React Router 6
- React Hook Form + Zod
- TanStack Query (caching + mutation invalidation via `useStandardizedMutation`)
- Tailwind + shadcn/ui + lucide-react + sonner
- Socket.IO client for realtime updates
- OpenTelemetry browser SDK (opt-in via env)

## Production

Built to static `dist/` by `vite build`. In staging, the build is baked into the `edge` Docker image (`infra/Dockerfile.fe` `runtime` target) served by nginx behind TLS. See [`docs/staging.md`](../docs/staging.md).
