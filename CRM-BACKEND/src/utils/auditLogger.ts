// Phase D3: audit log creation is now a thin wrapper around the
// bull-backed audit queue in src/queues/auditLogQueue.ts. The public
// `createAuditLog(data)` API is unchanged — every call site in the
// codebase keeps working without edits — but durability is now
// provided by the queue: retries, dead-letter buffering, and a
// direct-insert fallback for the Redis-down path.
//
// See src/queues/auditLogQueue.ts for the processor and retry
// semantics.

import { enqueueAuditLog } from '@/queues/auditLogQueue';

export interface AuditLogData {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export const createAuditLog = async (data: AuditLogData): Promise<void> => {
  await enqueueAuditLog(data);
};
