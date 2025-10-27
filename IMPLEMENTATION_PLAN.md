# Multi-Task Architecture Fix - Implementation Plan
**Date:** 2025-10-27  
**Issue:** Submitted cases reverting to "Assigned" status after user re-login  
**Solution:** Mobile app needs to recognize that backend already sends task status correctly

---

## Phase 1: Understanding the Current State

### Backend (Already Correct ✅)

**What Backend Sends:**
```typescript
// Line 262 of mobileCaseController.ts
status: caseItem.task_status ? caseItem.task_status.toUpperCase().replace(/\s+/g, '_') : 'ASSIGNED',
```

**Backend Status Values:**
- `PENDING` - Task created but not assigned
- `ASSIGNED` - Task assigned to field agent
- `IN_PROGRESS` - Field agent accepted task
- `COMPLETED` - Field agent submitted form
- `CANCELLED` - Task cancelled
- `ON_HOLD` - Task on hold

### Mobile App (Needs Fix ❌)

**What Mobile App Does:**
1. Receives `status` field from backend (which is task status)
2. Maps it to `CaseStatus` enum in `caseService.ts`:
   ```typescript
   const statusMap: { [key: string]: CaseStatus } = {
     'PENDING': CaseStatus.Assigned,
     'IN_PROGRESS': CaseStatus.InProgress,
     'COMPLETED': CaseStatus.Completed
   };
   ```
3. Stores it as `case.status` (treating task status as case status)
4. Filters tabs by `case.status`

**Mobile CaseStatus Enum:**
```typescript
export enum CaseStatus {
  Assigned = 'Assigned',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Saved = 'Saved',
}
```

---

## Phase 2: The Problem

### Scenario: Multi-Task Case

**Example Case:**
- Case ID: C-001
- Task 1: Residence verification → Assigned to User A → Status: COMPLETED
- Task 2: Office verification → Assigned to User B → Status: IN_PROGRESS

**What Should Happen:**
- User A logs in → Sees Task 1 in "Completed" tab
- User B logs in → Sees Task 2 in "In Progress" tab

**What Actually Happens:**
1. User A completes Task 1 → Backend updates task status to COMPLETED
2. Backend recalculates case status → Case status = IN_PROGRESS (because Task 2 is still in progress)
3. User A logs out and logs back in
4. Backend sends Task 1 with `status: 'COMPLETED'` (task status)
5. Mobile app receives it and stores as `case.status = CaseStatus.Completed`
6. **BUT** during sync, mobile app may override this with case status from server
7. Result: Task 1 appears in wrong tab

---

## Phase 3: Solution Strategy

### Key Insight

The backend is **already sending task status** in the `status` field. The mobile app just needs to:

1. **Understand** that `status` field is task status (not case status)
2. **Use** task status for tab filtering
3. **Stop** overriding task status during sync

### Implementation Approach

**Option A: Rename Field (RECOMMENDED)**
- Add `taskStatus` field to Case interface
- Map backend `status` to `taskStatus` instead of `status`
- Keep `status` for backward compatibility (can be removed later)
- Filter tabs by `taskStatus`

**Option B: Change Semantics**
- Keep `status` field but document it as task status
- Update all filters to use `status` (which is already task status)
- Risk: Confusing because field name suggests case status

**Option C: Store Both**
- Add `taskStatus` and `caseStatus` fields
- Backend sends task status as `status`
- Calculate case status on mobile (or fetch separately)
- Most complex but clearest separation

**Decision: Option A** - Clearest and safest approach

---

## Phase 4: Detailed Implementation Steps

### Step 1: Update Case Interface

**File:** `CRM-MOBILE/types.ts`

**Change:**
```typescript
export interface Case {
  id: string;
  title: string;
  description: string;
  customer: {
    name: string;
    contact: string;
  };
  status: CaseStatus; // DEPRECATED: This is actually task status, use taskStatus instead
  taskStatus: CaseStatus; // NEW: Explicit task status field
  isSaved: boolean;
  // ... rest of fields
}
```

### Step 2: Update Case Service Mapping

**File:** `CRM-MOBILE/services/caseService.ts`

**Current Code (Lines 64-150):**
```typescript
const mapBackendCaseToMobile = (backendCase: BackendCase): Case => {
  const statusMap: { [key: string]: CaseStatus } = {
    'PENDING': CaseStatus.Assigned,
    'IN_PROGRESS': CaseStatus.InProgress,
    'COMPLETED': CaseStatus.Completed
  };
  
  return {
    // ...
    status: statusMap[backendCase.status] || CaseStatus.Assigned,
    // ...
  };
};
```

**New Code:**
```typescript
const mapBackendCaseToMobile = (backendCase: BackendCase): Case => {
  const statusMap: { [key: string]: CaseStatus } = {
    'PENDING': CaseStatus.Assigned,
    'ASSIGNED': CaseStatus.Assigned,
    'IN_PROGRESS': CaseStatus.InProgress,
    'COMPLETED': CaseStatus.Completed
  };
  
  // Backend sends task status in the 'status' field
  const taskStatus = statusMap[backendCase.status] || CaseStatus.Assigned;
  
  return {
    // ...
    status: taskStatus, // Keep for backward compatibility
    taskStatus: taskStatus, // NEW: Explicit task status
    // ...
  };
};
```

### Step 3: Update Tab Filters

**File:** `CRM-MOBILE/screens/AssignedCasesScreen.tsx`

**Current Code (Line 10):**
```typescript
filter={(c) => c.status === CaseStatus.Assigned}
```

**New Code:**
```typescript
filter={(c) => (c.taskStatus || c.status) === CaseStatus.Assigned}
```

**File:** `CRM-MOBILE/screens/InProgressCasesScreen.tsx`

**Current Code (Line 46):**
```typescript
filter={(c) => c.status === CaseStatus.InProgress && !c.isSaved}
```

**New Code:**
```typescript
filter={(c) => (c.taskStatus || c.status) === CaseStatus.InProgress && !c.isSaved}
```

**File:** `CRM-MOBILE/screens/CompletedCasesScreen.tsx`

**Current Code (Line 10):**
```typescript
filter={(c) => c.status === CaseStatus.Completed}
```

**New Code:**
```typescript
filter={(c) => (c.taskStatus || c.status) === CaseStatus.Completed}
```

### Step 4: Update Sync Logic

**File:** `CRM-MOBILE/context/CaseContext.tsx`

**Current Code (Lines 1045-1090):**
```typescript
const syncCases = async () => {
  // ...
  const mergedCases = serverData.map(serverCase => {
    const localCase = cases.find(c => c.id === serverCase.id);
    
    if (localCase && localCase.status !== serverCase.status) {
      const localUpdatedAt = new Date(localCase.updatedAt || localCase.createdAt);
      const serverUpdatedAt = new Date(serverCase.updatedAt || serverCase.createdAt);
      
      if (localUpdatedAt > serverUpdatedAt) {
        return {
          ...serverCase,
          status: localCase.status, // ❌ Overrides server task status
          // ...
        };
      }
    }
    
    return serverCase;
  });
};
```

**New Code:**
```typescript
const syncCases = async () => {
  // ...
  const mergedCases = serverData.map(serverCase => {
    const localCase = cases.find(c => c.id === serverCase.id);
    
    // IMPORTANT: Always trust server task status
    // Only preserve local changes for isSaved, submissionStatus, etc.
    if (localCase) {
      const localUpdatedAt = new Date(localCase.updatedAt || localCase.createdAt);
      const serverUpdatedAt = new Date(serverCase.updatedAt || serverCase.createdAt);
      
      if (localUpdatedAt > serverUpdatedAt) {
        return {
          ...serverCase,
          // DO NOT override task status - always use server value
          // Only preserve local UI state
          isSaved: localCase.isSaved,
          submissionStatus: localCase.submissionStatus,
          submissionError: localCase.submissionError,
          lastSubmissionAttempt: localCase.lastSubmissionAttempt,
        };
      }
    }
    
    return serverCase;
  });
};
```

### Step 5: Update Status Update Logic

**File:** `CRM-MOBILE/context/CaseContext.tsx`

**Current Code (Lines 111-157):**
```typescript
const updateCaseStatus = async (caseId: string, status: CaseStatus, ...) => {
  const result = await CaseStatusService.updateCaseStatus(caseId, status, {
    optimistic: true,
    auditMetadata,
  });
  // ...
};
```

**Analysis:**
- This function updates case status on the backend
- Should be deprecated in favor of task status updates
- For now, keep it but add warning comment

**New Code:**
```typescript
// DEPRECATED: This updates case status, but in multi-task architecture,
// we should update task status instead. Use VerificationTaskService.startTask()
// or form submission endpoints to update task status.
const updateCaseStatus = async (caseId: string, status: CaseStatus, ...) => {
  console.warn('updateCaseStatus is deprecated. Use task-level status updates instead.');
  const result = await CaseStatusService.updateCaseStatus(caseId, status, {
    optimistic: true,
    auditMetadata,
  });
  // ...
};
```

---

## Phase 5: Testing Plan

### Test Case 1: Single-Task Case
1. Create case with one task
2. Assign to field agent
3. Field agent accepts → Should appear in "In Progress" tab
4. Field agent submits → Should appear in "Completed" tab
5. Field agent logs out and logs back in → Should still be in "Completed" tab ✅

### Test Case 2: Multi-Task Case (Same User)
1. Create case with two tasks assigned to same user
2. User accepts both → Both appear in "In Progress" tab
3. User completes first task → First task moves to "Completed" tab
4. Second task still in "In Progress" tab
5. User logs out and logs back in → First task in "Completed", second in "In Progress" ✅

### Test Case 3: Multi-Task Case (Different Users)
1. Create case with two tasks
2. Assign Task 1 to User A, Task 2 to User B
3. User A completes Task 1
4. User A logs out and logs back in → Task 1 in "Completed" tab ✅
5. User B logs in → Task 2 in "Assigned" or "In Progress" tab ✅

---

## Phase 6: Rollout Plan

1. **Development Testing** - Test on local environment
2. **Code Review** - Review all changes
3. **Staging Deployment** - Deploy to staging server
4. **User Acceptance Testing** - Test with real users
5. **Production Deployment** - Deploy to production
6. **Monitoring** - Monitor for issues

---

## Files to Modify

1. ✅ `CRM-MOBILE/types.ts` - Add taskStatus field
2. ✅ `CRM-MOBILE/services/caseService.ts` - Update mapping
3. ✅ `CRM-MOBILE/screens/AssignedCasesScreen.tsx` - Update filter
4. ✅ `CRM-MOBILE/screens/InProgressCasesScreen.tsx` - Update filter
5. ✅ `CRM-MOBILE/screens/CompletedCasesScreen.tsx` - Update filter
6. ✅ `CRM-MOBILE/context/CaseContext.tsx` - Update sync logic

---

## Estimated Effort

- Implementation: 2-3 hours
- Testing: 2-3 hours
- Total: 4-6 hours


