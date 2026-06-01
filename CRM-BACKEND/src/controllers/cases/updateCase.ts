import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query as dbQuery } from '../../config/database';
import { QueryParams } from '../../types/database';
import { CacheKeys, invalidateCachePatterns } from '../../services/enterpriseCacheService';
import { checkEditable, buildEditBlockedResponse } from '@/utils/editLockGuard';
import { createAuditLog } from '../../utils/auditLogger';

// PUT /api/cases/:id - Update case
export const updateCase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? String(rawId[0]) : String(rawId || '');
    // Cases are bound to their client/product at creation. Re-tenanting
    // an existing case has no legitimate business flow and was a
    // cross-tenant data-integrity exploit (audit P23 commit, 2026-05-15:
    // a multi-client BACKEND_USER could PUT body={clientId:<other_assigned>}
    // with no active scope and silently move a case between her assigned
    // banks). The FE edit form pre-fills clientId/productId and re-sends
    // them only because the same component renders both create and edit;
    // they're noise on PUT. Strip them here so even a malicious or
    // mis-built client cannot mutate the tenancy of an existing case.
    const {
      customerName,
      customerPhone,
      customerCallingCode,
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
      },
    });

    // IN_PROGRESS edit-lock — see project_in_progress_edit_lock_audit_2026_05_24.md.
    // Pre-fix, case-level fields (customerName, customerPhone, pincode,
    // priority, trigger, applicantType, backendContactNumber, verificationTypeId)
    // mutated freely while the case was being verified — operators could
    // change the customer name mid-verification, breaking the audit trail
    // and causing field-agent confusion. The legacy work-order lock at
    // line ~1382 only covered task-level fields (rateTypeId/address) so
    // direct API callers bypassed it for everything else.
    const statusRow = await dbQuery<{ status: string }>(`SELECT status FROM cases WHERE id = $1`, [
      id,
    ]);
    if (statusRow.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    const caseEditCheck = checkEditable(statusRow.rows[0].status);
    // Reassignment of a task (assignedToId only, no other field) is an
    // exception — it stays allowed because the reassignment flow operates
    // on REVOKED → ASSIGNED transitions and is the only legitimate way to
    // re-route a stuck verification. All other mutations are blocked.
    const isAssignmentOnly =
      assignedToId !== undefined &&
      customerName === undefined &&
      customerPhone === undefined &&
      customerCallingCode === undefined &&
      verificationTypeId === undefined &&
      pincode === undefined &&
      priority === undefined &&
      trigger === undefined &&
      applicantType === undefined &&
      backendContactNumber === undefined &&
      rateTypeId === undefined &&
      address === undefined;
    if (!caseEditCheck.editable && !isAssignmentOnly) {
      logger.warn('⚠️ Rejected Case update — IN_PROGRESS/terminal status', {
        caseId: id,
        currentStatus: statusRow.rows[0].status,
        userId: req.user?.id,
      });
      return res.status(409).json(buildEditBlockedResponse('Case', caseEditCheck));
    }

    // Build dynamic update query for cases table
    const updateFields: string[] = [];
    const values: QueryParams = [];
    let paramIndex = 1;

    if (customerName !== undefined) {
      updateFields.push(`customer_name = $${paramIndex}`);
      values.push(customerName);
      paramIndex++;
    }
    if (customerPhone !== undefined) {
      updateFields.push(`customer_phone = $${paramIndex}`);
      values.push(customerPhone);
      paramIndex++;
    }
    if (customerCallingCode !== undefined) {
      updateFields.push(`customer_calling_code = $${paramIndex}`);
      values.push(customerCallingCode);
      paramIndex++;
    }
    // (clientId / productId intentionally NOT applied — see strip note above.)
    if (verificationTypeId !== undefined) {
      updateFields.push(`verification_type_id = $${paramIndex}`);
      values.push(verificationTypeId);
      paramIndex++;
    }
    // `pincode` is intentionally NOT applied on the cases table — the
    // column doesn't exist there (it lives on verification_tasks as
    // pincode_id FK). Pre-fix the controller unconditionally appended
    // `pincode = $N` if the field was present in the body, which 500'd
    // every Edit-from-task save once the FE form populated `pincode`
    // from the loaded task data. The body is destructured for the
    // task-level pipeline only (NOT applied here on cases).
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
      updateFields.push(`applicant_type = $${paramIndex}`);
      values.push(applicantType);
      paramIndex++;
    }
    if (backendContactNumber !== undefined) {
      updateFields.push(`backend_contact_number = $${paramIndex}`);
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
      updateFields.push(`updated_at = NOW()`);

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
        values: values.map((v, i) => `$${i + 1} = ${JSON.stringify(v)}`),
      });

      const result = await dbQuery(updateQuery, values);

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
        const targetTaskId = taskId; // Should be provided, but might check caseId if not

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

        const lockCheckResult = await dbQuery(lockCheckQuery, lockCheckParams);

        const hasLockedTask = lockCheckResult.rows.some(
          t =>
            t.status === 'IN_PROGRESS' ||
            t.status === 'COMPLETED' ||
            t.status === 'REVOKED' ||
            t.startedAt !== null
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

        // ✅ CRITICAL FIX: Use taskId if provided, otherwise fall back to caseId
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
          values: taskValues.map((v, i) => `$${i + 1} = ${JSON.stringify(v)}`),
          whereClause,
          taskId,
        });

        const taskResult = await dbQuery(taskUpdateQuery, taskValues);

        logger.info('✅ Verification task update result', {
          rowsAffected: taskResult.rowCount,
          updatedTask: taskResult.rows[0]
            ? {
                id: taskResult.rows[0].id,
                status: taskResult.rows[0].status,
                assignedTo: taskResult.rows[0].assignedTo,
                rateTypeId: taskResult.rows[0].rateTypeId,
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

    // Invalidate stale cache entries for this case
    void invalidateCachePatterns(CacheKeys.invalidateCase(id));

    // T0-7 (audit 2026-05-17): DPDP §11 audit trail on case PII update.
    void createAuditLog({
      action: 'CASE_UPDATED',
      entityType: 'CASE',
      entityId: String(id),
      userId: req.user?.id,
      details: {
        taskId: taskId || null,
        updatedCaseFields: updateFields.filter(field => !field.includes('updatedAt')),
        updatedTaskFields: { assignedToId, rateTypeId, address: address ? 'changed' : null },
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || undefined,
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
