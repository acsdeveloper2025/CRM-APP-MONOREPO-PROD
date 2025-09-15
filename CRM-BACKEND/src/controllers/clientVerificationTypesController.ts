import { Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';

// GET /api/clients/:id/verification-types - Get verification types mapped to a client
export const getVerificationTypesByClient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: clientId } = req.params;
    const { isActive } = req.query as { isActive?: string };

    const mappingWhere: any = { clientId };
    if (typeof isActive !== 'undefined') {
      mappingWhere.isActive = String(isActive) === 'true';
    }

    const mappingsRes = await query(`SELECT * FROM client_verification_types WHERE "clientId" = $1`, [clientId]);
    const mappings = mappingsRes.rows;
    const verificationTypes = mappings.map((m: any) => ({ id: m.verificationTypeId, name: '', code: '' }));

    logger.info(`Retrieved ${verificationTypes.length} verification types for client ${clientId}`, { userId: req.user?.id });

    res.json({ success: true, data: verificationTypes });
  } catch (error) {
    logger.error('Error retrieving verification types by client:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve verification types', error: { code: 'INTERNAL_ERROR' } });
  }
};

