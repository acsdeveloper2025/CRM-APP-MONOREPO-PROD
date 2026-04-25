import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';

// GET /api/clients/:id/verification-types - Get verification types mapped to a client
export const getVerificationTypesByClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: clientId } = req.params;
    const { isActive } = req.query as { isActive?: string };

    const mappingWhere: Record<string, unknown> = { clientId };
    if (typeof isActive !== 'undefined') {
      mappingWhere.isActive = String(isActive) === 'true';
    }

    const mappingsRes = await query(
      `SELECT cpv.id, cp.product_id, cpv.verification_type_id, cpv.is_active, cpv.created_at
         FROM client_product_verifications cpv
         JOIN client_products cp ON cp.id = cpv.client_product_id
        WHERE cp.client_id = $1`,
      [clientId]
    );
    const mappings = mappingsRes.rows;
    const verificationTypes = mappings.map((m: Record<string, unknown>) => ({
      id: m.verification_type_id,
      name: '',
      code: '',
    }));

    logger.info(`Retrieved ${verificationTypes.length} verification types for client ${clientId}`, {
      userId: req.user?.id,
    });

    res.json({ success: true, data: verificationTypes });
  } catch (error) {
    logger.error('Error retrieving verification types by client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification types',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
