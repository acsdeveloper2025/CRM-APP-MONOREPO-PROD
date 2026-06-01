import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';
import { logger } from '@/config/logger';

export const getDepartments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentsQuery = `
      SELECT id, name, description
      FROM departments
      WHERE is_active = true
      ORDER BY name
    `;

    const result = await query(departmentsQuery);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const getDesignations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const designationsQuery = `
      SELECT id, name, description
      FROM designations
      WHERE is_active = true
      ORDER BY name
    `;

    const result = await query(designationsQuery);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching designations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designations',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const getRolePermissions = (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    message: 'Role permissions feature coming soon',
  });
};
