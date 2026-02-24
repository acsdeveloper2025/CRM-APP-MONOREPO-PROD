import { PoolClient } from 'pg';
import type { VerificationTask } from '../types/verificationTask';
import { createAuditLog } from '../utils/auditLogger';
import { financialConfigurationValidator } from './financialConfigurationValidator';

export class VerificationTaskCreationError extends Error {
  status: number;
  responseBody: Record<string, unknown>;

  constructor(status: number, responseBody: Record<string, unknown>) {
    super(String((responseBody.message as string) || 'Verification task creation failed'));
    this.status = status;
    this.responseBody = responseBody;
  }
}

export interface VerificationTaskCreationResult {
  status: 'CREATED';
  caseInfo: Record<string, unknown>;
  createdTasks: VerificationTask[];
  totalEstimatedAmount: number;
}

export class VerificationTaskCreationService {
  static async createForCase(
    client: PoolClient,
    caseId: string,
    tasks: Record<string, unknown>[],
    userId: string | undefined
  ): Promise<VerificationTaskCreationResult> {
    // Verify case exists and get case details for rate lookup
    const caseResult = await client.query(
      'SELECT id, "caseId", "customerName", "clientId", "productId", "verificationTypeId" FROM cases WHERE id = $1',
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      throw new VerificationTaskCreationError(404, {
        success: false,
        message: 'Case not found',
        error: { code: 'CASE_NOT_FOUND' },
      });
    }

    const createdTasks: VerificationTask[] = [];
    let totalEstimatedAmount = 0;
    const caseInfo = caseResult.rows[0];

    // Create each verification task
    for (const taskData of tasks) {
      const {
        verification_type_id: verificationTypeId,
        task_title: taskTitle,
        task_description: taskDescription,
        priority = 'MEDIUM',
        assigned_to: assignedTo,
        rate_type_id: initialRateTypeId,
        estimated_amount: _estimatedAmount,
        address,
        pincode,
        document_type: documentType,
        document_number: documentNumber,
        document_details: documentDetails,
        estimated_completion_date: estimatedCompletionDate,
        area_id: areaId, // Assuming area_id is passed in taskData
      } = taskData;

      let rateTypeId = initialRateTypeId as number | undefined;

      // STRICT VALIDATION: Resolve Pincode ID and Validate Financial Configuration
      let serviceZoneId: number | null = null;
      let actualAmount: number | null = null;

      // Resolve pincodeId from pincode string
      let pincodeDbId: number | null = null;
      if (pincode) {
        const pinRes = await client.query('SELECT id FROM pincodes WHERE code = $1', [
          String(pincode as string),
        ]);
        if (pinRes.rows[0]) {
          pincodeDbId = pinRes.rows[0].id as number;
        } else {
          throw new VerificationTaskCreationError(400, {
            success: false,
            message: 'Invalid pincode provided',
            error: { code: 'INVALID_PINCODE' },
          });
        }
      } else {
        throw new VerificationTaskCreationError(400, {
          success: false,
          message: 'Pincode is required for task creation',
          error: { code: 'PINCODE_REQUIRED' },
        });
      }

      // STRICT VALIDATION: Validate complete financial configuration chain
      if (!caseInfo.clientId || !caseInfo.productId || !verificationTypeId) {
        throw new VerificationTaskCreationError(400, {
          success: false,
          message: 'Client, Product, and Verification Type are required',
          error: { code: 'MISSING_REQUIRED_FIELDS' },
        });
      }

      const validationResult = await financialConfigurationValidator.validateTaskConfiguration(
        caseInfo.clientId as number,
        caseInfo.productId as number,
        Number(verificationTypeId),
        pincodeDbId,
        areaId ? Number(areaId) : null
      );

      if (!validationResult.isValid) {
        throw new VerificationTaskCreationError(422, {
          success: false,
          message: validationResult.errorMessage,
          error: {
            code: validationResult.errorCode,
            details: {
              clientId: caseInfo.clientId,
              productId: caseInfo.productId,
              verificationTypeId,
              pincodeId: pincodeDbId,
              areaId: areaId ? Number(areaId) : null,
            },
          },
        });
      }

      // Configuration is valid - use validated values
      serviceZoneId = validationResult.serviceZoneId!;
      rateTypeId = validationResult.rateTypeId!;
      actualAmount = validationResult.amount!;

      // actualAmount is already set by the validator
      // No need for additional rate lookup

      // Validate required fields
      if (!verificationTypeId || !taskTitle) {
        throw new VerificationTaskCreationError(400, {
          success: false,
          message: 'verification_type_id and task_title are required for each task',
          error: { code: 'INVALID_TASK_DATA' },
        });
      }

      // Determine status based on assignment
      const isAssigned = !!assignedTo;
      const assignedToValue = isAssigned ? String(assignedTo as string) : null;
      const taskStatus = isAssigned ? 'ASSIGNED' : 'PENDING';

      let insertQuery: string;
      let insertParams: (string | number | boolean | null | Date | undefined)[];

      if (isAssigned) {
        insertQuery = `
            INSERT INTO verification_tasks (
              case_id, verification_type_id, task_title, task_description,
              priority, assigned_to, assigned_by, assigned_at,
              rate_type_id, estimated_amount, address, pincode,
              document_type, document_number, document_details,
              estimated_completion_date, status, created_by,
              first_assigned_at, current_assigned_at,
              service_zone_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, NOW(),
              $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, NOW(), NOW(),
              $18
            ) RETURNING *
          `;
        insertParams = [
          caseId,
          Number(verificationTypeId),
          String(taskTitle as string),
          taskDescription as string | undefined,
          String(priority as string),
          assignedToValue,
          userId,
          rateTypeId,
          actualAmount,
          address as string | undefined,
          String(pincode as string),
          documentType as string | undefined,
          documentNumber as string | undefined,
          JSON.stringify(documentDetails),
          estimatedCompletionDate as string | undefined,
          taskStatus,
          userId,
          serviceZoneId,
        ];
      } else {
        insertQuery = `
            INSERT INTO verification_tasks (
              case_id, verification_type_id, task_title, task_description,
              priority, assigned_to, assigned_by, assigned_at,
              rate_type_id, estimated_amount, address, pincode,
              document_type, document_number, document_details,
              estimated_completion_date, status, created_by,
              first_assigned_at, current_assigned_at,
              service_zone_id
            ) VALUES (
              $1, $2, $3, $4, $5, NULL, NULL, NULL,
              $6, $7, $8, $9, $10, $11, $12, $13,
              $14, $15, NOW(), NOW(),
              $16
            ) RETURNING *
          `;
        insertParams = [
          caseId,
          Number(verificationTypeId),
          String(taskTitle as string),
          taskDescription as string | undefined,
          String(priority as string),
          rateTypeId,
          actualAmount,
          address as string | undefined,
          String(pincode as string),
          documentType as string | undefined,
          documentNumber as string | undefined,
          JSON.stringify(documentDetails),
          estimatedCompletionDate as string | undefined,
          taskStatus,
          userId,
          serviceZoneId,
        ];
      }

      const taskResult = await client.query(insertQuery, insertParams);

      const task = taskResult.rows[0] as VerificationTask;
      createdTasks.push(task);
      totalEstimatedAmount += actualAmount || 0;

      // Create assignment history if assigned
      if (assignedTo) {
        await client.query(
          `
            INSERT INTO task_assignment_history (
              verification_task_id, case_id, assigned_to, assigned_by,
              assignment_reason, task_status_before, task_status_after
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            task.id,
            caseId,
            assignedTo,
            userId,
            'Initial assignment during task creation',
            'PENDING',
            'ASSIGNED',
          ]
        );
      }

      // Create audit log
      await createAuditLog({
        userId,
        action: 'CREATE_VERIFICATION_TASK',
        entityType: 'VERIFICATION_TASK',
        entityId: task.id,
        details: {
          caseId,
          taskTitle,
          verificationType: verificationTypeId,
          assignedTo,
        },
      });
    }

    // Update case to reflect multiple tasks
    await client.query(
      `
        UPDATE cases
        SET
          has_multiple_tasks = true,
          total_tasks_count = (
            SELECT COUNT(*) FROM verification_tasks WHERE case_id = $1
          ),
          "updatedAt" = NOW()
        WHERE id = $1
      `,
      [caseId]
    );

    return {
      status: 'CREATED',
      caseInfo,
      createdTasks,
      totalEstimatedAmount,
    };
  }
}
