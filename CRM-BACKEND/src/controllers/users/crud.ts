import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '@/config/database';
import { logger } from '@/config/logger';
import { config } from '@/config';
import { redact } from '@/utils/logRedact';
import { invalidateAuthContextCache, type AuthenticatedRequest } from '@/middleware/auth';
import { invalidateClientScopeCache } from '@/middleware/clientAccess';
import { invalidateProductScopeCache } from '@/middleware/productAccess';
import { deriveCapabilitiesFromPermissionCodes } from '@/security/rbacAccess';
import { createAuditLog } from '@/utils/auditLogger';
import { PRIMARY_RBAC_ROLE_NAME_SQL, buildUsersWhereClause } from './queryBuilder';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIMARY_RBAC_ROLE_ID_SQL = `
  (
    SELECT ur.role_id
    FROM user_roles ur
    JOIN roles_v2 rv ON rv.id = ur.role_id
    WHERE ur.user_id = u.id
    ORDER BY rv.name
    LIMIT 1
  )
`;
const USER_PERMISSION_CODES_SQL = `
  COALESCE((
    SELECT ARRAY_AGG(DISTINCT p.code ORDER BY p.code)
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = u.id
  ), ARRAY[]::text[])
`;
type DbExecutor = {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

type HierarchyRefUser = {
  id: string;
  teamLeaderId: string | null;
  managerId: string | null;
  permissionCodes: string[] | null;
};

const normalizeOptionalUuid = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return null;
  }
  const str = `${value}`.trim();
  if (!str) {
    return null;
  }
  return str;
};

const loadHierarchyRefUser = async (
  db: DbExecutor,
  userId: string
): Promise<HierarchyRefUser | undefined> => {
  const result = await db.query<HierarchyRefUser>(
    `
      SELECT
        u.id,
        u.team_leader_id as "team_leader_id",
        u.manager_id as "manager_id",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT p.code ORDER BY p.code)
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::varchar[]) as "permission_codes"
      FROM users u
      WHERE u.id = $1
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
};

const isHierarchyManagerReference = (user?: HierarchyRefUser): boolean => {
  if (!user) {
    return false;
  }
  const caps = deriveCapabilitiesFromPermissionCodes(user.permissionCodes || []);
  return Boolean(
    (caps.supervisoryOrGlobal || caps.systemScopeBypass) &&
      !caps.executionActor &&
      !user.teamLeaderId
  );
};

const isHierarchyTeamLeaderReference = (user?: HierarchyRefUser): boolean => {
  if (!user) {
    return false;
  }
  const caps = deriveCapabilitiesFromPermissionCodes(user.permissionCodes || []);
  return Boolean(
    (caps.supervisoryOrGlobal || caps.operationalScope) &&
      !caps.executionActor &&
      !!user.managerId &&
      !user.teamLeaderId
  );
};

type HierarchyValidationInput = {
  targetUserId?: string;
  targetRole: string;
  teamLeaderId?: string | null;
  managerId?: string | null;
};

type HierarchyValidationOutput = {
  teamLeaderId: string | null;
  managerId: string | null;
};

type HierarchyTargetMode = 'TOP_LEVEL' | 'MANAGER_PARENT_ONLY' | 'OPERATIONAL_CHILD';

const loadRolePermissionCodes = async (db: DbExecutor, roleName: string): Promise<string[]> => {
  const result = await db.query<{ permissionCodes: string[] | null }>(
    `
      SELECT COALESCE(
        ARRAY_AGG(DISTINCT p.code ORDER BY p.code) FILTER (WHERE p.code IS NOT NULL),
        ARRAY[]::varchar[]
      ) as "permission_codes"
      FROM roles_v2 rv
      LEFT JOIN role_permissions rp ON rp.role_id = rv.id AND rp.allowed = true
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE UPPER(rv.name) = UPPER($1)
      GROUP BY rv.id
      LIMIT 1
    `,
    [roleName]
  );

  return result.rows[0]?.permissionCodes || [];
};

const classifyHierarchyTargetMode = (
  permissionCodes: string[],
  refs: Pick<HierarchyValidationInput, 'teamLeaderId' | 'managerId'>
): HierarchyTargetMode => {
  const caps = deriveCapabilitiesFromPermissionCodes(permissionCodes);
  const hasTeamLeaderRef = Boolean(refs.teamLeaderId);
  const hasManagerRef = Boolean(refs.managerId);

  if (hasTeamLeaderRef && hasManagerRef) {
    return 'OPERATIONAL_CHILD';
  }

  if (!hasTeamLeaderRef && hasManagerRef && !caps.executionActor) {
    return 'MANAGER_PARENT_ONLY';
  }

  if (caps.systemScopeBypass) {
    return 'TOP_LEVEL';
  }

  if (caps.executionActor || (caps.operationalScope && !caps.supervisoryOrGlobal)) {
    return 'OPERATIONAL_CHILD';
  }

  return 'TOP_LEVEL';
};

const validateHierarchyAssignments = async (
  db: DbExecutor,
  input: HierarchyValidationInput
): Promise<HierarchyValidationOutput> => {
  const teamLeaderId = input.teamLeaderId ?? null;
  const managerId = input.managerId ?? null;
  const targetRolePermissionCodes = await loadRolePermissionCodes(db, input.targetRole);
  const targetMode = classifyHierarchyTargetMode(targetRolePermissionCodes, {
    teamLeaderId,
    managerId,
  });

  if (input.targetUserId && teamLeaderId === input.targetUserId) {
    throw new Error('User cannot report to self as team leader');
  }
  if (input.targetUserId && managerId === input.targetUserId) {
    throw new Error('User cannot report to self as manager');
  }

  if (targetMode === 'TOP_LEVEL') {
    return { teamLeaderId: null, managerId: null };
  }

  if (targetMode === 'MANAGER_PARENT_ONLY') {
    if (!managerId) {
      throw new Error('Manager is required for this hierarchy configuration');
    }
    const managerUser = await loadHierarchyRefUser(db, managerId);
    if (!managerUser) {
      throw new Error('Selected Manager user not found');
    }
    if (!isHierarchyManagerReference(managerUser)) {
      throw new Error('Selected Manager must be a valid supervisory user');
    }
    return { teamLeaderId: null, managerId };
  }

  if (targetMode === 'OPERATIONAL_CHILD') {
    if (!teamLeaderId) {
      throw new Error('Team Leader is required for operational users');
    }
    if (!managerId) {
      throw new Error('Manager is required for operational users');
    }

    const [teamLeaderUser, managerUser] = await Promise.all([
      loadHierarchyRefUser(db, teamLeaderId),
      loadHierarchyRefUser(db, managerId),
    ]);

    if (!teamLeaderUser) {
      throw new Error('Selected Team Leader user not found');
    }
    if (!managerUser) {
      throw new Error('Selected Manager user not found');
    }

    if (!isHierarchyTeamLeaderReference(teamLeaderUser)) {
      throw new Error('Selected Team Leader must be a valid team supervisor');
    }
    if (!isHierarchyManagerReference(managerUser)) {
      throw new Error('Selected Manager must be a valid supervisory user');
    }
    if (teamLeaderUser.managerId !== managerId) {
      throw new Error('Selected Team Leader does not belong to the selected Manager');
    }

    return { teamLeaderId, managerId };
  }

  return { teamLeaderId: null, managerId: null };
};

// USER_EXPORT_ROW_LIMIT + ACTIVITY_SORT_MAP + SESSION_SORT_MAP moved to ./users/queryBuilder.

// Shared WHERE-clause builder. SINGLE source of WHERE-truth for getUsers
// + exportUsers + getUserStats (when scoped). Assumes the calling query
// JOINs `departments d ON u.department_id = d.id` (so the `d.name`
// predicate resolves). Always excludes soft-deleted users.
// Users list/export WHERE-builder lives in ./users/queryBuilder (imported at top).

// GET /api/users - List users with pagination and filters
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Number(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || 1);
    const limit = Number(
      Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit || 20
    );
    const sortBy = (
      Array.isArray(req.query.sortBy) ? req.query.sortBy[0] : req.query.sortBy || 'name'
    ) as string;
    const sortOrder = (
      Array.isArray(req.query.sortOrder) ? req.query.sortOrder[0] : req.query.sortOrder || 'asc'
    ) as string;

    const {
      whereClause,
      queryParams: params,
      nextParamIndex: paramIndex,
    } = buildUsersWhereClause(req);

    // Validate sortBy to prevent SQL injection
    const validSortColumns = ['name', 'username', 'email', 'role', 'createdAt', 'updatedAt'];
    const safeSortBy: string = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const sortColumnMap: Record<string, string> = {
      name: 'u.name',
      username: 'u.username',
      email: 'u.email',
      role: 'role_name',
      createdAt: 'u.created_at',
      updatedAt: 'u.updated_at',
    };
    const safeSortColumn = sortColumnMap[safeSortBy] || 'u.name';
    const safeSortOrder: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results with assignment counts AND arrays
    const offset = (Number(page) - 1) * Number(limit);
    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u.phone,
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role,
        ${PRIMARY_RBAC_ROLE_ID_SQL} as "roleId",
        u.department_id,
        u.designation_id,
        u.employee_id,
        des.name as designation,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        COALESCE((
          SELECT ARRAY_AGG(rv.name ORDER BY rv.name)
          FROM user_roles ur
          JOIN roles_v2 rv ON rv.id = ur.role_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::text[]) as roles,
        ${USER_PERMISSION_CODES_SQL} as "permissionCodes",
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role_name,
        d.name as department,
        d.name as "departmentName",
        des.name as "designationName",
        u.team_leader_id as "teamLeaderId",
        tl.name as "teamLeaderName",
        u.manager_id as "managerId",
        mgr.name as "managerName",

        -- Assignment counts for BACKEND_USER role
        COALESCE(client_counts.count, 0) as "assignedClientsCount",
        COALESCE(product_counts.count, 0) as "assignedProductsCount",

        -- Assignment counts for FIELD_AGENT role
        COALESCE(pincode_counts.count, 0) as "assignedPincodesCount",
        COALESCE(area_counts.count, 0) as "assignedAreasCount",

        -- Assignment arrays for BACKEND_USER role
        COALESCE(client_arrays.ids, ARRAY[]::int[]) as "assignedClients",
        COALESCE(product_arrays.ids, ARRAY[]::int[]) as "assignedProducts",

        -- Assignment arrays for FIELD_AGENT role
        COALESCE(pincode_arrays.ids, ARRAY[]::int[]) as "assignedPincodes",
        COALESCE(area_arrays.ids, ARRAY[]::int[]) as assigned_areas
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN designations des ON u.designation_id = des.id
      LEFT JOIN users tl ON tl.id = u.team_leader_id
      LEFT JOIN users mgr ON mgr.id = u.manager_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM user_client_assignments
        GROUP BY user_id
      ) client_counts ON u.id = client_counts.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM user_product_assignments
        GROUP BY user_id
      ) product_counts ON u.id = product_counts.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM user_pincode_assignments
        WHERE is_active = true
        GROUP BY user_id
      ) pincode_counts ON u.id = pincode_counts.user_id
      LEFT JOIN (
        SELECT uaa.user_id, COUNT(*) as count
        FROM user_area_assignments uaa
        INNER JOIN user_pincode_assignments upa 
          ON uaa.user_pincode_assignment_id = upa.id
        WHERE uaa.is_active = true AND upa.is_active = true
        GROUP BY uaa.user_id
      ) area_counts ON u.id = area_counts.user_id
      LEFT JOIN (
        SELECT user_id, ARRAY_AGG(client_id) as ids
        FROM user_client_assignments
        GROUP BY user_id
      ) client_arrays ON u.id = client_arrays.user_id
      LEFT JOIN (
        SELECT user_id, ARRAY_AGG(product_id) as ids
        FROM user_product_assignments
        GROUP BY user_id
      ) product_arrays ON u.id = product_arrays.user_id
      LEFT JOIN (
        SELECT user_id, ARRAY_AGG(pincode_id) as ids
        FROM user_pincode_assignments
        WHERE is_active = true
        GROUP BY user_id
      ) pincode_arrays ON u.id = pincode_arrays.user_id
      LEFT JOIN (
        SELECT uaa.user_id, ARRAY_AGG(uaa.area_id) as ids
        FROM user_area_assignments uaa
        INNER JOIN user_pincode_assignments upa 
          ON uaa.user_pincode_assignment_id = upa.id
        WHERE uaa.is_active = true AND upa.is_active = true
        GROUP BY uaa.user_id
      ) area_arrays ON u.id = area_arrays.user_id
      ${whereClause}
      ORDER BY ${safeSortColumn} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const usersResult = await query(usersQuery, [...params, Number(limit), offset]);

    logger.info(`Retrieved ${usersResult.rows.length} users`, {
      userId: req.user?.id,
      query: req.query,
      pagination: { page, limit },
    });

    // Calculate statistics (total, active, inactive)
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE u.is_active = true) as active,
        COUNT(*) FILTER (WHERE u.is_active = false) as inactive
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ${whereClause}
    `;
    const statsResult = await query(statsQuery, params);
    const stats = statsResult.rows[0];

    const responseData = {
      success: true,
      data: usersResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
      statistics: {
        total: parseInt(stats.total || '0'),
        active: parseInt(stats.active || '0'),
        inactive: parseInt(stats.inactive || '0'),
      },
    };

    res.json(responseData);
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/:id - Get user by ID
export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    const userQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u.phone,
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role,
        ${PRIMARY_RBAC_ROLE_ID_SQL} as "roleId",
        u.department_id,
        u.designation_id,
        u.employee_id,
        des.name as designation,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        COALESCE((
          SELECT ARRAY_AGG(rv.name ORDER BY rv.name)
          FROM user_roles ur
          JOIN roles_v2 rv ON rv.id = ur.role_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::text[]) as roles,
        ${USER_PERMISSION_CODES_SQL} as "permissionCodes",
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role_name,
        (
          SELECT rv.description
          FROM user_roles ur
          JOIN roles_v2 rv ON rv.id = ur.role_id
          WHERE ur.user_id = u.id
          ORDER BY rv.name
          LIMIT 1
        ) as "roleDescription",
        ${USER_PERMISSION_CODES_SQL} as "rolePermissions",
        d.name as department,
        d.name as "departmentName",
        d.description as "departmentDescription",
        des.name as "designationName",
        u.team_leader_id as "teamLeaderId",
        tl.name as "teamLeaderName",
        u.manager_id as "managerId",
        mgr.name as "managerName",

        -- Assignment counts for BACKEND_USER role
        COALESCE(client_counts.count, 0) as "assignedClientsCount",
        COALESCE(product_counts.count, 0) as "assignedProductsCount",

        -- Assignment counts for FIELD_AGENT role
        COALESCE(pincode_counts.count, 0) as "assignedPincodesCount",
        COALESCE(area_counts.count, 0) as "assignedAreasCount",

        -- Assignment arrays for BACKEND_USER role
        COALESCE(client_arrays.ids, ARRAY[]::int[]) as "assignedClients",
        COALESCE(product_arrays.ids, ARRAY[]::int[]) as "assignedProducts",

        -- Assignment arrays for FIELD_AGENT role
        COALESCE(pincode_arrays.ids, ARRAY[]::int[]) as "assignedPincodes",
        COALESCE(area_arrays.ids, ARRAY[]::int[]) as assigned_areas
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN designations des ON u.designation_id = des.id
      LEFT JOIN users tl ON tl.id = u.team_leader_id
      LEFT JOIN users mgr ON mgr.id = u.manager_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM user_client_assignments
        WHERE user_id = $1
        GROUP BY user_id
      ) client_counts ON u.id = client_counts.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM user_product_assignments
        WHERE user_id = $1
        GROUP BY user_id
      ) product_counts ON u.id = product_counts.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM user_pincode_assignments
        WHERE user_id = $1 AND is_active = true
        GROUP BY user_id
      ) pincode_counts ON u.id = pincode_counts.user_id
      LEFT JOIN (
        SELECT uaa.user_id, COUNT(*) as count
        FROM user_area_assignments uaa
        INNER JOIN user_pincode_assignments upa 
          ON uaa.user_pincode_assignment_id = upa.id
        WHERE uaa.user_id = $1 AND uaa.is_active = true AND upa.is_active = true
        GROUP BY uaa.user_id
      ) area_counts ON u.id = area_counts.user_id
      LEFT JOIN (
        SELECT user_id, ARRAY_AGG(client_id) as ids
        FROM user_client_assignments
        WHERE user_id = $1
        GROUP BY user_id
      ) client_arrays ON u.id = client_arrays.user_id
      LEFT JOIN (
        SELECT user_id, ARRAY_AGG(product_id) as ids
        FROM user_product_assignments
        WHERE user_id = $1
        GROUP BY user_id
      ) product_arrays ON u.id = product_arrays.user_id
      LEFT JOIN (
        SELECT user_id, ARRAY_AGG(pincode_id) as ids
        FROM user_pincode_assignments
        WHERE user_id = $1 AND is_active = true
        GROUP BY user_id
      ) pincode_arrays ON u.id = pincode_arrays.user_id
      LEFT JOIN (
        SELECT uaa.user_id, ARRAY_AGG(uaa.area_id) as ids
        FROM user_area_assignments uaa
        INNER JOIN user_pincode_assignments upa 
          ON uaa.user_pincode_assignment_id = upa.id
        WHERE uaa.user_id = $1 AND uaa.is_active = true AND upa.is_active = true
        GROUP BY uaa.user_id
      ) area_arrays ON u.id = area_arrays.user_id
      WHERE u.id = $1
    `;

    const result = await query(userQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users - Create new user
export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('Creating user', { body: redact(req.body), userId: req.user?.id });

    const {
      name,
      username,
      email,
      password,
      roleId,
      departmentId,
      designationId,
      employeeId,
      phone,
      teamLeaderId,
      managerId,
      isActive = true,
      // Legacy fields for backward compatibility
      role,
      // 2026-04-28 F1.1.2: legacy `designation` text input ignored.
      // Designation is set via FK only (designationId → designations).
      designation: _designation,
      // 2026-04-28 F1.1.3: legacy `department` text input ignored.
      // Department is set via FK only (departmentId → departments).
      department: _department,
    } = req.body;

    // Convert empty strings to null for UUID fields and handle numeric IDs
    const cleanRoleId =
      roleId && (typeof roleId === 'string' ? roleId.trim() !== '' : true) ? roleId : null;
    const cleanDepartmentId =
      departmentId && (typeof departmentId === 'string' ? departmentId.trim() !== '' : true)
        ? departmentId
        : null;
    const cleanDesignationId =
      designationId && (typeof designationId === 'string' ? designationId.trim() !== '' : true)
        ? designationId
        : null;
    const cleanTeamLeaderId = normalizeOptionalUuid(teamLeaderId) ?? null;
    const cleanManagerId = normalizeOptionalUuid(managerId) ?? null;

    // Validate required fields
    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, username, email, and password are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    if (!cleanRoleId && !role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Device management is handled through the devices table, not user creation
    // Field agents will register devices separately after user creation

    // Check if username or email already exists
    const existingUserQuery = `
      SELECT id FROM users 
      WHERE username = $1 OR email = $2
    `;
    const existingUser = await query(existingUserQuery, [username, email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists',
        error: { code: 'DUPLICATE_USER' },
      });
    }

    // Hash password
    // M2: use config.bcryptRounds (12) instead of the literal 10 that was
    // used here historically — newly created users were getting weaker
    // hashes than existing users whose passwords were reset.
    const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

    // Determine role using RBAC role UUID or canonical role name
    let finalRole: string | null = null;
    let rbacRoleId: string | null = null;

    if (cleanRoleId && typeof cleanRoleId === 'string' && UUID_REGEX.test(cleanRoleId)) {
      const roleResult = await query<{ name: string }>('SELECT name FROM roles_v2 WHERE id = $1', [
        cleanRoleId,
      ]);
      if (roleResult.rows.length > 0) {
        finalRole = roleResult.rows[0].name;
        rbacRoleId = cleanRoleId;
      }
    } else if (role) {
      finalRole = role;
    }

    if (finalRole && !rbacRoleId) {
      const rbacRoleResult = await query<{ id: string }>(
        'SELECT id FROM roles_v2 WHERE name = $1 LIMIT 1',
        [finalRole]
      );
      if (rbacRoleResult.rows.length > 0) {
        rbacRoleId = rbacRoleResult.rows[0].id;
      }
    }

    // Ensure we have a valid role
    if (!finalRole) {
      return res.status(400).json({
        success: false,
        message: 'Role is required and must be valid. Please provide either roleId or role.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Debug logging
    logger.info(
      `User creation debug: roleId=${cleanRoleId}, role=${role}, finalRole=${finalRole}`,
      {
        userId: req.user?.id,
        roleId: cleanRoleId,
        role,
        finalRole,
      }
    );

    const result = await withTransaction(async client => {
      let hierarchyAssignments: HierarchyValidationOutput;
      try {
        hierarchyAssignments = await validateHierarchyAssignments(client as unknown as DbExecutor, {
          targetRole: finalRole,
          teamLeaderId: cleanTeamLeaderId,
          managerId: cleanManagerId,
        });
      } catch (hierarchyError) {
        const err = hierarchyError as Error;
        (err as Error & { code?: string }).code = 'HIERARCHY_VALIDATION_ERROR';
        throw err;
      }

      // 2026-04-28 F1.1.1: dropped `role` from INSERT and RETURNING.
      // Role assignment lives in `user_roles` (the INSERT INTO user_roles
      // below handles it). Response shape preserved by deriving `role`
      // from the freshly-inserted user_roles row inside the RETURNING
      // sub-select pattern.
      // 2026-04-28 F1.1.2: dropped `designation` text column from INSERT
      // and RETURNING. Designation lives at `designations` table via the
      // `designation_id` FK. RETURNING joins to derive `designation` for
      // API contract preservation.
      const createUserQuery = `
        WITH inserted AS (
          INSERT INTO users (
            name, username, email, password_hash, department_id, designation_id,
            employee_id, phone, team_leader_id, manager_id, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        )
        SELECT i.id, i.name, i.username, i.email, i.department_id, i.designation_id,
               i.employee_id, des.name AS designation, dept.name AS department,
               i.phone,
               i.team_leader_id as "team_leader_id",
               i.manager_id as "manager_id", i.is_active, i.created_at, i.updated_at
        FROM inserted i
        LEFT JOIN designations des ON des.id = i.designation_id
        LEFT JOIN departments dept ON dept.id = i.department_id
      `;

      const insertRes = await client.query(createUserQuery, [
        name,
        username,
        email,
        hashedPassword,
        cleanDepartmentId,
        cleanDesignationId,
        employeeId || null,
        phone || null,
        hierarchyAssignments.teamLeaderId,
        hierarchyAssignments.managerId,
        isActive,
        new Date(),
        new Date(),
      ]);

      const createdUser = insertRes.rows[0];

      if (rbacRoleId) {
        await client.query('DELETE FROM user_roles WHERE user_id = $1', [createdUser.id]);
        // 2026-04-28 F1.5.1: record assigned_by for audit trail.
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [createdUser.id, rbacRoleId, req.user?.id ?? null]
        );
      }

      return insertRes;
    });

    // 2026-04-28 F1.1.1: re-attach `role` to response (derived from the
    // user_roles row that was just inserted). Preserves the API
    // contract — frontend + mobile read response.role unchanged.
    const newUser = {
      ...result.rows[0],
      role: finalRole,
      roleId: rbacRoleId,
    };

    logger.info(`Created new user: ${newUser.id}`, {
      userId: req.user?.id,
      newUserEmail: email,
      newUserRole: role,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: newUser.id,
      details: { name, username, email, role: finalRole },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: 'User created successfully',
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'HIERARCHY_VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
        error: { code: 'VALIDATION_ERROR' },
      });
    }
    // 2026-04-28 F1.1.4: surface PG unique-violation (23505) as 400 with
    // a meaningful message. Race conditions between the pre-INSERT check
    // and the INSERT itself land here. Constraint name encodes the
    // conflicting column.
    if ((error as { code?: string }).code === '23505') {
      const constraint = (error as { constraint?: string }).constraint || '';
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists',
        error: { code: 'DUPLICATE_USER', constraint },
      });
    }
    logger.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/users/:id - Update user
export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const updateData = req.body;

    // Check if user exists.
    // 2026-04-28 F1.1.1: derive `role` from RBAC (user_roles → roles_v2)
    // because the `users.role` text column was dropped. Mirrors
    // PRIMARY_RBAC_ROLE_NAME_SQL — kept inline here to avoid
    // restructuring the function around the helper (single-use).
    const userExistsQuery = `
      SELECT
        u.id,
        COALESCE(
          (SELECT rv.name FROM user_roles ur
           JOIN roles_v2 rv ON rv.id = ur.role_id
           WHERE ur.user_id = u.id
           ORDER BY rv.name LIMIT 1),
          NULL
        ) AS role,
        u.team_leader_id AS "team_leader_id",
        u.manager_id AS "manager_id"
      FROM users u
      WHERE u.id = $1
    `;
    const userExists = await query(userExistsQuery, [id]);

    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    const existingUser = userExists.rows[0] as {
      id: string;
      role: string | null;
      teamLeaderId: string | null;
      managerId: string | null;
    };

    // Check for duplicate username/email if being updated
    if (updateData.username || updateData.email) {
      const duplicateQuery = `
        SELECT id FROM users
        WHERE id != $1 AND (username = $2 OR email = $3)
      `;
      const duplicate = await query(duplicateQuery, [id, updateData.username, updateData.email]);

      if (duplicate.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already exists',
          error: { code: 'DUPLICATE_USER' },
        });
      }
    }

    // Device management is handled separately through device management endpoints

    // RBAC role resolution (UUID roles_v2 only)
    let rbacRoleId: string | null = null;
    if (
      updateData.roleId &&
      typeof updateData.roleId === 'string' &&
      UUID_REGEX.test(updateData.roleId)
    ) {
      const rbacRoleRes = await query<{ name: string }>('SELECT name FROM roles_v2 WHERE id = $1', [
        updateData.roleId,
      ]);
      if (rbacRoleRes.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid RBAC role ID',
          error: { code: 'VALIDATION_ERROR' },
        });
      }
      updateData.role = rbacRoleRes.rows[0].name;
      rbacRoleId = updateData.roleId;
    }

    if (!rbacRoleId && updateData.role && typeof updateData.role === 'string') {
      const rbacRoleRes = await query<{ id: string }>(
        'SELECT id FROM roles_v2 WHERE name = $1 LIMIT 1',
        [updateData.role]
      );
      rbacRoleId = rbacRoleRes.rows[0]?.id || null;
    }

    const cleanTeamLeaderId = normalizeOptionalUuid(updateData.teamLeaderId);
    const cleanManagerId = normalizeOptionalUuid(updateData.managerId);
    if (cleanTeamLeaderId !== undefined) {
      updateData.teamLeaderId = cleanTeamLeaderId;
    }
    if (cleanManagerId !== undefined) {
      updateData.managerId = cleanManagerId;
    }

    const effectiveRole =
      typeof updateData.role === 'string' && updateData.role.trim()
        ? updateData.role
        : existingUser.role || '';

    let hierarchyAssignments: HierarchyValidationOutput;
    try {
      hierarchyAssignments = await validateHierarchyAssignments({ query } as DbExecutor, {
        targetUserId: id,
        targetRole: effectiveRole,
        teamLeaderId:
          updateData.teamLeaderId !== undefined
            ? (updateData.teamLeaderId as string | null)
            : existingUser.teamLeaderId,
        managerId:
          updateData.managerId !== undefined
            ? (updateData.managerId as string | null)
            : existingUser.managerId,
      });
    } catch (hierarchyError) {
      const err = hierarchyError as Error;
      (err as Error & { code?: string }).code = 'HIERARCHY_VALIDATION_ERROR';
      throw err;
    }

    updateData.teamLeaderId = hierarchyAssignments.teamLeaderId;
    updateData.managerId = hierarchyAssignments.managerId;

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateParams: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    // 2026-04-28 F1.1.1: dropped 'role' from allowedFields. The
    // `users.role` text column no longer exists; role updates are
    // applied via the `INSERT INTO user_roles` block below
    // (gated on `rbacRoleId` resolved earlier in this function).
    // 2026-04-28 F1.1.2: dropped 'designation' (text). Use `designationId`
    // FK only.
    const allowedFields = [
      'name',
      'username',
      'email',
      'phone',
      'departmentId',
      'designationId',
      'employeeId',
      'teamLeaderId',
      'managerId',
      'isActive',
    ];

    const fieldColumnMap: Record<string, string> = {
      employeeId: 'employee_id',
      departmentId: 'department_id',
      designationId: 'designation_id',
      teamLeaderId: 'team_leader_id',
      managerId: 'manager_id',
      isActive: 'is_active',
    };

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        const column = fieldColumnMap[field] || field;
        updateFields.push(`${column} = $${paramIndex++}`);
        updateParams.push(updateData[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateParams.push(id);

    // 2026-04-28 F1.1.1: dropped `role` from RETURNING (column gone).
    // Role is re-derived after the transaction below to preserve API
    // response shape.
    // 2026-04-28 F1.1.2: dropped `designation` text from RETURNING.
    // Designation is re-derived from FK after the transaction.
    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, username, email, department_id, designation_id,
                employee_id, phone, team_leader_id as "teamLeaderId",
                manager_id as "managerId", is_active, created_at, updated_at
    `;

    const result = await withTransaction(async client => {
      const updateRes = await client.query(updateQuery, updateParams);
      if (rbacRoleId) {
        await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
        // 2026-04-28 F1.5.1: record assigned_by for audit trail.
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [id, rbacRoleId, req.user?.id ?? null]
        );
      }
      return updateRes;
    });

    // 2026-04-28 F1.1.1: re-derive `role` after the transaction so the
    // response shape includes role (frontend + mobile depend on it).
    // If the caller passed a new role, use that; otherwise look up
    // the current user_roles row.
    // 2026-04-28 F1.1.2: also derive `designation` from FK so the
    // response shape includes the human-readable name.
    let resolvedRoleName: string | null = null;
    if (typeof updateData.role === 'string' && updateData.role.trim()) {
      resolvedRoleName = updateData.role;
    } else {
      const roleLookup = await query<{ role: string | null }>(
        `SELECT (
           SELECT rv.name FROM user_roles ur
           JOIN roles_v2 rv ON rv.id = ur.role_id
           WHERE ur.user_id = $1
           ORDER BY rv.name LIMIT 1
         ) AS role`,
        [id]
      );
      resolvedRoleName = roleLookup.rows[0]?.role ?? null;
    }

    // 2026-04-28 F1.1.2 + F1.1.3: derive both `designation` and `department`
    // from FK joins so the response shape includes human-readable names
    // (text columns dropped from users table).
    const namesLookup = await query<{
      designation: string | null;
      department: string | null;
    }>(
      `SELECT des.name AS designation, dept.name AS department FROM users u
       LEFT JOIN designations des ON des.id = u.designation_id
       LEFT JOIN departments dept ON dept.id = u.department_id
       WHERE u.id = $1`,
      [id]
    );
    const resolvedDesignation = namesLookup.rows[0]?.designation ?? null;
    const resolvedDepartment = namesLookup.rows[0]?.department ?? null;

    const updatedUser = {
      ...result.rows[0],
      role: resolvedRoleName,
      designation: resolvedDesignation,
      department: resolvedDepartment,
      ...(rbacRoleId ? { roleId: rbacRoleId } : {}),
    };

    logger.info(`Updated user: ${id}`, {
      userId: req.user?.id,
      updatedFields: Object.keys(updateData),
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: id,
      details: { updatedFields: Object.keys(updateData) },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Wipe per-user auth + scope caches so role/permission changes take
    // effect immediately (instead of waiting for the 5s TTL to expire).
    invalidateAuthContextCache(id);
    invalidateClientScopeCache(id);
    invalidateProductScopeCache(id);

    res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'HIERARCHY_VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
        error: { code: 'VALIDATION_ERROR' },
      });
    }
    // 2026-04-28 F1.1.4: surface PG unique-violation (23505) as 400 when
    // an updateUser changes username/email to a value that collides with
    // another user.
    if ((error as { code?: string }).code === '23505') {
      const constraint = (error as { constraint?: string }).constraint || '';
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists',
        error: { code: 'DUPLICATE_USER', constraint },
      });
    }
    logger.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/users/:id - Delete user
export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    // Check if user exists
    const userExistsQuery = `SELECT id, username FROM users WHERE id = $1`;
    const userExists = await query(userExistsQuery, [id]);

    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Prevent deletion of admin user
    if (userExists.rows[0].username === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin user',
        error: { code: 'FORBIDDEN_OPERATION' },
      });
    }

    // SAFE DELETE IMPLEMENTATION (Soft Delete)
    // We do NOT hard delete because that would delete related data (Cascade) or fail (Restrict).
    // Instead, we mark as deleted and scramble credentials to allow reuse of email/username.

    // 1. Get current user data for logging
    const targetUser = userExists.rows[0];

    // 2. Perform Soft Delete
    // Rename username/email to free them up for future use
    const timestamp = Math.floor(Date.now() / 1000);
    const softDeleteQuery = `
      UPDATE users 
      SET 
        deleted_at = NOW(), 
        is_active = false,
        "username" = $2 || '_deleted_' || $3,
        "email" = $4 || '_deleted_' || $3
      WHERE id = $1
    `;

    await query(softDeleteQuery, [id, targetUser.username, timestamp, targetUser.email]);

    logger.info(`Soft deleted user: ${id}`, {
      userId: req.user?.id,
      deletedUsername: targetUser.username,
      originalEmail: targetUser.email,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: id,
      details: { deletedUsername: targetUser.username, softDelete: true },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Wipe per-user auth + scope caches so soft-deleted user is locked out
    // immediately (token validation will reject the now-inactive account).
    invalidateAuthContextCache(id);
    invalidateClientScopeCache(id);
    invalidateProductScopeCache(id);

    res.json({
      success: true,
      message: 'User deleted safely (Data preserved, User deactivated)',
    });
  } catch (error: unknown) {
    logger.error('Error deleting user:', error);

    // Check if it's a foreign key constraint error
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
      // Extract table name from error detail if available
      const errorDetail = 'detail' in error && typeof error.detail === 'string' ? error.detail : '';
      const tableMatch = errorDetail.match(/table "([^"]+)"/);
      const tableName = tableMatch ? tableMatch[1] : 'unknown table';

      return res.status(400).json({
        success: false,
        message: 'Cannot delete user: user has related records in the system',
        error: {
          code: 'FOREIGN_KEY_CONSTRAINT',
          details: `User is referenced by records in ${tableName}. Please remove or reassign these records before deleting the user.`,
          technicalDetail:
            'detail' in error && typeof error.detail === 'string'
              ? error.detail
              : 'User is referenced by other records',
        },
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: {
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
    });
  }
};

// POST /api/users/:id/activate - Activate user
export const activateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    const updateQuery = `
      UPDATE users
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, username, is_active
    `;

    const result = await query(updateQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Activated user: ${id}`, { userId: req.user?.id });

    await createAuditLog({
      userId: req.user?.id,
      action: 'ACTIVATE_USER',
      entityType: 'USER',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'User activated successfully',
    });
  } catch (error) {
    logger.error('Error activating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:id/deactivate - Deactivate user
export const deactivateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    const updateQuery = `
      UPDATE users
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, username, is_active
    `;

    const result = await query(updateQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Deactivated user: ${id}`, { userId: req.user?.id });

    await createAuditLog({
      userId: req.user?.id,
      action: 'DEACTIVATE_USER',
      entityType: 'USER',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'User deactivated successfully',
    });
  } catch (error) {
    logger.error('Error deactivating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/search - Search users
export const searchUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
        error: { code: 'MISSING_QUERY' },
      });
    }

    const searchQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role,
        d.name as "departmentName",
        des.name as designation,
        u.is_active
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN designations des ON des.id = u.designation_id
      WHERE
        u.name ILIKE $1 OR
        u.email ILIKE $1 OR
        u.username ILIKE $1 OR
        d.name ILIKE $1 OR
        des.name ILIKE $1
      ORDER BY u.name
      LIMIT 200
    `;

    const result = await query(searchQuery, typeof q === 'string' ? [`%${q}%`] : ['%%']);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/stats - Get user statistics
export const getUserStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const getCountValue = (row: Record<string, unknown> | undefined, key: string): number => {
      if (!row) {
        return 0;
      }
      const lowerKey = key.toLowerCase();
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      const raw = row[key] ?? row[lowerKey] ?? row[snakeKey];
      const value = Number(raw ?? 0);
      return Number.isFinite(value) ? value : 0;
    };

    // Get basic user counts. Canonical 5-card aggregate (total / active /
    // inactive / recentlyAddedCount / mfaEnabledCount) plus legacy fields
    // (newUsersThisMonth, usersByRole, usersByDepartment, recentLogins)
    // kept for back-compat with /profile + admin dashboard consumers.
    const userCountsQuery = `
      SELECT
        COUNT(*) as "total_users",
        COUNT(*) FILTER (WHERE is_active = true) as "active_users",
        COUNT(*) FILTER (WHERE is_active = false) as "inactive_users",
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as "new_users_this_month",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as "recently_added_count",
        COUNT(*) FILTER (
          WHERE EXISTS (SELECT 1 FROM user_mfa_secrets ums WHERE ums.user_id = users.id)
        ) as "mfa_enabled_count"
      FROM users
      WHERE deleted_at IS NULL
    `;
    const userCounts = await query(userCountsQuery);

    // Get users by role
    const roleStatsQuery = `
      SELECT
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role,
        COUNT(*) as count
      FROM users u
      WHERE u.deleted_at IS NULL
      GROUP BY ${PRIMARY_RBAC_ROLE_NAME_SQL}
      ORDER BY count DESC
    `;
    const roleStats = await query(roleStatsQuery);

    // Get users by department
    const departmentStatsQuery = `
      SELECT
        COALESCE(d.name, 'No Department') as department,
        COUNT(*) as count
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.deleted_at IS NULL
      GROUP BY d.name
      ORDER BY count DESC
    `;
    const departmentStats = await query(departmentStatsQuery);

    // Get recent logins (last 24 hours)
    // Since we don't have a login tracking table yet, we'll use lastLogin field
    const recentLoginsQuery = `
      SELECT
        id as user_id,
        name as user_name,
        last_login as "last_login_at"
      FROM users
      WHERE last_login >= NOW() - INTERVAL '24 hours'
        AND deleted_at IS NULL
      ORDER BY last_login DESC
      LIMIT 10
    `;
    const recentLoginsResult = await query(recentLoginsQuery);

    const statsRow = (userCounts.rows[0] || {}) as Record<string, unknown>;

    const totalUsers = getCountValue(statsRow, 'totalUsers');
    const activeUsers = getCountValue(statsRow, 'activeUsers');
    const inactiveUsers = getCountValue(statsRow, 'inactiveUsers');

    res.json({
      success: true,
      data: {
        // Canonical 5-card shape (§9.1).
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        recentlyAddedCount: getCountValue(statsRow, 'recentlyAddedCount'),
        mfaEnabledCount: getCountValue(statsRow, 'mfaEnabledCount'),
        // Legacy fields — kept for /profile + admin dashboard consumers.
        totalUsers,
        activeUsers,
        inactiveUsers,
        newUsersThisMonth: getCountValue(statsRow, 'newUsersThisMonth'),
        usersByRole: roleStats.rows,
        usersByDepartment: departmentStats.rows,
        recentLogins: recentLoginsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
