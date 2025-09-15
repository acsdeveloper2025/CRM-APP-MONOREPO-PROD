import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { pool, query } from '../config/database';
import { EnterpriseCacheService, CacheKeys } from '../services/enterpriseCacheService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

// Mock data removed - using database operations only

// Supported file types for case attachments (PDF, Images, Word only)
const ALLOWED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `attachment_${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (ALLOWED_EXTENSIONS.includes(extension) && ALLOWED_MIME_TYPES.includes(mimeType)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Only PDF, images (JPG, PNG, GIF), and Word documents (DOC, DOCX) are supported.`));
  }
};

const uploadForCaseCreation = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 15, // Maximum 15 files per case creation
  }
});

// GET /api/cases - List cases with filtering, sorting, and pagination (Enterprise Enhanced)
export const getCases = async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();

  try {
    const {
      page = 1,
      limit = 50, // Increased default limit for enterprise
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      status,
      search,
      assignedTo,
      clientId,
      priority,
      dateFrom,
      dateTo,
      useCache = 'true' // Allow cache bypass for real-time needs
    } = req.query;

    // Enterprise cache key generation
    const cacheKey = CacheKeys.userCases(
      req.user?.id || 'anonymous',
      Number(page)
    ) + `:${JSON.stringify(req.query)}`;

    // Try cache first (unless bypassed)
    if (useCache === 'true') {
      const cached = await EnterpriseCacheService.get(cacheKey);
      if (cached) {
        logger.debug('Cases cache hit', {
          userId: req.user?.id,
          page,
          cacheKey,
          responseTime: Date.now() - startTime
        });

        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
    }

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Role-based filtering - FIELD_AGENT users can only see their assigned cases
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === 'FIELD_AGENT') {
      conditions.push(`c."assignedTo" = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    } else if (assignedTo) {
      // For other roles, apply assignedTo filter only if explicitly provided
      conditions.push(`c."assignedTo" = $${paramIndex}`);
      params.push(assignedTo);
      paramIndex++;
    }

    // Status filter
    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Search filter (customer name, case ID, address)
    if (search) {
      conditions.push(`(
        c."customerName" ILIKE $${paramIndex} OR
        c."caseId"::text ILIKE $${paramIndex} OR
        c.address ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Client filter
    if (clientId) {
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(parseInt(clientId as string));
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
    const allowedSortColumns = ['createdAt', 'updatedAt', 'customerName', 'priority', 'status', 'caseId', 'completedAt', 'pendingDuration'];
    let safeSortBy = allowedSortColumns.includes(sortBy as string) ? sortBy : 'caseId';
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
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

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
      orderByClause = `ORDER BY c."${safeSortBy}" ${safeSortOrder}`;
    }

    const casesQuery = `
      SELECT
        c.*,
        -- Client information (Field 3: Client)
        cl.name as "clientName",
        cl.code as "clientCode",
        -- Assigned user information (Field 9: Assign to Field User)
        assigned_user.name as "assignedToName",
        assigned_user.email as "assignedToEmail",
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
        -- Calculate pending/in-progress duration for frontend display
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
          ELSE NULL
        END as "pendingDurationSeconds"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users assigned_user ON c."assignedTo" = assigned_user.id
      LEFT JOIN users created_user ON c."createdByBackendUser" = created_user.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN "rateTypes" rt ON c."rateTypeId" = rt.id
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), offset);

    // Execute query with performance monitoring
    const queryStartTime = Date.now();
    const casesResult = await pool.query(casesQuery, params);
    const queryTime = Date.now() - queryStartTime;

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit as string));

    // Transform data to match frontend expectations
    const transformedData = casesResult.rows.map((row: any) => ({
      ...row,
      // Provide flat fields for frontend compatibility
      clientName: row.clientName,
      clientCode: row.clientCode,
      assignedToName: row.assignedToName,
      productName: row.productName,
      productCode: row.productCode,
      // Transform client data to nested object
      client: row.clientName ? {
        id: row.clientId,
        name: row.clientName,
        code: row.clientCode
      } : null,
      // Transform assigned user data to nested object
      assignedTo: row.assignedToName ? {
        id: row.assignedTo,
        name: row.assignedToName,
        username: row.assignedToEmail,
        employeeId: row.assignedToEmail
      } : null,
      // Transform product data to nested object
      product: row.productName ? {
        id: row.productId,
        name: row.productName,
        code: row.productCode
      } : null,
      // Transform created by backend user data to nested object
      createdByBackendUser: row.createdByBackendUserName ? {
        id: row.createdByBackendUser,
        name: row.createdByBackendUserName,
        employeeId: row.createdByBackendUserEmail
      } : null
    }));

    const response = {
      success: true,
      data: transformedData,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
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
      EnterpriseCacheService.set(cacheKey, response, 60)
        .catch(error => logger.error('Failed to cache cases response:', error));
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
    const { id } = req.params;

    // Check if id is numeric (caseId) or UUID (id)
    const isNumeric = /^\d+$/.test(id);

    // Role-based access control
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Build query with role-based filtering
    let caseQuery = `
      SELECT
        c.*,
        -- Client information (Field 3: Client)
        cl.name as "clientName",
        cl.code as "clientCode",
        -- Assigned user information (Field 9: Assign to Field User)
        assigned_user.name as "assignedToName",
        assigned_user.email as "assignedToEmail",
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
        created_user.email as "createdByBackendUserEmail"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users assigned_user ON c."assignedTo" = assigned_user.id
      LEFT JOIN users created_user ON c."createdByBackendUser" = created_user.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN "rateTypes" rt ON c."rateTypeId" = rt.id
      WHERE ${isNumeric ? 'c."caseId" = $1' : 'c.id = $1'}
    `;

    const queryParams = [isNumeric ? parseInt(id) : id];

    // Add role-based filtering for FIELD_AGENT
    if (userRole === 'FIELD_AGENT') {
      caseQuery += ` AND c."assignedTo" = $2`;
      queryParams.push(userId);
    }

    const result = await pool.query(caseQuery, queryParams);

    if (result.rows.length === 0) {
      const message = userRole === 'FIELD_AGENT'
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
      // Transform client data to nested object
      client: row.clientName ? {
        id: row.clientId,
        name: row.clientName,
        code: row.clientCode
      } : null,
      // Transform assigned user data to nested object
      assignedTo: row.assignedToName ? {
        id: row.assignedTo,
        name: row.assignedToName,
        username: row.assignedToEmail,
        employeeId: row.assignedToEmail
      } : null,
      // Transform product data to nested object
      product: row.productName ? {
        id: row.productId,
        name: row.productName,
        code: row.productCode
      } : null,
      // Transform created by backend user data to nested object
      createdByBackendUser: row.createdByBackendUserName ? {
        id: row.createdByBackendUser,
        name: row.createdByBackendUserName,
        employeeId: row.createdByBackendUserEmail
      } : null
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

// POST /api/cases - Create new case
export const createCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customerName,
      customerPhone,
      customerCallingCode,
      clientId,
      productId,
      verificationTypeId,
      address,
      pincode,
      priority = 'MEDIUM',
      trigger,
      applicantType = 'APPLICANT',
      backendContactNumber,
      assignedToId,
      rateTypeId
    } = req.body;

    // Validate rate type if provided
    if (rateTypeId) {
      // Check if rate type exists and is active
      const rateTypeRes = await query(
        `SELECT id FROM "rateTypes" WHERE id = $1 AND "isActive" = true`,
        [Number(rateTypeId)]
      );

      if (rateTypeRes.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive rate type',
          error: { code: 'INVALID_RATE_TYPE' },
        });
      }

      // Check if rate type is assigned to this client/product/verification type combination
      if (clientId && productId && verificationTypeId) {
        const assignmentRes = await query(
          `SELECT id FROM "rateTypeAssignments"
           WHERE "clientId" = $1 AND "productId" = $2 AND "verificationTypeId" = $3 AND "rateTypeId" = $4 AND "isActive" = true`,
          [Number(clientId), Number(productId), Number(verificationTypeId), Number(rateTypeId)]
        );

        if (assignmentRes.rowCount === 0) {
          return res.status(400).json({
            success: false,
            message: 'Rate type is not assigned to this client/product/verification type combination',
            error: { code: 'RATE_TYPE_NOT_ASSIGNED' },
          });
        }
      }
    }

    const insertQuery = `
      INSERT INTO cases (
        "customerName", "customerPhone", "customerCallingCode",
        "clientId", "productId", "verificationTypeId",
        address, pincode, priority, trigger, "applicantType",
        "backendContactNumber", "assignedTo", "rateTypeId",
        status, "createdByBackendUser", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      customerName,
      customerPhone,
      customerCallingCode,
      clientId && clientId.trim() !== '' ? Number(clientId) : null, // Convert string to integer, handle empty strings
      productId && productId.trim() !== '' ? Number(productId) : null, // Convert string to integer, handle empty strings
      verificationTypeId && verificationTypeId.trim() !== '' ? Number(verificationTypeId) : null, // Convert string to integer, handle empty strings
      address,
      pincode,
      priority,
      trigger,
      applicantType,
      backendContactNumber,
      assignedToId,
      rateTypeId && rateTypeId.trim() !== '' ? Number(rateTypeId) : null, // rateTypeId, handle empty strings
      'PENDING',
      req.user?.id
    ];

    const result = await pool.query(insertQuery, values);

    logger.info('Case created', {
      userId: req.user?.id,
      caseId: result.rows[0].caseId,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Case created successfully',
    });
  } catch (error) {
    logger.error('Error creating case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create case',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/cases/:id/assign - Assign case to user
// PUT /api/cases/:id - Update case
export const updateCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      customerPhone,
      customerCallingCode,
      clientId,
      productId,
      verificationTypeId,
      address,
      pincode,
      priority,
      trigger,
      applicantType,
      backendContactNumber,
      assignedToId
    } = req.body;

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
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
    if (address !== undefined) {
      updateFields.push(`address = $${paramIndex}`);
      values.push(address);
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
    if (assignedToId !== undefined) {
      updateFields.push(`"assignedTo" = $${paramIndex}`);
      values.push(assignedToId);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
        error: { code: 'NO_UPDATE_FIELDS' },
      });
    }

    // Always update the updatedAt timestamp
    updateFields.push(`"updatedAt" = NOW()`);

    // Add case ID as the last parameter
    values.push(parseInt(id));

    const updateQuery = `
      UPDATE cases
      SET ${updateFields.join(', ')}
      WHERE "caseId" = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info('Case updated', {
      userId: req.user?.id,
      caseId: id,
      updatedFields: updateFields.filter(field => !field.includes('updatedAt')),
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Case updated successfully',
    });
  } catch (error) {
    logger.error('Error updating case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update case',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

export const assignCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { assignedToId, reason } = req.body;

    // Import the service here to avoid circular dependencies
    const { CaseAssignmentService } = await import('../services/caseAssignmentService');

    // Use the queue-based assignment service
    const result = await CaseAssignmentService.assignCase({
      caseId: id,
      assignedToId,
      assignedById: req.user?.id!,
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
      assignedById: req.user?.id!,
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
    const { batchId } = req.params;

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
    const { id } = req.params;
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
      assignedById: req.user?.id!,
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
    const { id } = req.params;

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

// POST /api/cases/with-attachments - Create case with attachments in single request
export const createCaseWithAttachments = async (req: AuthenticatedRequest, res: Response) => {
  // Use multer middleware to handle file uploads
  uploadForCaseCreation.array('attachments', 10)(req, res, async (err) => {
    if (err) {
      logger.error('File upload error during case creation:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed during case creation',
        error: { code: 'UPLOAD_ERROR' },
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        customerName,
        customerPhone,
        customerCallingCode,
        clientId,
        productId,
        verificationTypeId,
        address,
        pincode,
        priority = 'MEDIUM',
        trigger,
        applicantType = 'APPLICANT'
      } = req.body;

      // Validate required fields
      if (!customerName || !customerPhone || !clientId || !productId || !verificationTypeId || !address) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          error: { code: 'VALIDATION_ERROR' },
        });
      }

      // Validate client access (inline since middleware can't access form data)
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        // Check if user has access to this client
        const clientAccessQuery = `
          SELECT 1 FROM user_client_access
          WHERE "userId" = $1 AND "clientId" = $2
        `;
        const accessResult = await client.query(clientAccessQuery, [userId, clientId]);

        if (accessResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(403).json({
            success: false,
            message: 'Access denied: You do not have permission to create cases for this client',
            error: { code: 'ACCESS_DENIED' },
          });
        }
      }

      // Step 1: Create the case
      const insertCaseQuery = `
        INSERT INTO cases (
          "customerName", "customerPhone", "customerCallingCode",
          "clientId", "productId", "verificationTypeId",
          address, pincode, priority, trigger, "applicantType",
          status, "createdByBackendUser", "backendContactNumber", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING *
      `;

      const caseValues = [
        customerName,
        customerPhone,
        customerCallingCode,
        clientId,
        productId,
        verificationTypeId,
        address,
        pincode,
        priority,
        trigger,
        applicantType,
        'PENDING',
        req.user?.id,
        customerPhone // Use customer phone as backend contact number for now
      ];

      const caseResult = await client.query(insertCaseQuery, caseValues);
      const newCase = caseResult.rows[0];
      const caseId = newCase.caseId;
      const caseUUID = newCase.id; // Get the UUID for mobile compatibility

      // Step 2: Process uploaded files if any
      const files = req.files as Express.Multer.File[];
      const uploadedAttachments: any[] = [];

      if (files && files.length > 0) {
        // Create permanent directory for this case
        const permanentDir = path.join(process.cwd(), 'uploads', 'attachments', `case_${caseId}`);
        if (!fs.existsSync(permanentDir)) {
          fs.mkdirSync(permanentDir, { recursive: true });
        }

        for (const file of files) {
          try {
            // Move file from temp to permanent location
            const tempPath = file.path;
            const permanentPath = path.join(permanentDir, file.filename);
            fs.renameSync(tempPath, permanentPath);

            // Insert attachment record into database
            const insertAttachmentQuery = `
              INSERT INTO attachments (
                filename, "originalName", "filePath", "fileSize",
                "mimeType", "uploadedBy", "caseId", case_id, "createdAt"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
              RETURNING *
            `;

            const attachmentValues = [
              file.filename,
              file.originalname,
              `/uploads/attachments/case_${caseId}/${file.filename}`,
              file.size,
              file.mimetype,
              req.user?.id,
              caseId,
              caseUUID  // Add the case UUID for mobile compatibility
            ];

            const attachmentResult = await client.query(insertAttachmentQuery, attachmentValues);
            uploadedAttachments.push(attachmentResult.rows[0]);

            logger.info('Attachment uploaded and saved', {
              caseId,
              filename: file.filename,
              originalName: file.originalname,
              size: file.size,
              userId: req.user?.id,
            });

          } catch (fileError) {
            logger.error('Error processing individual file:', fileError);
            // Continue with other files, don't fail the entire operation
          }
        }

        // Clean up temp directory
        try {
          const tempDir = path.dirname(files[0].path);
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (cleanupError) {
          logger.warn('Failed to clean up temp directory:', cleanupError);
        }
      }

      await client.query('COMMIT');

      logger.info('Case created with attachments', {
        userId: req.user?.id,
        caseId: caseId,
        attachmentCount: uploadedAttachments.length,
      });

      res.status(201).json({
        success: true,
        data: {
          case: newCase,
          attachments: uploadedAttachments,
          attachmentCount: uploadedAttachments.length,
        },
        message: `Case created successfully with ${uploadedAttachments.length} attachment(s)`,
      });

    } catch (error) {
      await client.query('ROLLBACK');

      // Clean up any uploaded files on error
      const files = req.files as Express.Multer.File[];
      if (files && files.length > 0) {
        try {
          const tempDir = path.dirname(files[0].path);
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (cleanupError) {
          logger.warn('Failed to clean up files after error:', cleanupError);
        }
      }

      logger.error('Error creating case with attachments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create case with attachments',
        error: { code: 'INTERNAL_ERROR' },
      });
    } finally {
      client.release();
    }
  });
};

// Export cases to Excel
export const exportCases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      status,
      search,
      assignedTo,
      clientId,
      priority,
      dateFrom,
      dateTo,
      exportType = 'all' // 'all', 'pending', 'in-progress', 'completed'
    } = req.query;

    // Build the query based on filters
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
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
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        c."customerName" ILIKE $${paramIndex} OR
        c."customerPhone" ILIKE $${paramIndex} OR
        c."caseId"::text ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (assignedTo) {
      whereConditions.push(`c."assignedToId" = $${paramIndex}`);
      queryParams.push(assignedTo);
      paramIndex++;
    }

    if (clientId) {
      whereConditions.push(`c."clientId" = $${paramIndex}`);
      queryParams.push(clientId);
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`c.priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    if (dateFrom) {
      whereConditions.push(`c."createdAt" >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`c."createdAt" <= $${paramIndex}`);
      queryParams.push(dateTo + ' 23:59:59');
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
        c.address,
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
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN products p ON c."productId" = p.id
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
    const worksheet = workbook.addWorksheet(`Cases Export - ${exportType || 'All'}`);

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
      { header: 'Updated At', key: 'updated_at', width: 20 }
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
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Add data rows
    cases.forEach((caseItem: any) => {
      const rowData: any = {
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
        created_at: caseItem.created_at ? new Date(caseItem.created_at).toLocaleString() : '',
        updated_at: caseItem.updated_at ? new Date(caseItem.updated_at).toLocaleString() : '',
        completed_at: caseItem.completed_at ? new Date(caseItem.completed_at).toLocaleString() : '',
        verification_outcome: caseItem.verification_outcome || '',
        created_by_backend_user_name: caseItem.created_by_backend_user_name || 'Unknown',
        pending_duration_hours: caseItem.pending_duration_seconds ?
          Math.round(caseItem.pending_duration_seconds / 3600 * 100) / 100 : ''
      };

      worksheet.addRow(rowData);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
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
      'all': 'All_Cases',
      'pending': 'Pending_Cases',
      'in-progress': 'In_Progress_Cases',
      'completed': 'Completed_Cases'
    };

    const tabName = tabNameMap[exportType as string] || 'All_Cases';
    const filename = `${tabName}_Export_${dateStr}_${timeStr}.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};;