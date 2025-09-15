import { Router } from 'express';
import { authenticateToken, requireRole } from '@/middleware/auth';
import { Role } from '@/types/auth';
import { body, param } from 'express-validator';
import { validate } from '@/middleware/validation';
import { query } from '@/config/database';

const router = Router();

// Admin only
router.use(authenticateToken, requireRole([Role.ADMIN, Role.SUPER_ADMIN]));

const macCreateValidation = [
  body('userId').notEmpty().withMessage('userId is required').isUUID().withMessage('userId must be UUID'),
  body('macAddress').notEmpty().withMessage('macAddress is required').isString(),
  body('label').optional().isString(),
  body('isApproved').optional().isBoolean(),
];

router.get('/mac-addresses/:userId',
  [param('userId').notEmpty().isUUID().withMessage('userId must be UUID')],
  validate,
  async (req, res) => {
    const { userId } = req.params as any;
    const result = await query(`SELECT id, "macAddress", label, "isApproved", "createdAt", "updatedAt" FROM "macAddresses" WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
    res.json({ success: true, data: result.rows });
  }
);

router.post('/mac-addresses', macCreateValidation, validate, async (req, res) => {
  const { userId, macAddress, label, isApproved } = req.body;
  const normalizeMac = (m: string) => m.toLowerCase().replace(/[^a-f0-9]/g, '');
  const norm = normalizeMac(macAddress);

  // Store normalized with colons for readability
  const colonized = norm.match(/.{1,2}/g)?.join(':') || norm;

  const ins = await query(
    `INSERT INTO "macAddresses" ("userId", "macAddress", label, "isApproved")
     VALUES ($1, $2, $3, COALESCE($4, true))
     ON CONFLICT ("userId", "macAddress") DO UPDATE SET label = EXCLUDED.label, "isApproved" = EXCLUDED."isApproved", "updatedAt" = CURRENT_TIMESTAMP
     RETURNING id, "macAddress", label, "isApproved", "createdAt", "updatedAt"`,
    [userId, colonized, label || null, isApproved]
  );
  res.json({ success: true, data: ins.rows[0] });
});

router.delete('/mac-addresses/:id', [param('id').notEmpty().isUUID()], validate, async (req, res) => {
  const { id } = req.params as any;
  await query(`DELETE FROM "macAddresses" WHERE id = $1`, [id]);
  res.json({ success: true, message: 'MAC address removed' });
});

export default router;

