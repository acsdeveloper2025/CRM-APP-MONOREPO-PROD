import { Router } from 'express';
import { authenticateToken } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { body, param } from 'express-validator';
import { validate } from '@/middleware/validation';
import { query } from '@/config/database';

const router = Router();

router.use(authenticateToken, authorize('settings.manage'));

const macCreateValidation = [
  body('userId')
    .notEmpty()
    .withMessage('userId is required')
    .isUUID()
    .withMessage('userId must be UUID'),
  body('macAddress').notEmpty().withMessage('macAddress is required').isString(),
  body('label').optional().isString(),
  body('isApproved').optional().isBoolean(),
];

router.get(
  '/mac-addresses/:userId',
  [param('userId').notEmpty().isUUID().withMessage('userId must be UUID')],
  validate,
  async (req, res) => {
    const { userId } = req.params;
    const result = await query(
      `SELECT id, mac_address, label, is_approved, created_at, updated_at FROM mac_addresses WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
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
    `INSERT INTO mac_addresses (user_id, mac_address, label, is_approved)
     VALUES ($1, $2, $3, COALESCE($4, true))
     ON CONFLICT (user_id, mac_address) DO UPDATE SET label = EXCLUDED.label, is_approved = EXCLUDED.is_approved, updated_at = CURRENT_TIMESTAMP
     RETURNING id, mac_address, label, is_approved, created_at, updated_at`,
    [userId, colonized, label || null, isApproved]
  );
  res.json({ success: true, data: ins.rows[0] });
});

router.delete(
  '/mac-addresses/:id',
  [param('id').notEmpty().isUUID()],
  validate,
  async (req, res) => {
    const { id } = req.params;
    await query(`DELETE FROM mac_addresses WHERE id = $1`, [id]);
    res.json({ success: true, message: 'MAC address removed' });
  }
);

export default router;
