import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '@/config/database';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { EmailDeliveryService } from '@/services/EmailDeliveryService';
import ExcelJS from 'exceljs';
import { CANONICAL_RBAC_ROLE_NAMES } from '@/constants/rbacRoles';
import {
  deriveCapabilitiesFromPermissionCodes,
  hasSystemScopeBypass,
  userHasAnyPermission,
  userHasPermission,
} from '@/security/rbacAccess';
import { getScopedOperationalUserIds } from '@/security/userScope';
import { createAuditLog } from '@/utils/auditLogger';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const isStrongPassword = (password: string): boolean => STRONG_PASSWORD_REGEX.test(password);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIMARY_RBAC_ROLE_NAME_SQL = `
  COALESCE(
    (SELECT rv.name FROM user_roles ur JOIN roles_v2 rv ON rv.id = ur.role_id WHERE ur.user_id = u.id ORDER BY rv.name LIMIT 1),
    'UNASSIGNED'
  )
`;
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
        u.team_leader_id as "teamLeaderId",
        u.manager_id as "managerId",
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT p.code ORDER BY p.code)
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::varchar[]) as "permissionCodes"
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
      ) as "permissionCodes"
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

// GET /api/users - List users with pagination and filters
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Number(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || 1);
    const limit = Number(
      Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit || 20
    );
    const role = req.query.role as string;
    const department = req.query.department as string;
    const isActive = req.query.isActive as string;
    const search = req.query.search as string;
    const sortBy = (
      Array.isArray(req.query.sortBy) ? req.query.sortBy[0] : req.query.sortBy || 'name'
    ) as string;
    const sortOrder = (
      Array.isArray(req.query.sortOrder) ? req.query.sortOrder[0] : req.query.sortOrder || 'asc'
    ) as string;

    // Build the WHERE clause
    const conditions: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    // Always exclude soft-deleted users
    conditions.push(`u.deleted_at IS NULL`);

    if (role && typeof role === 'string') {
      conditions.push(`EXISTS (
        SELECT 1
        FROM user_roles urf
        JOIN roles_v2 rvf ON rvf.id = urf.role_id
        WHERE urf.user_id = u.id AND rvf.name = $${paramIndex++}
      )`);
      params.push(role);
    }

    if (department && typeof department === 'string') {
      conditions.push(`d.name ILIKE $${paramIndex++}`);
      params.push(`%${department}%`);
    }

    if (isActive !== undefined) {
      conditions.push(`u.is_active = $${paramIndex++}`);
      params.push(isActive === 'true');
    }

    if (search && typeof search === 'string') {
      conditions.push(`(
        COALESCE(u.name, '') ILIKE $${paramIndex} OR
        COALESCE(u.email, '') ILIKE $${paramIndex} OR
        COALESCE(u.username, '') ILIKE $${paramIndex} OR
        COALESCE(u.employee_id, '') ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
        u.designation,
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
      filters: { role, department, isActive, search },
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
        u.designation,
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
    logger.info('Creating user with data:', { body: req.body, userId: req.user?.id });

    const {
      name,
      username,
      email,
      password,
      roleId,
      departmentId,
      designationId,
      employeeId,
      designation,
      phone,
      teamLeaderId,
      managerId,
      isActive = true,
      // Legacy fields for backward compatibility
      role,
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
    const hashedPassword = await bcrypt.hash(password, 10);

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

      const createUserQuery = `
        INSERT INTO users (
          name, username, email, password_hash, role, department_id, designation_id,
          employee_id, designation, phone, team_leader_id, manager_id, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, name, username, email, role, department_id, designation_id,
                  employee_id, designation, phone, team_leader_id as "teamLeaderId",
                  manager_id as "managerId", is_active, created_at, updated_at
      `;

      const insertRes = await client.query(createUserQuery, [
        name,
        username,
        email,
        hashedPassword,
        finalRole,
        cleanDepartmentId,
        cleanDesignationId,
        employeeId || null,
        designation || null,
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
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING',
          [createdUser.id, rbacRoleId]
        );
      }

      return insertRes;
    });

    const newUser = {
      ...result.rows[0],
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

    // Check if user exists
    const userExistsQuery = `
      SELECT id, role, team_leader_id as "teamLeaderId", manager_id as "managerId"
      FROM users
      WHERE id = $1
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

    const allowedFields = [
      'name',
      'username',
      'email',
      'phone',
      'role',
      'departmentId',
      'employeeId',
      'designation',
      'teamLeaderId',
      'managerId',
      'isActive',
    ];

    const fieldColumnMap: Record<string, string> = {
      employeeId: 'employee_id',
      departmentId: 'department_id',
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

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, username, email, role, department_id,
                employee_id, designation, phone, team_leader_id as "teamLeaderId",
                manager_id as "managerId", is_active, created_at, updated_at
    `;

    const result = await withTransaction(async client => {
      const updateRes = await client.query(updateQuery, updateParams);
      if (rbacRoleId) {
        await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING',
          [id, rbacRoleId]
        );
      }
      return updateRes;
    });
    const updatedUser = {
      ...result.rows[0],
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
        u.designation,
        u.is_active
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE
        u.name ILIKE $1 OR
        u.email ILIKE $1 OR
        u.username ILIKE $1 OR
        d.name ILIKE $1 OR
        u.designation ILIKE $1
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

    // Get basic user counts
    const userCountsQuery = `
      SELECT
        COUNT(*) as "totalUsers",
        COUNT(CASE WHEN is_active = true THEN 1 END) as "activeUsers",
        COUNT(CASE WHEN is_active = false THEN 1 END) as "inactiveUsers",
        COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as "newUsersThisMonth"
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
        last_login as "lastLoginAt"
      FROM users
      WHERE last_login >= NOW() - INTERVAL '24 hours'
        AND deleted_at IS NULL
      ORDER BY last_login DESC
      LIMIT 10
    `;
    const recentLoginsResult = await query(recentLoginsQuery);

    const statsRow = (userCounts.rows[0] || {}) as Record<string, unknown>;

    res.json({
      success: true,
      data: {
        totalUsers: getCountValue(statsRow, 'totalUsers'),
        activeUsers: getCountValue(statsRow, 'activeUsers'),
        inactiveUsers: getCountValue(statsRow, 'inactiveUsers'),
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

// GET /api/users/departments - Get departments for user management
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

// GET /api/users/designations - Get designations for user management
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

// GET /api/users/activities - Get user activity logs
export const getUserActivities = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, userId, fromDate, toDate } = req.query;
    const canViewAllActivities =
      hasSystemScopeBypass(req.user) ||
      userHasPermission(req.user, 'permission.manage') ||
      userHasPermission(req.user, 'role.manage');

    // Build query conditions
    const conditions: string[] = [];
    const params: (string | number | string[])[] = [];
    let paramIndex = 1;

    if (canViewAllActivities) {
      // Super admin / permission managers: filter by optional userId or see all
      if (userId && typeof userId === 'string') {
        conditions.push(`al.user_id = $${paramIndex++}`);
        params.push(userId);
      }
    } else {
      // Scoped users: see own + subordinates' activities
      const hierarchyUserIds = req.user?.id
        ? await getScopedOperationalUserIds(req.user.id)
        : undefined;

      if (hierarchyUserIds && hierarchyUserIds.length > 0) {
        conditions.push(`al.user_id = ANY($${paramIndex++}::uuid[])`);
        params.push(hierarchyUserIds);
      } else if (req.user?.id) {
        conditions.push(`al.user_id = $${paramIndex++}`);
        params.push(req.user.id);
      }
    }

    if (search && typeof search === 'string') {
      conditions.push(`(al.action ILIKE $${paramIndex} OR al.details::text ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (fromDate) {
      conditions.push(`al.created_at >= $${paramIndex++}`);
      params.push(fromDate as string);
    }

    if (toDate) {
      conditions.push(`al.created_at <= $${paramIndex++}`);
      params.push(toDate as string);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const offset = (Number(page) - 1) * Number(limit);
    const activitiesQuery = `
      SELECT 
        al.id, 
        al.action, 
        al.created_at, 
        al.ip_address, 
        al.user_agent, 
        al.details, 
        al.user_id,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(Number(limit), offset);
    const result = await query(activitiesQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching user activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activities',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/sessions - Get user refresh token sessions
export const getUserSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.query;

    const canViewOtherSessions =
      hasSystemScopeBypass(req.user) ||
      userHasAnyPermission(req.user, ['user.update', 'territory.assign']);
    const targetUserId = canViewOtherSessions ? (userId as string) : req.user?.id;

    // We only filter by targetUserId if provided (for Admin) or enforced (for regular user)
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (targetUserId) {
      conditions.push(`rt.user_id = $${paramIndex++}`);
      params.push(targetUserId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Join with users to get name/username, and calculate isActive
    const sessionsQuery = `
      SELECT 
        rt.id,
        rt.user_id,
        rt.created_at,
        rt.expires_at,
        rt.ip_address,
        rt.user_agent,
        (rt.expires_at > CURRENT_TIMESTAMP) as is_active,
        u.name as user_name,
        u.username
      FROM refresh_tokens rt
      LEFT JOIN users u ON rt.user_id = u.id
      ${whereClause}
      ORDER BY rt.created_at DESC
    `;

    const result = await query(sessionsQuery, params);

    res.json({
      success: true,
      data: result.rows,
      message:
        result.rows.length > 0 ? 'Sessions retrieved successfully' : 'No active sessions found',
    });
  } catch (error) {
    logger.error('Error fetching user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user sessions',
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

export const bulkUserOperation = (req: AuthenticatedRequest, res: Response) => {
  res.status(501).json({
    success: false,
    message: 'Bulk operations feature coming soon',
    error: { code: 'NOT_IMPLEMENTED' },
  });
};

// GET /api/users/:userId/client-assignments - Get assigned clients for a user
export const getUserClientAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const userResult = await query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Get client assignments with client details
    const assignmentsResult = await query(
      `
      SELECT
        uca.id,
        uca.client_id,
        uca.created_at,
        uca.updated_at,
        c.name as client_name,
        c.code as "clientCode",
        c.email as "clientEmail",
        c.is_active as "clientIsActive"
      FROM user_client_assignments uca
      JOIN clients c ON uca.client_id = c.id
      WHERE uca.user_id = $1
      ORDER BY c.name ASC
    `,
      [userId]
    );

    logger.info(
      `Retrieved ${assignmentsResult.rows.length} client assignments for user ${userId}`,
      {
        userId: req.user?.id,
        targetUserId: userId,
      }
    );

    res.json({
      success: true,
      data: assignmentsResult.rows,
      pagination: {
        page: 1,
        limit: assignmentsResult.rows.length,
        total: assignmentsResult.rows.length,
        totalPages: 1,
      },
      message: 'Client assignments retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving user client assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve client assignments',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:userId/client-assignments - Assign clients to a user
export const assignClientsToUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { clientIds } = req.body;

    // Validate input - allow empty arrays for removing all assignments
    if (!Array.isArray(clientIds)) {
      return res.status(400).json({
        success: false,
        message: 'clientIds must be an array',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Validate user exists
    const userResult = await query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Validate all client IDs exist (only if clientIds is not empty)
    if (clientIds.length > 0) {
      const clientsResult = await query(`SELECT id FROM clients WHERE id = ANY($1::int[])`, [
        clientIds,
      ]);

      if (clientsResult.rows.length !== clientIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more client IDs are invalid',
          error: { code: 'INVALID_CLIENT_IDS' },
        });
      }
    }

    // Start transaction to replace all assignments
    await query('BEGIN');

    try {
      // First, delete all existing assignments for this user
      const deleteResult = await query(
        'DELETE FROM user_client_assignments WHERE user_id = $1 RETURNING id',
        [userId]
      );
      const deletedCount = deleteResult.rows.length;

      let insertedCount = 0;

      // Then, insert new assignments (only if clientIds is not empty)
      if (clientIds.length > 0) {
        const insertPromises = clientIds.map(clientId =>
          query(
            `
            INSERT INTO user_client_assignments (user_id, client_id)
            VALUES ($1, $2)
            RETURNING id
          `,
            [userId, clientId]
          )
        );

        const results = await Promise.all(insertPromises);
        insertedCount = results.length;
      }

      // Commit transaction
      await query('COMMIT');

      logger.info(`Replaced client assignments for user ${userId}`, {
        userId: req.user?.id,
        targetUserId: userId,
        clientIds,
        deletedCount,
        insertedCount,
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          deletedAssignments: deletedCount,
          newAssignments: insertedCount,
          totalRequested: clientIds.length,
        },
        message: `Successfully updated client assignments for user`,
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    logger.error('Error updating client assignments for user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client assignments for user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/users/:userId/client-assignments/:clientId - Remove client assignment
export const removeClientAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, clientId } = req.params;

    // Validate user exists
    const userResult = await query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Validate client exists
    const clientResult = await query('SELECT id FROM clients WHERE id = $1', [clientId]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'CLIENT_NOT_FOUND' },
      });
    }

    // Remove the assignment
    const deleteResult = await query(
      'DELETE FROM user_client_assignments WHERE user_id = $1 AND client_id = $2 RETURNING id',
      [userId, clientId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client assignment not found',
        error: { code: 'ASSIGNMENT_NOT_FOUND' },
      });
    }

    logger.info(`Removed client assignment: user ${userId}, client ${clientId}`, {
      userId: req.user?.id,
      targetUserId: userId,
      removedClientId: clientId,
    });

    res.json({
      success: true,
      message: 'Client assignment removed successfully',
    });
  } catch (error) {
    logger.error('Error removing client assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove client assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/users/:userId/product-assignments - Get user's product assignments
export const getUserProductAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const userResult = await query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Get product assignments with product details
    const assignmentsQuery = `
      SELECT
        upa.id,
        upa.user_id,
        upa.product_id,
        upa.assigned_at,
        upa.assigned_by,
        p.name as product_name,
        p.description as "productDescription",
        u.name as "assignedByName"
      FROM user_product_assignments upa
      JOIN products p ON upa.product_id = p.id
      LEFT JOIN users u ON upa.assigned_by = u.id
      WHERE upa.user_id = $1
      ORDER BY upa.assigned_at DESC
    `;

    const result = await query(assignmentsQuery, [userId]);

    res.json({
      success: true,
      data: result.rows,
      message: 'Product assignments retrieved successfully',
    });
  } catch (error) {
    logger.error('Error fetching user product assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:userId/product-assignments - Assign products to a user
export const assignProductsToUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { productIds } = req.body;

    // Validate input - allow empty arrays for removing all assignments
    if (!Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'productIds must be an array',
        error: { code: 'INVALID_INPUT' },
      });
    }

    // Validate user exists
    const userResult = await query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Validate all product IDs exist (only if productIds is not empty)
    if (productIds.length > 0) {
      const productCheckQuery = `
        SELECT id FROM products WHERE id = ANY($1::int[])
      `;
      const productCheckResult = await query(productCheckQuery, [productIds]);

      if (productCheckResult.rows.length !== productIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more products not found',
          error: { code: 'INVALID_PRODUCTS' },
        });
      }
    }

    // Start transaction to replace all assignments
    await query('BEGIN');

    try {
      // First, delete all existing assignments for this user
      const deleteResult = await query(
        'DELETE FROM user_product_assignments WHERE user_id = $1 RETURNING id',
        [userId]
      );
      const deletedCount = deleteResult.rows.length;

      let insertedCount = 0;

      // Then, insert new assignments (only if productIds is not empty)
      if (productIds.length > 0) {
        const insertValues = productIds
          .map(
            (productId, index) =>
              `($1, $${index + 2}, $${productIds.length + 2}, CURRENT_TIMESTAMP)`
          )
          .join(', ');

        const insertQuery = `
          INSERT INTO user_product_assignments (user_id, product_id, assigned_by, assigned_at)
          VALUES ${insertValues}
          RETURNING *
        `;

        const insertParams = [userId, ...productIds, req.user?.id];
        const insertResult = await query(insertQuery, insertParams);
        insertedCount = insertResult.rows.length;
      }

      // Commit transaction
      await query('COMMIT');

      logger.info(`Replaced product assignments for user ${userId}`, {
        userId: req.user?.id,
        targetUserId: userId,
        productIds,
        deletedCount,
        insertedCount,
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          deletedAssignments: deletedCount,
          newAssignments: insertedCount,
          totalRequested: productIds.length,
        },
        message: `Successfully updated product assignments for user`,
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    logger.error('Error updating product assignments for user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product assignments for user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/users/:userId/product-assignments/:productId - Remove product assignment
export const removeProductAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, productId } = req.params;

    // Validate user exists
    const userResult = await query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if assignment exists
    const assignmentResult = await query(
      'SELECT id FROM user_product_assignments WHERE user_id = $1 AND product_id = $2',
      [userId, productId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product assignment not found',
        error: { code: 'ASSIGNMENT_NOT_FOUND' },
      });
    }

    // Remove assignment
    await query('DELETE FROM user_product_assignments WHERE user_id = $1 AND product_id = $2', [
      userId,
      productId,
    ]);

    res.json({
      success: true,
      message: 'Product assignment removed successfully',
    });
  } catch (error) {
    logger.error('Error removing product assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:id/generate-temp-password - Generate temporary password
export const generateTemporaryPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    // Check if user exists
    const userCheck = await query('SELECT id, name, username, email FROM users WHERE id = $1', [
      id,
    ]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userCheck.rows[0];

    // Generate a temporary password (8 characters: letters + numbers)
    const tempPassword =
      Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();

    // Hash the temporary password
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Update user's password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, id]
    );

    // Send email with temporary password
    try {
      const emailService = EmailDeliveryService.getInstance();
      const emailResult = await emailService.sendEmail({
        to: user.email,
        subject: 'Password Reset - CRM System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Notification</h2>
            <p>Hello ${user.name},</p>
            <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Username:</strong> ${user.username}</p>
              <p><strong>Temporary Password:</strong> <code style="background-color: #e0e0e0; padding: 2px 4px; border-radius: 3px;">${tempPassword}</code></p>
            </div>
            <p style="color: #d32f2f;"><strong>Important:</strong> Please change this password immediately after logging in for security purposes.</p>
            <p>If you did not request this password reset, please contact your administrator immediately.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message from the CRM System. Please do not reply to this email.</p>
          </div>
        `,
        text: `
Password Reset Notification

Hello ${user.name},

Your password has been reset by an administrator. Here are your new login credentials:

Username: ${user.username}
Temporary Password: ${tempPassword}

Important: Please change this password immediately after logging in for security purposes.

If you did not request this password reset, please contact your administrator immediately.
        `,
      });

      if (emailResult.success) {
        logger.info(`Password reset email sent to ${user.email}`, {
          userId: req.user?.id,
          targetUserId: id,
          messageId: emailResult.messageId,
        });
      } else {
        logger.error(`Failed to send password reset email to ${user.email}`, {
          userId: req.user?.id,
          targetUserId: id,
          error: emailResult.error,
        });
      }
    } catch (emailError) {
      logger.error('Error sending password reset email:', emailError);
    }

    logger.info(`Generated temporary password for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: id,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'GENERATE_TEMP_PASSWORD',
      entityType: 'USER',
      entityId: id,
      details: { targetUsername: user.username },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: { temporaryPassword: tempPassword },
      message: 'Temporary password generated and sent via email successfully',
    });
  } catch (error) {
    logger.error('Error generating temporary password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate temporary password',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:id/change-password - Change user password
export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'New password must be at least 8 characters and include uppercase, lowercase, number, and special character',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if user exists and get current password
    const userCheck = await query(
      'SELECT id, name, username, password_hash FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userCheck.rows[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
        error: { code: 'INVALID_PASSWORD' },
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedNewPassword, id]
    );

    logger.info(`Password changed for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: id,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/reset-password - Reset password (admin function)
export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, newPassword } = req.body;

    // Validate input
    if (!username || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username and new password are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'New password must be at least 8 characters and include uppercase, lowercase, number, and special character',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if user exists
    const userCheck = await query(
      'SELECT id, name, username, email FROM users WHERE username = $1',
      [username]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userCheck.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, user.id]
    );

    logger.info(`Password reset for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: user.id,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      entityId: user.id,
      details: { targetUsername: user.username },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * GET /api/users/field-agents/available?pincodeId=1&areaId=2
 * Get available field agents filtered by pincode and optionally area
 * Used in task assignment to show only field agents with access to the selected territory
 */
export const getAvailableFieldAgents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pincodeId, areaId } = req.query;

    if (!pincodeId) {
      return res.status(400).json({
        success: false,
        message: 'pincodeId is required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    let sql: string;
    let params: (string | number)[];

    if (areaId) {
      // Filter by both pincode AND area
      sql = `
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          u.employee_id
        FROM users u
        INNER JOIN user_pincode_assignments upa
          ON u.id = upa.user_id
          AND upa.pincode_id = $1
          AND upa.is_active = true
        INNER JOIN user_area_assignments uaa
          ON u.id = uaa.user_id
          AND uaa.pincode_id = $1
          AND uaa.area_id = $2
          AND uaa.is_active = true
        WHERE EXISTS (
          SELECT 1
          FROM user_roles urf
          JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
          JOIN permissions pf ON pf.id = rpf.permission_id
          WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
        )
          AND u.is_active = true
        ORDER BY u.name
      `;
      params = [Number(pincodeId), Number(areaId)];
    } else {
      // Filter by pincode only
      sql = `
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          u.employee_id
        FROM users u
        INNER JOIN user_pincode_assignments upa
          ON u.id = upa.user_id
          AND upa.pincode_id = $1
          AND upa.is_active = true
        WHERE EXISTS (
          SELECT 1
          FROM user_roles urf
          JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
          JOIN permissions pf ON pf.id = rpf.permission_id
          WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
        )
          AND u.is_active = true
        ORDER BY u.name
      `;
      params = [Number(pincodeId)];
    }

    const result = await query(sql, params);

    logger.info(`Retrieved ${result.rows.length} available field agents`, {
      userId: req.user?.id,
      pincodeId,
      areaId,
      count: result.rows.length,
    });

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching available field agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch field agents',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/export - Export users to Excel
export const exportUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      role,
      department,
      isActive,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      format = 'EXCEL',
    } = { ...req.query, ...(req.method === 'POST' ? req.body : {}) };

    // Build the WHERE clause (same logic as getUsers but without pagination)
    const conditions: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    // Always exclude soft-deleted users
    conditions.push(`u.deleted_at IS NULL`);

    if (role && typeof role === 'string') {
      conditions.push(`EXISTS (
        SELECT 1
        FROM user_roles urf
        JOIN roles_v2 rvf ON rvf.id = urf.role_id
        WHERE urf.user_id = u.id AND rvf.name = $${paramIndex++}
      )`);
      params.push(role);
    }

    if (department && typeof department === 'string') {
      conditions.push(`d.name ILIKE $${paramIndex++}`);
      params.push(`%${department}%`);
    }

    if (isActive !== undefined) {
      conditions.push(`u.is_active = $${paramIndex++}`);
      params.push(isActive === 'true' || isActive === true);
    }

    if (search && typeof search === 'string') {
      conditions.push(`(
        COALESCE(u.name, '') ILIKE $${paramIndex} OR
        COALESCE(u.email, '') ILIKE $${paramIndex} OR
        COALESCE(u.username, '') ILIKE $${paramIndex} OR
        COALESCE(u.employee_id, '') ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sortBy to prevent SQL injection
    const validSortColumns = ['name', 'username', 'email', 'role', 'createdAt', 'updatedAt'];
    const safeSortBy: string = validSortColumns.includes(sortBy as string)
      ? (sortBy as string)
      : 'name';
    const safeSortOrder: 'ASC' | 'DESC' = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const sortColumnMap: Record<string, string> = {
      name: 'u.name',
      username: 'u.username',
      email: 'u.email',
      role: 'role_name',
      createdAt: 'u.created_at',
      updatedAt: 'u.updated_at',
    };
    const safeSortColumn = sortColumnMap[safeSortBy] || 'u.name';

    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u.phone,
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role,
        u.employee_id,
        u.designation,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        ${PRIMARY_RBAC_ROLE_NAME_SQL} as role_name,
        d.name as "departmentName"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ${whereClause}
      ORDER BY ${safeSortColumn} ${safeSortOrder}
    `;

    const usersResult = await query(usersQuery, params);
    const users = usersResult.rows;

    if (format === 'EXCEL') {
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Users');

      // Define columns
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Username', key: 'username', width: 20 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Role', key: 'roleName', width: 15 },
        { header: 'Department', key: 'departmentName', width: 20 },
        { header: 'Employee ID', key: 'employeeId', width: 15 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Designation', key: 'designation', width: 18 },
        { header: 'Status', key: 'isActive', width: 10 },
        { header: 'Last Login', key: 'lastLogin', width: 20 },
        { header: 'Created At', key: 'createdAt', width: 20 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Add data rows
      users.forEach(
        (user: {
          id: string;
          name: string;
          username: string;
          email: string;
          role: string;
          isActive: boolean;
          createdAt: string;
          roleName?: string;
          departmentName?: string;
          employeeId?: string;
          phone?: string;
        }) => {
          worksheet.addRow({
            ...user,
            isActive: user.isActive ? 'Active' : 'Inactive',
            createdAt: user.createdAt ? new Date(user.createdAt).toLocaleString() : '',
          });
        }
      );

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Set response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Users_Export_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      res.send(buffer);
    } else {
      // Default to CSV
      const headers = [
        'ID',
        'Name',
        'Username',
        'Email',
        'Role',
        'Department',
        'Employee ID',
        'Phone',
        'Status',
        'Created At',
      ];
      const csvRows = [headers.join(',')];

      users.forEach(
        (user: {
          id: string;
          name: string;
          username: string;
          email: string;
          role: string;
          isActive: boolean;
          createdAt: string;
          roleName?: string;
          departmentName?: string;
          employeeId?: string;
          phone?: string;
        }) => {
          const row = [
            user.id,
            `"${user.name || ''}"`,
            user.username,
            user.email,
            user.roleName || user.role,
            `"${user.departmentName || ''}"`,
            user.employeeId || '',
            user.phone || '',
            user.isActive ? 'Active' : 'Inactive',
            user.createdAt ? new Date(user.createdAt).toISOString() : '',
          ];
          csvRows.push(row.join(','));
        }
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Users_Export_${new Date().toISOString().split('T')[0]}.csv`
      );
      res.send(csvRows.join('\n'));
    }

    logger.info('Users exported successfully', {
      userId: req.user?.id,
      recordCount: users.length,
      format,
    });
  } catch (error) {
    logger.error('Error exporting users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export users',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

/**
 * GET /api/users/import-template
 * Download an Excel template for bulk user imports
 */
export const downloadUserTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Template');

    // Define template columns
    worksheet.columns = [
      { header: 'Name*', key: 'name', width: 25 },
      { header: 'Username*', key: 'username', width: 20 },
      { header: 'Email*', key: 'email', width: 30 },
      {
        header: `Role* (${CANONICAL_RBAC_ROLE_NAMES.join(', ')})`,
        key: 'role',
        width: 40,
      },
      { header: 'Employee ID*', key: 'employeeId', width: 15 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Password (Required if creating)', key: 'password', width: 30 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add sample row
    worksheet.addRow({
      name: 'John Doe',
      username: 'johndoe',
      email: 'john@example.com',
      role: 'BACKEND_USER',
      employeeId: 'EMP001',
      phone: '+919876543210',
      department: 'Operations',
      designation: 'Executive',
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=User_Import_Template.xlsx');
    res.send(buffer);

    logger.info('User import template downloaded successfully', {
      userId: req.user?.id,
    });
  } catch (error) {
    logger.error('Error downloading user template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download user template',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
