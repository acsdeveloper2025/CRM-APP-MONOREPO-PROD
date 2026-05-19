Resume context for CRM-APP-MONOREPO-PROD.

──────────────────────────────────────────────────────────────────────

Read MEMORY.md in full + read these 5 always (rule + runbook layer):
  feedback_use_karpathy_guidelines.md
  feedback_ask_before_acting.md
  feedback_cave_mode.md
  feedback_sql_live_db_apply.md
  feedback_full_stack_gates_before_push.md

Do NOT bulk-read the other linked files at session start.
MEMORY.md one-line summaries are the routing layer — read on demand.

──────────────────────────────────────────────────────────────────────
WHERE WE LEFT OFF (last session: 2026-05-19, iOS pipeline unblock + v1.0.57)
──────────────────────────────────────────────────────────────────────

EVERYTHING WAS COMMITTED, PUSHED, AND CI-VERIFIED. Both repos clean.

  monorepo `main` @ 3e5fc875 — docs commit landed
  crm-mobile-native `main` @ 82c2351 — 8 new commits today, FF-merged from PR #1
  tag v1.0.57 pushed → APK + AAB + simulator.app.zip + 3×sha256 in GH Release
  iOS CI Stage 1 GREEN on main (sim-only smoke test, no signing)
  Android Release workflow GREEN
  BE FCM push pipeline functional end-to-end (service-account on prod, pm2 restarted)

────────────────────────────────────────────────────────────────────
THE 3 OPEN ITEMS (PICK ONE)
────────────────────────────────────────────────────────────────────

  1. T0-9 iOS pin smoke test (mitmproxy)
     - Firebase blocker is closed; iOS app boots clean on real iPhone now
     - Runbook: crm-mobile-native/docs/t0-9-smoke-test-runbook.md
     - Expected: app login FAILS through mitmproxy = pin enforces

  2. Tier 1 audit (AUDIT_2026_05_17_CODE_QUALITY.md §13, 16 items open)
     - §14 suggests weeks 4-5 sequence:
       T1-1 audit-log tamper-evidence (hash chain)
       T1-2 MFA on admin/billing.approve/settings.manage accounts
       T1-3 DPDP breach-notification scaffolding
       T1-9 PII redaction in BE logs (logRedact.ts SENSITIVE_KEYS sweep)

  3. Other open items (smaller)
     - NEW-CRIT-5 SSH password rotation (still Tr54V5&u89m#2n7)
     - Firebase service-account key rotation (key leaked into 2026-05-19 chat
       transcript during upload — rotate via Firebase Console → revoke + new)
     - iOS distribution upgrade — enroll Apple Developer Individual ($99/yr)
       when ready; Stage 2 workflow YAML in docs/ios-distribution-options.md

────────────────────────────────────────────────────────────────────
DON'T-REGRESS (must remember from 2026-05-19)
────────────────────────────────────────────────────────────────────

  iOS:
    - patch-package postinstall hook auto-reapplies 10 patches in patches/
    - Podfile post_install: WARNING_CFLAGS + Swift -suppress-warnings ONLY on
      Pod targets; app target stays strict
    - ENABLE_USER_SCRIPT_SANDBOXING = NO in pbxproj (Xcode 26 flips it YES on
      open → Copy Pods Resources fails)
    - GoogleService-Info.plist IS committed (public client config)
    - CRM-BACKEND/config/firebase-service-account.json NEVER committed
      (gitignored; real private key)
    - iOS pin SPKI hashes (Info.plist NSPinnedDomains) must stay synchronized
      with Android network_security_config.xml <pin-set>. Rotate together.

  Workflow gates (full-stack):
    - When committing BE files (CRM-BACKEND/src/**): run BE eslint + tsc
      BEFORE push. FE 3-gate does NOT cover BE prettier rules.
    - When committing FE files (CRM-FRONTEND/src/**): the FE 3-gate
      (tsc + eslint + prettier) is mandatory pre-push.
    - When committing mobile sub-repo files: that's a SEPARATE git repo at
      crm-mobile-native/ (gitignored in monorepo at .gitignore line 287).

────────────────────────────────────────────────────────────────────
GIT STATE TO VERIFY AT SESSION START
────────────────────────────────────────────────────────────────────

  cd /Users/mayurkulkarni/Downloads/CRM-APP-MONOREPO-PROD
    Expected: branch `main`, clean, latest commit 3e5fc875

  cd /Users/mayurkulkarni/Downloads/CRM-APP-MONOREPO-PROD/crm-mobile-native
    Expected: branch `main`, clean, latest commit 82c2351
    Expected: tag v1.0.57 present; `gh release view v1.0.57` shows 6 assets

────────────────────────────────────────────────────────────────────
SLASH COMMANDS FOR AREA-SCOPED PRE-LOADING
────────────────────────────────────────────────────────────────────

  /start-billing-work — billing/invoice/commission/GST memory
  /start-e2e          — e2e + deployment + form audit memory
  /start-mobile       — mobile + sync + DB encryption memory

────────────────────────────────────────────────────────────────────
CONFIRM "Read MEMORY.md + 5 base files. Picked option <N>. Ready."
then wait.
────────────────────────────────────────────────────────────────────
