-- =====================================================
-- MIGRATION 004: MIGRATE EXISTING DATA
-- =====================================================
-- This migration safely migrates existing cases to the new
-- multi-verification structure while preserving all data.

-- Function to migrate existing cases to new multi-verification structure
CREATE OR REPLACE FUNCTION migrate_existing_cases_to_multi_verification()
RETURNS TABLE (
    migrated_cases INTEGER,
    migrated_tasks INTEGER,
    migrated_commissions INTEGER,
    errors TEXT[]
) AS $$
DECLARE
    case_record RECORD;
    task_id UUID;
    migrated_count INTEGER := 0;
    task_count INTEGER := 0;
    commission_count INTEGER := 0;
    error_messages TEXT[] := ARRAY[]::TEXT[];
    commission_record RECORD;
BEGIN
    -- Start transaction for data safety
    RAISE NOTICE 'Starting migration of existing cases to multi-verification structure...';
    
    -- Loop through all existing cases that don't have verification tasks
    FOR case_record IN 
        SELECT c.* FROM cases c 
        LEFT JOIN verification_tasks vt ON c.id = vt.case_id 
        WHERE vt.id IS NULL
        AND c."verificationTypeId" IS NOT NULL  -- Only migrate cases with verification types
    LOOP
        BEGIN
            -- Create a verification task for each existing case
            INSERT INTO verification_tasks (
                case_id,
                verification_type_id,
                task_title,
                task_description,
                priority,
                assigned_to,
                assigned_by,
                assigned_at,
                status,
                verification_outcome,
                rate_type_id,
                estimated_amount,
                actual_amount,
                address,
                pincode,
                completed_at,
                started_at,
                created_at,
                updated_at,
                created_by
            ) VALUES (
                case_record.id,
                case_record."verificationTypeId",
                'Legacy Verification Task',
                'Migrated from existing case structure',
                COALESCE(case_record.priority, 'MEDIUM'),
                case_record."assignedTo",
                case_record."createdByBackendUser",
                CASE 
                    WHEN case_record."assignedTo" IS NOT NULL THEN case_record."createdAt"
                    ELSE NULL 
                END,
                CASE 
                    WHEN case_record.status = 'COMPLETED' THEN 'COMPLETED'
                    WHEN case_record.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
                    WHEN case_record."assignedTo" IS NOT NULL THEN 'ASSIGNED'
                    ELSE 'PENDING'
                END,
                case_record."verificationOutcome",
                case_record."rateTypeId",
                -- Estimate amount from rates table if available
                CASE
                    WHEN case_record."rateTypeId" IS NOT NULL THEN (
                        SELECT r.amount
                        FROM rates r
                        WHERE r."rateTypeId" = case_record."rateTypeId"
                        AND r."clientId" = case_record."clientId"
                        AND r."verificationTypeId" = case_record."verificationTypeId"
                        AND r."isActive" = true
                        ORDER BY r."effectiveFrom" DESC
                        LIMIT 1
                    )
                    ELSE 500.00  -- Default estimate
                END,
                -- Actual amount same as estimated for completed cases
                CASE
                    WHEN case_record.status = 'COMPLETED' THEN (
                        CASE
                            WHEN case_record."rateTypeId" IS NOT NULL THEN (
                                SELECT r.amount
                                FROM rates r
                                WHERE r."rateTypeId" = case_record."rateTypeId"
                                AND r."clientId" = case_record."clientId"
                                AND r."verificationTypeId" = case_record."verificationTypeId"
                                AND r."isActive" = true
                                ORDER BY r."effectiveFrom" DESC
                                LIMIT 1
                            )
                            ELSE 500.00
                        END
                    )
                    ELSE NULL
                END,
                case_record.address,
                case_record.pincode,
                case_record."completedAt",
                CASE 
                    WHEN case_record.status IN ('IN_PROGRESS', 'COMPLETED') THEN case_record."createdAt"
                    ELSE NULL 
                END,
                case_record."createdAt",
                case_record."updatedAt",
                case_record."createdByBackendUser"
            ) RETURNING id INTO task_id;
            
            task_count := task_count + 1;
            
            -- Create assignment history if task was assigned
            IF case_record."assignedTo" IS NOT NULL THEN
                INSERT INTO task_assignment_history (
                    verification_task_id, 
                    case_id, 
                    assigned_to, 
                    assigned_by,
                    assignment_reason, 
                    task_status_before, 
                    task_status_after,
                    assigned_at
                ) VALUES (
                    task_id, 
                    case_record.id, 
                    case_record."assignedTo", 
                    case_record."createdByBackendUser",
                    'Migrated from legacy case assignment', 
                    'PENDING', 
                    CASE 
                        WHEN case_record.status = 'COMPLETED' THEN 'COMPLETED'
                        WHEN case_record.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
                        ELSE 'ASSIGNED'
                    END,
                    case_record."createdAt"
                );
            END IF;
            
            -- Update the case to reflect it now has tasks
            UPDATE cases 
            SET 
                has_multiple_tasks = FALSE,  -- Single task migration
                total_tasks_count = 1,
                completed_tasks_count = CASE WHEN case_record.status = 'COMPLETED' THEN 1 ELSE 0 END,
                case_completion_percentage = CASE WHEN case_record.status = 'COMPLETED' THEN 100.00 ELSE 0.00 END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = case_record.id;
            
            -- Migrate existing commission calculations
            FOR commission_record IN 
                SELECT * FROM commission_calculations 
                WHERE case_id = case_record.id 
                AND verification_task_id IS NULL
            LOOP
                -- Create new task commission calculation
                INSERT INTO task_commission_calculations (
                    verification_task_id,
                    case_id,
                    task_number,
                    user_id,
                    client_id,
                    rate_type_id,
                    base_amount,
                    commission_amount,
                    calculated_commission,
                    calculation_method,
                    calculation_date,
                    status,
                    task_completed_at,
                    verification_outcome,
                    created_at,
                    updated_at,
                    notes
                ) VALUES (
                    task_id,
                    commission_record.case_id,
                    (SELECT task_number FROM verification_tasks WHERE id = task_id),
                    commission_record.user_id,
                    case_record."clientId",
                    COALESCE(case_record."rateTypeId", commission_record.rate_type_id),
                    commission_record.commission_amount,
                    commission_record.commission_amount,
                    commission_record.commission_amount,
                    COALESCE(commission_record.calculation_method, 'FIXED_AMOUNT'),
                    COALESCE(commission_record.created_at, case_record."createdAt"),
                    COALESCE(commission_record.status, 'CALCULATED'),
                    COALESCE(case_record."completedAt", case_record."createdAt"),
                    case_record."verificationOutcome",
                    commission_record.created_at,
                    CURRENT_TIMESTAMP,
                    'Migrated from legacy commission calculation'
                );
                
                -- Link the old commission calculation to the new task
                UPDATE commission_calculations 
                SET verification_task_id = task_id,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = commission_record.id;
                
                commission_count := commission_count + 1;
            END LOOP;
            
            migrated_count := migrated_count + 1;
            
            -- Log progress every 100 cases
            IF migrated_count % 100 = 0 THEN
                RAISE NOTICE 'Migrated % cases so far...', migrated_count;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            error_messages := array_append(error_messages, 
                'Error migrating case ' || case_record.id || ': ' || SQLERRM);
            RAISE NOTICE 'Error migrating case %: %', case_record.id, SQLERRM;
        END;
    END LOOP;
    
    -- Return migration statistics
    RAISE NOTICE 'Migration completed: % cases, % tasks, % commissions', 
        migrated_count, task_count, commission_count;
    
    RETURN QUERY SELECT migrated_count, task_count, commission_count, error_messages;
END;
$$ LANGUAGE plpgsql;

-- Function to validate migration results
CREATE OR REPLACE FUNCTION validate_migration_results()
RETURNS TABLE (
    validation_check TEXT,
    expected_count BIGINT,
    actual_count BIGINT,
    status TEXT
) AS $$
BEGIN
    -- Check if all cases have corresponding tasks
    RETURN QUERY
    SELECT 
        'Cases with verification tasks'::TEXT,
        (SELECT COUNT(*) FROM cases WHERE "verificationTypeId" IS NOT NULL)::BIGINT,
        (SELECT COUNT(DISTINCT case_id) FROM verification_tasks)::BIGINT,
        CASE 
            WHEN (SELECT COUNT(*) FROM cases WHERE "verificationTypeId" IS NOT NULL) = 
                 (SELECT COUNT(DISTINCT case_id) FROM verification_tasks)
            THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END;
    
    -- Check commission calculations migration
    RETURN QUERY
    SELECT 
        'Commission calculations linked to tasks'::TEXT,
        (SELECT COUNT(*) FROM commission_calculations WHERE verification_task_id IS NOT NULL)::BIGINT,
        (SELECT COUNT(*) FROM task_commission_calculations)::BIGINT,
        CASE 
            WHEN (SELECT COUNT(*) FROM commission_calculations WHERE verification_task_id IS NOT NULL) >= 
                 (SELECT COUNT(*) FROM task_commission_calculations)
            THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END;
    
    -- Check case completion percentages
    RETURN QUERY
    SELECT 
        'Cases with updated completion percentages'::TEXT,
        (SELECT COUNT(*) FROM cases WHERE has_multiple_tasks IS NOT NULL)::BIGINT,
        (SELECT COUNT(*) FROM cases WHERE case_completion_percentage IS NOT NULL)::BIGINT,
        CASE 
            WHEN (SELECT COUNT(*) FROM cases WHERE has_multiple_tasks IS NOT NULL) = 
                 (SELECT COUNT(*) FROM cases WHERE case_completion_percentage IS NOT NULL)
            THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END;
    
    -- Check task assignment history
    RETURN QUERY
    SELECT 
        'Tasks with assignment history'::TEXT,
        (SELECT COUNT(*) FROM verification_tasks WHERE assigned_to IS NOT NULL)::BIGINT,
        (SELECT COUNT(DISTINCT verification_task_id) FROM task_assignment_history)::BIGINT,
        CASE 
            WHEN (SELECT COUNT(*) FROM verification_tasks WHERE assigned_to IS NOT NULL) <= 
                 (SELECT COUNT(DISTINCT verification_task_id) FROM task_assignment_history)
            THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback migration if needed
CREATE OR REPLACE FUNCTION rollback_migration()
RETURNS TEXT AS $$
DECLARE
    result_text TEXT;
BEGIN
    -- This function provides a way to rollback the migration
    -- WARNING: This will delete all migrated data
    
    RAISE NOTICE 'Starting migration rollback...';
    
    -- Delete task commission calculations
    DELETE FROM task_commission_calculations;
    
    -- Delete task assignment history
    DELETE FROM task_assignment_history;
    
    -- Delete task form submissions
    DELETE FROM task_form_submissions;
    
    -- Delete verification tasks
    DELETE FROM verification_tasks;
    
    -- Reset case fields
    UPDATE cases SET 
        has_multiple_tasks = NULL,
        total_tasks_count = NULL,
        completed_tasks_count = NULL,
        case_completion_percentage = NULL,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Reset commission calculations
    UPDATE commission_calculations SET 
        verification_task_id = NULL,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Reset sequences
    ALTER SEQUENCE verification_task_number_seq RESTART WITH 1;
    
    result_text := 'Migration rollback completed successfully';
    RAISE NOTICE '%', result_text;
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- Create a summary function for migration status
CREATE OR REPLACE FUNCTION get_migration_summary()
RETURNS TABLE (
    metric TEXT,
    value BIGINT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Total Cases'::TEXT,
        (SELECT COUNT(*) FROM cases)::BIGINT,
        'Total number of cases in the system'::TEXT
    UNION ALL
    SELECT 
        'Cases with Tasks'::TEXT,
        (SELECT COUNT(DISTINCT case_id) FROM verification_tasks)::BIGINT,
        'Cases that have been migrated to multi-task structure'::TEXT
    UNION ALL
    SELECT 
        'Total Tasks'::TEXT,
        (SELECT COUNT(*) FROM verification_tasks)::BIGINT,
        'Total number of verification tasks'::TEXT
    UNION ALL
    SELECT 
        'Multi-Task Cases'::TEXT,
        (SELECT COUNT(*) FROM cases WHERE has_multiple_tasks = true)::BIGINT,
        'Cases with multiple verification tasks'::TEXT
    UNION ALL
    SELECT 
        'Task Commissions'::TEXT,
        (SELECT COUNT(*) FROM task_commission_calculations)::BIGINT,
        'Commission calculations for individual tasks'::TEXT
    UNION ALL
    SELECT 
        'Completed Tasks'::TEXT,
        (SELECT COUNT(*) FROM verification_tasks WHERE status = 'COMPLETED')::BIGINT,
        'Tasks that have been completed'::TEXT;
END;
$$ LANGUAGE plpgsql;
