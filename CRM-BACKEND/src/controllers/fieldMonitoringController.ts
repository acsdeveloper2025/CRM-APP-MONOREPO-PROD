import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth';
import {
  FieldMonitoringService,
  type FieldUserLiveStatus,
} from '@/services/fieldMonitoringService';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { errorMessage } from '@/utils/errorMessage';

const ALLOWED_STATUSES: FieldUserLiveStatus[] = [
  'Offline',
  'Submitted',
  'At Location',
  'Travelling',
  'Idle',
];

const resolveScopedUserIds = async (req: AuthenticatedRequest): Promise<string[] | undefined> => {
  if (!req.user?.id) {
    return undefined;
  }

  return getScopedOperationalUserIds(req.user.id);
};

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed ? trimmed : undefined;
  }

  return undefined;
};

const parseOptionalAreaId = (value: unknown): number | undefined => {
  const raw = parseOptionalString(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
};

const parseOptionalStatus = (value: unknown): FieldUserLiveStatus | undefined => {
  const raw = parseOptionalString(value);
  if (!raw) {
    return undefined;
  }

  return ALLOWED_STATUSES.includes(raw as FieldUserLiveStatus)
    ? (raw as FieldUserLiveStatus)
    : undefined;
};

export const getFieldMonitoringStats = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const scopedUserIds = await resolveScopedUserIds(req);
    const data = await FieldMonitoringService.getMonitoringStats(scopedUserIds);

    res.json({
      success: true,
      message: 'Field monitoring stats retrieved successfully',
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve field monitoring stats',
      error: {
        code: 'FIELD_MONITORING_STATS_ERROR',
        details: errorMessage(error),
      },
    });
  }
};

export const getFieldMonitoringUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const scopedUserIds = await resolveScopedUserIds(req);
    const data = await FieldMonitoringService.getMonitoringRoster(
      {
        page: parsePositiveInt(req.query.page, 1),
        limit: parsePositiveInt(req.query.limit, 20),
        search: parseOptionalString(req.query.search),
        pincode: parseOptionalString(req.query.pincode),
        areaId: parseOptionalAreaId(req.query.areaId),
        status: parseOptionalStatus(req.query.status),
      },
      scopedUserIds
    );

    res.json({
      success: true,
      message: 'Field monitoring roster retrieved successfully',
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve field monitoring roster',
      error: {
        code: 'FIELD_MONITORING_ROSTER_ERROR',
        details: errorMessage(error),
      },
    });
  }
};

export const getFieldMonitoringUserDetail = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = typeof req.params.id === 'string' ? req.params.id : String(req.params.id || '');
    const scopedUserIds = await resolveScopedUserIds(req);
    const data = await FieldMonitoringService.getUserMonitoringDetail(userId, scopedUserIds);

    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Field monitoring user not found',
        error: {
          code: 'FIELD_MONITORING_USER_NOT_FOUND',
        },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Field monitoring user detail retrieved successfully',
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve field monitoring user detail',
      error: {
        code: 'FIELD_MONITORING_USER_DETAIL_ERROR',
        details: errorMessage(error),
      },
    });
  }
};
