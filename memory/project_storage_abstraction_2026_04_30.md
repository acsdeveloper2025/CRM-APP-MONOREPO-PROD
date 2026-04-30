---
name: F7.11.2 + F8.2.3 closure — StorageService abstraction (2026-04-30)
description: Object-storage abstraction with LocalFs (dev) + S3-compatible (prod) impls. Covers F7.11.2 (template_reports content) + F8.2.3 (KYC document files), plus dual-write storage_key on all 4 file-bearing tables. Production cutover blocked on user provisioning S3 + creds (documented runbook).
type: project
---

# Storage abstraction — F7.11.2 + F8.2.3 closure

## What landed

### Storage layer
- `src/services/storage/StorageService.ts` — interface (`put`, `get`, `getSignedUrl`, `delete`, `exists`, `move`) + `sanitizeStorageKey` helper
- `src/services/storage/LocalFsStorage.ts` — writes to `<config.uploadPath>/<key>`. Default in dev. Reads `getSignedUrl` returns `/api/storage/<key>` (auth-gated, NOT the unauthenticated `/uploads` static mount).
- `src/services/storage/S3Storage.ts` — uses `@aws-sdk/client-s3 ^3.1039` + `@aws-sdk/s3-request-presigner ^3.1039`. Works against AWS S3, Cloudflare R2 (set `endpoint`), or MinIO (set `forcePathStyle: true`).
- `src/services/storage/index.ts` — factory + singleton `storage` + `StorageKeys` helper exports

### Key conventions (`StorageKeys`)
| Domain | Key |
|---|---|
| Admin attachments | `attachments/{case_id}/{attachment_id}.{ext}` |
| Admin attachment renditions | `renditions/{attachment_id}.{pdf\|jpg}` |
| Verification photos | `verification/{case_id}/{task_id}/{photo_id}.jpg` |
| Verification thumbs | `verification/{case_id}/{task_id}/{photo_id}_thumb.jpg` |
| KYC documents | `kyc/{case_id}/{kyc_id}-{doc_code}.{ext}` |
| Template reports | `template-reports/{case_id}/{submission_id}-{report_id}.html` |
| Branding (logo/stamp) | `branding/{client_id}/{type}.{ext}` |
| Profile photos | `profile-photos/{user_id}.jpg` |

### DB schema additions (4 columns + comments)
```sql
ALTER TABLE template_reports           ADD COLUMN storage_key text;
ALTER TABLE kyc_document_verifications ADD COLUMN document_storage_key text;
ALTER TABLE attachments                ADD COLUMN storage_key text;
ALTER TABLE verification_attachments   ADD COLUMN storage_key text;
```
Legacy columns (`report_content TEXT`, `document_file_path varchar`, `file_path varchar`) kept for dual-read fallback during cutover window.

### Auth-gated read endpoint
- New route `GET /api/storage/:key+` → `streamStorageObject` controller (`src/controllers/storageController.ts`)
- Mounted at `app.ts:230` after `/attachments`
- Bypasses the unauthenticated `/uploads` static mount (closes audit F-B1.1 DPDP exposure for new code paths)
- Static mount at `app.ts:160` retained for backward-compat with legacy `file_path` URLs; remove during S3 cutover

### Env-var config
- `config.storage.{backend, bucket, endpoint, region, accessKey, secretKey, forcePathStyle, readUrlTtlSeconds, writeUrlTtlSeconds}`
- `STORAGE_BACKEND=local` is default (dev keeps working as today)
- `.env.example` documents the 8 storage vars

### Migration script
- `scripts/migrate-files-to-storage.ts`
- Flags: `--dry-run | --populate-keys | --copy-bytes` (combinable)
- Idempotent: skips rows where `storage_key` already set
- Resolves legacy `file_path` against `config.uploadPath` (handles `/uploads/...`, `uploads/...`, and bare keys)
- Tables migrated: attachments, verification_attachments, kyc_document_verifications, template_reports

### Controller refactors (F7.11.2 + F8.2.3 explicit audit items)
- `templateReportsController.ts` — INSERT into `template_reports` now also calls `storage.put(StorageKeys.templateReport(...))` and persists `storage_key`. Storage failure is non-fatal during dual-write window (logged, falls back to DB-only).
- `kycVerificationController.ts:uploadKYCDocument` — multer-uploaded file now also goes through `storage.put` + populates `document_storage_key`. Legacy `document_file_path` still set for backward-compat reads.

## Verification

| Check | Result |
|---|---|
| `npm run build` (backend) | clean |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint --quiet` (touched files) | 0 errors |
| `npx prettier --check` (touched files) | clean |
| Migration `--dry-run` | identifies 1 attachment + 7 template_reports candidates |
| Migration `--populate-keys --copy-bytes` (LocalFs backend) | populates 1 attachment storage_key + 7 template_reports storage_key + writes 7 HTML files to `uploads/template-reports/{case}/{sub}-{id}.html` ✓ |
| Smoke: 4-table storage_key counts | attachments 1/1, template_reports 7/7, others 0 (no rows yet) ✓ |
| Cross-codebase storage import grep | 3 expected hits (storageController, kycVerificationController, templateReportsController) ✓ |
| Dump regen | `acs_db_final_version.sql` 44369 lines, 4 `storage_key` cols ✓ |

## Production cutover runbook

When ready to flip to S3:

```bash
# 1. PROVISION S3 BUCKET (AWS Console or CLI)
aws s3api create-bucket \
  --bucket acs-crm-prod \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
aws s3api put-bucket-encryption --bucket acs-crm-prod \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket acs-crm-prod \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket acs-crm-prod \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 2. CREATE IAM USER for backend
aws iam create-user --user-name crm-backend
aws iam create-access-key --user-name crm-backend  # stash the keys
aws iam put-user-policy --user-name crm-backend --policy-name crm-backend-s3 \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::acs-crm-prod/*"
    }]
  }'

# 3. UPDATE PROD .env (5 vars)
STORAGE_BACKEND=s3
STORAGE_BUCKET=acs-crm-prod
STORAGE_REGION=ap-south-1
STORAGE_ACCESS_KEY=AKIA...        # from step 2
STORAGE_SECRET_KEY=...            # from step 2

# 4. RESTART pm2 with new env
pm2 restart crm-backend --update-env

# 5. RUN MIGRATION (copies bytes + populates storage_key)
cd /opt/crm-app/current/CRM-BACKEND
npx ts-node -r tsconfig-paths/register scripts/migrate-files-to-storage.ts \
  --populate-keys --copy-bytes

# 6. SMOKE TEST
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $TOKEN" https://crm.allcheckservices.com/api/health

# 7. AFTER 7 DAYS OF CLEAN S3 OPERATION:
#    a) Drop legacy columns:
#       ALTER TABLE template_reports DROP COLUMN report_content;
#       ALTER TABLE kyc_document_verifications DROP COLUMN document_file_path;
#       ALTER TABLE attachments DROP COLUMN file_path;  -- if all readers migrated
#       ALTER TABLE verification_attachments DROP COLUMN file_path;  -- same
#    b) Remove `app.use('/uploads', express.static(...))` from app.ts:160
#    c) Delete /opt/crm-app/current/CRM-BACKEND/uploads/ on host
#    d) Refactor remaining read sites to use storage.getSignedUrl() instead of legacy file_path
```

## Don't-regress

- **Don't bypass StorageService for new file writes.** Direct `fs.writeFile('./uploads/...')` orphans the `storage_key` column → on S3 cutover those rows have no key, files are lost.
- **Don't drop the `app.use('/uploads', express.static(...))` mount in dev** without first migrating all reads to `storage.getSignedUrl()`. Legacy file_path URLs in DB still point at `/uploads/...`.
- **`StorageService.put` returns `{ key, size }` — always persist `key` to the DB.** It's the only way to find the bytes later, especially under S3.
- **Don't use multer.memoryStorage for large uploads (verification photos can be 50MB).** Stick with multer.diskStorage; read file into Buffer in the controller before calling `storage.put`. (Pattern shown in `kycVerificationController.uploadKYCDocument`.)
- **Storage keys MUST come from `StorageKeys.*` helpers**, not string-concatenated. Convention drift across writers will scatter objects unpredictably under S3.
- **Sanitize keys via `sanitizeStorageKey` before passing to S3** (already done inside both impls). Rejects `..` segments + leading slashes — prevents directory traversal across bucket prefixes.
- **`STORAGE_BACKEND` defaults to `local` if unset.** Production MUST explicitly set `STORAGE_BACKEND=s3` after provisioning. A missing env var should be loud, not silent.
- **The dual-write window is intentional.** Don't drop `report_content` / `document_file_path` / `file_path` columns until step 7a of cutover runbook completes.
- **Migration script is idempotent.** Re-running is safe; skips rows where storage_key already set. But running with `--copy-bytes` against S3 = data egress charges, so prefer `--populate-keys --copy-bytes` only ONCE per cutover.

## Files touched

```
NEW:
  src/services/storage/StorageService.ts        (interface + sanitize helper)
  src/services/storage/LocalFsStorage.ts        (default impl, dev)
  src/services/storage/S3Storage.ts             (S3-compatible impl, prod)
  src/services/storage/index.ts                 (factory + singleton + StorageKeys)
  src/controllers/storageController.ts          (auth-gated /api/storage/:key+ stream)
  src/routes/storage.ts                         (route mount)
  scripts/migrate-files-to-storage.ts           (one-shot migration)

EDITED:
  src/config/index.ts                           (storage env-var config)
  src/app.ts                                    (storage route import + mount)
  src/controllers/templateReportsController.ts  (F7.11.2 — storage.put on report INSERT)
  src/controllers/kycVerificationController.ts  (F8.2.3 — storage.put on KYC upload)
  .env.example                                  (8 storage vars + comments)

DB (live + dump):
  4× ALTER TABLE ... ADD COLUMN storage_key text  (with COMMENT ON COLUMN)
  acs_db_final_version.sql regenerated (44369 lines)

DEPS:
  + @aws-sdk/client-s3 ^3.1039
  + @aws-sdk/s3-request-presigner ^3.1039
```

## What's NOT in this closure (intentional)

Per close-all-sideeffects litmus test: F7.11.2 + F8.2.3 are the explicitly-audit-listed items. The full read-path swap to `storage.getSignedUrl()` for non-audit-listed file paths (admin attachments, verification photos, branding, profile photos) is best done as a single sweep after S3 is live (when test data exists to verify against). Until then:
- New writes from `attachmentsController` / `verificationAttachmentController` / branding / profile photos still write to disk only — they DO NOT populate storage_key on insert.
- The migration script's `--populate-keys --copy-bytes` will pick up these rows in the cutover sweep.

**This is a knowingly-incomplete state.** It's documented here so the next session knows: after S3 cutover, rerun the migration script periodically (or one-shot) to backfill storage_key for any rows created between now and the read-path-swap PR.

A cleaner alternative — refactor every writer NOW to populate storage_key — was deferred because:
1. The audit specifically listed F7.11.2 + F8.2.3, not the broader file-storage refactor
2. Each remaining controller's writer is non-trivial (multer config, error handling, sync vs queue paths) and risks breaking working dev features
3. The migration script provides an explicit backfill mechanism that closes the gap operationally

If/when ready to refactor the remaining 4-5 writers, the pattern is identical to what `kycVerificationController.uploadKYCDocument` shows: read the multer file → `storage.put` with the right `StorageKeys.*` key → persist storage_key on the INSERT.

## Cross-references

- Audit items closed: F7.11.2 (`project_phase9_rates_invoicing_2026_04_29.md` mentioned but it's actually `project_phase8_kyc_documents_2026_04_29.md` for F8.2.3 + `project_verification_reports_consolidation.md` for F7.11.2)
- DPDP exposure F-B1.1 from `project_backend_audit_2026_04_28.md` — partially closed (new `/api/storage` is auth-gated; legacy `/uploads` mount remains for backward-compat until S3 cutover)
- `feedback_dev_state_no_assumptions.md` — pre-prod dev state recognised; abstraction built without requiring real S3 creds today
- `feedback_close_all_sideeffects.md` — bundled what could be bundled; explicitly-out-of-scope items documented above with the migration-script backfill mechanism
