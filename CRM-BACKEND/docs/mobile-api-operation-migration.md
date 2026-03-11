# Mobile API Operation Migration (Backward Compatible)

## Added Endpoints

- `POST /api/mobile/verification-tasks/:taskId/forms`
  - Unified form submission.
  - Requires `Idempotency-Key`.
  - Payload:
    - `formType`
    - `data`
- `POST /api/mobile/verification-tasks/:taskId/operations`
  - Unified task operation execution.
  - Requires `Idempotency-Key`.
  - Payload:
    - `operation` (`TASK_STARTED`, `TASK_COMPLETED`, `TASK_REVOKED`, `PRIORITY_UPDATED`)
    - `payload` (operation-specific fields)
- `GET /api/mobile/sync/changes`
  - Alias of `/sync/download` with query compatibility:
    - `since` -> `lastSyncTimestamp`
    - `cursor` -> `offset`
- `GET /api/mobile/sync/health`
  - Mobile sync readiness probe.
- `GET /api/sync/health`
  - Backend sync/system health alias.

## Idempotency Support

- Added `mobile_idempotency_keys` table.
- Added reusable middleware: `idempotencyMiddleware`.
- Supports replay-safe writes with:
  - `Idempotency-Key` header
  - request hash collision checks
  - stored response replay (`X-Idempotent-Replay: true`)

### Endpoints with idempotency middleware

- `POST /api/mobile/verification-tasks/:taskId/forms` (required)
- `POST /api/mobile/verification-tasks/:taskId/operations` (required)
- `POST /api/mobile/verification-tasks/:taskId/attachments` (supported, optional for legacy clients)
- `POST /api/mobile/location/capture` (supported, optional for legacy clients)
- Legacy form-specific endpoints are idempotency-enabled (optional mode for compatibility).

## Operation Log Support

- Added `mobile_operation_log` table with:
  - `operation_id`
  - `type`
  - `entity_type`
  - `entity_id`
  - `payload`
  - `retry_count`
  - `created_at`
- Added `MobileOperationService` to persist immutable operation entries.
- Operation log is currently recorded for:
  - unified task operations
  - unified form submissions
  - attachment uploads (`PHOTO_CAPTURED`)
  - location capture (`LOCATION_CAPTURED`)

## Deprecated (Supported During Migration)

- `POST /api/mobile/verification-tasks/:taskId/verification/residence`
- `POST /api/mobile/verification-tasks/:taskId/verification/office`
- `POST /api/mobile/verification-tasks/:taskId/verification/business`
- `POST /api/mobile/verification-tasks/:taskId/verification/builder`
- `POST /api/mobile/verification-tasks/:taskId/verification/residence-cum-office`
- `POST /api/mobile/verification-tasks/:taskId/verification/dsa-connector`
- `POST /api/mobile/verification-tasks/:taskId/verification/property-individual`
- `POST /api/mobile/verification-tasks/:taskId/verification/property-apf`
- `POST /api/mobile/verification-tasks/:taskId/verification/noc`
- `POST /api/mobile/verification-tasks/:taskId/start`
- `POST /api/mobile/verification-tasks/:taskId/complete`
- `POST /api/mobile/verification-tasks/:taskId/revoke`
- `PUT /api/mobile/verification-tasks/:taskId/priority`
- `GET /api/mobile/sync/download`
- `GET /api/mobile/health`

## Notification Delete Standardization

- Canonical: `DELETE /api/notifications`
- Legacy alias `DELETE /api/notifications/clear-all` has been removed.

## Rollout Plan

1. Backend deploy with new endpoints and compatibility layer.
2. Mobile client update to:
   - use `/forms` + `/operations`
   - send `Idempotency-Key` with operation IDs
   - prefer `/sync/changes` and `/sync/health`
3. Observe logs/metrics and compare legacy/new endpoint traffic.
4. Mark legacy endpoints for sunset after adoption threshold.
5. Remove deprecated routes in a major API version window.
