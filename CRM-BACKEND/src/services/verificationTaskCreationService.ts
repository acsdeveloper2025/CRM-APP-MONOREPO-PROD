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

export interface ValidatedTaskTerritoryContext {
  pincodeDbId: number;
  areaId: number;
  serviceZoneId: number;
  rateTypeId: number;
  amount: number;
}

export class VerificationTaskCreationService {
  static async validateTerritoryAndFinancialConfig(
    client: Pick<PoolClient, 'query'>,
    params: {
      clientId: number;
      productId: number;
      verificationTypeId: number;
      pincode: unknown;
      areaId: unknown;
      rateTypeId?: number | null;
    }
  ): Promise<ValidatedTaskTerritoryContext> {
    const { clientId, productId, verificationTypeId } = params;
    const normalizedRateTypeId =
      params.rateTypeId === null || params.rateTypeId === undefined
        ? null
        : typeof params.rateTypeId === 'string' || typeof params.rateTypeId === 'number'
          ? Number(String(params.rateTypeId).trim())
          : null;

    const pincodeCode =
      typeof params.pincode === 'string' || typeof params.pincode === 'number'
        ? String(params.pincode).trim()
        : '';

    if (!pincodeCode) {
      throw new VerificationTaskCreationError(400, {
        success: false,
        message: 'Pincode is required for task creation',
        error: { code: 'PINCODE_REQUIRED' },
      });
    }

    const pinRes = await client.query('SELECT id FROM pincodes WHERE code = $1', [pincodeCode]);
    if (!pinRes.rows[0]) {
      throw new VerificationTaskCreationError(400, {
        success: false,
        message: 'Invalid pincode provided',
        error: { code: 'INVALID_PINCODE' },
      });
    }
    const pincodeDbId = Number(pinRes.rows[0].id);

    const areaIdInput = params.areaId;
    const normalizedAreaId =
      areaIdInput === null ||
      areaIdInput === undefined ||
      ((typeof areaIdInput === 'string' || typeof areaIdInput === 'number') &&
        String(areaIdInput).trim() === '')
        ? null
        : Number(areaIdInput);

    if (!normalizedAreaId || Number.isNaN(normalizedAreaId) || normalizedAreaId <= 0) {
      throw new VerificationTaskCreationError(400, {
        success: false,
        message: 'Area is required for task creation',
        error: { code: 'AREA_REQUIRED' },
      });
    }

    const pincodeAreaRes = await client.query(
      'SELECT 1 FROM "pincodeAreas" WHERE "pincodeId" = $1 AND "areaId" = $2 LIMIT 1',
      [pincodeDbId, normalizedAreaId]
    );
    if (!pincodeAreaRes.rows[0]) {
      throw new VerificationTaskCreationError(400, {
        success: false,
        message: 'Selected area is not mapped to the selected pincode',
        error: {
          code: 'AREA_PINCODE_MISMATCH',
          details: { pincodeId: pincodeDbId, areaId: normalizedAreaId },
        },
      });
    }

    const validationResult = await financialConfigurationValidator.validateTaskConfiguration(
      clientId,
      productId,
      verificationTypeId,
      pincodeDbId,
      normalizedAreaId,
      normalizedRateTypeId && !Number.isNaN(normalizedRateTypeId) && normalizedRateTypeId > 0
        ? normalizedRateTypeId
        : null
    );

    if (!validationResult.isValid) {
      throw new VerificationTaskCreationError(422, {
        success: false,
        message: validationResult.errorMessage,
        error: {
          code: validationResult.errorCode,
          details: {
            clientId,
            productId,
            verificationTypeId,
            pincodeId: pincodeDbId,
            areaId: normalizedAreaId,
          },
        },
      });
    }

    return {
      pincodeDbId,
      areaId: normalizedAreaId,
      serviceZoneId: Number(validationResult.serviceZoneId),
      rateTypeId: Number(validationResult.rateTypeId),
      amount: Number(validationResult.amount),
    };
  }

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

      // STRICT VALIDATION: Resolve territory and validate financial configuration
      let serviceZoneId: number | null = null;
      let actualAmount: number | null = null;

      // STRICT VALIDATION: Validate complete financial configuration chain
      if (!caseInfo.clientId || !caseInfo.productId || !verificationTypeId) {
        throw new VerificationTaskCreationError(400, {
          success: false,
          message: 'Client, Product, and Verification Type are required',
          error: { code: 'MISSING_REQUIRED_FIELDS' },
        });
      }

      const territoryValidation =
        await VerificationTaskCreationService.validateTerritoryAndFinancialConfig(client, {
          clientId: Number(caseInfo.clientId),
          productId: Number(caseInfo.productId),
          verificationTypeId: Number(verificationTypeId),
          pincode,
          areaId,
          rateTypeId:
            typeof initialRateTypeId === 'number' && initialRateTypeId > 0
              ? Number(initialRateTypeId)
              : null,
        });

      // Configuration is valid - use validated values
      serviceZoneId = territoryValidation.serviceZoneId;
      rateTypeId = territoryValidation.rateTypeId;
      actualAmount = territoryValidation.amount;

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
              service_zone_id, area_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, NOW(),
              $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, NOW(), NOW(),
              $18, $19
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
          territoryValidation.areaId,
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
              service_zone_id, area_id
            ) VALUES (
              $1, $2, $3, $4, $5, NULL, NULL, NULL,
              $6, $7, $8, $9, $10, $11, $12, $13,
              $14, $15, NOW(), NOW(),
              $16, $17
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
          territoryValidation.areaId,
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
