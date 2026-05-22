import { query } from '@/config/database';
import { deriveCapabilitiesFromPermissionCodes } from '@/security/rbacAccess';

const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'PENDING'] as const;
const ALLOWED_STATUSES = [
  'Offline',
  'Submitted',
  'At Location',
  'Travelling',
  'Idle',
] as const;
const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;
const SUBMITTED_THRESHOLD_MS = 10 * 60 * 1000;
const AT_LOCATION_THRESHOLD_MS = 15 * 60 * 1000;

type NullableDate = Date | null;

type FieldUserPopulationRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  employeeId: string | null;
  permissionCodes: string[] | null;
};

type MaxTimestampRow = {
  userId: string;
  value: Date | null;
};

type TaskActivityRow = {
  userId: string;
  maxStartedAt: Date | null;
  maxCompletedAt: Date | null;
  maxUpdatedAt: Date | null;
  maxCurrentAssignedAt: Date | null;
  maxAssignedAt: Date | null;
};

type LocationRow = {
  userId: string;
  lat: string | number | null;
  lng: string | number | null;
  accuracy: string | number | null;
  recordedAt: Date | null;
  source: 'TASK' | 'ADMIN_PING' | null;
  requestedById: string | null;
  requestedByName: string | null;
};

type SubmissionLocationRow = {
  userId: string;
  geoLocation: unknown;
  submittedAt: Date | null;
};

type TaskCoordinateRow = {
  userId: string;
  latitude: string | number | null;
  longitude: string | number | null;
  activityAt: Date | null;
};

type ActiveTaskContextRow = {
  userId: string;
  verificationTaskId: string;
  pincode: string | null;
  areaId: number | null;
  areaName: string | null;
};

type AssignedAreaRow = {
  userId: string;
  pincodeId: number;
  pincodeCode: string;
  areaId: number;
  areaName: string;
};

type AssignedPincodeRow = {
  userId: string;
  pincodeId: number;
  pincodeCode: string;
};

type ActiveAssignmentRow = {
  userId: string;
  taskId: string;
  taskNumber: string;
  status: string;
  priority: string | null;
  startedAt: Date | null;
  assignedAt: Date | null;
  currentAssignedAt: Date | null;
  caseId: string;
  caseNumber: number;
  customerName: string;
  customerPhone: string | null;
  caseStatus: string | null;
  pincode: string | null;
};

export type FieldUserPopulation = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  employeeId: string | null;
  permissionCodes: string[];
};

export type FieldUserActivity = {
  lastHeartbeatAt: NullableDate;
  lastTaskActivityAt: NullableDate;
  lastLocationAt: NullableDate;
  lastSubmissionAt: NullableDate;
};

export type FieldUserLiveStatus = 'Offline' | 'Submitted' | 'At Location' | 'Travelling' | 'Idle';

export type FieldUserLatestLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
  recordedAt: Date | null;
  source: 'locations' | 'formSubmissions' | 'verificationTasks';
  // 2026-05-13: when the locations-row was an admin-triggered ping,
  // these surface WHO triggered it. NULL for 'TASK'-source rows and
  // for formSubmissions / verificationTasks fallbacks.
  pingSource?: 'TASK' | 'ADMIN_PING' | null;
  requestedById?: string | null;
  requestedByName?: string | null;
};

export type FieldUserOperatingArea = {
  currentOperatingPincode: string | null;
  currentArea: {
    id: number | null;
    name: string | null;
    sourceTaskId: string | null;
  };
  assignedTerritory: {
    areas: Array<{
      areaId: number;
      areaName: string;
      pincodeId: number;
      pincodeCode: string;
    }>;
    pincodes: Array<{
      pincodeId: number;
      pincodeCode: string;
    }>;
  };
};

export type FieldUserActiveAssignment = {
  task: {
    id: string;
    taskNumber: string;
    status: string;
    priority: string | null;
    startedAt: NullableDate;
    assignedAt: NullableDate;
    currentAssignedAt: NullableDate;
    pincode: string | null;
  };
  case: {
    id: string;
    caseNumber: number;
    customerName: string;
    customerPhone: string | null;
    status: string | null;
  };
};

export type MonitoringStats = {
  totalFieldUsers: number;
  activeToday: number;
  activeNow: number;
  submissionsToday: number;
  offlineCount: number;
};

export type MonitoringRosterParams = {
  page: number;
  limit: number;
  search?: string;
  pincode?: string;
  areaId?: number;
  status?: FieldUserLiveStatus;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  createdFrom?: string;
  createdTo?: string;
};

type RosterRow = {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  employeeId: string | null;
  created_at: Date | string | null;
  last_heartbeat_at: Date | string | null;
  last_task_activity_at: Date | string | null;
  last_location_at: Date | string | null;
  last_submission_at: Date | string | null;
  assignment_count: string | number;
  lat: string | number | null;
  lng: string | number | null;
  accuracy: string | number | null;
  loc_recorded_at: Date | string | null;
  loc_source: string | null;
  ping_source: 'TASK' | 'ADMIN_PING' | null;
  requested_by_id: string | null;
  requested_by_name: string | null;
  live_status: string;
};

export type MonitoringRosterItem = {
  id: string;
  name: string;
  username: string;
  employeeId: string | null;
  phone: string | null;
  liveStatus: FieldUserLiveStatus;
  lastHeartbeatAt: NullableDate;
  lastActivityAt: NullableDate;
  lastLocation: {
    lat: number;
    lng: number;
    time: NullableDate;
    freshness: 'fresh' | 'stale';
    source: FieldUserLatestLocation['source'];
    pingSource?: 'TASK' | 'ADMIN_PING' | null;
    requestedById?: string | null;
    requestedByName?: string | null;
  } | null;
  operatingArea: string | null;
  operatingPincode: string | null;
  assignedTerritory: {
    totalAreas: number;
    totalPincodes: number;
    areaNames: string[];
    pincodeCodes: string[];
  };
  activeAssignmentCount: number;
  currentCaseSummary: {
    caseId: string;
    caseNumber: number;
    customerName: string;
    status: string | null;
    taskId: string;
    taskNumber: string;
    taskStatus: string;
  } | null;
};

export type MonitoringRosterResponse = {
  data: MonitoringRosterItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type UserMonitoringDetail = {
  user: {
    id: string;
    name: string;
    username: string;
    phone: string | null;
    email: string | null;
    employeeId: string | null;
  };
  activity: FieldUserActivity;
  liveStatus: FieldUserLiveStatus;
  lastKnownLocation: FieldUserLatestLocation | null;
  openAssignments: FieldUserActiveAssignment[];
  operatingTerritory: FieldUserOperatingArea;
};

export class FieldMonitoringService {
  static async getFieldUserPopulation(scopeUserIds?: string[]): Promise<FieldUserPopulation[]> {
    const result = await query<FieldUserPopulationRow>(
      `
        SELECT
          u.id,
          u.name,
          u.username,
          u.email,
          u.phone,
          u.employee_id as employee_id,
          COALESCE((
            SELECT ARRAY_AGG(DISTINCT p.code ORDER BY p.code)
            FROM user_roles ur
            JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
            JOIN permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = u.id
          ), ARRAY[]::varchar[]) as "permission_codes"
        FROM users u
        WHERE u.deleted_at IS NULL
          AND u.is_active = true
      `
    );

    let population = result.rows
      .map(row => ({
        id: row.id,
        name: row.name,
        username: row.username,
        email: row.email,
        phone: row.phone,
        employeeId: row.employeeId,
        permissionCodes: row.permissionCodes || [],
      }))
      .filter(user => deriveCapabilitiesFromPermissionCodes(user.permissionCodes).executionActor);

    if (scopeUserIds) {
      const scopedSet = new Set(scopeUserIds);
      population = population.filter(user => scopedSet.has(user.id));
    }

    return population;
  }

  static async computeUserActivity(userId: string): Promise<FieldUserActivity> {
    const activityMap = await this.getUserActivities([userId]);
    return activityMap.get(userId) || this.emptyActivity();
  }

  static async computeLiveStatus(userId: string): Promise<FieldUserLiveStatus> {
    const [activity, location, assignments] = await Promise.all([
      this.computeUserActivity(userId),
      this.getLatestLocation(userId),
      this.getActiveAssignments(userId),
    ]);
    return this.deriveLiveStatus(activity, location, assignments);
  }

  static async getLatestLocation(userId: string): Promise<FieldUserLatestLocation | null> {
    const locationMap = await this.getLatestLocations([userId]);
    return locationMap.get(userId) || null;
  }

  static async getOperatingArea(userId: string): Promise<FieldUserOperatingArea> {
    const [currentContexts, assignedTerritories] = await Promise.all([
      this.getCurrentOperatingContexts([userId]),
      this.getAssignedTerritories([userId]),
    ]);

    const currentContext = currentContexts.get(userId);
    const territory = assignedTerritories.get(userId) || { areas: [], pincodes: [] };

    return {
      currentOperatingPincode:
        currentContext?.pincode ??
        territory.areas[0]?.pincodeCode ??
        territory.pincodes[0]?.pincodeCode ??
        null,
      currentArea: {
        id: currentContext?.areaId ?? null,
        name: currentContext?.areaName ?? null,
        sourceTaskId: currentContext?.verificationTaskId ?? null,
      },
      assignedTerritory: territory,
    };
  }

  static async getActiveAssignments(userId: string): Promise<FieldUserActiveAssignment[]> {
    const assignmentsMap = await this.getOpenAssignments([userId]);
    return assignmentsMap.get(userId) || [];
  }

  static async getMonitoringStats(scopeUserIds?: string[]): Promise<MonitoringStats> {
    const population = await this.getFieldUserPopulation(scopeUserIds);
    const userIds = population.map(user => user.id);

    if (userIds.length === 0) {
      return {
        totalFieldUsers: 0,
        activeToday: 0,
        activeNow: 0,
        submissionsToday: 0,
        offlineCount: 0,
      };
    }

    const activities = await this.getUserActivities(userIds);
    const startOfToday = this.getStartOfToday();

    // 5th card aggregate (canonical §9): count of form submissions today
    // restricted to the field-user population.
    const submissionsTodayResult = await query<{ submissions_today: string }>(
      `
        SELECT COUNT(*) AS submissions_today
        FROM form_submissions
        WHERE submitted_by = ANY($1::uuid[])
          AND submitted_at >= $2
      `,
      [userIds, startOfToday]
    );
    const submissionsToday = parseInt(submissionsTodayResult.rows[0]?.submissions_today || '0', 10);

    let activeToday = 0;
    let activeNow = 0;
    let offlineCount = 0;

    userIds.forEach(userId => {
      const activity = activities.get(userId) || this.emptyActivity();
      const latestOperationalActivity = this.getLatestOperationalActivity(activity);
      const latestOverallActivity = this.getLatestOverallActivity(activity);

      if (latestOverallActivity && latestOverallActivity.getTime() >= startOfToday.getTime()) {
        activeToday += 1;
      }

      if (
        latestOperationalActivity &&
        this.isFresh(latestOperationalActivity, OFFLINE_THRESHOLD_MS)
      ) {
        activeNow += 1;
      }

      // 2026-05-23: 'Offline' = no operational activity in last 15min
      // (matches the updated deriveLiveStatus check; mobile_device_sync
      // heartbeat is never written so the legacy lastHeartbeatAt gate
      // permanently marked everyone Offline).
      if (!this.isFresh(latestOperationalActivity, OFFLINE_THRESHOLD_MS)) {
        offlineCount += 1;
      }
    });

    return {
      totalFieldUsers: userIds.length,
      activeToday,
      activeNow,
      submissionsToday,
      offlineCount,
    };
  }

  // 2026-05-23: xlsx export mirroring list WHERE clause. Hard-capped at
  // FIELD_MONITORING_EXPORT_LIMIT rows (defaults to 10000 — see
  // controller). Returns the same rich roster shape as the list.
  static async exportMonitoringRoster(
    params: MonitoringRosterParams,
    scopeUserIds?: string[],
    limit = 10000
  ): Promise<MonitoringRosterItem[]> {
    const population = await this.getFieldUserPopulation(scopeUserIds);
    const userIds = population.map(user => user.id);
    if (userIds.length === 0) {
      return [];
    }
    const result = await this.queryRosterRows(userIds, params, scopeUserIds, {
      page: 1,
      limit,
    });
    return result.rows;
  }

  static async getMonitoringRoster(
    params: MonitoringRosterParams,
    scopeUserIds?: string[]
  ): Promise<MonitoringRosterResponse> {
    const normalizedPage = Math.max(1, Number(params.page) || 1);
    const normalizedLimit = Math.max(1, Number(params.limit) || 20);
    const population = await this.getFieldUserPopulation(scopeUserIds);
    const userIds = population.map(user => user.id);

    if (userIds.length === 0) {
      return {
        data: [],
        pagination: {
          page: normalizedPage,
          limit: normalizedLimit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // 2026-05-23: SQL-side WHERE + LIMIT/OFFSET + COUNT(*) replacing the
    // prior load-everything-then-JS-paginate pattern. liveStatus is
    // computed inline via CASE so the status filter can be applied SQL-
    // side (mirrors deriveLiveStatus exactly — see also-modified JS
    // helper for the detail-view path).
    const filtered = await this.queryRosterRows(userIds, params, scopeUserIds, {
      page: normalizedPage,
      limit: normalizedLimit,
    });

    return {
      data: filtered.rows,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total: filtered.total,
        totalPages: filtered.total === 0 ? 0 : Math.ceil(filtered.total / normalizedLimit),
      },
    };
  }

  static async getUserMonitoringDetail(
    userId: string,
    scopeUserIds?: string[]
  ): Promise<UserMonitoringDetail | null> {
    const population = await this.getFieldUserPopulation(scopeUserIds);
    const user = population.find(candidate => candidate.id === userId);

    if (!user) {
      return null;
    }

    const [activities, locations, territories, assignments] = await Promise.all([
      this.getUserActivities([userId]),
      this.getLatestLocations([userId]),
      this.getAssignedTerritories([userId]),
      this.getOpenAssignments([userId]),
    ]);

    const activity = activities.get(userId) || this.emptyActivity();
    const lastKnownLocation = locations.get(userId) || null;
    const openAssignments = assignments.get(userId) || [];
    const operatingTerritory = await this.getOperatingArea(userId);

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        employeeId: user.employeeId,
      },
      activity,
      liveStatus: this.deriveLiveStatus(activity, lastKnownLocation, openAssignments),
      lastKnownLocation,
      openAssignments,
      operatingTerritory: {
        ...operatingTerritory,
        assignedTerritory: territories.get(userId) || operatingTerritory.assignedTerritory,
      },
    };
  }

  // 2026-05-23: SINGLE-query roster path. Computes liveStatus inline via
  // SQL CASE so the status filter is SQL-side. Filters (search/pincode/
  // areaId/status/createdFrom/createdTo) all push down. LIMIT/OFFSET +
  // COUNT(*) sit on the same WHERE. Used for both list (paginated) and
  // export (capped via params.exportLimit). Returns rich roster rows
  // ready for FE consumption.
  private static async queryRosterRows(
    userIds: string[],
    params: MonitoringRosterParams,
    _scopeUserIds: string[] | undefined,
    pagination: { page: number; limit: number }
  ): Promise<{ rows: MonitoringRosterItem[]; total: number }> {
    const queryParams: (string | number | string[])[] = [userIds];
    const conditions: string[] = ['u.id = ANY($1::uuid[])', 'u.deleted_at IS NULL'];
    let paramIndex = 2;

    if (params.search && typeof params.search === 'string' && params.search.trim()) {
      conditions.push(`(u.name ILIKE $${paramIndex} OR COALESCE(u.phone, '') ILIKE $${paramIndex})`);
      queryParams.push(`%${params.search.trim()}%`);
      paramIndex++;
    }
    if (params.pincode && typeof params.pincode === 'string' && params.pincode.trim()) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM user_pincode_assignments upa
          JOIN pincodes p ON p.id = upa.pincode_id
          WHERE upa.user_id = u.id AND upa.is_active = true AND p.code = $${paramIndex}
        )
        OR EXISTS (
          SELECT 1 FROM user_area_assignments uaa
          JOIN pincodes p ON p.id = uaa.pincode_id
          WHERE uaa.user_id = u.id AND uaa.is_active = true AND p.code = $${paramIndex}
        )
      )`);
      queryParams.push(params.pincode.trim());
      paramIndex++;
    }
    if (typeof params.areaId === 'number') {
      conditions.push(`EXISTS (
        SELECT 1 FROM user_area_assignments uaa
        WHERE uaa.user_id = u.id AND uaa.is_active = true AND uaa.area_id = $${paramIndex}
      )`);
      queryParams.push(params.areaId);
      paramIndex++;
    }
    if (typeof params.createdFrom === 'string' && params.createdFrom) {
      conditions.push(`u.created_at >= $${paramIndex}`);
      queryParams.push(params.createdFrom);
      paramIndex++;
    }
    if (typeof params.createdTo === 'string' && params.createdTo) {
      conditions.push(`u.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
      queryParams.push(params.createdTo);
      paramIndex++;
    }

    const baseConditions = conditions.join(' AND ');
    const statusFilter =
      params.status && ALLOWED_STATUSES.includes(params.status) ? params.status : null;
    const statusPlaceholder = statusFilter ? `$${paramIndex}` : null;
    if (statusFilter) {
      queryParams.push(statusFilter);
      paramIndex++;
    }

    const sortBy = params.sortBy === 'createdAt' ? 'u.created_at' : 'u.name';
    const sortOrder: 'ASC' | 'DESC' = params.sortOrder === 'desc' ? 'DESC' : 'ASC';

    const rosterCte = `
      WITH base AS (
        SELECT
          u.id,
          u.name,
          u.username,
          u.phone,
          u.employee_id AS "employeeId",
          u.created_at AS created_at,
          (SELECT MAX(last_sync_at) FROM mobile_device_sync m WHERE m.user_id = u.id) AS last_heartbeat_at,
          (SELECT MAX(GREATEST(
              vt.started_at::timestamptz,
              vt.completed_at::timestamptz,
              vt.updated_at::timestamptz,
              vt.current_assigned_at,
              vt.assigned_at::timestamptz
          )) FROM verification_tasks vt WHERE vt.assigned_to = u.id) AS last_task_activity_at,
          (SELECT MAX(recorded_at) FROM locations l WHERE l.recorded_by = u.id) AS last_location_at,
          (SELECT MAX(submitted_at) FROM form_submissions f WHERE f.submitted_by = u.id) AS last_submission_at,
          (SELECT COUNT(*) FROM verification_tasks vt
            WHERE vt.assigned_to = u.id
              AND vt.status = ANY(ARRAY['ASSIGNED','IN_PROGRESS','PENDING']::text[])
          ) AS assignment_count
        FROM users u
        WHERE ${baseConditions}
      ),
      with_location AS (
        SELECT b.*,
          loc.lat, loc.lng, loc.accuracy, loc.recorded_at AS loc_recorded_at,
          loc.source AS loc_source, loc.requested_by_id, loc.requested_by_name, loc.ping_source
        FROM base b
        LEFT JOIN LATERAL (
          SELECT l.latitude AS lat, l.longitude AS lng, l.accuracy, l.recorded_at,
            'locations'::text AS source, l.source AS ping_source,
            requester.id AS requested_by_id, requester.name AS requested_by_name
          FROM locations l
          LEFT JOIN users requester ON requester.id = l.requested_by_user_id
          WHERE l.recorded_by = b.id
          ORDER BY l.recorded_at DESC, l.id DESC
          LIMIT 1
        ) loc ON true
      ),
      with_status AS (
        SELECT w.*,
          CASE
            WHEN GREATEST(w.last_task_activity_at, w.last_location_at, w.last_submission_at) IS NULL
              OR GREATEST(w.last_task_activity_at, w.last_location_at, w.last_submission_at)
                 < NOW() - INTERVAL '15 minutes'
              THEN 'Offline'
            WHEN w.last_submission_at >= NOW() - INTERVAL '10 minutes'
              THEN 'Submitted'
            WHEN w.loc_source = 'locations'
              AND w.last_location_at >= NOW() - INTERVAL '15 minutes'
              AND w.assignment_count > 0
              THEN 'At Location'
            WHEN w.assignment_count > 0
              THEN 'Travelling'
            ELSE 'Idle'
          END AS live_status
        FROM with_location w
      ),
      filtered AS (
        SELECT * FROM with_status
        ${statusPlaceholder ? `WHERE live_status = ${statusPlaceholder}` : ''}
      )
    `;

    const countSql = `${rosterCte} SELECT COUNT(*) AS total FROM filtered`;
    const countResult = await query<{ total: string }>(countSql, queryParams);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const limitPlaceholder = `$${paramIndex}`;
    const offsetPlaceholder = `$${paramIndex + 1}`;
    queryParams.push(pagination.limit, (pagination.page - 1) * pagination.limit);

    // 'filtered' CTE projects unprefixed columns (name, created_at, …),
    // so ORDER BY must reference those — not the `u.`-prefixed names
    // used inside the base CTE.
    const orderColumn = sortBy === 'u.created_at' ? 'created_at' : 'name';
    const dataSql = `
      ${rosterCte}
      SELECT * FROM filtered
      ORDER BY ${orderColumn} ${sortOrder}, id ASC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const dataResult = await query<RosterRow>(dataSql, queryParams);
    const rosterUserIds = dataResult.rows.map(r => r.id);

    // Hydrate operating-context + assigned-territory + current-case for
    // ONLY the paginated user set (cheap join after SQL-side WHERE).
    if (rosterUserIds.length === 0) {
      return { rows: [], total };
    }
    // Hydrate operating-context + assigned-territory + current-case +
    // latest location for ONLY the paginated user set. Locations use the
    // existing 3-source priority helper (locations -> formSubmissions ->
    // verificationTasks) so users with no `locations` row but recent
    // form submissions still appear on the map.
    const [operatingContexts, territories, openAssignments, latestLocations] = await Promise.all([
      this.getCurrentOperatingContexts(rosterUserIds),
      this.getAssignedTerritories(rosterUserIds),
      this.getOpenAssignments(rosterUserIds),
      this.getLatestLocations(rosterUserIds),
    ]);

    const rows = dataResult.rows.map<MonitoringRosterItem>(row => {
      const territory = territories.get(row.id) || { areas: [], pincodes: [] };
      const currentOperating = operatingContexts.get(row.id);
      const assignments = openAssignments.get(row.id) || [];
      const currentCase = assignments[0] || null;
      const latestLocation = latestLocations.get(row.id) || null;
      const uniquePincodeCodes = [
        ...new Set([
          ...territory.areas.map(area => area.pincodeCode),
          ...territory.pincodes.map(pincode => pincode.pincodeCode),
        ]),
      ];

      const overallActivityAt = this.maxDate([
        row.last_heartbeat_at,
        row.last_task_activity_at,
        row.last_location_at,
        row.last_submission_at,
      ]);

      return {
        id: row.id,
        name: row.name,
        username: row.username,
        employeeId: row.employeeId,
        phone: row.phone,
        liveStatus: row.live_status as FieldUserLiveStatus,
        lastHeartbeatAt: this.toDate(row.last_heartbeat_at),
        lastActivityAt: overallActivityAt,
        lastLocation: latestLocation
          ? {
              lat: latestLocation.lat,
              lng: latestLocation.lng,
              time: latestLocation.recordedAt,
              freshness: this.isFresh(latestLocation.recordedAt, AT_LOCATION_THRESHOLD_MS)
                ? 'fresh'
                : 'stale',
              source: latestLocation.source,
              pingSource: latestLocation.pingSource ?? null,
              requestedById: latestLocation.requestedById ?? null,
              requestedByName: latestLocation.requestedByName ?? null,
            }
          : null,
        operatingArea: currentOperating?.areaName ?? null,
        operatingPincode:
          currentOperating?.pincode ??
          territory.areas[0]?.pincodeCode ??
          territory.pincodes[0]?.pincodeCode ??
          null,
        assignedTerritory: {
          totalAreas: territory.areas.length,
          totalPincodes: uniquePincodeCodes.length,
          areaNames: territory.areas.map(area => area.areaName),
          pincodeCodes: uniquePincodeCodes,
        },
        activeAssignmentCount: assignments.length,
        currentCaseSummary: currentCase
          ? {
              caseId: currentCase.case.id,
              caseNumber: currentCase.case.caseNumber,
              customerName: currentCase.case.customerName,
              status: currentCase.case.status,
              taskId: currentCase.task.id,
              taskNumber: currentCase.task.taskNumber,
              taskStatus: currentCase.task.status,
            }
          : null,
      };
    });

    return { rows, total };
  }

  private static async getUserActivities(
    userIds: string[]
  ): Promise<Map<string, FieldUserActivity>> {
    const uniqueUserIds = this.uniqueUserIds(userIds);
    const activityMap = new Map<string, FieldUserActivity>();

    if (uniqueUserIds.length === 0) {
      return activityMap;
    }

    uniqueUserIds.forEach(userId => {
      activityMap.set(userId, this.emptyActivity());
    });

    const [heartbeatResult, taskResult, locationResult, submissionResult] = await Promise.all([
      query<MaxTimestampRow>(
        `
          SELECT
            user_id as user_id,
            MAX(last_sync_at) as value
          FROM mobile_device_sync
          WHERE user_id = ANY($1::uuid[])
          GROUP BY user_id
        `,
        [uniqueUserIds]
      ),
      query<TaskActivityRow>(
        `
          SELECT
            assigned_to as user_id,
            MAX(started_at) as "max_started_at",
            MAX(completed_at) as "max_completed_at",
            MAX(updated_at) as "max_updated_at",
            MAX(current_assigned_at) as "max_current_assigned_at",
            MAX(assigned_at) as "max_assigned_at"
          FROM verification_tasks
          WHERE assigned_to = ANY($1::uuid[])
          GROUP BY assigned_to
        `,
        [uniqueUserIds]
      ),
      query<MaxTimestampRow>(
        `
          SELECT
            recorded_by as user_id,
            MAX(recorded_at) as value
          FROM locations
          WHERE recorded_by = ANY($1::uuid[])
          GROUP BY recorded_by
        `,
        [uniqueUserIds]
      ),
      query<MaxTimestampRow>(
        `
          SELECT
            submitted_by as user_id,
            MAX(submitted_at) as value
          FROM form_submissions
          WHERE submitted_by = ANY($1::uuid[])
          GROUP BY submitted_by
        `,
        [uniqueUserIds]
      ),
    ]);

    heartbeatResult.rows.forEach(row => {
      const current = activityMap.get(row.userId);
      if (current) {
        current.lastHeartbeatAt = this.toDate(row.value);
      }
    });

    taskResult.rows.forEach(row => {
      const current = activityMap.get(row.userId);
      if (!current) {
        return;
      }

      current.lastTaskActivityAt = this.maxDate([
        row.maxStartedAt,
        row.maxCompletedAt,
        row.maxUpdatedAt,
        row.maxCurrentAssignedAt,
        row.maxAssignedAt,
      ]);
    });

    locationResult.rows.forEach(row => {
      const current = activityMap.get(row.userId);
      if (current) {
        current.lastLocationAt = this.toDate(row.value);
      }
    });

    submissionResult.rows.forEach(row => {
      const current = activityMap.get(row.userId);
      if (current) {
        current.lastSubmissionAt = this.toDate(row.value);
      }
    });

    return activityMap;
  }

  private static async getLatestLocations(
    userIds: string[]
  ): Promise<Map<string, FieldUserLatestLocation>> {
    const uniqueUserIds = this.uniqueUserIds(userIds);
    const locationMap = new Map<string, FieldUserLatestLocation>();

    if (uniqueUserIds.length === 0) {
      return locationMap;
    }

    const [locationResult, submissionResult, taskResult] = await Promise.all([
      query<LocationRow>(
        `
          SELECT DISTINCT ON (l.recorded_by)
            l.recorded_by as user_id,
            l.latitude as lat,
            l.longitude as lng,
            l.accuracy,
            l.recorded_at as recorded_at,
            l.source,
            requester.id as "requested_by_id",
            requester.name as "requested_by_name"
          FROM locations l
          LEFT JOIN users requester ON requester.id = l.requested_by_user_id
          WHERE l.recorded_by = ANY($1::uuid[])
          ORDER BY l.recorded_by, l.recorded_at DESC, l.id DESC
        `,
        [uniqueUserIds]
      ),
      query<SubmissionLocationRow>(
        `
          SELECT DISTINCT ON (fs.submitted_by)
            fs.submitted_by as user_id,
            fs.geo_location as geo_location,
            fs.submitted_at as "submitted_at"
          FROM form_submissions fs
          WHERE fs.submitted_by = ANY($1::uuid[])
            AND fs.geo_location IS NOT NULL
          ORDER BY fs.submitted_by, fs.submitted_at DESC, fs.created_at DESC
        `,
        [uniqueUserIds]
      ),
      query<TaskCoordinateRow>(
        `
          SELECT DISTINCT ON (vt.assigned_to)
            vt.assigned_to as user_id,
            vt.latitude,
            vt.longitude,
            COALESCE(
              vt.started_at::timestamptz,
              vt.current_assigned_at,
              vt.assigned_at::timestamptz,
              vt.updated_at::timestamptz,
              vt.created_at::timestamptz
            ) as "activity_at"
          FROM verification_tasks vt
          WHERE vt.assigned_to = ANY($1::uuid[])
            AND vt.latitude IS NOT NULL
            AND vt.longitude IS NOT NULL
          ORDER BY
            vt.assigned_to,
            COALESCE(
              vt.started_at::timestamptz,
              vt.current_assigned_at,
              vt.assigned_at::timestamptz,
              vt.updated_at::timestamptz,
              vt.created_at::timestamptz
            ) DESC,
            vt.id DESC
        `,
        [uniqueUserIds]
      ),
    ]);

    locationResult.rows.forEach(row => {
      const lat = this.toNumber(row.lat);
      const lng = this.toNumber(row.lng);

      if (lat === null || lng === null) {
        return;
      }

      locationMap.set(row.userId, {
        lat,
        lng,
        accuracy: this.toNumber(row.accuracy),
        recordedAt: this.toDate(row.recordedAt),
        source: 'locations',
        pingSource: row.source ?? null,
        requestedById: row.requestedById ?? null,
        requestedByName: row.requestedByName ?? null,
      });
    });

    submissionResult.rows.forEach(row => {
      if (locationMap.has(row.userId)) {
        return;
      }

      const coordinates = this.extractCoordinates(row.geoLocation);
      if (!coordinates) {
        return;
      }

      locationMap.set(row.userId, {
        lat: coordinates.lat,
        lng: coordinates.lng,
        accuracy: coordinates.accuracy,
        recordedAt: this.toDate(row.submittedAt),
        source: 'formSubmissions',
      });
    });

    taskResult.rows.forEach(row => {
      if (locationMap.has(row.userId)) {
        return;
      }

      const lat = this.toNumber(row.latitude);
      const lng = this.toNumber(row.longitude);

      if (lat === null || lng === null) {
        return;
      }

      locationMap.set(row.userId, {
        lat,
        lng,
        accuracy: null,
        recordedAt: this.toDate(row.activityAt),
        source: 'verificationTasks',
      });
    });

    return locationMap;
  }

  private static async getCurrentOperatingContexts(
    userIds: string[]
  ): Promise<Map<string, ActiveTaskContextRow>> {
    const uniqueUserIds = this.uniqueUserIds(userIds);
    const contextMap = new Map<string, ActiveTaskContextRow>();

    if (uniqueUserIds.length === 0) {
      return contextMap;
    }

    const result = await query<ActiveTaskContextRow>(
      `
        SELECT DISTINCT ON (vt.assigned_to)
          vt.assigned_to as user_id,
          vt.id as "verification_task_id",
          (SELECT code FROM pincodes WHERE id = vt.pincode_id) as pincode,
          vt.area_id as area_id,
          a.name as "area_name"
        FROM verification_tasks vt
        LEFT JOIN areas a ON a.id = vt.area_id
        WHERE vt.assigned_to = ANY($1::uuid[])
          AND vt.status = ANY($2::text[])
        ORDER BY
          vt.assigned_to,
          COALESCE(
            vt.started_at::timestamptz,
            vt.current_assigned_at,
            vt.assigned_at::timestamptz,
            vt.updated_at::timestamptz,
            vt.created_at::timestamptz
          ) DESC,
          vt.id DESC
      `,
      [uniqueUserIds, [...ACTIVE_ASSIGNMENT_STATUSES]]
    );

    result.rows.forEach(row => {
      contextMap.set(row.userId, row);
    });

    return contextMap;
  }

  private static async getAssignedTerritories(userIds: string[]): Promise<
    Map<
      string,
      {
        areas: FieldUserOperatingArea['assignedTerritory']['areas'];
        pincodes: FieldUserOperatingArea['assignedTerritory']['pincodes'];
      }
    >
  > {
    const uniqueUserIds = this.uniqueUserIds(userIds);
    const territoryMap = new Map<
      string,
      {
        areas: FieldUserOperatingArea['assignedTerritory']['areas'];
        pincodes: FieldUserOperatingArea['assignedTerritory']['pincodes'];
      }
    >();

    if (uniqueUserIds.length === 0) {
      return territoryMap;
    }

    uniqueUserIds.forEach(userId => {
      territoryMap.set(userId, { areas: [], pincodes: [] });
    });

    const [areaResult, pincodeResult] = await Promise.all([
      query<AssignedAreaRow>(
        `
          SELECT
            uaa.user_id as user_id,
            uaa.pincode_id as pincode_id,
            p.code as pincode_code,
            uaa.area_id as area_id,
            a.name as "area_name"
          FROM user_area_assignments uaa
          JOIN pincodes p ON p.id = uaa.pincode_id
          JOIN areas a ON a.id = uaa.area_id
          WHERE uaa.user_id = ANY($1::uuid[])
            AND uaa.is_active = true
          ORDER BY uaa.user_id, p.code, a.name
        `,
        [uniqueUserIds]
      ),
      query<AssignedPincodeRow>(
        `
          SELECT
            upa.user_id as user_id,
            upa.pincode_id as pincode_id,
            p.code as pincode_code
          FROM user_pincode_assignments upa
          JOIN pincodes p ON p.id = upa.pincode_id
          WHERE upa.user_id = ANY($1::uuid[])
            AND upa.is_active = true
          ORDER BY upa.user_id, p.code
        `,
        [uniqueUserIds]
      ),
    ]);

    areaResult.rows.forEach(row => {
      territoryMap.get(row.userId)?.areas.push({
        areaId: row.areaId,
        areaName: row.areaName,
        pincodeId: row.pincodeId,
        pincodeCode: row.pincodeCode,
      });
    });

    pincodeResult.rows.forEach(row => {
      const territory = territoryMap.get(row.userId);
      if (!territory) {
        return;
      }

      const alreadyCoveredByArea = territory.areas.some(area => area.pincodeId === row.pincodeId);
      if (!alreadyCoveredByArea) {
        territory.pincodes.push({
          pincodeId: row.pincodeId,
          pincodeCode: row.pincodeCode,
        });
      }
    });

    return territoryMap;
  }

  private static async getOpenAssignments(
    userIds: string[]
  ): Promise<Map<string, FieldUserActiveAssignment[]>> {
    const uniqueUserIds = this.uniqueUserIds(userIds);
    const assignmentsMap = new Map<string, FieldUserActiveAssignment[]>();

    if (uniqueUserIds.length === 0) {
      return assignmentsMap;
    }

    uniqueUserIds.forEach(userId => {
      assignmentsMap.set(userId, []);
    });

    const result = await query<ActiveAssignmentRow>(
      `
        SELECT
          vt.assigned_to as user_id,
          vt.id as "task_id",
          vt.task_number as "task_number",
          vt.status,
          vt.priority,
          vt.started_at as started_at,
          vt.assigned_at as assigned_at,
          vt.current_assigned_at as "current_assigned_at",
          (SELECT code FROM pincodes WHERE id = vt.pincode_id) as pincode,
          c.id as case_id,
          c.case_id as case_number,
          c.customer_name as customer_name,
          c.customer_phone as customer_phone,
          c.status as "case_status"
        FROM verification_tasks vt
        JOIN cases c ON c.id = vt.case_id
        WHERE vt.assigned_to = ANY($1::uuid[])
          AND vt.status = ANY($2::text[])
        ORDER BY
          vt.assigned_to,
          COALESCE(
            vt.started_at::timestamptz,
            vt.current_assigned_at,
            vt.assigned_at::timestamptz,
            vt.updated_at::timestamptz,
            vt.created_at::timestamptz
          ) DESC,
          vt.id DESC
      `,
      [uniqueUserIds, [...ACTIVE_ASSIGNMENT_STATUSES]]
    );

    result.rows.forEach(row => {
      assignmentsMap.get(row.userId)?.push({
        task: {
          id: row.taskId,
          taskNumber: row.taskNumber,
          status: row.status,
          priority: row.priority,
          startedAt: this.toDate(row.startedAt),
          assignedAt: this.toDate(row.assignedAt),
          currentAssignedAt: this.toDate(row.currentAssignedAt),
          pincode: row.pincode,
        },
        case: {
          id: row.caseId,
          caseNumber: row.caseNumber,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          status: row.caseStatus,
        },
      });
    });

    return assignmentsMap;
  }

  private static emptyActivity(): FieldUserActivity {
    return {
      lastHeartbeatAt: null,
      lastTaskActivityAt: null,
      lastLocationAt: null,
      lastSubmissionAt: null,
    };
  }

  private static uniqueUserIds(userIds: string[]): string[] {
    return [...new Set(userIds.filter(Boolean))];
  }

  private static toDate(value: Date | string | null | undefined): NullableDate {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private static toNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static maxDate(values: Array<Date | string | null | undefined>): NullableDate {
    let max: NullableDate = null;

    values.forEach(value => {
      const current = this.toDate(value);
      if (!current) {
        return;
      }

      if (!max || current.getTime() > max.getTime()) {
        max = current;
      }
    });

    return max;
  }

  private static isFresh(value: NullableDate, thresholdMs: number): boolean {
    if (!value) {
      return false;
    }

    return Date.now() - value.getTime() <= thresholdMs;
  }

  private static deriveLiveStatus(
    activity: FieldUserActivity,
    location: FieldUserLatestLocation | null,
    assignments: FieldUserActiveAssignment[]
  ): FieldUserLiveStatus {
    // 2026-05-23: dropped the `lastHeartbeatAt`-first gate. No code path
    // writes to mobile_device_sync (the heartbeat source), so every user
    // was permanently 'Offline'. Live status now falls back to operational
    // activity freshness (tasks / locations / submissions). Admin-triggered
    // FCM ping (source='ADMIN_PING') still inserts into `locations`, which
    // refreshes lastLocationAt and lets the Submitted / At Location /
    // Travelling branches resolve.
    const latestOperationalActivity = this.maxDate([
      activity.lastTaskActivityAt,
      activity.lastLocationAt,
      activity.lastSubmissionAt,
    ]);

    if (!this.isFresh(latestOperationalActivity, OFFLINE_THRESHOLD_MS)) {
      return 'Offline';
    }

    if (this.isFresh(activity.lastSubmissionAt, SUBMITTED_THRESHOLD_MS)) {
      return 'Submitted';
    }

    if (
      location?.source === 'locations' &&
      this.isFresh(activity.lastLocationAt, AT_LOCATION_THRESHOLD_MS) &&
      assignments.length > 0
    ) {
      return 'At Location';
    }

    if (assignments.length > 0) {
      const hasOperationalAssignment = assignments.some(assignment =>
        Boolean(
          assignment.task.startedAt ||
            assignment.task.assignedAt ||
            assignment.task.currentAssignedAt ||
            ACTIVE_ASSIGNMENT_STATUSES.includes(
              assignment.task.status as (typeof ACTIVE_ASSIGNMENT_STATUSES)[number]
            )
        )
      );

      if (hasOperationalAssignment) {
        return 'Travelling';
      }
    }

    return 'Idle';
  }

  private static getStartOfToday(): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  private static getLatestOperationalActivity(activity: FieldUserActivity): NullableDate {
    return this.maxDate([
      activity.lastTaskActivityAt,
      activity.lastLocationAt,
      activity.lastSubmissionAt,
    ]);
  }

  private static getLatestOverallActivity(activity: FieldUserActivity): NullableDate {
    return this.maxDate([
      activity.lastHeartbeatAt,
      activity.lastTaskActivityAt,
      activity.lastLocationAt,
      activity.lastSubmissionAt,
    ]);
  }

  private static extractCoordinates(
    payload: unknown
  ): { lat: number; lng: number; accuracy: number | null } | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const candidate = payload as Record<string, unknown>;
    const lat = this.toNumber(
      typeof candidate.latitude !== 'undefined' ? candidate.latitude : candidate.lat
    );
    const lng = this.toNumber(
      typeof candidate.longitude !== 'undefined' ? candidate.longitude : candidate.lng
    );
    const accuracy = this.toNumber(candidate.accuracy);

    if (lat === null || lng === null) {
      return null;
    }

    return { lat, lng, accuracy };
  }
}
