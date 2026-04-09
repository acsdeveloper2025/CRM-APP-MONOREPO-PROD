import { query } from '@/config/database';
import { logger } from '@/config/logger';

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
  try {
    await query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        data.action,
        data.entityType,
        data.entityId,
        data.userId || null,
        data.details ? JSON.stringify(data.details) : null,
        data.ipAddress || null,
        data.userAgent || null,
      ]
    );
  } catch (error) {
    logger.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking the main operation
  }
};
