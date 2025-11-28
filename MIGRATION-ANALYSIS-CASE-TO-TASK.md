# Case → VerificationTask Migration Analysis Report

## Executive Summary

After scanning the entire codebase (mobile + backend + database), I've identified **critical mismatches** between the mobile app's new `VerificationTask/taskId` naming and the backend's existing `case/caseId` API structure. The mobile refactor is **incomplete** - while the mobile code uses `taskId` internally, it still calls backend APIs that expect `caseId`.

---

## 🔴 CRITICAL FINDINGS

### 1. **API Endpoint Mismatch**

**Problem:** Mobile app now uses `taskId` but backend APIs still expect `caseId` in URL parameters.

**Mobile Side (calls these endpoints):**

```typescript
// Mobile expects to call with taskId but backend routes use :caseId
`/api/mobile/cases/${taskId}/verification/${verificationType}`; // ❌ MISMATCH
```

**Backend Side (actual routes):**

```typescript
// All these routes use :caseId parameter
"/cases/:caseId/verification/residence";
"/cases/:caseId/verification/office";
"/cases/:caseId/verification/business";
"/cases/:caseId/attachments";
"/cases/:caseId/status";
"/cases/:caseId/priority";
"/cases/:caseId/auto-save";
```

---

## 📋 DETAILED BREAKDOWN

### **MOBILE CODE - Remaining Issues**

#### A. API Calls Still Using Case Endpoints

| File                                  | Line    | Issue                                                                       | Fix Required                                                                          |
| ------------------------------------- | ------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `services/verificationFormService.ts` | 968     | `${apiBaseUrl}/api/mobile/cases/${taskId}/verification/${verificationType}` | Backend must support `/verification-tasks/${taskId}` OR mobile must map taskId→caseId |
| `services/taskService.ts`             | 39, 165 | `caseId: number` property still exists                                      | Remove or rename to `businessCaseId` for clarity                                      |
| `types.ts`                            | 1778    | `caseId?: number` in VerificationTask                                       | Rename to `businessCaseId` or remove                                                  |

#### B. Mobile Database Schema (SQLite)

| File                                        | Lines              | Issue                       | Fix Required                     |
| ------------------------------------------- | ------------------ | --------------------------- | -------------------------------- |
| `src/services/EnterpriseOfflineDatabase.ts` | 102, 115, 121, 134 | Tables use `case_id` column | Rename to `verification_task_id` |
| `src/services/EnterpriseOfflineDatabase.ts` | 218-219            | Indexes on `case_id`        | Update index names               |
| `src/services/EnterpriseOfflineDatabase.ts` | 386-477            | SQL queries use `case_id`   | Update all queries               |

#### C. UI Display References

| File                      | Line     | Issue                      | Fix Required                                         |
| ------------------------- | -------- | -------------------------- | ---------------------------------------------------- |
| `components/TaskCard.tsx` | 594, 963 | Displays `taskData.caseId` | Change to `taskData.businessCaseId` or `taskData.id` |
| `hooks/useTabSearch.ts`   | 57       | Searches by `caseId`       | Update to search by `id` or `businessCaseId`         |

#### D. Utility Functions

| File                             | Lines  | Issue                   | Fix Required         |
| -------------------------------- | ------ | ----------------------- | -------------------- |
| `utils/caseDataUtils.ts`         | 66-74  | Uses `caseId` variable  | Rename to `taskId`   |
| `utils/imageAutoSaveHelpers.ts`  | 11, 48 | JSDoc mentions `caseId` | Update documentation |
| `utils/formSubmissionHelpers.ts` | 12     | JSDoc mentions `caseId` | Update documentation |

---

### **BACKEND CODE - Required Changes**

#### A. Mobile API Routes (HIGH PRIORITY)

**File:** `src/routes/mobile.ts`

All these routes MUST be updated or duplicated to support `verificationTaskId`:

```typescript
// CURRENT (uses caseId)
"/cases/:caseId"; // Line 57
"/cases/:caseId/status"; // Line 64
"/cases/:caseId/priority"; // Line 70
"/cases/:caseId/revoke"; // Line 76
"/cases/:caseId/auto-save"; // Line 116
"/cases/:caseId/auto-save/:formType"; // Line 122
"/cases/:caseId/attachments"; // Lines 138, 145
"/cases/:caseId/attachments/:attachmentId"; // Line 151
"/cases/:caseId/verification-images"; // Line 171
"/cases/:caseId/verification/residence"; // Line 179
"/cases/:caseId/verification/office"; // Line 185
"/cases/:caseId/verification/business"; // Line 191
"/cases/:caseId/verification/builder"; // Line 197
"/cases/:caseId/verification/residence-cum-office"; // Line 203
"/cases/:caseId/verification/dsa-connector"; // Line 209
"/cases/:caseId/verification/property-individual"; // Line 215
"/cases/:caseId/verification/property-apf"; // Line 221
"/cases/:caseId/verification/noc"; // Line 227
"/cases/:caseId/forms"; // Line 233
"/cases/:caseId/location-history"; // Line 265

// SHOULD BE (using verificationTaskId)
"/verification-tasks/:taskId";
"/verification-tasks/:taskId/status";
"/verification-tasks/:taskId/priority";
"/verification-tasks/:taskId/revoke";
"/verification-tasks/:taskId/auto-save";
"/verification-tasks/:taskId/attachments";
"/verification-tasks/:taskId/verification/{type}";
// etc.
```

#### B. Controllers Need Updates

| Controller                      | Issue                                  | Fix Required                        |
| ------------------------------- | -------------------------------------- | ----------------------------------- |
| `mobileCaseController.ts`       | All methods expect `req.params.caseId` | Add support for `req.params.taskId` |
| `mobileFormController.ts`       | Form submission methods use `caseId`   | Update to use `verificationTaskId`  |
| `mobileAttachmentController.ts` | Attachment methods use `caseId`        | Support `verificationTaskId`        |
| `mobileLocationController.ts`   | Location methods use `caseId`          | Support `verificationTaskId`        |

#### C. Other Backend Routes

| File                          | Lines  | Issue                                    | Fix Required                     |
| ----------------------------- | ------ | ---------------------------------------- | -------------------------------- |
| `routes/attachments.ts`       | 27, 70 | Uses `caseId` param                      | Add `verificationTaskId` support |
| `routes/forms.ts`             | 35, 44 | Uses `caseId` param                      | Add `verificationTaskId` support |
| `routes/deduplication.ts`     | 21-22  | Uses `caseId` param                      | May need update                  |
| `routes/verificationTasks.ts` | 32, 44 | Uses `/cases/:caseId/verification-tasks` | Already correct pattern          |

---

### **DATABASE SCHEMA - Required Migrations**

#### A. Mobile SQLite Schema

**File:** `crm-mobile/src/services/EnterpriseOfflineDatabase.ts`

**Required Migration:**

```sql
-- Rename columns in form_submissions table
ALTER TABLE form_submissions RENAME COLUMN case_id TO verification_task_id;

-- Rename columns in attachments table
ALTER TABLE attachments RENAME COLUMN case_id TO verification_task_id;

-- Drop old indexes
DROP INDEX IF EXISTS idx_form_submissions_case_id;
DROP INDEX IF EXISTS idx_attachments_case_id;

-- Create new indexes
CREATE INDEX idx_form_submissions_verification_task_id ON form_submissions (verification_task_id);
CREATE INDEX idx_attachments_verification_task_id ON attachments (verification_task_id);

-- Update foreign key references
-- (SQLite doesn't support ALTER FOREIGN KEY, so may need to recreate tables)
```

#### B. Backend PostgreSQL Schema

**File:** `acs_db_export_new.sql`

**Current State:**

- `verification_tasks` table has `case_id` column (Line 1300+)
- All report tables have `case_id` foreign keys
- Multiple triggers and functions reference `case_id`

**Assessment:** Backend database schema is **CORRECT** - it should keep `case_id` because:

1. A case can have multiple verification tasks
2. `case_id` is the foreign key linking verification_tasks to cases
3. This is the proper relational structure

**No database migration needed on backend.**

---

## 🎯 RECOMMENDED SOLUTION

### **Option 1: Dual API Support (RECOMMENDED)**

Keep both naming conventions during transition:

**Backend Changes:**

```typescript
// Add new routes alongside existing ones
router.post('/verification-tasks/:taskId/verification/:type', ...);  // NEW
router.post('/cases/:caseId/verification/:type', ...);               // KEEP for backward compatibility

// In controllers, support both parameters
const identifier = req.params.taskId || req.params.caseId;
```

**Mobile Changes:**

```typescript
// Update API calls to use new endpoints
const endpoint = `${apiBaseUrl}/api/mobile/verification-tasks/${taskId}/verification/${type}`;
```

**Timeline:** 2-3 days
**Risk:** Low (backward compatible)

---

### **Option 2: Complete Backend Refactor**

Rename all backend routes and controllers:

**Changes Required:**

1. Update all 20+ mobile API routes
2. Update 4+ controllers
3. Update mobile app API calls
4. Update mobile SQLite schema
5. Deploy both simultaneously

**Timeline:** 1-2 weeks
**Risk:** High (breaking changes)

---

### **Option 3: Mobile Mapping Layer (QUICK FIX)**

Add a mapping layer in mobile app:

**Mobile Changes:**

```typescript
// In taskService.ts
class TaskService {
  // Map taskId to caseId for API calls
  private async getCaseIdForTask(taskId: string): Promise<string> {
    const task = await this.getTask(taskId);
    return task.caseId || taskId; // Fallback to taskId
  }

  // Use in API calls
  async submitVerification(taskId: string, data: any) {
    const caseId = await this.getCaseIdForTask(taskId);
    const endpoint = `${apiBaseUrl}/api/mobile/cases/${caseId}/verification/${type}`;
    // ...
  }
}
```

**Timeline:** 1 day
**Risk:** Medium (technical debt)

---

## 📝 EXACT CODE CHANGES REQUIRED

### **1. Mobile API Service Update**

**File:** `crm-mobile/services/verificationFormService.ts`

```typescript
// BEFORE (Line 968)
const endpoint = `${apiBaseUrl}/api/mobile/cases/${taskId}/verification/${verificationType}`;

// AFTER - Option 1 (use new endpoint)
const endpoint = `${apiBaseUrl}/api/mobile/verification-tasks/${taskId}/verification/${verificationType}`;

// AFTER - Option 3 (map to caseId)
const task = await taskService.getTask(taskId);
const caseId = task.caseId || task.id;
const endpoint = `${apiBaseUrl}/api/mobile/cases/${caseId}/verification/${verificationType}`;
```

### **2. Backend Route Addition**

**File:** `CRM-BACKEND/src/routes/mobile.ts`

```typescript
// ADD these new routes (after line 112)
router.post(
  "/verification-tasks/:taskId/verification/:verificationType",
  authenticateToken,
  validateMobileVersion,
  MobileFormController.submitVerificationByTaskId // NEW method
);

router.get(
  "/verification-tasks/:taskId/attachments",
  authenticateToken,
  validateMobileVersion,
  MobileAttachmentController.getTaskAttachments // NEW method
);

router.put(
  "/verification-tasks/:taskId/status",
  authenticateToken,
  validateMobileVersion,
  MobileCaseController.updateTaskStatusByTaskId // NEW method
);
```

### **3. Backend Controller Update**

**File:** `CRM-BACKEND/src/controllers/mobileFormController.ts`

```typescript
// ADD new method
export class MobileFormController {
  static async submitVerificationByTaskId(req: Request, res: Response) {
    const { taskId } = req.params;
    const { verificationType } = req.params;

    // Get case_id from verification_tasks table
    const result = await pool.query(
      "SELECT case_id FROM verification_tasks WHERE id = $1",
      [taskId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Verification task not found" });
    }

    const caseId = result.rows[0].case_id;

    // Reuse existing logic with caseId
    req.params.caseId = caseId;
    return MobileFormController.submitResidenceVerification(req, res);
  }
}
```

### **4. Mobile Database Migration**

**File:** `crm-mobile/src/services/EnterpriseOfflineDatabase.ts`

```typescript
// ADD migration method
async migrateCaseIdToTaskId(): Promise<void> {
  await this.db.exec(`
    -- Create new tables with correct schema
    CREATE TABLE IF NOT EXISTS form_submissions_new (
      id TEXT PRIMARY KEY,
      verification_task_id TEXT NOT NULL,  -- Changed from case_id
      form_type TEXT NOT NULL,
      form_data TEXT NOT NULL,
      submission_time INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      sync_error TEXT,
      FOREIGN KEY (verification_task_id) REFERENCES verification_tasks (id)
    );

    -- Copy data
    INSERT INTO form_submissions_new
    SELECT id, case_id, form_type, form_data, submission_time, synced, sync_error
    FROM form_submissions;

    -- Drop old table
    DROP TABLE form_submissions;

    -- Rename new table
    ALTER TABLE form_submissions_new RENAME TO form_submissions;

    -- Recreate indexes
    CREATE INDEX idx_form_submissions_verification_task_id
    ON form_submissions (verification_task_id);
  `);
}
```

### **5. Mobile Type Definition Update**

**File:** `crm-mobile/types.ts`

```typescript
// BEFORE (Line 1778)
export interface VerificationTask {
  id: string;
  caseId?: number; // ❌ Confusing
  // ...
}

// AFTER
export interface VerificationTask {
  id: string; // This IS the verification task ID
  businessCaseId?: number; // ✅ Clear: the business case number for display
  // ...
}
```

---

## ⚠️ MIGRATION RISKS

1. **Data Loss Risk:** Mobile SQLite migration could lose data if not tested
2. **API Compatibility:** Old mobile app versions will break if backend changes
3. **Sync Issues:** Pending syncs may fail during transition
4. **User Impact:** Field agents may experience downtime

---

## ✅ RECOMMENDED ACTION PLAN

### **Phase 1: Backend Preparation (Week 1)**

1. Add new `/verification-tasks/:taskId/*` routes alongside existing `/cases/:caseId/*`
2. Update controllers to support both parameters
3. Add database query to map `taskId → caseId`
4. Deploy to staging
5. Test with mobile app

### **Phase 2: Mobile Update (Week 2)**

1. Update all API calls to use new endpoints
2. Update SQLite schema (with migration)
3. Update UI to use `businessCaseId` for display
4. Test offline sync thoroughly
5. Deploy to beta testers

### **Phase 3: Cleanup (Week 3)**

1. Monitor for errors
2. Deprecate old endpoints (keep for 30 days)
3. Remove old code after confirmation
4. Update documentation

---

## 🔍 VERIFICATION CHECKLIST

- [ ] All mobile API calls use `/verification-tasks/:taskId`
- [ ] Backend supports both old and new endpoints
- [ ] Mobile SQLite schema updated
- [ ] Offline sync works with new schema
- [ ] UI displays correct IDs
- [ ] No references to `caseId` in mobile code (except `businessCaseId`)
- [ ] Backend logs show successful taskId lookups
- [ ] Old mobile app versions still work (backward compatibility)

---

**Prepared:** November 28, 2025  
**Status:** CRITICAL - Mobile and Backend are misaligned  
**Priority:** HIGH - Affects all verification submissions
