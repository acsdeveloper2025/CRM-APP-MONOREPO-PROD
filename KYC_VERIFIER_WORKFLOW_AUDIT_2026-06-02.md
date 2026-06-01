# KYC Verifier Workflow — Architecture Review & Proposed Design

**Date:** 2026-06-02
**Author:** Senior Architect (review deliverable; no code modified)
**Scope:** Introduce a **read-only KYC Verifier** role and a **multi-cycle (billable) KYC reverification** model, leaving the Field Executive (FE) workflow untouched.

> **STACK CORRECTION (load-bearing):** This codebase is **raw PostgreSQL + SQL** (`acs_db_final_version.sql`, ~58k lines, plus `psql` migration files under `CRM-BACKEND/migrations/`). **There is NO Prisma.** A grep of `CRM-BACKEND/src` and `CRM-FRONTEND/src` for `@prisma`/`PrismaClient`/`*.prisma` returns nothing; there is no `prisma/` directory and no `schema.prisma`. The *only* Prisma references in the repo are **two stale eslint ignore globs** pointing at a nonexistent `prisma/migrations/` dir (`CRM-BACKEND/eslint.config.js:22`, `.eslintrc.js:27`). All DB layer goes through `query`/`pool`/`wrapClient` from `@/config/database`. Every schema change below is **raw SQL DDL / psql migration**, not a Prisma model. Section 4 restates this explicitly.

---

## Open Design Decisions for Approval

These are genuine product/architecture choices. Each has a **recommended default** but should be confirmed by the product owner before build.

> **APPROVED 2026-06-02 (product owner):** D1=B (lifecycle on cycle table), D2=B (per-task + per-doc snapshots), D3=B (drop commission — invoice/client-revenue only), D4=B (reuse one task + cycle table), D5=B (external-verification status on cycle table). D6=A (keep `kyc.export` download for verifier) taken as default. **All recommended defaults accepted — the design below is the approved direction.** Note: D3 supersedes an earlier "KYC verifiers should earn commission" answer, which assumed the old executor model; under the read-only model the verifier does no in-CRM work, so KYC is client revenue only.

| # | Decision | Option A | Option B | **Recommended default** |
|---|----------|----------|----------|--------------------------|
| **D1** | **New KYC status lifecycle vs. map onto existing 5 states** | Add KYC-specific states (`KYC_ASSIGNED`, `KYC_IN_EXTERNAL_VERIFICATION`, `KYC_REPORT_RECEIVED`, `KYC_COMPLETED`, `KYC_REASSIGNED`) by ALTERing `check_status_unified` + `chk_kyc_doc_workflow_status` and adding rows to `task_status_transitions` (which is **task_type-agnostic**, so new edges would leak into NORMAL/REVISIT). | Keep the 5 generic engine states on `verification_tasks`/`kyc_document_verifications` and put the **richer KYC lifecycle on the new cycle table** (`kyc_verification_cycles.status`) with its own CHECK + a KYC-only transition guard, so the FE engine is never polluted. | **B.** The shared transition trigger (`enforce_verification_task_status_transition()`, `:1507`) is not scoped by `task_type`; adding KYC edges to `task_status_transitions` would make e.g. `ASSIGNED→KYC_REPORT_RECEIVED` legal for field tasks. Model the external-verification lifecycle on the **cycle table** instead; map cycle status → engine status only at the two engine touch-points (assign = `ASSIGNED`, backend-complete = `COMPLETED`). |
| **D2** | **Cycle granularity: per-document vs per-case/per-task** | One cycle row per `kyc_document_verifications` document (fine-grained; matches current per-doc model). | One cycle row per KYC `verification_task` (a task already groups the case's KYC documents; matches billing which is per-task today). | **B (per-task), with per-document snapshot rows linked underneath.** Billing, MIS, and the "reverification = one new billable cycle" requirement all operate at the **task/case** grain (`loadCompletedUnbilledKycTasks` keys on `verification_task_id`). A per-task cycle keeps billing one-line-per-cycle clean; capture per-document results in a child snapshot table (`kyc_cycle_documents`) so document detail is retained. |
| **D3** | **KYC commission payee** | Accrue a per-cycle KYC commission to the **Backend User** who actually enters findings (they do the in-CRM work). | **Drop KYC commission entirely** — KYC is *client revenue* (invoice), not *agent payout*; the read-only verifier does no in-CRM work and `rate_type_id` is NULL by CHECK so commission is zero today anyway. | **B (drop commission), bill client revenue per cycle via invoices only.** The requirement says KYC is *billable* (client revenue), never that an agent is *paid commission*. `commission_calculations` is a field-agent-payout construct (`user_id NOT NULL`, `UNIQUE(verification_task_id)`). Route per-cycle money through `invoice_item_tasks` keyed on `cycle_id`. If the owner *wants* a payee, choose A and key commission on `cycle_id` (not `verification_task_id`). |
| **D4** | **New task per cycle vs. reuse one task + cycle table** | Spawn a **new `verification_task`** per cycle via `parent_task_id` chain (the existing REVISIT pattern, `:3750`), sidestepping the `UNIQUE(verification_task_id)` billing constraints. | **Reuse the single task** and add a `kyc_verification_cycles` child table; re-key `invoice_item_tasks` (and optionally `commission_calculations`) on `cycle_id`. | **B (reuse task + cycle table).** Spawning new tasks per cycle fragments case history, doubles the engine surface, and breaks the "one KYC task, many cycles" mental model the MIS needs. A cycle child table with re-keyed billing is the minimal, non-destructive change. (See §12.) |
| **D5** | **Where the external-verification status lives** | On `verification_tasks.status` (engine column). | On `kyc_verification_cycles.status` (cycle-local). | **B.** Same rationale as D1. The engine column stays in the 5-state world; the cycle table owns `KYC_IN_EXTERNAL_VERIFICATION` / `KYC_REPORT_RECEIVED`. |
| **D6** | **Keep `kyc.export` on the verifier?** | Keep (download of KYC package/Excel is explicitly allowed by spec). | Replace with a narrower `kyc.download` read-grant. | **A, keep `kyc.export`** plus `case.view` (which already gates attachment downloads, `attachments.ts:58-101`). Export/download is a read action and is in-scope for the verifier. Strip only the **mutating** grants. |

---

## 1. Existing Implementation Assessment (per subsystem)

### 1.1 Schema (`acs_db_final_version.sql`)
- All verification work flows through `public.verification_tasks` (`:3719`). Task kind is `task_type` enum `NORMAL|REVISIT|KYC` (`:1380`, `:3749`) — **KYC is already a first-class `task_type`**.
- `status varchar(20)` is hard-constrained by `CONSTRAINT check_status_unified` to exactly `{PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, REVOKED}` (`:3761`). A DB trigger `verification_task_status_guard` (`:56325`) → `enforce_verification_task_status_transition()` (`:1507`) validates every status change against `task_status_transitions` (`:9196`). **This is a single global 5-state machine for ALL task types; transitions are not scoped by `task_type` or actor.**
- KYC document rows live in `public.kyc_document_verifications` (`:5194`): `verification_status` gated by `chk_kyc_doc_workflow_status` to the **same 5 states** (`:5225`); `final_status` gated by `chk_kyc_doc_final_status` to `{Positive,Negative,Refer,Fraud}` (`:5224`); single `rate_amount numeric(10,2)` (`:5216`).
- F9.1 (`:58033-58040`) bolted on `started_at/by`, `revoked_at/by/revocation_reason/revoke_reason_id`, and **`recheck_count integer NOT NULL DEFAULT 0`** (`:58040`) — a single mutable counter, **not history**. Companion `kyc_revocations` table (`:58042`) is an **append-only revoke ledger** (`kyc_id`, `revoked_by_user_id`, `revoked_by_role`, `revoked_from_user_id`, `previous_status`, `reassigned`/`reassigned_to_user_id`/`reassigned_at`) — it records revokes, **not completed-cycle outcome/billing**.
- F9.2 (`:58092-58103`) forced KYC tasks to carry a **synthetic "KYC Verification" `verification_type`** so shared list views render a value; the new CHECK is `verification_type_id IS NOT NULL`. So a "KYC_VERIFIER assignment" is distinguishable today **only by `task_type='KYC'`**, not a dedicated assignment-type column.
- **Roles:** `roles_v2` + `permissions` + `role_permissions` + `user_roles` join (no `users.role` column). **`KYC_VERIFIER` role already exists** as seed (`:35947`, id `678135c3-561e-478a-a3b6-6123f8babdf8`); `BACKEND_USER` also seeded.

### 1.2 RBAC
- Permission-string model. Auth context built per-request in `auth.ts:188-261` (`loadUserAuthContext`, array_aggs permission `code`s, 5s TTL cache + Redis invalidation). Enforced via `authorize('code')` / `authorizeAny([...])` (`authorize.ts:115-182`); `*` or `settings.manage` bypasses ownership.
- **The existing `KYC_VERIFIER` is NOT read-only — it is a KYC *executor*.** `role_permissions` for `678135c3…` grant `kyc.view`, **`kyc.verify`** ("Verify KYC documents Pass/Fail"), `kyc.export`, `page.kyc`, `case.view`; the F9.1 migration additionally grants **`kyc.start`** to KYC_VERIFIER (`:58066-58070`). `rbacAccess.ts:108-125 isKycExecutionActor()` explicitly classifies a `kyc.verify`/`kyc.start` holder as an **execution actor** with a self-assigned write shortcut (`kycVerificationController.ts:191`). **This is the exact opposite of the new spec.**
- `kyc.revoke`/`kyc.recheck` are granted **only** to SUPER_ADMIN/MANAGER (`:58075`) — already fits "Backend drives reverification."

### 1.3 API lifecycle (`routes/kyc.ts`, `kycVerificationController.ts`)
- KYC is implemented as a **self-service field-style flow where the assigned verifier also executes**: `GET /tasks` (`kyc.view`), `GET /tasks/:id` (`kyc.view` + `requireKycRowAccess`), **`PUT /tasks/:id/verify`** (`kyc.verify`, terminal decision, `:602`), `PUT /tasks/:id/assign` (`:777`, **no audit log**), `POST /start` (`kyc.start`, `:857`), `POST /revoke` (`:953`), `POST /recheck` (`:1055`), `POST /upload` (`kyc.verify|case.create`, `:1162`), `GET /export` (`kyc.export`).
- `verifyKYCDocument` is the **single terminal action** and gates only on **state** (`IN_PROGRESS`, `:660`), **not on WHO** — there is no guard stopping the assignee from completing. When all sibling docs are decided it rolls `verification_tasks.status='COMPLETED'` + `verification_outcome` + `TaskCompletionFinalizer.snapshotFinancials`. **It writes ZERO audit log.**

### 1.4 Mobile (`crm-mobile-native`)
- **KYC does not exist on mobile** — grep for "kyc" returns only 3 incidental comment strings; zero `task_type`/`assignment_type`/`KYC_VERIFIER` references in `src`.
- The backend already **excludes KYC from device sync**: `mobileSyncController.downloadSync` (`:495-503`) `WHERE … (vt.task_type IS NULL OR vt.task_type != 'KYC') AND (… OR vt.assigned_to = $userId)`. The completion path hard-requires ≥5 photos + ≥1 selfie + GPS (`SubmitVerificationUseCase.ts:114-153`) — unsatisfiable for KYC, but unreachable since KYC never syncs down.
- **Gap:** `mobileAuthController` login (`:139-232`) issues tokens to **any** valid-credential user with no role gate — a KYC_VERIFIER *could* authenticate (and see an empty list).

### 1.5 Web / MIS (`CRM-FRONTEND`)
- KYC UI: `KYCDashboardPage.tsx` (list, 6 routes), `KYCVerificationPage.tsx` (Pass/Fail/Refer verify page), `KYCTaskVerificationSection.tsx` (case-detail tab, verify/upload/assign — has a `readonly` prop but `CaseDetailPage` passes `readonly={false}`), `KYCDocumentSelector.tsx` (creation-time multi-select + assign-to-verifier).
- **All 7 KYC routes gate on a single coarse `page.kyc`** (`AppRoutes.tsx:802-877`) with **no read-only variant** — any `page.kyc` holder reaches the verify page and all mutating buttons render. Row action buttons (`KYCDashboardPage.tsx:633-704`) render Start+Verify/Assign/Revoke/Recheck/View **by status only, no role/permission check**.
- `navigation.ts:161-216` is one step ahead: sidebar already hides Revoke behind `kyc.revoke`, Recheck behind `kyc.recheck` ("F9.3: hide for KYC verifier"), and uses `{resource:'kyc',action:'read'}` for read sub-pages — but **page bodies are unguarded**.
- **MIS excludes KYC entirely:** `reportsController.ts:785` `conditions.push("vt.task_type <> 'KYC'")`. Operational counts come only from `getKYCTaskStats` (`:463`) bucketing the 5 engine states. `dashboardKPIService` KYC block is hardcoded to PASS/FAIL/REFER semantics (`:457-470,562-569`).

### 1.6 Billing
- KYC billing is a parallel candidate-loader bolted onto the field-task invoice generator. `loadCompletedUnbilledKycTasks` (`invoicesController.ts:225-309`) selects `verification_tasks` where `task_type='KYC' AND status='COMPLETED' AND iit.id IS NULL` (LEFT JOIN `invoice_item_tasks`, `:245`/`:302`). **"Unbilled" = no `invoice_item_tasks` link row.** Each candidate → ONE `invoice_items` line (frozen `actual_amount ?? estimated_amount`, qty=1, `verificationTypeId/rateTypeId` NULL) → one `invoice_item_tasks` row.
- **Hard wall:** `invoice_item_tasks_verification_task_id_key UNIQUE(verification_task_id)` (`:38484`) — a task can be billed **at most once, ever**. `commission_calculations_verification_task_id_unique` (`:41506`) + `ON CONFLICT (verification_task_id) DO NOTHING` (`:1213`) — same ceiling. KYC commission is currently **zero**: `autoCalculateCommissionForTask` early-returns on NULL `rate_type_id` (`:1144`), and KYC tasks are NULL `rate_type_id` by CHECK.

### 1.7 Audit + Notify
- All audit writes go through `createAuditLog` → bullmq queue (`auditLogger.ts:23`, `auditLogQueue.ts:144`), with an **HMAC hash chain** (`auditChain.ts`): `row_hash = HMAC-SHA256(secret, prev_hash || canonical(row))`; `canonicalize()` joins `action,entityType,entityId,userId,JSON(details),ip,ua,created_at` with `0x1F` — **any new property must be appended at the END** or the chain breaks. `audit_logs` is RANGE-partitioned monthly.
- Existing KYC audit codes: `KYC_STARTED`, `KYC_REVOKED`, `KYC_RECHECKED`, `KYC_EXPORTED` only. **`assignKYCTask` and `verifyKYCDocument` write NO audit log** — assignment, completion (and downloads) are unlogged.
- The case-detail "timeline" tab is a **NOTIFICATIONS timeline**, not audit (`cases.ts:449` → `CaseNotificationsTab.tsx`). `audit_logs` never render on the case page (only per-user `MyActivityTab`).
- `NotificationType` enum (`NotificationService.ts:24`) has **no KYC types**; `kycVerificationController` fires **no notifications at all** (assign/verify/recheck/revoke are silent).

---

## 2. Gap Analysis (requirement vs current, severity-ranked)

### CRITICAL
| ID | Gap | Evidence |
|----|-----|----------|
| **G1** | **No KYC cycle table — reverification overwrites history.** Recheck mutates the single `kyc_document_verifications` row IN PLACE, NULLing `verified_at/by`, `final_status`, `assigned_to/by/at`, `started_at/by`, `remarks`, `rejection_reason` (`kycVerificationController.ts:1089-1108`). Cycle-1's verifier, completion date, result and billing are destroyed; only `recheck_count` survives. Directly violates "do NOT overwrite historical KYC records." | `:58040`, `kycVerificationController.ts:1088-1124` |
| **G2** | **Billing UNIQUE constraints block per-cycle invoice lines.** `invoice_item_tasks UNIQUE(verification_task_id)` (`:38484`) permits exactly one billing row per task; `loadCompletedUnbilledKycTasks` gates on `iit.id IS NULL` (`:245`). After cycle-1 bills, the link persists through recheck (never deleted) → the re-completed task is seen as **already-billed** and never re-offered. Each reverification being separately billable is impossible. | `:38484`, `invoicesController.ts:225-309` |
| **G3** | **Existing `KYC_VERIFIER` holds write/execution perms** (`kyc.verify`, `kyc.start`, `kyc.export`) and is modeled as an execution actor — opposite of the read-only spec. | `role_permissions` for `678135c3…`, `:58066-58070`, `rbacAccess.ts:108-125` |
| **G4** | **No read-only KYC UI** — every KYC surface mixes view with mutation controls gated only on coarse `page.kyc`; verify/start/assign/revoke/recheck/upload render with no per-control role check. | `KYCDashboardPage.tsx:633-704`, `KYCVerificationPage.tsx:270-324`, `AppRoutes.tsx:802-877` |

### HIGH
| ID | Gap | Evidence |
|----|-----|----------|
| **G5** | **Status CHECKs can't express the external-verification lifecycle** (`KYC_IN_EXTERNAL_VERIFICATION`, `KYC_REPORT_RECEIVED` have no home); and because the transition trigger is `task_type`-agnostic, new KYC edges would leak into NORMAL/REVISIT. | `:3761`, `:5225`, `:1507`, `:36266` |
| **G6** | **No who-guard on completion.** `verifyKYCDocument` gates only on `IN_PROGRESS` state, not actor; nothing stops the assignee from completing. | `kycVerificationController.ts:602,660` |
| **G7** | **MIS excludes KYC** (`reportsController.ts:785`) — none of the 7 required KYC metrics exist; "Report Awaited" / "Pending with Verifier" have no state to count; Reverification/Billable/Revenue counts cannot be sourced from the destructive single row. | `reportsController.ts:783-785` |
| **G8** | **No per-cycle billing-eligibility / captured rate.** Single mutable `rate_amount`; no per-cycle `billable` flag or snapshot. | `:5216` |
| **G9** | **`assigned-to-verifier`, `completed-by-backend-user`, `downloaded-by-verifier`, `reassigned`, `cycle-created` audit events do not exist.** `assignKYCTask`/`verifyKYCDocument` write no audit; no download audit on KYC routes. | `kycVerificationController.ts:602,777`; download audit absent |
| **G10** | **No KYC notification types or producers.** No `KYC_ASSIGNED`/`KYC_REPORT_RECEIVED`; KYC controller fires nothing. | `NotificationService.ts:24`; controller has no `queue*` calls |
| **G11** | **No read/verify split in FE routing** — `page.kyc` reaches the live verify page. | `AppRoutes.tsx:871-873` |

### MED / LOW
| ID | Gap | Sev |
|----|-----|-----|
| **G12** | No dedicated `KYC_VERIFIER` assignment-type dimension (relies on `task_type='KYC'`; KYC piggybacks the FE `verification_type` taxonomy → MIS that groups by `verification_type` conflates KYC unless filtered). | MED |
| **G13** | No DB-level actor/role guard on who may set `COMPLETED`/`final_status` — read-only enforcement is app-layer only. | MED |
| **G14** | Case-detail timeline surfaces notifications only, not `audit_logs`. | MED |
| **G15** | Mobile login has no role gate — a KYC_VERIFIER can authenticate (empty list, but not blocked). | MED |
| **G16** | Mobile sync **attachment** delta query lacks the `task_type != 'KYC'` predicate the task query has — latent leak if an assignment is ever mis-routed. | LOW |
| **G17** | `old_values`/`new_values` audit columns unused by `createAuditLog` (deltas shoved into `details`). | LOW |

**Totals: 4 CRITICAL, 7 HIGH, 6 MED/LOW.**

---

## 3. Database Changes (raw SQL DDL — NOT Prisma)

All DDL is idempotent psql, to be added as a new migration file `CRM-BACKEND/migrations/2026-06-02_kyc_verifier_cycles.sql`. Designed so the **FE engine (`verification_tasks` 5-state machine + trigger) is never altered** (per D1/D5).

### 3.1 KYC_VERIFIER role — already exists; reshape its grants only
The role row (`678135c3-561e-478a-a3b6-6123f8babdf8`) already exists. We **revoke** write perms and keep read/download perms (see §6 for exact SQL).

### 3.2 KYC assignment-type marker (G12)
Add an explicit, queryable assignment-type without disturbing FE. Minimal, additive:

```sql
-- Explicit assignment-type enum so KYC_VERIFIER assignment is a first-class dimension
-- (today only inferable from task_type='KYC'). Nullable + default keeps FE rows untouched.
DO $$ BEGIN
  CREATE TYPE public.assignment_type_enum AS ENUM ('FIELD_EXECUTIVE','KYC_VERIFIER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.verification_tasks
  ADD COLUMN IF NOT EXISTS assignment_type public.assignment_type_enum;

-- Backfill: existing KYC tasks => KYC_VERIFIER, all others => FIELD_EXECUTIVE
UPDATE public.verification_tasks
   SET assignment_type = CASE WHEN task_type = 'KYC'
                              THEN 'KYC_VERIFIER'::public.assignment_type_enum
                              ELSE 'FIELD_EXECUTIVE'::public.assignment_type_enum END
 WHERE assignment_type IS NULL;
```
(Optional, deferred: a CHECK tying `assignment_type='KYC_VERIFIER'` ⟺ `task_type='KYC'`. Left out initially to avoid coupling to F9.2's synthetic verification_type carve-out.)

### 3.3 Reverification CYCLE table (G1, G8) — never overwrites history
**Append-only, per-task (D2), immutable snapshot per cycle.**

```sql
CREATE TABLE IF NOT EXISTS public.kyc_verification_cycles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_task_id  uuid NOT NULL REFERENCES public.verification_tasks(id) ON DELETE CASCADE,
  case_id               uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  cycle_number          integer NOT NULL CHECK (cycle_number >= 1),

  -- Verifier (read-only) assignment snapshot
  assigned_verifier_id  uuid REFERENCES public.users(id),
  assigned_by           uuid REFERENCES public.users(id),
  assigned_at           timestamptz,

  -- External-verification lifecycle (D1/D5: KYC lifecycle lives HERE, not on the engine)
  status                varchar(32) NOT NULL DEFAULT 'KYC_ASSIGNED',
  report_received_at    timestamptz,

  -- Backend-user completion snapshot (the actual executor)
  completed_by          uuid REFERENCES public.users(id),
  completed_at          timestamptz,
  final_status          varchar(20),   -- {Positive,Negative,Refer,Fraud} on completion

  -- Per-cycle billing snapshot (G8)
  rate_amount           numeric(10,2),
  billable              boolean NOT NULL DEFAULT true,
  billed                boolean NOT NULL DEFAULT false,   -- set true when an invoice line is created

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_kyc_cycle_per_task UNIQUE (verification_task_id, cycle_number),
  CONSTRAINT chk_kyc_cycle_status CHECK (status = ANY (ARRAY[
    'KYC_ASSIGNED','KYC_IN_EXTERNAL_VERIFICATION','KYC_REPORT_RECEIVED',
    'KYC_COMPLETED','KYC_REASSIGNED'])),
  CONSTRAINT chk_kyc_cycle_final_status CHECK (
    final_status IS NULL OR final_status = ANY (ARRAY['Positive','Negative','Refer','Fraud']))
);

CREATE INDEX IF NOT EXISTS idx_kyc_cycle_task   ON public.kyc_verification_cycles(verification_task_id);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_case   ON public.kyc_verification_cycles(case_id);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_status ON public.kyc_verification_cycles(status);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_unbilled
  ON public.kyc_verification_cycles(billable, billed) WHERE billable = true AND billed = false;
```

Optional per-document detail snapshot (keeps D2's "per-document results under a per-task cycle"):
```sql
CREATE TABLE IF NOT EXISTS public.kyc_cycle_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id            uuid NOT NULL REFERENCES public.kyc_verification_cycles(id) ON DELETE CASCADE,
  kyc_id              uuid NOT NULL REFERENCES public.kyc_document_verifications(id),
  document_type_id    integer,
  final_status        varchar(20),
  document_file_path  text,
  storage_key         text,
  sha256              text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyc_cycle_docs_cycle ON public.kyc_cycle_documents(cycle_id);
```

### 3.4 Re-key billing on cycle (G2)
Per D4, **reuse one task** and move the billing unique from task to cycle.

```sql
-- Link invoice lines to a specific cycle (additive; FE/field rows keep NULL cycle_id)
ALTER TABLE public.invoice_item_tasks
  ADD COLUMN IF NOT EXISTS kyc_cycle_id uuid REFERENCES public.kyc_verification_cycles(id);

-- The blocker: drop the per-task unique, replace with a partial unique that is
-- per-cycle for KYC and unchanged (one-per-task) for field tasks.
ALTER TABLE public.invoice_item_tasks
  DROP CONSTRAINT IF EXISTS invoice_item_tasks_verification_task_id_key;

-- Field tasks (kyc_cycle_id IS NULL): preserve original "one line per task ever".
CREATE UNIQUE INDEX IF NOT EXISTS uq_iit_task_when_not_kyc
  ON public.invoice_item_tasks(verification_task_id)
  WHERE kyc_cycle_id IS NULL;

-- KYC cycles: one billing line per cycle.
CREATE UNIQUE INDEX IF NOT EXISTS uq_iit_kyc_cycle
  ON public.invoice_item_tasks(kyc_cycle_id)
  WHERE kyc_cycle_id IS NOT NULL;
```
> **Backward-compat note:** dropping the named constraint and re-adding it as a partial unique on `WHERE kyc_cycle_id IS NULL` preserves the exact "one line per field task" invariant for all existing rows (their `kyc_cycle_id` is NULL). No existing invoice data changes.

(If D3=A — commission to backend user — apply the identical pattern to `commission_calculations`: add `kyc_cycle_id`, drop `commission_calculations_verification_task_id_unique`, add two partial uniques. Default D3=B drops commission, so this is **not** part of the default plan.)

### 3.5 New permission strings (G6/G9; see §6)
```sql
INSERT INTO public.permissions (code, module, description) VALUES
  ('kyc.complete', 'kyc', 'Backend User: enter findings and complete a KYC cycle'),
  ('kyc.reverify', 'kyc', 'Backend User/Manager: open a new billable KYC reverification cycle'),
  ('kyc.download', 'kyc', 'Download assignment/customer docs + KYC package (read-only)')
ON CONFLICT (code) DO NOTHING;
```

### 3.6 New audit action codes (no DDL; data/constant only)
`KYC_ASSIGNED_TO_VERIFIER`, `KYC_DOC_DOWNLOADED`, `KYC_REPORT_RECEIVED`, `KYC_CYCLE_CREATED`, `KYC_REASSIGNED`, `KYC_COMPLETED` — these are `action varchar(50)` values written via `createAuditLog`; no schema change. (`action` is free-form varchar.)

---

## 4. "Prisma Model Changes" — N/A (raw pg/SQL restatement)

**This repository contains no Prisma.** There is no `schema.prisma`, no `@prisma/client` import anywhere in `CRM-BACKEND/src` or `CRM-FRONTEND/src`, and no `prisma/` directory. The only Prisma tokens in the repo are two **stale eslint ignore globs** (`CRM-BACKEND/eslint.config.js:22`, `.eslintrc.js:27`) referencing a nonexistent `prisma/migrations/` — dead config, recommend deleting them in a follow-up (out of scope here).

Therefore "Prisma model changes" map **one-to-one** onto the **raw SQL DDL in Section 3**, delivered as a psql migration file:
- New table `kyc_verification_cycles` (+ optional `kyc_cycle_documents`) → §3.3
- New enum `assignment_type_enum` + `verification_tasks.assignment_type` column → §3.2
- Re-keyed `invoice_item_tasks` billing uniqueness → §3.4
- New permission rows + role-grant reshape → §3.5, §6
No ORM model files exist to edit; all access is `pg` queries in the controllers/services cited throughout.

---

## 5. API Changes

### 5.1 Guards that stop the assignee (read-only verifier) from start/verify/complete (G3/G6/G11)
The decisive fix is **permission re-grants + per-route gates**, plus an **actor assertion** on the terminal paths:
- **Strip** `kyc.verify` and `kyc.start` from `KYC_VERIFIER` (§6). Because `PUT /tasks/:id/verify` gates `authorize('kyc.verify')` and `POST /start` gates `authorize('kyc.start')`, removing the grants denies both for the verifier with no route change.
- `POST /tasks/:id/upload` gates `authorizeAny(['kyc.verify','case.create'])` — once `kyc.verify` is removed and the verifier never holds `case.create`, upload is denied automatically.
- **Defense in depth (recommended):** in `verifyKYCDocument` (`:602`) and the new complete endpoint, assert `req.user.id !== kdv.assigned_verifier_id` is *not the only* authority — i.e. add an explicit guard that the actor holds `kyc.complete`, not merely row-access. The current `requireKycRowAccess` self-assigned shortcut (`:191`) must be **scoped to READ endpoints only**; rename/split it (`requireKycRowReadAccess`) so verify/complete/upload never accept a self-assigned read-only verifier.

### 5.2 New / changed endpoints
| Method/Path | Handler | Guard | Purpose |
|---|---|---|---|
| `PUT /api/kyc/tasks/:taskId/verify` | `verifyKYCDocument` (modified) | `authorize('kyc.complete')` **was** `kyc.verify` | **Backend-User-only** findings entry + cycle completion. Now also: (a) write `KYC_COMPLETED` audit (§11), (b) **snapshot the active cycle** (set `completed_by`,`completed_at`,`final_status`,`status='KYC_COMPLETED'`) instead of only mutating the live row, (c) queue `KYC_REPORT_RECEIVED`/completion notification. |
| `POST /api/kyc/tasks/:taskId/assign` | `assignKYCTask` (modified) | `authorizeAny(['kyc.assign','case.create','case.assign','case.reassign'])` | Now also: create **cycle 1** if none exists, write `KYC_ASSIGNED_TO_VERIFIER` audit (currently writes none), queue `KYC_ASSIGNED` notification to the verifier. |
| `POST /api/kyc/tasks/:taskId/report-received` | **NEW** `markKycReportReceived` | `authorize('kyc.complete')` (Backend User) | Optional explicit "report received from verifier" transition → cycle `status='KYC_REPORT_RECEIVED'`, `report_received_at=now()`. Lets MIS distinguish "Pending with Verifier" vs "Report Awaited". |
| `POST /api/kyc/tasks/:taskId/reverify` | **NEW** `createKycReverificationCycle` | `authorize('kyc.reverify')` (Backend/Manager) | **Replaces destructive recheck for the cycle path.** INSERTs a **new** `kyc_verification_cycles` row (`cycle_number = max+1`, `status='KYC_REASSIGNED'`), re-opens the engine task `COMPLETED→ASSIGNED` (edge already seeded `:58081`), reassigns to a verifier, writes `KYC_CYCLE_CREATED` + `KYC_REASSIGNED` audit. **Never NULLs the prior cycle.** |
| `GET /api/kyc/tasks/:taskId/cycles` | **NEW** `listKycCycles` | `authorizeAny(['kyc.view','case.view'])` | Per-cycle history for case timeline + MIS drill-down. |
| `GET /api/kyc/tasks/:taskId/download` (and existing attachment routes) | download handler(s) | `case.view` (existing) | Add a `KYC_DOC_DOWNLOADED` audit write on each verifier download (G9). |
| `GET /api/kyc/mis` | **NEW** `getKycMis` | `authorize('report.generate')` or analytics perm | The 7 KYC MIS metrics over the cycle table (§10). Not held by verifier. |

### 5.3 Unchanged
`GET /document-types`, `GET /tasks`, `GET /tasks/stats`, `GET /cases/:caseId/tasks`, `GET /export` keep current behavior (read/download) — verifier retains these.

---

## 6. Permission Changes

### 6.1 KYC_VERIFIER — exact read-only set
**KEEP (read/download):** `kyc.view`, `page.kyc`, `case.view` (unlocks attachment/customer-doc downloads, `attachments.ts:58-101`), `kyc.export` (D6), **add** `kyc.download`.
**REMOVE (mutating):** `kyc.verify`, `kyc.start`. (Verifier already lacks `kyc.revoke`, `kyc.recheck`, `kyc.assign`, `case.create`, `case.assign`, `case.reassign`, `billing.*`, `report.download`, `report.generate` — keep it that way.)

```sql
-- Strip write/execution grants from KYC_VERIFIER (id 678135c3-...)
DELETE FROM public.role_permissions
 WHERE role_id = '678135c3-561e-478a-a3b6-6123f8babdf8'
   AND permission_id IN (SELECT id FROM public.permissions WHERE code IN ('kyc.verify','kyc.start'));

-- Grant the read-only download permission
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT '678135c3-561e-478a-a3b6-6123f8babdf8', p.id, true
  FROM public.permissions p WHERE p.code = 'kyc.download'
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;
```

### 6.2 BACKEND_USER (the executor)
Grant `kyc.view`, `kyc.complete` (new — verify/upload/complete), `kyc.reverify` (new — open a new cycle), `kyc.assign`, `case.create/case.view`, plus the existing billing/MIS perms it already holds. SUPER_ADMIN/MANAGER retain `kyc.revoke`/`kyc.recheck` (`:58075`).

```sql
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
  FROM public.roles_v2 r
  JOIN public.permissions p ON p.code IN ('kyc.complete','kyc.reverify')
 WHERE r.name IN ('BACKEND_USER','SUPER_ADMIN','MANAGER')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;
```
> After any role_permissions change, the per-request cache (`auth.ts`, 5s TTL + Redis pub/sub) self-invalidates — no deploy-coupled cache flush needed.

---

## 7. UI Changes

### 7.1 KYC Verifier portal (completely read-only)
- **Routing:** introduce a read-only gate. Either (preferred) gate the **verify route** `/kyc-verification/verify/:taskId` body on `usePermission('kyc.complete')` and render a **view-only** variant for holders of only `page.kyc`/`kyc.view`; or add a dedicated `/kyc-verification/assigned` read-only "My Assigned KYC" page. `navigation.ts` already has the `kyc.read` vs `kyc.revoke`/`kyc.recheck` scaffolding — extend it to gate page bodies.
- **`KYCDashboardPage.tsx` (`:633-704`):** wrap every action button (Start+Verify, Assign/Reassign, Revoke, Recheck) in `hasPermission('kyc.complete' | 'kyc.assign' | 'kyc.revoke' | 'kyc.recheck')`. The verifier sees **only View + Download**. Scope the list to `assigned_to = self` for the verifier (backend `buildKycTasksBaseWhereClause` already scopes by actor — confirm verifier path filters to self).
- **`KYCVerificationPage.tsx` (`:270-324`):** hide the entire Pass/Fail/Refer "Verification Decision" card and `handleVerify` unless `hasPermission('kyc.complete')`. Verifier sees customer/doc info + **document download** only.
- **`KYCTaskVerificationSection.tsx`:** derive `readonly` from role — `readonly = !hasPermission('kyc.complete')`. The `readonly` path already hides upload/assign/verify (the right shape); just wire it from permission instead of the hardcoded `readonly={false}` in `CaseDetailPage.tsx:473`.
- **Search:** assigned-cases search is a read GET — keep as-is for the verifier.
- **Case creation / `KYCDocumentSelector`:** verifier must never reach `/case-management/create` — `ProtectedRoute` + nav already keep non-`case.create` roles out; verify the verifier role is excluded.

### 7.2 Backend-User findings-entry screen
- The existing verify page **becomes** the Backend User's findings-entry screen (gated on `kyc.complete`): document viewer + Pass/Fail/Refer/Fraud + optional report upload + "Mark KYC Complete". Add a **cycle banner** ("Cycle N of M") and a **"Reverify / open new cycle"** action (gated `kyc.reverify`) on a completed task.
- A **per-cycle history panel** (from `GET /tasks/:taskId/cycles`) showing each cycle's verifier, assigned/completed dates, result, billable flag.

### 7.3 MIS UI
New KYC MIS section/cards driven by `GET /api/kyc/mis` (§10), distinct from the field-task MIS (which stays KYC-excluded).

---

## 8. Mobile Impact Analysis (confirm minimal)

**Mobile requires essentially no feature work; the requirement is the *negative* one — KYC must never surface to field agents or mobile.**
- KYC tasks already **never sync to devices**: `mobileSyncController.downloadSync:499` excludes `task_type='KYC'`. The new cycle/reverification model reuses the same `task_type='KYC'` task, so re-opened/reassigned KYC tasks remain excluded automatically. **No change needed to keep them off-device.**
- **Two hardening items (recommended, small):**
  1. **(G15)** Add a server-side role gate in `mobileAuthController` login (`:139-232`): reject (403) when the user is **not** a field-execution actor (or specifically when primary role is `KYC_VERIFIER`). Today any valid-credential user gets a token (empty task list, but not blocked). This keeps KYC Verifier strictly web-only.
  2. **(G16)** Mirror the `vt.task_type != 'KYC'` predicate into the mobile sync **attachment** delta query (`mobileSyncController.ts:546-549`), which currently filters only by `assigned_to=userId`. Defense-in-depth against a mis-routed assignment.
- **FE workflow unchanged:** `SubmitVerificationUseCase` / `CompleteTaskUseCase` photo+GPS gates are untouched and remain unreachable for KYC. No `task_type`/`assignment_type` awareness is added to the app (the desired state).

---

## 9. Billing Impact Analysis

### 9.1 Per-cycle billable model
- Each **cycle** (initial + every reverification) is an independent billable entity via `kyc_verification_cycles` with its own `id`, `rate_amount`, `billable`, `billed`.
- **Invoice line generation** changes from task-keyed to **cycle-keyed**. Replace/augment `loadCompletedUnbilledKycTasks` (`invoicesController.ts:225`) with **`loadCompletedUnbilledKycCycles`**:
  ```sql
  SELECT c.* FROM kyc_verification_cycles c
   WHERE c.status = 'KYC_COMPLETED'
     AND c.billable = true
     AND c.billed   = false      -- replaces the iit.id IS NULL gate
  ```
  Each unbilled cycle → ONE `invoice_items` line (reusing the existing frozen-snapshot path: qty=1, `verificationTypeId/rateTypeId` NULL) → ONE `invoice_item_tasks` row carrying `kyc_cycle_id = c.id` and `verification_task_id`. On insert, set `c.billed = true`.
- **Reconciles `iit.id IS NULL`:** the old unbilled signal was permanently FALSE after cycle 1 because the link persisted (G2). The new signal `cycle.billed = false` is **per-cycle**, so cycle 2/3 of the *same task* each qualify exactly once. The §3.4 partial unique `uq_iit_kyc_cycle ON (kyc_cycle_id)` enforces "one line per cycle."
- **GST** is invoice-level (`resolveInvoiceGst` on subtotal, `:489`) — unaffected; it applies to whatever lines exist, including multiple KYC cycle lines.
- **MIS/invoices show separate entries per cycle** because each cycle is a separate `invoice_items` line with its own `billed_amount`.

### 9.2 KYC commission question
**Recommended (D3=B): drop KYC commission.** The read-only verifier does no in-CRM work; the Backend User does the entry. KYC is **client revenue** (invoice), conceptually distinct from **field-agent payout** (`commission_calculations`, `user_id NOT NULL`, task-unique). Today KYC commission is already zero (NULL `rate_type_id` early-return, `:1144`). Keep it zero; route all KYC money through invoices.
*If the owner chooses D3=A* (pay the backend user a per-cycle KYC fee), apply the §3.4 re-key pattern to `commission_calculations` (add `kyc_cycle_id`, drop `…verification_task_id_unique`, add partial uniques) and key the payee on `cycle.completed_by`. This is **net-new** and not in the default plan.

### 9.3 Cancellation path
The H-8 CANCELLED re-bill path (`invoicesController.ts:1140-1147`) deletes `invoice_item_tasks` on invoice cancel. Under the cycle model, on delete also reset the corresponding `cycle.billed = false` (so a cancelled cycle re-enters the loader) — but **never delete the cycle row** (preserves history).

---

## 10. MIS Impact Analysis (7 required metrics → data sources)

MIS reads from the **new `kyc_verification_cycles`** table (not the destructive single row), exposed via `GET /api/kyc/mis`. Field-task MIS stays KYC-excluded (`reportsController.ts:785`) — this is a **separate** KYC MIS section.

| Metric | Source / definition |
|---|---|
| **Total KYC Assigned** | `COUNT(*) FROM kyc_verification_cycles` (every cycle ever assigned to a verifier) — or distinct tasks if "cases" is wanted. Cycle table captures lifetime assignment, fixing the "only current ASSIGNED" limitation of `stats.assigned`. |
| **KYC Pending with Verifier** | `COUNT WHERE status IN ('KYC_ASSIGNED','KYC_IN_EXTERNAL_VERIFICATION')` — now representable because the external-verification lifecycle lives on the cycle (D5). |
| **KYC Report Awaited** | `COUNT WHERE status = 'KYC_REPORT_RECEIVED'` vs awaited — i.e. cycles where the verifier was assigned but no `report_received_at` yet → `status='KYC_IN_EXTERNAL_VERIFICATION' AND report_received_at IS NULL`. The explicit `report-received` transition (§5.2) makes "awaited" vs "received" distinguishable (impossible today). |
| **KYC Completed** | `COUNT WHERE status = 'KYC_COMPLETED'` (per cycle) — or distinct completed tasks. |
| **KYC Reverification Count** | `COUNT WHERE cycle_number > 1` (true per-cycle count, replacing the flat, breakdown-less `SUM(recheck_count)`). |
| **Billable KYC Count** | `COUNT WHERE billable = true` (optionally split `billed`/unbilled). |
| **KYC Revenue Count** | `SUM(rate_amount) WHERE billable = true` joined to actual `invoice_item_tasks.billed_amount` for realized vs eligible revenue. |

`dashboardKPIService` KYC block (`:457-470`) should re-source `passed/failed/referred/verifiedToday` from **cycle `completed_at`/`final_status` (set by the Backend User)**, not from the verifier — under the new model the verifier never sets `final_status`.

---

## 11. Audit Trail Design

### 11.1 New events (free-form `action varchar(50)`; no schema change)
| Action | entity_type | When | details payload |
|---|---|---|---|
| `KYC_ASSIGNED_TO_VERIFIER` | `KYC` | `assignKYCTask` | `{ verifierId, cycle, caseId }` |
| `KYC_DOC_DOWNLOADED` | `KYC` | every verifier download route (**not logged today**, G9) | `{ documentId, kind:'assignment'|'customer'|'package', cycle }` |
| `KYC_REPORT_RECEIVED` | `KYC` | backend marks report received | `{ cycle, verifierId }` |
| `KYC_CYCLE_CREATED` | `KYC` | `createKycReverificationCycle` | `{ cycle, prevCycle, reason }` |
| `KYC_REASSIGNED` | `KYC` | reverify assigns a new verifier | `{ cycle, fromVerifierId, toVerifierId }` |
| `KYC_COMPLETED` | `KYC` | `verifyKYCDocument` completion (**not logged today**, G9) | `{ cycle, completedBy, finalStatus }` |

### 11.2 Hash-chain compatibility (critical correctness note)
- `audit_logs.row_hash = HMAC(secret, prev_hash || canonicalize(row))`; `canonicalize()` (`auditChain.ts:34`) joins `action,entityType,entityId,userId,JSON(details),ip,ua,created_at` with `0x1F`. **Cycle data goes into `details` (e.g. `details.cycle`)** — `details` is already part of the canonical string, so **no chain change and no schema change** is needed. This is the safe path.
- **Footgun to avoid:** do **NOT** add a new top-level column to `audit_logs` and expect it hashed — it would be invisible to `canonicalize()` and any new property MUST be appended at the **end** of the canonical join, never inserted mid-string (would silently invalidate every subsequent row). Keep all KYC cycle metadata inside `details`.
- `old_values`/`new_values` columns remain unused by `createAuditLog` (G17) — fine; put status/result deltas in `details`.

### 11.3 Timeline visibility (G14)
The case-detail "timeline" renders **notifications**, not audit. To surface assigned/downloaded/reassigned/cycle/completed on the case page, choose one:
- **(Recommended, low-effort)** also emit a **notification row** for the user-facing events (assignment, report-received, completion) so they appear in the existing notifications timeline; keep the full immutable record in `audit_logs`.
- **(Larger)** add a new case-scoped audit-history endpoint + tab that reads `audit_logs WHERE entity_type='KYC' AND entity_id` for the case's KYC tasks.

---

## 12. Reverification Architecture (the KYC Cycle model)

### 12.1 Entity design
`kyc_verification_cycles` (§3.3) — **append-only, one row per (task, cycle_number)**, each an **immutable snapshot** of `{assigned_verifier_id, assigned_at, status, report_received_at, completed_by, completed_at, final_status, rate_amount, billable, billed}`. Per-document detail in `kyc_cycle_documents`. This is the missing piece every subsystem flagged (schema/api/billing/web-mis/audit all independently call for it).

### 12.2 Lifecycle per cycle (status on the cycle, not the engine — D1/D5)
```
KYC_ASSIGNED ──(backend marks dispatched)──▶ KYC_IN_EXTERNAL_VERIFICATION
   └─(verifier reads/downloads, contacts source EXTERNALLY)
KYC_IN_EXTERNAL_VERIFICATION ──(report-received)──▶ KYC_REPORT_RECEIVED
KYC_REPORT_RECEIVED ──(backend enters findings + complete)──▶ KYC_COMPLETED   [billable → invoice line]
```
The **engine** `verification_tasks.status` only ever sees `ASSIGNED` (on assign) and `COMPLETED` (on cycle completion) — the 5-state machine is untouched and FE is unaffected.

### 12.3 How cycle N is created from completed cycle N-1 (no overwrite)
**Replace the destructive recheck for the cycle path.** Today `recheckKYCTask` NULLs `verified_at/by`, `final_status`, `assigned_to/by/at`, `started_at/by`, `remarks`, `rejection_reason` on the live row (`kycVerificationController.ts:1089-1108`) — confirmed by reading the source. The new `createKycReverificationCycle`:
1. Reads `max(cycle_number)` for the task → `N`.
2. **INSERTs** a new cycle row `(cycle_number = N+1, status='KYC_REASSIGNED', assigned_verifier_id = <new>, assigned_at = now(), billable = true)`. **Cycle N-1's row is never touched** — its verifier, dates, result, and billing remain intact (this is the core requirement).
3. Re-opens the engine task `COMPLETED → ASSIGNED` (transition already seeded `:58081`) so it can later complete again.
4. Writes `KYC_CYCLE_CREATED` + `KYC_REASSIGNED` audit; queues `KYC_ASSIGNED` notification to the new verifier.
> `recheck_count` and `kyc_revocations` can remain as legacy plumbing (revoke ledger), but the **cycle table** is the source of truth for history, billing, and MIS. The live `kyc_document_verifications` row continues to reflect the *current* cycle's working state; immutable per-cycle facts are snapshotted into `kyc_verification_cycles`/`kyc_cycle_documents` at completion.

### 12.4 Billing eligibility per cycle
Each cycle carries its own `billable`/`billed`/`rate_amount`. The cycle-aware loader (§9.1) bills each completed unbilled cycle exactly once. Day-1 KYC and the Day-20 recheck become two separate invoice lines with two separate `billed_amount`s — satisfying "each reverification = a new billable cycle; MIS+invoices show separate entries per cycle."

---

## 13. Migration Strategy

**File:** `CRM-BACKEND/migrations/2026-06-02_kyc_verifier_cycles.sql`, fully **idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`, `INSERT … ON CONFLICT DO NOTHING`, `DO $$ … EXCEPTION WHEN duplicate_object`).

**Ordered steps:**
1. New permissions (§3.5) + role-grant reshape (§6) — `ON CONFLICT DO NOTHING`/`DO UPDATE`.
2. `assignment_type_enum` + `verification_tasks.assignment_type` column + backfill (§3.2).
3. `kyc_verification_cycles` (+ `kyc_cycle_documents`) tables + indexes (§3.3).
4. **Backfill cycle 1 from existing KYC data** (non-destructive):
   ```sql
   INSERT INTO public.kyc_verification_cycles
     (verification_task_id, case_id, cycle_number, assigned_verifier_id, assigned_at,
      status, completed_by, completed_at, final_status, rate_amount, billable, billed)
   SELECT vt.id, vt.case_id, 1,
          kdv.assigned_to, kdv.assigned_at,
          CASE WHEN vt.status = 'COMPLETED' THEN 'KYC_COMPLETED' ELSE 'KYC_ASSIGNED' END,
          kdv.verified_by, kdv.verified_at, kdv.final_status,
          COALESCE(vt.actual_amount, vt.estimated_amount, kdv.rate_amount),
          true,
          (iit.id IS NOT NULL)   -- already-billed cycle-1 marked billed=true
     FROM public.verification_tasks vt
     JOIN public.kyc_document_verifications kdv ON kdv.verification_task_id = vt.id
     LEFT JOIN public.invoice_item_tasks iit ON iit.verification_task_id = vt.id
    WHERE vt.task_type = 'KYC'
   ON CONFLICT (verification_task_id, cycle_number) DO NOTHING;
   ```
   Then `UPDATE invoice_item_tasks SET kyc_cycle_id = <matching cycle 1 id>` for existing KYC lines so the new partial unique holds.
5. Re-key billing uniques (§3.4) — **after** step 4 sets `kyc_cycle_id` on existing KYC lines (so `uq_iit_kyc_cycle` is satisfiable and `uq_iit_task_when_not_kyc` covers field rows whose `kyc_cycle_id` stays NULL).

> **Triple-write invariant (per `feedback_sql_live_db_apply.md`):** every schema change must land in **(1)** the canonical dump `acs_db_final_version.sql`, **(2)** a numbered psql migration under `CRM-BACKEND/migrations/`, and **(3)** the live DB(s) — local via the migration, prod via the deploy `crm_migrate` step. After applying, cross-check local↔prod schema md5 as done in prior epics. The test-DB harness (`setup-test-db.sh`) must also apply the new migration post-dump (cf. the recent `call_confirmation` migration fix).

---

## 14. Backward Compatibility Plan

- **FE field-exec workflow untouched:** no change to `verification_tasks` `check_status_unified`, the transition trigger, or `task_status_transitions` (D1/D5 keep the KYC lifecycle off the engine). `assignment_type` is additive/nullable and backfilled to `FIELD_EXECUTIVE` for all field rows. Mobile sync exclusion is unchanged.
- **Existing KYC single-row data preserved:** `kyc_document_verifications` keeps working as the *current-cycle* working row; the migration **reads** it to seed cycle 1 (no destructive edit). `recheck_count`/`kyc_revocations` remain.
- **Existing invoices intact:** the per-task unique is replaced by a partial unique on `WHERE kyc_cycle_id IS NULL`, which is satisfied identically by every existing field-task line (their `kyc_cycle_id` is NULL). Existing KYC lines get `kyc_cycle_id` backfilled to their cycle 1, so the per-cycle unique holds. No invoice amounts change.
- **Permission cache:** `role_permissions` changes self-invalidate via the 5s TTL + Redis pub/sub (`auth.ts`) — no stale-permission window beyond TTL.
- **Read-only enforcement is app-layer** (G13): the DB does not block a verifier from completing; the route gates + actor assertion (§5.1) are the enforcement. Document this explicitly so a future schema reader doesn't assume DB-level protection.

---

## 15. Step-by-Step Implementation Plan (phased, dependency-ordered)

**Phase 0 — RBAC reshape (no data model risk).**
- Add `kyc.complete`/`kyc.reverify`/`kyc.download` perms; strip `kyc.verify`/`kyc.start` from KYC_VERIFIER; grant complete/reverify to BACKEND_USER/SUPER_ADMIN/MANAGER.
- *Verify:* a KYC_VERIFIER token's `permissionCodes` no longer contains `kyc.verify`/`kyc.start`; `PUT /verify` returns 403 for the verifier; BACKEND_USER can still call it via `kyc.complete` (after Phase 2 route swap, temporarily keep `kyc.verify` granted to backend roles until the swap).

**Phase 1 — Cycle schema + backfill (DB).**
- Apply migration §13 steps 1-4 (perms already done in Phase 0; here: enum/column, cycle tables, backfill cycle 1). Do **not** yet re-key billing.
- *Verify:* `SELECT count(*) FROM kyc_verification_cycles` equals count of existing KYC docs; every existing KYC `invoice_item_tasks` row has `kyc_cycle_id` set; local↔prod schema md5 identical.

**Phase 2 — Backend API: read-only guards + audit + notifications.**
- Swap `/verify` to `authorize('kyc.complete')`; split `requireKycRowAccess` into read-only vs execute; add cycle snapshot-on-complete; add `KYC_ASSIGNED_TO_VERIFIER`/`KYC_COMPLETED`/`KYC_DOC_DOWNLOADED` audit; add `KYC_ASSIGNED` notification on assign.
- *Verify:* completing a KYC task writes a `KYC_COMPLETED` audit row + sets `cycle.status='KYC_COMPLETED'`; a download writes `KYC_DOC_DOWNLOADED`; verifier `PUT /verify` → 403; assign → verifier receives notification.

**Phase 3 — Reverification endpoint (non-destructive cycle creation).**
- Add `POST /tasks/:taskId/reverify` (`kyc.reverify`) that INSERTs cycle N+1, re-opens engine `COMPLETED→ASSIGNED`, audits `KYC_CYCLE_CREATED`/`KYC_REASSIGNED`. Stop using destructive `recheckKYCTask` for the new flow (leave it for legacy/admin if desired).
- *Verify:* reverify a completed task → new cycle row with `cycle_number=2`, **cycle-1 row unchanged** (verifier/dates/result/billing intact); engine task back to `ASSIGNED`.

**Phase 4 — Billing per cycle.**
- Re-key `invoice_item_tasks` (§3.4); replace loader with `loadCompletedUnbilledKycCycles` (`cycle.billed=false`); set `billed=true` + `kyc_cycle_id` on line insert; update H-8 cancel to reset `billed`.
- *Verify:* complete cycle 1 → invoice line A; reverify + complete cycle 2 → a **second** invoice line B for the same case; both appear separately; the per-cycle partial unique blocks a duplicate line for the same cycle.

**Phase 5 — MIS + dashboard.**
- Add `GET /api/kyc/mis` computing the 7 metrics over the cycle table; build the KYC MIS UI section; re-source `dashboardKPIService` KYC block to cycle `completed_at`/`final_status`.
- *Verify:* MIS shows Total Assigned / Pending with Verifier / Report Awaited / Completed / Reverification Count / Billable Count / Revenue consistent with seeded cycle data.

**Phase 6 — FE read-only portal + backend-user findings screen.**
- Gate all KYC action controls on permissions (`KYCDashboardPage`, `KYCVerificationPage`, `KYCTaskVerificationSection.readonly` from role); add cycle history panel + "Reverify" action; verifier sees view+download only.
- *Verify:* logged in as KYC_VERIFIER — no Start/Verify/Assign/Revoke/Recheck/Upload controls render, downloads work, verify page is view-only; logged in as BACKEND_USER — full findings entry + reverify.

**Phase 7 — Mobile hardening.**
- Add field-execution-actor login gate in `mobileAuthController`; mirror `task_type != 'KYC'` into the sync attachment delta query.
- *Verify:* a KYC_VERIFIER cannot obtain a mobile token (403); no KYC attachment can appear in `/sync/download` even for a mis-routed assignment.

**Phase 8 — Timeline + final audit pass.**
- Surface KYC events on the case timeline (emit notification rows or add an audit-history tab); confirm hash-chain integrity (`details.cycle` only, appended-at-end discipline).
- *Verify:* case timeline shows assigned/downloaded/report-received/completed/reverified; audit chain verification passes end-to-end.

---

*End of deliverable. No code was modified; this document is the sole artifact written.*
