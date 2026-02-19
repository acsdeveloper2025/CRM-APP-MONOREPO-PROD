import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { Role } from '../types/auth';
import { logger } from '../utils/logger';
import { pool } from '../config/database';
import { EnterpriseCacheService, CacheKeys } from '../services/enterpriseCacheService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { QueryParams, CaseRow } from '../types/database';
import { CreateCaseRequest } from '../types/cases';

interface DatabaseError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
  hint?: string;
  column?: string;
  stack?: string;
}

// Mock data removed - using database operations only

// Supported file types for case attachments (PDF, Images, Word only)
const ALLOWED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const ALLOWED_EXTENSIONS = Object.values(ALLOWED_FILE_TYPES);
const ALLOWED_MIME_TYPES = Object.keys(ALLOWED_FILE_TYPES);

// Configure multer for case creation with attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create temporary directory for case creation
    const tempDir = path.join(process.cwd(), 'uploads', 'temp', `case_creation_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `attachment_${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (
  req: AuthenticatedRequest,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (ALLOWED_EXTENSIONS.includes(extension) && ALLOWED_MIME_TYPES.includes(mimeType)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type not allowed. Only PDF, images (JPG, PNG, GIF), and Word documents (DOC, DOCX) are supported.`
      )
    );
  }
};

const uploadForCaseCreation = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file (increased for mobile app with multiple high-res images)
    files: 20, // Maximum 20 files per case creation
  },
});

// GET /api/cases - List cases with filtering, sorting, and pagination (Enterprise Enhanced)
export const getCases = async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();

  try {
    const page = Number(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || 1);
    const limit = Number(
      Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit || 50
    );
    const sortBy = (
      Array.isArray(req.query.sortBy) ? req.query.sortBy[0] : req.query.sortBy || 'updatedAt'
    ) as string;
    const sortOrder = (
      Array.isArray(req.query.sortOrder) ? req.query.sortOrder[0] : req.query.sortOrder || 'desc'
    ) as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const assignedTo = req.query.assignedTo as string;
    const clientId = req.query.clientId as string;
    const priority = req.query.priority as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const useCache = (
      Array.isArray(req.query.useCache) ? req.query.useCache[0] : req.query.useCache || 'true'
    ) as string;

    // Enterprise cache key generation
    const cacheKey = `${CacheKeys.userCases(
      req.user?.id || 'anonymous',
      Number(page)
    )}:${JSON.stringify(req.query)}`;

    // Try cache first (unless bypassed)
    if (useCache === 'true') {
      const cached = await EnterpriseCacheService.get(cacheKey);
      if (cached) {
        logger.debug('Cases cache hit', {
          userId: req.user?.id,
          page,
          cacheKey,
          responseTime: Date.now() - startTime,
        });

        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
    }

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    // Role-based filtering - FIELD_AGENT users can only see cases with their assigned tasks
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === Role.FIELD_AGENT) {
      // Filter by task-level assignment AND pincode/area assignments
      // FIELD_AGENT can see cases if:
      // 1. They are assigned to a verification task in the case, OR
      // 2. The case has tasks in their assigned pincodes/areas
      const { getAssignedPincodeIds } = await import('@/middleware/pincodeAccess');
      const { getAssignedAreaIds } = await import('@/middleware/areaAccess');

      const assignedPincodeIds = await getAssignedPincodeIds(userId, userRole);
      const assignedAreaIds = await getAssignedAreaIds(userId, userRole);

      // Build complex filter: (assigned to task) OR (task in assigned pincode/area)
      const fieldAgentConditions: string[] = [];

      // Condition 1: Directly assigned to a task
      fieldAgentConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
        AND vt.assigned_to = $${paramIndex}
      )`);
      params.push(userId);
      paramIndex++;

      // Condition 2: Task in assigned pincode
      if (assignedPincodeIds && assignedPincodeIds.length > 0) {
        fieldAgentConditions.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.pincode_id = ANY($${paramIndex}::int[])
        )`);
        params.push(assignedPincodeIds);
        paramIndex++;
      }

      // Condition 3: Task in assigned area
      if (assignedAreaIds && assignedAreaIds.length > 0) {
        fieldAgentConditions.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.area_id = ANY($${paramIndex}::int[])
        )`);
        params.push(assignedAreaIds);
        paramIndex++;
      }

      // If user has no assignments at all, show only directly assigned tasks
      if (fieldAgentConditions.length > 0) {
        conditions.push(`(${fieldAgentConditions.join(' OR ')})`);
      } else {
        // No assignments, show nothing
        conditions.push('FALSE');
      }
    } else if (userRole === Role.BACKEND_USER) {
      // Filter by client and product assignments for BACKEND_USER
      const { getAssignedClientIds } = await import('@/middleware/clientAccess');
      const { getAssignedProductIds } = await import('@/middleware/productAccess');

      const assignedClientIds = await getAssignedClientIds(userId, userRole);
      const assignedProductIds = await getAssignedProductIds(userId, userRole);

      // If user has client assignments, filter by them
      if (assignedClientIds && assignedClientIds.length > 0) {
        conditions.push(`c."clientId" = ANY($${paramIndex}::int[])`);
        params.push(assignedClientIds);
        paramIndex++;
      } else if (assignedClientIds && assignedClientIds.length === 0) {
        // User has no client assignments, show no cases
        conditions.push('FALSE');
      }

      // If user has product assignments, filter by them
      if (assignedProductIds && assignedProductIds.length > 0) {
        conditions.push(`c."productId" = ANY($${paramIndex}::int[])`);
        params.push(assignedProductIds);
        paramIndex++;
      } else if (assignedProductIds && assignedProductIds.length === 0) {
        // User has no product assignments, show no cases
        conditions.push('FALSE');
      }
    } else if (assignedTo) {
      // For other roles, filter by task-level assignment if explicitly provided
      conditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
        AND vt.assigned_to = $${paramIndex}
      )`);
      params.push(assignedTo);
      paramIndex++;
    }

    // Status filter
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Search filter (customer name, case ID, address, phone, trigger, applicant type)
    if (search) {
      conditions.push(`(
        COALESCE(c."customerName", '') ILIKE $${paramIndex} OR
        COALESCE(c."caseId"::text, '') ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM verification_tasks vt 
          WHERE vt.case_id = c.id AND vt.address ILIKE $${paramIndex}
        ) OR
        COALESCE(c."customerPhone", '') ILIKE $${paramIndex} OR
        COALESCE(c.trigger, '') ILIKE $${paramIndex} OR
        COALESCE(c."applicantType", '') ILIKE $${paramIndex}
      )`);
      params.push(
        `%${typeof search === 'string' || typeof search === 'number' ? String(search) : ''}%`
      );
      paramIndex++;
    }

    // Client filter
    if (clientId) {
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(parseInt(clientId));
      paramIndex++;
    }

    // Priority filter
    if (priority) {
      conditions.push(`c.priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(`c."createdAt" >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`c."createdAt" <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column and implement custom sorting logic
    const allowedSortColumns = [
      'createdAt',
      'updatedAt',
      'customerName',
      'priority',
      'status',
      'caseId',
      'completedAt',
      'pendingDuration',
    ];
    let safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'caseId';
    let safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Custom sorting logic based on status filter
    if (status === 'COMPLETED' && !sortBy) {
      // For completed cases: sort by completion time descending (most recently completed first)
      safeSortBy = 'completedAt';
      safeSortOrder = 'DESC';
    } else if (status === 'IN_PROGRESS' && !sortBy) {
      // For in progress cases: sort by in progress duration descending (longest in progress first)
      safeSortBy = 'pendingDuration';
      safeSortOrder = 'DESC';
    } else if (status === 'PENDING' && !sortBy) {
      // For pending cases: sort by pending duration descending (longest pending first)
      safeSortBy = 'pendingDuration';
      safeSortOrder = 'DESC';
    } else if (!sortBy) {
      // For all cases: sort by case ID descending (newest cases first)
      safeSortBy = 'caseId';
      safeSortOrder = 'DESC';
    }

    // Calculate offset
    const offset = (Number(page) - 1) * Number(limit);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cases c
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Enhanced query with all 13 required fields for mobile app and custom sorting
    let orderByClause;
    if (safeSortBy === 'pendingDuration') {
      // Calculate pending duration for sorting (time since creation or last assignment)
      orderByClause = `
        ORDER BY
          CASE
            WHEN c.status IN ('PENDING', 'IN_PROGRESS') THEN
              COALESCE(
                EXTRACT(EPOCH FROM (NOW() - (
                  SELECT MAX(cah."assignedAt")
                  FROM case_assignment_history cah
                  WHERE cah.case_id = c.id
                ))),
                EXTRACT(EPOCH FROM (NOW() - c."createdAt"))
              )
            ELSE 0
          END ${safeSortOrder}
      `;
    } else {
      orderByClause = `ORDER BY c."${typeof safeSortBy === 'string' || typeof safeSortBy === 'number' ? String(safeSortBy) : 'createdAt'}" ${safeSortOrder}`;
    }

    const casesQuery = `
      SELECT
        c.*,
        -- Get representative address from tasks (since address is not in cases table anymore)
        (SELECT address FROM verification_tasks WHERE case_id = c.id LIMIT 1) as address,
        -- Client information (Field 3: Client)
        cl.name as "clientName",
        cl.code as "clientCode",
        -- Product information (Field 4: Product)
        p.name as "productName",
        p.code as "productCode",
        -- Verification type information (Field 5: Verification Type)
        vt.name as "verificationTypeName",
        vt.code as "verificationTypeCode",
        -- Rate type information (for Area and Rate Type columns)
        rt.name as "rateTypeName",
        rt.description as "rateTypeDescription",
        -- Area information derived from rate type (local/ogl classification)
        CASE
          WHEN LOWER(rt.name) = 'ogl' OR LOWER(rt.name) LIKE 'ogl%' OR LOWER(rt.description) LIKE '%out of geo%' THEN 'ogl'
          WHEN LOWER(rt.name) = 'local' OR LOWER(rt.name) LIKE 'local%' OR (LOWER(rt.description) LIKE '%local%' AND LOWER(rt.description) NOT LIKE '%out of geo%') THEN 'local'
          WHEN LOWER(rt.name) LIKE '%outstation%' OR LOWER(rt.description) LIKE '%outstation%' THEN 'outstation'
          ELSE 'standard'
        END as "areaType",
        -- Created by backend user information (Field 7: Created By Backend User)
        created_user.name as "createdByBackendUserName",
        created_user.email as "createdByBackendUserEmail",
        -- Calculate pending/in-progress duration for frontend display (based on case creation time)
        CASE
          WHEN c.status IN ('PENDING', 'IN_PROGRESS') THEN
            EXTRACT(EPOCH FROM (NOW() - c."createdAt"))
          ELSE NULL
        END as "pendingDurationSeconds",
        -- NEW: Verification task statistics for multi-task architecture
        COALESCE(task_stats.total_tasks, 0) as "totalTasks",
        COALESCE(task_stats.completed_tasks, 0) as "completedTasks",
        COALESCE(task_stats.pending_tasks, 0) as "pendingTasks",
        COALESCE(task_stats.in_progress_tasks, 0) as "inProgressTasks",
        COALESCE(task_stats.revisit_tasks, 0) as "revisitTasks"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users created_user ON c."createdByBackendUser" = created_user.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN "rateTypes" rt ON c."rateTypeId" = rt.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_tasks,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending_tasks,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_tasks,
          COUNT(*) FILTER (WHERE task_type = 'REVISIT') as revisit_tasks
        FROM verification_tasks
        WHERE case_id = c.id
      ) task_stats ON true
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(Number(limit), offset);

    // Execute query with performance monitoring
    const queryStartTime = Date.now();
    const casesResult = await pool.query(casesQuery, params);
    const queryTime = Date.now() - queryStartTime;

    // Calculate pagination info
    const totalPages = Math.ceil(total / Number(limit));

    // Transform data to match frontend expectations
    const transformedData = casesResult.rows.map((row: CaseRow & Record<string, unknown>) => ({
      ...row,
      // Provide flat fields for frontend compatibility
      clientName: row.clientName,
      clientCode: row.clientCode,
      productName: row.productName,
      productCode: row.productCode,
      // Transform task statistics (ensure proper field names)
      totalTasks: row.totalTasks || 0,
      completedTasks: row.completedTasks || 0,
      pendingTasks: row.pendingTasks || 0,
      inProgressTasks: row.inProgressTasks || 0,
      revisitTasks: row.revisitTasks || 0,
      // Transform client data to nested object
      client: row.clientName
        ? {
            id: row.clientId,
            name: row.clientName,
            code: row.clientCode,
          }
        : null,
      // Transform assigned user data to nested object
      assignedTo: row.assignedToName
        ? {
            id: row.assignedTo,
            name: row.assignedToName,
            username: row.assignedToEmail,
            employeeId: row.assignedToEmail,
          }
        : null,
      // Transform product data to nested object
      product: row.productName
        ? {
            id: row.productId,
            name: row.productName,
            code: row.productCode,
          }
        : null,
      // Transform created by backend user data to nested object
      createdByBackendUser: row.createdByBackendUserName
        ? {
            id: row.createdByBackendUser,
            name: row.createdByBackendUserName,
            employeeId: row.createdByBackendUserEmail,
          }
        : null,
    }));

    const response = {
      success: true,
      data: transformedData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
      },
      metadata: {
        queryTime,
        totalResponseTime: Date.now() - startTime,
        cached: false,
        resultCount: casesResult.rows.length,
      },
      message: 'Cases retrieved successfully',
    };

    // Cache the response for future requests (1 minute TTL for high-frequency data)
    if (useCache === 'true') {
      EnterpriseCacheService.set(cacheKey, response, 60).catch(error =>
        logger.error('Failed to cache cases response:', error)
      );
    }

    // Add performance headers
    res.set({
      'X-Cache': 'MISS',
      'X-Query-Time': queryTime.toString(),
      'X-Total-Time': (Date.now() - startTime).toString(),
      'X-Result-Count': casesResult.rows.length.toString(),
    });

    logger.info('Cases retrieved', {
      userId: req.user?.id,
      role: req.user?.role,
      page,
      limit,
      total,
      queryTime,
      totalTime: Date.now() - startTime,
    });

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cases',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/cases/:id - Get case by ID
export const getCaseById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? String(rawId[0]) : String(rawId || '');
    logger.info(`getCaseById called with id: ${id}`);

    // Check if id is numeric (caseId) or UUID (id)
    const isNumeric = /^\d+$/.test(id);

    // Role-based access control
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Build query with role-based filtering
    let caseQuery = `
      SELECT
        c.*,
        -- Get representative address from tasks
        (SELECT address FROM verification_tasks WHERE case_id = c.id LIMIT 1) as address,
        -- Client information (Field 3: Client)
        cl.name as "clientName",
        cl.code as "clientCode",
        -- Product information (Field 4: Product)
        p.name as "productName",
        p.code as "productCode",
        -- Verification type information (Field 5: Verification Type)
        vt.name as "verificationTypeName",
        vt.code as "verificationTypeCode",
        -- Rate type information (for Area and Rate Type columns)
        rt.name as "rateTypeName",
        rt.description as "rateTypeDescription",
        -- Area information derived from rate type (local/ogl classification)
        CASE
          WHEN LOWER(rt.name) = 'ogl' OR LOWER(rt.name) LIKE 'ogl%' OR LOWER(rt.description) LIKE '%out of geo%' THEN 'ogl'
          WHEN LOWER(rt.name) = 'local' OR LOWER(rt.name) LIKE 'local%' OR (LOWER(rt.description) LIKE '%local%' AND LOWER(rt.description) NOT LIKE '%out of geo%') THEN 'local'
          WHEN LOWER(rt.name) LIKE '%outstation%' OR LOWER(rt.description) LIKE '%outstation%' THEN 'outstation'
          ELSE 'standard'
        END as "areaType",
        -- Created by backend user information (Field 7: Created By Backend User)
        created_user.name as "createdByBackendUserName",
        created_user.email as "createdByBackendUserEmail",
        -- Verification task statistics
        COALESCE(task_stats.total_tasks, 0) as "totalTasks",
        COALESCE(task_stats.completed_tasks, 0) as "completedTasks",
        COALESCE(task_stats.pending_tasks, 0) as "pendingTasks",
        COALESCE(task_stats.in_progress_tasks, 0) as "inProgressTasks",
        COALESCE(task_stats.revisit_tasks, 0) as "revisitTasks"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users created_user ON c."createdByBackendUser" = created_user.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN "rateTypes" rt ON c."rateTypeId" = rt.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_tasks,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending_tasks,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_tasks,
          COUNT(*) FILTER (WHERE task_type = 'REVISIT') as revisit_tasks
        FROM verification_tasks
        WHERE case_id = c.id
      ) task_stats ON true
      WHERE ${isNumeric ? 'c."caseId" = $1' : 'c.id = $1'}
    `;

    const queryParams: QueryParams = [isNumeric ? parseInt(id) : id];

    // Add role-based filtering for FIELD_AGENT - filter by task-level assignment AND pincode/area
    if (userRole === Role.FIELD_AGENT) {
      const { getAssignedPincodeIds } = await import('@/middleware/pincodeAccess');
      const { getAssignedAreaIds } = await import('@/middleware/areaAccess');

      const assignedPincodeIds = await getAssignedPincodeIds(userId, userRole);
      const assignedAreaIds = await getAssignedAreaIds(userId, userRole);

      // Build complex filter: (assigned to task) OR (task in assigned pincode/area)
      const fieldAgentConditions: string[] = [];
      let paramIndex = queryParams.length + 1;

      // Condition 1: Directly assigned to a task
      fieldAgentConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
        AND vt.assigned_to = $${paramIndex}
      )`);
      queryParams.push(userId);
      paramIndex++;

      // Condition 2: Task in assigned pincode
      if (assignedPincodeIds && assignedPincodeIds.length > 0) {
        fieldAgentConditions.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.pincode_id = ANY($${paramIndex}::int[])
        )`);
        queryParams.push(assignedPincodeIds);
        paramIndex++;
      }

      // Condition 3: Task in assigned area
      if (assignedAreaIds && assignedAreaIds.length > 0) {
        fieldAgentConditions.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.area_id = ANY($${paramIndex}::int[])
        )`);
        queryParams.push(assignedAreaIds);
        paramIndex++;
      }

      // Apply the combined filter
      if (fieldAgentConditions.length > 0) {
        caseQuery += ` AND (${fieldAgentConditions.join(' OR ')})`;
      } else {
        // No assignments, deny access
        return res.status(403).json({
          success: false,
          message: 'Access denied: No territory assignments found for your account',
          error: { code: 'NO_TERRITORY_ACCESS' },
        });
      }
    } else if (userRole === Role.BACKEND_USER) {
      // Filter by client and product assignments for BACKEND_USER
      const { getAssignedClientIds } = await import('@/middleware/clientAccess');
      const { getAssignedProductIds } = await import('@/middleware/productAccess');

      const assignedClientIds = await getAssignedClientIds(userId, userRole);
      const assignedProductIds = await getAssignedProductIds(userId, userRole);

      // Check if user has access to this case's client and product
      if (assignedClientIds && assignedClientIds.length > 0) {
        caseQuery += ` AND c."clientId" = ANY($${queryParams.length + 1}::int[])`;
        queryParams.push(assignedClientIds);
      } else if (assignedClientIds && assignedClientIds.length === 0) {
        // User has no client assignments, deny access
        return res.status(403).json({
          success: false,
          message: 'Access denied: No clients assigned to your account',
          error: { code: 'NO_CLIENT_ACCESS' },
        });
      }

      if (assignedProductIds && assignedProductIds.length > 0) {
        caseQuery += ` AND c."productId" = ANY($${queryParams.length + 1}::int[])`;
        queryParams.push(assignedProductIds);
      } else if (assignedProductIds && assignedProductIds.length === 0) {
        // User has no product assignments, deny access
        return res.status(403).json({
          success: false,
          message: 'Access denied: No products assigned to your account',
          error: { code: 'NO_PRODUCT_ACCESS' },
        });
      }
    }

    const result = await pool.query(caseQuery, queryParams);

    if (result.rows.length === 0) {
      const message =
        userRole === Role.FIELD_AGENT
          ? 'Case not found or access denied. You can only view cases assigned to you.'
          : 'Case not found';

      return res.status(404).json({
        success: false,
        message,
        error: { code: 'NOT_FOUND' },
      });
    }

    // Transform data to match frontend expectations
    const row = result.rows[0];
    const transformedData = {
      ...row,
      // Provide flat fields for frontend compatibility
      clientName: row.clientName,
      clientCode: row.clientCode,
      assignedToName: row.assignedToName,
      productName: row.productName,
      productCode: row.productCode,
      // Task statistics
      totalTasks: row.totalTasks || 0,
      completedTasks: row.completedTasks || 0,
      pendingTasks: row.pendingTasks || 0,
      inProgressTasks: row.inProgressTasks || 0,
      revisitTasks: row.revisitTasks || 0,
      // Transform client data to nested object
      client: row.clientName
        ? {
            id: row.clientId,
            name: row.clientName,
            code: row.clientCode,
          }
        : null,
      // Transform assigned user data to nested object
      assignedTo: row.assignedToName
        ? {
            id: row.assignedTo,
            name: row.assignedToName,
            username: row.assignedToEmail,
            employeeId: row.assignedToEmail,
          }
        : null,
      // Transform product data to nested object
      product: row.productName
        ? {
            id: row.productId,
            name: row.productName,
            code: row.productCode,
          }
        : null,
      // Transform created by backend user data to nested object
      createdByBackendUser: row.createdByBackendUserName
        ? {
            id: row.createdByBackendUser,
            name: row.createdByBackendUserName,
            employeeId: row.createdByBackendUserEmail,
          }
        : null,
    };

    logger.info('Case retrieved', {
      userId: req.user?.id,
      caseId: id,
    });

    res.json({
      success: true,
      data: transformedData,
      message: 'Case retrieved successfully',
    });
  } catch (error) {
    logger.error('Error retrieving case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve case',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/cases - Create new case (OLD - REMOVED)
// Replaced by unified createCase endpoint at the end of this file

// PUT /api/cases/:id - Update case
export const updateCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? String(rawId[0]) : String(rawId || '');
    const {
      customerName,
      customerPhone,
      customerCallingCode,
      clientId,
      productId,
      verificationTypeId,
      pincode,
      priority,
      trigger,
      applicantType,
      backendContactNumber,
      assignedToId, // Task-level field
      rateTypeId, // Task-level field
      address, // Task-level field
      taskId, // ✅ Specific task ID to update
    } = req.body;

    logger.info('🔍 updateCase called', {
      caseId: id,
      taskId,
      userId: req.user?.id,
      receivedFields: {
        assignedToId,
        rateTypeId,
        address,
        customerName,
        clientId,
        productId,
      },
    });

    // Build dynamic update query for cases table
    const updateFields: string[] = [];
    const values: QueryParams = [];
    let paramIndex = 1;

    if (customerName !== undefined) {
      updateFields.push(`"customerName" = $${paramIndex}`);
      values.push(customerName);
      paramIndex++;
    }
    if (customerPhone !== undefined) {
      updateFields.push(`"customerPhone" = $${paramIndex}`);
      values.push(customerPhone);
      paramIndex++;
    }
    if (customerCallingCode !== undefined) {
      updateFields.push(`"customerCallingCode" = $${paramIndex}`);
      values.push(customerCallingCode);
      paramIndex++;
    }
    if (clientId !== undefined) {
      updateFields.push(`"clientId" = $${paramIndex}`);
      values.push(clientId);
      paramIndex++;
    }
    if (productId !== undefined) {
      updateFields.push(`"productId" = $${paramIndex}`);
      values.push(productId);
      paramIndex++;
    }
    if (verificationTypeId !== undefined) {
      updateFields.push(`"verificationTypeId" = $${paramIndex}`);
      values.push(verificationTypeId);
      paramIndex++;
    }
    if (pincode !== undefined) {
      updateFields.push(`pincode = $${paramIndex}`);
      values.push(pincode);
      paramIndex++;
    }
    if (priority !== undefined) {
      updateFields.push(`priority = $${paramIndex}`);
      values.push(priority);
      paramIndex++;
    }
    if (trigger !== undefined) {
      updateFields.push(`trigger = $${paramIndex}`);
      values.push(trigger);
      paramIndex++;
    }
    if (applicantType !== undefined) {
      updateFields.push(`"applicantType" = $${paramIndex}`);
      values.push(applicantType);
      paramIndex++;
    }
    if (backendContactNumber !== undefined) {
      updateFields.push(`"backendContactNumber" = $${paramIndex}`);
      values.push(backendContactNumber);
      paramIndex++;
    }

    if (updateFields.length === 0 && !assignedToId && !rateTypeId && !address) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
        error: { code: 'NO_UPDATE_FIELDS' },
      });
    }

    // Update cases table if there are case-level fields
    if (updateFields.length > 0) {
      // Always update the updatedAt timestamp
      updateFields.push(`"updatedAt" = NOW()`);

      // Add case ID as the last parameter (UUID, not numeric caseId)
      values.push(id);

      const updateQuery = `
        UPDATE cases
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      logger.info('📝 Executing cases table update', {
        query: updateQuery,
        values: values.map((v, i) => `$${i + 1} = ${String(v)}`),
      });

      const result = await pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'NOT_FOUND' },
        });
      }
    }

    // Update verification task if task-level fields are provided
    if (assignedToId !== undefined || rateTypeId !== undefined || address !== undefined) {
      // Work Order Protection for Case-driven updates
      // If we are updating address or rateTypeId, we MUST check if the target task is locked
      if (rateTypeId !== undefined || address !== undefined) {
        const targetTaskId = taskId; // Should be provided, but might check case_id if not

        let lockCheckQuery = '';
        let lockCheckParams: (string | number)[] = [];

        if (targetTaskId) {
          lockCheckQuery = 'SELECT status, started_at FROM verification_tasks WHERE id = $1';
          lockCheckParams = [targetTaskId];
        } else {
          // If no taskId, we check ALL tasks for this case (risky, but safe default)
          lockCheckQuery = 'SELECT status, started_at FROM verification_tasks WHERE case_id = $1';
          lockCheckParams = [id]; // id is likely UUID here based on previous code, but let's be careful.
          // Actually updateCase uses `id` from params which is sometimes caseId (int) or uuid.
          // The helper above `actualCaseId` logic isn't here, updateCase relies on what it gets.
          // However, line 884 uses `id` directly.
          // Wait, casesController updateCase usually takes UUID or handles it.
          // Looking at line 879: `values.push(id)`.
        }

        const lockCheckResult = await pool.query(lockCheckQuery, lockCheckParams);

        const hasLockedTask = lockCheckResult.rows.some(
          t =>
            t.status === 'IN_PROGRESS' ||
            t.status === 'COMPLETED' ||
            t.status === 'REVOKED' ||
            t.started_at !== null
        );

        if (hasLockedTask) {
          logger.warn('⚠️ Rejected Case update due to locked operational fields', {
            caseId: id,
            taskId,
            userId: req.user?.id,
            attemptedFields: { rateTypeId, address },
          });

          return res.status(409).json({
            success: false,
            message: 'Verification already started. Task data cannot be modified.',
            error: { code: 'TASK_LOCKED' },
          });
        }
      }

      logger.info('🎯 Updating verification task', {
        caseId: id,
        taskId,
        assignedToId,
        rateTypeId,
        address,
      });

      const taskUpdateFields: string[] = [];
      const taskValues: QueryParams = [];
      let taskParamIndex = 1;

      if (assignedToId !== undefined) {
        taskUpdateFields.push(`assigned_to = $${taskParamIndex}`);
        taskValues.push(assignedToId || null);
        taskParamIndex++;

        // If assigning, update status and timestamps
        if (assignedToId) {
          taskUpdateFields.push(`status = $${taskParamIndex}`);
          taskValues.push('ASSIGNED');
          taskParamIndex++;

          taskUpdateFields.push(`assigned_at = NOW()`);
          taskUpdateFields.push(`assigned_by = $${taskParamIndex}`);
          taskValues.push(req.user?.id);
          taskParamIndex++;
        }
      }

      if (rateTypeId !== undefined) {
        taskUpdateFields.push(`rate_type_id = $${taskParamIndex}`);
        taskValues.push(rateTypeId ? parseInt(rateTypeId) : null);
        taskParamIndex++;
      }

      if (address !== undefined) {
        taskUpdateFields.push(`address = $${taskParamIndex}`);
        taskValues.push(address);
        taskParamIndex++;
      }

      if (taskUpdateFields.length > 0) {
        taskUpdateFields.push(`updated_at = NOW()`);

        // ✅ CRITICAL FIX: Use taskId if provided, otherwise fall back to case_id
        // This ensures we update the specific task being edited, not all tasks for the case
        const whereClause = taskId ? `id = $${taskParamIndex}` : `case_id = $${taskParamIndex}`;

        taskValues.push(taskId || id);

        const taskUpdateQuery = `
          UPDATE verification_tasks
          SET ${taskUpdateFields.join(', ')}
          WHERE ${whereClause}
          RETURNING *
        `;

        logger.info('📝 Executing verification_tasks table update', {
          query: taskUpdateQuery,
          values: taskValues.map((v, i) => `$${i + 1} = ${String(v)}`),
          whereClause,
          taskId,
        });

        const taskResult = await pool.query(taskUpdateQuery, taskValues);

        logger.info('✅ Verification task update result', {
          rowsAffected: taskResult.rowCount,
          updatedTask: taskResult.rows[0]
            ? {
                id: taskResult.rows[0].id,
                status: taskResult.rows[0].status,
                assigned_to: taskResult.rows[0].assigned_to,
                rate_type_id: taskResult.rows[0].rate_type_id,
              }
            : null,
        });
      }
    }

    logger.info('✅ Case and task updated successfully', {
      userId: req.user?.id,
      caseId: id,
      taskId,
      updatedCaseFields: updateFields.filter(field => !field.includes('updatedAt')),
      updatedTaskFields: { assignedToId, rateTypeId, address },
    });

    res.json({
      success: true,
      data: { id },
      message: 'Case updated successfully',
    });
  } catch (error) {
    logger.error('❌ Error updating case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update case',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const assignCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? String(rawId[0]) : String(rawId || '');
    const { assignedToId, reason } = req.body;

    // Import the service here to avoid circular dependencies
    const { CaseAssignmentService } = await import('../services/caseAssignmentService');

    // Use the queue-based assignment service
    const result = await CaseAssignmentService.assignCase({
      caseId: id,
      assignedToId,
      assignedById: req.user?.id,
      reason,
      priority: 'MEDIUM',
    });

    logger.info('Case assignment queued', {
      userId: req.user?.id,
      caseId: id,
      assignedTo: assignedToId,
      jobId: result.jobId,
    });

    res.json({
      success: true,
      data: { jobId: result.jobId },
      message: 'Case assignment queued successfully',
    });
  } catch (error) {
    logger.error('Error queueing case assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to queue case assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/cases/bulk/assign - Bulk assign cases to a field agent
export const bulkAssignCases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseIds, assignedToId, reason, priority } = req.body;

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Case IDs array is required and cannot be empty',
        error: { code: 'INVALID_CASE_IDS' },
      });
    }

    if (!assignedToId) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user ID is required',
        error: { code: 'MISSING_ASSIGNED_TO' },
      });
    }

    // Import the service here to avoid circular dependencies
    const { CaseAssignmentService } = await import('../services/caseAssignmentService');

    // Use the queue-based bulk assignment service
    const result = await CaseAssignmentService.bulkAssignCases({
      caseIds,
      assignedToId,
      assignedById: req.user?.id,
      reason,
      priority: priority || 'MEDIUM',
    });

    logger.info('Bulk case assignment queued', {
      userId: req.user?.id,
      totalCases: caseIds.length,
      assignedTo: assignedToId,
      batchId: result.batchId,
      jobId: result.jobId,
    });

    res.json({
      success: true,
      data: {
        batchId: result.batchId,
        jobId: result.jobId,
        totalCases: caseIds.length,
      },
      message: 'Bulk case assignment queued successfully',
    });
  } catch (error) {
    logger.error('Error queueing bulk case assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to queue bulk case assignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/cases/bulk/assign/:batchId/status - Get bulk assignment status
export const getBulkAssignmentStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawBatchId = req.params.batchId;
    const batchId = Array.isArray(rawBatchId) ? String(rawBatchId[0]) : String(rawBatchId || '');

    // Import the service here to avoid circular dependencies
    const { CaseAssignmentService } = await import('../services/caseAssignmentService');

    const status = await CaseAssignmentService.getBulkAssignmentStatus(batchId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Bulk assignment batch not found',
        error: { code: 'BATCH_NOT_FOUND' },
      });
    }

    res.json({
      success: true,
      data: status,
      message: 'Bulk assignment status retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting bulk assignment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bulk assignment status',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/cases/:id/reassign - Reassign case to another field agent
export const reassignCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? String(rawId[0]) : String(rawId || '');
    const { fromUserId, toUserId, reason } = req.body;

    if (!fromUserId || !toUserId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'From user ID, to user ID, and reason are required',
        error: { code: 'MISSING_REQUIRED_FIELDS' },
      });
    }

    // Import the service here to avoid circular dependencies
    const { CaseAssignmentService } = await import('../services/caseAssignmentService');

    // Use the queue-based reassignment service
    const result = await CaseAssignmentService.reassignCase({
      caseId: id,
      fromUserId,
      toUserId,
      assignedById: req.user?.id,
      reason,
    });

    logger.info('Case reassignment queued', {
      userId: req.user?.id,
      caseId: id,
      fromUserId,
      toUserId,
      jobId: result.jobId,
    });

    res.json({
      success: true,
      data: { jobId: result.jobId },
      message: 'Case reassignment queued successfully',
    });
  } catch (error) {
    logger.error('Error queueing case reassignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to queue case reassignment',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/cases/:id/assignment-history - Get case assignment history
export const getCaseAssignmentHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? String(rawId[0]) : String(rawId || '');

    // Import the service here to avoid circular dependencies
    const { CaseAssignmentService } = await import('../services/caseAssignmentService');

    const history = await CaseAssignmentService.getCaseAssignmentHistory(id);

    res.json({
      success: true,
      data: history,
      message: 'Case assignment history retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting case assignment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get case assignment history',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/cases/analytics/field-agent-workload - Get field agent workload analytics
export const getFieldAgentWorkload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Import the service here to avoid circular dependencies
    const { CaseAssignmentService } = await import('../services/caseAssignmentService');

    const workload = await CaseAssignmentService.getFieldAgentWorkload();

    res.json({
      success: true,
      data: workload,
      message: 'Field agent workload retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting field agent workload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get field agent workload',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/cases/with-attachments - Create case with attachments (OLD - REMOVED)
// Replaced by unified createCase endpoint at the end of this file

// Export cases to Excel
export const exportCases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      status,
      search,
      assignedTo,
      clientId,
      productId,
      verificationTypeId,
      stateId,
      cityId,
      pincodeId,
      priority,
      dateFrom,
      dateTo,
      exportType = 'all', // 'all', 'pending', 'in-progress', 'completed'
    } = req.query;

    // Build the query based on filters
    const whereConditions: string[] = [];
    const queryParams: QueryParams = [];
    let paramIndex = 1;

    // Filter by export type (status)
    if (exportType && exportType !== 'all') {
      if (exportType === 'pending') {
        whereConditions.push(`c.status IN ('PENDING', 'IN_PROGRESS')`);
      } else if (exportType === 'in-progress') {
        whereConditions.push(`c.status = 'IN_PROGRESS'`);
      } else if (exportType === 'completed') {
        whereConditions.push(`c.status = 'COMPLETED'`);
      }
    }

    // Additional filters
    if (status && status !== 'all') {
      whereConditions.push(`c.status = $${paramIndex}`);
      queryParams.push(status as string);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        c."customerName" ILIKE $${paramIndex} OR
        c."customerPhone" ILIKE $${paramIndex} OR
        c."caseId"::text ILIKE $${paramIndex}
      )`);
      queryParams.push(
        `%${typeof search === 'string' || typeof search === 'number' ? String(search) : ''}%`
      );
      paramIndex++;
    }

    if (assignedTo) {
      whereConditions.push(`c."assignedToId" = $${paramIndex}`);
      queryParams.push(assignedTo as string);
      paramIndex++;
    }

    if (clientId) {
      whereConditions.push(`c."clientId" = $${paramIndex}`);
      queryParams.push(clientId as string);
      paramIndex++;
    }

    if (productId) {
      whereConditions.push(`c."productId" = $${paramIndex}`);
      queryParams.push(productId as string);
      paramIndex++;
    }

    if (verificationTypeId) {
      whereConditions.push(`c."verificationTypeId" = $${paramIndex}`);
      queryParams.push(verificationTypeId as string);
      paramIndex++;
    }

    if (stateId) {
      whereConditions.push(`c."stateId" = $${paramIndex}`);
      queryParams.push(stateId as string);
      paramIndex++;
    }

    if (cityId) {
      whereConditions.push(`c."cityId" = $${paramIndex}`);
      queryParams.push(cityId as string);
      paramIndex++;
    }

    if (pincodeId) {
      whereConditions.push(`c."pincodeId" = $${paramIndex}`);
      queryParams.push(pincodeId as string);
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`c.priority = $${paramIndex}`);
      queryParams.push(priority as string);
      paramIndex++;
    }

    if (dateFrom) {
      whereConditions.push(`c."createdAt" >= $${paramIndex}`);
      queryParams.push(dateFrom as string);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`c."createdAt" <= $${paramIndex}`);
      queryParams.push(
        `${typeof dateTo === 'string' || typeof dateTo === 'number' ? String(dateTo) : new Date().toISOString().split('T')[0]} 23:59:59`
      );
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query to get cases data
    const query = `
      SELECT
        c."caseId" as case_id,
        c."customerName" as customer_name,
        c."customerPhone" as customer_phone,
        c."customerCallingCode" as customer_calling_code,
        (SELECT address FROM verification_tasks WHERE case_id = c.id LIMIT 1) as address,
        c.pincode,
        cl.name as client_name,
        cl.code as client_code,
        p.name as product_name,
        vt.name as verification_type_name,
        c.status,
        c.priority,
        c."applicantType" as applicant_type,
        c."backendContactNumber" as backend_contact_number,
        c.trigger,
        u.name as assigned_to_name,
        u."employeeId" as assigned_to_employee_id,
        bu.name as created_by_backend_user_name,
        bu."employeeId" as created_by_backend_user_employee_id,
        c."verificationOutcome" as verification_outcome,
        c."createdAt" as created_at,
        c."updatedAt" as updated_at,
        c."completedAt" as completed_at,
        CASE
          WHEN c.status = 'PENDING' OR c.status = 'IN_PROGRESS' THEN
            EXTRACT(EPOCH FROM (NOW() - c."createdAt"))
          ELSE NULL
        END as pending_duration_seconds
      FROM cases c
      LEFT JOIN clients cl ON c."client" = cl.name
      LEFT JOIN products p ON c."product" = p.name
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN users u ON c."assignedTo" = u.id
      LEFT JOIN users bu ON c."createdByBackendUser" = bu.id
      ${whereClause}
      ORDER BY c."caseId" DESC
    `;

    const result = await pool.query(query, queryParams);
    const cases = result.rows;

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CRM System';
    workbook.created = new Date();

    // Create worksheet
    const worksheet = workbook.addWorksheet(
      `Cases Export - ${typeof exportType === 'string' || typeof exportType === 'number' ? String(exportType) : 'All'}`
    );

    // Define columns based on export type
    const baseColumns = [
      { header: 'Case ID', key: 'case_id', width: 12 },
      { header: 'Customer Name', key: 'customer_name', width: 25 },
      { header: 'Customer Phone', key: 'customer_phone', width: 15 },
      { header: 'Client', key: 'client_name', width: 20 },
      { header: 'Product', key: 'product_name', width: 20 },
      { header: 'Verification Type', key: 'verification_type_name', width: 25 },
      { header: 'Area', key: 'area_type', width: 15 },
      { header: 'Rate Type', key: 'rate_type_name', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Assigned To', key: 'assigned_to_name', width: 20 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Pincode', key: 'pincode', width: 10 },
      { header: 'Created At', key: 'created_at', width: 20 },
      { header: 'Updated At', key: 'updated_at', width: 20 },
    ];

    // Add specific columns based on export type
    if (exportType === 'completed') {
      baseColumns.push(
        { header: 'Completed At', key: 'completed_at', width: 20 },
        { header: 'Verification Outcome', key: 'verification_outcome', width: 20 },
        { header: 'Assigned By Backend User', key: 'created_by_backend_user_name', width: 25 }
      );
    } else if (exportType === 'pending' || exportType === 'in-progress') {
      baseColumns.push(
        { header: 'Pending Duration (Hours)', key: 'pending_duration_hours', width: 20 },
        { header: 'Assigned By Backend User', key: 'created_by_backend_user_name', width: 25 }
      );
    } else {
      // For 'all' cases, include all columns
      baseColumns.push(
        { header: 'Completed At', key: 'completed_at', width: 20 },
        { header: 'Verification Outcome', key: 'verification_outcome', width: 20 },
        { header: 'Pending Duration (Hours)', key: 'pending_duration_hours', width: 20 },
        { header: 'Assigned By Backend User', key: 'created_by_backend_user_name', width: 25 }
      );
    }

    worksheet.columns = baseColumns;

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' },
    };

    // Add data rows
    // Add data rows
    cases.forEach((caseItem: Record<string, unknown>) => {
      const rowData: Record<string, unknown> = {
        case_id: caseItem.case_id,
        customer_name: caseItem.customer_name,
        customer_phone: caseItem.customer_phone,
        client_name: caseItem.client_name,
        product_name: caseItem.product_name,
        verification_type_name: caseItem.verification_type_name,
        status: caseItem.status,
        priority: caseItem.priority,
        assigned_to_name: caseItem.assigned_to_name || 'Unassigned',
        address: caseItem.address,
        pincode: caseItem.pincode,
        created_at: caseItem.created_at
          ? new Date(caseItem.created_at as string).toLocaleString()
          : '',
        updated_at: caseItem.updated_at
          ? new Date(caseItem.updated_at as string).toLocaleString()
          : '',
        completed_at: caseItem.completed_at
          ? new Date(caseItem.completed_at as string).toLocaleString()
          : '',
        verification_outcome: caseItem.verification_outcome || '',
        created_by_backend_user_name: caseItem.created_by_backend_user_name || 'Unknown',
        pending_duration_hours: caseItem.pending_duration_seconds
          ? Math.round(((caseItem.pending_duration_seconds as number) / 3600) * 100) / 100
          : '',
      };

      worksheet.addRow(rowData);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength =
            cell.value && (typeof cell.value === 'string' || typeof cell.value === 'number')
              ? cell.value.toString().length
              : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength;
      }
    });

    // Generate filename with tab name and timestamp
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

    // Map export type to readable tab name
    const tabNameMap: { [key: string]: string } = {
      all: 'All_Cases',
      pending: 'Pending_Cases',
      'in-progress': 'In_Progress_Cases',
      completed: 'Completed_Cases',
    };

    const tabName = tabNameMap[exportType as string] || 'All_Cases';
    const filename = `${tabName}_Export_${dateStr}_${timeStr}.xlsx`;

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    logger.info(`Cases exported successfully: ${filename}, ${cases.length} records`);
  } catch (error) {
    logger.error('Error exporting cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export cases',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

// =====================================================
// ENHANCED MULTI-VERIFICATION CASE CREATION
// =====================================================

/**
 * Create case with multiple verification tasks (OLD - REMOVED)
 * Replaced by unified createCase endpoint below
 */

/**
 * Get case summary with verification tasks
 * GET /api/cases/:caseId/summary
 */
export const getCaseSummaryWithTasks = async (req: AuthenticatedRequest, res: Response) => {
  const rawCaseId = req.params.caseId;
  const caseId = Array.isArray(rawCaseId) ? String(rawCaseId[0]) : String(rawCaseId || '');

  try {
    // Get case information
    const caseResult = await pool.query(
      `
      SELECT
        c.*,
        cl.name as client_name,
        p.name as product_name,
        u.name as created_by_name
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN users u ON c."createdByBackendUser" = u.id
      WHERE c.id = $1
    `,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'CASE_NOT_FOUND' },
      });
    }

    const caseInfo = caseResult.rows[0];

    // Get task summary
    const taskSummaryResult = await pool.query(
      `
      SELECT
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN status = 'ASSIGNED' THEN 1 END) as assigned_tasks,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'REVOKED' THEN 1 END) as revoked_tasks,
        COUNT(CASE WHEN status = 'ON_HOLD' THEN 1 END) as on_hold_tasks
      FROM verification_tasks
      WHERE case_id = $1
    `,
      [caseId]
    );

    const taskSummary = taskSummaryResult.rows[0];

    // Get financial summary
    const financialSummaryResult = await pool.query(
      `
      SELECT
        COALESCE(SUM(estimated_amount), 0) as total_estimated_amount,
        COALESCE(SUM(actual_amount), 0) as total_actual_amount,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN actual_amount ELSE 0 END), 0) as completed_amount,
        COALESCE(SUM(CASE WHEN status != 'COMPLETED' AND status != 'REVOKED' THEN estimated_amount ELSE 0 END), 0) as pending_amount
      FROM verification_tasks
      WHERE case_id = $1
    `,
      [caseId]
    );

    const financialSummary = financialSummaryResult.rows[0];

    // Get commission summary
    const commissionSummaryResult = await pool.query(
      `
      SELECT
        COALESCE(SUM(calculated_commission), 0) as total_commission,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN calculated_commission ELSE 0 END), 0) as paid_commission,
        COALESCE(SUM(CASE WHEN status = 'PENDING' OR status = 'CALCULATED' OR status = 'APPROVED' THEN calculated_commission ELSE 0 END), 0) as pending_commission
      FROM task_commission_calculations
      WHERE case_id = $1
    `,
      [caseId]
    );

    const commissionSummary = commissionSummaryResult.rows[0];

    // Get recent activities
    const recentActivitiesResult = await pool.query(
      `
      SELECT
        'TASK_CREATED' as type,
        vt.id as task_id,
        vt.task_title,
        u.name as user_name,
        vt.created_at as timestamp,
        NULL as details
      FROM verification_tasks vt
      LEFT JOIN users u ON vt.created_by = u.id
      WHERE vt.case_id = $1

      UNION ALL

      SELECT
        'TASK_ASSIGNED' as type,
        tah.verification_task_id as task_id,
        vt.task_title,
        u.name as user_name,
        tah.assigned_at as timestamp,
        json_build_object('assigned_to', u_assigned.name, 'reason', tah.assignment_reason) as details
      FROM task_assignment_history tah
      JOIN verification_tasks vt ON tah.verification_task_id = vt.id
      LEFT JOIN users u ON tah.assigned_by = u.id
      LEFT JOIN users u_assigned ON tah.assigned_to = u_assigned.id
      WHERE tah.case_id = $1

      UNION ALL

      SELECT
        'TASK_COMPLETED' as type,
        vt.id as task_id,
        vt.task_title,
        u.name as user_name,
        vt.completed_at as timestamp,
        json_build_object('outcome', vt.verification_outcome, 'amount', vt.actual_amount) as details
      FROM verification_tasks vt
      LEFT JOIN users u ON vt.assigned_to = u.id
      WHERE vt.case_id = $1 AND vt.status = 'COMPLETED'

      ORDER BY timestamp DESC
      LIMIT 10
    `,
      [caseId]
    );

    res.json({
      success: true,
      data: {
        case: {
          id: caseInfo.id,
          case_number: caseInfo.caseId,
          customer_name: caseInfo.customerName,
          customer_phone: caseInfo.customerPhone,
          customer_email: caseInfo.customerEmail,
          client_name: caseInfo.client_name,
          product_name: caseInfo.product_name,
          status: caseInfo.status,
          priority: caseInfo.priority,
          address: caseInfo.address,
          pincode: caseInfo.pincode,
          has_multiple_tasks: caseInfo.has_multiple_tasks,
          total_tasks_count: parseInt(caseInfo.total_tasks_count || '0'),
          completed_tasks_count: parseInt(caseInfo.completed_tasks_count || '0'),
          case_completion_percentage: parseFloat(caseInfo.case_completion_percentage || '0'),
          created_at: caseInfo.createdAt,
          created_by_name: caseInfo.created_by_name,
        },
        task_summary: {
          total_tasks: parseInt(taskSummary.total_tasks),
          pending_tasks: parseInt(taskSummary.pending_tasks),
          assigned_tasks: parseInt(taskSummary.assigned_tasks),
          in_progress_tasks: parseInt(taskSummary.in_progress_tasks),
          completed_tasks: parseInt(taskSummary.completed_tasks),
          cancelled_tasks: parseInt(taskSummary.cancelled_tasks),
          on_hold_tasks: parseInt(taskSummary.on_hold_tasks),
        },
        financial_summary: {
          total_estimated_amount: parseFloat(financialSummary.total_estimated_amount),
          total_actual_amount: parseFloat(financialSummary.total_actual_amount),
          completed_amount: parseFloat(financialSummary.completed_amount),
          pending_amount: parseFloat(financialSummary.pending_amount),
          total_commission: parseFloat(commissionSummary.total_commission),
          paid_commission: parseFloat(commissionSummary.paid_commission),
          pending_commission: parseFloat(commissionSummary.pending_commission),
        },
        recent_activities: recentActivitiesResult.rows,
      },
      message: 'Case summary retrieved successfully',
    });
  } catch (error) {
    logger.error('Error getting case summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get case summary',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// ============================================================================
// UNIFIED CASE CREATION ENDPOINT - PRODUCTION READY
// ============================================================================

/**
 * POST /api/cases/create - Unified case creation endpoint
 * Handles all scenarios: single/multi-task, with/without attachments
 *
 * PRODUCTION FEATURES:
 * - Handles 500+ concurrent requests
 * - Automatic retry on transient failures
 * - Comprehensive error handling
 * - File cleanup on all error paths
 * - Connection timeout protection
 * - Memory-efficient processing
 * - Detailed logging for debugging
 */
export const createCase = [
  uploadForCaseCreation.array('attachments', 15),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;
    const uploadedFiles: Express.Multer.File[] = (req.files as Express.Multer.File[]) || [];
    const startTime = Date.now();

    // Helper function to cleanup uploaded files
    const cleanupFiles = async () => {
      if (uploadedFiles && uploadedFiles.length > 0) {
        try {
          const tempDir = path.dirname(uploadedFiles[0].path);
          if (fs.existsSync(tempDir) && tempDir.includes('temp')) {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
            logger.debug('Cleaned up temp files', { tempDir, fileCount: uploadedFiles.length });
          }
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp files:', { error: cleanupError });
        }
      }
    };

    try {
      // ========== ACQUIRE DATABASE CONNECTION WITH TIMEOUT ==========
      const connectionTimeout = setTimeout(() => {
        logger.error('Database connection timeout', { userId: req.user?.id });
      }, 5000); // 5 second warning

      try {
        client = await pool.connect();
        clearTimeout(connectionTimeout);
      } catch (connError: unknown) {
        clearTimeout(connectionTimeout);
        const err = connError as DatabaseError;
        logger.error('Failed to acquire database connection:', {
          error: err.message,
          code: err.code,
          userId: req.user?.id,
        });
        await cleanupFiles();
        return res.status(503).json({
          success: false,
          message: 'Database connection unavailable. Please try again.',
          error: { code: 'DB_CONNECTION_ERROR' },
        });
      }

      // Set statement timeout to prevent long-running queries
      await client.query('SET statement_timeout = 30000'); // 30 seconds

      await client.query('BEGIN');

      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        await client.query('ROLLBACK');
        await cleanupFiles();
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      // ========== PARSE AND VALIDATE REQUEST DATA ==========
      let requestData: CreateCaseRequest;
      try {
        if (req.body.data) {
          // FormData format (with file uploads)
          requestData = JSON.parse(req.body.data);
        } else {
          // JSON format (no file uploads)
          requestData = req.body as CreateCaseRequest;
        }

        // Log the parsed request data for debugging
        logger.info('Case creation request received:', {
          userId,
          hasFormData: !!req.body.data,
          caseDetailsKeys: requestData.case_details ? Object.keys(requestData.case_details) : [],
          tasksCount: requestData.verification_tasks?.length || 0,
          firstTaskKeys: requestData.verification_tasks?.[0]
            ? Object.keys(requestData.verification_tasks[0])
            : [],
        });
      } catch (parseError: unknown) {
        await client.query('ROLLBACK');
        await cleanupFiles();
        const err = parseError as DatabaseError;
        logger.error('Failed to parse request data:', {
          error: err.message,
          userId,
          bodyKeys: Object.keys(req.body),
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid request format',
          error: { code: 'INVALID_JSON' },
        });
      }

      const { case_details: caseDetails, verification_tasks: verificationTasks } = requestData;

      // ========== COMPREHENSIVE VALIDATION ==========

      // Validate case_details
      if (!caseDetails || typeof caseDetails !== 'object') {
        await client.query('ROLLBACK');
        await cleanupFiles();
        return res.status(400).json({
          success: false,
          message: 'case_details is required and must be an object',
          error: { code: 'VALIDATION_ERROR', field: 'case_details' },
        });
      }

      // Validate verification_tasks
      if (
        !verificationTasks ||
        !Array.isArray(verificationTasks) ||
        verificationTasks.length === 0
      ) {
        await client.query('ROLLBACK');
        await cleanupFiles();
        return res.status(400).json({
          success: false,
          message: 'At least one verification task is required',
          error: { code: 'VALIDATION_ERROR', field: 'verification_tasks' },
        });
      }

      // Limit maximum tasks per case to prevent abuse
      if (verificationTasks.length > 50) {
        await client.query('ROLLBACK');
        await cleanupFiles();
        return res.status(400).json({
          success: false,
          message: 'Maximum 50 tasks allowed per case',
          error: { code: 'VALIDATION_ERROR', field: 'verification_tasks', max: 50 },
        });
      }

      const {
        customerName,
        customerPhone,
        customerCallingCode = '+91',
        clientId,
        productId,
        backendContactNumber,
        priority = 'MEDIUM',
        pincode,
        deduplicationDecision: _deduplicationDecision,
        deduplicationRationale: _deduplicationRationale,
        panNumber: _panNumber,
      } = caseDetails;

      // Validate required fields with specific error messages
      const validationErrors: string[] = [];

      if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
        validationErrors.push('customerName is required and must be a non-empty string');
      }

      // customerPhone is optional - only validate if provided
      if (
        customerPhone !== undefined &&
        customerPhone !== null &&
        typeof customerPhone === 'string' &&
        customerPhone.trim().length > 0
      ) {
        // Validate phone format if provided
        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
          validationErrors.push('customerPhone must be at least 10 digits if provided');
        }
      }

      if (!clientId) {
        validationErrors.push('clientId is required');
      }

      if (!productId) {
        validationErrors.push('productId is required');
      }

      // Validate priority value
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (priority && !validPriorities.includes(priority)) {
        validationErrors.push(`priority must be one of: ${validPriorities.join(', ')}`);
      }

      if (validationErrors.length > 0) {
        await client.query('ROLLBACK');
        await cleanupFiles();
        logger.error('Case creation validation failed:', {
          userId,
          validationErrors,
          caseDetails: {
            customerName,
            customerPhone,
            clientId,
            productId,
            priority,
          },
        });
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: {
            code: 'VALIDATION_ERROR',
            details: validationErrors,
          },
        });
      }

      // Validate each task
      for (let i = 0; i < verificationTasks.length; i++) {
        const task = verificationTasks[i];
        if (!task.verification_type_id) {
          await client.query('ROLLBACK');
          await cleanupFiles();
          logger.error('Task validation failed - missing verification_type_id:', {
            userId,
            taskIndex: i,
            taskData: task,
          });
          return res.status(400).json({
            success: false,
            message: `verification_type_id is required for task ${i + 1}`,
            error: { code: 'VALIDATION_ERROR', taskIndex: i },
          });
        }
      }

      // ========== CLIENT ACCESS & ENTITY VALIDATION ==========
      try {
        // Validate client access
        if (userRole !== Role.ADMIN && userRole !== Role.SUPER_ADMIN) {
          const clientAccessQuery = `
            SELECT 1 FROM user_client_access
            WHERE "userId" = $1 AND "clientId" = $2
          `;
          const accessResult = await client.query(clientAccessQuery, [userId, clientId]);

          if (accessResult.rows.length === 0) {
            await client.query('ROLLBACK');
            await cleanupFiles();
            logger.warn('Client access denied', { userId, clientId, userRole });
            return res.status(403).json({
              success: false,
              message: 'Access denied: You do not have permission to create cases for this client',
              error: { code: 'ACCESS_DENIED', clientId },
            });
          }
        }

        // Validate client exists and is active
        const clientCheckResult = await client.query(
          `SELECT id, name, "isActive" FROM clients WHERE id = $1`,
          [clientId]
        );

        if (clientCheckResult.rows.length === 0) {
          await client.query('ROLLBACK');
          await cleanupFiles();
          return res.status(400).json({
            success: false,
            message: 'Invalid client ID',
            error: { code: 'INVALID_CLIENT', clientId },
          });
        }

        if (!clientCheckResult.rows[0].isActive) {
          await client.query('ROLLBACK');
          await cleanupFiles();
          return res.status(400).json({
            success: false,
            message: 'Client is inactive',
            error: { code: 'INACTIVE_CLIENT', clientId },
          });
        }

        // Validate product exists and is active
        const productCheckResult = await client.query(
          `SELECT id, name, "isActive" FROM products WHERE id = $1`,
          [productId]
        );

        if (productCheckResult.rows.length === 0) {
          await client.query('ROLLBACK');
          await cleanupFiles();
          return res.status(400).json({
            success: false,
            message: 'Invalid product ID',
            error: { code: 'INVALID_PRODUCT', productId },
          });
        }

        if (!productCheckResult.rows[0].isActive) {
          await client.query('ROLLBACK');
          await cleanupFiles();
          return res.status(400).json({
            success: false,
            message: 'Product is inactive',
            error: { code: 'INACTIVE_PRODUCT', productId },
          });
        }
      } catch (validationError: unknown) {
        await client.query('ROLLBACK');
        await cleanupFiles();
        const err = validationError as DatabaseError;
        logger.error('Entity validation error:', {
          error: err.message,
          code: err.code,
          userId,
          clientId,
          productId,
        });
        return res.status(500).json({
          success: false,
          message: 'Validation failed',
          error: { code: 'VALIDATION_QUERY_ERROR' },
        });
      }

      // ========== CREATE CASE ==========

      const firstTask = verificationTasks[0];
      const firstTaskVerificationTypeId = firstTask.verification_type_id;
      const firstTaskPincode = firstTask.pincode;
      const firstTaskTrigger =
        firstTask.trigger || firstTask.task_description || 'Verification required';
      const firstTaskApplicantType =
        firstTask.applicant_type || firstTask.applicantType || 'APPLICANT';

      const insertCaseQuery = `
        INSERT INTO cases (
          "customerName", "customerPhone", "customerCallingCode",
          "clientId", "productId", "verificationTypeId",
          pincode, priority, trigger, "applicantType",
          "backendContactNumber", status, "createdByBackendUser",
          "has_multiple_tasks", "total_tasks_count", "completed_tasks_count", "case_completion_percentage",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
        ) RETURNING *
      `;

      const caseValues = [
        customerName,
        customerPhone,
        customerCallingCode,
        clientId,
        productId,
        firstTaskVerificationTypeId,
        pincode || firstTaskPincode || null,
        priority,
        firstTaskTrigger,
        firstTaskApplicantType,
        backendContactNumber || customerPhone,
        'PENDING',
        userId,
        verificationTasks.length > 1,
        verificationTasks.length,
        0,
        0.0,
      ];

      const caseResult = await client.query(insertCaseQuery, caseValues);
      const newCase = caseResult.rows[0];

      logger.info('Unified case created:', {
        caseId: newCase.id,
        caseNumber: newCase.caseId,
        customerName,
        tasksCount: verificationTasks.length,
        userId,
      });

      // ========== CREATE VERIFICATION TASKS ==========

      const createdTasks = [];
      let totalEstimatedAmount = 0;

      for (let i = 0; i < verificationTasks.length; i++) {
        const taskData = verificationTasks[i];
        const {
          verification_type_id: verificationTypeId,
          task_title: taskTitle,
          task_description: taskDescription,
          priority: taskPriority = 'MEDIUM',
          assigned_to: assignedToId,
          assignedTo,
          rate_type_id: rateTypeId,
          estimated_amount: estimatedAmount,
          address: taskAddress,
          pincode: taskPincode,
          trigger: taskTrigger,
          document_type: documentType,
          document_number: documentNumber,
          document_details: documentDetails,
          estimated_completion_date: estimatedCompletionDate,
          applicant_type: applicantTypeSnake,
          applicantType,
          attachment_keys: attachmentKeys,
        } = taskData;

        const taskAssignedTo = assignedTo || assignedToId;
        const taskApplicantType = applicantType || applicantTypeSnake;
        const finalTaskTitle = taskTitle || `Verification Task ${i + 1}`;
        const finalTaskDescription = taskDescription || taskTrigger || 'Verification required';

        // Insert verification task
        const taskResult = await client.query(
          `
          INSERT INTO verification_tasks (
            case_id, verification_type_id, task_title, task_description,
            priority, assigned_to, assigned_by, assigned_at,
            rate_type_id, estimated_amount, address, pincode,
            document_type, document_number, document_details,
            estimated_completion_date, trigger, applicant_type, status, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6::uuid, $7,
            CASE WHEN $6 IS NOT NULL THEN NOW() ELSE NULL::timestamp with time zone END,
            $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            CASE WHEN $6 IS NOT NULL THEN 'ASSIGNED'::text ELSE 'PENDING'::text END,
            $18
          ) RETURNING *
        `,

          [
            newCase.id,
            verificationTypeId,
            finalTaskTitle,
            finalTaskDescription,
            taskPriority,
            taskAssignedTo || null,
            userId,
            rateTypeId || null,
            estimatedAmount || null,
            taskAddress || null,
            taskPincode || pincode || null,
            documentType || null,
            documentNumber || null,
            documentDetails ? JSON.stringify(documentDetails) : null,
            estimatedCompletionDate || null,
            taskTrigger || finalTaskDescription,
            taskApplicantType || null,
            userId,
          ]
        );

        const task = taskResult.rows[0];
        createdTasks.push({
          ...task,
          attachment_keys: attachmentKeys || [],
        });
        totalEstimatedAmount += estimatedAmount || 0;

        logger.info('Task created:', {
          taskId: task.id,
          taskNumber: task.task_number,
          assignedTo: taskAssignedTo,
        });

        // Create assignment history if assigned
        if (taskAssignedTo) {
          await client.query(
            `
            INSERT INTO task_assignment_history (
              verification_task_id, case_id, assigned_to, assigned_by,
              assignment_reason, task_status_before, task_status_after
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
            [
              task.id,
              newCase.id,
              taskAssignedTo,
              userId,
              'Initial assignment during case creation',
              'PENDING',
              'ASSIGNED',
            ]
          );
        }
      }

      // ========== PROCESS FILE ATTACHMENTS ==========

      const files = req.files as Express.Multer.File[];
      const uploadedAttachments: {
        id: string;
        filename: string;
        originalName: string;
        verification_task_id?: string;
        fileSize: number;
        [key: string]: unknown;
      }[] = [];

      if (files && files.length > 0) {
        // Create permanent directory for this case
        const permanentDir = path.join(
          process.cwd(),
          'uploads',
          'attachments',
          `case_${newCase.caseId}`
        );
        if (!fs.existsSync(permanentDir)) {
          fs.mkdirSync(permanentDir, { recursive: true });
        }

        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
          const file = files[fileIndex];
          const fileKey = `attachment_${fileIndex}`;

          try {
            // Move file from temp to permanent location
            const tempPath = file.path;
            const permanentPath = path.join(permanentDir, file.filename);
            fs.renameSync(tempPath, permanentPath);

            // Determine which task this file belongs to
            let verificationTaskId = null;
            for (const task of createdTasks) {
              if (task.attachment_keys?.includes(fileKey)) {
                verificationTaskId = task.id;
                break;
              }
            }

            // If no specific task mapping, link to first task
            if (!verificationTaskId && createdTasks.length > 0) {
              verificationTaskId = createdTasks[0].id;
            }

            // Insert attachment record
            const attachmentResult = await client.query(
              `
              INSERT INTO attachments (
                filename, "originalName", "filePath", "fileSize",
                "mimeType", "uploadedBy", "caseId", case_id,
                verification_task_id, "createdAt"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
              RETURNING *
            `,
              [
                file.filename,
                file.originalname,
                permanentPath,
                file.size,
                file.mimetype,
                userId,
                newCase.caseId,
                newCase.id,
                verificationTaskId,
              ]
            );

            uploadedAttachments.push(attachmentResult.rows[0]);

            logger.info('Attachment saved:', {
              filename: file.filename,
              taskId: verificationTaskId,
              caseId: newCase.id,
            });
          } catch (fileError) {
            logger.error('Error processing file:', {
              filename: file.filename,
              error: fileError,
            });
            // Continue with other files
          }
        }

        // Clean up temp directory
        try {
          const tempDir = path.dirname(files[0].path);
          if (fs.existsSync(tempDir) && tempDir.includes('temp')) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp directory:', cleanupError);
        }
      }

      await client.query('COMMIT');

      // ========== RESPONSE ==========

      res.status(201).json({
        success: true,
        message: `Case created successfully with ${verificationTasks.length} verification task${verificationTasks.length > 1 ? 's' : ''}`,
        data: {
          case: {
            id: newCase.id,
            caseId: newCase.caseId,
            customerName: newCase.customerName,
            status: newCase.status,
            priority: newCase.priority,
            createdAt: newCase.createdAt,
            has_multiple_tasks: newCase.has_multiple_tasks,
            total_tasks_count: newCase.total_tasks_count,
            completed_tasks_count: newCase.completed_tasks_count,
          },
          tasks: createdTasks.map(task => ({
            id: task.id,
            task_number: task.task_number,
            verification_type_id: task.verification_type_id,
            task_title: task.task_title,
            status: task.status,
            assigned_to: task.assigned_to,
            applicant_type: task.applicant_type,
            priority: task.priority,
            attachment_count: uploadedAttachments.filter(
              att => att.verification_task_id === task.id
            ).length,
          })),
          attachments: uploadedAttachments.map(att => ({
            id: att.id,
            filename: att.filename,
            originalName: att.originalName,
            verification_task_id: att.verification_task_id,
            fileSize: att.fileSize,
          })),
          summary: {
            total_tasks: verificationTasks.length,
            assigned_tasks: createdTasks.filter(t => t.assigned_to).length,
            pending_tasks: createdTasks.filter(t => !t.assigned_to).length,
            total_attachments: uploadedAttachments.length,
            estimated_total_amount: totalEstimatedAmount,
          },
        },
      });
    } catch (error: unknown) {
      // Rollback transaction
      try {
        if (client) {
          await client.query('ROLLBACK');
        }
      } catch (rollbackError) {
        logger.error('Rollback failed:', rollbackError);
      }

      // Cleanup uploaded files
      await cleanupFiles();

      const executionTime = Date.now() - startTime;

      // Categorize errors for better handling
      const err = error as DatabaseError;
      const errorCode = err.code;
      const errorMessage = err.message || 'Unknown error';

      // Log detailed error information
      logger.error('Case creation failed:', {
        error: errorMessage,
        code: errorCode,
        constraint: err.constraint,
        detail: err.detail,
        userId: req.user?.id,
        executionTime,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      });

      // Handle specific database errors
      if (errorCode === '23505') {
        // Unique constraint violation
        return res.status(409).json({
          success: false,
          message: 'Duplicate entry detected',
          error: {
            code: 'DUPLICATE_ENTRY',
            constraint: err.constraint,
            detail: err.detail,
          },
        });
      }

      if (errorCode === '23503') {
        // Foreign key violation
        return res.status(400).json({
          success: false,
          message: 'Invalid reference to related entity',
          error: {
            code: 'FOREIGN_KEY_VIOLATION',
            constraint: err.constraint,
            detail: err.detail,
          },
        });
      }

      if (errorCode === '23502') {
        // Not null violation
        return res.status(400).json({
          success: false,
          message: 'Required field missing',
          error: {
            code: 'NULL_VIOLATION',
            column: err.column,
            detail: err.detail,
          },
        });
      }

      if (errorCode === '57014') {
        // Query timeout
        return res.status(504).json({
          success: false,
          message: 'Request timeout. Please try again with fewer tasks or smaller files.',
          error: {
            code: 'QUERY_TIMEOUT',
            executionTime,
          },
        });
      }

      if (errorCode === '53300' || errorCode === '53400') {
        // Too many connections or out of memory
        return res.status(503).json({
          success: false,
          message: 'Service temporarily unavailable. Please try again in a moment.',
          error: {
            code: 'SERVICE_OVERLOADED',
          },
        });
      }

      if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
        // Database connection error
        return res.status(503).json({
          success: false,
          message: 'Database connection error. Please try again.',
          error: {
            code: 'DB_CONNECTION_ERROR',
          },
        });
      }

      // Generic error response
      return res.status(500).json({
        success: false,
        message:
          process.env.NODE_ENV === 'production'
            ? 'Failed to create case. Please try again.'
            : errorMessage,
        error: {
          code: 'INTERNAL_ERROR',
          ...(process.env.NODE_ENV !== 'production' && {
            detail: err.detail,
            hint: err.hint,
            stack: err.stack,
          }),
        },
      });
    } finally {
      // Always release the database connection
      if (client) {
        try {
          client.release();
          const executionTime = Date.now() - startTime;
          logger.info('Case creation request completed', {
            userId: req.user?.id,
            executionTime,
            success: res.statusCode < 400,
          });
        } catch (releaseError) {
          logger.error('Failed to release database connection:', releaseError);
        }
      }
    }
  },
];
