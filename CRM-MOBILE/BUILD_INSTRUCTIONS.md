# CaseFlow Mobile - Build Instructions

## Overview

The mobile app can be built for two different deployment targets:

1. **Web Deployment** - For accessing via browser at `https://crm.allcheckservices.com/mobile/`
2. **APK Build** - For native Android app installation

## Build Commands

### For Web Deployment (Production Server)

```bash
npm run build:web
```

This command:
- Uses `.env.production.web` configuration
- Sets `VITE_BUILD_TARGET=web`
- Builds with `base: '/mobile/'` path
- Assets are referenced as `/mobile/assets/...`
- Deployed to production server and served via nginx at `/mobile/` route

### For APK Build (Native App)

```bash
npm run build:apk
```

This command:
- Uses `.env.production.apk` configuration
- Sets `VITE_BUILD_TARGET=apk`
- Builds with `base: '/'` path
- Assets are referenced as `/assets/...`
- Used for Capacitor APK generation

### For Development

```bash
npm run dev
```

This command:
- Uses `.env` configuration (default)
- Runs on `http://localhost:5180`
- Hot reload enabled
- Uses `base: '/'` path

## Environment Files

### `.env` (Development)
- Used for local development
- `VITE_BUILD_TARGET=apk` (default)
- API points to localhost

### `.env.production.web` (Web Deployment)
- Used for production web deployment
- `VITE_BUILD_TARGET=web` (required)
- API points to production server
- Base path: `/mobile/`

### `.env.production.apk` (APK Build)
- Used for APK builds
- `VITE_BUILD_TARGET=apk` (required)
- API points to production server
- Base path: `/`

## Deployment Workflow

### Web Deployment to Production Server

1. **Build for web:**
   ```bash
   npm run build:web
   ```

2. **Deploy to production:**
   ```bash
   # Copy dist folder to production server
   scp -r dist/* root@49.50.119.155:/opt/crm-app/current/CRM-MOBILE/dist/
   
   # Or use the deployment script
   npm run deploy:prod
   ```

3. **Restart PM2:**
   ```bash
   ssh root@49.50.119.155 "pm2 restart crm-mobile"
   ```

4. **Access:**
   - URL: https://crm.allcheckservices.com/mobile/
   - For testing only (not for production field agents)

### APK Build for Native App

1. **Build for APK:**
   ```bash
   npm run build:apk
   ```

2. **Sync with Capacitor:**
   ```bash
   npx cap sync android
   ```

3. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

4. **Build APK in Android Studio:**
   - Build > Build Bundle(s) / APK(s) > Build APK(s)
   - APK location: `android/app/build/outputs/apk/release/`

5. **Distribute:**
   - Upload APK to distribution platform
   - Field agents install on their devices

## Important Notes

### ⚠️ Production Access

- **Web version** (`/mobile/`): For testing purposes only
- **APK version**: For production use by field agents
- Field agents should ONLY use the native APK, not the web version

### 🔧 Configuration

The `vite.config.ts` automatically selects the correct base path:

```typescript
const buildTarget = env.VITE_BUILD_TARGET || 'apk';
const baseUrl = isProduction && buildTarget === 'web' ? '/mobile/' : '/';
```

### 📝 Build Target Selection

| Build Type | Command | Base Path | Use Case |
|------------|---------|-----------|----------|
| Development | `npm run dev` | `/` | Local development |
| Web Production | `npm run build:web` | `/mobile/` | Web deployment |
| APK Production | `npm run build:apk` | `/` | Native app |

## Troubleshooting

### Assets not loading on web deployment

**Problem:** Assets return 404 when accessing `/mobile/`

**Solution:** Make sure you built with `npm run build:web`, not `npm run build`

### APK shows blank screen

**Problem:** APK loads but shows blank screen

**Solution:** Make sure you built with `npm run build:apk`, not `npm run build:web`

### Wrong API endpoint

**Problem:** App connects to wrong API server

**Solution:** Check the `.env.production.web` or `.env.production.apk` file has correct `VITE_API_BASE_URL`

## Quick Reference

```bash
# Development
npm run dev                    # Start dev server

# Production Web
npm run build:web              # Build for web deployment
npm run preview:network        # Preview production build

# Production APK
npm run build:apk              # Build for APK
npx cap sync android           # Sync with Capacitor
npx cap open android           # Open in Android Studio
```

