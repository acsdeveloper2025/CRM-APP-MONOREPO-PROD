import { query } from '@/config/database';

export type MobileOperationType =
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_REVOKED'
  | 'PRIORITY_UPDATED'
  | 'FORM_SUBMITTED'
  | 'PHOTO_CAPTURED'
  | 'FORM_UPDATED'
  | 'LOCATION_CAPTURED';

type RecordMobileOperationInput = {
  operationId: string;
  type: MobileOperationType;
  entityType: 'TASK' | 'FORM' | 'ATTACHMENT' | 'LOCATION';
  entityId: string;
  payload?: unknown;
  retryCount?: number;
};

export class MobileOperationService {
  static async recordOperation(input: RecordMobileOperationInput): Promise<void> {
    const { operationId, type, entityType, entityId, payload = {}, retryCount = 0 } = input;

    await query(
      `INSERT INTO mobile_operation_log (
         operation_id,
         type,
         entity_type,
         entity_id,
         payload,
         retry_count
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (operation_id) DO NOTHING`,
      [operationId, type, entityType, entityId, JSON.stringify(payload), retryCount]
    );
  }
}
