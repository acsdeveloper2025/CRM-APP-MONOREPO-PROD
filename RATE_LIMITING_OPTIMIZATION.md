# Rate Limiting Optimization for Field Agents

## Problem
Field agents processing 100+ cases per day with ~10 images each (1000+ requests) were hitting IP rate limits, causing "RATE_LIMITED: Too many requests from this IP, please try again later" errors.

## Solution
Updated rate limiting configuration to be extremely generous for all authenticated users, especially field agents.

## Changes Made

### 1. Updated Rate Limiter Core Logic (`CRM-BACKEND/src/middleware/rateLimiter.ts`)
- **Before**: Only skipped rate limiting for SUPER_ADMIN and ADMIN users
- **After**: Skips rate limiting for ALL authenticated users (SUPER_ADMIN, ADMIN, BACKEND_USER, FIELD_AGENT)
- **Benefit**: Prevents rate limiting issues for field agents processing high volumes

### 2. Increased Rate Limits Across All Endpoints
- **General API**: 5000 requests per 15 minutes (increased from 500)
- **File Upload**: 200 uploads per minute (increased from 50)
- **Case Operations**: 500 requests per minute (increased from 100)
- **Geolocation**: 100 requests per minute (increased from 20)
- **Auth Endpoints**: 10 attempts per 15 minutes (increased from 5)

### 3. Mobile-Specific Rate Limiting (`CRM-BACKEND/src/routes/mobile.ts`)
- **Before**: Rate limiting was disabled for testing
- **After**: Enabled with generous limits: 10,000 requests per 15 minutes
- **Benefit**: Allows field agents to process cases without hitting limits

### 4. Enterprise Rate Limits (`CRM-BACKEND/src/middleware/enterpriseRateLimit.ts`)
- **FIELD_AGENT**: 10,000 requests per 15 minutes (increased from 1,500)
- **Benefit**: Supports high-volume mobile operations

### 5. Configuration Updates (`CRM-BACKEND/src/config/index.ts`)
- **Default Rate Limit**: 5000 requests per 15 minutes (increased from 500)
- **Benefit**: Higher baseline for all operations

## Expected Impact

### For Field Agents Processing 100+ Cases/Day:
- **Before**: ~1000+ requests would hit rate limits
- **After**: 10,000 requests allowed per 15 minutes = 40,000+ requests per hour
- **Result**: No more rate limiting errors for normal field operations

### For All User Types:
- **SUPER_ADMIN**: No rate limiting (as before)
- **ADMIN**: No rate limiting (as before)  
- **BACKEND_USER**: No rate limiting (new)
- **FIELD_AGENT**: No rate limiting (new)
- **Unauthenticated**: Still rate limited for security

## Security Considerations
- Rate limiting is still applied to unauthenticated requests
- Authentication endpoints still have reasonable limits to prevent brute force
- Only authenticated users with valid JWT tokens bypass rate limits
- Dev token handling remains secure

## Testing Recommendations
1. Test field agent workflow with 100+ case submissions
2. Verify no rate limiting errors occur during high-volume operations
3. Confirm unauthenticated requests are still rate limited
4. Test mobile app performance with multiple concurrent users

## Monitoring
- Monitor server performance with increased rate limits
- Track request volumes per user type
- Watch for any abuse patterns from authenticated users
- Consider implementing user-specific rate limiting if needed

## Rollback Plan
If issues occur, rate limits can be reduced by:
1. Reverting `skipForAllUsers` to `skipForAdmins` only
2. Reducing the numerical limits in each rate limiter
3. Re-enabling mobile rate limiting with lower limits
