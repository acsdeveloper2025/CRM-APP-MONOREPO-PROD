import { Request, Response } from 'express';
import { Pool } from 'pg';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  VerificationTask, 
  CreateVerificationTaskData, 
  UpdateVerificationTaskData,
  AssignVerificationTaskData,
  CompleteVerificationTaskData,
  VerificationTaskFilters,
  TaskStatus,
  TaskPriority
} from '../types/verificationTask';
import { createAuditLog } from '../utils/auditLogger';
import { logger } from '../utils/logger';

// Database connection (assuming it's imported from your existing setup)
import { pool } from '../config/database';

export class VerificationTasksController {
  
  /**
   * Create multiple verification tasks for a case
   * POST /api/cases/:caseId/verification-tasks
   */
  static async createMultipleTasksForCase(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { caseId } = req.params;
    const { tasks } = req.body;
    const userId = req.user?.id;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Tasks array is required and must not be empty',
        error: { code: 'INVALID_INPUT' }
      });
      return;
    }

    // First, resolve the case ID - it could be a case number or UUID
    let actualCaseId = caseId;

    try {

      // Check if caseId is a number (case number) and convert to UUID
      if (/^\d+$/.test(caseId)) {
        const caseQuery = 'SELECT id FROM cases WHERE "caseId" = $1';
        const caseResult = await pool.query(caseQuery, [parseInt(caseId)]);

        if (caseResult.rows.length === 0) {
          res.status(404).json({
            success: false,
            message: 'Case not found'
          });
          return;
        }

        actualCaseId = caseResult.rows[0].id;
      }
    } catch (error) {
      logger.error('Error resolving case ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve case ID',
        error: { code: 'CASE_RESOLUTION_ERROR' }
      });
      return;
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify case exists and get case details for rate lookup
      const caseResult = await client.query(
        'SELECT id, "caseId", "customerName", "clientId", "productId", "verificationTypeId" FROM cases WHERE id = $1',
        [actualCaseId]
      );

      if (caseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'CASE_NOT_FOUND' }
        });
        return;
      }

      const createdTasks: VerificationTask[] = [];
      let totalEstimatedAmount = 0;
      const caseInfo = caseResult.rows[0];

      // Create each verification task
      for (const taskData of tasks) {
        const {
          verification_type_id,
          task_title,
          task_description,
          priority = 'MEDIUM',
          assigned_to,
          rate_type_id,
          estimated_amount,
          address,
          pincode,
          document_type,
          document_number,
          document_details,
          estimated_completion_date
        } = taskData;

        // Look up rate amount if rate_type_id is provided
        let actualAmount = estimated_amount;
        if (rate_type_id && caseInfo.clientId && caseInfo.productId && caseInfo.verificationTypeId) {
          const rateQuery = `
            SELECT amount, currency
            FROM rates
            WHERE "clientId" = $1
              AND "productId" = $2
              AND "verificationTypeId" = $3
              AND "rateTypeId" = $4
              AND "isActive" = true
          `;
          const rateResult = await client.query(rateQuery, [
            caseInfo.clientId,
            caseInfo.productId,
            caseInfo.verificationTypeId,
            parseInt(rate_type_id.toString())
          ]);

          if (rateResult.rows.length > 0) {
            actualAmount = parseFloat(rateResult.rows[0].amount);
          }
        }

        // Validate required fields
        if (!verification_type_id || !task_title) {
          await client.query('ROLLBACK');
          res.status(400).json({
            success: false,
            message: 'verification_type_id and task_title are required for each task',
            error: { code: 'INVALID_TASK_DATA' }
          });
          return;
        }

        // Insert verification task
        const assignedToValue = assigned_to || null;
        const isAssigned = assignedToValue !== null;
        const taskStatus = isAssigned ? 'ASSIGNED' : 'PENDING';

        let insertQuery: string;
        let insertParams: any[];

        if (isAssigned) {
          insertQuery = `
            INSERT INTO verification_tasks (
              case_id, verification_type_id, task_title, task_description,
              priority, assigned_to, assigned_by, assigned_at,
              rate_type_id, estimated_amount, address, pincode,
              document_type, document_number, document_details,
              estimated_completion_date, status, created_by
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, NOW(),
              $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17
            ) RETURNING *
          `;
          insertParams = [
            actualCaseId, verification_type_id, task_title, task_description,
            priority, assignedToValue, userId,
            rate_type_id, actualAmount, address, pincode,
            document_type, document_number, JSON.stringify(document_details),
            estimated_completion_date, taskStatus, userId
          ];
        } else {
          insertQuery = `
            INSERT INTO verification_tasks (
              case_id, verification_type_id, task_title, task_description,
              priority, assigned_to, assigned_by, assigned_at,
              rate_type_id, estimated_amount, address, pincode,
              document_type, document_number, document_details,
              estimated_completion_date, status, created_by
            ) VALUES (
              $1, $2, $3, $4, $5, NULL, NULL, NULL,
              $6, $7, $8, $9, $10, $11, $12, $13,
              $14, $15
            ) RETURNING *
          `;
          insertParams = [
            actualCaseId, verification_type_id, task_title, task_description,
            priority,
            rate_type_id, actualAmount, address, pincode,
            document_type, document_number, JSON.stringify(document_details),
            estimated_completion_date, taskStatus, userId
          ];
        }

        const taskResult = await client.query(insertQuery, insertParams);

        const task = taskResult.rows[0];
        createdTasks.push(task);
        totalEstimatedAmount += actualAmount || 0;

        // Create assignment history if assigned
        if (assigned_to) {
          await client.query(`
            INSERT INTO task_assignment_history (
              verification_task_id, case_id, assigned_to, assigned_by,
              assignment_reason, task_status_before, task_status_after
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            task.id, actualCaseId, assigned_to, userId,
            'Initial assignment during task creation', 'PENDING', 'ASSIGNED'
          ]);
        }

        // Create audit log
        await createAuditLog({
          userId: userId!,
          action: 'CREATE_VERIFICATION_TASK',
          entityType: 'VERIFICATION_TASK',
          entityId: task.id,
          details: {
            caseId: actualCaseId,
            taskTitle: task_title,
            verificationType: verification_type_id,
            assignedTo: assigned_to
          }
        });
      }

      // Update case to reflect multiple tasks
      await client.query(`
        UPDATE cases
        SET
          has_multiple_tasks = true,
          total_tasks_count = (
            SELECT COUNT(*) FROM verification_tasks WHERE case_id = $1
          ),
          updated_at = NOW()
        WHERE id = $1
      `, [actualCaseId]);

      await client.query('COMMIT');

      // Fetch created tasks with populated data
      const populatedTasks = await VerificationTasksController.getTasksWithPopulatedData(
        createdTasks.map(t => t.id)
      );

      // Send notifications for assigned tasks
      try {
        // Get case details for notifications
        const caseQuery = `
          SELECT c.id, c."caseId" as case_number, c."customerName"
          FROM cases c
          WHERE c.id = $1
        `;
        const caseResult = await client.query(caseQuery, [actualCaseId]);
        const caseData = caseResult.rows[0];

        const { queueCaseAssignmentNotification } = await import('../queues/notificationQueue');

        // Send notification for each assigned task
        for (const task of createdTasks) {
          if (task.assignedTo) {
            // Get verification type name
            const vtQuery = `
              SELECT name FROM "verificationTypes" WHERE id = $1
            `;
            const vtResult = await client.query(vtQuery, [task.verificationTypeId]);
            const verificationType = vtResult.rows[0]?.name || 'Unknown';

            await queueCaseAssignmentNotification({
              userId: task.assignedTo,
              caseId: actualCaseId,
              caseNumber: caseData.case_number,
              taskId: task.id,
              taskNumber: task.taskNumber,
              customerName: caseData.customerName,
              verificationType: verificationType,
              assignmentType: 'assignment',
              assignedBy: userId,
              reason: 'Task created and assigned',
            });
          }
        }
      } catch (notifError) {
        logger.error('Failed to send task creation notifications:', notifError);
        // Don't fail the request if notification fails
      }

      res.status(201).json({
        success: true,
        data: {
          case_id: actualCaseId,
          tasks_created: createdTasks.length,
          tasks: populatedTasks,
          total_estimated_amount: totalEstimatedAmount
        },
        message: 'Verification tasks created successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating verification tasks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create verification tasks',
        error: { code: 'INTERNAL_ERROR' }
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get all verification tasks across all cases with filtering
   * GET /api/verification-tasks
   */
  static async getAllTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc',
      status,
      priority,
      assignedTo,
      verificationTypeId,
      clientId,
      productId,
      search,
      dateFrom,
      dateTo
    } = req.query;

    try {
      const offset = (Number(page) - 1) * Number(limit);

      // Build WHERE conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Role-based filtering - FIELD_AGENT users can only see their assigned tasks
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole === 'FIELD_AGENT') {
        conditions.push(`vt.assigned_to = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
      } else if (assignedTo) {
        conditions.push(`vt.assigned_to = $${paramIndex}`);
        params.push(assignedTo);
        paramIndex++;
      }

      // Status filter (can be multiple statuses separated by comma)
      if (status) {
        const statuses = (status as string).split(',');
        const statusPlaceholders = statuses.map((_, idx) => `$${paramIndex + idx}`).join(',');
        conditions.push(`vt.status IN (${statusPlaceholders})`);
        params.push(...statuses);
        paramIndex += statuses.length;
      }

      // Priority filter
      if (priority) {
        conditions.push(`vt.priority = $${paramIndex}`);
        params.push(priority);
        paramIndex++;
      }

      // Verification type filter
      if (verificationTypeId) {
        conditions.push(`vt.verification_type_id = $${paramIndex}`);
        params.push(verificationTypeId);
        paramIndex++;
      }

      // Client filter
      if (clientId) {
        conditions.push(`c."clientId" = $${paramIndex}`);
        params.push(parseInt(clientId as string));
        paramIndex++;
      }

      // Product filter
      if (productId) {
        conditions.push(`c."productId" = $${paramIndex}`);
        params.push(parseInt(productId as string));
        paramIndex++;
      }

      // Search filter (customer name, task title, address, task number)
      if (search) {
        conditions.push(`(
          c."customerName" ILIKE $${paramIndex} OR
          vt.task_title ILIKE $${paramIndex} OR
          vt.address ILIKE $${paramIndex} OR
          vt.task_number ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Date range filter
      if (dateFrom) {
        conditions.push(`vt.created_at >= $${paramIndex}`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`vt.created_at <= $${paramIndex}`);
        params.push(dateTo);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Validate sortBy to prevent SQL injection
      const allowedSortFields = ['created_at', 'updated_at', 'assigned_at', 'priority', 'status', 'task_number'];
      const safeSortBy = allowedSortFields.includes(sortBy as string) ? sortBy : 'created_at';
      const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Get total count
      const countResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM verification_tasks vt
        LEFT JOIN cases c ON vt.case_id = c.id
        ${whereClause}
      `, params);

      const totalTasks = parseInt(countResult.rows[0].total);

      // Get tasks with populated data
      const tasksResult = await pool.query(`
        SELECT
          vt.*,
          c."caseId" as case_number,
          c."customerName" as customer_name,
          c.status as case_status,
          cl.name as client_name,
          p.name as product_name,
          vtype.name as verification_type_name,
          u_assigned.name as assigned_to_name,
          u_assigned."employeeId" as assigned_to_employee_id,
          u_created.name as assigned_by_name,
          rt.name as rate_type_name,
          tcc.status as commission_status,
          tcc.calculated_commission
        FROM verification_tasks vt
        LEFT JOIN cases c ON vt.case_id = c.id
        LEFT JOIN clients cl ON c."clientId" = cl.id
        LEFT JOIN products p ON c."productId" = p.id
        LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
        LEFT JOIN users u_assigned ON vt.assigned_to = u_assigned.id
        LEFT JOIN users u_created ON vt.assigned_by = u_created.id
        LEFT JOIN "rateTypes" rt ON vt.rate_type_id = rt.id
        LEFT JOIN task_commission_calculations tcc ON vt.id = tcc.verification_task_id
        ${whereClause}
        ORDER BY vt.${safeSortBy} ${safeSortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, Number(limit), offset]);

      const tasks = tasksResult.rows.map(row => ({
        id: row.id,
        taskNumber: row.task_number,
        caseId: row.case_id,
        caseNumber: row.case_number,
        customerName: row.customer_name,
        caseStatus: row.case_status,
        client: row.client_name ? { name: row.client_name } : null,
        product: row.product_name ? { name: row.product_name } : null,
        verificationType: {
          id: row.verification_type_id,
          name: row.verification_type_name
        },
        taskTitle: row.task_title,
        taskDescription: row.task_description,
        status: row.status,
        priority: row.priority,
        assignedTo: row.assigned_to ? {
          id: row.assigned_to,
          name: row.assigned_to_name,
          employeeId: row.assigned_to_employee_id
        } : null,
        assignedBy: row.assigned_by ? {
          id: row.assigned_by,
          name: row.assigned_by_name
        } : null,
        verificationOutcome: row.verification_outcome,
        rateType: row.rate_type_name ? {
          id: row.rate_type_id,
          name: row.rate_type_name
        } : null,
        estimatedAmount: parseFloat(row.estimated_amount || '0'),
        actualAmount: parseFloat(row.actual_amount || '0'),
        address: row.address,
        pincode: row.pincode,
        trigger: row.trigger,
        applicantType: row.applicant_type,
        documentType: row.document_type,
        documentNumber: row.document_number,
        documentDetails: row.document_details,
        assignedAt: row.assigned_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        estimatedCompletionDate: row.estimated_completion_date,
        commissionStatus: row.commission_status,
        calculatedCommission: parseFloat(row.calculated_commission || '0'),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      // Calculate statistics
      const statsResult = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE vt.status = 'PENDING') as pending_count,
          COUNT(*) FILTER (WHERE vt.status = 'ASSIGNED') as assigned_count,
          COUNT(*) FILTER (WHERE vt.status = 'IN_PROGRESS') as in_progress_count,
          COUNT(*) FILTER (WHERE vt.status = 'COMPLETED') as completed_count,
          COUNT(*) FILTER (WHERE vt.status = 'CANCELLED') as cancelled_count,
          COUNT(*) FILTER (WHERE vt.status = 'ON_HOLD') as on_hold_count,
          COUNT(*) FILTER (WHERE vt.priority = 'URGENT') as urgent_count,
          COUNT(*) FILTER (WHERE vt.priority = 'HIGH') as high_priority_count
        FROM verification_tasks vt
        LEFT JOIN cases c ON vt.case_id = c.id
        ${whereClause}
      `, params);

      const stats = statsResult.rows[0];

      res.json({
        success: true,
        data: {
          tasks,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalTasks,
            totalPages: Math.ceil(totalTasks / Number(limit))
          },
          statistics: {
            pending: parseInt(stats.pending_count || '0'),
            assigned: parseInt(stats.assigned_count || '0'),
            inProgress: parseInt(stats.in_progress_count || '0'),
            completed: parseInt(stats.completed_count || '0'),
            cancelled: parseInt(stats.cancelled_count || '0'),
            onHold: parseInt(stats.on_hold_count || '0'),
            urgent: parseInt(stats.urgent_count || '0'),
            highPriority: parseInt(stats.high_priority_count || '0')
          }
        },
        message: 'Verification tasks retrieved successfully'
      });

    } catch (error) {
      logger.error('Error getting all verification tasks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get verification tasks',
        error: { code: 'INTERNAL_ERROR' }
      });
    }
  }

  /**
   * Get all verification tasks for a case
   * GET /api/cases/:caseId/verification-tasks
   */
  static async getTasksForCase(req: Request, res: Response): Promise<void> {
    const { caseId } = req.params;
    const { status, assigned_to, verification_type_id } = req.query;

    try {
      // First, resolve the case ID - it could be a case number or UUID
      let actualCaseId = caseId;

      // Check if caseId is a number (case number) and convert to UUID
      if (/^\d+$/.test(caseId)) {
        const caseQuery = 'SELECT id FROM cases WHERE "caseId" = $1';
        const caseResult = await pool.query(caseQuery, [parseInt(caseId)]);

        if (caseResult.rows.length === 0) {
          res.status(404).json({
            success: false,
            message: 'Case not found'
          });
          return;
        }

        actualCaseId = caseResult.rows[0].id;
      }

      let whereConditions = ['vt.case_id = $1'];
      let queryParams: any[] = [actualCaseId];
      let paramIndex = 2;

      // Add filters
      if (status) {
        whereConditions.push(`vt.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (assigned_to) {
        whereConditions.push(`vt.assigned_to = $${paramIndex}`);
        queryParams.push(assigned_to);
        paramIndex++;
      }

      if (verification_type_id) {
        whereConditions.push(`vt.verification_type_id = $${paramIndex}`);
        queryParams.push(verification_type_id);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get case information including trigger and applicant_type
      const caseResult = await pool.query(`
        SELECT
          c.id, c."caseId" as case_number, c."customerName" as customer_name,
          c.trigger, c."applicantType" as applicant_type,
          c.has_multiple_tasks, c.total_tasks_count, c.completed_tasks_count,
          c.case_completion_percentage
        FROM cases c
        WHERE c.id = $1
      `, [actualCaseId]);

      if (caseResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Case not found',
          error: { code: 'CASE_NOT_FOUND' }
        });
        return;
      }

      const caseInfo = caseResult.rows[0];

      // Get verification tasks with populated data
      const tasksResult = await pool.query(`
        SELECT 
          vt.*,
          vtype.name as verification_type_name,
          u_assigned.name as assigned_to_name,
          u_assigned."employeeId" as assigned_to_employee_id,
          u_created.name as assigned_by_name,
          rt.name as rate_type_name,
          tcc.status as commission_status,
          tcc.calculated_commission
        FROM verification_tasks vt
        LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
        LEFT JOIN users u_assigned ON vt.assigned_to = u_assigned.id
        LEFT JOIN users u_created ON vt.assigned_by = u_created.id
        LEFT JOIN "rateTypes" rt ON vt.rate_type_id = rt.id
        LEFT JOIN task_commission_calculations tcc ON vt.id = tcc.verification_task_id
        WHERE ${whereClause}
        ORDER BY vt.created_at ASC
      `, queryParams);

      const tasks = tasksResult.rows.map(row => ({
        id: row.id,
        task_number: row.task_number,
        case_id: row.case_id,
        case_number: caseInfo.case_number,
        customer_name: caseInfo.customer_name,
        verification_type_id: row.verification_type_id,
        verification_type_name: row.verification_type_name,
        task_title: row.task_title,
        task_description: row.task_description,
        status: row.status,
        priority: row.priority,
        assigned_to: row.assigned_to,
        assigned_to_name: row.assigned_to_name,
        assigned_to_employee_id: row.assigned_to_employee_id,
        assigned_by: row.assigned_by,
        assigned_by_name: row.assigned_by_name,
        verification_outcome: row.verification_outcome,
        rate_type_id: row.rate_type_id,
        rate_type_name: row.rate_type_name,
        estimated_amount: parseFloat(row.estimated_amount || '0'),
        actual_amount: parseFloat(row.actual_amount || '0'),
        address: row.address,
        pincode: row.pincode,
        // Use task-level trigger/applicant_type if available, otherwise fall back to case-level
        trigger: row.trigger || caseInfo.trigger,
        applicant_type: row.applicant_type || caseInfo.applicant_type,
        document_type: row.document_type,
        document_number: row.document_number,
        document_details: row.document_details,
        assigned_at: row.assigned_at,
        started_at: row.started_at,
        completed_at: row.completed_at,
        estimated_completion_date: row.estimated_completion_date,
        commission_status: row.commission_status,
        calculated_commission: parseFloat(row.calculated_commission || '0'),
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      res.json({
        success: true,
        data: {
          case_id: actualCaseId,
          case_number: caseInfo.case_number,
          customer_name: caseInfo.customer_name,
          total_tasks: parseInt(caseInfo.total_tasks_count || '0'),
          completed_tasks: parseInt(caseInfo.completed_tasks_count || '0'),
          completion_percentage: parseFloat(caseInfo.case_completion_percentage || '0'),
          tasks
        },
        message: 'Verification tasks retrieved successfully'
      });

    } catch (error) {
      logger.error('Error getting verification tasks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get verification tasks',
        error: { code: 'INTERNAL_ERROR' }
      });
    }
  }

  /**
   * Update a verification task
   * PUT /api/verification-tasks/:taskId
   */
  static async updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { taskId } = req.params;
    const updateData: UpdateVerificationTaskData = req.body;
    const userId = req.user?.id;

    try {
      // Build dynamic update query
      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbField = this.camelToSnakeCase(key);
          updateFields.push(`${dbField} = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid fields to update',
          error: { code: 'INVALID_INPUT' }
        });
        return;
      }

      updateFields.push(`updated_at = NOW()`);
      queryParams.push(taskId);

      const updateQuery = `
        UPDATE verification_tasks 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, queryParams);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' }
        });
        return;
      }

      const updatedTask = result.rows[0];

      // Create audit log
      await createAuditLog({
        userId: userId!,
        action: 'UPDATE_VERIFICATION_TASK',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: updateData
      });

      res.json({
        success: true,
        data: updatedTask,
        message: 'Verification task updated successfully'
      });

    } catch (error) {
      logger.error('Error updating verification task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update verification task',
        error: { code: 'INTERNAL_ERROR' }
      });
    }
  }

  /**
   * Helper method to get tasks with populated data
   */
  private static async getTasksWithPopulatedData(taskIds: string[]): Promise<VerificationTask[]> {
    if (taskIds.length === 0) return [];

    const placeholders = taskIds.map((_, index) => `$${index + 1}`).join(',');
    
    const result = await pool.query(`
      SELECT 
        vt.*,
        vtype.name as verification_type_name,
        u_assigned.name as assigned_to_name,
        u_created.name as assigned_by_name,
        rt.name as rate_type_name
      FROM verification_tasks vt
      LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
      LEFT JOIN users u_assigned ON vt.assigned_to = u_assigned.id
      LEFT JOIN users u_created ON vt.assigned_by = u_created.id
      LEFT JOIN "rateTypes" rt ON vt.rate_type_id = rt.id
      WHERE vt.id IN (${placeholders})
      ORDER BY vt.created_at ASC
    `, taskIds);

    return result.rows;
  }

  /**
   * Assign or reassign a verification task
   * POST /api/verification-tasks/:taskId/assign
   */
  static async assignTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { taskId } = req.params;
    const { assignedTo, assignmentReason, priority }: AssignVerificationTaskData = req.body;
    const userId = req.user?.id;

    if (!assignedTo) {
      res.status(400).json({
        success: false,
        message: 'assignedTo is required',
        error: { code: 'INVALID_INPUT' }
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current task details
      const taskResult = await client.query(
        'SELECT * FROM verification_tasks WHERE id = $1',
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' }
        });
        return;
      }

      const currentTask = taskResult.rows[0];
      const previousAssignee = currentTask.assigned_to;
      const previousStatus = currentTask.status;

      // Update task assignment
      const updateResult = await client.query(`
        UPDATE verification_tasks
        SET
          assigned_to = $1,
          assigned_by = $2,
          assigned_at = NOW(),
          status = CASE
            WHEN status = 'PENDING' THEN 'ASSIGNED'
            WHEN status = 'COMPLETED' OR status = 'CANCELLED' THEN status
            ELSE 'ASSIGNED'
          END,
          priority = COALESCE($3, priority),
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [assignedTo, userId, priority, taskId]);

      const updatedTask = updateResult.rows[0];

      // Create assignment history
      await client.query(`
        INSERT INTO task_assignment_history (
          verification_task_id, case_id, assigned_from, assigned_to,
          assigned_by, assignment_reason, task_status_before, task_status_after
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        taskId, currentTask.case_id, previousAssignee, assignedTo,
        userId, assignmentReason, previousStatus, updatedTask.status
      ]);

      // Create audit log
      await createAuditLog({
        userId: userId!,
        action: 'ASSIGN_VERIFICATION_TASK',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: {
          previousAssignee,
          newAssignee: assignedTo,
          assignmentReason: assignmentReason,
          priority
        }
      });

      await client.query('COMMIT');

      // Send notification to assigned user
      try {
        // Get case and user details for notification
        const caseQuery = `
          SELECT c.id, c."caseId" as case_number, c."customerName"
          FROM cases c
          WHERE c.id = $1
        `;
        const caseResult = await client.query(caseQuery, [currentTask.case_id]);
        const caseData = caseResult.rows[0];

        // Get verification type name
        const vtQuery = `
          SELECT name FROM "verificationTypes" WHERE id = $1
        `;
        const vtResult = await client.query(vtQuery, [currentTask.verification_type_id]);
        const verificationType = vtResult.rows[0]?.name || 'Unknown';

        // Queue notification
        const { queueCaseAssignmentNotification } = await import('../queues/notificationQueue');
        await queueCaseAssignmentNotification({
          userId: assignedTo,
          caseId: currentTask.case_id,
          caseNumber: caseData.case_number,
          taskId: taskId,
          taskNumber: updatedTask.task_number,
          customerName: caseData.customerName,
          verificationType: verificationType,
          assignmentType: previousAssignee ? 'reassignment' : 'assignment',
          assignedBy: userId,
          reason: assignmentReason,
        });
      } catch (notifError) {
        logger.error('Failed to send task assignment notification:', notifError);
        // Don't fail the request if notification fails
      }

      res.json({
        success: true,
        data: updatedTask,
        message: 'Verification task assigned successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error assigning verification task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign verification task',
        error: { code: 'INTERNAL_ERROR' }
      });
    } finally {
      client.release();
    }
  }

  /**
   * Complete a verification task
   * POST /api/verification-tasks/:taskId/complete
   */
  static async completeTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { taskId } = req.params;
    const {
      verificationOutcome,
      actualAmount,
      completionNotes,
      formSubmissionId
    }: CompleteVerificationTaskData = req.body;
    const userId = req.user?.id;

    if (!verificationOutcome) {
      res.status(400).json({
        success: false,
        message: 'verification_outcome is required',
        error: { code: 'INVALID_INPUT' }
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current task details
      const taskResult = await client.query(`
        SELECT vt.*, c."clientId", c."productId"
        FROM verification_tasks vt
        JOIN cases c ON vt.case_id = c.id
        WHERE vt.id = $1
      `, [taskId]);

      if (taskResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({
          success: false,
          message: 'Verification task not found',
          error: { code: 'TASK_NOT_FOUND' }
        });
        return;
      }

      const task = taskResult.rows[0];

      if (task.status === 'COMPLETED') {
        await client.query('ROLLBACK');
        res.status(400).json({
          success: false,
          message: 'Task is already completed',
          error: { code: 'TASK_ALREADY_COMPLETED' }
        });
        return;
      }

      // Update task to completed
      const updateResult = await client.query(`
        UPDATE verification_tasks
        SET
          status = 'COMPLETED',
          verification_outcome = $1,
          actual_amount = COALESCE($2, estimated_amount),
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [verificationOutcome, actualAmount, taskId]);

      const completedTask = updateResult.rows[0];

      // Link form submission if provided
      if (formSubmissionId) {
        await client.query(`
          INSERT INTO task_form_submissions (
            verification_task_id, case_id, form_submission_id,
            form_type, submitted_by, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          taskId, task.case_id, formSubmissionId,
          'VERIFICATION_FORM', userId
        ]);
      }

      // Calculate commission if rate type is available
      if (task.rate_type_id && task.assigned_to) {
        await VerificationTasksController.calculateTaskCommission(
          client, taskId, task, completedTask.actual_amount
        );
      }

      // Create audit log
      await createAuditLog({
        userId: userId!,
        action: 'COMPLETE_VERIFICATION_TASK',
        entityType: 'VERIFICATION_TASK',
        entityId: taskId,
        details: {
          verificationOutcome: verificationOutcome,
          actualAmount: actualAmount,
          completionNotes: completionNotes,
          formSubmissionId: formSubmissionId
        }
      });

      await client.query('COMMIT');

      res.json({
        success: true,
        data: completedTask,
        message: 'Verification task completed successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error completing verification task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete verification task',
        error: { code: 'INTERNAL_ERROR' }
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get tasks assigned to current user (for mobile app)
   * GET /api/mobile/my-verification-tasks
   */
  static async getMyTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    const { status, priority } = req.query;

    try {
      let whereConditions = ['vt.assigned_to = $1'];
      let queryParams: any[] = [userId];
      let paramIndex = 2;

      if (status) {
        whereConditions.push(`vt.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (priority) {
        whereConditions.push(`vt.priority = $${paramIndex}`);
        queryParams.push(priority);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get tasks with case information
      const tasksResult = await pool.query(`
        SELECT
          vt.id, vt.task_number, vt.case_id, vt.task_title,
          vt.status, vt.priority, vt.address, vt.estimated_amount,
          vt.assigned_at, vt.estimated_completion_date,
          vt.document_type, vt.document_details,
          c."caseId" as case_number, c."customerName" as customer_name,
          vtype.name as verification_type
        FROM verification_tasks vt
        JOIN cases c ON vt.case_id = c.id
        JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
        WHERE ${whereClause}
        ORDER BY
          CASE vt.priority
            WHEN 'URGENT' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            WHEN 'LOW' THEN 4
          END,
          vt.assigned_at ASC
      `, queryParams);

      // Get summary statistics
      const summaryResult = await pool.query(`
        SELECT
          COUNT(*) as total_assigned,
          COUNT(CASE WHEN status = 'PENDING' OR status = 'ASSIGNED' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'COMPLETED' AND DATE(completed_at) = CURRENT_DATE THEN 1 END) as completed_today,
          COUNT(CASE WHEN status = 'COMPLETED' AND completed_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as completed_this_week,
          COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN actual_amount ELSE 0 END), 0) as total_earnings
        FROM verification_tasks
        WHERE assigned_to = $1
      `, [userId]);

      const summary = summaryResult.rows[0];

      res.json({
        success: true,
        data: {
          tasks: tasksResult.rows,
          summary: {
            total_assigned: parseInt(summary.total_assigned),
            pending: parseInt(summary.pending),
            in_progress: parseInt(summary.in_progress),
            completed_today: parseInt(summary.completed_today),
            completed_this_week: parseInt(summary.completed_this_week),
            total_earnings: parseFloat(summary.total_earnings),
            pending_commission: 0 // Will be calculated from commission table
          }
        },
        message: 'Tasks retrieved successfully'
      });

    } catch (error) {
      logger.error('Error getting user tasks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get tasks',
        error: { code: 'INTERNAL_ERROR' }
      });
    }
  }

  /**
   * Helper method to calculate commission for completed task
   */
  private static async calculateTaskCommission(
    client: any,
    taskId: string,
    task: any,
    actualAmount: number
  ): Promise<void> {
    try {
      // Get rate type information
      const rateResult = await client.query(
        'SELECT * FROM "rateTypes" WHERE id = $1',
        [task.rate_type_id]
      );

      if (rateResult.rows.length === 0) return;

      const rateType = rateResult.rows[0];
      const commissionAmount = parseFloat(rateType.commissionAmount || '0');

      // Insert commission calculation
      await client.query(`
        INSERT INTO task_commission_calculations (
          verification_task_id, case_id, task_number, user_id,
          client_id, rate_type_id, base_amount, commission_amount,
          calculated_commission, calculation_method, task_completed_at,
          verification_outcome, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)
      `, [
        taskId, task.case_id, task.task_number, task.assigned_to,
        task.clientId, task.rate_type_id, actualAmount, commissionAmount,
        commissionAmount, 'FIXED_AMOUNT', task.verification_outcome, 'CALCULATED'
      ]);

    } catch (error) {
      logger.error('Error calculating task commission:', error);
      // Don't throw error to avoid breaking the main transaction
    }
  }



  /**
   * Helper method to convert camelCase to snake_case
   */
  private static camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
