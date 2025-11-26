import type { Request, Response } from 'express';
import type {
  MobileCaseListRequest,
  MobileCaseResponse,
  MobileAutoSaveRequest,
  MobileAutoSaveResponse,
} from '../types/mobile';
import { createAuditLog } from '../utils/auditLogger';
import { config } from '../config';
import { query } from '@/config/database';
import { queueCaseRevocationNotification } from '../queues/notificationQueue';

/**
 * Get the appropriate API base URL based on request headers
 */
function getApiBaseUrl(req: Request): string {
  const host = req.get('host');
  const _protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');

  // Check if request is coming from domain
  if (
    host &&
    (host.includes('example.com') || host.includes('www.example.com'))
  ) {
    return 'https://example.com/api';
  }

  // Check if request is coming from static IP (configurable)
  const staticIP = process.env.STATIC_IP;
  if (staticIP && host && host.includes(staticIP)) {
    return `http://${staticIP}:3000/api`;
  }

  // Default to localhost or environment variable
  return process.env.API_BASE_URL || 'http://localhost:3000/api';
}

export class MobileCaseController {
  // Get cases for mobile app with optimized response
  static async getMobileCases(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      const {
        page = 1,
        limit = 20,
        status,
        search,
        assignedTo,
        priority,
        dateFrom,
        dateTo,
        lastSyncTimestamp,
      }: MobileCaseListRequest = req.query as any;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Math.min(Number(limit), config.mobile.syncBatchSize);

      // Build where clause
      const where: any = {};

      // Role-based filtering
      // For FIELD_AGENT: Filter by task-level assignment (verification_tasks.assigned_to)
      // For other roles: Filter by task-level assignment if specified
      if (userRole === 'FIELD_AGENT') {
        where.hasAssignedTask = userId; // Task-level assignment
      } else if (assignedTo) {
        where.hasAssignedTask = assignedTo; // Task-level assignment
      }

      if (status) {
        where.status = status;
      }

      if (priority) {
        where.priority = Number(priority);
      }

      if (search) {
        where.OR = [
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerPhone: { contains: search } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) {
          where.createdAt.gte = new Date(dateFrom);
        }
        if (dateTo) {
          where.createdAt.lte = new Date(dateTo);
        }
      }

      // Sync-specific filtering
      if (lastSyncTimestamp) {
        where.updatedAt = {
          gt: new Date(lastSyncTimestamp),
        };
      }

      // Build dynamic SQL for where
      const vals: any[] = [];
      const wh: string[] = [];

      // Filter by task-level assignment (for both FIELD_AGENT and other roles)
      if (where.hasAssignedTask) {
        vals.push(where.hasAssignedTask);
        wh.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.assigned_to = $${vals.length}
        )`);
      }

      if (where.status) {
        vals.push(where.status);
        wh.push(`c.status = $${vals.length}`);
      }
      if (where.priority) {
        vals.push(where.priority);
        wh.push(`c.priority = $${vals.length}`);
      }
      if (where.updatedAt?.gt) {
        vals.push(where.updatedAt.gt);
        wh.push(`c."updatedAt" > $${vals.length}`);
      }
      if (search) {
        vals.push(`%${search}%`);
        wh.push(
          `(c."customerName" ILIKE $${vals.length} OR c."customerPhone" ILIKE $${vals.length} OR c.title ILIKE $${vals.length} OR c.description ILIKE $${vals.length})`
        );
      }
      if (dateFrom) {
        vals.push(new Date(dateFrom));
        wh.push(`c."createdAt" >= $${vals.length}`);
      }
      if (dateTo) {
        vals.push(new Date(dateTo));
        wh.push(`c."createdAt" <= $${vals.length}`);
      }
      const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

      console.log('🔍 Mobile API Debug:', {
        userId,
        userRole,
        where,
        whereSql,
        vals,
      });

      // For FIELD_AGENT: Add userId to vals for LATERAL JOIN to filter their assigned task
      const userIdForTaskFilter = userRole === 'FIELD_AGENT' ? userId : null;
      const taskFilterParamIndex = vals.length + 1;

      const listSql = `
        SELECT c.*,
               -- All 13 required fields for mobile app
               -- Field 3: Client
               cl.id as "clientId",
               cl.name as "clientName",
               cl.code as "clientCode",
               -- Field 4: Product
               p.id as "productId",
               p.name as "productName",
               p.code as "productCode",
               -- Field 5: Verification Type
               vtype.id as "verificationTypeId",
               vtype.name as "verificationTypeName",
               vtype.code as "verificationTypeCode",
               -- Rate type information (for Area and Rate Type columns) - from task level
               vtask.rate_type_name as "rateTypeName",
               vtask.rate_type_description as "rateTypeDescription",
               -- Area information derived from rate type (local/ogl classification)
               CASE
                 WHEN LOWER(vtask.rate_type_name) LIKE '%local%' OR LOWER(vtask.rate_type_description) LIKE '%local%' THEN 'local'
                 WHEN LOWER(vtask.rate_type_name) LIKE '%ogl%' OR LOWER(vtask.rate_type_description) LIKE '%ogl%' THEN 'ogl'
                 ELSE 'standard'
               END as "areaType",
               -- Field 7: Created By Backend User
               cu.id as "createdByUserId",
               cu.name as "createdByUserName",
               cu.email as "createdByUserEmail",
               -- Verification Task Information
               -- For FIELD_AGENT: Show their assigned task
               -- For other roles: Show first task
               vtask.id as "verificationTaskId",
               vtask.task_number as "verificationTaskNumber",
               vtask.address as "taskAddress",
               vtask.trigger as "taskTrigger",
               vtask.priority as "taskPriority",
               vtask.applicant_type as "taskApplicantType",
               vtask.assigned_to as "taskAssignedTo",
               vtask.assigned_user_name,
               vtask.task_status,
               vtask.task_completed_at,
               vtask.assigned_at,
               vtask.task_created_at,
               -- Attachment count
               COALESCE(att_count.attachment_count, 0) as "attachmentCount"
        FROM cases c
        LEFT JOIN clients cl ON cl.id = c."clientId"
        LEFT JOIN products p ON p.id = c."productId"
        LEFT JOIN "verificationTypes" vtype ON vtype.id = c."verificationTypeId"
        LEFT JOIN users cu ON cu.id = c."createdByBackendUser"
        LEFT JOIN LATERAL (
          SELECT vt.id, vt.task_number, vt.address, vt.trigger, vt.priority, vt.applicant_type,
                 vt.assigned_to, vt.assigned_at, vt.created_at as task_created_at,
                 vt.status as task_status, vt.completed_at as task_completed_at,
                 u.name as assigned_user_name,
                 rt.name as rate_type_name, rt.description as rate_type_description
          FROM verification_tasks vt
          LEFT JOIN users u ON u.id = vt.assigned_to
          LEFT JOIN "rateTypes" rt ON rt.id = vt.rate_type_id
          WHERE vt.case_id = c.id
          AND (
            $${taskFilterParamIndex}::uuid IS NULL  -- For non-field-agents, show first task
            OR vt.assigned_to = $${taskFilterParamIndex}::uuid  -- For field agents, show their task
          )
          ORDER BY
            CASE WHEN vt.assigned_to = $${taskFilterParamIndex}::uuid THEN 0 ELSE 1 END,  -- Prioritize user's task
            CASE WHEN vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS') THEN 0 ELSE 1 END,  -- Prioritize active tasks over completed
            vt.created_at DESC  -- Show newest task first (Revisit tasks are newer)
          LIMIT 1
        ) vtask ON true
        LEFT JOIN (
          SELECT "caseId", COUNT(*) as attachment_count
          FROM attachments
          GROUP BY "caseId"
        ) att_count ON att_count."caseId" = c."caseId"
        ${whereSql}
        ORDER BY c.priority DESC, c."createdAt" DESC
        LIMIT $${vals.length + 2} OFFSET $${vals.length + 3}`;
      console.log('📊 Mobile Cases Query:', { whereSql, vals, userIdForTaskFilter, take, skip });
      const casesRes = await query(listSql, [...vals, userIdForTaskFilter, take, skip]);

      // Count query - use same filtering logic as main query
      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM cases c ${whereSql}`,
        vals
      );
      const totalCount = Number(countRes.rows[0]?.count || 0);
      const cases = casesRes.rows;

      console.log('📋 Mobile Cases Results:', {
        totalCount,
        casesFound: cases.length,
        userRole,
        userId,
        firstCaseAssignedTo: cases[0]?.assignedTo,
        firstCaseId: cases[0]?.caseId,
      });

      // Debug: Log first case data to see what fields are actually returned
      if (cases.length > 0) {
        console.log('🔍 First Case Raw Data:', {
          caseId: cases[0].caseId,
          customerName: cases[0].customerName,
          address: cases[0].address,
          trigger: cases[0].trigger,
          clientName: cases[0].clientName,
          productName: cases[0].productName,
          verificationTypeName: cases[0].verificationTypeName,
          assignedToUserName: cases[0].assignedToUserName,
          createdByUserName: cases[0].createdByUserName,
        });
      }

      // Transform cases for mobile response with all required assignment fields
      const mobileCases: MobileCaseResponse[] = cases.map(caseItem => ({
        // CRITICAL FIX: Use Verification Task ID as the unique identifier for the list item
        // This allows multiple tasks for the same case (e.g. Revisit) to appear as separate items
        id: caseItem.verificationTaskId || caseItem.id,
        caseId: caseItem.caseId, // User-friendly auto-incrementing case ID
        // CRITICAL FIX: Show Task Number as title for field agents to distinguish Revisit tasks
        title: caseItem.verificationTaskNumber || caseItem.customerName || 'Verification Case',
        description: `${caseItem.verificationTypeName || 'Verification'} for ${caseItem.customerName}`,
        customerName: caseItem.customerName || caseItem.applicantName, // Customer Name
        customerCallingCode: caseItem.customerCallingCode, // Customer Calling Code
        customerPhone: caseItem.customerPhone,
        // Use task-level address (from verification_tasks) instead of case-level address
        addressStreet: caseItem.taskAddress || '',
        addressCity: '',
        addressState: '',
        addressPincode: caseItem.pincode || '',
        latitude: caseItem.latitude,
        longitude: caseItem.longitude,
        // CRITICAL FIX: Use task-level status instead of case-level status for field agents
        // This ensures field agents see their individual task status, not the overall case status
        status: caseItem.task_status
          ? caseItem.task_status.toUpperCase().replace(/\s+/g, '_')
          : 'ASSIGNED',
        priority: caseItem.taskPriority || caseItem.priority || 'MEDIUM', // Use task-level priority first, fallback to case-level
        assignedAt: caseItem.assigned_at
          ? new Date(caseItem.assigned_at).toISOString()
          : new Date(caseItem.task_created_at || caseItem.createdAt).toISOString(),
        updatedAt: new Date(caseItem.updatedAt).toISOString(),
        // CRITICAL FIX: Use task-level completedAt instead of case-level completedAt
        completedAt: caseItem.task_completed_at
          ? new Date(caseItem.task_completed_at).toISOString()
          : undefined,
        notes: caseItem.taskTrigger || caseItem.trigger || '', // Use task-level trigger instead of case-level trigger
        verificationType: caseItem.verificationTypeName || caseItem.verificationType,
        verificationOutcome: caseItem.verificationOutcome,
        applicantType: caseItem.taskApplicantType || caseItem.applicantType, // Use task-level applicant type first, fallback to case-level
        backendContactNumber: caseItem.backendContactNumber, // Backend Contact Number
        createdByBackendUser: caseItem.createdByUserName, // Created By Backend User
        assignedToFieldUser: caseItem.assigned_user_name, // Use task-level assigned user
        verificationTaskId: caseItem.verificationTaskId, // Verification Task UUID
        verificationTaskNumber: caseItem.verificationTaskNumber, // Verification Task Number (e.g., VT-000127)
        client: {
          id: caseItem.clientId || 0, // Use number instead of string
          name: caseItem.clientName || '', // Client
          code: caseItem.clientCode || '',
        },
        product: caseItem.productId
          ? {
              id: caseItem.productId || 0, // Use number instead of string
              name: caseItem.productName || '', // Product
              code: caseItem.productCode || '',
            }
          : undefined,
        verificationTypeDetails: caseItem.verificationTypeId
          ? {
              id: caseItem.verificationTypeId || 0, // Use number instead of string
              name: caseItem.verificationTypeName || '', // Verification Type
              code: caseItem.verificationTypeCode || '',
            }
          : undefined,
        attachments: [],
        attachmentCount: Number(caseItem.attachmentCount) || 0,
        formData: caseItem.verificationData || null,
        syncStatus: 'SYNCED',
      }));

      const totalPages = Math.ceil(totalCount / take);
      const hasMore = Number(page) < totalPages;

      res.json({
        success: true,
        message: 'Cases retrieved successfully',
        data: {
          cases: mobileCases,
          pagination: {
            page: Number(page),
            limit: take,
            total: totalCount,
            totalPages,
            hasMore,
          },
          syncTimestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Get mobile cases error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'CASES_FETCH_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get single case for mobile
  static async getMobileCase(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      const _where: any = { id: caseId };

      // Role-based access control
      // For FIELD_AGENT: Check if they have an assigned task for this case
      // For other roles: No additional filtering
      // Check if the ID provided is actually a Verification Task ID
      // This is needed because we now return Task ID as 'id' in the list for field agents
      let lookupCaseId = caseId;
      let specificTaskId = null;

      // Check if it looks like a UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId)) {
        const taskRes = await query(`SELECT case_id FROM verification_tasks WHERE id = $1`, [caseId]);
        if (taskRes.rows.length > 0) {
          lookupCaseId = taskRes.rows[0].case_id;
          specificTaskId = caseId;
        }
      }

      const vals2: any[] = [lookupCaseId];
      const _userIdForTaskFilter = userRole === 'FIELD_AGENT' ? userId : null;

      let caseSql = `
        SELECT c.*,
               cl.id as "clientId", cl.name as "clientName", cl.code as "clientCode",
               p.id as "productId", p.name as "productName", p.code as "productCode",
               vtype.id as "verificationTypeId", vtype.name as "verificationTypeName", vtype.code as "verificationTypeCode",
               cu.name as "createdByUserName",
               vtask.id as "verificationTaskId",
               vtask.task_number as "verificationTaskNumber",
               vtask.address as "taskAddress",
               vtask.trigger as "taskTrigger",
               vtask.priority as "taskPriority",
               vtask.applicant_type as "taskApplicantType",
               vtask.assigned_to as "taskAssignedTo",
               vtask.assigned_user_name
        FROM cases c
        LEFT JOIN clients cl ON cl.id = c."clientId"
        LEFT JOIN products p ON p.id = c."productId"
        LEFT JOIN "verificationTypes" vtype ON vtype.id = c."verificationTypeId"
        LEFT JOIN users cu ON cu.id = c."createdByBackendUser"
        LEFT JOIN LATERAL (
          SELECT vt.id, vt.task_number, vt.address, vt.trigger, vt.priority, vt.applicant_type,
                 vt.assigned_to, vt.assigned_at, vt.created_at as task_created_at,
                 vt.status as task_status, vt.completed_at as task_completed_at,
                 u.name as assigned_user_name
          FROM verification_tasks vt
          LEFT JOIN users u ON u.id = vt.assigned_to
          WHERE vt.case_id = c.id
          AND (
            $3::uuid IS NOT NULL AND vt.id = $3::uuid -- If specific task requested, must match
            OR
            $3::uuid IS NULL AND (
              $2::uuid IS NULL  -- For non-field-agents, show first task
              OR vt.assigned_to = $2::uuid  -- For field agents, show their task
            )
          )
          ORDER BY
            CASE WHEN $3::uuid IS NOT NULL AND vt.id = $3::uuid THEN 0 ELSE 1 END, -- Prioritize specific task
            CASE WHEN vt.assigned_to = $2::uuid THEN 0 ELSE 1 END,  -- Prioritize user's task
            CASE WHEN vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS') THEN 0 ELSE 1 END,  -- Prioritize active tasks over completed
            vt.created_at DESC  -- Show newest task first (Revisit tasks are newer)
          LIMIT 1
        ) vtask ON true
        WHERE c.id = $1`;

      // For FIELD_AGENT: Add task-level access control
      if (userRole === 'FIELD_AGENT') {
        caseSql += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.assigned_to = $2
        )`;
        vals2.push(userId);
      } else {
        vals2.push(null); // For non-field-agents, pass NULL for task filter
      }
      
      // Add specificTaskId as 3rd parameter
      vals2.push(specificTaskId);

      const caseRes = await query(caseSql, vals2);
      const caseItem = caseRes.rows[0];

      if (!caseItem) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'CASE_NOT_FOUND', timestamp: new Date().toISOString() },
        });
      }

      const attRes2 = await query(
        `
        SELECT
          id,
          filename,
          "originalName",
          "mimeType",
          "fileSize" as size,
          "filePath",
          "uploadedBy",
          "createdAt" as "uploadedAt",
          "caseId"
        FROM attachments
        WHERE "caseId" = $1
        ORDER BY "createdAt" DESC
      `,
        [caseId]
      );
      const _locRes = await query(
        `SELECT id, latitude, longitude, accuracy, timestamp, source FROM locations WHERE "caseId" = $1 ORDER BY timestamp DESC LIMIT 10`,
        [caseId]
      );

      if (!caseItem) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const mobileCase: MobileCaseResponse = {
        id: caseItem.id,
        caseId: caseItem.caseId, // User-friendly auto-incrementing case ID
        // CRITICAL FIX: Show Task Number as title for field agents to distinguish Revisit tasks
        title: caseItem.verificationTaskNumber || caseItem.customerName || 'Verification Case',
        description: `${caseItem.verificationTypeName || 'Verification'} for ${caseItem.customerName}`,
        customerName: caseItem.customerName || caseItem.applicantName, // Customer Name
        customerCallingCode: caseItem.customerCallingCode, // Customer Calling Code
        customerPhone: caseItem.customerPhone,
        // Use task-level address (from verification_tasks) instead of case-level address
        addressStreet: caseItem.taskAddress || '',
        addressCity: '',
        addressState: '',
        addressPincode: caseItem.pincode || '',
        latitude: caseItem.latitude,
        longitude: caseItem.longitude,
        // CRITICAL FIX: Use task-level status instead of case-level status for field agents
        status: caseItem.task_status
          ? caseItem.task_status.toUpperCase().replace(/\s+/g, '_')
          : 'ASSIGNED',
        priority: caseItem.taskPriority || caseItem.priority || 'MEDIUM', // Use task-level priority first, fallback to case-level
        assignedAt: caseItem.assigned_at
          ? new Date(caseItem.assigned_at).toISOString()
          : new Date(caseItem.task_created_at || caseItem.createdAt).toISOString(),
        updatedAt: new Date(caseItem.updatedAt).toISOString(),
        // CRITICAL FIX: Use task-level completedAt instead of case-level completedAt
        completedAt: caseItem.task_completed_at
          ? new Date(caseItem.task_completed_at).toISOString()
          : undefined,
        notes: caseItem.taskTrigger || caseItem.trigger || '', // Use task-level trigger instead of case-level trigger
        verificationType: caseItem.verificationTypeName || caseItem.verificationType,
        verificationOutcome: caseItem.verificationOutcome,
        applicantType: caseItem.taskApplicantType || caseItem.applicantType, // Use task-level applicant type first, fallback to case-level
        backendContactNumber: caseItem.backendContactNumber, // Backend Contact Number
        createdByBackendUser: caseItem.createdByUserName, // Created By Backend User
        assignedToFieldUser: caseItem.assigned_user_name, // Use task-level assigned user
        verificationTaskId: caseItem.verificationTaskId, // Verification Task UUID
        verificationTaskNumber: caseItem.verificationTaskNumber, // Verification Task Number (e.g., VT-000127)
        client: {
          id: caseItem.clientId || 0, // Use number instead of string
          name: caseItem.clientName || '', // Client
          code: caseItem.clientCode || '',
        },
        product: caseItem.productId
          ? {
              id: caseItem.productId || 0, // Use number instead of string
              name: caseItem.productName || '', // Product
              code: caseItem.productCode || '',
            }
          : undefined,
        verificationTypeDetails: caseItem.verificationTypeId
          ? {
              id: caseItem.verificationTypeId || 0, // Use number instead of string
              name: caseItem.verificationTypeName || '', // Verification Type
              code: caseItem.verificationTypeCode || '',
            }
          : undefined,
        attachments: attRes2.rows.map((att: any) => {
          const apiBaseUrl = getApiBaseUrl(req);
          return {
            id: att.id,
            filename: att.filename,
            originalName: att.originalName,
            mimeType: att.mimeType,
            size: att.size,
            url: `${apiBaseUrl}/attachments/${att.id}/serve`,
            downloadUrl: `${apiBaseUrl}/attachments/${att.id}/download`,
            uploadedAt: new Date(att.uploadedAt).toISOString(),
            uploadedBy: att.uploadedBy,
            type: att.mimeType.startsWith('image/') ? 'image' : 'document',
            isImage: att.mimeType.startsWith('image/'),
            caseId: att.caseId,
          };
        }),
        formData: caseItem.verificationData || null,
        syncStatus: 'SYNCED',
      };

      res.json({
        success: true,
        message: 'Case retrieved successfully',
        data: mobileCase,
      });
    } catch (error) {
      console.error('Get mobile case error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'CASE_FETCH_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Update case status from mobile
  static async updateCaseStatus(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { status, notes = null } = req.body;
      const userId = (req as any).user?.id; // Fixed: auth middleware sets 'id', not 'userId'
      const userRole = (req as any).user?.role;

      console.log(`📱 Mobile case status update request:`, {
        caseId,
        status,
        notes,
        userId,
        userRole,
      });

      // Check if caseId is a UUID (mobile sends UUID) or case number (web sends case number)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

      const vals3: any[] = [caseId];
      let exSql: string;

      if (isUUID) {
        // Mobile app sends UUID
        exSql = `SELECT id, "caseId", status, trigger, "completedAt" FROM cases WHERE id = $1`;
      } else {
        // Web app sends case number
        exSql = `SELECT id, "caseId", status, trigger, "completedAt" FROM cases WHERE "caseId" = $1`;
      }

      if (userRole === 'FIELD_AGENT') {
        exSql += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = cases.id
          AND vt.assigned_to = $2
        )`;
        vals3.push(userId);
      }

      console.log(`🔍 Executing query: ${exSql} with values:`, vals3);
      const exRes = await query(exSql, vals3);
      const existingCase = exRes.rows[0];

      if (!existingCase) {
        console.log(`❌ Case not found: ${caseId} (isUUID: ${isUUID})`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            caseId,
            isUUID,
          },
        });
      }

      console.log(`✅ Case found:`, existingCase);
      const compAt = status === 'COMPLETED' ? new Date() : existingCase.completedat;
      const actualCaseId = existingCase.id; // Use the actual UUID from the database

      await query(
        `UPDATE cases SET status = $1, trigger = COALESCE($2, trigger), "completedAt" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4`,
        [status, notes, compAt, actualCaseId]
      );
      const updRes = await query(
        `SELECT id, "caseId", status, "updatedAt", "completedAt" FROM cases WHERE id = $1`,
        [actualCaseId]
      );
      const updatedCase = updRes.rows[0];

      console.log(`✅ Case status updated successfully:`, updatedCase);

      await createAuditLog({
        action: 'CASE_STATUS_UPDATED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          oldStatus: existingCase.status,
          newStatus: status,
          notes,
          source: 'MOBILE_APP',
          caseNumber: existingCase.caseId,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Auto-calculate commission if case is completed
      if (status === 'COMPLETED') {
        try {
          const { autoCalculateCommissionForCase } = await import(
            '../controllers/commissionManagementController'
          );
          await autoCalculateCommissionForCase(actualCaseId);
        } catch (error) {
          console.error('Error auto-calculating commission:', error);
          // Don't fail the case update if commission calculation fails
        }
      }

      // Emit WebSocket events to notify frontend about case status change
      try {
        const { emitCaseStatusChanged, emitCaseUpdate, getSocketIO } = await import(
          '../websocket/server'
        );
        const username = (req as any).user?.username || 'Mobile User';

        // Emit case status change notification
        emitCaseStatusChanged(actualCaseId, existingCase.status, status, username);

        // Emit general case update notification
        emitCaseUpdate(getSocketIO(), actualCaseId, {
          type: 'STATUS_UPDATE',
          status,
          updatedBy: username,
          source: 'MOBILE_APP',
          caseNumber: existingCase.caseId,
        });

        console.log(
          `🔔 WebSocket notifications sent for case ${actualCaseId} status change: ${existingCase.status} -> ${status}`
        );
      } catch (error) {
        console.error('Error sending WebSocket notifications:', error);
        // Don't fail the case update if WebSocket notification fails
      }

      res.json({
        success: true,
        message: 'Case status updated successfully',
        data: {
          id: updatedCase.id,
          caseId: updatedCase.caseId,
          status: updatedCase.status,
          updatedAt: updatedCase.updatedAt.toISOString(),
          completedAt: updatedCase.completedAt?.toISOString(),
        },
      });
    } catch (error) {
      console.error('Update case status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'STATUS_UPDATE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Update case priority from mobile
  static async updateCasePriority(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { priority } = req.body;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      if (userRole === 'FIELD_AGENT') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update priority',
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const vals6: any[] = [caseId];
      let exSql4 = `SELECT id FROM cases WHERE id = $1`;
      if (userRole === 'FIELD_AGENT') {
        exSql4 += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = cases.id
          AND vt.assigned_to = $2
        )`;
        vals6.push(userId);
      }
      const exRes4 = await query(exSql4, vals6);
      const existingCase = exRes4.rows[0];
      if (!existingCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      await query(`UPDATE cases SET priority = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`, [
        Number(priority),
        caseId,
      ]);
      const updRes2 = await query(`SELECT id, priority, "updatedAt" FROM cases WHERE id = $1`, [
        caseId,
      ]);
      const updatedCase = updRes2.rows[0];

      await createAuditLog({
        action: 'CASE_PRIORITY_UPDATED',
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          oldPriority: existingCase.priority,
          newPriority: priority,
          source: 'MOBILE_APP',
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: 'Case priority updated successfully',
        data: {
          id: updatedCase.id,
          priority: updatedCase.priority,
          updatedAt: updatedCase.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('Update case priority error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'PRIORITY_UPDATE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Auto-save form data
  static async autoSaveForm(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formType, formData, timestamp }: MobileAutoSaveRequest = req.body;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      console.log(`📱 Auto-save request for case ${caseId}, formType: ${formType}`);

      // Check if caseId is a UUID (mobile sends UUID) or case number (web sends case number)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

      const vals5: any[] = [caseId];
      let exSql3: string;

      if (isUUID) {
        // Mobile app sends UUID
        exSql3 = `SELECT id FROM cases WHERE id = $1`;
      } else {
        // Web app sends case number
        exSql3 = `SELECT id FROM cases WHERE "caseId" = $1`;
      }

      if (userRole === 'FIELD_AGENT') {
        exSql3 += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = cases.id
          AND vt.assigned_to = $2
        )`;
        vals5.push(userId);
      }

      const exRes3 = await query(exSql3, vals5);
      const existingCase = exRes3.rows[0];
      if (!existingCase) {
        console.log(`❌ Auto-save: Case not found: ${caseId} (isUUID: ${isUUID})`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            caseId,
            isUUID,
          },
        });
      }

      const actualCaseId = existingCase.id; // Use the actual UUID from the database

      // Save or update auto-save data
      const exAuto = await query(
        `SELECT id FROM "autoSaves" WHERE "caseId" = $1 AND "formType" = $2`,
        [actualCaseId, formType]
      );
      let autoSaveData: any;
      if (exAuto.rowCount && exAuto.rowCount > 0) {
        const upd = await query(
          `UPDATE "autoSaves" SET "formData" = $1, timestamp = $2 WHERE id = $3 RETURNING *`,
          [JSON.stringify(formData), new Date(timestamp), exAuto.rows[0].id]
        );
        autoSaveData = upd.rows[0];
      } else {
        const ins = await query(
          `INSERT INTO "autoSaves" (id, "caseId", "formType", "formData", timestamp) VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING *`,
          [actualCaseId, formType, JSON.stringify(formData), new Date(timestamp)]
        );
        autoSaveData = ins.rows[0];
      }

      const response: MobileAutoSaveResponse = {
        success: true,
        message: 'Form auto-saved successfully',
        data: {
          savedAt: autoSaveData.timestamp.toISOString(),
          version: 1, // Default version since we removed the field
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Auto-save form error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'AUTO_SAVE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get auto-saved form data
  static async getAutoSavedForm(req: Request, res: Response) {
    try {
      const { caseId, formType } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;

      console.log(`📱 Get auto-saved form for case ${caseId}, formType: ${formType}`);

      // Check if caseId is a UUID (mobile sends UUID) or case number (web sends case number)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

      const vals7: any[] = [caseId];
      let exSql5: string;

      if (isUUID) {
        // Mobile app sends UUID
        exSql5 = `SELECT id FROM cases WHERE id = $1`;
      } else {
        // Web app sends case number
        exSql5 = `SELECT id FROM cases WHERE "caseId" = $1`;
      }

      if (userRole === 'FIELD_AGENT') {
        exSql5 += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = cases.id
          AND vt.assigned_to = $2
        )`;
        vals7.push(userId);
      }

      const exRes5 = await query(exSql5, vals7);
      const existingCase = exRes5.rows[0];

      if (!existingCase) {
        console.log(`❌ Get auto-saved: Case not found: ${caseId} (isUUID: ${isUUID})`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            caseId,
            isUUID,
          },
        });
      }

      const actualCaseId = existingCase.id; // Use the actual UUID from the database
      const autoRes = await query(
        `SELECT * FROM "autoSaves" WHERE "caseId" = $1 AND "formType" = $2 LIMIT 1`,
        [actualCaseId, formType.toUpperCase()]
      );
      const autoSaveData = autoRes.rows[0];
      if (!autoSaveData) {
        return res.status(404).json({
          success: false,
          message: 'No auto-saved data found',
          error: { code: 'AUTO_SAVE_NOT_FOUND', timestamp: new Date().toISOString() },
        });
      }

      res.json({
        success: true,
        message: 'Auto-saved form data retrieved successfully',
        data: {
          formData: JSON.parse(autoSaveData.formData),
          savedAt: autoSaveData.timestamp.toISOString(),
          version: 1, // Default version since we removed the field
        },
      });
    } catch (error) {
      console.error('Get auto-saved form error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'AUTO_SAVE_FETCH_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Revoke case from mobile app
  static async revokeCase(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Mobile case revocation request:`, {
        caseId,
        reason,
        userId,
        userRole,
      });

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Revocation reason is required',
          error: {
            code: 'REASON_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(
        `
        SELECT c.id, c."caseId", c."customerName", c.status, c."createdByBackendUser",
               vt.assigned_to
        FROM cases c
        LEFT JOIN verification_tasks vt ON vt.case_id = c.id
        WHERE c.id = $1
        ${userRole === 'FIELD_AGENT' ? 'AND vt.assigned_to = $2' : ''}
      `,
        userRole === 'FIELD_AGENT' ? [caseId, userId] : [caseId]
      );

      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const caseData = caseQuery.rows[0];

      // Check if case can be revoked (not already completed)
      if (caseData.status === 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Cannot revoke a completed case',
          error: {
            code: 'CASE_ALREADY_COMPLETED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Update case status to revoked
      await query(
        `
        UPDATE cases
        SET status = 'REVOKED',
            "revokedAt" = CURRENT_TIMESTAMP,
            "revokedBy" = $1,
            "revocationReason" = $2,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $3
      `,
        [userId, reason, caseId]
      );

      // Get field user information
      const fieldUserQuery = await query(
        `
        SELECT name, "employeeId" FROM users WHERE id = $1
      `,
        [userId]
      );
      const fieldUserName = fieldUserQuery.rows[0]?.name || 'Unknown User';

      // Get backend users to notify
      const backendUsersQuery = await query(`
        SELECT id FROM users WHERE role = 'BACKEND_USER' AND "isActive" = true
      `);
      const backendUserIds = backendUsersQuery.rows.map(row => row.id);

      // Send revocation notification to backend users
      if (backendUserIds.length > 0) {
        await queueCaseRevocationNotification({
          caseId: caseData.id,
          caseNumber: caseData.caseId,
          customerName: caseData.customerName || 'Unknown Customer',
          fieldUserId: userId,
          fieldUserName,
          revocationReason: reason,
          backendUserIds,
        });
      }

      // Create audit log
      await createAuditLog({
        userId,
        action: 'CASE_REVOKED',
        entityType: 'CASE',
        entityId: caseId,
        details: {
          caseId: caseData.caseId,
          customerName: caseData.customerName,
          reason,
          previousStatus: caseData.status,
          newStatus: 'REVOKED',
        },
      });

      console.log(`✅ Case ${caseData.caseId} revoked successfully by ${fieldUserName}`);

      res.json({
        success: true,
        message: 'Case revoked successfully',
        data: {
          caseId: caseData.id,
          caseNumber: caseData.caseId,
          status: 'REVOKED',
          revokedAt: new Date().toISOString(),
          reason,
        },
      });
    } catch (error) {
      console.error('Revoke case error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'CASE_REVOCATION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Get verification task status (for mobile app)
   * GET /api/mobile/verification-tasks/:taskId/status
   */
  static async getTaskStatus(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📊 Getting task status for task: ${taskId}, user: ${userId}`);

      // Query task status
      const result = await query(
        `
        SELECT
          id,
          task_number,
          status,
          verification_outcome,
          started_at,
          completed_at,
          assigned_to,
          assigned_at,
          case_id
        FROM verification_tasks
        WHERE id = $1
      `,
        [taskId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
      }

      const task = result.rows[0];

      // For field agents, verify they are assigned to this task
      if (userRole === 'FIELD_AGENT' && task.assigned_to !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this task.',
          error: { code: 'ACCESS_DENIED' },
        });
      }

      console.log(`✅ Task status retrieved: ${task.status}`);

      return res.status(200).json({
        success: true,
        message: 'Task status retrieved successfully',
        data: {
          id: task.id,
          taskNumber: task.task_number,
          status: task.status,
          verificationOutcome: task.verification_outcome,
          startedAt: task.started_at,
          completedAt: task.completed_at,
          assignedTo: task.assigned_to,
          assignedAt: task.assigned_at,
          caseId: task.case_id,
        },
      });
    } catch (error) {
      console.error('Get task status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'TASK_STATUS_RETRIEVAL_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Update verification task status (for mobile app)
   * PUT /api/mobile/verification-tasks/:taskId/status
   */
  static async updateTaskStatus(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const { status } = req.body;
      const userId = (req as any).user?.id;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required',
          error: { code: 'INVALID_INPUT' },
        });
      }

      // Validate status
      const validStatuses = [
        'PENDING',
        'ASSIGNED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'ON_HOLD',
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
          error: { code: 'INVALID_STATUS' },
        });
      }

      // Update task status
      const updateFields: string[] = ['status = $1', 'updated_at = NOW()'];
      const queryParams: any[] = [status];
      const paramIndex = 2;

      // Set started_at when status changes to IN_PROGRESS
      if (status === 'IN_PROGRESS') {
        updateFields.push(`started_at = COALESCE(started_at, NOW())`);
      }

      // Set completed_at when status changes to COMPLETED
      if (status === 'COMPLETED') {
        updateFields.push(`completed_at = NOW()`);
      }

      queryParams.push(taskId);

      const updateQuery = `
        UPDATE verification_tasks
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await query(updateQuery, queryParams);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
      }

      const updatedTask = result.rows[0];

      // Create audit log
      await createAuditLog({
        userId: userId!,
        action: 'UPDATE_TASK_STATUS',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: { status, previousStatus: updatedTask.status },
      });

      console.log(`✅ Task ${updatedTask.task_number} status updated to ${status}`);

      res.json({
        success: true,
        message: 'Task status updated successfully',
        data: updatedTask,
      });
    } catch (error) {
      console.error('Update task status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'TASK_STATUS_UPDATE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Start working on a verification task (for mobile app)
   * POST /api/mobile/verification-tasks/:taskId/start
   */
  static async startTask(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = (req as any).user?.id;

      // Update task status to IN_PROGRESS and set started_at
      const result = await query(
        `
        UPDATE verification_tasks
        SET
          status = 'IN_PROGRESS',
          started_at = COALESCE(started_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
        [taskId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
      }

      const updatedTask = result.rows[0];

      // Create audit log
      await createAuditLog({
        userId: userId!,
        action: 'START_TASK',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: { taskNumber: updatedTask.task_number },
      });

      console.log(`✅ Task ${updatedTask.task_number} started by user ${userId}`);

      res.json({
        success: true,
        message: 'Task started successfully',
        data: updatedTask,
      });
    } catch (error) {
      console.error('Start task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start task',
        error: {
          code: 'TASK_START_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Complete a verification task (for mobile app)
   * POST /api/mobile/verification-tasks/:taskId/complete
   */
  static async completeTask(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const { verificationOutcome, actualAmount } = req.body;
      const userId = (req as any).user?.id;

      if (!verificationOutcome) {
        return res.status(400).json({
          success: false,
          message: 'Verification outcome is required',
          error: { code: 'INVALID_INPUT' },
        });
      }

      // Update task to completed
      const result = await query(
        `
        UPDATE verification_tasks
        SET
          status = 'COMPLETED',
          verification_outcome = $1,
          actual_amount = COALESCE($2, estimated_amount),
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
        [verificationOutcome, actualAmount, taskId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
      }

      const completedTask = result.rows[0];

      // Create audit log
      await createAuditLog({
        userId: userId!,
        action: 'COMPLETE_TASK',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: {
          taskNumber: completedTask.task_number,
          verificationOutcome,
          actualAmount,
        },
      });

      console.log(`✅ Task ${completedTask.task_number} completed by user ${userId}`);

      res.json({
        success: true,
        message: 'Task completed successfully',
        data: completedTask,
      });
    } catch (error) {
      console.error('Complete task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete task',
        error: {
          code: 'TASK_COMPLETION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Revoke a verification task (for mobile app)
   * POST /api/mobile/verification-tasks/:taskId/revoke
   */
  static async revokeTask(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Mobile task revocation request:`, {
        taskId,
        reason,
        userId,
        userRole,
      });

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Revocation reason is required',
          error: {
            code: 'REASON_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Get task details
      const taskQuery = await query(
        `
        SELECT
          vt.*,
          c."caseId" as case_number,
          c."customerName" as customer_name,
          c.id as case_id
        FROM verification_tasks vt
        LEFT JOIN cases c ON vt.case_id = c.id
        WHERE vt.id = $1
      `,
        [taskId]
      );

      if (taskQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: {
            code: 'TASK_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const taskData = taskQuery.rows[0];

      // Check if task can be revoked (not already completed)
      if (taskData.status === 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Cannot revoke a completed task',
          error: {
            code: 'TASK_ALREADY_COMPLETED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Check if task is already revoked
      if (taskData.status === 'REVOKED') {
        return res.status(400).json({
          success: false,
          message: 'Task is already revoked',
          error: {
            code: 'TASK_ALREADY_REVOKED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Update task status to revoked
      await query(
        `
        UPDATE verification_tasks
        SET status = 'REVOKED',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = $1,
            revocation_reason = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `,
        [userId, reason, taskId]
      );

      // Get field user information
      const fieldUserQuery = await query(
        `
        SELECT name, "employeeId" FROM users WHERE id = $1
      `,
        [userId]
      );
      const fieldUserName = fieldUserQuery.rows[0]?.name || 'Unknown User';

      // Get backend users to notify
      const backendUsersQuery = await query(`
        SELECT id FROM users WHERE role IN ('BACKEND_USER', 'ADMIN', 'SUPER_ADMIN') AND "isActive" = true
      `);
      const backendUserIds = backendUsersQuery.rows.map(row => row.id);

      // Send revocation notification to backend users
      if (backendUserIds.length > 0) {
        const { queueTaskRevocationNotification } = await import('../queues/notificationQueue');
        await queueTaskRevocationNotification({
          taskId: taskData.id,
          taskNumber: taskData.task_number,
          caseId: taskData.case_id,
          caseNumber: taskData.case_number,
          customerName: taskData.customer_name || 'Unknown Customer',
          fieldUserId: userId,
          fieldUserName,
          revocationReason: reason,
          backendUserIds,
        });
      }

      // Create audit log
      await createAuditLog({
        userId,
        action: 'TASK_REVOKED',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: {
          taskNumber: taskData.task_number,
          caseNumber: taskData.case_number,
          customerName: taskData.customer_name,
          reason,
          previousStatus: taskData.status,
          newStatus: 'REVOKED',
        },
      });

      console.log(`✅ Task ${taskData.task_number} revoked successfully by ${fieldUserName}`);

      res.json({
        success: true,
        message: 'Task revoked successfully',
        data: {
          taskId: taskData.id,
          taskNumber: taskData.task_number,
          status: 'REVOKED',
          revokedAt: new Date().toISOString(),
          reason,
        },
      });
    } catch (error) {
      console.error('Revoke task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'TASK_REVOCATION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
