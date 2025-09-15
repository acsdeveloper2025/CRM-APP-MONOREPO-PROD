import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import type { Role } from '@/types/auth';
import { EmailDeliveryService } from '@/services/EmailDeliveryService';


// GET /api/users - List users with pagination and filters
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      role, 
      department, 
      isActive, 
      search, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = req.query;

    // Build the WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      conditions.push(`u.role = $${paramIndex++}`);
      params.push(role);
    }

    if (department) {
      conditions.push(`d.name ILIKE $${paramIndex++}`);
      params.push(`%${department}%`);
    }

    if (isActive !== undefined) {
      conditions.push(`u."isActive" = $${paramIndex++}`);
      params.push(isActive === 'true');
    }

    if (search) {
      conditions.push(`(
        u.name ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex} OR 
        u.username ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sortBy to prevent SQL injection
    const validSortColumns = ['name', 'username', 'email', 'role', 'createdAt', 'updatedAt'];
    const safeSortBy = validSortColumns.includes(sortBy as string) ? sortBy : 'name';
    const safeSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const offset = (Number(page) - 1) * Number(limit);
    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u.phone,
        u.role,
        u."roleId",
        u."departmentId",
        u."designationId",
        u."employeeId",
        u.designation,
        u."isActive",
        u."lastLogin",
        u."createdAt",
        u."updatedAt",

        r.name as "roleName",
        d.name as "departmentName",
        des.name as "designationName"
      FROM users u
      LEFT JOIN roles r ON u."roleId" = r.id
      LEFT JOIN departments d ON u."departmentId" = d.id
      LEFT JOIN designations des ON u."designationId" = des.id
      ${whereClause}
      ORDER BY u.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(Number(limit), offset);
    const usersResult = await query(usersQuery, params);

    logger.info(`Retrieved ${usersResult.rows.length} users`, { 
      userId: req.user?.id,
      filters: { role, department, isActive, search },
      pagination: { page, limit }
    });

    res.json({
      success: true,
      data: usersResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
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
    const { id } = req.params;
    
    const userQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        u.phone,
        u.role,
        u."roleId",
        u."departmentId",
        u."designationId",
        u."employeeId",
        u.designation,
        u."isActive",
        u."lastLogin",
        u."createdAt",
        u."updatedAt",

        r.name as "roleName",
        r.description as "roleDescription",
        r.permissions as "rolePermissions",
        d.name as "departmentName",
        d.description as "departmentDescription",
        des.name as "designationName"
      FROM users u
      LEFT JOIN roles r ON u."roleId" = r.id
      LEFT JOIN departments d ON u."departmentId" = d.id
      LEFT JOIN designations des ON u."designationId" = des.id
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
      isActive = true,
      // Legacy fields for backward compatibility
      role,
      department
    } = req.body;

    // Convert empty strings to null for UUID fields and handle numeric IDs
    const cleanRoleId = roleId && (typeof roleId === 'string' ? roleId.trim() !== '' : true) ? roleId : null;
    const cleanDepartmentId = departmentId && (typeof departmentId === 'string' ? departmentId.trim() !== '' : true) ? departmentId : null;
    const cleanDesignationId = designationId && (typeof designationId === 'string' ? designationId.trim() !== '' : true) ? designationId : null;

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

    // Determine the role string from roleId (prioritize roleId over role field)
    let finalRole = null;

    if (cleanRoleId) {
      // Get role name from roleId
      const roleQuery = `SELECT name FROM roles WHERE id = $1`;
      const roleResult = await query(roleQuery, [cleanRoleId]);
      if (roleResult.rows.length > 0) {
        finalRole = roleResult.rows[0].name;
      }
    } else if (role) {
      // Fallback to role field if roleId is not provided
      finalRole = role;
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
    logger.info(`User creation debug: roleId=${cleanRoleId}, role=${role}, finalRole=${finalRole}`, {
      userId: req.user?.id,
      roleId: cleanRoleId,
      role: role,
      finalRole: finalRole
    });

    // Validate role against allowed values
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_USER', 'FIELD_AGENT', 'MANAGER'];
    if (!allowedRoles.includes(finalRole)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${allowedRoles.join(', ')}`,
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Create new user in database
    const createUserQuery = `
      INSERT INTO users (
        name, username, email, password, "passwordHash", role, "roleId", "departmentId", "designationId",
        "employeeId", designation, phone, "isActive"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, name, username, email, role, "roleId", "departmentId", "designationId",
                "employeeId", designation, phone, "isActive", "createdAt", "updatedAt"
    `;

    const result = await query(createUserQuery, [
      name,
      username,
      email,
      hashedPassword, // password column
      hashedPassword, // passwordHash column
      finalRole, // Use the validated role
      cleanRoleId,
      cleanDepartmentId,
      cleanDesignationId,
      employeeId || null,
      designation || null,
      phone || null,
      isActive
    ]);

    const newUser = result.rows[0];

    logger.info(`Created new user: ${newUser.id}`, { 
      userId: req.user?.id,
      newUserEmail: email,
      newUserRole: role
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: 'User created successfully',
    });
  } catch (error) {
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
    const { id } = req.params;
    const updateData = req.body;

    // Check if user exists
    const userExistsQuery = `SELECT id FROM users WHERE id = $1`;
    const userExists = await query(userExistsQuery, [id]);

    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

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

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateParams: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'username', 'email', 'phone', 'role', 'roleId', 'departmentId', 'employeeId', 'designation', 'isActive'];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        const column = ['employeeId','roleId','departmentId','isActive','lastLogin','createdAt','updatedAt'].includes(field) ? `"${field}"` : field;
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

    updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    updateParams.push(id);

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, username, email, role, "roleId", "departmentId",
                "employeeId", designation, phone, "isActive", "createdAt", "updatedAt"
    `;

    const result = await query(updateQuery, updateParams);
    const updatedUser = result.rows[0];

    logger.info(`Updated user: ${id}`, {
      userId: req.user?.id,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error) {
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
    const { id } = req.params;

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

    // Delete user
    const deleteQuery = `DELETE FROM users WHERE id = $1`;
    await query(deleteQuery, [id]);

    logger.info(`Deleted user: ${id}`, {
      userId: req.user?.id,
      deletedUsername: userExists.rows[0].username
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:id/activate - Activate user
export const activateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const updateQuery = `
      UPDATE users
      SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, username, "isActive"
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
    const { id } = req.params;

    const updateQuery = `
      UPDATE users
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, username, "isActive"
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
        u.role,
        d.name as "departmentName",
        u.designation,
        u."isActive"
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      WHERE
        u.name ILIKE $1 OR
        u.email ILIKE $1 OR
        u.username ILIKE $1 OR
        d.name ILIKE $1 OR
        u.designation ILIKE $1
      ORDER BY u.name
      LIMIT 50
    `;

    const result = await query(searchQuery, [`%${q}%`]);

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
    // Get basic user counts
    const userCountsQuery = `
      SELECT
        COUNT(*) as "totalUsers",
        COUNT(CASE WHEN "isActive" = true THEN 1 END) as "activeUsers",
        COUNT(CASE WHEN "isActive" = false THEN 1 END) as "inactiveUsers"
      FROM users
    `;
    const userCounts = await query(userCountsQuery);

    // Get users by role
    const roleStatsQuery = `
      SELECT
        COALESCE(r.name, u.role) as role,
        COUNT(*) as count
      FROM users u
      LEFT JOIN roles r ON u."roleId" = r.id
      GROUP BY COALESCE(r.name, u.role)
      ORDER BY count DESC
    `;
    const roleStats = await query(roleStatsQuery);

    // Get users by department
    const departmentStatsQuery = `
      SELECT
        COALESCE(d.name, 'No Department') as department,
        COUNT(*) as count
      FROM users u
      LEFT JOIN departments d ON u."departmentId" = d.id
      GROUP BY d.name
      ORDER BY count DESC
    `;
    const departmentStats = await query(departmentStatsQuery);

    const stats = userCounts.rows[0];

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(stats.totalUsers),
        activeUsers: parseInt(stats.activeUsers),
        inactiveUsers: parseInt(stats.inactiveUsers),
        usersByRole: roleStats.rows,
        usersByDepartment: departmentStats.rows,
        recentLogins: 0, // TODO: Implement when login tracking is added
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
      WHERE "isActive" = true
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
      WHERE "isActive" = true
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

// Placeholder functions for activities and sessions (to be implemented)
export const getUserActivities = async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    message: 'User activities feature coming soon',
  });
};

export const getUserSessions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    message: 'User sessions feature coming soon',
  });
};

export const getRolePermissions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    message: 'Role permissions feature coming soon',
  });
};

export const bulkUserOperation = async (req: AuthenticatedRequest, res: Response) => {
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
    const userResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Get client assignments with client details
    const assignmentsResult = await query(`
      SELECT
        uca.id,
        uca."clientId",
        uca."createdAt",
        uca."updatedAt",
        c.name as "clientName",
        c.code as "clientCode",
        c.email as "clientEmail",
        c."isActive" as "clientIsActive"
      FROM "userClientAssignments" uca
      JOIN clients c ON uca."clientId" = c.id
      WHERE uca."userId" = $1
      ORDER BY c.name ASC
    `, [userId]);

    logger.info(`Retrieved ${assignmentsResult.rows.length} client assignments for user ${userId}`, {
      userId: req.user?.id,
      targetUserId: userId
    });

    res.json({
      success: true,
      data: assignmentsResult.rows,
      pagination: {
        page: 1,
        limit: assignmentsResult.rows.length,
        total: assignmentsResult.rows.length,
        totalPages: 1
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
    const userResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Validate all client IDs exist (only if clientIds is not empty)
    if (clientIds.length > 0) {
      const clientsResult = await query(
        `SELECT id FROM clients WHERE id = ANY($1::int[])`,
        [clientIds]
      );

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
        'DELETE FROM "userClientAssignments" WHERE "userId" = $1 RETURNING id',
        [userId]
      );
      const deletedCount = deleteResult.rows.length;

      let insertedCount = 0;

      // Then, insert new assignments (only if clientIds is not empty)
      if (clientIds.length > 0) {
        const insertPromises = clientIds.map(clientId =>
          query(`
            INSERT INTO "userClientAssignments" ("userId", "clientId")
            VALUES ($1, $2)
            RETURNING id
          `, [userId, clientId])
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
        insertedCount
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          deletedAssignments: deletedCount,
          newAssignments: insertedCount,
          totalRequested: clientIds.length
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
    const userResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Validate client exists
    const clientResult = await query(
      'SELECT id FROM clients WHERE id = $1',
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
        error: { code: 'CLIENT_NOT_FOUND' },
      });
    }

    // Remove the assignment
    const deleteResult = await query(
      'DELETE FROM "userClientAssignments" WHERE "userId" = $1 AND "clientId" = $2 RETURNING id',
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
      removedClientId: clientId
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
    const userResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

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
        upa."userId",
        upa."productId",
        upa."assignedAt",
        upa."assignedBy",
        p.name as "productName",
        p.description as "productDescription",
        u.name as "assignedByName"
      FROM "userProductAssignments" upa
      JOIN products p ON upa."productId" = p.id
      LEFT JOIN users u ON upa."assignedBy" = u.id
      WHERE upa."userId" = $1
      ORDER BY upa."assignedAt" DESC
    `;

    const result = await query(assignmentsQuery, [userId]);

    res.json({
      success: true,
      data: result.rows,
      message: 'Product assignments retrieved successfully'
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
    const userResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

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
        'DELETE FROM "userProductAssignments" WHERE "userId" = $1 RETURNING id',
        [userId]
      );
      const deletedCount = deleteResult.rows.length;

      let insertedCount = 0;

      // Then, insert new assignments (only if productIds is not empty)
      if (productIds.length > 0) {
        const insertValues = productIds.map((productId, index) =>
          `($1, $${index + 2}, $${productIds.length + 2}, CURRENT_TIMESTAMP)`
        ).join(', ');

        const insertQuery = `
          INSERT INTO "userProductAssignments" ("userId", "productId", "assignedBy", "assignedAt")
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
        insertedCount
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          deletedAssignments: deletedCount,
          newAssignments: insertedCount,
          totalRequested: productIds.length
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
    const userResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Check if assignment exists
    const assignmentResult = await query(
      'SELECT id FROM "userProductAssignments" WHERE "userId" = $1 AND "productId" = $2',
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
    await query(
      'DELETE FROM "userProductAssignments" WHERE "userId" = $1 AND "productId" = $2',
      [userId, productId]
    );

    res.json({
      success: true,
      message: 'Product assignment removed successfully'
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
    const { id } = req.params;

    // Check if user exists
    const userCheck = await query(
      'SELECT id, name, username, email FROM users WHERE id = $1',
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

    // Generate a temporary password (8 characters: letters + numbers)
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();

    // Hash the temporary password
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Update user's password
    await query(
      'UPDATE users SET "passwordHash" = $1, password = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
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
        `
      });

      if (emailResult.success) {
        logger.info(`Password reset email sent to ${user.email}`, {
          userId: req.user?.id,
          targetUserId: id,
          messageId: emailResult.messageId
        });
      } else {
        logger.error(`Failed to send password reset email to ${user.email}`, {
          userId: req.user?.id,
          targetUserId: id,
          error: emailResult.error
        });
      }
    } catch (emailError) {
      logger.error('Error sending password reset email:', emailError);
    }

    logger.info(`Generated temporary password for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: id
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
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if user exists and get current password
    const userCheck = await query(
      'SELECT id, name, username, "passwordHash" FROM users WHERE id = $1',
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
      'UPDATE users SET "passwordHash" = $1, password = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedNewPassword, id]
    );

    logger.info(`Password changed for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: id
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

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
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
      'UPDATE users SET "passwordHash" = $1, password = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, user.id]
    );

    logger.info(`Password reset for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: user.id
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
