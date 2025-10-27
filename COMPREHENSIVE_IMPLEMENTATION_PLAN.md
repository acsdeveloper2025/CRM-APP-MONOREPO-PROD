# Comprehensive Implementation Plan: Case Status to Task Status Migration
## Multi-Task Architecture Transition

**Date:** 2025-10-27  
**Status:** In Progress  
**Scope:** Migrate all three applications from case-level status to task-level status

---

## Overview

This plan outlines the systematic migration from case-level status management to task-level status management across the CRM ecosystem. The backend has already transitioned to task-level status; now the mobile and frontend applications need to be updated.

---

## Phase 1: Audit (COMPLETE ✅)

### 1.1 Backend Audit (COMPLETE ✅)
- ✅ Backend already uses task-level status
- ✅ Verification tasks table has status field
- ✅ Mobile API endpoints return task status

### 1.2 Mobile App Audit (COMPLETE ✅)
- ✅ Identified 9 files requiring changes
- ✅ Created MOBILE_APP_AUDIT_REPORT.md

### 1.3 Frontend Audit (COMPLETE ✅)
- ✅ Frontend correctly uses case-level status
- ✅ No changes needed for frontend
- ✅ Created FRONTEND_APP_AUDIT_REPORT.md

---

## Phase 2: Implementation Plan (IN PROGRESS)

### 2.1 CRM-MOBILE Changes (HIGH PRIORITY)

#### Step 1: Update Type Definitions
**File:** `CRM-MOBILE/types.ts`

Add taskStatus field to Case interface:
```typescript
export interface Case {
  id: string;
  status: CaseStatus;
  taskStatus?: CaseStatus;  // NEW: Task-level status
  verificationTaskId?: string;
  // ... other fields
}
```

#### Step 2: Update caseService.ts
**File:** `CRM-MOBILE/services/caseService.ts`

Preserve task status instead of mapping to case status:
```typescript
// OLD: Maps task status to case status (loses info)
const statusMap: { [key: string]: CaseStatus } = {
  'PENDING': CaseStatus.Assigned,
  'IN_PROGRESS': CaseStatus.InProgress,
  'COMPLETED': CaseStatus.Completed
};

// NEW: Preserve task status
const taskStatusMap: { [key: string]: CaseStatus } = {
  'PENDING': CaseStatus.Assigned,
  'ASSIGNED': CaseStatus.Assigned,
  'IN_PROGRESS': CaseStatus.InProgress,
  'COMPLETED': CaseStatus.Completed,
  'CANCELLED': CaseStatus.Assigned,
  'ON_HOLD': CaseStatus.InProgress,
};

// Store both case status and task status
return {
  ...caseData,
  status: caseStatus,  // Case-level status (for backward compatibility)
  taskStatus: taskStatusMap[backendCase.status],  // Task-level status
};
```

#### Step 3: Update Screen Filters
**Files:**
- `CRM-MOBILE/screens/AssignedCasesScreen.tsx` (Line 10)
- `CRM-MOBILE/screens/InProgressCasesScreen.tsx` (Line 46)
- `CRM-MOBILE/screens/CompletedCasesScreen.tsx` (Line 10)
- `CRM-MOBILE/screens/SavedCasesScreen.tsx` (Line 10)

Update filters to use taskStatus:
```typescript
// OLD
filter={(c) => c.status === CaseStatus.Assigned}

// NEW
filter={(c) => (c.taskStatus || c.status) === CaseStatus.Assigned}
```

#### Step 4: Update CaseStatusService
**File:** `CRM-MOBILE/services/caseStatusService.ts`

Change to update task status instead of case status:
```typescript
// OLD: Updates case status
static async updateCaseStatus(caseId: string, newStatus: CaseStatus)

// NEW: Updates task status
static async updateTaskStatus(taskId: string, newStatus: CaseStatus)
```

#### Step 5: Update CaseContext
**File:** `CRM-MOBILE/context/CaseContext.tsx`

Update updateCaseStatus to use task status:
```typescript
const updateCaseStatus = async (caseId: string, status: CaseStatus) => {
  // Get verification task ID
  const currentCase = cases.find(c => c.id === caseId);
  const taskId = currentCase?.verificationTaskId;
  
  // Update task status instead of case status
  const result = await VerificationTaskService.updateTaskStatus(taskId, status);
};
```

#### Step 6: Update CaseCard Component
**File:** `CRM-MOBILE/components/CaseCard.tsx`

Update status checks to use taskStatus:
```typescript
// OLD
const isAssigned = caseData.status === CaseStatus.Assigned;
const isInProgress = caseData.status === CaseStatus.InProgress;

// NEW
const isAssigned = (caseData.taskStatus || caseData.status) === CaseStatus.Assigned;
const isInProgress = (caseData.taskStatus || caseData.status) === CaseStatus.InProgress;
```

#### Step 7: Update AcceptCaseButton
**File:** `CRM-MOBILE/components/AcceptCaseButton.tsx`

Update to check task status:
```typescript
// OLD
if (caseData.status !== CaseStatus.Assigned) {
  return null;
}

// NEW
if ((caseData.taskStatus || caseData.status) !== CaseStatus.Assigned) {
  return null;
}
```

#### Step 8: Update DashboardScreen
**File:** `CRM-MOBILE/screens/DashboardScreen.tsx`

Update statistics to use taskStatus:
```typescript
// OLD
const assignedCount = cases.filter(c => c.status === CaseStatus.Assigned).length;

// NEW
const assignedCount = cases.filter(c => (c.taskStatus || c.status) === CaseStatus.Assigned).length;
```

### 2.2 CRM-FRONTEND Changes (NO CHANGES NEEDED ✅)

The frontend is correctly using case-level status and does not need changes.

### 2.3 CRM-BACKEND Changes (ALREADY COMPLETE ✅)

The backend already uses task-level status correctly.

---

## Phase 3: Testing Strategy

### 3.1 Mobile App Testing
1. **Unit Tests**
   - Test status mapping logic
   - Test filter functions
   - Test context updates

2. **Integration Tests**
   - Test case acceptance flow
   - Test status updates
   - Test sync with backend

3. **End-to-End Tests**
   - Test multi-task case workflow
   - Test status transitions
   - Test offline sync

### 3.2 Frontend Testing
- Verify case status display
- Verify task statistics display
- Verify filtering by case status

### 3.3 Backend Testing
- Verify task status updates
- Verify API responses
- Verify database consistency

---

## Phase 4: Deployment Strategy

### 4.1 Mobile App Deployment
1. Update types.ts
2. Update services (caseService, caseStatusService)
3. Update context (CaseContext)
4. Update components (CaseCard, AcceptCaseButton)
5. Update screens (all tab screens)
6. Test thoroughly
7. Deploy to production

### 4.2 Frontend Deployment
- No changes needed
- Verify compatibility with updated mobile app

### 4.3 Backend Deployment
- Already deployed
- Monitor for issues

---

## Phase 5: Rollback Plan

If issues occur:
1. Revert mobile app to previous version
2. Revert backend if necessary
3. Investigate root cause
4. Fix and redeploy

---

## Success Criteria

✅ All mobile app screens correctly filter by task status  
✅ Case acceptance updates task status (not case status)  
✅ Multi-task cases display correct task status per task  
✅ Dashboard shows correct task statistics  
✅ Offline sync preserves task status  
✅ All tests pass  
✅ No regression in existing functionality  

---

## Timeline

- **Phase 1 (Audit):** COMPLETE ✅
- **Phase 2 (Implementation Plan):** IN PROGRESS
- **Phase 3 (Implementation):** Pending
- **Phase 4 (Testing):** Pending
- **Phase 5 (Deployment):** Pending

---

## Next Steps

1. Review this implementation plan
2. Proceed with Phase 3: Implement Backend Changes (if needed)
3. Proceed with Phase 4: Implement Mobile Changes
4. Proceed with Phase 5: Implement Frontend Changes (verification only)
5. Execute comprehensive testing
6. Deploy to production

