import { randomUUID } from 'crypto';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import type { AuthenticatedRequest } from '@/middleware/auth';
import {
  FieldMonitoringService,
  type FieldUserLiveStatus,
} from '@/services/fieldMonitoringService';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { PushNotificationService } from '@/services/PushNotificationService';
import { createAuditLog } from '@/utils/auditLogger';
import { escapeFormulaRow } from '@/utils/formulaGuard';
import { errorMessage } from '@/utils/errorMessage';
import { logger } from '@/config/logger';

const FIELD_MONITORING_EXPORT_LIMIT = 10000;

const pushNotificationService = PushNotificationService.getInstance();

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

const parseOptionalSortBy = (value: unknown): 'name' | 'createdAt' | undefined => {
  const raw = parseOptionalString(value);
  if (raw === 'name' || raw === 'createdAt') {
    return raw;
  }
  return undefined;
};

const parseOptionalSortOrder = (value: unknown): 'asc' | 'desc' | undefined => {
  const raw = parseOptionalString(value);
  if (raw === 'asc' || raw === 'desc') {
    return raw;
  }
  return undefined;
};

// Parse a single bbox edge from the query string. Returns undefined if
// missing/malformed (any non-finite or out-of-range value) so the bbox
// filter is silently disabled — partial bounds never apply.
const parseOptionalLatLng = (raw: unknown, kind: 'lat' | 'lng'): number | undefined => {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else if (typeof raw === 'string') {
    if (raw === '') {
      return undefined;
    }
    n = parseFloat(raw);
  } else {
    return undefined;
  }
  if (!Number.isFinite(n)) {
    return undefined;
  }
  if (kind === 'lat' && (n < -90 || n > 90)) {
    return undefined;
  }
  if (kind === 'lng' && (n < -180 || n > 180)) {
    return undefined;
  }
  return n;
};

const buildRosterParams = (req: AuthenticatedRequest) => ({
  page: parsePositiveInt(req.query.page, 1),
  limit: parsePositiveInt(req.query.limit, 20),
  search: parseOptionalString(req.query.search),
  pincode: parseOptionalString(req.query.pincode),
  areaId: parseOptionalAreaId(req.query.areaId),
  status: parseOptionalStatus(req.query.status),
  sortBy: parseOptionalSortBy(req.query.sortBy),
  sortOrder: parseOptionalSortOrder(req.query.sortOrder),
  createdFrom: parseOptionalString(req.query.createdFrom),
  createdTo: parseOptionalString(req.query.createdTo),
  // P3 truthful-sweep 2026-05-27: map-view passes viewport bbox.
  // All 4 must parse for the filter to apply.
  boundsSwLat: parseOptionalLatLng(req.query.boundsSwLat, 'lat'),
  boundsSwLng: parseOptionalLatLng(req.query.boundsSwLng, 'lng'),
  boundsNeLat: parseOptionalLatLng(req.query.boundsNeLat, 'lat'),
  boundsNeLng: parseOptionalLatLng(req.query.boundsNeLng, 'lng'),
});

export const getFieldMonitoringUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const scopedUserIds = await resolveScopedUserIds(req);
    const data = await FieldMonitoringService.getMonitoringRoster(
      buildRosterParams(req),
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

// GET /api/field-monitoring/export — xlsx mirroring list WHERE.
// escapeFormulaRow (CWE-1236) on every user-controlled cell.
// FIELD_MONITORING_EXPORTED audit row written PRE-stream. Hard cap.
export const exportFieldMonitoring = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const scopedUserIds = await resolveScopedUserIds(req);
    const rows = await FieldMonitoringService.exportMonitoringRoster(
      buildRosterParams(req),
      scopedUserIds,
      FIELD_MONITORING_EXPORT_LIMIT
    );

    await createAuditLog({
      userId: req.user?.id,
      action: 'FIELD_MONITORING_EXPORTED',
      entityType: 'field_monitoring',
      details: { recordCount: rows.length, filters: req.query },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Field Monitoring');
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Live Status', key: 'liveStatus', width: 14 },
      { header: 'Operating Area', key: 'operatingArea', width: 25 },
      { header: 'Operating Pincode', key: 'operatingPincode', width: 14 },
      { header: 'Assigned Areas', key: 'totalAreas', width: 14 },
      { header: 'Assigned Pincodes', key: 'totalPincodes', width: 16 },
      { header: 'Active Assignments', key: 'activeAssignmentCount', width: 16 },
      { header: 'Last Activity', key: 'lastActivity', width: 22 },
      { header: 'Last Location Lat', key: 'lat', width: 14 },
      { header: 'Last Location Lng', key: 'lng', width: 14 },
      { header: 'Last Location Time', key: 'locTime', width: 22 },
    ];
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    rows.forEach(row => {
      worksheet.addRow(
        escapeFormulaRow({
          name: row.name,
          username: row.username,
          employeeId: row.employeeId,
          phone: row.phone,
          liveStatus: row.liveStatus,
          operatingArea: row.operatingArea,
          operatingPincode: row.operatingPincode,
          totalAreas: row.assignedTerritory.totalAreas,
          totalPincodes: row.assignedTerritory.totalPincodes,
          activeAssignmentCount: row.activeAssignmentCount,
          lastActivity: row.lastActivityAt ? new Date(row.lastActivityAt).toISOString() : '',
          lat: row.lastLocation?.lat ?? '',
          lng: row.lastLocation?.lng ?? '',
          locTime: row.lastLocation?.time ? new Date(row.lastLocation.time).toISOString() : '',
        })
      );
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=field_monitoring_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting field monitoring roster:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export field monitoring roster',
      error: {
        code: 'FIELD_MONITORING_EXPORT_ERROR',
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

/**
 * On-demand location ping. Admin clicks "Get fresh location" on the
 * field-monitoring page → BE sends a silent FCM data-message to the
 * target user's registered Android device(s) → mobile FCM handler
 * grabs GPS + POSTs to /api/mobile/location/capture → BE WebSocket
 * pushes the updated row to admins watching the field-monitoring room.
 *
 * Returns 202 + requestId immediately. The actual location row lands
 * via the standard capture flow + async WebSocket event; FE shows a
 * spinner with 20s client-side timeout, then either resolves on the
 * incoming WS event or shows "couldn't reach <user>".
 *
 * No rate limit (per product decision 2026-05-13).
 */
export const requestUserLocation = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const targetUserId =
      typeof req.params.id === 'string' ? req.params.id : String(req.params.id || '');
    if (!targetUserId) {
      res.status(400).json({
        success: false,
        message: 'Target user id is required',
        error: { code: 'MISSING_USER_ID' },
      });
      return;
    }

    // Enforce dataScope — admin can only ping users they have visibility on
    // (same scope rule as the other field-monitoring endpoints).
    const scopedUserIds = await resolveScopedUserIds(req);
    if (scopedUserIds !== undefined && !scopedUserIds.includes(targetUserId)) {
      res.status(404).json({
        success: false,
        message: 'Field monitoring user not found',
        error: { code: 'FIELD_MONITORING_USER_NOT_FOUND' },
      });
      return;
    }

    const requestId = randomUUID();
    const fcmResult = await pushNotificationService.sendDataMessage([targetUserId], {
      type: 'LOCATION_REQUEST',
      requestId,
      requestedBy: req.user?.id || '',
      requestedAt: new Date().toISOString(),
    });

    logger.info('Location-request ping dispatched', {
      requestId,
      targetUserId,
      requestedBy: req.user?.id,
      fcmSuccess: fcmResult.success,
      fcmFailed: fcmResult.failed,
    });

    res.status(202).json({
      success: true,
      message: 'Location request dispatched',
      data: {
        requestId,
        dispatchedToTokens: fcmResult.success,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to dispatch location request',
      error: {
        code: 'LOCATION_REQUEST_DISPATCH_FAILED',
        details: errorMessage(error),
      },
    });
  }
};
