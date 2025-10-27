# Multi-Task Architecture Audit Report
**Date:** 2025-10-27  
**Issue:** Submitted cases reverting to "Assigned" status after user re-login  
**Root Cause:** Mobile app uses case-level status instead of task-level status for tab filtering

---

## Executive Summary

The CRM system has a **multi-task architecture** where:
- Each case can have multiple verification tasks
- Each task has its own status (PENDING, ASSIGNED, IN_PROGRESS, COMPLETED)
- Case status should be **calculated** from all task statuses, not stored independently

**Current Problem:**
- Mobile app filters tabs by `case.status` (ASSIGNED, IN_PROGRESS, COMPLETED)
- Backend API returns `task_status` in the response (line 262 of mobileCaseController.ts)
- But mobile app **ignores** task_status and uses case.status instead
- When a task is completed, backend correctly updates task status and recalculates case status
- However, mobile app stores and syncs case status locally
- On re-login, mobile app fetches cases and filters by case.status, which may not reflect the user's specific task status

---

## Phase 1: Comprehensive Audit Results

### 1.1 CRM-BACKEND Audit

#### ✅ CORRECT: Backend Task Status Management

**File:** `CRM-BACKEND/src/controllers/mobileFormController.ts`

**Lines 43-80:** `updateCaseStatusBasedOnTasks()` function
- ✅ Correctly calculates case status from ALL task statuses
- ✅ Case is COMPLETED only when ALL tasks are COMPLETED or CANCELLED
- ✅ Called after every form submission (9 verification types)

**Lines 2083-2092:** Residence verification submission
```typescript
// Update verification task status to COMPLETED
await query(`
  UPDATE verification_tasks
  SET status = 'COMPLETED',
      completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = $1
`, [verificationTaskId]);

// Update case status based on ALL tasks
await MobileFormController.updateCaseStatusBasedOnTasks(actualCaseId);
```
✅ This pattern is correctly implemented in all 9 form submission endpoints

#### ✅ CORRECT: Backend API Response

**File:** `CRM-BACKEND/src/controllers/mobileCaseController.ts`

**Lines 260-262:** Mobile cases API response
```typescript
// CRITICAL FIX: Use task-level status instead of case-level status for field agents
status: caseItem.task_status ? caseItem.task_status.toUpperCase().replace(/\s+/g, '_') : 'ASSIGNED',
```
✅ Backend correctly returns **task status** in the API response

**Lines 185-203:** SQL query includes task status
```sql
LEFT JOIN LATERAL (
  SELECT vt.id, vt.task_number, vt.address, vt.trigger, vt.priority,
         vt.status as task_status, vt.completed_at as task_completed_at,
         ...
  FROM verification_tasks vt
  WHERE vt.case_id = c.id
  AND (
    $taskFilterParamIndex::uuid IS NULL  -- For non-field-agents
    OR vt.assigned_to = $taskFilterParamIndex::uuid  -- For field agents
  )
  LIMIT 1
) vtask ON true
```
✅ Backend correctly fetches task status for the user's assigned task

#### ❌ PROBLEM: Some endpoints still use case status

**File:** `CRM-BACKEND/src/controllers/mobileCaseController.ts`

**Line 575:** `updateCaseStatus` endpoint
```typescript
await query(`UPDATE cases SET status = $1, trigger = COALESCE($2, trigger), "completedAt" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4`, [status, notes, compAt, actualCaseId]);
```
❌ This endpoint updates case status directly (should update task status instead)

---

### 1.2 CRM-MOBILE Audit

#### ❌ PROBLEM: Mobile App Tab Filtering

**File:** `CRM-MOBILE/screens/AssignedCasesScreen.tsx` (Line 10)
```typescript
filter={(c) => c.status === CaseStatus.Assigned}
```
❌ Filters by case status instead of task status

**File:** `CRM-MOBILE/screens/InProgressCasesScreen.tsx` (Line 46)
```typescript
filter={(c) => c.status === CaseStatus.InProgress && !c.isSaved}
```
❌ Filters by case status instead of task status

**File:** `CRM-MOBILE/screens/CompletedCasesScreen.tsx` (Line 10)
```typescript
filter={(c) => c.status === CaseStatus.Completed}
```
❌ Filters by case status instead of task status

#### ❌ PROBLEM: Mobile App Status Mapping

**File:** `CRM-MOBILE/services/caseService.ts`

**Lines 74-78:** Status mapping
```typescript
const statusMap: { [key: string]: CaseStatus } = {
  'PENDING': CaseStatus.Assigned,
  'IN_PROGRESS': CaseStatus.InProgress,
  'COMPLETED': CaseStatus.Completed
};
```
❌ Maps backend status to mobile CaseStatus enum (should use task status)

**Lines 64-150:** `mapBackendCaseToMobile()` function
- ❌ Maps `backendCase.status` to mobile case status
- ❌ Should map `backendCase.task_status` or `backendCase.status` (backend already sends task status as `status`)

#### ❌ PROBLEM: Mobile App Status Updates

**File:** `CRM-MOBILE/context/CaseContext.tsx`

**Lines 111-157:** `updateCaseStatus()` function
```typescript
const result = await CaseStatusService.updateCaseStatus(caseId, status, {
  optimistic: true,
  auditMetadata,
});
```
❌ Updates case status instead of task status

**Lines 1045-1090:** `syncCases()` function
```typescript
if (localCase && localCase.status !== serverCase.status) {
  const localUpdatedAt = new Date(localCase.updatedAt || localCase.createdAt);
  const serverUpdatedAt = new Date(serverCase.updatedAt || serverCase.createdAt);
  
  if (localUpdatedAt > serverUpdatedAt) {
    return {
      ...serverCase,
      status: localCase.status,  // ❌ Preserves local case status
      ...
    };
  }
}
```
❌ Sync logic preserves local case status over server status

---

### 1.3 CRM-FRONTEND Audit

**Status:** Not yet audited (Phase 1.3 pending)

---

## Phase 2: Root Cause Analysis

### The Problem Flow:

1. **Field agent accepts task** → Mobile app calls backend to update task status to IN_PROGRESS
2. **Backend correctly updates** `verification_tasks.status = 'IN_PROGRESS'`
3. **Backend returns task status** in API response as `status` field
4. **Mobile app receives** task status but **stores it as case status**
5. **Field agent fills form and submits** → Backend updates task status to COMPLETED
6. **Backend recalculates case status** using `updateCaseStatusBasedOnTasks()`
7. **If all tasks completed** → Case status becomes COMPLETED
8. **Mobile app syncs** and receives updated case status
9. **Field agent logs out** → Local storage cleared
10. **Field agent logs back in** → Mobile app fetches cases from backend
11. **Backend returns** task status (COMPLETED) as `status` field
12. **Mobile app stores** this as case status
13. **Mobile app filters tabs** by case status
14. **Problem:** If case has multiple tasks and only one is completed, case status is still IN_PROGRESS
15. **Result:** Completed task appears in "In Progress" tab instead of "Completed" tab

### Why This Happens:

The backend is **already sending the correct task status** in the `status` field (line 262 of mobileCaseController.ts).

However, the mobile app:
1. Receives this task status
2. Stores it as `case.status`
3. Filters tabs by `case.status`

This works fine for **single-task cases** but breaks for **multi-task cases** where:
- User's task is COMPLETED
- But other tasks are still IN_PROGRESS
- So case status is IN_PROGRESS
- User's completed task shows in "In Progress" tab

---

## Phase 3: Solution Strategy

### Option A: Use Task Status for Tab Filtering (RECOMMENDED)

**Pros:**
- Backend already sends task status correctly
- Minimal backend changes required
- Aligns with multi-task architecture

**Cons:**
- Requires mobile app refactoring
- Need to update all tab filters
- Need to update status sync logic

### Option B: Store Both Case and Task Status

**Pros:**
- Preserves case status for reference
- Can show both statuses in UI

**Cons:**
- More complex data model
- Risk of confusion between two statuses
- Still need to filter by task status

### Option C: Backend Returns Separate Fields

**Pros:**
- Clear separation of concerns
- Easy to understand

**Cons:**
- Backend already does this (sends task_status as status)
- Mobile app just needs to use it correctly

---

## Recommended Solution: Option A

The backend is **already correct**. We just need to update the mobile app to:

1. **Understand that `status` field is task status** (not case status)
2. **Filter tabs by task status** (which is already in the `status` field)
3. **Remove case status sync logic** (or keep it separate for reference only)
4. **Update status update calls** to update task status instead of case status

---

## Files Requiring Changes

### CRM-MOBILE (High Priority)

1. **screens/AssignedCasesScreen.tsx** - Update filter to use task status
2. **screens/InProgressCasesScreen.tsx** - Update filter to use task status
3. **screens/CompletedCasesScreen.tsx** - Update filter to use task status
4. **services/caseService.ts** - Update status mapping to preserve task status
5. **context/CaseContext.tsx** - Update sync logic to not override task status
6. **types/index.ts** - Add taskStatus field to Case interface

### CRM-BACKEND (Low Priority)

1. **controllers/mobileCaseController.ts** - Already correct, no changes needed
2. **controllers/mobileFormController.ts** - Already correct, no changes needed

---

## Critical Discovery

**The backend is ALREADY CORRECT!**

Backend sends task status in the `status` field (line 262):
```typescript
status: caseItem.task_status ? caseItem.task_status.toUpperCase().replace(/\s+/g, '_') : 'ASSIGNED',
```

**The mobile app just needs to:**
1. Recognize that `status` field is already task status (not case status)
2. Use it correctly for tab filtering
3. Stop overriding it with case status during sync

---

## Next Steps

1. ✅ Complete Phase 1.1 audit (CRM-BACKEND) - DONE
2. ✅ Complete Phase 1.2 audit (CRM-MOBILE) - DONE
3. ⏳ Complete Phase 1.3 audit (CRM-FRONTEND) - PENDING
4. ⏳ Create detailed implementation plan - PENDING
5. ⏳ Implement mobile app changes - PENDING
6. ⏳ Test and verify - PENDING


