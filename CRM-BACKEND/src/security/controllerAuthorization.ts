import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { userHasPermission } from '@/security/rbacAccess';

type RequirePermissionOptions = {
  errorCode?: string;
  message?: string;
};

export const requireControllerPermission = (
  req: AuthenticatedRequest,
  res: Response,
  permissionCode: string,
  options: RequirePermissionOptions = {}
): boolean => {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: { code: 'UNAUTHORIZED' },
    });
    return false;
  }

  if (!userHasPermission(req.user, permissionCode)) {
    res.status(403).json({
      success: false,
      message: options.message || `Missing required permission: ${permissionCode}`,
      error: { code: options.errorCode || 'PERMISSION_DENIED' },
    });
    return false;
  }

  return true;
};
