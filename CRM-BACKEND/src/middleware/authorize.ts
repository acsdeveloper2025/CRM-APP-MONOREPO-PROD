import type { NextFunction, Response } from 'express';
import { query } from '@/config/database';
import type { ApiResponse } from '@/types/api';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { errorMessage } from '@/utils/errorMessage';

type OwnershipType = 'task' | 'case';

interface AuthorizeOptions {
  ownership?: OwnershipType;
}

const _STRICT_OWNERSHIP_PERMISSIONS = [
  'visit.start',
  'visit.upload',
  'visit.submit',
  'visit.revoke',
  'visit.revisit',
] as const;

const forbidden = (res: Response, permissionCode: string, reason?: string): void => {
  const response: ApiResponse = {
    success: false,
    message: 'Insufficient permissions',
    error: {
      code: 'FORBIDDEN',
      details: {
        permission: permissionCode,
        ...(reason ? { reason } : {}),
      },
    },
  };
  res.status(403).json(response);
};

const toSingleString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
};

const getTaskIdFromRequest = (req: AuthenticatedRequest): string | undefined => {
  return (
    toSingleString(req.params.taskId) ??
    toSingleString(req.params.id) ??
    toSingleString(req.body?.taskId)
  );
};

const getCaseIdFromRequest = (req: AuthenticatedRequest): string | undefined => {
  return (
    toSingleString(req.params.caseId) ??
    toSingleString(req.params.id) ??
    toSingleString(req.body?.caseId)
  );
};

const hasPermission = (req: AuthenticatedRequest, permissionCode: string): boolean => {
  const codes = req.user?.permissionCodes || [];
  return codes.includes('*') || codes.includes(permissionCode);
};

const enforceTaskOwnership = async (req: AuthenticatedRequest, res: Response): Promise<boolean> => {
  const taskId = getTaskIdFromRequest(req);
  if (!taskId || !req.user?.id) {
    forbidden(res, 'ownership.task', 'TASK_ID_REQUIRED_FOR_OWNERSHIP');
    return false;
  }

  const result = await query<{ id: string }>(
    `SELECT id FROM verification_tasks WHERE id = $1 AND assigned_to = $2 LIMIT 1`,
    [taskId, req.user.id]
  );

  if (result.rows.length === 0) {
    forbidden(res, 'ownership.task', 'TASK_NOT_ASSIGNED_TO_USER');
    return false;
  }

  return true;
};

const enforceCaseOwnership = async (req: AuthenticatedRequest, res: Response): Promise<boolean> => {
  const caseId = getCaseIdFromRequest(req);
  if (!caseId || !req.user?.id) {
    forbidden(res, 'ownership.case', 'CASE_ID_REQUIRED_FOR_OWNERSHIP');
    return false;
  }

  const result = await query<{ id: string }>(
    `SELECT c.id
     FROM cases c
     WHERE c.id = $1
       AND EXISTS (
         SELECT 1 FROM verification_tasks vt
         WHERE vt.case_id = c.id
           AND vt.assigned_to = $2
       )
     LIMIT 1`,
    [caseId, req.user.id]
  );

  if (result.rows.length === 0) {
    forbidden(res, 'ownership.case', 'CASE_NOT_OWNED_BY_USER');
    return false;
  }

  return true;
};

export const authorize = (permissionCode: string, options?: AuthorizeOptions) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    void (async () => {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          error: { code: 'UNAUTHORIZED' },
        };
        res.status(401).json(response);
        return;
      }

      if (!hasPermission(req, permissionCode)) {
        forbidden(res, permissionCode);
        return;
      }

      // Users with settings.manage (SUPER_ADMIN, MANAGER) bypass ownership checks
      // including strict ones — they need full system access for operations like revisit
      const hasAdminAccess = hasPermission(req, 'settings.manage');
      const canBypassOwnership = hasAdminAccess;

      if (options?.ownership && !canBypassOwnership) {
        const ok =
          options.ownership === 'task'
            ? await enforceTaskOwnership(req, res)
            : await enforceCaseOwnership(req, res);
        if (!ok) {
          return;
        }
      }

      next();
    })().catch(error => {
      res.status(500).json({
        success: false,
        message: 'Authorization failed',
        error: {
          code: 'AUTHORIZATION_ERROR',
          details: errorMessage(error),
        },
      });
    });
  };
};

export const authorizeAny = (permissionCodes: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHORIZED' },
      };
      res.status(401).json(response);
      return;
    }

    const allowed = permissionCodes.some(code => hasPermission(req, code));
    if (!allowed) {
      forbidden(res, permissionCodes.join('|'));
      return;
    }

    next();
  };
};
