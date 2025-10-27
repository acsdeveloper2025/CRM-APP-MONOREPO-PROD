# CRM-MOBILE Application Audit Report
## Phase 1.2: Case Status vs Task Status Usage

**Date:** 2025-10-27  
**Status:** Complete  
**Scope:** Identify all mobile components, screens, and services using case status

---

## Executive Summary

The CRM-MOBILE application currently uses **case-level status** throughout the application. However, the backend has transitioned to **task-level status** in the verification_tasks table. The mobile app needs to be updated to work with task-level status instead of case-level status.

**Key Finding:** The mobile app is currently mapping backend task status to case status, which causes issues when multiple tasks exist for a single case. The app needs to be refactored to work directly with verification tasks.

---

## Current Architecture

### Case Status Enum (types.ts)
```typescript
export enum CaseStatus {
  Assigned = 'Assigned',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Saved = 'Saved',
}
```

### Case Interface (types.ts, Line 1750)
```typescript
export interface Case {
  id: string;
  status: CaseStatus;
  isSaved: boolean;
  verificationTaskId?: string;
  verificationTaskNumber?: string;
  // ... other fields
}
```

---

## Files Using Case Status

### 1. **Screens (Tab Filters)**

#### AssignedCasesScreen.tsx (Line 10)
- **Usage:** Filters cases by `CaseStatus.Assigned`
- **Issue:** ❌ Should filter by task status, not case status
- **Current Code:**
  ```typescript
  filter={(c) => c.status === CaseStatus.Assigned}
  ```

#### InProgressCasesScreen.tsx (Line 46)
- **Usage:** Filters cases by `CaseStatus.InProgress`
- **Issue:** ❌ Should filter by task status
- **Current Code:**
  ```typescript
  filter={(c) => c.status === CaseStatus.InProgress && !c.isSaved}
  ```

#### CompletedCasesScreen.tsx (Line 10)
- **Usage:** Filters cases by `CaseStatus.Completed`
- **Issue:** ❌ Should filter by task status
- **Current Code:**
  ```typescript
  filter={(c) => c.status === CaseStatus.Completed}
  ```

#### SavedCasesScreen.tsx (Line 10)
- **Usage:** Filters by `isSaved` flag and excludes completed cases
- **Status:** ✅ Correct - uses isSaved flag, not case status

#### DashboardScreen.tsx (Lines 62-65)
- **Usage:** Counts cases by status for dashboard statistics
- **Issue:** ❌ Should count by task status
- **Current Code:**
  ```typescript
  const assignedCount = cases.filter(c => c.status === CaseStatus.Assigned).length;
  const inProgressCount = cases.filter(c => c.status === CaseStatus.InProgress).length;
  const completedCount = cases.filter(c => c.status === CaseStatus.Completed).length;
  ```

### 2. **Services**

#### caseService.ts (Lines 73-78)
- **Usage:** Maps backend status to mobile CaseStatus
- **Issue:** ❌ Maps task status to case status, losing task-level information
- **Current Code:**
  ```typescript
  const statusMap: { [key: string]: CaseStatus } = {
    'PENDING': CaseStatus.Assigned,
    'IN_PROGRESS': CaseStatus.InProgress,
    'COMPLETED': CaseStatus.Completed
  };
  ```

#### caseStatusService.ts (Lines 22-190)
- **Usage:** Updates case status with backend sync
- **Issue:** ❌ Updates case-level status instead of task-level status
- **Functions:**
  - `updateCaseStatus()` - Updates case status
  - `isValidStatusTransition()` - Validates case status transitions
  - `syncStatusWithBackend()` - Syncs case status to backend
  - `mapMobileStatusToBackend()` - Maps mobile status to backend format

#### verificationTaskService.ts (Lines 44-250)
- **Usage:** ✅ Correctly handles task-level operations
- **Functions:**
  - `startTask()` - Changes task status ASSIGNED → IN_PROGRESS
  - `updateTaskStatus()` - Updates task status
  - `completeTask()` - Changes task status to COMPLETED
  - `cancelTask()` - Changes task status to CANCELLED
  - `holdTask()` - Changes task status to ON_HOLD

### 3. **Context**

#### CaseContext.tsx (Lines 111-170)
- **Usage:** `updateCaseStatus()` function updates case status
- **Issue:** ❌ Updates case-level status instead of task-level status
- **Related Functions:**
  - `updateCaseSubmissionStatus()` (Line 1129) - ✅ Correct, tracks submission status
  - `verifyCaseSubmissionStatus()` (Line 1172) - ✅ Correct, checks task status on server

### 4. **Components**

#### CaseCard.tsx (Multiple locations)
- **Line 142-143:** Status checks for UI rendering
  ```typescript
  const isAssigned = caseData.status === CaseStatus.Assigned;
  const isInProgress = caseData.status === CaseStatus.InProgress;
  ```
- **Line 266:** Accept button checks if case is assigned
- **Line 289:** Updates case status to InProgress when accepting
- **Line 315-335:** Status color mapping for UI
- **Line 366-372:** Status-based date display
- **Line 604:** Shows attachment button for InProgress cases
- **Line 622:** Shows priority input for InProgress cases
- **Line 631:** Shows timeline for completed cases
- **Line 636:** Shows submission status for completed cases
- **Line 737:** Hides forms for completed/saved cases
- **Line 898:** Marks case as completed when saving

#### AcceptCaseButton.tsx (Lines 29, 93)
- **Usage:** Checks if case is assigned before allowing accept
- **Issue:** ❌ Should check task status instead
- **Current Code:**
  ```typescript
  if (caseData.status !== CaseStatus.Assigned) {
    return null;
  }
  ```

---

## Backend Integration Issues

### Current Flow (Incorrect)
1. Backend returns verification_tasks with status (PENDING, ASSIGNED, IN_PROGRESS, COMPLETED)
2. Mobile app maps task status to case status (loses task-level info)
3. Mobile app displays case status (not task status)
4. Mobile app updates case status (not task status)

### Required Flow (Correct)
1. Backend returns verification_tasks with status
2. Mobile app preserves task status in Case object
3. Mobile app displays task status (not case status)
4. Mobile app updates task status (not case status)

---

## Summary of Changes Needed

| File | Issue | Priority |
|------|-------|----------|
| AssignedCasesScreen.tsx | Filter by task status | HIGH |
| InProgressCasesScreen.tsx | Filter by task status | HIGH |
| CompletedCasesScreen.tsx | Filter by task status | HIGH |
| DashboardScreen.tsx | Count by task status | HIGH |
| caseService.ts | Preserve task status | HIGH |
| caseStatusService.ts | Update task status instead of case status | HIGH |
| CaseCard.tsx | Use task status for UI logic | HIGH |
| AcceptCaseButton.tsx | Check task status | HIGH |
| CaseContext.tsx | Update task status instead of case status | HIGH |
| types.ts | Add taskStatus field to Case interface | HIGH |

---

## Next Steps

1. **Phase 1.3:** Audit CRM-FRONTEND for case status usage
2. **Phase 2:** Create comprehensive implementation plan
3. **Phase 3-6:** Implement changes across all three applications

