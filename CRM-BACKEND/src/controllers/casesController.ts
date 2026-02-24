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
import { CreateApplicantData, CreateCaseRequest, CreateVerificationTask } from '../types/cases';
import {
  VerificationTaskCreationError,
  VerificationTaskCreationService,
} from '../services/verificationTaskCreationService';

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
    const baseConditions: string[] = [];
    const baseParams: (string | number | boolean | string[] | number[])[] = [];
    let baseParamIndex = 1;

    // Role-based filtering - FIELD_AGENT users can only see cases with their assigned tasks
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === Role.FIELD_AGENT) {
      const { getAssignedPincodeIds } = await import('@/middleware/pincodeAccess');
      const { getAssignedAreaIds } = await import('@/middleware/areaAccess');

      const assignedPincodeIds = await getAssignedPincodeIds(userId, userRole);
      const assignedAreaIds = await getAssignedAreaIds(userId, userRole);

      const fieldAgentConditions: string[] = [];

      fieldAgentConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
        AND vt.assigned_to = $${baseParamIndex}
      )`);
      baseParams.push(userId);
      baseParamIndex++;

      if (assignedPincodeIds && assignedPincodeIds.length > 0) {
        fieldAgentConditions.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.pincode_id = ANY($${baseParamIndex}::int[])
        )`);
        baseParams.push(assignedPincodeIds);
        baseParamIndex++;
      }

      if (assignedAreaIds && assignedAreaIds.length > 0) {
        fieldAgentConditions.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.area_id = ANY($${baseParamIndex}::int[])
        )`);
        baseParams.push(assignedAreaIds);
        baseParamIndex++;
      }

      if (fieldAgentConditions.length > 0) {
        baseConditions.push(`(${fieldAgentConditions.join(' OR ')})`);
      } else {
        baseConditions.push('FALSE');
      }
    } else if (userRole === Role.BACKEND_USER) {
      const { getAssignedClientIds } = await import('@/middleware/clientAccess');
      const { getAssignedProductIds } = await import('@/middleware/productAccess');

      const assignedClientIds = await getAssignedClientIds(userId, userRole);
      const assignedProductIds = await getAssignedProductIds(userId, userRole);

      if (assignedClientIds && assignedClientIds.length > 0) {
        baseConditions.push(`c."clientId" = ANY($${baseParamIndex}::int[])`);
        baseParams.push(assignedClientIds);
        baseParamIndex++;
      } else if (assignedClientIds && assignedClientIds.length === 0) {
        baseConditions.push('FALSE');
      }

      if (assignedProductIds && assignedProductIds.length > 0) {
        baseConditions.push(`c."productId" = ANY($${baseParamIndex}::int[])`);
        baseParams.push(assignedProductIds);
        baseParamIndex++;
      } else if (assignedProductIds && assignedProductIds.length === 0) {
        baseConditions.push('FALSE');
      }
    } else if (assignedTo) {
      baseConditions.push(`EXISTS (
        SELECT 1 FROM verification_tasks vt
        WHERE vt.case_id = c.id
        AND vt.assigned_to = $${baseParamIndex}
      )`);
      baseParams.push(assignedTo);
      baseParamIndex++;
    }

    // Search filter (customer name, case ID, address, phone, trigger, applicant type)
    if (search) {
      baseConditions.push(`(
        COALESCE(c."customerName", '') ILIKE $${baseParamIndex} OR
        COALESCE(c."caseId"::text, '') ILIKE $${baseParamIndex} OR
        EXISTS (
          SELECT 1 FROM verification_tasks vt 
          WHERE vt.case_id = c.id AND vt.address ILIKE $${baseParamIndex}
        ) OR
        COALESCE(c."customerPhone", '') ILIKE $${baseParamIndex} OR
        COALESCE(c.trigger, '') ILIKE $${baseParamIndex} OR
        COALESCE(c."applicantType", '') ILIKE $${baseParamIndex}
      )`);
      baseParams.push(
        `%${typeof search === 'string' || typeof search === 'number' ? String(search) : ''}%`
      );
      baseParamIndex++;
    }

    // Client filter
    if (clientId) {
      baseConditions.push(`c."clientId" = $${baseParamIndex}`);
      baseParams.push(parseInt(clientId));
      baseParamIndex++;
    }

    // Date range filter
    if (dateFrom) {
      baseConditions.push(`c."createdAt" >= $${baseParamIndex}`);
      baseParams.push(dateFrom);
      baseParamIndex++;
    }
    if (dateTo) {
      baseConditions.push(`c."createdAt" <= $${baseParamIndex}`);
      baseParams.push(dateTo);
      baseParamIndex++;
    }

    // Build BASE WHERE clause for statistics
    const baseWhereClause =
      baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';

    // Build FULL WHERE conditions for listing
    const conditions = [...baseConditions];
    const params = [...baseParams];
    let paramIndex = baseParamIndex;

    // Status filter (applied to listing but NOT to statistics)
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Build FINAL WHERE clause for listing
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

    // Get case statistics for metric cards (ignoring the active tab's status filter)
    const statsQuery = `
      SELECT
        COUNT(DISTINCT c.id) as "totalCases",
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'PENDING') as pending,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'IN_PROGRESS') as "inProgress",
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'COMPLETED') as completed,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ON_HOLD') as "onHold",
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'REVOKED') as revoked,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED')
          AND c."createdAt" < NOW() - INTERVAL '48 hours'
        ) as overdue,
        0 as "highPriority",
        COUNT(DISTINCT vt.assigned_to) FILTER (WHERE c.status = 'IN_PROGRESS' AND vt.assigned_to IS NOT NULL) as "activeAgentsInProgress",
        AVG(EXTRACT(EPOCH FROM (NOW() - c."createdAt"))/86400) FILTER (WHERE c.status = 'IN_PROGRESS') as "avgDurationDaysInProgress",
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'COMPLETED' AND c."completedAt" >= DATE_TRUNC('month', NOW())) as "completedThisMonth",
        COUNT(DISTINCT vt.assigned_to) FILTER (WHERE c.status = 'COMPLETED' AND vt.assigned_to IS NOT NULL) as "activeAgentsCompleted",
        AVG(EXTRACT(EPOCH FROM (c."completedAt" - c."createdAt"))/86400) FILTER (WHERE c.status = 'COMPLETED') as "avgTATDays"
      FROM cases c
      LEFT JOIN verification_tasks vt ON c.id = vt.case_id
      ${baseWhereClause}
    `;
    const statsResult = await pool.query(statsQuery, baseParams);
    const statistics = statsResult.rows[0];

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
        COALESCE(task_stats.revisit_tasks, 0) as "revisitTasks",
        -- Representative assigned agent from tasks
        assigned_user.id as "assignedTo",
        assigned_user.name as "assignedToName",
        assigned_user.email as "assignedToEmail"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users created_user ON c."createdByBackendUser" = created_user.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN "rateTypes" rt ON c."rateTypeId" = rt.id
      LEFT JOIN LATERAL (
        SELECT u.id, u.name, u.email
        FROM verification_tasks vts
        LEFT JOIN users u ON vts.assigned_to = u.id
        WHERE vts.case_id = c.id AND vts.assigned_to IS NOT NULL
        ORDER BY vts.created_at DESC
        LIMIT 1
      ) assigned_user ON true
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
      // Pass raw assignedTo for backwards compatibility if needed
      assignedToId: row.assignedTo,
    }));

    const response = {
      success: true,
      data: {
        data: transformedData,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
        },
        statistics,
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
        COALESCE(task_stats.revisit_tasks, 0) as "revisitTasks",
        -- Representative assigned agent from tasks
        assigned_user.id as "assignedTo",
        assigned_user.name as "assignedToName",
        assigned_user.email as "assignedToEmail"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users created_user ON c."createdByBackendUser" = created_user.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN "rateTypes" rt ON c."rateTypeId" = rt.id
      LEFT JOIN LATERAL (
        SELECT u.id, u.name, u.email
        FROM verification_tasks vts
        LEFT JOIN users u ON vts.assigned_to = u.id
        WHERE vts.case_id = c.id AND vts.assigned_to IS NOT NULL
        ORDER BY vts.created_at DESC
        LIMIT 1
      ) assigned_user ON true
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

    const caseRow = result.rows[0];

    // NEW: Fetch applicants, verifications, and visits hierarchy
    const hierarchyQuery = `
      SELECT 
        a.id as applicant_id, a.name as applicant_name, a.mobile as applicant_mobile, a.role as applicant_role,
        v.id as verification_id, v.verification_type_id, v.address, v.pincode_id,
        vt.name as verification_type_name,
        vi.id as visit_id, vi.status as visit_status, vi.assigned_to as visit_assigned_to,
        vi.visit_number, vi.completed_at as visit_completed_at,
        au.name as visit_assigned_to_name
      FROM applicants a
      LEFT JOIN verifications v ON a.id = v.applicant_id
      LEFT JOIN "verificationTypes" vt ON v.verification_type_id = vt.id
      LEFT JOIN visits vi ON v.id = vi.verification_id
      LEFT JOIN users au ON vi.assigned_to = au.id
      WHERE a.case_id = $1
      ORDER BY a.created_at ASC, v.created_at ASC, vi.visit_number DESC
    `;

    const hierarchyResult = await pool.query(hierarchyQuery, [caseRow.id]);

    // Group hierarchy data
    const applicantsMap = new Map();

    hierarchyResult.rows.forEach(row => {
      if (!row.applicant_id) {
        return;
      }

      if (!applicantsMap.has(row.applicant_id)) {
        applicantsMap.set(row.applicant_id, {
          id: row.applicant_id,
          name: row.applicant_name,
          mobile: row.applicant_mobile,
          role: row.applicant_role,
          verifications: new Map(),
        });
      }

      const applicant = applicantsMap.get(row.applicant_id);

      if (row.verification_id) {
        if (!applicant.verifications.has(row.verification_id)) {
          applicant.verifications.set(row.verification_id, {
            id: row.verification_id,
            verification_type_id: row.verification_type_id,
            verification_type_name: row.verification_type_name,
            address: row.address,
            pincode_id: row.pincode_id,
            visits: [],
          });
        }

        const verification = applicant.verifications.get(row.verification_id);

        if (row.visit_id) {
          verification.visits.push({
            id: row.visit_id,
            status: row.visit_status,
            visit_number: row.visit_number,
            assigned_to: row.visit_assigned_to
              ? {
                  id: row.visit_assigned_to,
                  name: row.visit_assigned_to_name,
                }
              : null,
            completed_at: row.visit_completed_at,
          });
        }
      }
    });

    // Transform maps to arrays
    const applicants = Array.from(applicantsMap.values()).map(app => ({
      ...app,
      verifications: Array.from(app.verifications.values()),
    }));

    // Transform data to match frontend expectations (Backward Compatibility + New Hierarchy)
    const transformedData = {
      ...caseRow,
      applicants,
      // Provide flat fields for frontend compatibility (derived from first applicant/verification/visit)
      clientName: caseRow.clientName,
      clientCode: caseRow.clientCode,
      assignedToName: caseRow.assignedToName,
      productName: caseRow.productName,
      productCode: caseRow.productCode,
      // Task statistics
      totalTasks: caseRow.totalTasks || 0,
      completedTasks: caseRow.completedTasks || 0,
      pendingTasks: caseRow.pendingTasks || 0,
      inProgressTasks: caseRow.inProgressTasks || 0,
      revisitTasks: caseRow.revisitTasks || 0,
      // Transform client data
      client: caseRow.clientName
        ? {
            id: caseRow.clientId,
            name: caseRow.clientName,
            code: caseRow.clientCode,
          }
        : null,
      // Transform assigned user
      assignedTo: caseRow.assignedToName
        ? {
            id: caseRow.assignedTo,
            name: caseRow.assignedToName,
            username: caseRow.assignedToEmail,
            employeeId: caseRow.assignedToEmail,
          }
        : null,
      // Transform product data
      product: caseRow.productName
        ? {
            id: caseRow.productId,
            name: caseRow.productName,
            code: caseRow.productCode,
          }
        : null,
      // Transform created by user
      createdByBackendUser: caseRow.createdByBackendUserName
        ? {
            id: caseRow.createdByBackendUser,
            name: caseRow.createdByBackendUserName,
            employeeId: caseRow.createdByBackendUserEmail,
          }
        : null,
    };

    logger.info('Case hierarchy retrieved', {
      userId: req.user?.id,
      caseId: id,
      applicantCount: applicants.length,
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
      whereConditions.push(
        `EXISTS (SELECT 1 FROM verification_tasks vte WHERE vte.case_id = c.id AND vte.assigned_to = $${paramIndex})`
      );
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
        assigned_user.name as assigned_to_name,
        assigned_user."employeeId" as assigned_to_employee_id,
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
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN LATERAL (
        SELECT u.name, u."employeeId"
        FROM verification_tasks vte
        LEFT JOIN users u ON vte.assigned_to = u.id
        WHERE vte.case_id = c.id AND vte.assigned_to IS NOT NULL
        ORDER BY vte.created_at DESC
        LIMIT 1
      ) assigned_user ON true
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
      const _userRole = req.user?.role;

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
        console.info('REQ BODY:', JSON.stringify(req.body, null, 2));
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
          applicantsCount: requestData.applicants?.length || 0,
          firstApplicantKeys: requestData.applicants?.[0]
            ? Object.keys(requestData.applicants[0])
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

      const { case_details: caseDetails, verification_tasks: verificationTasksFromRequest } =
        requestData;
      let applicantsData = requestData.applicants;

      if (
        (!Array.isArray(applicantsData) || applicantsData.length === 0) &&
        Array.isArray(verificationTasksFromRequest) &&
        verificationTasksFromRequest.length > 0
      ) {
        const applicantsMap = new Map<
          string,
          {
            name: string;
            mobile: string;
            role: string;
            pan_number?: string;
            verifications: CreateVerificationTask[];
          }
        >();
        const pincodeIdCache = new Map<string, number | null>();

        const resolvePincodeId = async (pincodeValue: unknown): Promise<number | null> => {
          if (!pincodeValue) {
            return null;
          }
          const pincodeCode =
            typeof pincodeValue === 'string'
              ? pincodeValue.trim()
              : typeof pincodeValue === 'number'
                ? String(pincodeValue).trim()
                : '';
          if (!pincodeCode) {
            return null;
          }
          if (pincodeIdCache.has(pincodeCode)) {
            return pincodeIdCache.get(pincodeCode);
          }

          const pincodeResult = await client.query('SELECT id FROM pincodes WHERE code = $1', [
            pincodeCode,
          ]);
          const resolvedId = pincodeResult.rows[0]?.id ? Number(pincodeResult.rows[0].id) : null;
          pincodeIdCache.set(pincodeCode, resolvedId);
          return resolvedId;
        };

        for (const taskRaw of verificationTasksFromRequest) {
          const task = taskRaw as Record<string, unknown>;
          const role = String(
            (task.applicant_type as string) ||
              (task.applicantType as string) ||
              caseDetails?.applicantType ||
              'APPLICANT'
          );
          const name = String(
            ((task.applicant as Record<string, unknown> | undefined)?.name as string) ||
              caseDetails?.customerName ||
              'Applicant'
          );
          const mobile = String(
            ((task.applicant as Record<string, unknown> | undefined)?.mobile as string) ||
              caseDetails?.customerPhone ||
              ''
          );
          const panNumber = String(
            ((task.applicant as Record<string, unknown> | undefined)?.pan_number as string) ||
              caseDetails?.panNumber ||
              ''
          );
          const verificationTypeId = Number(
            task.verification_type_id || task.verificationTypeId || 0
          );
          if (!verificationTypeId) {
            continue;
          }

          const pincodeIdFromTask =
            task.pincode_id && Number(task.pincode_id)
              ? Number(task.pincode_id)
              : await resolvePincodeId(task.pincode);

          const applicantKey = `${role}:${mobile || name}`;
          if (!applicantsMap.has(applicantKey)) {
            applicantsMap.set(applicantKey, {
              name,
              mobile,
              role,
              pan_number: panNumber || undefined,
              verifications: [],
            });
          }

          applicantsMap.get(applicantKey).verifications.push({
            verification_type_id: verificationTypeId,
            address: task.address || null,
            pincode_id: pincodeIdFromTask,
            assigned_to: task.assigned_to || task.assignedTo || null,
            sla_deadline: task.estimated_completion_date || task.sla_deadline || null,
          } as unknown as CreateVerificationTask);
        }

        applicantsData = Array.from(applicantsMap.values()) as CreateApplicantData[];
      }

      console.info('Parsed applicants:', applicantsData);
      console.info('Parsed verification_tasks:', verificationTasksFromRequest);

      // ========== COMPREHENSIVE VALIDATION ==========
      if (!caseDetails || typeof caseDetails !== 'object') {
        const validationError = new Error('case_details is required');
        (validationError as DatabaseError).code = 'VALIDATION_ERROR';
        throw validationError;
      }
      if (!applicantsData || !Array.isArray(applicantsData) || applicantsData.length === 0) {
        const validationError = new Error('At least one applicant is required');
        (validationError as DatabaseError).code = 'VALIDATION_ERROR';
        throw validationError;
      }

      const {
        clientId,
        productId,
        customerName,
        customerPhone,
        customerCallingCode,
        verificationTypeId,
        applicantType,
        trigger,
        priority = 'MEDIUM',
        backendContactNumber,
      } = caseDetails;

      const resolvedCaseCustomerName =
        (customerName ? String(customerName).trim() : '') ||
        (Array.isArray(applicantsData) && applicantsData.length > 0 && applicantsData[0].name
          ? String(applicantsData[0].name).trim()
          : '');
      const resolvedCaseVerificationTypeId =
        (verificationTypeId ? Number(verificationTypeId) : null) ||
        (Array.isArray(verificationTasksFromRequest) &&
        verificationTasksFromRequest.length > 0 &&
        Number((verificationTasksFromRequest[0] as Record<string, unknown>).verification_type_id)
          ? Number(
              (verificationTasksFromRequest[0] as Record<string, unknown>).verification_type_id
            )
          : null) ||
        (Array.isArray(applicantsData) &&
        applicantsData.length > 0 &&
        Array.isArray(applicantsData[0].verifications) &&
        applicantsData[0].verifications.length > 0 &&
        Number(applicantsData[0].verifications[0].verification_type_id)
          ? Number(applicantsData[0].verifications[0].verification_type_id)
          : null);
      const resolvedCaseApplicantType =
        (applicantType ? String(applicantType) : null) ||
        (Array.isArray(applicantsData) && applicantsData.length > 0 && applicantsData[0].role
          ? String(applicantsData[0].role)
          : null) ||
        (Array.isArray(verificationTasksFromRequest) &&
        verificationTasksFromRequest.length > 0 &&
        ((verificationTasksFromRequest[0] as Record<string, unknown>).applicant_type ||
          (verificationTasksFromRequest[0] as Record<string, unknown>).applicantType)
          ? String(
              ((verificationTasksFromRequest[0] as Record<string, unknown>)
                .applicant_type as string) ||
                ((verificationTasksFromRequest[0] as Record<string, unknown>)
                  .applicantType as string)
            )
          : null);
      const resolvedCaseTrigger =
        (trigger ? String(trigger) : null) ||
        (Array.isArray(verificationTasksFromRequest) &&
        verificationTasksFromRequest.length > 0 &&
        (verificationTasksFromRequest[0] as Record<string, unknown>).trigger
          ? String((verificationTasksFromRequest[0] as Record<string, unknown>).trigger as string)
          : null);
      const resolvedClientId =
        clientId !== undefined && clientId !== null && String(clientId).trim() !== ''
          ? Number(clientId)
          : null;
      const resolvedProductId =
        productId !== undefined && productId !== null && String(productId).trim() !== ''
          ? Number(productId)
          : null;
      const resolvedBackendContactNumber =
        backendContactNumber !== undefined && backendContactNumber !== null
          ? String(backendContactNumber).trim()
          : '';
      if (
        !resolvedClientId ||
        !resolvedProductId ||
        !resolvedBackendContactNumber ||
        !resolvedCaseCustomerName ||
        !resolvedCaseVerificationTypeId ||
        !resolvedCaseApplicantType ||
        !resolvedCaseTrigger
      ) {
        const missingFields = [
          !resolvedClientId ? 'clientId' : null,
          !resolvedProductId ? 'productId' : null,
          !resolvedBackendContactNumber ? 'backendContactNumber' : null,
          !resolvedCaseCustomerName ? 'customerName' : null,
          !resolvedCaseVerificationTypeId ? 'verificationTypeId' : null,
          !resolvedCaseApplicantType ? 'applicantType' : null,
          !resolvedCaseTrigger ? 'trigger' : null,
        ].filter(Boolean);
        const validationError = new Error(
          `Missing required case fields: ${missingFields.join(', ')}`
        );
        (validationError as DatabaseError).code = 'VALIDATION_ERROR';
        throw validationError;
      }

      // ========== CREATE CASE ==========
      const caseResult = await client.query(
        `INSERT INTO cases (
          "clientId", "productId", "customerName", "customerPhone", "customerCallingCode",
          priority, "backendContactNumber",
          "verificationTypeId", "applicantType", trigger, "createdByBackendUser", status, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING', NOW(), NOW()) RETURNING *`,
        [
          resolvedClientId,
          resolvedProductId,
          resolvedCaseCustomerName,
          customerPhone || null,
          customerCallingCode || null,
          priority,
          resolvedBackendContactNumber,
          resolvedCaseVerificationTypeId,
          resolvedCaseApplicantType,
          resolvedCaseTrigger,
          userId,
        ]
      );
      const newCase = caseResult.rows[0];

      const createdHierarchy = [];

      // ========== CREATE APPLICANTS, VERIFICATIONS, VISITS ==========
      for (const appData of applicantsData) {
        const applicantResult = await client.query(
          `INSERT INTO applicants (case_id, name, mobile, role, pan_number, id_details)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [
            newCase.id,
            appData.name,
            appData.mobile,
            appData.role || 'APPLICANT',
            appData.pan_number,
            appData.id_details || {},
          ]
        );
        const applicant = applicantResult.rows[0];
        const verifications = [];

        if (appData.verifications && Array.isArray(appData.verifications)) {
          for (const verData of appData.verifications) {
            const pincodeId =
              verData.pincode_id ||
              (verData.pincode
                ? (await client.query('SELECT id FROM pincodes WHERE code = $1', [verData.pincode]))
                    .rows[0]?.id
                : null);

            const verificationResult = await client.query(
              `INSERT INTO verifications (applicant_id, verification_type_id, address, pincode_id)
               VALUES ($1, $2, $3, $4) RETURNING *`,
              [applicant.id, verData.verification_type_id, verData.address, pincodeId]
            );
            const verification = verificationResult.rows[0];
            const visits = [];

            // Automatically create initial visit for each verification
            const visitResult = await client.query(
              `INSERT INTO visits (verification_id, visit_number, status, assigned_to, sla_deadline)
               VALUES ($1, 1, 'PENDING', $2, $3) RETURNING *`,
              [verification.id, verData.assigned_to || null, verData.sla_deadline || null]
            );
            visits.push(visitResult.rows[0]);

            verifications.push({ ...verification, visits });
          }
        }
        createdHierarchy.push({ ...applicant, verifications });
      }

      // Backward compatibility: Set customerName on case from primary applicant
      if (createdHierarchy.length > 0) {
        await client.query('UPDATE cases SET "customerName" = $1 WHERE id = $2', [
          createdHierarchy[0].name,
          newCase.id,
        ]);
      }

      // Build verification tasks payload:
      // 1) Prefer explicit verification_tasks from request
      // 2) Fallback to applicants[].verifications[]
      let tasksToCreate: Record<string, unknown>[] = [];

      if (Array.isArray(verificationTasksFromRequest) && verificationTasksFromRequest.length > 0) {
        tasksToCreate = verificationTasksFromRequest as unknown as Record<string, unknown>[];
      } else {
        // Cache pincode_id -> pincode code resolution to avoid repeated queries
        const pincodeCodeCache = new Map<number, string>();

        const resolvePincodeCode = async (pincodeId?: number): Promise<string | null> => {
          if (!pincodeId) {
            return null;
          }
          if (pincodeCodeCache.has(pincodeId)) {
            return pincodeCodeCache.get(pincodeId);
          }

          const pincodeRes = await client.query('SELECT code FROM pincodes WHERE id = $1', [
            pincodeId,
          ]);
          const pincodeCode = pincodeRes.rows[0]?.code ? String(pincodeRes.rows[0].code) : null;
          if (pincodeCode) {
            pincodeCodeCache.set(pincodeId, pincodeCode);
          }
          return pincodeCode;
        };

        for (const appData of applicantsData) {
          if (!appData.verifications || !Array.isArray(appData.verifications)) {
            continue;
          }

          for (const verData of appData.verifications) {
            const pincodeCode =
              typeof (verData as Record<string, unknown>).pincode === 'string'
                ? String((verData as Record<string, unknown>).pincode as string)
                : await resolvePincodeCode(
                    Number((verData as Record<string, unknown>).pincode_id || 0) || undefined
                  );

            if (!pincodeCode) {
              continue;
            }

            tasksToCreate.push({
              verification_type_id: (verData as Record<string, unknown>).verification_type_id,
              task_title: `Verification for ${appData.name}`,
              task_description: 'Auto-generated task from case creation',
              priority: caseDetails.priority || 'MEDIUM',
              assigned_to:
                (verData as Record<string, unknown>).assigned_to ||
                (verData as Record<string, unknown>).assignedTo ||
                null,
              address: (verData as Record<string, unknown>).address,
              pincode: pincodeCode,
              estimated_completion_date: (verData as Record<string, unknown>).sla_deadline,
              area_id: (verData as Record<string, unknown>).area_id || null,
              applicant_type: appData.role || 'APPLICANT',
              trigger: caseDetails.trigger || null,
            });
          }
        }
      }

      if (!tasksToCreate || tasksToCreate.length === 0) {
        const validationError = new Error('At least one verification task is required');
        (validationError as DatabaseError).code = 'VALIDATION_ERROR';
        throw validationError;
      }

      // Atomic requirement:
      // case + hierarchy + verification tasks must all succeed in one transaction
      const taskCreationResult = await VerificationTaskCreationService.createForCase(
        client,
        newCase.id,
        tasksToCreate,
        userId
      );

      // Explicit commit before returning success
      await client.query('COMMIT');

      // ========== RESPONSE ==========
      res.status(201).json({
        success: true,
        message: `Case created successfully with ${applicantsData.length} applicant(s)`,
        data: {
          case: {
            id: newCase.id,
            caseId: newCase.caseId,
            status: newCase.status,
            priority: newCase.priority,
            createdAt: newCase.createdAt,
          },
          hierarchy: createdHierarchy,
          tasks: taskCreationResult.createdTasks,
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

      // Handle verification task creation structured errors
      if (error instanceof VerificationTaskCreationError) {
        return res.status(error.status).json(error.responseBody);
      }

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

      if (errorCode === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          message: errorMessage,
          error: {
            code: 'VALIDATION_ERROR',
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
