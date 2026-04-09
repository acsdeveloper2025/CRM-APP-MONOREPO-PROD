import type { Request, Response } from 'express';
import type {
  MobileCaseListRequest,
  MobileCaseResponse,
  MobileAutoSaveRequest,
  MobileAutoSaveResponse,
} from '../types/mobile';
import { AuthenticatedRequest } from '../middleware/auth';
import { QueryParams, VerificationAttachmentRow, WhereClause, CaseRow } from '../types/database';
import { createAuditLog } from '../utils/auditLogger';
import { config } from '../config';
import { query } from '@/config/database';
import {
  queueCaseRevocationNotification,
  queueTaskRevocationNotification,
} from '../queues/notificationQueue';
import { TaskLookupService } from '../services/taskLookupService';
import { CaseStatusSyncService } from '../services/caseStatusSyncService';
import { logger } from '../utils/logger';
import { isFieldExecutionActor } from '../security/rbacAccess';
import { requireControllerPermission } from '@/security/controllerAuthorization';
import { TaskRevocationService } from '@/services/taskRevocationService';
import {
  MobileOperationService,
  type MobileOperationType,
} from '@/services/mobileOperationService';
import { getApiBaseUrl } from '@/utils/publicUrl';

// Type guards and interfaces for WhereClause usage
interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
  gt?: Date;
  lt?: Date;
}

export class MobileCaseController {
  private static getOperationId(req: Request): string | null {
    const headerValue = req.header('Idempotency-Key');
    if (!headerValue) {
      return null;
    }
    const trimmed = headerValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private static async recordTaskOperation(
    req: Request,
    taskId: string,
    operation: MobileOperationType,
    payload: unknown = {}
  ): Promise<void> {
    const operationId = MobileCaseController.getOperationId(req);
    if (!operationId) {
      return;
    }

    await MobileOperationService.recordOperation({
      operationId,
      type: operation,
      entityType: 'TASK',
      entityId: taskId,
      payload,
      retryCount: Number((req.body as { retry_count?: number })?.retry_count || 0),
    });
  }

  static async executeTaskOperation(this: void, req: AuthenticatedRequest, res: Response) {
    const taskId = String(req.params.taskId || '');
    const operation = String(req.body?.operation || '')
      .trim()
      .toUpperCase();
    const payload =
      req.body && typeof req.body.payload === 'object' && req.body.payload !== null
        ? req.body.payload
        : {};

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required',
        error: { code: 'TASK_ID_REQUIRED' },
      });
    }

    if (!operation) {
      return res.status(400).json({
        success: false,
        message: 'Operation is required',
        error: { code: 'OPERATION_REQUIRED' },
      });
    }

    try {
      switch (operation) {
        case 'TASK_STARTED': {
          await MobileCaseController.recordTaskOperation(req, taskId, 'TASK_STARTED', payload);
          return MobileCaseController.startTask(req, res);
        }
        case 'TASK_COMPLETED': {
          const completionPayload = payload as {
            verificationOutcome?: string;
            actualAmount?: number;
          };
          req.body = {
            ...req.body,
            ...completionPayload,
            verificationOutcome:
              completionPayload.verificationOutcome ?? req.body?.verificationOutcome,
            actualAmount: completionPayload.actualAmount ?? req.body?.actualAmount,
          };
          await MobileCaseController.recordTaskOperation(req, taskId, 'TASK_COMPLETED', payload);
          return MobileCaseController.completeTask(req, res);
        }
        case 'TASK_REVOKED': {
          const revokePayload = payload as { reason?: string };
          req.body = {
            ...req.body,
            reason: revokePayload.reason ?? req.body?.reason,
          };
          await MobileCaseController.recordTaskOperation(req, taskId, 'TASK_REVOKED', payload);
          return MobileCaseController.revokeTask(req, res);
        }
        case 'PRIORITY_UPDATED': {
          const priorityPayload = payload as { priority?: number | string };
          req.body = {
            ...req.body,
            priority: priorityPayload.priority ?? req.body?.priority,
          };
          await MobileCaseController.recordTaskOperation(req, taskId, 'PRIORITY_UPDATED', payload);
          return MobileCaseController.updateCasePriority(req, res);
        }
        default:
          return res.status(400).json({
            success: false,
            message: `Unsupported operation: ${operation}`,
            error: { code: 'UNSUPPORTED_TASK_OPERATION' },
          });
      }
    } catch (error) {
      logger.error('Execute task operation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to execute task operation',
        error: {
          code: 'TASK_OPERATION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get cases for mobile app with optimized response
  static async getMobileCases(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      if (!isExecutionActor) {
        return res.status(403).json({
          success: false,
          message: 'Mobile task list is restricted to field execution users',
          error: {
            code: 'MOBILE_EXECUTION_ONLY',
            timestamp: new Date().toISOString(),
          },
        });
      }

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
      }: MobileCaseListRequest = req.query as MobileCaseListRequest;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Math.min(Number(limit), config.mobile.syncBatchSize);

      // Build where clause
      const where: WhereClause = {};

      // Role-based filtering
      // For FIELD_AGENT: Filter by task-level assignment (verification_tasks.assigned_to)
      // For other roles: Filter by task-level assignment if specified
      if (isExecutionActor) {
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
        const dateFilter: DateRangeFilter = {};
        if (dateFrom) {
          dateFilter.gte = new Date(dateFrom);
        }
        if (dateTo) {
          dateFilter.lte = new Date(dateTo);
        }
        where.createdAt = dateFilter;
      }

      // Sync-specific filtering
      if (lastSyncTimestamp) {
        const syncFilter: DateRangeFilter = {
          gt: new Date(lastSyncTimestamp),
        };
        where.updatedAt = syncFilter;
      }

      // Build dynamic SQL for where
      const vals: QueryParams = [];
      const wh: string[] = [];

      // Filter by task-level assignment (for both FIELD_AGENT and other roles)
      if (where.hasAssignedTask) {
        vals.push(where.hasAssignedTask as string);
        wh.push(`EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = c.id
          AND vt.assigned_to = $${vals.length}
        )`);
      }

      if (where.status) {
        vals.push(where.status as string);
        wh.push(`c.status = $${vals.length}`);
      }
      if (where.priority) {
        vals.push(where.priority as string | number);
        wh.push(`c.priority = $${vals.length}`);
      }
      if (where.updatedAt && typeof where.updatedAt === 'object') {
        const updatedAtFilter = where.updatedAt as DateRangeFilter;
        if (updatedAtFilter.gt) {
          vals.push(updatedAtFilter.gt);
          wh.push(`c.updated_at > $${vals.length}`);
        }
      }
      if (search) {
        vals.push(`%${search}%`);
        wh.push(
          `(c.customer_name ILIKE $${vals.length} OR c.customer_phone ILIKE $${vals.length} OR c.title ILIKE $${vals.length} OR c.description ILIKE $${vals.length})`
        );
      }
      if (dateFrom) {
        vals.push(new Date(dateFrom));
        wh.push(`c.created_at >= $${vals.length}`);
      }
      if (dateTo) {
        vals.push(new Date(dateTo));
        wh.push(`c.created_at <= $${vals.length}`);
      }
      const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

      logger.info('🔍 Mobile API Debug:', {
        userId,
        isExecutionActor,
        where,
        whereSql,
        vals,
      });

      // For FIELD_AGENT: Add userId to vals for LATERAL JOIN to filter their assigned task
      const userIdForTaskFilter = isExecutionActor ? userId : null;
      const taskFilterParamIndex = vals.length + 1;

      const listSql = `
        SELECT c.*,
               -- All 13 required fields for mobile app
               -- Field 3: Client
               cl.id as client_id,
               cl.name as "clientName",
               cl.code as "clientCode",
               -- Field 4: Product
               p.id as product_id,
               p.name as "productName",
               p.code as "productCode",
               -- Field 5: Verification Type
               vtype.id as verification_type_id,
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
        LEFT JOIN clients cl ON cl.id = c.client_id
        LEFT JOIN products p ON p.id = c.product_id
        LEFT JOIN verification_types vtype ON vtype.id = c.verification_type_id
        LEFT JOIN users cu ON cu.id = c.created_by_backend_user
        LEFT JOIN LATERAL (
          SELECT vt.id, vt.task_number, vt.address, vt.trigger, vt.priority, vt.applicant_type,
                 vt.assigned_to, vt.assigned_at, vt.created_at as task_created_at,
                 vt.status as task_status, vt.completed_at as task_completed_at,
                 vt.started_at, vt.saved_at, vt.is_saved,
                 vt.revoked_at, vt.revoked_by, vt.revocation_reason,
                 u.name as assigned_user_name,
                 revoked_user.name as revoked_by_name,
                 rt.name as rate_type_name, rt.description as rate_type_description
          FROM verification_tasks vt
          LEFT JOIN users u ON u.id = vt.assigned_to
          LEFT JOIN users revoked_user ON revoked_user.id = vt.revoked_by
          LEFT JOIN rate_types rt ON rt.id = vt.rate_type_id
          WHERE vt.case_id = c.id
          AND (
            $${taskFilterParamIndex}::uuid IS NULL  -- For non-field-agents, show first task
            OR vt.assigned_to = $${taskFilterParamIndex}::uuid  -- For field agents, show their task
          )
          ORDER BY
            CASE WHEN vt.assigned_to = $${taskFilterParamIndex}::uuid THEN 0 ELSE 1 END,  -- Prioritize user's task
            CASE WHEN vt.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS') THEN 0 ELSE 1 END,  -- Prioritize active tasks over completed
            vt.created_at DESC  -- Show newest task first (Revisit tasks are newer)
        ) vtask ON true
        LEFT JOIN (
          SELECT case_id, COUNT(*) as attachment_count
          FROM attachments
          GROUP BY case_id
        ) att_count ON att_count.case_id = c.case_id
        ${whereSql}
        ORDER BY c.priority DESC, c.created_at DESC
        LIMIT $${vals.length + 2} OFFSET $${vals.length + 3}`;
      logger.info('📊 Mobile Cases Query:', { whereSql, vals, userIdForTaskFilter, take, skip });
      const casesRes = await query(listSql, [...vals, userIdForTaskFilter, take, skip]);

      // Count query - use same filtering logic as main query
      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM cases c ${whereSql}`,
        vals
      );
      const totalCount = Number(countRes.rows[0]?.count || 0);
      const cases = casesRes.rows;

      logger.info('📋 Mobile Cases Results:', {
        totalCount,
        casesFound: cases.length,
        isExecutionActor,
        userId,
        firstCaseAssignedTo: cases[0]?.assignedTo,
        firstCaseId: cases[0]?.caseId,
      });

      // Debug: Log first case data to see what fields are actually returned
      if (cases.length > 0) {
        logger.info('🔍 First Case Raw Data:', {
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
        businessCaseId: caseItem.caseId, // Alias for mobile app display (Case ID: #123)
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
        // Revoke fields
        isRevoked: caseItem.task_status === 'REVOKED',
        revokedAt: caseItem.revoked_at ? new Date(caseItem.revoked_at).toISOString() : undefined,
        revokedBy: caseItem.revoked_by || undefined,
        revokedByName: caseItem.revoked_by_name || undefined,
        revokeReason: caseItem.revocation_reason || undefined,
        // Status timestamps
        inProgressAt: caseItem.started_at ? new Date(caseItem.started_at).toISOString() : undefined,
        savedAt: caseItem.saved_at ? new Date(caseItem.saved_at).toISOString() : undefined,
        isSaved: caseItem.is_saved || caseItem.task_status === 'SAVED' || false,
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

      const revokedAssignmentIds =
        await TaskRevocationService.getRevokedAssignmentIdsForUser(userId);

      const totalPages = Math.ceil(totalCount / take);
      const hasMore = Number(page) < totalPages;

      res.json({
        success: true,
        message: 'Cases retrieved successfully',
        data: {
          cases: mobileCases,
          tasks: mobileCases, // Alias for cases to support mobile app calling /tasks
          revoked_assignment_ids: revokedAssignmentIds,
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
      logger.error('Get mobile cases error:', error);
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
  static async getMobileCase(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const taskId = String(req.params.taskId || '');
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      // Resolve taskId to caseId
      const caseId = await TaskLookupService.resolveCaseId(taskId);
      const specificTaskId = taskId; // Check local DB first
      const _where: WhereClause = { id: caseId };

      // Role-based access control
      // For FIELD_AGENT: Check if they have an assigned task for this case
      // For other roles: No additional filtering

      const vals2: QueryParams = [caseId];
      const _userIdForTaskFilter = isExecutionActor ? userId : null;

      let caseSql = `
        SELECT c.*,
               cl.id as client_id, cl.name as "clientName", cl.code as "clientCode",
               p.id as product_id, p.name as "productName", p.code as "productCode",
               vtype.id as verification_type_id, vtype.name as "verificationTypeName", vtype.code as "verificationTypeCode",
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
        LEFT JOIN clients cl ON cl.id = c.client_id
        LEFT JOIN products p ON p.id = c.product_id
        LEFT JOIN verification_types vtype ON vtype.id = c.verification_type_id
        LEFT JOIN users cu ON cu.id = c.created_by_backend_user
        LEFT JOIN LATERAL (
          SELECT vt.id, vt.task_number, vt.address, vt.trigger, vt.priority, vt.applicant_type,
                 vt.assigned_to, vt.assigned_at, vt.created_at as task_created_at,
                 vt.status as task_status, vt.completed_at as task_completed_at,
                 vt.started_at, vt.saved_at, vt.is_saved,
                 vt.revoked_at, vt.revoked_by, vt.revocation_reason,
                 u.name as assigned_user_name,
                 revoked_user.name as revoked_by_name
          FROM verification_tasks vt
          LEFT JOIN users u ON u.id = vt.assigned_to
          LEFT JOIN users revoked_user ON revoked_user.id = vt.revoked_by
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
      if (isExecutionActor) {
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
          original_name,
          mime_type,
          file_size as size,
          file_path,
          uploaded_by,
          created_at as "uploadedAt",
          case_id
        FROM attachments
        WHERE case_id = $1
        ORDER BY created_at DESC
      `,
        [caseId]
      );
      const _locRes = await query(
        `SELECT id, latitude, longitude, accuracy, timestamp, source FROM locations WHERE case_id = $1 ORDER BY timestamp DESC LIMIT 10`,
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
        attachments: attRes2.rows.map((att: VerificationAttachmentRow) => {
          const apiBaseUrl = getApiBaseUrl(req);
          return {
            id: att.id,
            filename: att.filename,
            originalName: att.originalName,
            mimeType: att.mimeType,
            size: att.fileSize,
            url: `${apiBaseUrl}/api/mobile/attachments/${att.id}`,
            uploadedAt: att.createdAt
              ? new Date(att.createdAt).toISOString()
              : new Date().toISOString(),
          };
        }),
        formData: (caseItem.verificationData as Record<string, unknown>) || null,
        syncStatus: 'SYNCED',
      };

      res.json({
        success: true,
        message: 'Case retrieved successfully',
        data: mobileCase,
      });
    } catch (error) {
      logger.error('Get mobile case error:', error);
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
  static async updateCaseStatus(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const taskId = String(req.params.taskId || '');
      const { status, notes = null } = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      // Resolve taskId to caseId
      const caseId = await TaskLookupService.resolveCaseId(taskId);

      logger.info(`📱 Mobile case status update request:`, {
        taskId,
        caseId,
        status,
        notes,
        userId,
        isExecutionActor,
      });

      const vals3: QueryParams = [caseId];
      let exSql = `SELECT id, case_id, status, trigger, completed_at FROM cases WHERE id = $1`;

      if (isExecutionActor) {
        exSql += ` AND EXISTS (
          SELECT 1 FROM verification_tasks vt
          WHERE vt.case_id = cases.id
          AND vt.assigned_to = $2
        )`;
        vals3.push(userId);
      }

      logger.info(`🔍 Executing query: ${exSql} with values:`, vals3);
      const exRes = await query(exSql, vals3);
      const existingCase = exRes.rows[0];

      if (!existingCase) {
        logger.info(`❌ Case not found for task: ${taskId}`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      logger.info(`✅ Case found:`, existingCase);
      const compAt = status === 'COMPLETED' ? new Date() : existingCase.completedat;
      const actualCaseId = existingCase.id; // Use the actual UUID from the database

      await query(
        `UPDATE cases SET status = $1, trigger = COALESCE($2, trigger), completed_at = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
        [status, notes, compAt, actualCaseId]
      );
      const updRes = await query(
        `SELECT id, case_id, status, updated_at, completed_at FROM cases WHERE id = $1`,
        [actualCaseId]
      );
      const updatedCase = updRes.rows[0];

      logger.info(`✅ Case status updated successfully:`, updatedCase);

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

      // Commission is now handled at the verification task level via VerificationTasksController.
      // Case-level commission trigger is legacy and has been removed to avoid duplicate payouts.

      // Emit WebSocket events to notify frontend about case status change
      try {
        const { emitCaseStatusChanged, emitCaseUpdate, getSocketIO } = await import(
          '../websocket/server'
        );
        const username = req.user?.id ? `User ${req.user.id}` : 'Mobile User';

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

        logger.info(
          `🔔 WebSocket notifications sent for case ${actualCaseId} status change: ${existingCase.status} -> ${status}`
        );
      } catch (error) {
        logger.error('Error sending WebSocket notifications:', error);
        // Don't fail the case update if WebSocket notification fails
      }

      // Sync case status
      await CaseStatusSyncService.recalculateCaseStatus(actualCaseId);

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
      logger.error('Update case status error:', error);
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
  static async updateCasePriority(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const taskId = String(req.params.taskId || '');
      const { priority } = req.body;

      // Resolve taskId to caseId
      const caseId = await TaskLookupService.resolveCaseId(taskId);

      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      if (isExecutionActor) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update priority',
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const vals6: QueryParams = [caseId];
      const exSql4 = `SELECT id FROM cases WHERE id = $1`;

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

      await query(`UPDATE cases SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
        Number(priority),
        caseId,
      ]);
      const updRes2 = await query(`SELECT id, priority, updated_at FROM cases WHERE id = $1`, [
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
      logger.error('Update case priority error:', error);
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
  static async autoSaveForm(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const taskId = String(req.params.taskId || '');
      const { formType, formData, timestamp }: MobileAutoSaveRequest = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      // Resolve taskId to caseId
      const caseId = await TaskLookupService.resolveCaseId(taskId);

      logger.info(
        `📱 Auto-save request for task ${taskId} (case ${caseId}), formType: ${formType}`
      );

      const vals5: QueryParams = [caseId];
      let exSql3 = `SELECT id FROM cases WHERE id = $1`;

      if (isExecutionActor) {
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
        logger.info(`❌ Auto-save: Case not found for task ${taskId}`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      const actualCaseId = existingCase.id; // Use the actual UUID from the database

      // Save or update auto-save data
      const exAuto = await query(
        `SELECT id FROM auto_saves WHERE case_id = $1 AND "formType" = $2`,
        [actualCaseId, formType]
      );
      let autoSaveData: { timestamp?: Date; formData?: unknown } | null = null;
      if (exAuto.rowCount && exAuto.rowCount > 0) {
        const upd = await query(
          `UPDATE auto_saves SET form_data = $1, timestamp = $2 WHERE id = $3 RETURNING *`,
          [JSON.stringify(formData), new Date(timestamp), exAuto.rows[0].id]
        );
        autoSaveData = upd.rows[0];
      } else {
        const ins = await query(
          `INSERT INTO auto_saves (id, case_id, "formType", form_data, timestamp) VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING *`,
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
      logger.error('Auto-save form error:', error);
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
  static async getAutoSavedForm(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const taskId = String(req.params.taskId || '');
      const formType = String(req.params.formType || '');
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      // Resolve taskId to caseId
      const caseId = await TaskLookupService.resolveCaseId(taskId);

      logger.info(
        `📱 Get auto-saved form for task ${taskId} (case ${caseId}), formType: ${formType}`
      );

      const vals7: QueryParams = [caseId];
      let exSql5 = `SELECT id FROM cases WHERE id = $1`;

      if (isExecutionActor) {
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
        logger.info(`❌ Get auto-saved: Case not found for task ${taskId}`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            taskId,
          },
        });
      }

      const actualCaseId = existingCase.id; // Use the actual UUID from the database
      const autoRes = await query(
        `SELECT id, case_id, "formType", form_data, saved_at, user_id FROM auto_saves WHERE case_id = $1 AND "formType" = $2 LIMIT 1`,
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
      logger.error('Get auto-saved form error:', error);
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

  // Add case note from mobile app
  static async addCaseNote(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const caseId = String(req.params.caseId || '');
      const { note } = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      logger.info(`📱 Mobile case note request:`, {
        caseId,
        note,
        userId,
        isExecutionActor,
      });

      if (!note || note.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Note content is required',
          error: {
            code: 'NOTE_CONTENT_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const val = isExecutionActor && req.user?.id ? [caseId, req.user.id] : [caseId];
      const caseQuery = await query<CaseRow>(
        `
        SELECT
          c.*,
          vt.assigned_to,
          u.name as assigned_user_name,
          vt.id as "verificationTaskId",
          vt.task_number as "verificationTaskNumber"
        FROM cases c
        LEFT JOIN verification_tasks vt ON c.id = vt.case_id
        LEFT JOIN users u ON vt.assigned_to = u.id
        WHERE c.id = $1
        ${isExecutionActor ? 'AND vt.assigned_to = $2' : ''}
      `,
        val
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

      // Insert the new case note
      const insertNoteResult = await query(
        `
        INSERT INTO case_notes (id, case_id, user_id, note_content, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, note_content, created_at
      `,
        [caseId, userId, note]
      );

      const newNote = insertNoteResult.rows[0];

      // Create audit log
      await createAuditLog({
        userId,
        action: 'CASE_NOTE_ADDED',
        entityType: 'CASE',
        entityId: caseId,
        details: {
          caseId: caseData.caseId,
          customerName: caseData.customerName,
          noteId: newNote.id,
          noteContent: newNote.note_content,
        },
      });

      logger.info(`✅ Case note added successfully for case ${caseData.caseId} by ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Case note added successfully',
        data: {
          id: newNote.id,
          caseId: caseData.id,
          noteContent: newNote.note_content,
          createdAt: newNote.created_at.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Add case note error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'ADD_CASE_NOTE_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Revoke case from mobile app
  static async revokeCase(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const caseId = String(req.params.caseId || '');
      const { reason } = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      logger.info(`📱 Mobile case revocation request:`, {
        caseId,
        reason,
        userId,
        isExecutionActor,
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
      // Validate case exists and user has access
      const val = isExecutionActor && req.user?.id ? [caseId, req.user.id] : [caseId];
      const caseQuery = await query<CaseRow>(
        `
        SELECT
          c.*,
          vt.assigned_to,
          u.name as assigned_user_name,
          vt.id as "verificationTaskId",
          vt.task_number as "verificationTaskNumber"
        FROM cases c
        LEFT JOIN verification_tasks vt ON c.id = vt.case_id
        LEFT JOIN users u ON vt.assigned_to = u.id
        WHERE c.id = $1
        ${isExecutionActor ? 'AND vt.assigned_to = $2' : ''}
      `,
        val
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
            revoked_at = CURRENT_TIMESTAMP,
            "revokedBy" = $1,
            "revocationReason" = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `,
        [userId, reason, caseId]
      );

      // Get field user information
      const fieldUserQuery = await query(
        `
        SELECT name, employee_id FROM users WHERE id = $1
      `,
        [userId]
      );
      const fieldUserName = fieldUserQuery.rows[0]?.name || 'Unknown User';

      // Get backend users to notify
      const backendUsersQuery = await query(`
        SELECT DISTINCT u.id
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
        JOIN permissions p ON p.id = rp.permission_id
        WHERE u.is_active = true
          AND p.code IN ('case.reassign', 'review.view', 'report.generate')
      `);
      const backendUserIds = backendUsersQuery.rows.map(row => row.id);

      // Send revocation notification to backend users
      if (backendUserIds.length > 0) {
        await queueCaseRevocationNotification({
          caseId: caseData.id,
          caseNumber: String(caseData.caseId),
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

      logger.info(`✅ Case ${caseData.caseId} revoked successfully by ${fieldUserName}`);

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
      logger.error('Revoke case error:', error);
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
  static async getTaskStatus(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      const taskId = String(req.params.taskId || '');
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      logger.info(`📊 Getting task status for task: ${taskId}, user: ${userId}`);

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
      if (isExecutionActor && task.assigned_to !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this task.',
          error: { code: 'ACCESS_DENIED' },
        });
      }

      logger.info(`✅ Task status retrieved: ${task.status}`);

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
      logger.error('Get task status error:', error);
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
   * Start working on a verification task (for mobile app)
   * POST /api/mobile/verification-tasks/:taskId/start
   */
  static async startTask(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      if (!requireControllerPermission(req, res, 'visit.start')) {
        return;
      }
      const taskId = String(req.params.taskId || '');
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      const taskQuery = await query(
        `
        SELECT id, assigned_to, status
        FROM verification_tasks
        WHERE id = $1
      `,
        [taskId]
      );

      if (taskQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
      }

      const task = taskQuery.rows[0];

      if (isExecutionActor && task.assigned_to !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Task not assigned to user',
          error: { code: 'TASK_NOT_ASSIGNED_TO_USER' },
        });
      }

      if (task.status === 'IN_PROGRESS') {
        return res.status(409).json({
          success: false,
          message: 'Task is already in progress',
          error: {
            code: 'TASK_ALREADY_IN_PROGRESS',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (task.status === 'COMPLETED') {
        return res.status(409).json({
          success: false,
          message: 'Task is already completed',
          error: {
            code: 'TASK_ALREADY_COMPLETED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (task.status === 'REVOKED') {
        return res.status(409).json({
          success: false,
          message: 'Task has been revoked',
          error: {
            code: 'TASK_REVOKED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Update task status to IN_PROGRESS and set started_at
      const result = await query(
        `
        UPDATE verification_tasks
        SET
          status = 'IN_PROGRESS',
          started_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
        [taskId]
      );

      const updatedTask = result.rows[0];

      // Create audit log
      await createAuditLog({
        userId,
        action: 'START_TASK',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: { taskNumber: updatedTask.task_number },
      });

      logger.info(`✅ Task ${updatedTask.task_number} started by user ${userId}`);

      // Sync case status
      await CaseStatusSyncService.recalculateCaseStatus(updatedTask.case_id);

      res.json({
        success: true,
        message: 'Task started successfully',
        data: updatedTask,
      });
    } catch (error) {
      logger.error('Start task error:', error);
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
  static async completeTask(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      if (!requireControllerPermission(req, res, 'visit.submit')) {
        return;
      }
      const taskId = String(req.params.taskId || '');
      const { verificationOutcome, actualAmount } = req.body;
      const userId = req.user?.id;

      if (!verificationOutcome) {
        return res.status(400).json({
          success: false,
          message: 'Verification outcome is required',
          error: { code: 'INVALID_INPUT' },
        });
      }

      // Get task details first
      const taskQuery = await query(
        `
        SELECT vt.*, vtype.name as verification_type_name
        FROM verification_tasks vt
        LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
        WHERE vt.id = $1
      `,
        [taskId]
      );

      if (taskQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' },
        });
      }

      const task = taskQuery.rows[0];

      if (task.status === 'REVOKED') {
        return res.status(403).json({
          success: false,
          message: 'Task has been revoked',
          error: { code: 'TASK_REVOKED' },
        });
      }

      // Block superseded or completed tasks
      if (task.status === 'COMPLETED') {
        return res.status(409).json({
          success: false,
          message: 'Task is superseded or revoked. Submission is not allowed.',
          error: { code: 'TASK_SUPERSEDED_OR_REVOKED' },
        });
      }

      const childTaskQuery = await query(
        `SELECT 1 FROM verification_tasks WHERE parent_task_id = $1 LIMIT 1`,
        [taskId]
      );
      if (childTaskQuery.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Task is superseded or revoked. Submission is not allowed.',
          error: { code: 'TASK_SUPERSEDED_OR_REVOKED' },
        });
      }

      // ✅ VALIDATE TASK COMPLETION REQUIREMENTS
      const { TaskCompletionValidator } = await import('../services/taskCompletionValidator');
      const validation = await TaskCompletionValidator.validateTaskCompletion(
        taskId,
        task.verification_type_name,
        verificationOutcome
      );

      if (!validation.isValid) {
        logger.info(`❌ Task ${task.task_number} completion validation failed:`, validation.errors);
        return res.status(400).json({
          success: false,
          message: 'Task cannot be completed due to validation errors',
          errors: validation.errors,
          warnings: validation.warnings,
          error: {
            code: 'VALIDATION_FAILED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        logger.info(`⚠️  Task ${task.task_number} completion warnings:`, validation.warnings);
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

      const completedTask = result.rows[0];

      // Create audit log
      await createAuditLog({
        userId,
        action: 'COMPLETE_TASK',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: {
          taskNumber: completedTask.task_number,
          verificationOutcome,
          actualAmount,
          validationWarnings: validation.warnings,
        },
      });

      logger.info(`✅ Task ${completedTask.task_number} completed successfully by user ${userId}`);

      // Sync case status
      await CaseStatusSyncService.recalculateCaseStatus(task.case_id);

      res.json({
        success: true,
        message: 'Task completed successfully',
        data: completedTask,
        warnings: validation.warnings,
      });
    } catch (error) {
      logger.error('Complete task error:', error);
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
  static async revokeTask(this: void, req: AuthenticatedRequest, res: Response) {
    try {
      if (!requireControllerPermission(req, res, 'visit.revoke')) {
        return;
      }
      const taskId = String(req.params.taskId || '');
      const { reason } = req.body;
      const userId = req.user?.id;
      const isExecutionActor = isFieldExecutionActor(req.user);

      logger.info(`📱 Mobile task revocation request:`, {
        taskId,
        reason,
        userId,
        isExecutionActor,
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
          c.case_id as case_number,
          c.customer_name as customer_name,
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
        logger.info(`ℹ️ Task ${taskData.task_number} is already revoked`);
        return res.status(200).json({
          success: true,
          message: 'Task already revoked',
          data: {
            taskId: taskData.id,
            taskNumber: taskData.task_number,
            status: 'REVOKED',
            revokedAt: taskData.revoked_at || new Date().toISOString(),
            reason: taskData.revocation_reason || reason,
          },
        });
      }

      await TaskRevocationService.recordRevocation(
        { query },
        {
          taskId,
          revokedByUserId: userId,
          revokedByRole: 'FE',
          revokedFromUserId: taskData.assigned_to,
          revokeReason: reason,
          previousStatus: taskData.status,
        }
      );

      // Update task status to revoked and detach assignment
      await query(
        `
        UPDATE verification_tasks
        SET status = 'REVOKED',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = $1,
            revocation_reason = $2,
            assigned_to = NULL,
            current_assigned_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `,
        [userId, reason, taskId]
      );

      // Get field user information
      const fieldUserQuery = await query(
        `
        SELECT name, employee_id FROM users WHERE id = $1
      `,
        [userId]
      );
      const fieldUserName = fieldUserQuery.rows[0]?.name || 'Unknown User';

      // Get backend users to notify
      const backendUsersQuery = await query(`
        SELECT DISTINCT u.id
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
        JOIN permissions p ON p.id = rp.permission_id
        WHERE u.is_active = true
          AND p.code IN ('case.reassign', 'review.view', 'report.generate')
      `);
      const backendUserIds = backendUsersQuery.rows.map(row => row.id);

      // Send revocation notification to backend users
      if (backendUserIds.length > 0) {
        try {
          // Use statically imported function instead of dynamic import
          // const { queueTaskRevocationNotification } = await import('../queues/notificationQueue');
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
          logger.info(`🔔 Revocation notification queued for task ${taskData.task_number}`);
        } catch (notifError) {
          logger.error(
            `❌ Failed to queue revocation notification for task ${taskId}:`,
            notifError
          );
          // Don't fail the request if notification fails
        }
      }

      // Create audit log
      try {
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
        logger.info(`📝 Audit log created for task revocation: ${taskData.task_number}`);
      } catch (auditError) {
        logger.error(`❌ Failed to create audit log for task revocation ${taskId}:`, auditError);
        // Don't fail the request if audit log fails
      }

      logger.info(`✅ Task ${taskData.task_number} revoked successfully by ${fieldUserName}`);

      // Sync case status
      try {
        await CaseStatusSyncService.recalculateCaseStatus(taskData.case_id);
        logger.info(`🔄 Case status synced for case ${taskData.case_id}`);
      } catch (syncError) {
        logger.error(`❌ Failed to sync case status for case ${taskData.case_id}:`, syncError);
        // Don't fail the request if sync fails, but log it as error
      }

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
      logger.error('Revoke task error:', error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? `Revocation failed: ${error.message}` : 'Internal server error',
        error: {
          code: 'TASK_REVOCATION_FAILED',
          timestamp: new Date().toISOString(),
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
