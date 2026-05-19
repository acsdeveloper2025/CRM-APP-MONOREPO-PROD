Resume context for CRM-APP-MONOREPO-PROD.

────────────────────────────────────────────────────────────────────
LOAD THESE MEMORY FILES IN ORDER (lazy-load protocol):
────────────────────────────────────────────────────────────────────
1. MEMORY.md (always — index + session-start protocol)
2. feedback_use_karpathy_guidelines.md (think before, surgical, simplicity)
3. feedback_ask_before_acting.md (no commits/pushes/deploys without explicit auth)
4. feedback_cave_mode.md (terse output, minimal tokens)
5. feedback_sql_live_db_apply.md (DB triple-write invariant: dump + local + remote)
6. feedback_fe_code_standards.md (FE rule file — mobile-first, theme tokens, gates) — LOAD WHENEVER TOUCHING CRM-FRONTEND
7. project_day1_audit_fixes_2026_05_16.md (2-day audit-fix log — Day 1 + Day 2 closures)
8. project_profile_page_phase_d_2026_05_17.md (THIS SESSION — Profile page + policy gate + PDF export + nginx fix + 5 bugs found in preview test)
9. project_l_crit_3_deferred_rds_migration.md (AWS is prod target; remote 49.50.119.155 is dev/test only; managed services replace many infra findings)
10. AUDIT_2026_05_17_CODE_QUALITY.md (at repo root — 1060-line code+5-persona audit + Tier 0/1/2 priority list + 6-week sequencing plan)

────────────────────────────────────────────────────────────────────
STATE AT SESSION START (all verified 2026-05-17 20:30 IST):
────────────────────────────────────────────────────────────────────

A. Git state
   Monorepo:  HEAD = `8a70b390` (Phase D commit). Pushed to origin/main.
              GH Actions deploy run `25993230875` ✅ all green.
              Remote 49.50.119.155 deployed (BE pm2 restarted, FE dist live).
   Mobile sub-repo (SEPARATE git, gitignored in monorepo line 287):
              HEAD = `1a961c9` (v1.0.55 release). Pushed + tag pushed.
              Tag-trigger GH Actions run `25993709405` was in_progress
              when session ended. **VERIFY APK BUILD COMPLETED** first action:
                `gh run view 25993709405 --repo acsdeveloper2025/crm-mobile-native`

B. This session's deliverables (Phase D — see project_profile_page_phase_d_2026_05_17.md)
   - **/profile page** with 5 tabs (Identity / Password / Sessions / Activity / Privacy)
     reachable via Header user-avatar dropdown
   - **Hard policy gate** — every authenticated route runs through
     PolicyAcceptanceGuard. Unaccepted users redirected to /accept-policy
     (Accept + Logout buttons only). Fail-CLOSED on consent-fetch error.
   - **PDF data export** — DPDP §11. Was JSON, now puppeteer-rendered A4 PDF
     (3 pages for a typical user; 161KB for pradnya).
   - **T0-1 storage IDOR closure** — deleted /api/storage/* route + controller
   - **T0-2 /uploads auth cookie gate** — requireAssetAuth middleware accepts
     bearer OR crm_asset_token httpOnly cookie. **Nginx fix applied manually**
     (not in git): `location /uploads/ { proxy_pass http://crm_backend; ... }`
   - **Mobile AuthedImage** + resolveAssetUrl — T0-2 compatibility on RN
   - **Settings dropdown wire** — was dead, now nav + perm-gated by page.settings
   - **FE rule file written** — feedback_fe_code_standards.md, indexed in MEMORY.md
   - **5 bugs found + fixed during preview test:**
     1. PolicyAcceptanceGuard fail-open let pradnya bypass (now fail-closed)
     2. React Query retry storm 184+ calls (retry: 0)
     3. userAuditLogController SQL: cast entity_id = $1::text
     4. userDataExportController: ur.created_at → ur.assigned_at (column rename)
     5. CompletedTasksPage missing VerificationTasksService import

C. Critical post-deploy behavior to know
   - **Pre-existing user sessions LOSE avatar visibility** until they log out + log
     back in (asset cookie only issued at login/refresh, not magically added to
     existing sessions). Consider proactive issue on /api/auth/me in next iteration.
   - **DB triple-write applied: 0** new tables/columns this session. T0-2 is in-flight
     cookies only. No migration needed.
   - **Audit-fix arc 2-day commit count on monorepo: 26** total (25 Day 1+2 + 1 Phase D).
     Mobile sub-repo: 4 commits + 1 v1.0.55 tag (5 total).

D. Architecture clarification (still binding)
   - `49.50.119.155:2232` Ubuntu22 = dev/test ONLY. Production target = AWS.
   - Findings handled natively by AWS managed services have been re-classified.
     See project_l_crit_3_deferred_rds_migration.md. Do not re-flag:
       UFW firewall              → VPC Security Groups
       pg_dump cron              → RDS snapshots + PITR
       Redis AOF persistence     → ElastiCache
       PM2 cluster mode          → ECS task scaling / ASG
       SSH password rotation     → IAM + SSM Session Manager
       Redis Sentinel replica    → ElastiCache Multi-AZ

E. False-positives caught across the audit cycle (9). DO NOT RE-RAISE:
   See project_day1_audit_fixes_2026_05_16.md full list. Highlights:
     JWT_SECRET placeholder — fabricated; placeholder string not in any file
     mobile Idempotency-Key missing — already present in all 6 uploaders
     R-HIGH-2 cache invalidation pre-COMMIT — EnterpriseCache wraps res.end
     NEW-HIGH-5 cron try/catch — inner functions already have try/catch
     NEW-HIGH-6 roles_v2 drift — no legacy `roles` table exists
     `getSignedUrl` "we'll re-add at S3 cutover" — WRONG, do not re-add now.
       At actual S3 cutover, design with real requirements then.

F. Deferred items (DO NOT push to act without user re-confirmation)
   - NEW-CRIT-3 APK keystore offsite backup — separate ops task
   - L-CRIT-3 pg_dump cron — AWS RDS handles
   - NEW-CRIT-5 ⚠️ SSH password — leaked in transcripts; rotate via `passwd`
     as root on 49.50.119.155:2232. Until rotated treat as compromised.
   - G-HIGH-1 mock-GPS reject — bundled with mobile-FGS sprint
   - NEW-MED-2 GPS foreground service — same mobile-FGS sprint
   - NEW-HIGH-1 FE↔BE shared types — 4-chunk sprint plan documented;
     do as DEDICATED session.
   - **Mobile rule file** sibling to feedback_fe_code_standards.md — TODO

G. DB connection (dev/test box; AWS RDS pending)
     postgresql://acs_user:acs_password@localhost:5432/acs_db
   Remote box: ssh -p 2232 root@49.50.119.155 (use sshpass with the leaked
   password; SAME password the user wants rotated).

H. PM2 process on remote: `crm-backend`. Verify env=production after deploy:
     curl -sk https://localhost/api/health
   on the box. PM2 env cache lies (`pm2 env 0` may show stale value) —
   the /api/health endpoint is truth.

I. Mobile sub-repo gotcha: `crm-mobile-native/` is gitignored in monorepo
   at line 287 of .gitignore. Mobile commits MUST be made from inside
   `crm-mobile-native/`. Don't try `git add crm-mobile-native/...` from
   monorepo root.

J. Local BE for testing
   - Running as `ts-node/register/transpile-only` (no hot reload). To pick up
     BE source changes you MUST restart: `kill <pid>` + `cd CRM-BACKEND && npm
     run dev &`. The local dev BE on :3000 is what the local FE preview
     (Vite :5173) hits — NOT the remote.
   - To verify a change live: rebuild dist on the remote box (`npm run build`
     in CRM-BACKEND/) + `pm2 restart crm-backend`. GH Actions does this on
     every push to main.

K. Open Tier 0 / Tier 1 items from AUDIT_2026_05_17_CODE_QUALITY.md (NOT touched
   this session — see master priority list §13):
     T0-3 BEGIN-on-pool sweep (9 sites — silent data corruption)
     T0-4 Cache-warming globals (defeats scope narrowing)
     T0-5 Geocoding circuit breaker defined but not used
     T0-6 BE fetch() no timeout (geocodeController:294)
     T0-7 casesController createCase/updateCase/exportCases zero audit log
     T0-8 commissionManagementController 6 mutations zero audit log
     T0-9 Mobile SSL pinning not enforced
     Plus 16 Tier 1 items (compliance / scale-blocker / silent-corruption)

────────────────────────────────────────────────────────────────────
ACKNOWLEDGE by:
  1. Self-identifying as Agent A
  2. Repeating back the 10 memory files you'll lazy-load
  3. Stating top 2 actions for this session:
     (a) Verify mobile APK build run `25993709405` completed + APK on
         GH Releases
     (b) NEW-CRIT-5 SSH password rotation is still open and high-risk
Then wait for the next task. Do NOT proactively start work.
