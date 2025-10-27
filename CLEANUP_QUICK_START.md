# Quick Start - Case Data Cleanup
## Fast Reference Guide

---

## ⚡ Quick Commands

### Clean All Case Data
```bash
cd CRM-BACKEND
npm run clean-and-seed
```

### Verify Cleanup
```bash
cd CRM-BACKEND
npm run verify-cleanup
```

### Check Database
```bash
psql -U acs_user -d acs_db -c "SELECT COUNT(*) FROM cases;"
```

### Check Redis
```bash
redis-cli KEYS "case:*"
redis-cli KEYS "task:*"
redis-cli KEYS "form:*"
```

---

## 📊 What Gets Deleted

### Database Tables
- cases (15 rows)
- verification_tasks (24 rows)
- verification_attachments (18 rows)
- form_submissions (0 rows)
- task_form_submissions (0 rows)
- case_status_history (0 rows)

### Redis Keys
- case:* (all case keys)
- task:* (all task keys)
- form:* (all form keys)
- bull:case-assignment:* (queue data)

### Caches
- Mobile app cache (clears on next sync)
- Frontend cache (clears on next refresh)

---

## ✅ What Stays

- Users and roles
- Clients
- Products
- Verification Types
- Rate Types
- Pincodes
- Cities
- Document Types
- All configuration

---

## 🔄 Full Cleanup Workflow

```bash
# 1. Run cleanup
cd CRM-BACKEND
npm run clean-and-seed

# 2. Verify cleanup
npm run verify-cleanup

# 3. Check results
# Should see: ✅ ALL SYSTEMS CLEAN - Ready for fresh data!

# 4. Restart services (optional)
npm run dev
```

---

## 📋 Cleanup Status

### After Running Cleanup

```
Database: ✅ CLEAN (0 cases, 0 tasks)
Redis: ✅ CLEAN (0 case keys)
Mobile: ✅ READY (cache clears on sync)
Frontend: ✅ READY (cache clears on refresh)
```

---

## 🛠️ Scripts

### clean-and-seed
- **Location:** `CRM-BACKEND/scripts/clean-and-seed-cases.js`
- **Purpose:** Remove all case data
- **Command:** `npm run clean-and-seed`

### verify-cleanup
- **Location:** `CRM-BACKEND/scripts/verify-cleanup.js`
- **Purpose:** Verify cleanup was successful
- **Command:** `npm run verify-cleanup`

---

## 🚀 After Cleanup

1. ✅ Database is clean
2. ✅ Redis is clean
3. ✅ Ready for fresh data
4. ✅ Start creating new cases

---

## ⚠️ Troubleshooting

### Database Connection Error
```bash
# Check connection
psql -U acs_user -d acs_db -c "SELECT 1;"

# Check .env file
cat CRM-BACKEND/.env | grep DATABASE_URL
```

### Redis Connection Error
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check .env file
cat CRM-BACKEND/.env | grep REDIS_URL
```

### Cleanup Incomplete
```bash
# Run cleanup again
npm run clean-and-seed

# Verify again
npm run verify-cleanup
```

---

## 📞 Need Help?

1. Check CLEANUP_COMPLETE.md for detailed info
2. Check CLEANUP_REPORT.md for cleanup results
3. Run verify-cleanup to check status
4. Check error logs

---

**Status:** ✅ COMPLETE  
**Date:** 2025-10-27

