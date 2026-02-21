--
-- PostgreSQL database dump
--

\restrict JdCR0PQe0KQxptrIgAfVfgwzzJ9AV9iWjLmO1bonHCZzjOpQJoJlCGFVNp1Kefb

-- Dumped from database version 17.8 (Homebrew)
-- Dumped by pg_dump version 17.8 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: task_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_type_enum AS ENUM (
    'NORMAL',
    'REVISIT'
);


--
-- Name: assign_rate_types_to_area(uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_rate_types_to_area(area_id uuid, rate_type_ids uuid[], user_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    rate_type_id UUID;
    inserted_count INTEGER := 0;
BEGIN
    -- Deactivate existing assignments
    UPDATE area_rate_types 
    SET "isActive" = false, "updatedBy" = user_id, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "areaId" = area_id AND "isActive" = true;
    
    -- Insert new assignments
    FOREACH rate_type_id IN ARRAY rate_type_ids
    LOOP
        INSERT INTO area_rate_types ("areaId", "rateTypeId", "createdBy")
        VALUES (area_id, rate_type_id, user_id)
        ON CONFLICT ("areaId", "rateTypeId") 
        DO UPDATE SET 
            "isActive" = true,
            "updatedBy" = user_id,
            "updatedAt" = CURRENT_TIMESTAMP;
        
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$$;


--
-- Name: audit_territory_assignment_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_territory_assignment_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Handle INSERT (new assignments)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO "territoryAssignmentAudit" (
            "userId", "assignmentType", "assignmentId", "action", 
            "previousData", "newData", "performedBy", "reason"
        ) VALUES (
            NEW."userId",
            CASE WHEN TG_TABLE_NAME = 'userPincodeAssignments' THEN 'PINCODE' ELSE 'AREA' END,
            NEW.id,
            'ASSIGNED',
            NULL,
            row_to_json(NEW),
            NEW."assignedBy",
            'Territory assignment created'
        );
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE (assignment modifications)
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO "territoryAssignmentAudit" (
            "userId", "assignmentType", "assignmentId", "action", 
            "previousData", "newData", "performedBy", "reason"
        ) VALUES (
            NEW."userId",
            CASE WHEN TG_TABLE_NAME = 'userPincodeAssignments' THEN 'PINCODE' ELSE 'AREA' END,
            NEW.id,
            CASE WHEN OLD."isActive" = true AND NEW."isActive" = false THEN 'UNASSIGNED' ELSE 'MODIFIED' END,
            row_to_json(OLD),
            row_to_json(NEW),
            COALESCE(NEW."assignedBy", OLD."assignedBy"),
            CASE WHEN OLD."isActive" = true AND NEW."isActive" = false THEN 'Territory assignment deactivated' ELSE 'Territory assignment modified' END
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;


--
-- Name: cleanup_performance_data(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_performance_data(days_to_keep integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean up old performance metrics
    DELETE FROM performance_metrics WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old query performance data
    DELETE FROM query_performance WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
    
    -- Clean up old error logs (keep longer for analysis)
    DELETE FROM error_logs WHERE timestamp < NOW() - INTERVAL '1 day' * (days_to_keep * 2);
    
    -- Clean up old system health metrics
    DELETE FROM system_health_metrics WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_performance_data(days_to_keep integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_performance_data(days_to_keep integer) IS 'Cleans up old performance monitoring data to prevent table bloat';


--
-- Name: create_default_notification_preferences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_notification_preferences() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: create_rate_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_rate_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.amount != NEW.amount THEN
        INSERT INTO "rateHistory" ("rateId", "oldAmount", "newAmount", "changedBy")
        VALUES (NEW.id, OLD.amount, NEW.amount, NEW."createdBy");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_task_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_task_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.task_number IS NULL THEN
        NEW.task_number := 'VT-' || LPAD(nextval('verification_task_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: get_index_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_index_usage() RETURNS TABLE(schemaname text, tablename text, indexname text, idx_scan bigint, idx_tup_read bigint, idx_tup_fetch bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::TEXT,
        s.tablename::TEXT,
        s.indexname::TEXT,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch
    FROM pg_stat_user_indexes s
    ORDER BY s.idx_scan DESC;
END;
$$;


--
-- Name: FUNCTION get_index_usage(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_index_usage() IS 'Returns index usage statistics to identify unused indexes';


--
-- Name: get_migration_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_migration_summary() RETURNS TABLE(metric text, value bigint, description text)
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: is_rate_type_available_for_area(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_rate_type_available_for_area(area_id uuid, rate_type_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM area_rate_types 
        WHERE "areaId" = area_id 
          AND "rateTypeId" = rate_type_id 
          AND "isActive" = true
    );
END;
$$;


--
-- Name: log_rate_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_rate_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO rate_history (
            "rateId", "clientId", "productId", "verificationTypeId", 
            "pincodeId", "areaId", "rateTypeId", "newRateAmount", 
            "effectiveFrom", "effectiveTo", "action", "changedBy"
        ) VALUES (
            NEW.id, NEW."clientId", NEW."productId", NEW."verificationTypeId",
            NEW."pincodeId", NEW."areaId", NEW."rateTypeId", NEW."rateAmount",
            NEW."effectiveFrom", NEW."effectiveTo", 'CREATE', NEW."createdBy"
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD."rateAmount" != NEW."rateAmount" OR OLD."effectiveFrom" != NEW."effectiveFrom" OR OLD."effectiveTo" != NEW."effectiveTo" THEN
            INSERT INTO rate_history (
                "rateId", "clientId", "productId", "verificationTypeId", 
                "pincodeId", "areaId", "rateTypeId", "oldRateAmount", "newRateAmount", 
                "effectiveFrom", "effectiveTo", "action", "changedBy"
            ) VALUES (
                NEW.id, NEW."clientId", NEW."productId", NEW."verificationTypeId",
                NEW."pincodeId", NEW."areaId", NEW."rateTypeId", OLD."rateAmount", NEW."rateAmount",
                NEW."effectiveFrom", NEW."effectiveTo", 'UPDATE', NEW."updatedBy"
            );
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO rate_history (
            "rateId", "clientId", "productId", "verificationTypeId", 
            "pincodeId", "areaId", "rateTypeId", "oldRateAmount", "newRateAmount", 
            "effectiveFrom", "effectiveTo", "action", "changedBy"
        ) VALUES (
            OLD.id, OLD."clientId", OLD."productId", OLD."verificationTypeId",
            OLD."pincodeId", OLD."areaId", OLD."rateTypeId", OLD."rateAmount", 0,
            OLD."effectiveFrom", OLD."effectiveTo", 'DELETE', OLD."updatedBy"
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: migrate_existing_cases_to_multi_verification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_existing_cases_to_multi_verification() RETURNS TABLE(migrated_cases integer, migrated_tasks integer, migrated_commissions integer, errors text[])
    LANGUAGE plpgsql
    AS $$
DECLARE
    case_record RECORD;
    task_id UUID;
    migrated_count INTEGER := 0;
    task_count INTEGER := 0;
    commission_count INTEGER := 0;
    error_messages TEXT[] := ARRAY[]::TEXT[];
    commission_record RECORD;
    estimated_rate NUMERIC(10,2);
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
            -- Get estimated rate for this case
            SELECT r.amount INTO estimated_rate
            FROM rates r 
            WHERE r."rateTypeId" = case_record."rateTypeId"
            AND r."clientId" = case_record."clientId"
            AND r."verificationTypeId" = case_record."verificationTypeId"
            AND r."isActive" = true
            ORDER BY r."effectiveFrom" DESC
            LIMIT 1;
            
            -- Use default if no rate found
            IF estimated_rate IS NULL THEN
                estimated_rate := 500.00;
            END IF;
            
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
                estimated_rate,
                -- Actual amount same as estimated for completed cases
                CASE 
                    WHEN case_record.status = 'COMPLETED' THEN estimated_rate
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
                "updatedAt" = CURRENT_TIMESTAMP
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
                SET verification_task_id = task_id
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
$$;


--
-- Name: rollback_migration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rollback_migration() RETURNS text
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: update_ai_reports_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ai_reports_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_areas_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_areas_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_builder_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_builder_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_business_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_business_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_camel_case_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_camel_case_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_case_completion_percentage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_case_completion_percentage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
    in_progress_tasks INTEGER;
    assigned_tasks INTEGER;
    new_status VARCHAR;
BEGIN
    -- Get counts
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END),
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END),
        COUNT(CASE WHEN status = 'ASSIGNED' THEN 1 END)
    INTO 
        total_tasks,
        completed_tasks,
        in_progress_tasks,
        assigned_tasks
    FROM verification_tasks
    WHERE case_id = NEW.case_id;

    -- Determine Status
    IF total_tasks > 0 AND completed_tasks = total_tasks THEN
        new_status := 'COMPLETED';
    ELSIF in_progress_tasks > 0 THEN
        new_status := 'IN_PROGRESS';
    ELSIF assigned_tasks > 0 THEN
        new_status := 'ASSIGNED';
    ELSE
        new_status := 'PENDING';
    END IF;

    -- Update Case
    UPDATE cases
    SET
        completed_tasks_count = completed_tasks,
        case_completion_percentage = CASE 
            WHEN total_tasks = 0 THEN 0 
            ELSE ROUND((completed_tasks::DECIMAL / total_tasks::DECIMAL) * 100, 2) 
        END,
        status = new_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = NEW.case_id;

    RETURN NEW;
END;
$$;


--
-- Name: update_cases_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cases_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_cities_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cities_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$;


--
-- Name: update_clients_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_clients_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$;


--
-- Name: update_countries_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_countries_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$;


--
-- Name: update_departments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_departments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_designations_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_designations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_document_type_rates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_document_type_rates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_dsa_connector_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_dsa_connector_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_mac_addresses_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_mac_addresses_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_mobile_notification_audit_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_mobile_notification_audit_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_noc_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_noc_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_office_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_office_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_pincode_areas_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pincode_areas_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_pincodes_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pincodes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$;


--
-- Name: update_products_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_products_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$;


--
-- Name: update_property_apf_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_property_apf_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_property_individual_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_property_individual_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_residence_cum_office_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_residence_cum_office_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_residence_verification_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_residence_verification_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_roles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_roles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_states_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_states_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$;


--
-- Name: update_task_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_template_reports_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_template_reports_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_users_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_users_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_verification_types_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_verification_types_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$;


--
-- Name: validate_device_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_device_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
    IF NEW."deviceId" IS NOT NULL AND NEW."deviceId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'deviceId must be a valid UUID format';
    END IF;
    RETURN NEW;
END;
$_$;


--
-- Name: validate_migration_results(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_migration_results() RETURNS TABLE(validation_check text, expected_count bigint, actual_count bigint, status text)
    LANGUAGE plpgsql
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_performance_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_performance_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    date date NOT NULL,
    cases_assigned integer DEFAULT 0,
    cases_completed integer DEFAULT 0,
    cases_in_progress integer DEFAULT 0,
    forms_submitted integer DEFAULT 0,
    residence_forms integer DEFAULT 0,
    office_forms integer DEFAULT 0,
    business_forms integer DEFAULT 0,
    attachments_uploaded integer DEFAULT 0,
    avg_completion_time_hours numeric(8,2) DEFAULT NULL::numeric,
    quality_score numeric(5,2) DEFAULT NULL::numeric,
    validation_success_rate numeric(5,2) DEFAULT NULL::numeric,
    total_distance_km numeric(8,2) DEFAULT NULL::numeric,
    active_hours numeric(4,2) DEFAULT NULL::numeric,
    login_time timestamp without time zone,
    logout_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT agent_performance_daily_active_hours_check CHECK (((active_hours >= (0)::numeric) AND (active_hours <= (24)::numeric))),
    CONSTRAINT agent_performance_daily_attachments_uploaded_check CHECK ((attachments_uploaded >= 0)),
    CONSTRAINT agent_performance_daily_avg_completion_time_hours_check CHECK ((avg_completion_time_hours >= (0)::numeric)),
    CONSTRAINT agent_performance_daily_business_forms_check CHECK ((business_forms >= 0)),
    CONSTRAINT agent_performance_daily_cases_assigned_check CHECK ((cases_assigned >= 0)),
    CONSTRAINT agent_performance_daily_cases_completed_check CHECK ((cases_completed >= 0)),
    CONSTRAINT agent_performance_daily_cases_in_progress_check CHECK ((cases_in_progress >= 0)),
    CONSTRAINT agent_performance_daily_forms_submitted_check CHECK ((forms_submitted >= 0)),
    CONSTRAINT agent_performance_daily_office_forms_check CHECK ((office_forms >= 0)),
    CONSTRAINT agent_performance_daily_quality_score_check CHECK (((quality_score >= (0)::numeric) AND (quality_score <= (100)::numeric))),
    CONSTRAINT agent_performance_daily_residence_forms_check CHECK ((residence_forms >= 0)),
    CONSTRAINT agent_performance_daily_total_distance_km_check CHECK ((total_distance_km >= (0)::numeric)),
    CONSTRAINT agent_performance_daily_validation_success_rate_check CHECK (((validation_success_rate >= (0)::numeric) AND (validation_success_rate <= (100)::numeric)))
);


--
-- Name: ai_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    submission_id character varying(255) NOT NULL,
    report_data jsonb NOT NULL,
    generated_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE ai_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_reports IS 'Stores AI-generated verification reports for form submissions';


--
-- Name: COLUMN ai_reports.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reports.id IS 'Unique identifier for the AI report';


--
-- Name: COLUMN ai_reports.case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reports.case_id IS 'Reference to the case this report belongs to';


--
-- Name: COLUMN ai_reports.submission_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reports.submission_id IS 'Identifier of the form submission this report analyzes';


--
-- Name: COLUMN ai_reports.report_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reports.report_data IS 'JSON data containing the complete AI-generated report';


--
-- Name: COLUMN ai_reports.generated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reports.generated_by IS 'User who requested the AI report generation';


--
-- Name: COLUMN ai_reports.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reports.created_at IS 'Timestamp when the report was generated';


--
-- Name: COLUMN ai_reports.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reports.updated_at IS 'Timestamp when the report was last updated';


--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    name character varying(255) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL
);


--
-- Name: TABLE areas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.areas IS 'Geographic areas within cities';


--
-- Name: areas_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.areas_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: areas_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.areas_temp_id_seq OWNED BY public.areas.id;


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    filename character varying(255) NOT NULL,
    "originalName" character varying(255) NOT NULL,
    "filePath" character varying(500) NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" character varying(100) NOT NULL,
    "uploadedBy" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    "caseId" integer,
    case_id uuid NOT NULL,
    verification_task_id uuid
);


--
-- Name: attachments_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attachments_temp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attachments_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attachments_temp_id_seq OWNED BY public.attachments.id;


--
-- Name: auditLogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."auditLogs" (
    "userId" uuid,
    action character varying(50) NOT NULL,
    "entityType" character varying(50) NOT NULL,
    "entityId" uuid,
    "oldValues" jsonb,
    "newValues" jsonb,
    "ipAddress" inet,
    "userAgent" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    details jsonb
);


--
-- Name: auditLogs_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."auditLogs_temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditLogs_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."auditLogs_temp_id_seq" OWNED BY public."auditLogs".id;


--
-- Name: autoSaves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."autoSaves" (
    "userId" uuid NOT NULL,
    "formData" jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    "caseId" integer,
    case_id uuid NOT NULL
);


--
-- Name: autoSaves_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."autoSaves_temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: autoSaves_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."autoSaves_temp_id_seq" OWNED BY public."autoSaves".id;


--
-- Name: backgroundSyncQueue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."backgroundSyncQueue" (
    "userId" uuid NOT NULL,
    action character varying(50) NOT NULL,
    "entityType" character varying(50) NOT NULL,
    "entityData" jsonb NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    "retryCount" integer DEFAULT 0,
    "errorMessage" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "processedAt" timestamp with time zone,
    id bigint NOT NULL,
    CONSTRAINT chk_background_sync_queue_status CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('PROCESSING'::character varying)::text, ('COMPLETED'::character varying)::text, ('FAILED'::character varying)::text])))
);


--
-- Name: backgroundSyncQueue_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."backgroundSyncQueue_temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backgroundSyncQueue_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."backgroundSyncQueue_temp_id_seq" OWNED BY public."backgroundSyncQueue".id;


--
-- Name: builderVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."builderVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    company_nameplate_status character varying(50),
    name_on_company_board character varying(255),
    landmark1 character varying(255),
    landmark2 character varying(255),
    office_status character varying(50),
    office_existence character varying(50),
    builder_type character varying(50),
    company_nature_of_business character varying(255),
    business_period character varying(100),
    establishment_period character varying(100),
    office_approx_area integer,
    staff_strength integer,
    staff_seen integer,
    met_person_name character varying(255),
    designation character varying(100),
    builder_name character varying(255),
    builder_owner_name character varying(255),
    working_period character varying(100),
    working_status character varying(50),
    document_shown character varying(255),
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    old_office_shifted_period character varying(100),
    current_company_name character varying(255),
    current_company_period character varying(100),
    premises_status character varying(50),
    name_of_met_person character varying(255),
    met_person_type character varying(50),
    met_person_confirmation character varying(50),
    applicant_working_status character varying(50),
    contact_person character varying(255),
    call_remark character varying(50),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    other_observation text,
    other_extra_remark text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    landmark3 character varying(255),
    landmark4 character varying(255),
    applicant_designation character varying(100),
    verification_task_id uuid,
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_builder_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_builder_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text]))),
    CONSTRAINT chk_builder_verification_office_area CHECK (((office_approx_area IS NULL) OR ((office_approx_area >= 1) AND (office_approx_area <= 100000)))),
    CONSTRAINT chk_builder_verification_staff_seen CHECK (((staff_seen IS NULL) OR ((staff_seen >= 0) AND (staff_seen <= staff_strength)))),
    CONSTRAINT chk_builder_verification_staff_strength CHECK (((staff_strength IS NULL) OR ((staff_strength >= 1) AND (staff_strength <= 10000))))
);


--
-- Name: TABLE "builderVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."builderVerificationReports" IS 'Comprehensive table for storing builder verification form data from mobile app submissions';


--
-- Name: COLUMN "builderVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "builderVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".form_type IS 'Type of builder verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "builderVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "builderVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "builderVerificationReports".landmark3; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".landmark3 IS 'Third landmark near the builder office';


--
-- Name: COLUMN "builderVerificationReports".landmark4; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".landmark4 IS 'Fourth landmark near the builder office';


--
-- Name: COLUMN "builderVerificationReports".applicant_designation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".applicant_designation IS 'Designation of the applicant in the builder company';


--
-- Name: COLUMN "builderVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".verification_task_id IS 'Links builder verification report to specific verification task';


--
-- Name: COLUMN "builderVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "builderVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "builderVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."builderVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: businessVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."businessVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    company_nameplate_status character varying(50),
    name_on_company_board character varying(255),
    landmark1 character varying(255),
    landmark2 character varying(255),
    business_status character varying(50),
    business_existence character varying(50),
    business_type character varying(50),
    ownership_type character varying(50),
    address_status character varying(50),
    company_nature_of_business character varying(255),
    business_period character varying(100),
    establishment_period character varying(100),
    business_approx_area integer,
    staff_strength integer,
    staff_seen integer,
    met_person_name character varying(255),
    designation character varying(100),
    name_of_company_owners character varying(255),
    owner_name character varying(255),
    business_owner_name character varying(255),
    document_shown character varying(255),
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    old_business_shifted_period character varying(100),
    current_company_name character varying(255),
    current_company_period character varying(100),
    premises_status character varying(50),
    name_of_met_person character varying(255),
    met_person_type character varying(50),
    met_person_confirmation character varying(50),
    applicant_working_status character varying(50),
    contact_person character varying(255),
    call_remark character varying(50),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    other_observation text,
    other_extra_remark text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    business_activity character varying(255),
    business_setup character varying(255),
    applicant_designation character varying(100),
    working_period character varying(100),
    working_status character varying(50),
    applicant_working_premises character varying(255),
    document_type character varying(100),
    name_of_tpc1 character varying(255),
    name_of_tpc2 character varying(255),
    verification_task_id uuid,
    landmark3 character varying(255),
    landmark4 character varying(255),
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_business_verification_business_area CHECK (((business_approx_area IS NULL) OR ((business_approx_area >= 1) AND (business_approx_area <= 100000)))),
    CONSTRAINT chk_business_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_business_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text]))),
    CONSTRAINT chk_business_verification_staff_seen CHECK (((staff_seen IS NULL) OR ((staff_seen >= 0) AND (staff_seen <= staff_strength)))),
    CONSTRAINT chk_business_verification_staff_strength CHECK (((staff_strength IS NULL) OR ((staff_strength >= 1) AND (staff_strength <= 10000))))
);


--
-- Name: TABLE "businessVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."businessVerificationReports" IS 'Comprehensive table for storing business verification form data from mobile app submissions';


--
-- Name: COLUMN "businessVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "businessVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".form_type IS 'Type of business verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "businessVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "businessVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "businessVerificationReports".business_activity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".business_activity IS 'Type of business activity conducted';


--
-- Name: COLUMN "businessVerificationReports".business_setup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".business_setup IS 'Business setup type or configuration';


--
-- Name: COLUMN "businessVerificationReports".applicant_designation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".applicant_designation IS 'Designation of the applicant in the business';


--
-- Name: COLUMN "businessVerificationReports".working_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".working_period IS 'Period of working at the business location';


--
-- Name: COLUMN "businessVerificationReports".working_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".working_status IS 'Current working status of the applicant';


--
-- Name: COLUMN "businessVerificationReports".applicant_working_premises; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".applicant_working_premises IS 'Premises where the applicant is working';


--
-- Name: COLUMN "businessVerificationReports".document_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".document_type IS 'Type of document shown during verification';


--
-- Name: COLUMN "businessVerificationReports".name_of_tpc1; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".name_of_tpc1 IS 'Name of first third party contact';


--
-- Name: COLUMN "businessVerificationReports".name_of_tpc2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".name_of_tpc2 IS 'Name of second third party contact';


--
-- Name: COLUMN "businessVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".verification_task_id IS 'Links business verification report to specific verification task';


--
-- Name: COLUMN "businessVerificationReports".landmark3; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".landmark3 IS 'Third landmark for location identification (used in UNTRACEABLE forms)';


--
-- Name: COLUMN "businessVerificationReports".landmark4; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".landmark4 IS 'Fourth landmark for location identification (used in UNTRACEABLE forms)';


--
-- Name: COLUMN "businessVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "businessVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "businessVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."businessVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: caseDeduplicationAudit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."caseDeduplicationAudit" (
    "searchCriteria" jsonb NOT NULL,
    "duplicatesFound" jsonb,
    "userDecision" character varying(20) NOT NULL,
    rationale text,
    "performedBy" uuid NOT NULL,
    "performedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    "caseId" integer,
    case_id uuid NOT NULL,
    CONSTRAINT chk_dedup_audit_decision CHECK ((("userDecision")::text = ANY (ARRAY[('CREATE_NEW'::character varying)::text, ('USE_EXISTING'::character varying)::text, ('MERGE_CASES'::character varying)::text])))
);


--
-- Name: TABLE "caseDeduplicationAudit"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."caseDeduplicationAudit" IS 'Audit trail for case deduplication decisions and duplicate detection results';


--
-- Name: COLUMN "caseDeduplicationAudit"."searchCriteria"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."caseDeduplicationAudit"."searchCriteria" IS 'JSON object containing the search criteria used for duplicate detection';


--
-- Name: COLUMN "caseDeduplicationAudit"."duplicatesFound"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."caseDeduplicationAudit"."duplicatesFound" IS 'JSON array of duplicate cases found during the search';


--
-- Name: COLUMN "caseDeduplicationAudit"."userDecision"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."caseDeduplicationAudit"."userDecision" IS 'Decision made by the user: CREATE_NEW, USE_EXISTING, or MERGE_CASES';


--
-- Name: COLUMN "caseDeduplicationAudit".rationale; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."caseDeduplicationAudit".rationale IS 'User-provided rationale for their deduplication decision';


--
-- Name: COLUMN "caseDeduplicationAudit"."performedBy"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."caseDeduplicationAudit"."performedBy" IS 'User who performed the deduplication check and made the decision';


--
-- Name: caseDeduplicationAudit_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."caseDeduplicationAudit_temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caseDeduplicationAudit_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."caseDeduplicationAudit_temp_id_seq" OWNED BY public."caseDeduplicationAudit".id;


--
-- Name: case_assignment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_assignment_history (
    id integer NOT NULL,
    "previousAssignee" uuid,
    "newAssignee" uuid NOT NULL,
    reason text,
    "assignedBy" uuid NOT NULL,
    "assignedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "caseId" integer,
    case_id uuid NOT NULL,
    "fromUserId" uuid,
    "toUserId" uuid NOT NULL,
    "assignedById" uuid NOT NULL,
    "batchId" character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb,
    "caseUUID" uuid
);


--
-- Name: TABLE case_assignment_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.case_assignment_history IS 'Tracks all case assignment and reassignment operations';


--
-- Name: case_assignment_queue_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_assignment_queue_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "batchId" character varying(255) NOT NULL,
    "jobId" character varying(255) NOT NULL,
    "createdById" uuid NOT NULL,
    "assignedToId" uuid NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    "totalCases" integer DEFAULT 0 NOT NULL,
    "processedCases" integer DEFAULT 0 NOT NULL,
    "successfulAssignments" integer DEFAULT 0 NOT NULL,
    "failedAssignments" integer DEFAULT 0 NOT NULL,
    "startedAt" timestamp with time zone,
    "completedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: TABLE case_assignment_queue_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.case_assignment_queue_status IS 'Tracks status of bulk assignment operations';


--
-- Name: case_assignment_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.case_assignment_analytics AS
 SELECT date_trunc('day'::text, "assignedAt") AS assignment_date,
    count(*) AS total_assignments,
    count(DISTINCT COALESCE("caseUUID", case_id)) AS unique_cases,
    count(DISTINCT "toUserId") AS unique_assignees,
    count(
        CASE
            WHEN ("fromUserId" IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS reassignments,
    count(
        CASE
            WHEN ("batchId" IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS bulk_assignments,
    avg(
        CASE
            WHEN ("batchId" IS NOT NULL) THEN ( SELECT case_assignment_queue_status."totalCases"
               FROM public.case_assignment_queue_status
              WHERE ((case_assignment_queue_status."batchId")::text = (cah."batchId")::text)
             LIMIT 1)
            ELSE NULL::integer
        END) AS avg_bulk_size
   FROM public.case_assignment_history cah
  WHERE ("assignedAt" IS NOT NULL)
  GROUP BY (date_trunc('day'::text, "assignedAt"))
  ORDER BY (date_trunc('day'::text, "assignedAt")) DESC;


--
-- Name: VIEW case_assignment_analytics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.case_assignment_analytics IS 'Analytics view for assignment operations';


--
-- Name: case_assignment_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_assignment_conflicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "caseId" uuid NOT NULL,
    "conflictType" character varying(100) NOT NULL,
    "serverAssignedTo" uuid,
    "clientAssignedTo" uuid,
    "detectedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "resolvedAt" timestamp with time zone,
    "resolvedBy" uuid,
    "resolutionStrategy" character varying(100),
    "resolutionData" jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: TABLE case_assignment_conflicts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.case_assignment_conflicts IS 'Tracks and resolves assignment conflicts';


--
-- Name: case_assignment_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_assignment_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_assignment_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_assignment_history_id_seq OWNED BY public.case_assignment_history.id;


--
-- Name: case_configuration_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_configuration_errors (
    id integer NOT NULL,
    case_id uuid NOT NULL,
    error_code character varying(100) NOT NULL,
    error_message text NOT NULL,
    error_details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    resolved_by uuid
);


--
-- Name: TABLE case_configuration_errors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.case_configuration_errors IS 'Stores configuration validation errors for cases in CONFIG_PENDING state. Used for bulk upload quarantine flow.';


--
-- Name: COLUMN case_configuration_errors.error_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.case_configuration_errors.error_details IS 'JSON object containing context like clientId, productId, verificationTypeId, pincodeId, areaId';


--
-- Name: case_configuration_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_configuration_errors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_configuration_errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_configuration_errors_id_seq OWNED BY public.case_configuration_errors.id;


--
-- Name: case_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_status_history (
    id character varying(255) NOT NULL,
    "caseId" integer NOT NULL,
    status character varying(50) NOT NULL,
    "transitionedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "transitionedBy" uuid,
    "transitionReason" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    case_id uuid NOT NULL
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    "clientId" integer NOT NULL,
    "productId" integer NOT NULL,
    "verificationTypeId" integer NOT NULL,
    "cityId" integer,
    pincode character varying(10),
    status character varying(20) DEFAULT 'PENDING'::character varying,
    priority character varying(10) DEFAULT 'MEDIUM'::character varying,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "panNumber" character varying(10),
    "deduplicationChecked" boolean DEFAULT false,
    "deduplicationDecision" character varying(20),
    "deduplicationRationale" text,
    "applicantType" character varying(20) NOT NULL,
    "backendContactNumber" character varying(20) NOT NULL,
    trigger text NOT NULL,
    "caseId" integer NOT NULL,
    "customerName" character varying(100) NOT NULL,
    "customerCallingCode" character varying(20),
    "customerPhone" character varying(20),
    "verificationType" character varying(50),
    "createdByBackendUser" uuid,
    revokereason text,
    revokedat timestamp with time zone,
    "revokeReason" text,
    "revokedAt" timestamp with time zone,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_completion_percentage numeric(5,2) DEFAULT 0,
    quality_score numeric(5,2) DEFAULT NULL::numeric,
    last_form_submitted_at timestamp without time zone,
    total_forms_required integer DEFAULT 1,
    forms_submitted_count integer DEFAULT 0,
    validation_issues_count integer DEFAULT 0,
    "verificationData" jsonb,
    "verificationOutcome" character varying(50),
    "completedAt" timestamp with time zone,
    "rateTypeId" integer,
    has_multiple_tasks boolean DEFAULT false,
    total_tasks_count integer DEFAULT 1,
    completed_tasks_count integer DEFAULT 0,
    case_completion_percentage numeric(5,2) DEFAULT 0.00,
    CONSTRAINT cases_form_completion_percentage_check CHECK (((form_completion_percentage >= (0)::numeric) AND (form_completion_percentage <= (100)::numeric))),
    CONSTRAINT cases_forms_submitted_count_check CHECK ((forms_submitted_count >= 0)),
    CONSTRAINT cases_quality_score_check CHECK (((quality_score >= (0)::numeric) AND (quality_score <= (100)::numeric))),
    CONSTRAINT cases_total_forms_required_check CHECK ((total_forms_required > 0)),
    CONSTRAINT cases_validation_issues_count_check CHECK ((validation_issues_count >= 0)),
    CONSTRAINT chk_cases_applicant_type CHECK ((("applicantType")::text = ANY (ARRAY[('APPLICANT'::character varying)::text, ('CO-APPLICANT'::character varying)::text, ('REFERENCE PERSON'::character varying)::text]))),
    CONSTRAINT chk_cases_dedup_decision CHECK ((("deduplicationDecision")::text = ANY (ARRAY[('CREATE_NEW'::character varying)::text, ('USE_EXISTING'::character varying)::text, ('MERGE_CASES'::character varying)::text, ('NO_DUPLICATES'::character varying)::text]))),
    CONSTRAINT chk_cases_priority CHECK (((priority)::text = ANY (ARRAY[('LOW'::character varying)::text, ('MEDIUM'::character varying)::text, ('HIGH'::character varying)::text, ('URGENT'::character varying)::text]))),
    CONSTRAINT chk_cases_status CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('ASSIGNED'::character varying)::text, ('IN_PROGRESS'::character varying)::text, ('COMPLETED'::character varying)::text, ('REVOKED'::character varying)::text])))
);


--
-- Name: TABLE cases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cases IS 'Main cases table with rate type assignment support for financial calculations';


--
-- Name: COLUMN cases."clientId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."clientId" IS 'Foreign key reference to clients.id (converted from UUID to INTEGER for consistency)';


--
-- Name: COLUMN cases."productId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."productId" IS 'Foreign key reference to products.id (converted from UUID to INTEGER)';


--
-- Name: COLUMN cases."verificationTypeId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."verificationTypeId" IS 'Foreign key reference to verificationTypes.id (converted from UUID to INTEGER)';


--
-- Name: COLUMN cases."cityId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."cityId" IS 'Foreign key reference to cities.id (converted from UUID to INTEGER)';


--
-- Name: COLUMN cases.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases.status IS 'Case status - can be UNASSIGNED, ASSIGNED, IN_PROGRESS, or COMPLETED';


--
-- Name: COLUMN cases."panNumber"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."panNumber" IS 'PAN card number for deduplication matching';


--
-- Name: COLUMN cases."deduplicationChecked"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."deduplicationChecked" IS 'Whether deduplication check was performed';


--
-- Name: COLUMN cases."deduplicationDecision"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."deduplicationDecision" IS 'User decision after deduplication check';


--
-- Name: COLUMN cases."deduplicationRationale"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."deduplicationRationale" IS 'Reason for deduplication decision';


--
-- Name: COLUMN cases."applicantType"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."applicantType" IS 'Type of applicant: APPLICANT, CO-APPLICANT, or REFERENCE PERSON';


--
-- Name: COLUMN cases."backendContactNumber"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."backendContactNumber" IS 'Contact number of the backend user who created the case';


--
-- Name: COLUMN cases.trigger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases.trigger IS 'TRIGGER field - additional information or special instructions';


--
-- Name: COLUMN cases."caseId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."caseId" IS 'Business identifier - Case number for display and external references';


--
-- Name: COLUMN cases."customerName"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."customerName" IS 'Customer name as entered in case creation form';


--
-- Name: COLUMN cases."customerCallingCode"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."customerCallingCode" IS 'Customer calling code (auto-generated: CC-timestamp+random)';


--
-- Name: COLUMN cases."customerPhone"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."customerPhone" IS 'Customer phone number';


--
-- Name: COLUMN cases."verificationType"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."verificationType" IS 'Verification type name (e.g., Residence, Office, Business)';


--
-- Name: COLUMN cases.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases.id IS 'Primary key - UUID identifier for internal references';


--
-- Name: COLUMN cases."rateTypeId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cases."rateTypeId" IS 'Foreign key to rateTypes table for rate calculation and assignment';


--
-- Name: task_commission_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_commission_calculations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verification_task_id uuid NOT NULL,
    case_id uuid NOT NULL,
    task_number character varying(20) NOT NULL,
    user_id uuid NOT NULL,
    client_id integer NOT NULL,
    rate_type_id integer NOT NULL,
    base_amount numeric(10,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    calculated_commission numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    calculation_method character varying(20) DEFAULT 'FIXED_AMOUNT'::character varying,
    calculation_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    approved_by uuid,
    approved_at timestamp without time zone,
    paid_by uuid,
    paid_at timestamp without time zone,
    payment_method character varying(50),
    transaction_id character varying(100),
    rejection_reason text,
    task_completed_at timestamp without time zone NOT NULL,
    verification_outcome character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    notes text,
    CONSTRAINT check_calculation_method CHECK (((calculation_method)::text = ANY (ARRAY[('FIXED_AMOUNT'::character varying)::text, ('PERCENTAGE'::character varying)::text]))),
    CONSTRAINT check_commission_status CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('CALCULATED'::character varying)::text, ('APPROVED'::character varying)::text, ('PAID'::character varying)::text, ('REJECTED'::character varying)::text])))
);


--
-- Name: verification_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_number character varying(20) NOT NULL,
    case_id uuid NOT NULL,
    verification_type_id integer NOT NULL,
    task_title character varying(255) NOT NULL,
    task_description text,
    priority character varying(10) DEFAULT 'MEDIUM'::character varying,
    assigned_to uuid,
    assigned_by uuid,
    assigned_at timestamp without time zone,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    verification_outcome character varying(50),
    rate_type_id integer,
    estimated_amount numeric(10,2),
    actual_amount numeric(10,2),
    address text,
    pincode character varying(10),
    latitude numeric(10,8),
    longitude numeric(11,8),
    document_type character varying(100),
    document_number character varying(100),
    document_details jsonb,
    estimated_completion_date date,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    trigger text,
    applicant_type character varying(20),
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revocation_reason text,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancellation_reason text,
    task_type public.task_type_enum DEFAULT 'NORMAL'::public.task_type_enum NOT NULL,
    parent_task_id uuid,
    saved_at timestamp with time zone,
    is_saved boolean DEFAULT false NOT NULL,
    first_assigned_at timestamp with time zone,
    current_assigned_at timestamp with time zone,
    service_zone_id integer,
    forensic_version smallint DEFAULT 1,
    device_id text,
    app_version text,
    submitted_at timestamp with time zone,
    reviewer_id uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    CONSTRAINT check_priority CHECK (((priority)::text = ANY (ARRAY[('LOW'::character varying)::text, ('MEDIUM'::character varying)::text, ('HIGH'::character varying)::text, ('URGENT'::character varying)::text]))),
    CONSTRAINT check_status_unified CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('ASSIGNED'::character varying)::text, ('IN_PROGRESS'::character varying)::text, ('COMPLETED'::character varying)::text, ('REVOKED'::character varying)::text, ('SAVED'::character varying)::text, ('ON_HOLD'::character varying)::text]))),
    CONSTRAINT chk_verification_tasks_applicant_type CHECK (((applicant_type IS NULL) OR ((applicant_type)::text = ANY (ARRAY[('APPLICANT'::character varying)::text, ('CO-APPLICANT'::character varying)::text, ('REFERENCE PERSON'::character varying)::text]))))
);


--
-- Name: COLUMN verification_tasks.trigger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.trigger IS 'Trigger information for the verification task';


--
-- Name: COLUMN verification_tasks.applicant_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.applicant_type IS 'Type of applicant: APPLICANT, CO-APPLICANT, or REFERENCE PERSON';


--
-- Name: COLUMN verification_tasks.revoked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.revoked_at IS 'Timestamp when the task was revoked by field agent';


--
-- Name: COLUMN verification_tasks.revoked_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.revoked_by IS 'User ID of the field agent who revoked the task';


--
-- Name: COLUMN verification_tasks.revocation_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.revocation_reason IS 'Reason provided by field agent for revoking the task';


--
-- Name: COLUMN verification_tasks.cancelled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.cancelled_at IS 'Timestamp when the task was cancelled by backend user';


--
-- Name: COLUMN verification_tasks.cancelled_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.cancelled_by IS 'User ID of the backend user who cancelled the task';


--
-- Name: COLUMN verification_tasks.cancellation_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.cancellation_reason IS 'Reason provided by backend user for cancelling the task';


--
-- Name: COLUMN verification_tasks.task_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.task_type IS 'Type of the task: NORMAL or REVISIT';


--
-- Name: COLUMN verification_tasks.parent_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.parent_task_id IS 'ID of the original task if this is a revisit task';


--
-- Name: COLUMN verification_tasks.saved_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.saved_at IS 'Timestamp when the task was saved by field agent';


--
-- Name: COLUMN verification_tasks.is_saved; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.is_saved IS 'Boolean flag indicating if task is in saved state';


--
-- Name: COLUMN verification_tasks.first_assigned_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.first_assigned_at IS 'When the task was first assigned for Bank SLA tracking';


--
-- Name: COLUMN verification_tasks.current_assigned_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.current_assigned_at IS 'When the task was last assigned/reassigned for Agent Performance tracking';


--
-- Name: COLUMN verification_tasks.forensic_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.forensic_version IS 'Forensic enforcement version: 1 = legacy verification (no forensic enforcement), 2 = forensic-protected verification. Allows backward compatibility for old cases.';


--
-- Name: COLUMN verification_tasks.device_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.device_id IS 'Device used for entire verification task. Must match photo device_ids.';


--
-- Name: COLUMN verification_tasks.app_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.app_version IS 'Mobile app version used for this task.';


--
-- Name: COLUMN verification_tasks.submitted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.submitted_at IS 'When field agent submitted task (status → SUBMITTED). Distinct from completed_at.';


--
-- Name: COLUMN verification_tasks.reviewer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.reviewer_id IS 'Backend user who reviewed and approved/rejected this task.';


--
-- Name: COLUMN verification_tasks.reviewed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.reviewed_at IS 'When reviewer made approval/rejection decision.';


--
-- Name: COLUMN verification_tasks.review_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_tasks.review_notes IS 'Reviewer comments or rejection reason.';


--
-- Name: case_task_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.case_task_summary AS
 SELECT c.id AS case_id,
    c."caseId" AS case_number,
    c."customerName",
    c.status AS case_status,
    c."createdAt" AS case_created_at,
    c.has_multiple_tasks,
    c.total_tasks_count,
    c.completed_tasks_count,
    c.case_completion_percentage,
    count(vt.id) AS actual_tasks_count,
    count(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'IN_PROGRESS'::text) THEN 1
            ELSE NULL::integer
        END) AS in_progress_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'PENDING'::text) THEN 1
            ELSE NULL::integer
        END) AS pending_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'ASSIGNED'::text) THEN 1
            ELSE NULL::integer
        END) AS assigned_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'CANCELLED'::text) THEN 1
            ELSE NULL::integer
        END) AS cancelled_tasks,
    COALESCE(sum(vt.estimated_amount), (0)::numeric) AS total_estimated_amount,
    COALESCE(sum(vt.actual_amount), (0)::numeric) AS total_actual_amount,
    COALESCE(sum(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN vt.actual_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS completed_amount,
    COALESCE(sum(tcc.calculated_commission), (0)::numeric) AS total_commission,
    COALESCE(sum(
        CASE
            WHEN ((tcc.status)::text = 'PAID'::text) THEN tcc.calculated_commission
            ELSE (0)::numeric
        END), (0)::numeric) AS paid_commission,
    min(vt.assigned_at) AS first_task_assigned,
    max(vt.completed_at) AS last_task_completed
   FROM ((public.cases c
     LEFT JOIN public.verification_tasks vt ON ((c.id = vt.case_id)))
     LEFT JOIN public.task_commission_calculations tcc ON ((vt.id = tcc.verification_task_id)))
  GROUP BY c.id, c."caseId", c."customerName", c.status, c."createdAt", c.has_multiple_tasks, c.total_tasks_count, c.completed_tasks_count, c.case_completion_percentage;


--
-- Name: case_timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_category character varying(30) DEFAULT 'GENERAL'::character varying NOT NULL,
    performed_by uuid,
    event_data jsonb DEFAULT '{}'::jsonb,
    previous_value text,
    new_value text,
    event_description text,
    is_system_generated boolean DEFAULT false,
    event_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT case_timeline_events_event_category_check CHECK (((event_category)::text = ANY (ARRAY[('ASSIGNMENT'::character varying)::text, ('STATUS_CHANGE'::character varying)::text, ('FORM_SUBMISSION'::character varying)::text, ('VALIDATION'::character varying)::text, ('COMMUNICATION'::character varying)::text, ('GENERAL'::character varying)::text])))
);


--
-- Name: cases_caseId_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."cases_caseId_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cases_caseId_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."cases_caseId_seq" OWNED BY public.cases."caseId";


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    name character varying(100) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL,
    "stateId" integer,
    "countryId" integer
);


--
-- Name: cities_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cities_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cities_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cities_temp_id_seq OWNED BY public.cities.id;


--
-- Name: clientDocumentTypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."clientDocumentTypes" (
    id integer NOT NULL,
    "clientId" integer NOT NULL,
    "documentTypeId" integer NOT NULL,
    is_mandatory boolean DEFAULT false,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE "clientDocumentTypes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."clientDocumentTypes" IS 'Junction table mapping document types to clients';


--
-- Name: clientDocumentTypes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."clientDocumentTypes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientDocumentTypes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."clientDocumentTypes_id_seq" OWNED BY public."clientDocumentTypes".id;


--
-- Name: clientProducts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."clientProducts" (
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL,
    "clientId" integer,
    "productId" integer
);


--
-- Name: TABLE "clientProducts"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."clientProducts" IS 'Products available to each client';


--
-- Name: clientProducts_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."clientProducts_temp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientProducts_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."clientProducts_temp_id_seq" OWNED BY public."clientProducts".id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    email character varying(100),
    phone character varying(20),
    address text,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL
);


--
-- Name: client_task_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.client_task_analytics AS
 SELECT c."clientId",
    cl.name AS client_name,
    count(DISTINCT c.id) AS total_cases,
    count(DISTINCT
        CASE
            WHEN c.has_multiple_tasks THEN c.id
            ELSE NULL::uuid
        END) AS multi_task_cases,
    count(vt.id) AS total_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'IN_PROGRESS'::text) THEN 1
            ELSE NULL::integer
        END) AS in_progress_tasks,
    count(
        CASE
            WHEN (((vt.status)::text = 'PENDING'::text) OR ((vt.status)::text = 'ASSIGNED'::text)) THEN 1
            ELSE NULL::integer
        END) AS pending_tasks,
    COALESCE(sum(vt.estimated_amount), (0)::numeric) AS total_estimated_amount,
    COALESCE(sum(vt.actual_amount), (0)::numeric) AS total_actual_amount,
    COALESCE(sum(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN vt.actual_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS completed_amount,
    round(
        CASE
            WHEN (count(vt.id) = 0) THEN (0)::numeric
            ELSE (((count(
            CASE
                WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
                ELSE NULL::integer
            END))::numeric / (count(vt.id))::numeric) * (100)::numeric)
        END, 2) AS task_completion_rate,
    round(
        CASE
            WHEN (count(DISTINCT c.id) = 0) THEN (0)::numeric
            ELSE (((count(DISTINCT
            CASE
                WHEN ((c.status)::text = 'COMPLETED'::text) THEN c.id
                ELSE NULL::uuid
            END))::numeric / (count(DISTINCT c.id))::numeric) * (100)::numeric)
        END, 2) AS case_completion_rate,
    round(avg(
        CASE
            WHEN (((c.status)::text = 'COMPLETED'::text) AND (c."completedAt" IS NOT NULL)) THEN (EXTRACT(epoch FROM (c."completedAt" - c."createdAt")) / (86400)::numeric)
            ELSE NULL::numeric
        END), 2) AS avg_case_completion_days
   FROM ((public.cases c
     LEFT JOIN public.verification_tasks vt ON ((c.id = vt.case_id)))
     LEFT JOIN public.clients cl ON ((c."clientId" = cl.id)))
  GROUP BY c."clientId", cl.name;


--
-- Name: clients_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_temp_id_seq OWNED BY public.clients.id;


--
-- Name: commission_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.commission_analytics AS
 SELECT date(calculation_date) AS calculation_date,
    count(*) AS total_commissions,
    count(
        CASE
            WHEN ((status)::text = 'PAID'::text) THEN 1
            ELSE NULL::integer
        END) AS paid_commissions,
    count(
        CASE
            WHEN (((status)::text = 'PENDING'::text) OR ((status)::text = 'CALCULATED'::text)) THEN 1
            ELSE NULL::integer
        END) AS pending_commissions,
    COALESCE(sum(calculated_commission), (0)::numeric) AS total_commission_amount,
    COALESCE(sum(
        CASE
            WHEN ((status)::text = 'PAID'::text) THEN calculated_commission
            ELSE (0)::numeric
        END), (0)::numeric) AS paid_commission_amount,
    COALESCE(sum(
        CASE
            WHEN (((status)::text = 'PENDING'::text) OR ((status)::text = 'CALCULATED'::text)) THEN calculated_commission
            ELSE (0)::numeric
        END), (0)::numeric) AS pending_commission_amount,
    round(avg(calculated_commission), 2) AS avg_commission_amount,
    round(avg(base_amount), 2) AS avg_base_amount,
    count(DISTINCT user_id) AS unique_users,
    count(DISTINCT case_id) AS unique_cases
   FROM public.task_commission_calculations tcc
  WHERE (calculation_date >= (CURRENT_DATE - '90 days'::interval))
  GROUP BY (date(calculation_date))
  ORDER BY (date(calculation_date)) DESC;


--
-- Name: commission_batch_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_batch_items (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    commission_id bigint NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT commission_batch_items_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: TABLE commission_batch_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.commission_batch_items IS 'Individual commission items within payment batches';


--
-- Name: commission_batch_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commission_batch_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commission_batch_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commission_batch_items_id_seq OWNED BY public.commission_batch_items.id;


--
-- Name: commission_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_calculations (
    id bigint NOT NULL,
    case_id uuid NOT NULL,
    case_number integer NOT NULL,
    user_id uuid NOT NULL,
    client_id integer NOT NULL,
    rate_type_id integer NOT NULL,
    base_amount numeric(10,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    calculated_commission numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    calculation_method character varying(20) DEFAULT 'FIXED_AMOUNT'::character varying NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    case_completed_at timestamp with time zone NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    paid_by uuid,
    paid_at timestamp with time zone,
    payment_method character varying(50),
    transaction_id character varying(100),
    rejection_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    verification_task_id uuid,
    CONSTRAINT chk_commission_calculations_amount_positive CHECK ((commission_amount > (0)::numeric)),
    CONSTRAINT commission_calculations_base_amount_check CHECK ((base_amount >= (0)::numeric)),
    CONSTRAINT commission_calculations_calculated_commission_check CHECK ((calculated_commission >= (0)::numeric)),
    CONSTRAINT commission_calculations_calculation_method_check CHECK (((calculation_method)::text = 'FIXED_AMOUNT'::text)),
    CONSTRAINT commission_calculations_commission_amount_check CHECK ((commission_amount >= (0)::numeric)),
    CONSTRAINT commission_calculations_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('APPROVED'::character varying)::text, ('PAID'::character varying)::text, ('REJECTED'::character varying)::text])))
);


--
-- Name: TABLE commission_calculations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.commission_calculations IS 'Calculated commissions for completed cases';


--
-- Name: COLUMN commission_calculations.base_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.commission_calculations.base_amount IS 'Original rate amount from rates table';


--
-- Name: COLUMN commission_calculations.commission_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.commission_calculations.commission_amount IS 'Fixed commission amount used for calculation';


--
-- Name: COLUMN commission_calculations.calculated_commission; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.commission_calculations.calculated_commission IS 'Final commission amount to be paid';


--
-- Name: COLUMN commission_calculations.calculation_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.commission_calculations.calculation_method IS 'Always FIXED_AMOUNT - percentage support removed';


--
-- Name: commission_calculations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commission_calculations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commission_calculations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commission_calculations_id_seq OWNED BY public.commission_calculations.id;


--
-- Name: commission_payment_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_payment_batches (
    id bigint NOT NULL,
    batch_number character varying(50) NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    total_commissions integer NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    payment_method character varying(50) NOT NULL,
    payment_date timestamp with time zone,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_by uuid NOT NULL,
    processed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT commission_payment_batches_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('PROCESSING'::character varying)::text, ('COMPLETED'::character varying)::text, ('FAILED'::character varying)::text]))),
    CONSTRAINT commission_payment_batches_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT commission_payment_batches_total_commissions_check CHECK ((total_commissions >= 0))
);


--
-- Name: TABLE commission_payment_batches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.commission_payment_batches IS 'Batched commission payments for easier processing';


--
-- Name: commission_payment_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commission_payment_batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commission_payment_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commission_payment_batches_id_seq OWNED BY public.commission_payment_batches.id;


--
-- Name: commission_rate_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_rate_types (
    id bigint NOT NULL,
    rate_type_id integer NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_commission_rate_types_amount_positive CHECK ((commission_amount > (0)::numeric)),
    CONSTRAINT commission_rate_types_commission_amount_check CHECK ((commission_amount >= (0)::numeric))
);


--
-- Name: TABLE commission_rate_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.commission_rate_types IS 'Commission rate templates with fixed amounts only';


--
-- Name: COLUMN commission_rate_types.commission_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.commission_rate_types.commission_amount IS 'Fixed commission amount in specified currency';


--
-- Name: commission_rate_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commission_rate_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commission_rate_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commission_rate_types_id_seq OWNED BY public.commission_rate_types.id;


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    name character varying(100) NOT NULL,
    code character varying(3) NOT NULL,
    continent character varying(50) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL
);


--
-- Name: countries_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.countries_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: countries_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.countries_temp_id_seq OWNED BY public.countries.id;


--
-- Name: verification_task_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_task_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    description text,
    category character varying(50),
    default_priority character varying(10) DEFAULT 'MEDIUM'::character varying,
    estimated_duration_hours integer DEFAULT 24,
    requires_location boolean DEFAULT false,
    requires_documents boolean DEFAULT false,
    required_form_type character varying(50),
    validation_rules jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    CONSTRAINT check_task_type_category CHECK (((category)::text = ANY (ARRAY[('DOCUMENT'::character varying)::text, ('ADDRESS'::character varying)::text, ('BUSINESS'::character varying)::text, ('IDENTITY'::character varying)::text, ('FINANCIAL'::character varying)::text, ('EMPLOYMENT'::character varying)::text]))),
    CONSTRAINT check_task_type_priority CHECK (((default_priority)::text = ANY (ARRAY[('LOW'::character varying)::text, ('MEDIUM'::character varying)::text, ('HIGH'::character varying)::text, ('URGENT'::character varying)::text])))
);


--
-- Name: daily_task_performance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.daily_task_performance AS
 SELECT date(vt.created_at) AS task_date,
    count(*) AS tasks_created,
    count(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
            ELSE NULL::integer
        END) AS tasks_completed,
    count(
        CASE
            WHEN (vt.assigned_to IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS tasks_assigned,
    round(
        CASE
            WHEN (count(*) = 0) THEN (0)::numeric
            ELSE (((count(
            CASE
                WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
                ELSE NULL::integer
            END))::numeric / (count(*))::numeric) * (100)::numeric)
        END, 2) AS completion_rate,
    COALESCE(sum(vt.estimated_amount), (0)::numeric) AS total_estimated_value,
    COALESCE(sum(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN vt.actual_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_completed_value,
    round(avg(
        CASE
            WHEN (((vt.status)::text = 'COMPLETED'::text) AND (vt.started_at IS NOT NULL)) THEN (EXTRACT(epoch FROM (vt.completed_at - vt.started_at)) / (3600)::numeric)
            ELSE NULL::numeric
        END), 2) AS avg_completion_hours,
    count(
        CASE
            WHEN ((vtt.category)::text = 'ADDRESS'::text) THEN 1
            ELSE NULL::integer
        END) AS address_tasks,
    count(
        CASE
            WHEN ((vtt.category)::text = 'DOCUMENT'::text) THEN 1
            ELSE NULL::integer
        END) AS document_tasks,
    count(
        CASE
            WHEN ((vtt.category)::text = 'BUSINESS'::text) THEN 1
            ELSE NULL::integer
        END) AS business_tasks,
    count(
        CASE
            WHEN ((vtt.category)::text = 'IDENTITY'::text) THEN 1
            ELSE NULL::integer
        END) AS identity_tasks
   FROM (public.verification_tasks vt
     LEFT JOIN public.verification_task_types vtt ON ((vt.verification_type_id = vtt.id)))
  WHERE (vt.created_at >= (CURRENT_DATE - '90 days'::interval))
  GROUP BY (date(vt.created_at))
  ORDER BY (date(vt.created_at)) DESC;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    name character varying(100) NOT NULL,
    description text,
    "departmentHeadId" uuid,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "createdBy" uuid,
    "updatedBy" uuid,
    id integer NOT NULL,
    "parentDepartmentId" integer
);


--
-- Name: departments_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_temp_id_seq OWNED BY public.departments.id;


--
-- Name: designations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designations (
    name character varying(100) NOT NULL,
    description text,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "createdBy" uuid,
    "updatedBy" uuid,
    id integer NOT NULL,
    "departmentId" integer
);


--
-- Name: designations_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.designations_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: designations_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.designations_temp_id_seq OWNED BY public.designations.id;


--
-- Name: documentTypeRates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."documentTypeRates" (
    id bigint NOT NULL,
    "clientId" integer NOT NULL,
    "productId" integer NOT NULL,
    "documentTypeId" integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    "isActive" boolean DEFAULT true,
    "effectiveFrom" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" timestamp without time zone,
    "createdBy" uuid,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documentTypeRates_amount_check" CHECK ((amount >= (0)::numeric))
);


--
-- Name: TABLE "documentTypeRates"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."documentTypeRates" IS 'Stores pricing for document verification services by client, product, and document type';


--
-- Name: COLUMN "documentTypeRates"."clientId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypeRates"."clientId" IS 'Reference to the client requesting document verification';


--
-- Name: COLUMN "documentTypeRates"."productId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypeRates"."productId" IS 'Reference to the product/service for which document is required';


--
-- Name: COLUMN "documentTypeRates"."documentTypeId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypeRates"."documentTypeId" IS 'Reference to the type of document (Aadhaar, PAN, Passport, etc.)';


--
-- Name: COLUMN "documentTypeRates".amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypeRates".amount IS 'Rate amount for this document type verification';


--
-- Name: COLUMN "documentTypeRates".currency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypeRates".currency IS 'Currency code (default: INR)';


--
-- Name: COLUMN "documentTypeRates"."isActive"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypeRates"."isActive" IS 'Whether this rate is currently active';


--
-- Name: COLUMN "documentTypeRates"."effectiveFrom"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypeRates"."effectiveFrom" IS 'Date from which this rate is effective';


--
-- Name: COLUMN "documentTypeRates"."effectiveTo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypeRates"."effectiveTo" IS 'Date until which this rate is effective (NULL for indefinite)';


--
-- Name: documentTypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."documentTypes" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    category character varying(100),
    is_government_issued boolean DEFAULT true,
    requires_verification boolean DEFAULT true,
    validity_period_months integer,
    format_pattern character varying(255),
    min_length integer,
    max_length integer,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE "documentTypes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."documentTypes" IS 'Master table for document types used in verification processes';


--
-- Name: COLUMN "documentTypes".code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypes".code IS 'Unique code for the document type (e.g., AADHAAR, PAN, PASSPORT)';


--
-- Name: COLUMN "documentTypes".category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypes".category IS 'Category of document (e.g., IDENTITY, ADDRESS, FINANCIAL)';


--
-- Name: COLUMN "documentTypes".is_government_issued; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypes".is_government_issued IS 'Whether this is a government-issued document';


--
-- Name: COLUMN "documentTypes".requires_verification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypes".requires_verification IS 'Whether this document requires verification';


--
-- Name: COLUMN "documentTypes".validity_period_months; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypes".validity_period_months IS 'Validity period in months (NULL for no expiry)';


--
-- Name: COLUMN "documentTypes".format_pattern; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."documentTypes".format_pattern IS 'Regex pattern for document number validation';


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "isActive" boolean DEFAULT true,
    id integer NOT NULL
);


--
-- Name: TABLE products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.products IS 'Core business products offered by the organization';


--
-- Name: COLUMN products."isActive"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products."isActive" IS 'Indicates whether the product is active and available for use';


--
-- Name: documentTypeRatesView; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public."documentTypeRatesView" AS
 SELECT dtr.id,
    dtr."clientId",
    dtr."productId",
    dtr."documentTypeId",
    dtr.amount,
    dtr.currency,
    dtr."isActive",
    dtr."effectiveFrom",
    dtr."effectiveTo",
    dtr."createdBy",
    dtr."createdAt",
    dtr."updatedAt",
    c.name AS "clientName",
    c.code AS "clientCode",
    p.name AS "productName",
    p.code AS "productCode",
    dt.name AS "documentTypeName",
    dt.code AS "documentTypeCode",
    dt.category AS "documentTypeCategory"
   FROM (((public."documentTypeRates" dtr
     JOIN public.clients c ON ((dtr."clientId" = c.id)))
     JOIN public.products p ON ((dtr."productId" = p.id)))
     JOIN public."documentTypes" dt ON ((dtr."documentTypeId" = dt.id)));


--
-- Name: documentTypeRates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."documentTypeRates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentTypeRates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."documentTypeRates_id_seq" OWNED BY public."documentTypeRates".id;


--
-- Name: documentTypes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."documentTypes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentTypes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."documentTypes_id_seq" OWNED BY public."documentTypes".id;


--
-- Name: dsaConnectorVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."dsaConnectorVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    landmark1 character varying(255),
    landmark2 character varying(255),
    landmark3 character varying(255),
    landmark4 character varying(255),
    connector_type character varying(50),
    connector_code character varying(100),
    connector_name character varying(255),
    connector_designation character varying(100),
    connector_experience integer,
    connector_status character varying(50),
    business_name character varying(255),
    business_type character varying(100),
    business_registration_number character varying(100),
    business_establishment_year integer,
    office_type character varying(100),
    office_area numeric(10,2),
    office_rent numeric(10,2),
    total_staff integer,
    sales_staff integer,
    support_staff integer,
    team_size integer,
    monthly_business_volume numeric(15,2),
    average_monthly_sales numeric(15,2),
    annual_turnover numeric(15,2),
    monthly_income numeric(12,2),
    commission_structure character varying(255),
    payment_terms character varying(255),
    bank_account_details character varying(255),
    computer_systems integer,
    internet_connection character varying(50),
    software_systems character varying(255),
    pos_terminals integer,
    printer_scanner character varying(50),
    license_status character varying(50),
    license_number character varying(100),
    license_expiry_date date,
    compliance_status character varying(50),
    audit_status character varying(50),
    training_status character varying(50),
    met_person_name character varying(255),
    met_person_designation character varying(100),
    met_person_relation character varying(100),
    met_person_contact character varying(20),
    business_operational character varying(50),
    customer_footfall character varying(100),
    business_hours character varying(100),
    weekend_operations character varying(50),
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    current_location character varying(255),
    premises_status character varying(50),
    previous_business_name character varying(255),
    entry_restriction_reason character varying(255),
    security_person_name character varying(255),
    security_confirmation character varying(50),
    contact_person character varying(255),
    call_remark character varying(50),
    market_presence character varying(100),
    competitor_analysis character varying(255),
    market_reputation character varying(100),
    customer_feedback character varying(100),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    infrastructure_status character varying(100),
    commercial_viability character varying(100),
    other_observation text,
    business_concerns text,
    operational_challenges text,
    growth_potential text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    risk_assessment character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    verification_task_id uuid,
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_dsa_connector_verification_connector_experience CHECK (((connector_experience IS NULL) OR ((connector_experience >= 0) AND (connector_experience <= 50)))),
    CONSTRAINT chk_dsa_connector_verification_establishment_year CHECK (((business_establishment_year IS NULL) OR ((business_establishment_year >= 1900) AND ((business_establishment_year)::numeric <= EXTRACT(year FROM CURRENT_DATE))))),
    CONSTRAINT chk_dsa_connector_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_dsa_connector_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text]))),
    CONSTRAINT chk_dsa_connector_verification_staff_consistency CHECK (((total_staff IS NULL) OR ((sales_staff + support_staff) <= total_staff))),
    CONSTRAINT chk_dsa_connector_verification_total_staff CHECK (((total_staff IS NULL) OR ((total_staff >= 1) AND (total_staff <= 1000))))
);


--
-- Name: TABLE "dsaConnectorVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."dsaConnectorVerificationReports" IS 'Comprehensive table for storing DSA/DST Connector verification form data from mobile app submissions';


--
-- Name: COLUMN "dsaConnectorVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."dsaConnectorVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "dsaConnectorVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."dsaConnectorVerificationReports".form_type IS 'Type of DSA/DST Connector verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "dsaConnectorVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."dsaConnectorVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "dsaConnectorVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."dsaConnectorVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "dsaConnectorVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."dsaConnectorVerificationReports".verification_task_id IS 'Links DSA connector verification report to specific verification task';


--
-- Name: COLUMN "dsaConnectorVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."dsaConnectorVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "dsaConnectorVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."dsaConnectorVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "dsaConnectorVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."dsaConnectorVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_logs (
    id bigint NOT NULL,
    error_type character varying(100) NOT NULL,
    error_message text NOT NULL,
    stack_trace text,
    request_id character varying(255),
    user_id uuid,
    url text,
    additional_data jsonb,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE error_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.error_logs IS 'Centralized error logging for application monitoring';


--
-- Name: error_frequency; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.error_frequency AS
 SELECT error_type,
    count(*) AS error_count,
    max("timestamp") AS last_occurrence,
    count(DISTINCT user_id) AS affected_users
   FROM public.error_logs
  WHERE ("timestamp" > (now() - '24:00:00'::interval))
  GROUP BY error_type
  ORDER BY (count(*)) DESC;


--
-- Name: error_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.error_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: error_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.error_logs_id_seq OWNED BY public.error_logs.id;


--
-- Name: pincodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pincodes (
    code character varying(10) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL,
    "cityId" integer
);


--
-- Name: TABLE pincodes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pincodes IS 'Postal codes linked to cities';


--
-- Name: states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.states (
    name character varying(100) NOT NULL,
    code character varying(10) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL,
    "countryId" integer
);


--
-- Name: userAreaAssignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."userAreaAssignments" (
    id integer NOT NULL,
    "userId" uuid NOT NULL,
    "pincodeId" integer NOT NULL,
    "areaId" integer NOT NULL,
    "userPincodeAssignmentId" integer NOT NULL,
    "assignedBy" uuid NOT NULL,
    "assignedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE "userAreaAssignments"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."userAreaAssignments" IS 'Junction table for assigning field agents to specific areas within pincodes';


--
-- Name: COLUMN "userAreaAssignments"."userId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userAreaAssignments"."userId" IS 'Reference to the field agent user being assigned to areas';


--
-- Name: COLUMN "userAreaAssignments"."pincodeId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userAreaAssignments"."pincodeId" IS 'Reference to the pincode containing the area';


--
-- Name: COLUMN "userAreaAssignments"."areaId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userAreaAssignments"."areaId" IS 'Reference to the specific area within the pincode';


--
-- Name: COLUMN "userAreaAssignments"."userPincodeAssignmentId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userAreaAssignments"."userPincodeAssignmentId" IS 'Reference to the parent pincode assignment';


--
-- Name: COLUMN "userAreaAssignments"."isActive"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userAreaAssignments"."isActive" IS 'Whether this area assignment is currently active';


--
-- Name: userPincodeAssignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."userPincodeAssignments" (
    id integer NOT NULL,
    "userId" uuid NOT NULL,
    "pincodeId" integer NOT NULL,
    "assignedBy" uuid NOT NULL,
    "assignedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE "userPincodeAssignments"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."userPincodeAssignments" IS 'Junction table for assigning field agents to specific pincodes for territorial coverage';


--
-- Name: COLUMN "userPincodeAssignments"."userId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userPincodeAssignments"."userId" IS 'Reference to the field agent user being assigned to pincodes';


--
-- Name: COLUMN "userPincodeAssignments"."pincodeId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userPincodeAssignments"."pincodeId" IS 'Reference to the pincode the field agent is assigned to';


--
-- Name: COLUMN "userPincodeAssignments"."assignedBy"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userPincodeAssignments"."assignedBy" IS 'User who performed the assignment (ADMIN/SUPER_ADMIN)';


--
-- Name: COLUMN "userPincodeAssignments"."isActive"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userPincodeAssignments"."isActive" IS 'Whether this assignment is currently active';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    "passwordHash" character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'USER'::character varying NOT NULL,
    email character varying(100),
    phone character varying(20),
    "isActive" boolean DEFAULT true,
    "lastLogin" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "employeeId" character varying(50),
    designation character varying(100),
    department character varying(100),
    "profilePhotoUrl" character varying(500),
    "roleId" integer,
    "departmentId" integer,
    "designationId" integer,
    performance_rating numeric(3,2) DEFAULT NULL::numeric,
    total_cases_handled integer DEFAULT 0,
    avg_case_completion_days numeric(6,2) DEFAULT NULL::numeric,
    last_active_at timestamp without time zone,
    preferred_form_types character varying(100) DEFAULT NULL::character varying,
    "deletedAt" timestamp with time zone,
    CONSTRAINT chk_users_role CHECK (((role)::text = ANY (ARRAY[('SUPER_ADMIN'::character varying)::text, ('ADMIN'::character varying)::text, ('BACKEND_USER'::character varying)::text, ('FIELD_AGENT'::character varying)::text, ('MANAGER'::character varying)::text, ('REPORT_PERSON'::character varying)::text]))),
    CONSTRAINT users_avg_case_completion_days_check CHECK ((avg_case_completion_days >= (0)::numeric)),
    CONSTRAINT users_performance_rating_check CHECK (((performance_rating >= (0)::numeric) AND (performance_rating <= (5)::numeric))),
    CONSTRAINT users_total_cases_handled_check CHECK ((total_cases_handled >= 0))
);


--
-- Name: fieldAgentTerritories; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public."fieldAgentTerritories" AS
 SELECT u.id AS "userId",
    u.name AS "userName",
    u.username,
    u."employeeId",
    upa.id AS "pincodeAssignmentId",
    p.id AS "pincodeId",
    p.code AS "pincodeCode",
    c.name AS "cityName",
    s.name AS "stateName",
    co.name AS "countryName",
    COALESCE(json_agg(json_build_object('areaAssignmentId', uaa.id, 'areaId', a.id, 'areaName', a.name, 'assignedAt', uaa."assignedAt") ORDER BY a.name) FILTER (WHERE (a.id IS NOT NULL)), '[]'::json) AS "assignedAreas",
    upa."assignedAt" AS "pincodeAssignedAt",
    upa."assignedBy",
    upa."isActive"
   FROM (((((((public.users u
     JOIN public."userPincodeAssignments" upa ON ((u.id = upa."userId")))
     JOIN public.pincodes p ON ((upa."pincodeId" = p.id)))
     JOIN public.cities c ON ((p."cityId" = c.id)))
     JOIN public.states s ON ((c."stateId" = s.id)))
     JOIN public.countries co ON ((c."countryId" = co.id)))
     LEFT JOIN public."userAreaAssignments" uaa ON (((upa.id = uaa."userPincodeAssignmentId") AND (uaa."isActive" = true))))
     LEFT JOIN public.areas a ON ((uaa."areaId" = a.id)))
  WHERE (upa."isActive" = true)
  GROUP BY u.id, u.name, u.username, u."employeeId", upa.id, p.id, p.code, c.name, s.name, co.name, upa."assignedAt", upa."assignedBy", upa."isActive";


--
-- Name: VIEW "fieldAgentTerritories"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public."fieldAgentTerritories" IS 'Comprehensive view of field agent territory assignments with pincode and area details';


--
-- Name: field_user_commission_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_user_commission_assignments (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    rate_type_id integer NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    client_id integer,
    is_active boolean DEFAULT true,
    effective_from timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    effective_to timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_field_user_commission_amount_positive CHECK ((commission_amount > (0)::numeric)),
    CONSTRAINT field_user_commission_assignments_commission_amount_check CHECK ((commission_amount >= (0)::numeric))
);


--
-- Name: TABLE field_user_commission_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.field_user_commission_assignments IS 'Field user commission assignments with fixed amounts only';


--
-- Name: COLUMN field_user_commission_assignments.commission_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.field_user_commission_assignments.commission_amount IS 'Fixed commission amount for this user assignment';


--
-- Name: COLUMN field_user_commission_assignments.client_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.field_user_commission_assignments.client_id IS 'NULL for global assignments, specific client_id for institute-specific rates';


--
-- Name: field_user_commission_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.field_user_commission_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: field_user_commission_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.field_user_commission_assignments_id_seq OWNED BY public.field_user_commission_assignments.id;


--
-- Name: field_user_task_workload; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_user_task_workload AS
 SELECT u.id AS user_id,
    u.name AS user_name,
    u."employeeId",
    count(vt.id) AS total_assigned_tasks,
    count(
        CASE
            WHEN (((vt.status)::text = 'PENDING'::text) OR ((vt.status)::text = 'ASSIGNED'::text)) THEN 1
            ELSE NULL::integer
        END) AS pending_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'IN_PROGRESS'::text) THEN 1
            ELSE NULL::integer
        END) AS in_progress_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'CANCELLED'::text) THEN 1
            ELSE NULL::integer
        END) AS cancelled_tasks,
    round(
        CASE
            WHEN (count(vt.id) = 0) THEN (0)::numeric
            ELSE (((count(
            CASE
                WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
                ELSE NULL::integer
            END))::numeric / (count(vt.id))::numeric) * (100)::numeric)
        END, 2) AS completion_rate_percentage,
    COALESCE(sum(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN vt.actual_amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_completed_amount,
    COALESCE(sum(tcc.calculated_commission), (0)::numeric) AS total_commission_earned,
    COALESCE(sum(
        CASE
            WHEN ((tcc.status)::text = 'PAID'::text) THEN tcc.calculated_commission
            ELSE (0)::numeric
        END), (0)::numeric) AS paid_commission,
    round(avg(
        CASE
            WHEN (((vt.status)::text = 'COMPLETED'::text) AND (vt.started_at IS NOT NULL)) THEN (EXTRACT(epoch FROM (vt.completed_at - vt.started_at)) / (3600)::numeric)
            ELSE NULL::numeric
        END), 2) AS avg_completion_time_hours,
    max(vt.completed_at) AS last_task_completed,
    count(
        CASE
            WHEN (((vt.status)::text = 'COMPLETED'::text) AND (date(vt.completed_at) = CURRENT_DATE)) THEN 1
            ELSE NULL::integer
        END) AS completed_today
   FROM ((public.users u
     LEFT JOIN public.verification_tasks vt ON ((u.id = vt.assigned_to)))
     LEFT JOIN public.task_commission_calculations tcc ON ((vt.id = tcc.verification_task_id)))
  WHERE ((u.role)::text = 'FIELD_USER'::text)
  GROUP BY u.id, u.name, u."employeeId";


--
-- Name: form_quality_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_quality_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_submission_id uuid NOT NULL,
    overall_quality_score numeric(5,2),
    completeness_score numeric(5,2),
    accuracy_score numeric(5,2),
    photo_quality_score numeric(5,2),
    timeliness_score numeric(5,2),
    consistency_score numeric(5,2),
    calculated_at timestamp without time zone DEFAULT now(),
    calculated_by character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT form_quality_metrics_accuracy_score_check CHECK (((accuracy_score >= (0)::numeric) AND (accuracy_score <= (100)::numeric))),
    CONSTRAINT form_quality_metrics_completeness_score_check CHECK (((completeness_score >= (0)::numeric) AND (completeness_score <= (100)::numeric))),
    CONSTRAINT form_quality_metrics_consistency_score_check CHECK (((consistency_score >= (0)::numeric) AND (consistency_score <= (100)::numeric))),
    CONSTRAINT form_quality_metrics_overall_quality_score_check CHECK (((overall_quality_score >= (0)::numeric) AND (overall_quality_score <= (100)::numeric))),
    CONSTRAINT form_quality_metrics_photo_quality_score_check CHECK (((photo_quality_score >= (0)::numeric) AND (photo_quality_score <= (100)::numeric))),
    CONSTRAINT form_quality_metrics_timeliness_score_check CHECK (((timeliness_score >= (0)::numeric) AND (timeliness_score <= (100)::numeric)))
);


--
-- Name: TABLE form_quality_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.form_quality_metrics IS 'Quality metrics for form submissions';


--
-- Name: form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    verification_task_id uuid,
    verification_type_id integer,
    form_type character varying(50) NOT NULL,
    submitted_by uuid NOT NULL,
    submission_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    validation_errors jsonb DEFAULT '[]'::jsonb,
    photos_count integer DEFAULT 0,
    attachments_count integer DEFAULT 0,
    geo_location jsonb,
    submission_score numeric(5,2),
    time_spent_minutes integer,
    device_info jsonb DEFAULT '{}'::jsonb,
    network_quality character varying(20),
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    validated_at timestamp without time zone,
    validated_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT form_submissions_attachments_count_check CHECK ((attachments_count >= 0)),
    CONSTRAINT form_submissions_form_type_check CHECK (((form_type)::text = ANY (ARRAY[('RESIDENCE'::character varying)::text, ('OFFICE'::character varying)::text, ('BUSINESS'::character varying)::text, ('BUILDER'::character varying)::text, ('RESIDENCE_CUM_OFFICE'::character varying)::text, ('DSA_CONNECTOR'::character varying)::text, ('PROPERTY_APF'::character varying)::text, ('PROPERTY_INDIVIDUAL'::character varying)::text, ('NOC'::character varying)::text]))),
    CONSTRAINT form_submissions_photos_count_check CHECK ((photos_count >= 0)),
    CONSTRAINT form_submissions_submission_score_check CHECK (((submission_score >= (0)::numeric) AND (submission_score <= (100)::numeric))),
    CONSTRAINT form_submissions_time_spent_minutes_check CHECK ((time_spent_minutes >= 0)),
    CONSTRAINT form_submissions_validation_status_check CHECK (((validation_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('VALID'::character varying)::text, ('INVALID'::character varying)::text, ('REQUIRES_REVIEW'::character varying)::text])))
);


--
-- Name: TABLE form_submissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.form_submissions IS 'Generic form submissions table for analytics and reporting';


--
-- Name: COLUMN form_submissions.verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_submissions.verification_task_id IS 'Links form submission to specific verification task (multi-task support)';


--
-- Name: COLUMN form_submissions.verification_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_submissions.verification_type_id IS 'Verification type ID from the task (not case) for proper report generation';


--
-- Name: verificationTypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."verificationTypes" (
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "isActive" boolean DEFAULT true,
    id integer NOT NULL
);


--
-- Name: TABLE "verificationTypes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."verificationTypes" IS 'Types of verification services available';


--
-- Name: COLUMN "verificationTypes"."isActive"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."verificationTypes"."isActive" IS 'Indicates whether the verification type is active and available for use';


--
-- Name: form_submission_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.form_submission_analytics AS
 SELECT fs.id,
    fs.case_id,
    fs.verification_task_id,
    fs.form_type,
    fs.submitted_by,
    fs.submitted_at,
    fs.validation_status,
    fs.submission_score,
    fs.photos_count,
    fs.attachments_count,
    fqm.overall_quality_score,
    fqm.completeness_score,
    fqm.accuracy_score,
    fqm.photo_quality_score,
    fqm.timeliness_score,
    c."customerName",
    c."caseId" AS case_number,
    u.name AS submitted_by_name,
    u."employeeId" AS submitted_by_employee_id,
    vt.task_number,
    vtype.name AS verification_type_name
   FROM (((((public.form_submissions fs
     LEFT JOIN public.form_quality_metrics fqm ON ((fs.id = fqm.form_submission_id)))
     LEFT JOIN public.cases c ON ((fs.case_id = c.id)))
     LEFT JOIN public.users u ON ((fs.submitted_by = u.id)))
     LEFT JOIN public.verification_tasks vt ON ((fs.verification_task_id = vt.id)))
     LEFT JOIN public."verificationTypes" vtype ON ((fs.verification_type_id = vtype.id)));


--
-- Name: VIEW form_submission_analytics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.form_submission_analytics IS 'Analytics view combining form submissions with quality metrics and case data';


--
-- Name: form_validation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_validation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_submission_id uuid NOT NULL,
    field_name character varying(100) NOT NULL,
    field_value text,
    is_valid boolean NOT NULL,
    error_message text,
    validation_rule character varying(100),
    validated_at timestamp without time zone DEFAULT now(),
    validated_by character varying(50),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE form_validation_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.form_validation_logs IS 'Validation logs for form submission fields';


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    accuracy numeric(8,2),
    "recordedBy" uuid NOT NULL,
    "recordedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    "caseId" integer,
    case_id uuid NOT NULL,
    verification_task_id uuid
);


--
-- Name: COLUMN locations.verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.locations.verification_task_id IS 'Stage-1: Links GPS capture to a specific verification task. NULL for legacy records.';


--
-- Name: locations_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.locations_temp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: locations_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.locations_temp_id_seq OWNED BY public.locations.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id character varying(255) NOT NULL,
    filename character varying(255) NOT NULL,
    "executedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: mobile_device_sync; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mobile_device_sync (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "deviceId" character varying(255) NOT NULL,
    "lastSyncAt" timestamp with time zone NOT NULL,
    "appVersion" character varying(50) NOT NULL,
    platform character varying(20) NOT NULL,
    "syncCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mobile_device_sync_platform_check CHECK (((platform)::text = ANY (ARRAY[('iOS'::character varying)::text, ('Android'::character varying)::text])))
);


--
-- Name: TABLE mobile_device_sync; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mobile_device_sync IS 'Tracks mobile device synchronization for enterprise scale monitoring';


--
-- Name: mobile_notification_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mobile_notification_audit (
    id bigint NOT NULL,
    "notificationId" character varying(255) NOT NULL,
    "userId" uuid,
    "caseId" integer,
    "notificationType" character varying(100) NOT NULL,
    "notificationData" text NOT NULL,
    "sentAt" timestamp with time zone NOT NULL,
    "deliveryStatus" character varying(50) DEFAULT 'SENT'::character varying NOT NULL,
    "acknowledgedAt" timestamp with time zone,
    metadata text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    case_id uuid NOT NULL
);


--
-- Name: TABLE mobile_notification_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mobile_notification_audit IS 'Audit log for WebSocket notifications sent to mobile applications';


--
-- Name: COLUMN mobile_notification_audit."notificationId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit."notificationId" IS 'Unique identifier for the notification';


--
-- Name: COLUMN mobile_notification_audit."userId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit."userId" IS 'ID of the user who received the notification';


--
-- Name: COLUMN mobile_notification_audit."caseId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit."caseId" IS 'ID of the case related to the notification';


--
-- Name: COLUMN mobile_notification_audit."notificationType"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit."notificationType" IS 'Type of notification (CASE_ASSIGNED, CASE_STATUS_CHANGED, etc.)';


--
-- Name: COLUMN mobile_notification_audit."notificationData"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit."notificationData" IS 'JSON data of the notification payload';


--
-- Name: COLUMN mobile_notification_audit."sentAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit."sentAt" IS 'Timestamp when notification was sent';


--
-- Name: COLUMN mobile_notification_audit."deliveryStatus"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit."deliveryStatus" IS 'Status of notification delivery (SENT, DELIVERED, ACKNOWLEDGED, FAILED)';


--
-- Name: COLUMN mobile_notification_audit."acknowledgedAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit."acknowledgedAt" IS 'Timestamp when notification was acknowledged by mobile app';


--
-- Name: COLUMN mobile_notification_audit.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mobile_notification_audit.metadata IS 'Additional metadata about the notification';


--
-- Name: mobile_notification_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mobile_notification_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mobile_notification_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mobile_notification_audit_id_seq OWNED BY public.mobile_notification_audit.id;


--
-- Name: mobile_notification_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mobile_notification_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "notificationType" character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    "scheduledAt" timestamp with time zone DEFAULT now() NOT NULL,
    "sentAt" timestamp with time zone,
    "failedAt" timestamp with time zone,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    error text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE mobile_notification_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mobile_notification_queue IS 'Queue for mobile push notifications';


--
-- Name: mobile_sync_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.mobile_sync_analytics AS
 SELECT date_trunc('hour'::text, "lastSyncAt") AS sync_hour,
    count(*) AS total_syncs,
    count(DISTINCT "userId") AS unique_users,
    count(DISTINCT "deviceId") AS unique_devices,
    avg("syncCount") AS avg_sync_count,
    count(
        CASE
            WHEN ((platform)::text = 'iOS'::text) THEN 1
            ELSE NULL::integer
        END) AS ios_syncs,
    count(
        CASE
            WHEN ((platform)::text = 'Android'::text) THEN 1
            ELSE NULL::integer
        END) AS android_syncs
   FROM public.mobile_device_sync mds
  WHERE ("lastSyncAt" >= (now() - '24:00:00'::interval))
  GROUP BY (date_trunc('hour'::text, "lastSyncAt"))
  ORDER BY (date_trunc('hour'::text, "lastSyncAt")) DESC;


--
-- Name: VIEW mobile_sync_analytics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.mobile_sync_analytics IS 'Analytics view for mobile sync operations';


--
-- Name: nocVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."nocVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    landmark1 character varying(255),
    landmark2 character varying(255),
    landmark3 character varying(255),
    landmark4 character varying(255),
    noc_status character varying(50),
    noc_type character varying(100),
    noc_number character varying(100),
    noc_issue_date date,
    noc_expiry_date date,
    noc_issuing_authority character varying(255),
    noc_validity_status character varying(50),
    property_type character varying(100),
    project_name character varying(255),
    project_status character varying(50),
    construction_status character varying(50),
    project_approval_status character varying(50),
    total_units integer,
    completed_units integer,
    sold_units integer,
    possession_status character varying(50),
    builder_name character varying(255),
    builder_contact character varying(20),
    developer_name character varying(255),
    developer_contact character varying(20),
    builder_registration_number character varying(100),
    met_person_name character varying(255),
    met_person_designation character varying(100),
    met_person_relation character varying(100),
    met_person_contact character varying(20),
    document_shown_status character varying(50),
    document_type character varying(255),
    document_verification_status character varying(50),
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    current_location character varying(255),
    premises_status character varying(50),
    entry_restriction_reason character varying(255),
    security_person_name character varying(255),
    security_confirmation character varying(50),
    contact_person character varying(255),
    call_remark character varying(50),
    environmental_clearance character varying(50),
    fire_safety_clearance character varying(50),
    pollution_clearance character varying(50),
    water_connection_status character varying(50),
    electricity_connection_status character varying(50),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    infrastructure_status character varying(100),
    road_connectivity character varying(100),
    other_observation text,
    compliance_issues text,
    regulatory_concerns text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    verification_task_id uuid,
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_noc_verification_completed_units CHECK (((completed_units IS NULL) OR ((completed_units >= 0) AND (completed_units <= total_units)))),
    CONSTRAINT chk_noc_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_noc_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text]))),
    CONSTRAINT chk_noc_verification_sold_units CHECK (((sold_units IS NULL) OR ((sold_units >= 0) AND (sold_units <= total_units)))),
    CONSTRAINT chk_noc_verification_total_units CHECK (((total_units IS NULL) OR ((total_units >= 1) AND (total_units <= 10000))))
);


--
-- Name: TABLE "nocVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."nocVerificationReports" IS 'Comprehensive table for storing NOC verification form data from mobile app submissions';


--
-- Name: COLUMN "nocVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."nocVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "nocVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."nocVerificationReports".form_type IS 'Type of NOC verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "nocVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."nocVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "nocVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."nocVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "nocVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."nocVerificationReports".verification_task_id IS 'Links NOC verification report to specific verification task';


--
-- Name: COLUMN "nocVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."nocVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "nocVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."nocVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "nocVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."nocVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: notificationTokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."notificationTokens" (
    "userId" uuid NOT NULL,
    token character varying(500) NOT NULL,
    platform character varying(20) NOT NULL,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    CONSTRAINT chk_notification_tokens_platform CHECK (((platform)::text = ANY (ARRAY[('IOS'::character varying)::text, ('ANDROID'::character varying)::text, ('WEB'::character varying)::text])))
);


--
-- Name: notificationTokens_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."notificationTokens_temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificationTokens_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."notificationTokens_temp_id_seq" OWNED BY public."notificationTokens".id;


--
-- Name: notification_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_name character varying(255),
    batch_type character varying(50) NOT NULL,
    target_user_ids uuid[] DEFAULT '{}'::uuid[],
    target_roles character varying(50)[] DEFAULT '{}'::character varying[],
    status character varying(20) DEFAULT 'PENDING'::character varying,
    total_notifications integer DEFAULT 0,
    sent_notifications integer DEFAULT 0,
    failed_notifications integer DEFAULT 0,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notification_batches_batch_type_check CHECK (((batch_type)::text = ANY (ARRAY[('BULK_ASSIGNMENT'::character varying)::text, ('SYSTEM_ANNOUNCEMENT'::character varying)::text, ('EMERGENCY_ALERT'::character varying)::text, ('MAINTENANCE_NOTICE'::character varying)::text]))),
    CONSTRAINT notification_batches_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('PROCESSING'::character varying)::text, ('COMPLETED'::character varying)::text, ('FAILED'::character varying)::text, ('CANCELLED'::character varying)::text])))
);


--
-- Name: notification_delivery_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_delivery_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id uuid NOT NULL,
    delivery_method character varying(20) NOT NULL,
    attempt_number integer DEFAULT 1,
    delivery_status character varying(20) NOT NULL,
    error_code character varying(50),
    error_message text,
    device_id character varying(255),
    platform character varying(20),
    push_token_used text,
    attempted_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    response_data jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT notification_delivery_log_delivery_method_check CHECK (((delivery_method)::text = ANY (ARRAY[('PUSH'::character varying)::text, ('WEBSOCKET'::character varying)::text, ('EMAIL'::character varying)::text]))),
    CONSTRAINT notification_delivery_log_delivery_status_check CHECK (((delivery_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('SENT'::character varying)::text, ('DELIVERED'::character varying)::text, ('FAILED'::character varying)::text, ('RETRY'::character varying)::text])))
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    case_assignment_enabled boolean DEFAULT true,
    case_assignment_push boolean DEFAULT true,
    case_assignment_websocket boolean DEFAULT true,
    case_reassignment_enabled boolean DEFAULT true,
    case_reassignment_push boolean DEFAULT true,
    case_reassignment_websocket boolean DEFAULT true,
    case_completion_enabled boolean DEFAULT true,
    case_completion_push boolean DEFAULT false,
    case_completion_websocket boolean DEFAULT true,
    case_revocation_enabled boolean DEFAULT true,
    case_revocation_push boolean DEFAULT false,
    case_revocation_websocket boolean DEFAULT true,
    system_notifications_enabled boolean DEFAULT true,
    system_notifications_push boolean DEFAULT true,
    system_notifications_websocket boolean DEFAULT true,
    quiet_hours_enabled boolean DEFAULT false,
    quiet_hours_start time without time zone DEFAULT '22:00:00'::time without time zone,
    quiet_hours_end time without time zone DEFAULT '08:00:00'::time without time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id character varying(255) NOT NULL,
    platform character varying(20) NOT NULL,
    push_token text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notification_tokens_platform_check CHECK (((platform)::text = ANY (ARRAY[('ios'::character varying)::text, ('android'::character varying)::text, ('web'::character varying)::text, ('IOS'::character varying)::text, ('ANDROID'::character varying)::text, ('WEB'::character varying)::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    case_id uuid,
    case_number character varying(50),
    data jsonb DEFAULT '{}'::jsonb,
    action_url character varying(500),
    action_type character varying(50) DEFAULT 'NAVIGATE'::character varying,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    delivery_status character varying(20) DEFAULT 'PENDING'::character varying,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    priority character varying(20) DEFAULT 'MEDIUM'::character varying,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    task_id uuid,
    task_number character varying(20),
    CONSTRAINT notifications_delivery_status_check CHECK (((delivery_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('SENT'::character varying)::text, ('DELIVERED'::character varying)::text, ('FAILED'::character varying)::text, ('ACKNOWLEDGED'::character varying)::text]))),
    CONSTRAINT notifications_priority_check CHECK (((priority)::text = ANY (ARRAY[('LOW'::character varying)::text, ('MEDIUM'::character varying)::text, ('HIGH'::character varying)::text, ('URGENT'::character varying)::text]))),
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY ((ARRAY['CASE_ASSIGNED'::character varying, 'CASE_REASSIGNED'::character varying, 'CASE_REMOVED'::character varying, 'CASE_COMPLETED'::character varying, 'CASE_REVOKED'::character varying, 'TASK_REVOKED'::character varying, 'TASK_COMPLETED'::character varying, 'CASE_APPROVED'::character varying, 'CASE_REJECTED'::character varying, 'SYSTEM_MAINTENANCE'::character varying, 'APP_UPDATE'::character varying, 'EMERGENCY_ALERT'::character varying, 'TEST'::character varying])::text[])))
);


--
-- Name: COLUMN notifications.task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.task_id IS 'Reference to specific verification task (for task-level notifications)';


--
-- Name: COLUMN notifications.task_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.task_number IS 'Human-readable task number for display in notifications';


--
-- Name: officeVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."officeVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    company_nameplate_status character varying(50),
    name_on_company_board character varying(255),
    landmark1 character varying(255),
    landmark2 character varying(255),
    office_status character varying(50),
    office_existence character varying(50),
    office_type character varying(50),
    company_nature_of_business character varying(255),
    business_period character varying(100),
    establishment_period character varying(100),
    office_approx_area integer,
    staff_strength integer,
    staff_seen integer,
    met_person_name character varying(255),
    designation character varying(100),
    applicant_designation character varying(100),
    working_period character varying(100),
    working_status character varying(50),
    applicant_working_premises character varying(50),
    sitting_location character varying(255),
    current_company_name character varying(255),
    document_shown character varying(255),
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    old_office_shifted_period character varying(100),
    current_company_period character varying(100),
    premises_status character varying(50),
    name_of_met_person character varying(255),
    met_person_type character varying(50),
    met_person_confirmation character varying(50),
    applicant_working_status character varying(50),
    contact_person character varying(255),
    call_remark character varying(50),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    other_observation text,
    other_extra_remark text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    landmark3 text,
    landmark4 text,
    document_type text,
    name_of_tpc1 text,
    name_of_tpc2 text,
    verification_task_id uuid,
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_office_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_office_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text]))),
    CONSTRAINT chk_office_verification_office_area CHECK (((office_approx_area IS NULL) OR ((office_approx_area >= 1) AND (office_approx_area <= 100000)))),
    CONSTRAINT chk_office_verification_staff_seen CHECK (((staff_seen IS NULL) OR ((staff_seen >= 0) AND (staff_seen <= staff_strength)))),
    CONSTRAINT chk_office_verification_staff_strength CHECK (((staff_strength IS NULL) OR ((staff_strength >= 1) AND (staff_strength <= 10000))))
);


--
-- Name: TABLE "officeVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."officeVerificationReports" IS 'Comprehensive table for storing office verification form data from mobile app submissions';


--
-- Name: COLUMN "officeVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."officeVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "officeVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."officeVerificationReports".form_type IS 'Type of office verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "officeVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."officeVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "officeVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."officeVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "officeVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."officeVerificationReports".verification_task_id IS 'Links office verification report to specific verification task';


--
-- Name: COLUMN "officeVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."officeVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "officeVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."officeVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "officeVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."officeVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_metrics (
    id bigint NOT NULL,
    request_id character varying(255) NOT NULL,
    method character varying(10) NOT NULL,
    url text NOT NULL,
    status_code integer NOT NULL,
    response_time numeric(10,2) NOT NULL,
    memory_usage jsonb,
    user_id uuid,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE performance_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.performance_metrics IS 'Stores HTTP request performance metrics for monitoring';


--
-- Name: performance_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.performance_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: performance_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.performance_metrics_id_seq OWNED BY public.performance_metrics.id;


--
-- Name: performance_trends; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.performance_trends AS
 SELECT date_trunc('hour'::text, "timestamp") AS hour,
    avg(response_time) AS avg_response_time,
    max(response_time) AS max_response_time,
    count(*) AS request_count,
    count(
        CASE
            WHEN (status_code >= 400) THEN 1
            ELSE NULL::integer
        END) AS error_count
   FROM public.performance_metrics
  WHERE ("timestamp" > (now() - '24:00:00'::interval))
  GROUP BY (date_trunc('hour'::text, "timestamp"))
  ORDER BY (date_trunc('hour'::text, "timestamp"));


--
-- Name: pincodeAreas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."pincodeAreas" (
    "displayOrder" integer DEFAULT 1,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL,
    "pincodeId" integer,
    "areaId" integer,
    CONSTRAINT chk_pincode_areas_display_order CHECK ((("displayOrder" >= 1) AND ("displayOrder" <= 50)))
);


--
-- Name: TABLE "pincodeAreas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."pincodeAreas" IS 'Junction table linking pincodes with specific areas for granular rate configuration';


--
-- Name: COLUMN "pincodeAreas"."displayOrder"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."pincodeAreas"."displayOrder" IS 'Order for displaying areas (1-50)';


--
-- Name: pincodeAreas_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."pincodeAreas_temp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pincodeAreas_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."pincodeAreas_temp_id_seq" OWNED BY public."pincodeAreas".id;


--
-- Name: pincodes_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pincodes_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pincodes_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pincodes_temp_id_seq OWNED BY public.pincodes.id;


--
-- Name: productDocumentTypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."productDocumentTypes" (
    id integer NOT NULL,
    "productId" integer NOT NULL,
    "documentTypeId" integer NOT NULL,
    is_mandatory boolean DEFAULT false,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE "productDocumentTypes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."productDocumentTypes" IS 'Junction table mapping document types to products';


--
-- Name: productDocumentTypes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."productDocumentTypes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productDocumentTypes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."productDocumentTypes_id_seq" OWNED BY public."productDocumentTypes".id;


--
-- Name: productVerificationTypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."productVerificationTypes" (
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL,
    "productId" integer,
    "verificationTypeId" integer
);


--
-- Name: TABLE "productVerificationTypes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."productVerificationTypes" IS 'Junction table linking products with their available verification types';


--
-- Name: productVerificationTypes_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."productVerificationTypes_temp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productVerificationTypes_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."productVerificationTypes_temp_id_seq" OWNED BY public."productVerificationTypes".id;


--
-- Name: products_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_temp_id_seq OWNED BY public.products.id;


--
-- Name: propertyApfVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."propertyApfVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    landmark1 character varying(255),
    landmark2 character varying(255),
    landmark3 character varying(255),
    landmark4 character varying(255),
    property_type character varying(100),
    property_status character varying(50),
    property_ownership character varying(50),
    property_age integer,
    property_condition character varying(50),
    property_area numeric(10,2),
    property_value numeric(15,2),
    market_value numeric(15,2),
    apf_status character varying(50),
    apf_number character varying(100),
    apf_issue_date date,
    apf_expiry_date date,
    apf_issuing_authority character varying(255),
    apf_validity_status character varying(50),
    apf_amount numeric(15,2),
    apf_utilized_amount numeric(15,2),
    apf_balance_amount numeric(15,2),
    project_name character varying(255),
    project_status character varying(50),
    project_approval_status character varying(50),
    project_completion_percentage integer,
    total_units integer,
    completed_units integer,
    sold_units integer,
    available_units integer,
    possession_status character varying(50),
    builder_name character varying(255),
    builder_contact character varying(20),
    developer_name character varying(255),
    developer_contact character varying(20),
    builder_registration_number character varying(100),
    rera_registration_number character varying(100),
    loan_amount numeric(15,2),
    loan_purpose character varying(255),
    loan_status character varying(50),
    bank_name character varying(255),
    loan_account_number character varying(50),
    emi_amount numeric(10,2),
    met_person_name character varying(255),
    met_person_designation character varying(100),
    met_person_relation character varying(100),
    met_person_contact character varying(20),
    document_shown_status character varying(50),
    document_type character varying(255),
    document_verification_status character varying(50),
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    current_location character varying(255),
    premises_status character varying(50),
    entry_restriction_reason character varying(255),
    security_person_name character varying(255),
    security_confirmation character varying(50),
    contact_person character varying(255),
    call_remark character varying(50),
    legal_clearance character varying(50),
    title_clearance character varying(50),
    encumbrance_status character varying(50),
    litigation_status character varying(50),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    infrastructure_status character varying(100),
    road_connectivity character varying(100),
    other_observation text,
    property_concerns text,
    financial_concerns text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    building_status character varying(50),
    name_of_met_person character varying(255),
    met_person_confirmation character varying(50),
    construction_activity character varying(50),
    designation character varying(100),
    activity_stop_reason text,
    project_started_date date,
    project_completion_date date,
    total_wing integer,
    total_flats integer,
    staff_strength integer,
    staff_seen integer,
    company_name_board character varying(50),
    name_on_board character varying(255),
    total_buildings_in_project integer,
    total_flats_in_building integer,
    project_start_date date,
    project_end_date date,
    verification_task_id uuid,
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_property_apf_verification_completed_units CHECK (((completed_units IS NULL) OR ((completed_units >= 0) AND (completed_units <= total_units)))),
    CONSTRAINT chk_property_apf_verification_completion_percentage CHECK (((project_completion_percentage IS NULL) OR ((project_completion_percentage >= 0) AND (project_completion_percentage <= 100)))),
    CONSTRAINT chk_property_apf_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_property_apf_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text]))),
    CONSTRAINT chk_property_apf_verification_property_age CHECK (((property_age IS NULL) OR ((property_age >= 0) AND (property_age <= 100)))),
    CONSTRAINT chk_property_apf_verification_total_units CHECK (((total_units IS NULL) OR ((total_units >= 1) AND (total_units <= 10000))))
);


--
-- Name: TABLE "propertyApfVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."propertyApfVerificationReports" IS 'Comprehensive table for storing Property APF verification form data from mobile app submissions';


--
-- Name: COLUMN "propertyApfVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyApfVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "propertyApfVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyApfVerificationReports".form_type IS 'Type of Property APF verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "propertyApfVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyApfVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "propertyApfVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyApfVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "propertyApfVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyApfVerificationReports".verification_task_id IS 'Links property APF verification report to specific verification task';


--
-- Name: COLUMN "propertyApfVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyApfVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "propertyApfVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyApfVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "propertyApfVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyApfVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: propertyIndividualVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."propertyIndividualVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    landmark1 character varying(255),
    landmark2 character varying(255),
    landmark3 character varying(255),
    landmark4 character varying(255),
    property_type character varying(100),
    property_status character varying(50),
    property_ownership character varying(50),
    property_age integer,
    property_condition character varying(50),
    property_area numeric(10,2),
    property_value numeric(15,2),
    market_value numeric(15,2),
    construction_type character varying(100),
    owner_name character varying(255),
    owner_relation character varying(100),
    owner_age integer,
    owner_occupation character varying(255),
    owner_income numeric(12,2),
    years_of_residence integer,
    family_members integer,
    earning_members integer,
    property_documents character varying(255),
    document_verification_status character varying(50),
    title_clear_status character varying(50),
    mutation_status character varying(50),
    tax_payment_status character varying(50),
    met_person_name character varying(255),
    met_person_designation character varying(100),
    met_person_relation character varying(100),
    met_person_contact character varying(20),
    neighbor1_name character varying(255),
    neighbor1_confirmation character varying(50),
    neighbor2_name character varying(255),
    neighbor2_confirmation character varying(50),
    locality_reputation character varying(100),
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    current_location character varying(255),
    premises_status character varying(50),
    previous_owner_name character varying(255),
    entry_restriction_reason character varying(255),
    security_person_name character varying(255),
    security_confirmation character varying(50),
    contact_person character varying(255),
    call_remark character varying(50),
    legal_issues character varying(50),
    loan_against_property character varying(50),
    bank_name character varying(255),
    loan_amount numeric(15,2),
    emi_amount numeric(10,2),
    electricity_connection character varying(50),
    water_connection character varying(50),
    gas_connection character varying(50),
    internet_connection character varying(50),
    road_connectivity character varying(100),
    public_transport character varying(100),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    infrastructure_status character varying(100),
    safety_security character varying(100),
    other_observation text,
    property_concerns text,
    verification_challenges text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    property_location character varying(255),
    property_description text,
    construction_year integer,
    renovation_year integer,
    property_amenities text,
    individual_name character varying(255),
    individual_age integer,
    individual_occupation character varying(100),
    individual_income numeric(15,2),
    individual_education character varying(100),
    individual_marital_status character varying(50),
    individual_experience integer,
    employment_type character varying(100),
    employer_name character varying(255),
    employment_duration integer,
    monthly_income numeric(15,2),
    annual_income numeric(15,2),
    income_source character varying(100),
    business_name character varying(255),
    business_type character varying(100),
    business_experience integer,
    business_income numeric(15,2),
    verification_task_id uuid,
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_property_individual_verification_earning_members CHECK (((earning_members IS NULL) OR ((earning_members >= 0) AND (earning_members <= family_members)))),
    CONSTRAINT chk_property_individual_verification_family_members CHECK (((family_members IS NULL) OR ((family_members >= 1) AND (family_members <= 50)))),
    CONSTRAINT chk_property_individual_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_property_individual_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text]))),
    CONSTRAINT chk_property_individual_verification_owner_age CHECK (((owner_age IS NULL) OR ((owner_age >= 18) AND (owner_age <= 120)))),
    CONSTRAINT chk_property_individual_verification_property_age CHECK (((property_age IS NULL) OR ((property_age >= 0) AND (property_age <= 200))))
);


--
-- Name: TABLE "propertyIndividualVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."propertyIndividualVerificationReports" IS 'Comprehensive table for storing Property Individual verification form data from mobile app submissions';


--
-- Name: COLUMN "propertyIndividualVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyIndividualVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "propertyIndividualVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyIndividualVerificationReports".form_type IS 'Type of Property Individual verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "propertyIndividualVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyIndividualVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "propertyIndividualVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyIndividualVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "propertyIndividualVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyIndividualVerificationReports".verification_task_id IS 'Links property individual verification report to specific verification task';


--
-- Name: COLUMN "propertyIndividualVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyIndividualVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "propertyIndividualVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyIndividualVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "propertyIndividualVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."propertyIndividualVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: query_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_performance (
    id bigint NOT NULL,
    query_hash character varying(64) NOT NULL,
    query_text text NOT NULL,
    execution_time numeric(10,2) NOT NULL,
    rows_returned integer,
    rows_examined integer,
    query_plan jsonb,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE query_performance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.query_performance IS 'Stores database query performance data for optimization';


--
-- Name: query_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.query_performance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: query_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.query_performance_id_seq OWNED BY public.query_performance.id;


--
-- Name: rateHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."rateHistory" (
    "oldAmount" numeric(10,2),
    "newAmount" numeric(10,2) NOT NULL,
    "changeReason" text,
    "changedBy" uuid,
    "changedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    "rateId" bigint
);


--
-- Name: TABLE "rateHistory"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."rateHistory" IS 'Audit trail for rate changes';


--
-- Name: rateHistory_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."rateHistory_temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rateHistory_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."rateHistory_temp_id_seq" OWNED BY public."rateHistory".id;


--
-- Name: rateTypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."rateTypes" (
    name character varying(100) NOT NULL,
    description text,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id integer NOT NULL
);


--
-- Name: TABLE "rateTypes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."rateTypes" IS 'Rate types for verification services (Local, Local1, Local2, OGL, OGL1, OGL2, Outstation)';


--
-- Name: rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rates (
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    "isActive" boolean DEFAULT true,
    "effectiveFrom" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" timestamp with time zone,
    "createdBy" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    "clientId" integer,
    "productId" integer,
    "verificationTypeId" integer,
    "rateTypeId" integer,
    CONSTRAINT rates_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: TABLE rates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rates IS 'Actual rate amounts for assigned rate types';


--
-- Name: rateManagementView; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public."rateManagementView" AS
 SELECT r.id,
    r."clientId",
    c.name AS "clientName",
    c.code AS "clientCode",
    r."productId",
    p.name AS "productName",
    p.code AS "productCode",
    r."verificationTypeId",
    vt.name AS "verificationTypeName",
    vt.code AS "verificationTypeCode",
    r."rateTypeId",
    rt.name AS "rateTypeName",
    r.amount,
    r.currency,
    r."isActive",
    r."effectiveFrom",
    r."effectiveTo",
    r."createdAt",
    r."updatedAt"
   FROM ((((public.rates r
     JOIN public.clients c ON ((r."clientId" = c.id)))
     JOIN public.products p ON ((r."productId" = p.id)))
     JOIN public."verificationTypes" vt ON ((r."verificationTypeId" = vt.id)))
     JOIN public."rateTypes" rt ON ((r."rateTypeId" = rt.id)));


--
-- Name: rateTypeAssignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."rateTypeAssignments" (
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    "clientId" integer,
    "productId" integer,
    "verificationTypeId" integer,
    "rateTypeId" integer
);


--
-- Name: TABLE "rateTypeAssignments"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."rateTypeAssignments" IS 'Assignment of rate types to client-product-verification type combinations';


--
-- Name: rateTypeAssignmentView; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public."rateTypeAssignmentView" AS
 SELECT rta.id,
    rta."clientId",
    c.name AS "clientName",
    c.code AS "clientCode",
    rta."productId",
    p.name AS "productName",
    p.code AS "productCode",
    rta."verificationTypeId",
    vt.name AS "verificationTypeName",
    vt.code AS "verificationTypeCode",
    rta."rateTypeId",
    rt.name AS "rateTypeName",
    rta."isActive",
    rta."createdAt",
    rta."updatedAt"
   FROM ((((public."rateTypeAssignments" rta
     JOIN public.clients c ON ((rta."clientId" = c.id)))
     JOIN public.products p ON ((rta."productId" = p.id)))
     JOIN public."verificationTypes" vt ON ((rta."verificationTypeId" = vt.id)))
     JOIN public."rateTypes" rt ON ((rta."rateTypeId" = rt.id)));


--
-- Name: rateTypeAssignments_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."rateTypeAssignments_temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rateTypeAssignments_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."rateTypeAssignments_temp_id_seq" OWNED BY public."rateTypeAssignments".id;


--
-- Name: rateTypes_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."rateTypes_temp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rateTypes_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."rateTypes_temp_id_seq" OWNED BY public."rateTypes".id;


--
-- Name: rates_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rates_temp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rates_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rates_temp_id_seq OWNED BY public.rates.id;


--
-- Name: refreshTokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."refreshTokens" (
    "userId" uuid NOT NULL,
    token character varying(500) NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    id bigint NOT NULL,
    "ipAddress" character varying(50),
    "userAgent" text
);


--
-- Name: refreshTokens_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."refreshTokens_temp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refreshTokens_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."refreshTokens_temp_id_seq" OWNED BY public."refreshTokens".id;


--
-- Name: residenceCumOfficeVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."residenceCumOfficeVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    company_nameplate_status character varying(50),
    name_on_company_board character varying(255),
    door_nameplate_status character varying(50),
    name_on_door_plate character varying(255),
    society_nameplate_status character varying(50),
    name_on_society_board character varying(255),
    landmark1 character varying(255),
    landmark2 character varying(255),
    landmark3 character varying(255),
    landmark4 character varying(255),
    house_status character varying(50),
    met_person_name character varying(255),
    met_person_relation character varying(100),
    total_family_members integer,
    total_earning integer,
    applicant_dob date,
    applicant_age integer,
    staying_period character varying(100),
    staying_status character varying(50),
    approx_area integer,
    document_shown_status character varying(50),
    document_type character varying(255),
    office_status character varying(50),
    office_existence character varying(50),
    office_type character varying(50),
    designation character varying(100),
    applicant_designation character varying(100),
    working_period character varying(100),
    working_status character varying(50),
    applicant_working_premises character varying(50),
    sitting_location character varying(255),
    current_company_name character varying(255),
    company_nature_of_business character varying(255),
    business_period character varying(100),
    establishment_period character varying(100),
    staff_strength integer,
    staff_seen integer,
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    old_office_shifted_period character varying(100),
    current_company_period character varying(100),
    premises_status character varying(50),
    name_of_met_person character varying(255),
    met_person_type character varying(50),
    met_person_confirmation character varying(50),
    applicant_working_status character varying(50),
    applicant_staying_status character varying(50),
    contact_person character varying(255),
    call_remark character varying(50),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    other_observation text,
    other_extra_remark text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    staying_person_name character varying(255),
    verification_task_id uuid,
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_res_cum_office_verification_approx_area CHECK (((approx_area IS NULL) OR ((approx_area >= 1) AND (approx_area <= 100000)))),
    CONSTRAINT chk_res_cum_office_verification_family_members CHECK (((total_family_members IS NULL) OR ((total_family_members >= 1) AND (total_family_members <= 50)))),
    CONSTRAINT chk_res_cum_office_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_res_cum_office_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text]))),
    CONSTRAINT chk_res_cum_office_verification_staff_seen CHECK (((staff_seen IS NULL) OR ((staff_seen >= 0) AND (staff_seen <= staff_strength)))),
    CONSTRAINT chk_res_cum_office_verification_staff_strength CHECK (((staff_strength IS NULL) OR ((staff_strength >= 1) AND (staff_strength <= 10000))))
);


--
-- Name: TABLE "residenceCumOfficeVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."residenceCumOfficeVerificationReports" IS 'Comprehensive table for storing residence-cum-office verification form data from mobile app submissions';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".form_type IS 'Type of residence-cum-office verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".staying_person_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".staying_person_name IS 'Name of the person staying at the residence (different from met_person_name)';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".verification_task_id IS 'Links residence-cum-office verification report to specific verification task';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "residenceCumOfficeVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceCumOfficeVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: residenceVerificationReports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."residenceVerificationReports" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    form_type character varying(50) DEFAULT 'POSITIVE'::character varying NOT NULL,
    verification_outcome character varying(50) NOT NULL,
    customer_name character varying(255),
    customer_phone character varying(20),
    customer_email character varying(255),
    address_locatable character varying(50),
    address_rating character varying(50),
    full_address text,
    locality character varying(100),
    address_structure character varying(100),
    address_floor character varying(50),
    address_structure_color character varying(50),
    door_color character varying(50),
    door_nameplate_status character varying(50),
    name_on_door_plate character varying(255),
    society_nameplate_status character varying(50),
    name_on_society_board character varying(255),
    company_nameplate_status character varying(50),
    name_on_company_board character varying(255),
    landmark1 character varying(255),
    landmark2 character varying(255),
    landmark3 character varying(255),
    landmark4 character varying(255),
    house_status character varying(50),
    room_status character varying(50),
    met_person_name character varying(255),
    met_person_relation character varying(50),
    met_person_status character varying(50),
    staying_person_name character varying(255),
    total_family_members integer,
    total_earning numeric(15,2),
    applicant_dob date,
    applicant_age integer,
    working_status character varying(50),
    company_name character varying(255),
    staying_period character varying(100),
    staying_status character varying(50),
    approx_area integer,
    document_shown_status character varying(50),
    document_type character varying(50),
    tpc_met_person1 character varying(50),
    tpc_name1 character varying(255),
    tpc_confirmation1 character varying(50),
    tpc_met_person2 character varying(50),
    tpc_name2 character varying(255),
    tpc_confirmation2 character varying(50),
    shifted_period character varying(100),
    premises_status character varying(50),
    name_of_met_person character varying(255),
    met_person_type character varying(50),
    met_person_confirmation character varying(50),
    applicant_staying_status character varying(50),
    call_remark character varying(50),
    political_connection character varying(100),
    dominated_area character varying(100),
    feedback_from_neighbour character varying(100),
    other_observation text,
    final_status character varying(50) NOT NULL,
    hold_reason text,
    recommendation_status character varying(50),
    verification_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    verified_by uuid NOT NULL,
    remarks text,
    total_images integer DEFAULT 0,
    total_selfies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    verification_task_id uuid,
    report_sha256_hash text,
    report_server_signature text,
    report_generated_at timestamp with time zone,
    is_final boolean DEFAULT false,
    CONSTRAINT chk_residence_verification_age CHECK (((applicant_age IS NULL) OR ((applicant_age >= 0) AND (applicant_age <= 120)))),
    CONSTRAINT chk_residence_verification_family_members CHECK (((total_family_members IS NULL) OR ((total_family_members >= 1) AND (total_family_members <= 50)))),
    CONSTRAINT chk_residence_verification_final_status CHECK (((final_status)::text = ANY (ARRAY[('Positive'::character varying)::text, ('Negative'::character varying)::text, ('Refer'::character varying)::text, ('Fraud'::character varying)::text, ('Hold'::character varying)::text]))),
    CONSTRAINT chk_residence_verification_form_type CHECK (((form_type)::text = ANY (ARRAY[('POSITIVE'::character varying)::text, ('SHIFTED'::character varying)::text, ('NSP'::character varying)::text, ('ENTRY_RESTRICTED'::character varying)::text, ('UNTRACEABLE'::character varying)::text])))
);


--
-- Name: TABLE "residenceVerificationReports"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."residenceVerificationReports" IS 'Comprehensive table for all residence verification form types (Positive, Shifted, NSP, Entry Restricted, Untraceable)';


--
-- Name: COLUMN "residenceVerificationReports".case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".case_id IS 'UUID reference to the case being verified';


--
-- Name: COLUMN "residenceVerificationReports"."caseId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports"."caseId" IS 'Legacy integer case ID for backward compatibility';


--
-- Name: COLUMN "residenceVerificationReports".form_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".form_type IS 'Type of residence verification form: POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE';


--
-- Name: COLUMN "residenceVerificationReports".verification_outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".verification_outcome IS 'Maps to verification outcome from case (Positive & Door Locked, Shifted & Door Lock, etc.)';


--
-- Name: COLUMN "residenceVerificationReports".address_structure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".address_structure IS 'Type of address structure (Independent House, Apartment, etc.) - increased from 10 to 100 chars';


--
-- Name: COLUMN "residenceVerificationReports".address_floor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".address_floor IS 'Floor information (Ground Floor, 1st Floor, etc.) - increased from 10 to 50 chars';


--
-- Name: COLUMN "residenceVerificationReports".verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".verified_by IS 'UUID of the field agent who performed the verification';


--
-- Name: COLUMN "residenceVerificationReports".total_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".total_images IS 'Count of verification images (stored in verification_attachments table)';


--
-- Name: COLUMN "residenceVerificationReports".total_selfies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".total_selfies IS 'Count of selfie images (stored in verification_attachments table)';


--
-- Name: COLUMN "residenceVerificationReports".verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".verification_task_id IS 'Links residence verification report to specific verification task';


--
-- Name: COLUMN "residenceVerificationReports".report_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".report_sha256_hash IS 'SHA-256 hash of generated PDF report for tamper detection.';


--
-- Name: COLUMN "residenceVerificationReports".report_server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".report_server_signature IS 'HMAC-SHA256 signature of PDF. Prevents report regeneration attacks.';


--
-- Name: COLUMN "residenceVerificationReports".is_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."residenceVerificationReports".is_final IS 'TRUE = report is finalized and cannot be regenerated. Bank audit requirement.';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isSystemRole" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "createdBy" uuid,
    "updatedBy" uuid,
    id integer NOT NULL
);


--
-- Name: roles_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_temp_id_seq OWNED BY public.roles.id;


--
-- Name: scheduled_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    report_type character varying(50) NOT NULL,
    format character varying(20) NOT NULL,
    frequency character varying(20) NOT NULL,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb,
    options jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    last_run timestamp without time zone,
    next_run timestamp without time zone
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id character varying(255) NOT NULL,
    filename character varying(255) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    checksum character varying(64) NOT NULL,
    execution_time_ms integer,
    success boolean DEFAULT true
);


--
-- Name: security_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    user_id uuid,
    entity_type character varying(50),
    entity_id text,
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT security_audit_events_severity_check CHECK (((severity)::text = ANY ((ARRAY['CRITICAL'::character varying, 'HIGH'::character varying, 'MEDIUM'::character varying, 'LOW'::character varying, 'INFO'::character varying])::text[])))
);


--
-- Name: TABLE security_audit_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.security_audit_events IS 'Security event log with SIEM-compatible severity levels. Captures tampering attempts, hash mismatches, etc.';


--
-- Name: COLUMN security_audit_events.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.security_audit_events.event_type IS 'Event type: HASH_MISMATCH, GPS_MISMATCH, UPLOAD_TAMPERING, DEVICE_BLOCKED, etc.';


--
-- Name: COLUMN security_audit_events.severity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.security_audit_events.severity IS 'SIEM severity: CRITICAL (tampering), HIGH (hash fail), MEDIUM (GPS mismatch), LOW (warnings), INFO (normal).';


--
-- Name: service_zone_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_zone_rules (
    id integer NOT NULL,
    client_id integer,
    product_id integer,
    pincode_id integer NOT NULL,
    area_id integer,
    service_zone_id integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_zone_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_zone_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_zone_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_zone_rules_id_seq OWNED BY public.service_zone_rules.id;


--
-- Name: service_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_zones (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    sla_hours integer DEFAULT 48 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_zones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_zones_id_seq OWNED BY public.service_zones.id;


--
-- Name: slow_queries; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.slow_queries AS
 SELECT query_hash,
    query_text,
    avg(execution_time) AS avg_execution_time,
    max(execution_time) AS max_execution_time,
    count(*) AS execution_count,
    max("timestamp") AS last_execution
   FROM public.query_performance
  WHERE (execution_time > (100)::numeric)
  GROUP BY query_hash, query_text
  ORDER BY (avg(execution_time)) DESC;


--
-- Name: states_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.states_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: states_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.states_temp_id_seq OWNED BY public.states.id;


--
-- Name: system_health_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_health_metrics (
    id bigint NOT NULL,
    metric_name character varying(100) NOT NULL,
    metric_value numeric(15,4) NOT NULL,
    metric_unit character varying(20),
    tags jsonb,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE system_health_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_health_metrics IS 'System-level health and performance metrics';


--
-- Name: system_health_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_health_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_health_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_health_metrics_id_seq OWNED BY public.system_health_metrics.id;


--
-- Name: task_assignment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_assignment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verification_task_id uuid NOT NULL,
    case_id uuid NOT NULL,
    assigned_from uuid,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assignment_reason text,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    task_status_before character varying(20),
    task_status_after character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: task_form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verification_task_id uuid NOT NULL,
    case_id uuid NOT NULL,
    form_submission_id uuid NOT NULL,
    form_type character varying(50) NOT NULL,
    submitted_by uuid NOT NULL,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    validation_status character varying(20) DEFAULT 'PENDING'::character varying,
    validated_by uuid,
    validated_at timestamp without time zone,
    validation_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_validation_status CHECK (((validation_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('VALID'::character varying)::text, ('INVALID'::character varying)::text])))
);


--
-- Name: task_type_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.task_type_analytics AS
 SELECT vtt.name AS task_type_name,
    vtt.code AS task_type_code,
    vtt.category,
    count(vt.id) AS total_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'IN_PROGRESS'::text) THEN 1
            ELSE NULL::integer
        END) AS in_progress_tasks,
    count(
        CASE
            WHEN (((vt.status)::text = 'PENDING'::text) OR ((vt.status)::text = 'ASSIGNED'::text)) THEN 1
            ELSE NULL::integer
        END) AS pending_tasks,
    count(
        CASE
            WHEN ((vt.status)::text = 'CANCELLED'::text) THEN 1
            ELSE NULL::integer
        END) AS cancelled_tasks,
    round(
        CASE
            WHEN (count(vt.id) = 0) THEN (0)::numeric
            ELSE (((count(
            CASE
                WHEN ((vt.status)::text = 'COMPLETED'::text) THEN 1
                ELSE NULL::integer
            END))::numeric / (count(vt.id))::numeric) * (100)::numeric)
        END, 2) AS completion_rate_percentage,
    round(avg(vt.estimated_amount), 2) AS avg_estimated_amount,
    round(avg(vt.actual_amount), 2) AS avg_actual_amount,
    COALESCE(sum(vt.actual_amount), (0)::numeric) AS total_revenue,
    round(avg(
        CASE
            WHEN (((vt.status)::text = 'COMPLETED'::text) AND (vt.started_at IS NOT NULL)) THEN (EXTRACT(epoch FROM (vt.completed_at - vt.started_at)) / (3600)::numeric)
            ELSE NULL::numeric
        END), 2) AS avg_completion_time_hours,
    count(
        CASE
            WHEN (vt.created_at >= (CURRENT_DATE - '7 days'::interval)) THEN 1
            ELSE NULL::integer
        END) AS tasks_last_7_days,
    count(
        CASE
            WHEN (vt.created_at >= (CURRENT_DATE - '30 days'::interval)) THEN 1
            ELSE NULL::integer
        END) AS tasks_last_30_days
   FROM (public.verification_task_types vtt
     LEFT JOIN public.verification_tasks vt ON ((vtt.id = vt.verification_type_id)))
  GROUP BY vtt.id, vtt.name, vtt.code, vtt.category;


--
-- Name: template_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    submission_id character varying(255) NOT NULL,
    verification_type character varying(100) NOT NULL,
    outcome character varying(255) NOT NULL,
    report_content text NOT NULL,
    metadata jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE template_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.template_reports IS 'Stores template-based verification reports generated from form submissions';


--
-- Name: COLUMN template_reports.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.id IS 'Unique identifier for the template report';


--
-- Name: COLUMN template_reports.case_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.case_id IS 'Reference to the case this report belongs to';


--
-- Name: COLUMN template_reports.submission_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.submission_id IS 'Mobile app submission ID that this report was generated from';


--
-- Name: COLUMN template_reports.verification_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.verification_type IS 'Type of verification (RESIDENCE, BUSINESS, etc.)';


--
-- Name: COLUMN template_reports.outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.outcome IS 'Verification outcome (Positive, Negative, etc.)';


--
-- Name: COLUMN template_reports.report_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.report_content IS 'Generated template-based report content';


--
-- Name: COLUMN template_reports.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.metadata IS 'Additional metadata about the report generation';


--
-- Name: COLUMN template_reports.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.created_by IS 'User who generated the report';


--
-- Name: COLUMN template_reports.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.created_at IS 'Timestamp when the report was created';


--
-- Name: COLUMN template_reports.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.template_reports.updated_at IS 'Timestamp when the report was last updated';


--
-- Name: territoryAssignmentAudit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."territoryAssignmentAudit" (
    id bigint NOT NULL,
    "userId" uuid NOT NULL,
    "assignmentType" character varying(20) NOT NULL,
    "assignmentId" integer NOT NULL,
    action character varying(20) NOT NULL,
    "previousData" jsonb,
    "newData" jsonb NOT NULL,
    "performedBy" uuid NOT NULL,
    "performedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reason text,
    CONSTRAINT "territoryAssignmentAudit_action_check" CHECK (((action)::text = ANY (ARRAY[('ASSIGNED'::character varying)::text, ('UNASSIGNED'::character varying)::text, ('MODIFIED'::character varying)::text]))),
    CONSTRAINT "territoryAssignmentAudit_assignmentType_check" CHECK ((("assignmentType")::text = ANY (ARRAY[('PINCODE'::character varying)::text, ('AREA'::character varying)::text])))
);


--
-- Name: TABLE "territoryAssignmentAudit"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."territoryAssignmentAudit" IS 'Audit trail for all territory assignment changes and decisions';


--
-- Name: COLUMN "territoryAssignmentAudit"."assignmentType"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."territoryAssignmentAudit"."assignmentType" IS 'Type of assignment: PINCODE or AREA';


--
-- Name: COLUMN "territoryAssignmentAudit"."assignmentId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."territoryAssignmentAudit"."assignmentId" IS 'ID of the assignment record (userPincodeAssignments.id or userAreaAssignments.id)';


--
-- Name: COLUMN "territoryAssignmentAudit".action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."territoryAssignmentAudit".action IS 'Action performed: ASSIGNED, UNASSIGNED, or MODIFIED';


--
-- Name: COLUMN "territoryAssignmentAudit"."previousData"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."territoryAssignmentAudit"."previousData" IS 'JSON object containing the previous assignment data';


--
-- Name: COLUMN "territoryAssignmentAudit"."newData"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."territoryAssignmentAudit"."newData" IS 'JSON object containing the new assignment data';


--
-- Name: COLUMN "territoryAssignmentAudit".reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."territoryAssignmentAudit".reason IS 'Optional reason for the assignment change';


--
-- Name: territoryAssignmentAudit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."territoryAssignmentAudit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: territoryAssignmentAudit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."territoryAssignmentAudit_id_seq" OWNED BY public."territoryAssignmentAudit".id;


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    device_id text NOT NULL,
    device_model text,
    os_version text,
    first_seen_at timestamp with time zone DEFAULT now(),
    last_seen_at timestamp with time zone DEFAULT now(),
    is_blocked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE trusted_devices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.trusted_devices IS 'Tracks devices used by field agents. New devices require admin approval. User history retained even after account deletion.';


--
-- Name: COLUMN trusted_devices.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trusted_devices.user_id IS 'Owner of device. NULL if user account deleted but device history must be retained.';


--
-- Name: COLUMN trusted_devices.device_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trusted_devices.device_id IS 'Unique device identifier from Capacitor Device plugin.';


--
-- Name: COLUMN trusted_devices.is_blocked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trusted_devices.is_blocked IS 'Admin can block compromised/lost devices to prevent unauthorized access.';


--
-- Name: userAreaAssignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."userAreaAssignments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: userAreaAssignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."userAreaAssignments_id_seq" OWNED BY public."userAreaAssignments".id;


--
-- Name: userClientAssignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."userClientAssignments" (
    id integer NOT NULL,
    "userId" uuid NOT NULL,
    "clientId" integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" uuid
);


--
-- Name: TABLE "userClientAssignments"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."userClientAssignments" IS 'Junction table for assigning BACKEND users to specific clients for access control';


--
-- Name: COLUMN "userClientAssignments"."userId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userClientAssignments"."userId" IS 'Reference to the user being assigned to clients';


--
-- Name: COLUMN "userClientAssignments"."clientId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userClientAssignments"."clientId" IS 'Reference to the client the user has access to';


--
-- Name: COLUMN "userClientAssignments"."assignedAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userClientAssignments"."assignedAt" IS 'Timestamp when the assignment was made';


--
-- Name: COLUMN "userClientAssignments"."assignedBy"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userClientAssignments"."assignedBy" IS 'User who made the assignment';


--
-- Name: userClientAssignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."userClientAssignments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: userClientAssignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."userClientAssignments_id_seq" OWNED BY public."userClientAssignments".id;


--
-- Name: userPincodeAssignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."userPincodeAssignments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: userPincodeAssignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."userPincodeAssignments_id_seq" OWNED BY public."userPincodeAssignments".id;


--
-- Name: userProductAssignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."userProductAssignments" (
    id integer NOT NULL,
    "userId" uuid NOT NULL,
    "productId" integer NOT NULL,
    "assignedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE "userProductAssignments"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."userProductAssignments" IS 'Junction table for assigning BACKEND users to specific products for access control';


--
-- Name: COLUMN "userProductAssignments"."userId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userProductAssignments"."userId" IS 'Reference to the user being assigned to products';


--
-- Name: COLUMN "userProductAssignments"."productId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userProductAssignments"."productId" IS 'Reference to the product the user has access to';


--
-- Name: COLUMN "userProductAssignments"."assignedAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userProductAssignments"."assignedAt" IS 'Timestamp when the assignment was made';


--
-- Name: COLUMN "userProductAssignments"."assignedBy"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."userProductAssignments"."assignedBy" IS 'User who made the assignment';


--
-- Name: userProductAssignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."userProductAssignments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: userProductAssignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."userProductAssignments_id_seq" OWNED BY public."userProductAssignments".id;


--
-- Name: verificationTypes_temp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."verificationTypes_temp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verificationTypes_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."verificationTypes_temp_id_seq" OWNED BY public."verificationTypes".id;


--
-- Name: verification_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_attachments (
    id integer NOT NULL,
    case_id uuid NOT NULL,
    "caseId" integer,
    verification_type character varying(50) NOT NULL,
    filename character varying(255) NOT NULL,
    "originalName" character varying(255) NOT NULL,
    "mimeType" character varying(100) NOT NULL,
    "fileSize" integer NOT NULL,
    "filePath" character varying(500) NOT NULL,
    "thumbnailPath" character varying(500),
    "uploadedBy" uuid NOT NULL,
    "geoLocation" jsonb,
    "photoType" character varying(50) DEFAULT 'verification'::character varying,
    "submissionId" character varying(100),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    verification_task_id uuid,
    sha256_hash text,
    server_sha256_hash text,
    hash_verified boolean DEFAULT false,
    server_signature text,
    file_size_bytes bigint,
    capture_time timestamp with time zone,
    gps_latitude numeric(10,8),
    gps_longitude numeric(11,8),
    gps_validation_status character varying(20),
    gps_distance_meters numeric(10,2),
    device_id text,
    app_version text,
    exif_json jsonb,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    deletion_reason text
);


--
-- Name: TABLE verification_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.verification_attachments IS 'Stores verification images captured during mobile form submissions, separate from regular case attachments';


--
-- Name: COLUMN verification_attachments.verification_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.verification_type IS 'Type of verification: RESIDENCE, OFFICE, BUSINESS, etc.';


--
-- Name: COLUMN verification_attachments."geoLocation"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments."geoLocation" IS 'GPS coordinates where photo was taken';


--
-- Name: COLUMN verification_attachments."photoType"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments."photoType" IS 'Type of photo: verification, selfie';


--
-- Name: COLUMN verification_attachments."submissionId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments."submissionId" IS 'Links to specific verification form submission';


--
-- Name: COLUMN verification_attachments.verification_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.verification_task_id IS 'Links verification image/attachment to specific verification task';


--
-- Name: COLUMN verification_attachments.sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.sha256_hash IS 'Client-provided SHA-256 hash computed before upload. Used for transit verification.';


--
-- Name: COLUMN verification_attachments.server_sha256_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.server_sha256_hash IS 'Server-recalculated SHA-256 hash after upload. Primary evidence hash.';


--
-- Name: COLUMN verification_attachments.hash_verified; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.hash_verified IS 'TRUE if client hash matches server hash. Upload rejected if FALSE.';


--
-- Name: COLUMN verification_attachments.server_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.server_signature IS 'HMAC-SHA256 signature: HMAC(secret, server_sha256_hash + file_size_bytes + capture_time + device_id + verification_task_id). Tamper-proof seal.';


--
-- Name: COLUMN verification_attachments.file_size_bytes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.file_size_bytes IS 'Physical file size in bytes. Required for forensic fingerprint.';


--
-- Name: COLUMN verification_attachments.capture_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.capture_time IS 'Photo capture timestamp from EXIF or device. Distinct from upload time.';


--
-- Name: COLUMN verification_attachments.gps_latitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.gps_latitude IS 'GPS latitude from EXIF metadata. Weak evidence - cross-validate with device GPS.';


--
-- Name: COLUMN verification_attachments.gps_longitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.gps_longitude IS 'GPS longitude from EXIF metadata. Weak evidence - cross-validate with device GPS.';


--
-- Name: COLUMN verification_attachments.gps_validation_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.gps_validation_status IS 'GPS consistency check result: MATCH (< 100m), MISMATCH (> 100m), NO_EXIF_GPS.';


--
-- Name: COLUMN verification_attachments.gps_distance_meters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.gps_distance_meters IS 'Distance in meters between device GPS (geoLocation) and EXIF GPS.';


--
-- Name: COLUMN verification_attachments.device_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.device_id IS 'Unique device identifier that captured this photo.';


--
-- Name: COLUMN verification_attachments.app_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.app_version IS 'Mobile app version used to capture photo (e.g., "4.0.1").';


--
-- Name: COLUMN verification_attachments.exif_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.exif_json IS 'Full EXIF metadata dump for forensic analysis.';


--
-- Name: COLUMN verification_attachments.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.deleted_at IS 'Soft-delete timestamp. Forensic evidence should never be physically deleted.';


--
-- Name: COLUMN verification_attachments.deleted_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.deleted_by IS 'User who soft-deleted this attachment.';


--
-- Name: COLUMN verification_attachments.deletion_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verification_attachments.deletion_reason IS 'Reason for soft-deletion (e.g., "duplicate", "wrong photo", "quality issue").';


--
-- Name: verification_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verification_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verification_attachments_id_seq OWNED BY public.verification_attachments.id;


--
-- Name: verification_task_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verification_task_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_task_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_task_templates (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    category character varying(50),
    tasks jsonb NOT NULL,
    estimated_total_cost numeric(10,2),
    estimated_duration_days integer,
    usage_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    CONSTRAINT check_template_category CHECK (((category)::text = ANY (ARRAY[('INDIVIDUAL'::character varying)::text, ('BUSINESS'::character varying)::text, ('PROPERTY'::character varying)::text, ('FINANCIAL'::character varying)::text])))
);


--
-- Name: verification_task_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verification_task_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_task_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verification_task_templates_id_seq OWNED BY public.verification_task_templates.id;


--
-- Name: verification_task_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verification_task_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_task_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verification_task_types_id_seq OWNED BY public.verification_task_types.id;


--
-- Name: zone_rate_type_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone_rate_type_mapping (
    id integer NOT NULL,
    client_id integer NOT NULL,
    product_id integer NOT NULL,
    verification_type_id integer NOT NULL,
    service_zone_id integer NOT NULL,
    rate_type_id integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE zone_rate_type_mapping; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.zone_rate_type_mapping IS 'Deterministic mapping from Service Zone to Rate Type for billing. Ensures that for a given Client+Product+VerificationType+Zone, exactly one Rate Type is used for financial calculations.';


--
-- Name: zone_rate_type_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zone_rate_type_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zone_rate_type_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zone_rate_type_mapping_id_seq OWNED BY public.zone_rate_type_mapping.id;


--
-- Name: areas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas ALTER COLUMN id SET DEFAULT nextval('public.areas_temp_id_seq'::regclass);


--
-- Name: attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments ALTER COLUMN id SET DEFAULT nextval('public.attachments_temp_id_seq'::regclass);


--
-- Name: auditLogs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."auditLogs" ALTER COLUMN id SET DEFAULT nextval('public."auditLogs_temp_id_seq"'::regclass);


--
-- Name: autoSaves id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."autoSaves" ALTER COLUMN id SET DEFAULT nextval('public."autoSaves_temp_id_seq"'::regclass);


--
-- Name: backgroundSyncQueue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."backgroundSyncQueue" ALTER COLUMN id SET DEFAULT nextval('public."backgroundSyncQueue_temp_id_seq"'::regclass);


--
-- Name: caseDeduplicationAudit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."caseDeduplicationAudit" ALTER COLUMN id SET DEFAULT nextval('public."caseDeduplicationAudit_temp_id_seq"'::regclass);


--
-- Name: case_assignment_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history ALTER COLUMN id SET DEFAULT nextval('public.case_assignment_history_id_seq'::regclass);


--
-- Name: case_configuration_errors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_configuration_errors ALTER COLUMN id SET DEFAULT nextval('public.case_configuration_errors_id_seq'::regclass);


--
-- Name: cases caseId; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases ALTER COLUMN "caseId" SET DEFAULT nextval('public."cases_caseId_seq"'::regclass);


--
-- Name: cities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities ALTER COLUMN id SET DEFAULT nextval('public.cities_temp_id_seq'::regclass);


--
-- Name: clientDocumentTypes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientDocumentTypes" ALTER COLUMN id SET DEFAULT nextval('public."clientDocumentTypes_id_seq"'::regclass);


--
-- Name: clientProducts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientProducts" ALTER COLUMN id SET DEFAULT nextval('public."clientProducts_temp_id_seq"'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_temp_id_seq'::regclass);


--
-- Name: commission_batch_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_batch_items ALTER COLUMN id SET DEFAULT nextval('public.commission_batch_items_id_seq'::regclass);


--
-- Name: commission_calculations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations ALTER COLUMN id SET DEFAULT nextval('public.commission_calculations_id_seq'::regclass);


--
-- Name: commission_payment_batches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payment_batches ALTER COLUMN id SET DEFAULT nextval('public.commission_payment_batches_id_seq'::regclass);


--
-- Name: commission_rate_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rate_types ALTER COLUMN id SET DEFAULT nextval('public.commission_rate_types_id_seq'::regclass);


--
-- Name: countries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries ALTER COLUMN id SET DEFAULT nextval('public.countries_temp_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_temp_id_seq'::regclass);


--
-- Name: designations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations ALTER COLUMN id SET DEFAULT nextval('public.designations_temp_id_seq'::regclass);


--
-- Name: documentTypeRates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypeRates" ALTER COLUMN id SET DEFAULT nextval('public."documentTypeRates_id_seq"'::regclass);


--
-- Name: documentTypes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypes" ALTER COLUMN id SET DEFAULT nextval('public."documentTypes_id_seq"'::regclass);


--
-- Name: error_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs ALTER COLUMN id SET DEFAULT nextval('public.error_logs_id_seq'::regclass);


--
-- Name: field_user_commission_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_user_commission_assignments ALTER COLUMN id SET DEFAULT nextval('public.field_user_commission_assignments_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_temp_id_seq'::regclass);


--
-- Name: mobile_notification_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_notification_audit ALTER COLUMN id SET DEFAULT nextval('public.mobile_notification_audit_id_seq'::regclass);


--
-- Name: notificationTokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."notificationTokens" ALTER COLUMN id SET DEFAULT nextval('public."notificationTokens_temp_id_seq"'::regclass);


--
-- Name: performance_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_metrics ALTER COLUMN id SET DEFAULT nextval('public.performance_metrics_id_seq'::regclass);


--
-- Name: pincodeAreas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."pincodeAreas" ALTER COLUMN id SET DEFAULT nextval('public."pincodeAreas_temp_id_seq"'::regclass);


--
-- Name: pincodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pincodes ALTER COLUMN id SET DEFAULT nextval('public.pincodes_temp_id_seq'::regclass);


--
-- Name: productDocumentTypes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productDocumentTypes" ALTER COLUMN id SET DEFAULT nextval('public."productDocumentTypes_id_seq"'::regclass);


--
-- Name: productVerificationTypes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productVerificationTypes" ALTER COLUMN id SET DEFAULT nextval('public."productVerificationTypes_temp_id_seq"'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_temp_id_seq'::regclass);


--
-- Name: query_performance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_performance ALTER COLUMN id SET DEFAULT nextval('public.query_performance_id_seq'::regclass);


--
-- Name: rateHistory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateHistory" ALTER COLUMN id SET DEFAULT nextval('public."rateHistory_temp_id_seq"'::regclass);


--
-- Name: rateTypeAssignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypeAssignments" ALTER COLUMN id SET DEFAULT nextval('public."rateTypeAssignments_temp_id_seq"'::regclass);


--
-- Name: rateTypes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypes" ALTER COLUMN id SET DEFAULT nextval('public."rateTypes_temp_id_seq"'::regclass);


--
-- Name: rates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rates ALTER COLUMN id SET DEFAULT nextval('public.rates_temp_id_seq'::regclass);


--
-- Name: refreshTokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."refreshTokens" ALTER COLUMN id SET DEFAULT nextval('public."refreshTokens_temp_id_seq"'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_temp_id_seq'::regclass);


--
-- Name: service_zone_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_zone_rules ALTER COLUMN id SET DEFAULT nextval('public.service_zone_rules_id_seq'::regclass);


--
-- Name: service_zones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_zones ALTER COLUMN id SET DEFAULT nextval('public.service_zones_id_seq'::regclass);


--
-- Name: states id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states ALTER COLUMN id SET DEFAULT nextval('public.states_temp_id_seq'::regclass);


--
-- Name: system_health_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_health_metrics ALTER COLUMN id SET DEFAULT nextval('public.system_health_metrics_id_seq'::regclass);


--
-- Name: territoryAssignmentAudit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."territoryAssignmentAudit" ALTER COLUMN id SET DEFAULT nextval('public."territoryAssignmentAudit_id_seq"'::regclass);


--
-- Name: userAreaAssignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userAreaAssignments" ALTER COLUMN id SET DEFAULT nextval('public."userAreaAssignments_id_seq"'::regclass);


--
-- Name: userClientAssignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userClientAssignments" ALTER COLUMN id SET DEFAULT nextval('public."userClientAssignments_id_seq"'::regclass);


--
-- Name: userPincodeAssignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userPincodeAssignments" ALTER COLUMN id SET DEFAULT nextval('public."userPincodeAssignments_id_seq"'::regclass);


--
-- Name: userProductAssignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userProductAssignments" ALTER COLUMN id SET DEFAULT nextval('public."userProductAssignments_id_seq"'::regclass);


--
-- Name: verificationTypes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."verificationTypes" ALTER COLUMN id SET DEFAULT nextval('public."verificationTypes_temp_id_seq"'::regclass);


--
-- Name: verification_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_attachments ALTER COLUMN id SET DEFAULT nextval('public.verification_attachments_id_seq'::regclass);


--
-- Name: verification_task_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_task_templates ALTER COLUMN id SET DEFAULT nextval('public.verification_task_templates_id_seq'::regclass);


--
-- Name: verification_task_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_task_types ALTER COLUMN id SET DEFAULT nextval('public.verification_task_types_id_seq'::regclass);


--
-- Name: zone_rate_type_mapping id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_rate_type_mapping ALTER COLUMN id SET DEFAULT nextval('public.zone_rate_type_mapping_id_seq'::regclass);


--
-- Data for Name: agent_performance_daily; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_performance_daily (id, agent_id, date, cases_assigned, cases_completed, cases_in_progress, forms_submitted, residence_forms, office_forms, business_forms, attachments_uploaded, avg_completion_time_hours, quality_score, validation_success_rate, total_distance_km, active_hours, login_time, logout_time, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_reports (id, case_id, submission_id, report_data, generated_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: areas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.areas (name, "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attachments (filename, "originalName", "filePath", "fileSize", "mimeType", "uploadedBy", "createdAt", id, "caseId", case_id, verification_task_id) FROM stdin;
\.


--
-- Data for Name: auditLogs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."auditLogs" ("userId", action, "entityType", "entityId", "oldValues", "newValues", "ipAddress", "userAgent", "createdAt", id, details) FROM stdin;
\.


--
-- Data for Name: autoSaves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."autoSaves" ("userId", "formData", "createdAt", id, "caseId", case_id) FROM stdin;
\.


--
-- Data for Name: backgroundSyncQueue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."backgroundSyncQueue" ("userId", action, "entityType", "entityData", status, "retryCount", "errorMessage", "createdAt", "processedAt", id) FROM stdin;
\.


--
-- Data for Name: builderVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."builderVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, company_nameplate_status, name_on_company_board, landmark1, landmark2, office_status, office_existence, builder_type, company_nature_of_business, business_period, establishment_period, office_approx_area, staff_strength, staff_seen, met_person_name, designation, builder_name, builder_owner_name, working_period, working_status, document_shown, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, old_office_shifted_period, current_company_name, current_company_period, premises_status, name_of_met_person, met_person_type, met_person_confirmation, applicant_working_status, contact_person, call_remark, political_connection, dominated_area, feedback_from_neighbour, other_observation, other_extra_remark, final_status, hold_reason, recommendation_status, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, landmark3, landmark4, applicant_designation, verification_task_id, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: businessVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."businessVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, company_nameplate_status, name_on_company_board, landmark1, landmark2, business_status, business_existence, business_type, ownership_type, address_status, company_nature_of_business, business_period, establishment_period, business_approx_area, staff_strength, staff_seen, met_person_name, designation, name_of_company_owners, owner_name, business_owner_name, document_shown, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, old_business_shifted_period, current_company_name, current_company_period, premises_status, name_of_met_person, met_person_type, met_person_confirmation, applicant_working_status, contact_person, call_remark, political_connection, dominated_area, feedback_from_neighbour, other_observation, other_extra_remark, final_status, hold_reason, recommendation_status, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, business_activity, business_setup, applicant_designation, working_period, working_status, applicant_working_premises, document_type, name_of_tpc1, name_of_tpc2, verification_task_id, landmark3, landmark4, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: caseDeduplicationAudit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."caseDeduplicationAudit" ("searchCriteria", "duplicatesFound", "userDecision", rationale, "performedBy", "performedAt", id, "caseId", case_id) FROM stdin;
\.


--
-- Data for Name: case_assignment_conflicts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.case_assignment_conflicts (id, "caseId", "conflictType", "serverAssignedTo", "clientAssignedTo", "detectedAt", "resolvedAt", "resolvedBy", "resolutionStrategy", "resolutionData", status, metadata) FROM stdin;
\.


--
-- Data for Name: case_assignment_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.case_assignment_history (id, "previousAssignee", "newAssignee", reason, "assignedBy", "assignedAt", "createdAt", "caseId", case_id, "fromUserId", "toUserId", "assignedById", "batchId", metadata, "caseUUID") FROM stdin;
\.


--
-- Data for Name: case_assignment_queue_status; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.case_assignment_queue_status (id, "batchId", "jobId", "createdById", "assignedToId", status, "totalCases", "processedCases", "successfulAssignments", "failedAssignments", "startedAt", "completedAt", "createdAt", "updatedAt", errors, metadata) FROM stdin;
\.


--
-- Data for Name: case_configuration_errors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.case_configuration_errors (id, case_id, error_code, error_message, error_details, created_at, resolved_at, resolved_by) FROM stdin;
\.


--
-- Data for Name: case_status_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.case_status_history (id, "caseId", status, "transitionedAt", "transitionedBy", "transitionReason", "createdAt", "updatedAt", case_id) FROM stdin;
\.


--
-- Data for Name: case_timeline_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.case_timeline_events (id, case_id, event_type, event_category, performed_by, event_data, previous_value, new_value, event_description, is_system_generated, event_timestamp, created_at) FROM stdin;
\.


--
-- Data for Name: cases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cases ("clientId", "productId", "verificationTypeId", "cityId", pincode, status, priority, "createdAt", "updatedAt", "panNumber", "deduplicationChecked", "deduplicationDecision", "deduplicationRationale", "applicantType", "backendContactNumber", trigger, "caseId", "customerName", "customerCallingCode", "customerPhone", "verificationType", "createdByBackendUser", revokereason, revokedat, "revokeReason", "revokedAt", id, form_completion_percentage, quality_score, last_form_submitted_at, total_forms_required, forms_submitted_count, validation_issues_count, "verificationData", "verificationOutcome", "completedAt", "rateTypeId", has_multiple_tasks, total_tasks_count, completed_tasks_count, case_completion_percentage) FROM stdin;
\.


--
-- Data for Name: cities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cities (name, "createdAt", "updatedAt", id, "stateId", "countryId") FROM stdin;
\.


--
-- Data for Name: clientDocumentTypes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."clientDocumentTypes" (id, "clientId", "documentTypeId", is_mandatory, is_active, display_order, created_by, updated_by, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: clientProducts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."clientProducts" ("isActive", "createdAt", "updatedAt", id, "clientId", "productId") FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clients (name, code, email, phone, address, "isActive", "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: commission_batch_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commission_batch_items (id, batch_id, commission_id, amount, created_at) FROM stdin;
\.


--
-- Data for Name: commission_calculations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commission_calculations (id, case_id, case_number, user_id, client_id, rate_type_id, base_amount, commission_amount, calculated_commission, currency, calculation_method, status, case_completed_at, approved_by, approved_at, paid_by, paid_at, payment_method, transaction_id, rejection_reason, notes, created_at, updated_at, verification_task_id) FROM stdin;
\.


--
-- Data for Name: commission_payment_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commission_payment_batches (id, batch_number, total_amount, total_commissions, currency, payment_method, payment_date, status, created_by, processed_by, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: commission_rate_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commission_rate_types (id, rate_type_id, commission_amount, currency, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: countries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.countries (name, code, continent, "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (name, description, "departmentHeadId", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy", id, "parentDepartmentId") FROM stdin;
IT	Information Technology department responsible for system administration and technical support	\N	t	2025-08-13 21:31:44.431671+05:30	2025-08-13 21:31:44.431671+05:30	\N	\N	1	\N
Operations	Operations department handling day-to-day business operations and field activities	\N	t	2025-08-13 21:31:44.431671+05:30	2025-08-13 21:31:44.431671+05:30	\N	\N	2	\N
Field Agent Department	Department For Field User	\N	t	2025-08-14 16:07:42.952544+05:30	2026-02-21 20:47:46.817088+05:30	70dcf247-759c-405d-a8fb-4c78b7b77747	70dcf247-759c-405d-a8fb-4c78b7b77747	5	2
\.


--
-- Data for Name: designations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.designations (name, description, "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy", id, "departmentId") FROM stdin;
Manager	Manager For Multiple product access	t	2025-08-14 17:18:04.919487+05:30	2025-08-17 20:54:00.670391+05:30	70dcf247-759c-405d-a8fb-4c78b7b77747	70dcf247-759c-405d-a8fb-4c78b7b77747	3	2
Team Lead	Leads a team of developers	t	2025-08-14 12:35:44.546501+05:30	2025-08-17 20:54:00.670391+05:30	\N	70dcf247-759c-405d-a8fb-4c78b7b77747	4	2
Backend User	Handles day-to-day operations	t	2025-08-14 12:35:44.546501+05:30	2025-11-07 12:31:04.931824+05:30	\N	70dcf247-759c-405d-a8fb-4c78b7b77747	1	2
Field Agent	Handel Daily Field Verification Activity	t	2025-08-14 19:04:12.628982+05:30	2025-11-07 12:31:31.200151+05:30	70dcf247-759c-405d-a8fb-4c78b7b77747	70dcf247-759c-405d-a8fb-4c78b7b77747	2	2
Operation Head	Watch Daily Operation Activities	t	2025-11-07 12:32:27.790615+05:30	2025-11-07 12:32:27.790615+05:30	70dcf247-759c-405d-a8fb-4c78b7b77747	70dcf247-759c-405d-a8fb-4c78b7b77747	5	2
\.


--
-- Data for Name: documentTypeRates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."documentTypeRates" (id, "clientId", "productId", "documentTypeId", amount, currency, "isActive", "effectiveFrom", "effectiveTo", "createdBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: documentTypes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."documentTypes" (id, name, code, description, category, is_government_issued, requires_verification, validity_period_months, format_pattern, min_length, max_length, is_active, sort_order, created_by, updated_by, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: dsaConnectorVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."dsaConnectorVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, landmark1, landmark2, landmark3, landmark4, connector_type, connector_code, connector_name, connector_designation, connector_experience, connector_status, business_name, business_type, business_registration_number, business_establishment_year, office_type, office_area, office_rent, total_staff, sales_staff, support_staff, team_size, monthly_business_volume, average_monthly_sales, annual_turnover, monthly_income, commission_structure, payment_terms, bank_account_details, computer_systems, internet_connection, software_systems, pos_terminals, printer_scanner, license_status, license_number, license_expiry_date, compliance_status, audit_status, training_status, met_person_name, met_person_designation, met_person_relation, met_person_contact, business_operational, customer_footfall, business_hours, weekend_operations, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, current_location, premises_status, previous_business_name, entry_restriction_reason, security_person_name, security_confirmation, contact_person, call_remark, market_presence, competitor_analysis, market_reputation, customer_feedback, political_connection, dominated_area, feedback_from_neighbour, infrastructure_status, commercial_viability, other_observation, business_concerns, operational_challenges, growth_potential, final_status, hold_reason, recommendation_status, risk_assessment, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, verification_task_id, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: error_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.error_logs (id, error_type, error_message, stack_trace, request_id, user_id, url, additional_data, "timestamp") FROM stdin;
\.


--
-- Data for Name: field_user_commission_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.field_user_commission_assignments (id, user_id, rate_type_id, commission_amount, currency, client_id, is_active, effective_from, effective_to, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: form_quality_metrics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form_quality_metrics (id, form_submission_id, overall_quality_score, completeness_score, accuracy_score, photo_quality_score, timeliness_score, consistency_score, calculated_at, calculated_by, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: form_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form_submissions (id, case_id, verification_task_id, verification_type_id, form_type, submitted_by, submission_data, validation_status, validation_errors, photos_count, attachments_count, geo_location, submission_score, time_spent_minutes, device_info, network_quality, submitted_at, validated_at, validated_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: form_validation_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form_validation_logs (id, form_submission_id, field_name, field_value, is_valid, error_message, validation_rule, validated_at, validated_by, created_at) FROM stdin;
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.locations (latitude, longitude, accuracy, "recordedBy", "recordedAt", id, "caseId", case_id, verification_task_id) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, filename, "executedAt") FROM stdin;
001_complete_case_deduplication_system	001_complete_case_deduplication_system.sql	2025-08-18 02:06:06.410354+05:30
002_field_agent_territory_assignments	002_field_agent_territory_assignments.sql	2025-08-18 16:22:05.846255+05:30
003_add_attached_pincode_to_users	003_add_attached_pincode_to_users.sql	2025-08-19 12:18:21.137141+05:30
004_remove_attached_pincode_from_users	004_remove_attached_pincode_from_users.sql	2025-08-19 13:15:06.972817+05:30
004_add_missing_case_fields	004_add_missing_case_fields.sql	2025-08-19 15:16:36.38201+05:30
005_user_product_assignments_and_access_control	005_user_product_assignments_and_access_control.sql	2025-08-20 13:08:07.663682+05:30
006_update_cases_created_by_field	006_update_cases_created_by_field.sql	2025-08-22 00:50:01.380749+05:30
20250821_create_mobile_notification_audit	20250821_create_mobile_notification_audit.sql	2025-08-22 02:24:07.991872+05:30
007_add_revoke_columns	007_add_revoke_columns.sql	2025-08-25 14:28:12.061652+05:30
001_case_status_history	001_case_status_history.sql	2025-08-25 14:38:08.683716+05:30
002_add_revoke_columns	002_add_revoke_columns.sql	2025-08-25 14:38:08.695823+05:30
003_add_unassigned_status_support	003_add_unassigned_status_support.sql	2025-08-26 12:29:46.000007+05:30
20250831_standardize_cases_schema_v2	20250831_standardize_cases_schema_v2.sql	2025-09-01 01:14:42.653304+05:30
001_create_notifications_schema	001_create_notifications_schema.sql	2025-09-13 21:18:06.811471+05:30
\.


--
-- Data for Name: mobile_device_sync; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mobile_device_sync (id, "userId", "deviceId", "lastSyncAt", "appVersion", platform, "syncCount", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: mobile_notification_audit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mobile_notification_audit (id, "notificationId", "userId", "caseId", "notificationType", "notificationData", "sentAt", "deliveryStatus", "acknowledgedAt", metadata, "createdAt", "updatedAt", case_id) FROM stdin;
\.


--
-- Data for Name: mobile_notification_queue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mobile_notification_queue (id, "userId", "notificationType", title, message, data, status, "scheduledAt", "sentAt", "failedAt", "retryCount", "maxRetries", error, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: nocVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."nocVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, landmark1, landmark2, landmark3, landmark4, noc_status, noc_type, noc_number, noc_issue_date, noc_expiry_date, noc_issuing_authority, noc_validity_status, property_type, project_name, project_status, construction_status, project_approval_status, total_units, completed_units, sold_units, possession_status, builder_name, builder_contact, developer_name, developer_contact, builder_registration_number, met_person_name, met_person_designation, met_person_relation, met_person_contact, document_shown_status, document_type, document_verification_status, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, current_location, premises_status, entry_restriction_reason, security_person_name, security_confirmation, contact_person, call_remark, environmental_clearance, fire_safety_clearance, pollution_clearance, water_connection_status, electricity_connection_status, political_connection, dominated_area, feedback_from_neighbour, infrastructure_status, road_connectivity, other_observation, compliance_issues, regulatory_concerns, final_status, hold_reason, recommendation_status, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, verification_task_id, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: notificationTokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."notificationTokens" ("userId", token, platform, "isActive", "createdAt", id) FROM stdin;
\.


--
-- Data for Name: notification_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_batches (id, batch_name, batch_type, target_user_ids, target_roles, status, total_notifications, sent_notifications, failed_notifications, scheduled_at, started_at, completed_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notification_delivery_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_delivery_log (id, notification_id, delivery_method, attempt_number, delivery_status, error_code, error_message, device_id, platform, push_token_used, attempted_at, completed_at, response_data) FROM stdin;
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_preferences (id, user_id, case_assignment_enabled, case_assignment_push, case_assignment_websocket, case_reassignment_enabled, case_reassignment_push, case_reassignment_websocket, case_completion_enabled, case_completion_push, case_completion_websocket, case_revocation_enabled, case_revocation_push, case_revocation_websocket, system_notifications_enabled, system_notifications_push, system_notifications_websocket, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, created_at, updated_at) FROM stdin;
61af7c94-8077-44bf-a8dc-7a5e339f4626	70dcf247-759c-405d-a8fb-4c78b7b77747	t	t	t	t	t	t	t	f	t	t	f	t	t	t	t	f	22:00:00	08:00:00	2025-09-10 00:37:29.797233+05:30	2025-09-10 00:37:29.797233+05:30
\.


--
-- Data for Name: notification_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_tokens (id, user_id, device_id, platform, push_token, is_active, created_at, updated_at, last_used_at) FROM stdin;
35488734-ffa5-4a08-b361-a5e3ceb67468	70dcf247-759c-405d-a8fb-4c78b7b77747	test-device-123	ANDROID	test-fcm-token-123	t	2025-09-10 01:17:47.262132+05:30	2025-09-10 01:17:47.262132+05:30	2025-09-10 01:17:47.262132+05:30
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, message, type, case_id, case_number, data, action_url, action_type, is_read, read_at, delivery_status, sent_at, delivered_at, acknowledged_at, priority, expires_at, created_at, updated_at, task_id, task_number) FROM stdin;
\.


--
-- Data for Name: officeVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."officeVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, company_nameplate_status, name_on_company_board, landmark1, landmark2, office_status, office_existence, office_type, company_nature_of_business, business_period, establishment_period, office_approx_area, staff_strength, staff_seen, met_person_name, designation, applicant_designation, working_period, working_status, applicant_working_premises, sitting_location, current_company_name, document_shown, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, old_office_shifted_period, current_company_period, premises_status, name_of_met_person, met_person_type, met_person_confirmation, applicant_working_status, contact_person, call_remark, political_connection, dominated_area, feedback_from_neighbour, other_observation, other_extra_remark, final_status, hold_reason, recommendation_status, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, landmark3, landmark4, document_type, name_of_tpc1, name_of_tpc2, verification_task_id, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: performance_metrics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.performance_metrics (id, request_id, method, url, status_code, response_time, memory_usage, user_id, "timestamp") FROM stdin;
\.


--
-- Data for Name: pincodeAreas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."pincodeAreas" ("displayOrder", "createdAt", "updatedAt", id, "pincodeId", "areaId") FROM stdin;
\.


--
-- Data for Name: pincodes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pincodes (code, "createdAt", "updatedAt", id, "cityId") FROM stdin;
\.


--
-- Data for Name: productDocumentTypes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."productDocumentTypes" (id, "productId", "documentTypeId", is_mandatory, is_active, display_order, created_by, updated_by, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: productVerificationTypes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."productVerificationTypes" ("isActive", "createdAt", "updatedAt", id, "productId", "verificationTypeId") FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (name, code, description, "createdAt", "updatedAt", "isActive", id) FROM stdin;
\.


--
-- Data for Name: propertyApfVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."propertyApfVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, landmark1, landmark2, landmark3, landmark4, property_type, property_status, property_ownership, property_age, property_condition, property_area, property_value, market_value, apf_status, apf_number, apf_issue_date, apf_expiry_date, apf_issuing_authority, apf_validity_status, apf_amount, apf_utilized_amount, apf_balance_amount, project_name, project_status, project_approval_status, project_completion_percentage, total_units, completed_units, sold_units, available_units, possession_status, builder_name, builder_contact, developer_name, developer_contact, builder_registration_number, rera_registration_number, loan_amount, loan_purpose, loan_status, bank_name, loan_account_number, emi_amount, met_person_name, met_person_designation, met_person_relation, met_person_contact, document_shown_status, document_type, document_verification_status, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, current_location, premises_status, entry_restriction_reason, security_person_name, security_confirmation, contact_person, call_remark, legal_clearance, title_clearance, encumbrance_status, litigation_status, political_connection, dominated_area, feedback_from_neighbour, infrastructure_status, road_connectivity, other_observation, property_concerns, financial_concerns, final_status, hold_reason, recommendation_status, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, building_status, name_of_met_person, met_person_confirmation, construction_activity, designation, activity_stop_reason, project_started_date, project_completion_date, total_wing, total_flats, staff_strength, staff_seen, company_name_board, name_on_board, total_buildings_in_project, total_flats_in_building, project_start_date, project_end_date, verification_task_id, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: propertyIndividualVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."propertyIndividualVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, landmark1, landmark2, landmark3, landmark4, property_type, property_status, property_ownership, property_age, property_condition, property_area, property_value, market_value, construction_type, owner_name, owner_relation, owner_age, owner_occupation, owner_income, years_of_residence, family_members, earning_members, property_documents, document_verification_status, title_clear_status, mutation_status, tax_payment_status, met_person_name, met_person_designation, met_person_relation, met_person_contact, neighbor1_name, neighbor1_confirmation, neighbor2_name, neighbor2_confirmation, locality_reputation, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, current_location, premises_status, previous_owner_name, entry_restriction_reason, security_person_name, security_confirmation, contact_person, call_remark, legal_issues, loan_against_property, bank_name, loan_amount, emi_amount, electricity_connection, water_connection, gas_connection, internet_connection, road_connectivity, public_transport, political_connection, dominated_area, feedback_from_neighbour, infrastructure_status, safety_security, other_observation, property_concerns, verification_challenges, final_status, hold_reason, recommendation_status, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, property_location, property_description, construction_year, renovation_year, property_amenities, individual_name, individual_age, individual_occupation, individual_income, individual_education, individual_marital_status, individual_experience, employment_type, employer_name, employment_duration, monthly_income, annual_income, income_source, business_name, business_type, business_experience, business_income, verification_task_id, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: query_performance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.query_performance (id, query_hash, query_text, execution_time, rows_returned, rows_examined, query_plan, "timestamp") FROM stdin;
\.


--
-- Data for Name: rateHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."rateHistory" ("oldAmount", "newAmount", "changeReason", "changedBy", "changedAt", id, "rateId") FROM stdin;
\.


--
-- Data for Name: rateTypeAssignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."rateTypeAssignments" ("isActive", "createdAt", "updatedAt", id, "clientId", "productId", "verificationTypeId", "rateTypeId") FROM stdin;
\.


--
-- Data for Name: rateTypes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."rateTypes" (name, description, "isActive", "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rates (amount, currency, "isActive", "effectiveFrom", "effectiveTo", "createdBy", "createdAt", "updatedAt", id, "clientId", "productId", "verificationTypeId", "rateTypeId") FROM stdin;
\.


--
-- Data for Name: refreshTokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."refreshTokens" ("userId", token, "expiresAt", "createdAt", id, "ipAddress", "userAgent") FROM stdin;
\.


--
-- Data for Name: residenceCumOfficeVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."residenceCumOfficeVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, company_nameplate_status, name_on_company_board, door_nameplate_status, name_on_door_plate, society_nameplate_status, name_on_society_board, landmark1, landmark2, landmark3, landmark4, house_status, met_person_name, met_person_relation, total_family_members, total_earning, applicant_dob, applicant_age, staying_period, staying_status, approx_area, document_shown_status, document_type, office_status, office_existence, office_type, designation, applicant_designation, working_period, working_status, applicant_working_premises, sitting_location, current_company_name, company_nature_of_business, business_period, establishment_period, staff_strength, staff_seen, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, old_office_shifted_period, current_company_period, premises_status, name_of_met_person, met_person_type, met_person_confirmation, applicant_working_status, applicant_staying_status, contact_person, call_remark, political_connection, dominated_area, feedback_from_neighbour, other_observation, other_extra_remark, final_status, hold_reason, recommendation_status, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, staying_person_name, verification_task_id, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: residenceVerificationReports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."residenceVerificationReports" (id, case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone, customer_email, address_locatable, address_rating, full_address, locality, address_structure, address_floor, address_structure_color, door_color, door_nameplate_status, name_on_door_plate, society_nameplate_status, name_on_society_board, company_nameplate_status, name_on_company_board, landmark1, landmark2, landmark3, landmark4, house_status, room_status, met_person_name, met_person_relation, met_person_status, staying_person_name, total_family_members, total_earning, applicant_dob, applicant_age, working_status, company_name, staying_period, staying_status, approx_area, document_shown_status, document_type, tpc_met_person1, tpc_name1, tpc_confirmation1, tpc_met_person2, tpc_name2, tpc_confirmation2, shifted_period, premises_status, name_of_met_person, met_person_type, met_person_confirmation, applicant_staying_status, call_remark, political_connection, dominated_area, feedback_from_neighbour, other_observation, final_status, hold_reason, recommendation_status, verification_date, verification_time, verified_by, remarks, total_images, total_selfies, created_at, updated_at, verification_task_id, report_sha256_hash, report_server_signature, report_generated_at, is_final) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (name, description, permissions, "isSystemRole", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy", id) FROM stdin;
ADMIN	System Administrator with full access to all features	{"cases": {"read": true, "create": true, "delete": true, "update": true}, "roles": {"read": true, "create": true, "delete": true, "update": true}, "users": {"read": true, "create": true, "delete": true, "update": true}, "clients": {"read": true, "create": true, "delete": true, "update": true}, "reports": {"read": true, "create": true, "delete": true, "update": true}, "settings": {"read": true, "create": true, "delete": true, "update": true}, "locations": {"read": true, "create": true, "delete": true, "update": true}, "departments": {"read": true, "create": true, "delete": true, "update": true}}	t	t	2025-08-13 21:31:35.498523+05:30	2025-08-13 21:31:35.498523+05:30	\N	\N	1
MANAGER	Manager with team oversight and reporting capabilities	{"cases": {"read": true, "create": true, "delete": false, "update": true}, "roles": {"read": true, "create": false, "delete": false, "update": false}, "users": {"read": true, "create": true, "delete": false, "update": true}, "clients": {"read": true, "create": true, "delete": false, "update": true}, "reports": {"read": true, "create": true, "delete": false, "update": true}, "settings": {"read": true, "create": false, "delete": false, "update": false}, "locations": {"read": true, "create": true, "delete": false, "update": true}, "departments": {"read": true, "create": false, "delete": false, "update": false}}	t	t	2025-08-13 21:31:35.498523+05:30	2025-08-13 21:31:35.498523+05:30	\N	\N	2
FIELD_AGENT	Field agent with case management and client interaction capabilities	{"cases": {"read": true, "create": true, "delete": false, "update": true}, "roles": {"read": false, "create": false, "delete": false, "update": false}, "users": {"read": true, "create": false, "delete": false, "update": false}, "clients": {"read": true, "create": true, "delete": false, "update": true}, "reports": {"read": true, "create": false, "delete": false, "update": false}, "settings": {"read": false, "create": false, "delete": false, "update": false}, "locations": {"read": true, "create": false, "delete": false, "update": false}, "departments": {"read": true, "create": false, "delete": false, "update": false}}	t	t	2025-08-13 21:31:35.498523+05:30	2025-08-13 21:31:35.498523+05:30	\N	\N	3
SUPER_ADMIN	Emergency access with bypass of device/MAC checks	{}	t	t	2025-08-17 12:15:51.106654+05:30	2025-08-17 12:15:51.106654+05:30	\N	\N	6
Test Role	Testing role permission assignment functionality	{"cases": {"read": true, "create": false, "delete": false, "update": false}, "forms": {"read": false, "create": false, "delete": false, "update": false}, "roles": {"read": false, "create": false, "delete": false, "update": false}, "tasks": {"read": false, "create": false, "delete": false, "update": false}, "users": {"read": true, "create": false, "delete": false, "update": false}, "billing": {"read": false, "create": false, "delete": false, "update": false}, "clients": {"read": false, "create": false, "delete": false, "update": false}, "reports": {"read": false, "create": false, "delete": false, "update": false}, "products": {"read": false, "create": false, "delete": false, "update": false}, "settings": {"read": false, "create": false, "delete": false, "update": false}, "analytics": {"read": true, "create": false, "delete": false, "update": false}, "locations": {"read": false, "create": false, "delete": false, "update": false}, "commissions": {"read": false, "create": false, "delete": false, "update": false}, "departments": {"read": false, "create": false, "delete": false, "update": false}, "designations": {"read": false, "create": false, "delete": false, "update": false}, "document_types": {"read": false, "create": false, "delete": false, "update": false}, "rate_management": {"read": false, "create": false, "delete": false, "update": false}, "verification_types": {"read": false, "create": false, "delete": false, "update": false}}	f	t	2025-11-08 15:44:22.385606+05:30	2025-11-08 15:44:22.385606+05:30	70dcf247-759c-405d-a8fb-4c78b7b77747	\N	7
BACKEND_USER	Mis Executive	{"cases": {"read": true, "create": true, "delete": false, "update": true}, "forms": {"read": true, "create": true, "delete": false, "update": true}, "roles": {"read": false, "create": false, "delete": false, "update": false}, "tasks": {"read": true, "create": true, "delete": false, "update": true}, "users": {"read": false, "create": false, "delete": false, "update": false}, "billing": {"read": false, "create": false, "delete": false, "update": false}, "clients": {"read": false, "create": false, "delete": false, "update": false}, "reports": {"read": true, "create": true, "delete": true, "update": true}, "products": {"read": false, "create": false, "delete": false, "update": false}, "settings": {"read": false, "create": false, "delete": false, "update": false}, "analytics": {"read": false, "create": false, "delete": false, "update": false}, "locations": {"read": false, "create": false, "delete": false, "update": false}, "commissions": {"read": false, "create": false, "delete": false, "update": false}, "departments": {"read": false, "create": false, "delete": false, "update": false}, "designations": {"read": false, "create": false, "delete": false, "update": false}, "document_types": {"read": false, "create": false, "delete": false, "update": false}, "rate_management": {"read": false, "create": false, "delete": false, "update": false}, "verification_types": {"read": false, "create": false, "delete": false, "update": false}}	f	t	2025-08-14 18:51:14.505413+05:30	2025-11-08 16:32:51.506173+05:30	70dcf247-759c-405d-a8fb-4c78b7b77747	70dcf247-759c-405d-a8fb-4c78b7b77747	5
\.


--
-- Data for Name: scheduled_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scheduled_reports (id, name, report_type, format, frequency, recipients, filters, options, is_active, created_by, created_at, updated_at, last_run, next_run) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (id, filename, executed_at, checksum, execution_time_ms, success) FROM stdin;
001_create_verification_tasks	001_create_verification_tasks.sql	2025-09-25 17:14:00.740177	9f24fb20cb8f019b85e6048f8c04c92ac8a1a7d2bd3a217a1d5af403217d27d8	79	t
002_enhance_cases_and_templates	002_enhance_cases_and_templates.sql	2025-09-25 17:14:00.821276	7dc16d3070b2b6cfa97adcffd058fd9d8725abf58d4b991e4137c078efa3e960	24	t
003_create_views_and_analytics	003_create_views_and_analytics.sql	2025-09-25 17:14:00.847162	5d854bb43f8498daad1e2303d870446ca88a392a672c9f7d5db5f277bda32cc1	18	t
004_migrate_existing_data	004_migrate_existing_data.sql	2025-09-25 17:14:00.866016	318ed5867696c90d6b19f2a3f26b711b66080a800aab47358b0c72a78d73ffc2	5	t
005_fix_migration_function	005_fix_migration_function.sql	2025-09-25 17:16:19.399849	34762e782d7a5c513039afe6ee750d90163170d6997f9cce95d0985beb4bb431	14	t
006_fix_column_names	006_fix_column_names.sql	2025-09-25 17:18:09.53784	da7c2b655ff8bd4df0d7e56ff32674856edcb8a66f620430857a4fab86623c46	12	t
007_fix_trigger_function	007_fix_trigger_function.sql	2025-09-25 17:19:36.267436	b7da6dfe76da79fd6df927856e630b640a7572346da806263d40e45dbe142961	16	t
001_test_migration_system	001_test_migration_system.sql	2025-10-24 20:19:54.743773	b37a88176ac1237c738e4cc654dd6be923529140e7c3ea0f5c329605cdc7c97f	35	t
006_add_trigger_applicant_type_to_verification_tasks	006_add_trigger_applicant_type_to_verification_tasks.sql	2025-10-25 12:56:46.718347	8ba9e95c407f4649e6346968213d85e4a1082918f1b2611d1d7929e1b168d6fc	15	t
007_create_document_types_tables	007_create_document_types_tables.sql	2025-10-25 12:56:46.755077	bd431a27e0279b4461ffe5530d7123876b3ef431fe54f247d2f7d239ce5383b8	19	f
999_cleanup_test_migration	999_cleanup_test_migration.sql	2025-10-25 12:57:38.581022	6b344736b864bc4b05ccb646650b97fdf47bd11bd38a677b2e9879e49c6ee6e3	7	t
008_create_document_type_rates_table	008_create_document_type_rates_table.sql	2025-10-25 13:38:06.500964	742deeae460373342958145d61e5091b7c303696bcefd74443b3d6f40e665d77	43	t
009_add_task_linking_to_form_submissions	009_add_task_linking_to_form_submissions.sql	2025-10-25 18:43:31.47384	2e2301c0d7384366f4811230ce81be9188789fdc3d53fe7cc71b0625229ed907	67	t
007_add_task_revocation_fields	007_add_task_revocation_fields.sql	2025-11-22 17:35:47.148279	e0bdf30b13515868229f51104db5cd59bfaa2476ccd5433c3351754fb09fe8e5	96	t
008_fix_roles_updated_at_trigger	008_fix_roles_updated_at_trigger.sql	2025-11-22 17:35:47.247895	2d04ba4a449e022271dac604f9093d769933d609c9e59861fccdac5d95119d3a	4	t
009_add_revisit_task_fields	009_add_revisit_task_fields.sql	2025-11-22 17:35:47.266204	a0be05e0b2d09756b07beb3ba781330d8b08a73ed7f5b32781fbdce5388f2e21	14	f
001_add_saved_fields_to_verification_tasks	001_add_saved_fields_to_verification_tasks.sql	2025-12-02 13:41:49.260429	613101a9b4a0b0a760e9d6a3146fe9913c7756da3aac4aa2adbda6d773f8c8c8	14	t
002_update_case_status_trigger	002_update_case_status_trigger.sql	2025-12-02 13:41:49.268729	a682e5dff1589727ed1bdd5dd1638cfff64c77a3429ae4d392b3705c3c7b7fb4	2	t
003_fix_case_status_data	003_fix_case_status_data.sql	2025-12-02 13:41:49.304044	06227db6cd611f1688d3eba8e6ee4e5e9e33d48eeac21bb46f01d3a6548dde07	26	t
009_backfill_user_timestamps	009_backfill_user_timestamps.sql	2025-12-12 00:18:56.947285	f5697fb9b59c4755b112afa94785e40a905130b4a877af18865b05b9a0a20548	12	t
010_add_cascade_delete	010_add_cascade_delete.sql	2025-12-12 00:33:43.189075	1f8bdd4851c3e54a1ef6c3ceb925fb3ab33ca7b89f23ce85aff6dbd330063bc1	49	f
010_improve_user_deletion	010_improve_user_deletion.sql	2026-02-16 15:04:07.31331	141c69ba2ad70da0dc40d8afb464d6b844dfe49a2acc1b31ed049b9421aec823	68	t
011_fix_updated_at_trigger	011_fix_updated_at_trigger.sql	2026-02-16 15:04:07.320001	517aa11db8e1c249b3aa138862efa21176d59fdecdaf07a28b8fb4078eb7a675	5	t
012_fix_territory_unique_constraints	012_fix_territory_unique_constraints.sql	2026-02-16 15:04:07.322839	88bedb278855f99c42dd3d5364806e8c225249a965d6f114c483d7b79f905444	2	f
013_add_tat_tracking_fields	013_add_tat_tracking_fields.sql	2026-02-19 17:41:01.625287	1de14d548ca58ccf747cec1a20bc621e0e272486aeab0770b9d21204878c222e	36	t
014_update_task_status_constraint	014_update_task_status_constraint.sql	2026-02-19 17:41:01.62866	05c1d323738675056032a737548597fd83a138f2ce7efc327d46412eefef6a04	60	t
20260216_add_commission_idempotency	20260216_add_commission_idempotency.sql	2026-02-19 17:41:01.696676	dfe3be92c87677efca35f667e9262eef0c84b4132c76d624036cbca16b8705ef	6	f
015_unify_cancelled_to_revoked	015_unify_cancelled_to_revoked.sql	2026-02-19 17:51:23.001201	0ae8279ad855a61086f9583f628eacf2f5df9ebab32b6e40e222e0e5a15da138	56	t
20260216_add_config_quarantine	20260216_add_config_quarantine.sql	2026-02-19 17:51:23.060501	3caac56f872e9d87cb1382e066b1882c70a4080018c507ad49f7a3f31919e7b4	3	t
20260216_add_service_zones	20260216_add_service_zones.sql	2026-02-19 17:51:23.064012	b7c1b6da0c629e530de1ea7bde99b417d502e31d131e4b576ecac755b177110e	73	t
20260216_add_sla_indexes	20260216_add_sla_indexes.sql	2026-02-19 17:51:23.13781	e024596df896d69980de13ed0ec3d9b89b1f9aa1f6f49ee0e0b8fce3ca748001	2	t
20260216_add_zone_rate_mapping	20260216_add_zone_rate_mapping.sql	2026-02-19 17:51:23.140095	a0686025b1b49ad4546ca12f66f2444508276305f69aa34e351272b148c5aa1c	2	t
20260217_forensic_tamper_proofing	20260217_forensic_tamper_proofing.sql	2026-02-19 17:51:23.313504	bda85027e384affa09773b91516bf5b8a4174797d4810bc232bad8659075889a	172	t
20260217_stage1_task_evidence_linking	20260217_stage1_task_evidence_linking.sql	2026-02-19 17:51:23.351668	08f9dc437bd302fa1e6e5d92990e3c76d99a1cadb77fa6e384dad46f17f7192e	37	t
acs_db_complete_backup_20260216	acs_db_complete_backup_20260216.sql	2026-02-19 17:51:23.443387	ff831e52914e62e9d0795d69a2405fbd52ef755cff05f0a36b0a567dcd55bb0f	90	f
\.


--
-- Data for Name: security_audit_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.security_audit_events (id, event_type, severity, user_id, entity_type, entity_id, details, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: service_zone_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_zone_rules (id, client_id, product_id, pincode_id, area_id, service_zone_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: service_zones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_zones (id, name, sla_hours, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: states; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.states (name, code, "createdAt", "updatedAt", id, "countryId") FROM stdin;
\.


--
-- Data for Name: system_health_metrics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_health_metrics (id, metric_name, metric_value, metric_unit, tags, "timestamp") FROM stdin;
\.


--
-- Data for Name: task_assignment_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_assignment_history (id, verification_task_id, case_id, assigned_from, assigned_to, assigned_by, assignment_reason, assigned_at, task_status_before, task_status_after, created_at) FROM stdin;
\.


--
-- Data for Name: task_commission_calculations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_commission_calculations (id, verification_task_id, case_id, task_number, user_id, client_id, rate_type_id, base_amount, commission_amount, calculated_commission, currency, calculation_method, calculation_date, status, approved_by, approved_at, paid_by, paid_at, payment_method, transaction_id, rejection_reason, task_completed_at, verification_outcome, created_at, updated_at, created_by, notes) FROM stdin;
\.


--
-- Data for Name: task_form_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_form_submissions (id, verification_task_id, case_id, form_submission_id, form_type, submitted_by, submitted_at, validation_status, validated_by, validated_at, validation_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: template_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.template_reports (id, case_id, submission_id, verification_type, outcome, report_content, metadata, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: territoryAssignmentAudit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."territoryAssignmentAudit" (id, "userId", "assignmentType", "assignmentId", action, "previousData", "newData", "performedBy", "performedAt", reason) FROM stdin;
\.


--
-- Data for Name: trusted_devices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.trusted_devices (id, user_id, device_id, device_model, os_version, first_seen_at, last_seen_at, is_blocked, created_at) FROM stdin;
\.


--
-- Data for Name: userAreaAssignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."userAreaAssignments" (id, "userId", "pincodeId", "areaId", "userPincodeAssignmentId", "assignedBy", "assignedAt", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: userClientAssignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."userClientAssignments" (id, "userId", "clientId", "createdAt", "updatedAt", "assignedAt", "assignedBy") FROM stdin;
\.


--
-- Data for Name: userPincodeAssignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."userPincodeAssignments" (id, "userId", "pincodeId", "assignedBy", "assignedAt", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: userProductAssignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."userProductAssignments" (id, "userId", "productId", "assignedAt", "assignedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, username, password, "passwordHash", role, email, phone, "isActive", "lastLogin", "createdAt", "updatedAt", "employeeId", designation, department, "profilePhotoUrl", "roleId", "departmentId", "designationId", performance_rating, total_cases_handled, avg_case_completion_days, last_active_at, preferred_form_types, "deletedAt") FROM stdin;
70dcf247-759c-405d-a8fb-4c78b7b77747	System Administrator	admin	admin123	$2b$10$JByxggJzpqJMwWqn8M4brue56CE1WzsPgv5EFjPtopEqSt5rUFM6q	SUPER_ADMIN	\N	\N	t	2026-02-21 20:39:43.575385+05:30	2025-08-13 18:17:35.989427+05:30	2026-02-21 20:39:43.575385+05:30	EMP001	System Administrator	IT Administration	\N	6	2	\N	\N	0	\N	\N	\N	\N
\.


--
-- Data for Name: verificationTypes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."verificationTypes" (name, code, description, "createdAt", "updatedAt", "isActive", id) FROM stdin;
\.


--
-- Data for Name: verification_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_attachments (id, case_id, "caseId", verification_type, filename, "originalName", "mimeType", "fileSize", "filePath", "thumbnailPath", "uploadedBy", "geoLocation", "photoType", "submissionId", "createdAt", "updatedAt", verification_task_id, sha256_hash, server_sha256_hash, hash_verified, server_signature, file_size_bytes, capture_time, gps_latitude, gps_longitude, gps_validation_status, gps_distance_meters, device_id, app_version, exif_json, deleted_at, deleted_by, deletion_reason) FROM stdin;
\.


--
-- Data for Name: verification_task_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_task_templates (id, name, description, category, tasks, estimated_total_cost, estimated_duration_days, usage_count, is_active, created_at, updated_at, created_by) FROM stdin;
1	Standard Individual KYC	Complete KYC verification for individual customers	INDIVIDUAL	[{"title": "Verify Residential Address", "priority": "HIGH", "task_type": "RESIDENCE_ADDR"}, {"title": "Verify Identity Documents", "priority": "HIGH", "task_type": "DOCUMENT"}, {"title": "Verify Personal Identity", "priority": "MEDIUM", "task_type": "IDENTITY"}]	1500.00	3	0	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
2	Business Verification Package	Complete verification for business entities	BUSINESS	[{"title": "Verify Business Address", "priority": "HIGH", "task_type": "OFFICE_ADDR"}, {"title": "Verify Business Operations", "priority": "HIGH", "task_type": "BUSINESS"}, {"title": "Verify Business Documents", "priority": "MEDIUM", "task_type": "DOCUMENT"}]	2500.00	5	0	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
3	Property Verification Complete	Comprehensive property verification package	PROPERTY	[{"title": "Verify Property Address", "priority": "HIGH", "task_type": "RESIDENCE_ADDR"}, {"title": "Verify Property Documents", "priority": "HIGH", "task_type": "DOCUMENT"}, {"title": "Verify Property Business Use", "priority": "MEDIUM", "task_type": "BUSINESS"}]	2000.00	4	0	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
\.


--
-- Data for Name: verification_task_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_task_types (id, name, code, description, category, default_priority, estimated_duration_hours, requires_location, requires_documents, required_form_type, validation_rules, is_active, created_at, updated_at, created_by) FROM stdin;
1	Residence Address Verification	RESIDENCE_ADDR	Verify residential address and occupancy	ADDRESS	MEDIUM	24	t	f	RESIDENCE	\N	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
2	Office Address Verification	OFFICE_ADDR	Verify office/business address	ADDRESS	MEDIUM	24	t	f	OFFICE	\N	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
3	Document Verification	DOCUMENT	Verify authenticity of provided documents	DOCUMENT	MEDIUM	24	f	t	DOCUMENT	\N	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
4	Identity Verification	IDENTITY	Verify identity of the applicant	IDENTITY	MEDIUM	24	f	t	IDENTITY	\N	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
5	Business Verification	BUSINESS	Verify business operations and legitimacy	BUSINESS	MEDIUM	24	t	t	BUSINESS	\N	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
6	Bank Account Verification	BANK_ACCOUNT	Verify bank account details	FINANCIAL	MEDIUM	24	f	t	FINANCIAL	\N	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
7	Employment Verification	EMPLOYMENT	Verify employment status and details	EMPLOYMENT	MEDIUM	24	t	f	OFFICE	\N	t	2025-09-25 17:14:00.821276	2025-09-25 17:14:00.821276	\N
\.


--
-- Data for Name: verification_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_tasks (id, task_number, case_id, verification_type_id, task_title, task_description, priority, assigned_to, assigned_by, assigned_at, status, verification_outcome, rate_type_id, estimated_amount, actual_amount, address, pincode, latitude, longitude, document_type, document_number, document_details, estimated_completion_date, started_at, completed_at, created_at, updated_at, created_by, trigger, applicant_type, revoked_at, revoked_by, revocation_reason, cancelled_at, cancelled_by, cancellation_reason, task_type, parent_task_id, saved_at, is_saved, first_assigned_at, current_assigned_at, service_zone_id, forensic_version, device_id, app_version, submitted_at, reviewer_id, reviewed_at, review_notes) FROM stdin;
\.


--
-- Data for Name: zone_rate_type_mapping; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.zone_rate_type_mapping (id, client_id, product_id, verification_type_id, service_zone_id, rate_type_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Name: areas_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.areas_temp_id_seq', 1729, true);


--
-- Name: attachments_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attachments_temp_id_seq', 487, true);


--
-- Name: auditLogs_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."auditLogs_temp_id_seq"', 2909, true);


--
-- Name: autoSaves_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."autoSaves_temp_id_seq"', 1, false);


--
-- Name: backgroundSyncQueue_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."backgroundSyncQueue_temp_id_seq"', 1, false);


--
-- Name: caseDeduplicationAudit_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."caseDeduplicationAudit_temp_id_seq"', 1, false);


--
-- Name: case_assignment_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.case_assignment_history_id_seq', 31, true);


--
-- Name: case_configuration_errors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.case_configuration_errors_id_seq', 1, false);


--
-- Name: cases_caseId_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."cases_caseId_seq"', 12, true);


--
-- Name: cities_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cities_temp_id_seq', 6, true);


--
-- Name: clientDocumentTypes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."clientDocumentTypes_id_seq"', 8, true);


--
-- Name: clientProducts_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."clientProducts_temp_id_seq"', 27, true);


--
-- Name: clients_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clients_temp_id_seq', 12, true);


--
-- Name: commission_batch_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.commission_batch_items_id_seq', 1, false);


--
-- Name: commission_calculations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.commission_calculations_id_seq', 4, true);


--
-- Name: commission_payment_batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.commission_payment_batches_id_seq', 1, false);


--
-- Name: commission_rate_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.commission_rate_types_id_seq', 3, true);


--
-- Name: countries_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.countries_temp_id_seq', 3, true);


--
-- Name: departments_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.departments_temp_id_seq', 9, true);


--
-- Name: designations_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.designations_temp_id_seq', 5, true);


--
-- Name: documentTypeRates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."documentTypeRates_id_seq"', 2, true);


--
-- Name: documentTypes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."documentTypes_id_seq"', 10, true);


--
-- Name: error_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.error_logs_id_seq', 1, false);


--
-- Name: field_user_commission_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.field_user_commission_assignments_id_seq', 7, true);


--
-- Name: locations_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.locations_temp_id_seq', 12, true);


--
-- Name: mobile_notification_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mobile_notification_audit_id_seq', 1, false);


--
-- Name: notificationTokens_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."notificationTokens_temp_id_seq"', 1, false);


--
-- Name: performance_metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.performance_metrics_id_seq', 1, false);


--
-- Name: pincodeAreas_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."pincodeAreas_temp_id_seq"', 1784, true);


--
-- Name: pincodes_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pincodes_temp_id_seq', 430, true);


--
-- Name: productDocumentTypes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."productDocumentTypes_id_seq"', 1, false);


--
-- Name: productVerificationTypes_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."productVerificationTypes_temp_id_seq"', 31, true);


--
-- Name: products_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.products_temp_id_seq', 4, true);


--
-- Name: query_performance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.query_performance_id_seq', 1, false);


--
-- Name: rateHistory_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."rateHistory_temp_id_seq"', 1, true);


--
-- Name: rateTypeAssignments_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."rateTypeAssignments_temp_id_seq"', 30, true);


--
-- Name: rateTypes_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."rateTypes_temp_id_seq"', 8, true);


--
-- Name: rates_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rates_temp_id_seq', 27, true);


--
-- Name: refreshTokens_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."refreshTokens_temp_id_seq"', 426, true);


--
-- Name: roles_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_temp_id_seq', 7, true);


--
-- Name: service_zone_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_zone_rules_id_seq', 1, false);


--
-- Name: service_zones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_zones_id_seq', 6, true);


--
-- Name: states_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.states_temp_id_seq', 3, true);


--
-- Name: system_health_metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.system_health_metrics_id_seq', 1, false);


--
-- Name: territoryAssignmentAudit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."territoryAssignmentAudit_id_seq"', 1606, true);


--
-- Name: userAreaAssignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."userAreaAssignments_id_seq"', 589, true);


--
-- Name: userClientAssignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."userClientAssignments_id_seq"', 90, true);


--
-- Name: userPincodeAssignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."userPincodeAssignments_id_seq"', 270, true);


--
-- Name: userProductAssignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."userProductAssignments_id_seq"', 32, true);


--
-- Name: verificationTypes_temp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."verificationTypes_temp_id_seq"', 10, true);


--
-- Name: verification_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.verification_attachments_id_seq', 105, true);


--
-- Name: verification_task_number_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.verification_task_number_seq', 71, true);


--
-- Name: verification_task_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.verification_task_templates_id_seq', 3, true);


--
-- Name: verification_task_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.verification_task_types_id_seq', 7, true);


--
-- Name: zone_rate_type_mapping_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.zone_rate_type_mapping_id_seq', 1, false);


--
-- Name: agent_performance_daily agent_performance_daily_agent_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_performance_daily
    ADD CONSTRAINT agent_performance_daily_agent_id_date_key UNIQUE (agent_id, date);


--
-- Name: agent_performance_daily agent_performance_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_performance_daily
    ADD CONSTRAINT agent_performance_daily_pkey PRIMARY KEY (id);


--
-- Name: ai_reports ai_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reports
    ADD CONSTRAINT ai_reports_pkey PRIMARY KEY (id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: auditLogs auditLogs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."auditLogs"
    ADD CONSTRAINT "auditLogs_pkey" PRIMARY KEY (id);


--
-- Name: autoSaves autoSaves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."autoSaves"
    ADD CONSTRAINT "autoSaves_pkey" PRIMARY KEY (id);


--
-- Name: backgroundSyncQueue backgroundSyncQueue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."backgroundSyncQueue"
    ADD CONSTRAINT "backgroundSyncQueue_pkey" PRIMARY KEY (id);


--
-- Name: builderVerificationReports builderVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."builderVerificationReports"
    ADD CONSTRAINT "builderVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: businessVerificationReports businessVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."businessVerificationReports"
    ADD CONSTRAINT "businessVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: caseDeduplicationAudit caseDeduplicationAudit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."caseDeduplicationAudit"
    ADD CONSTRAINT "caseDeduplicationAudit_pkey" PRIMARY KEY (id);


--
-- Name: case_assignment_conflicts case_assignment_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_conflicts
    ADD CONSTRAINT case_assignment_conflicts_pkey PRIMARY KEY (id);


--
-- Name: case_assignment_history case_assignment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT case_assignment_history_pkey PRIMARY KEY (id);


--
-- Name: case_assignment_queue_status case_assignment_queue_status_batchId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_queue_status
    ADD CONSTRAINT "case_assignment_queue_status_batchId_key" UNIQUE ("batchId");


--
-- Name: case_assignment_queue_status case_assignment_queue_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_queue_status
    ADD CONSTRAINT case_assignment_queue_status_pkey PRIMARY KEY (id);


--
-- Name: case_configuration_errors case_configuration_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_configuration_errors
    ADD CONSTRAINT case_configuration_errors_pkey PRIMARY KEY (id);


--
-- Name: case_status_history case_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_history
    ADD CONSTRAINT case_status_history_pkey PRIMARY KEY (id);


--
-- Name: case_timeline_events case_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_timeline_events
    ADD CONSTRAINT case_timeline_events_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY ("caseId");


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: clientDocumentTypes clientDocumentTypes_clientId_documentTypeId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientDocumentTypes"
    ADD CONSTRAINT "clientDocumentTypes_clientId_documentTypeId_key" UNIQUE ("clientId", "documentTypeId");


--
-- Name: clientDocumentTypes clientDocumentTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientDocumentTypes"
    ADD CONSTRAINT "clientDocumentTypes_pkey" PRIMARY KEY (id);


--
-- Name: clientProducts clientProducts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientProducts"
    ADD CONSTRAINT "clientProducts_pkey" PRIMARY KEY (id);


--
-- Name: clients clients_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_code_key UNIQUE (code);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: commission_batch_items commission_batch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_batch_items
    ADD CONSTRAINT commission_batch_items_pkey PRIMARY KEY (id);


--
-- Name: commission_calculations commission_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_pkey PRIMARY KEY (id);


--
-- Name: commission_payment_batches commission_payment_batches_batch_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payment_batches
    ADD CONSTRAINT commission_payment_batches_batch_number_key UNIQUE (batch_number);


--
-- Name: commission_payment_batches commission_payment_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payment_batches
    ADD CONSTRAINT commission_payment_batches_pkey PRIMARY KEY (id);


--
-- Name: commission_rate_types commission_rate_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rate_types
    ADD CONSTRAINT commission_rate_types_pkey PRIMARY KEY (id);


--
-- Name: countries countries_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_code_key UNIQUE (code);


--
-- Name: countries countries_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_name_key UNIQUE (name);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: designations designations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_name_key UNIQUE (name);


--
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- Name: documentTypeRates documentTypeRates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypeRates"
    ADD CONSTRAINT "documentTypeRates_pkey" PRIMARY KEY (id);


--
-- Name: documentTypes documentTypes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypes"
    ADD CONSTRAINT "documentTypes_code_key" UNIQUE (code);


--
-- Name: documentTypes documentTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypes"
    ADD CONSTRAINT "documentTypes_pkey" PRIMARY KEY (id);


--
-- Name: dsaConnectorVerificationReports dsaConnectorVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."dsaConnectorVerificationReports"
    ADD CONSTRAINT "dsaConnectorVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: field_user_commission_assignments field_user_commission_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_user_commission_assignments
    ADD CONSTRAINT field_user_commission_assignments_pkey PRIMARY KEY (id);


--
-- Name: form_quality_metrics form_quality_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_quality_metrics
    ADD CONSTRAINT form_quality_metrics_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: form_validation_logs form_validation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_validation_logs
    ADD CONSTRAINT form_validation_logs_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: mobile_device_sync mobile_device_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_device_sync
    ADD CONSTRAINT mobile_device_sync_pkey PRIMARY KEY (id);


--
-- Name: mobile_device_sync mobile_device_sync_userId_deviceId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_device_sync
    ADD CONSTRAINT "mobile_device_sync_userId_deviceId_key" UNIQUE ("userId", "deviceId");


--
-- Name: mobile_notification_audit mobile_notification_audit_notificationId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_notification_audit
    ADD CONSTRAINT "mobile_notification_audit_notificationId_key" UNIQUE ("notificationId");


--
-- Name: mobile_notification_audit mobile_notification_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_notification_audit
    ADD CONSTRAINT mobile_notification_audit_pkey PRIMARY KEY (id);


--
-- Name: mobile_notification_queue mobile_notification_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_notification_queue
    ADD CONSTRAINT mobile_notification_queue_pkey PRIMARY KEY (id);


--
-- Name: nocVerificationReports nocVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."nocVerificationReports"
    ADD CONSTRAINT "nocVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: notificationTokens notificationTokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."notificationTokens"
    ADD CONSTRAINT "notificationTokens_pkey" PRIMARY KEY (id);


--
-- Name: notification_batches notification_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_batches
    ADD CONSTRAINT notification_batches_pkey PRIMARY KEY (id);


--
-- Name: notification_delivery_log notification_delivery_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_delivery_log
    ADD CONSTRAINT notification_delivery_log_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notification_tokens notification_tokens_device_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_device_id_platform_key UNIQUE (device_id, platform);


--
-- Name: notification_tokens notification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_pkey PRIMARY KEY (id);


--
-- Name: notificationTokens notification_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."notificationTokens"
    ADD CONSTRAINT notification_tokens_token_key UNIQUE (token);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: officeVerificationReports officeVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."officeVerificationReports"
    ADD CONSTRAINT "officeVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: performance_metrics performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_metrics
    ADD CONSTRAINT performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: pincodeAreas pincodeAreas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."pincodeAreas"
    ADD CONSTRAINT "pincodeAreas_pkey" PRIMARY KEY (id);


--
-- Name: pincodes pincodes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pincodes
    ADD CONSTRAINT pincodes_code_key UNIQUE (code);


--
-- Name: pincodes pincodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pincodes
    ADD CONSTRAINT pincodes_pkey PRIMARY KEY (id);


--
-- Name: productDocumentTypes productDocumentTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productDocumentTypes"
    ADD CONSTRAINT "productDocumentTypes_pkey" PRIMARY KEY (id);


--
-- Name: productDocumentTypes productDocumentTypes_productId_documentTypeId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productDocumentTypes"
    ADD CONSTRAINT "productDocumentTypes_productId_documentTypeId_key" UNIQUE ("productId", "documentTypeId");


--
-- Name: productVerificationTypes productVerificationTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productVerificationTypes"
    ADD CONSTRAINT "productVerificationTypes_pkey" PRIMARY KEY (id);


--
-- Name: products products_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_code_key UNIQUE (code);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: propertyApfVerificationReports propertyApfVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."propertyApfVerificationReports"
    ADD CONSTRAINT "propertyApfVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: propertyIndividualVerificationReports propertyIndividualVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."propertyIndividualVerificationReports"
    ADD CONSTRAINT "propertyIndividualVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: query_performance query_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_performance
    ADD CONSTRAINT query_performance_pkey PRIMARY KEY (id);


--
-- Name: rateHistory rateHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateHistory"
    ADD CONSTRAINT "rateHistory_pkey" PRIMARY KEY (id);


--
-- Name: rateTypeAssignments rateTypeAssignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypeAssignments"
    ADD CONSTRAINT "rateTypeAssignments_pkey" PRIMARY KEY (id);


--
-- Name: rateTypes rateTypes_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypes"
    ADD CONSTRAINT "rateTypes_name_key" UNIQUE (name);


--
-- Name: rateTypes rateTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypes"
    ADD CONSTRAINT "rateTypes_pkey" PRIMARY KEY (id);


--
-- Name: rates rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rates
    ADD CONSTRAINT rates_pkey PRIMARY KEY (id);


--
-- Name: refreshTokens refreshTokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."refreshTokens"
    ADD CONSTRAINT "refreshTokens_pkey" PRIMARY KEY (id);


--
-- Name: refreshTokens refresh_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."refreshTokens"
    ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);


--
-- Name: residenceCumOfficeVerificationReports residenceCumOfficeVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."residenceCumOfficeVerificationReports"
    ADD CONSTRAINT "residenceCumOfficeVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: residenceVerificationReports residenceVerificationReports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."residenceVerificationReports"
    ADD CONSTRAINT "residenceVerificationReports_pkey" PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: scheduled_reports scheduled_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: security_audit_events security_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_events
    ADD CONSTRAINT security_audit_events_pkey PRIMARY KEY (id);


--
-- Name: service_zone_rules service_zone_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_zone_rules
    ADD CONSTRAINT service_zone_rules_pkey PRIMARY KEY (id);


--
-- Name: service_zones service_zones_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_zones
    ADD CONSTRAINT service_zones_name_key UNIQUE (name);


--
-- Name: service_zones service_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_zones
    ADD CONSTRAINT service_zones_pkey PRIMARY KEY (id);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: system_health_metrics system_health_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_health_metrics
    ADD CONSTRAINT system_health_metrics_pkey PRIMARY KEY (id);


--
-- Name: task_assignment_history task_assignment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignment_history
    ADD CONSTRAINT task_assignment_history_pkey PRIMARY KEY (id);


--
-- Name: task_commission_calculations task_commission_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_commission_calculations
    ADD CONSTRAINT task_commission_calculations_pkey PRIMARY KEY (id);


--
-- Name: task_form_submissions task_form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_form_submissions
    ADD CONSTRAINT task_form_submissions_pkey PRIMARY KEY (id);


--
-- Name: template_reports template_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_reports
    ADD CONSTRAINT template_reports_pkey PRIMARY KEY (id);


--
-- Name: territoryAssignmentAudit territoryAssignmentAudit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."territoryAssignmentAudit"
    ADD CONSTRAINT "territoryAssignmentAudit_pkey" PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_user_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_device_id_key UNIQUE (user_id, device_id);


--
-- Name: commission_batch_items uk_commission_batch_items_commission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_batch_items
    ADD CONSTRAINT uk_commission_batch_items_commission UNIQUE (commission_id);


--
-- Name: field_user_commission_assignments uk_field_user_commission_assignments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_user_commission_assignments
    ADD CONSTRAINT uk_field_user_commission_assignments UNIQUE (user_id, rate_type_id, client_id, effective_from);


--
-- Name: userClientAssignments uk_user_client_assignments_user_client; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userClientAssignments"
    ADD CONSTRAINT uk_user_client_assignments_user_client UNIQUE ("userId", "clientId");


--
-- Name: userProductAssignments uk_user_product_assignments_user_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userProductAssignments"
    ADD CONSTRAINT uk_user_product_assignments_user_product UNIQUE ("userId", "productId");


--
-- Name: documentTypeRates unique_active_document_type_rate; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypeRates"
    ADD CONSTRAINT unique_active_document_type_rate UNIQUE ("clientId", "productId", "documentTypeId", "isActive") DEFERRABLE INITIALLY DEFERRED;


--
-- Name: commission_calculations unique_commission_per_task; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT unique_commission_per_task UNIQUE (verification_task_id);


--
-- Name: CONSTRAINT unique_commission_per_task ON commission_calculations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT unique_commission_per_task ON public.commission_calculations IS 'Ensures each verification task can generate commission only once. Prevents duplicate payouts from concurrent requests or retries.';


--
-- Name: task_commission_calculations unique_task_commission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_commission_calculations
    ADD CONSTRAINT unique_task_commission UNIQUE (verification_task_id, user_id);


--
-- Name: task_form_submissions unique_task_form_submission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_form_submissions
    ADD CONSTRAINT unique_task_form_submission UNIQUE (verification_task_id, form_submission_id);


--
-- Name: verification_tasks unique_task_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT unique_task_number UNIQUE (task_number);


--
-- Name: userAreaAssignments userAreaAssignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userAreaAssignments"
    ADD CONSTRAINT "userAreaAssignments_pkey" PRIMARY KEY (id);


--
-- Name: userClientAssignments userClientAssignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userClientAssignments"
    ADD CONSTRAINT "userClientAssignments_pkey" PRIMARY KEY (id);


--
-- Name: userPincodeAssignments userPincodeAssignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userPincodeAssignments"
    ADD CONSTRAINT "userPincodeAssignments_pkey" PRIMARY KEY (id);


--
-- Name: userProductAssignments userProductAssignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userProductAssignments"
    ADD CONSTRAINT "userProductAssignments_pkey" PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: verificationTypes verificationTypes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."verificationTypes"
    ADD CONSTRAINT "verificationTypes_code_key" UNIQUE (code);


--
-- Name: verificationTypes verificationTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."verificationTypes"
    ADD CONSTRAINT "verificationTypes_pkey" PRIMARY KEY (id);


--
-- Name: verification_attachments verification_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_attachments
    ADD CONSTRAINT verification_attachments_pkey PRIMARY KEY (id);


--
-- Name: verification_task_templates verification_task_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_task_templates
    ADD CONSTRAINT verification_task_templates_pkey PRIMARY KEY (id);


--
-- Name: verification_task_types verification_task_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_task_types
    ADD CONSTRAINT verification_task_types_code_key UNIQUE (code);


--
-- Name: verification_task_types verification_task_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_task_types
    ADD CONSTRAINT verification_task_types_name_key UNIQUE (name);


--
-- Name: verification_task_types verification_task_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_task_types
    ADD CONSTRAINT verification_task_types_pkey PRIMARY KEY (id);


--
-- Name: verification_tasks verification_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT verification_tasks_pkey PRIMARY KEY (id);


--
-- Name: zone_rate_type_mapping zone_rate_type_mapping_client_id_product_id_verification_ty_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_rate_type_mapping
    ADD CONSTRAINT zone_rate_type_mapping_client_id_product_id_verification_ty_key UNIQUE (client_id, product_id, verification_type_id, service_zone_id);


--
-- Name: zone_rate_type_mapping zone_rate_type_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_rate_type_mapping
    ADD CONSTRAINT zone_rate_type_mapping_pkey PRIMARY KEY (id);


--
-- Name: cases_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cases_id_unique ON public.cases USING btree (id);


--
-- Name: idx_agent_performance_daily_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_performance_daily_agent_id ON public.agent_performance_daily USING btree (agent_id);


--
-- Name: idx_agent_performance_daily_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_performance_daily_composite ON public.agent_performance_daily USING btree (agent_id, date);


--
-- Name: idx_agent_performance_daily_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_performance_daily_date ON public.agent_performance_daily USING btree (date);


--
-- Name: idx_agent_performance_daily_quality_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_performance_daily_quality_score ON public.agent_performance_daily USING btree (quality_score);


--
-- Name: idx_ai_reports_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_reports_case_id ON public.ai_reports USING btree (case_id);


--
-- Name: idx_ai_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_reports_created_at ON public.ai_reports USING btree (created_at);


--
-- Name: idx_ai_reports_generated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_reports_generated_by ON public.ai_reports USING btree (generated_by);


--
-- Name: idx_ai_reports_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_reports_submission_id ON public.ai_reports USING btree (submission_id);


--
-- Name: idx_ai_reports_unique_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ai_reports_unique_submission ON public.ai_reports USING btree (case_id, submission_id);


--
-- Name: idx_attachments_case_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_case_created ON public.attachments USING btree ("caseId", "createdAt");


--
-- Name: INDEX idx_attachments_case_created; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_attachments_case_created IS 'Performance index for attachments by case and date';


--
-- Name: idx_attachments_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_case_id ON public.attachments USING btree ("caseId");


--
-- Name: idx_attachments_case_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_case_uuid ON public.attachments USING btree (case_id);


--
-- Name: idx_attachments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_created_at ON public.attachments USING btree ("createdAt");


--
-- Name: idx_attachments_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_uploaded_by ON public.attachments USING btree ("uploadedBy");


--
-- Name: idx_attachments_verification_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_verification_task_id ON public.attachments USING btree (verification_task_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public."auditLogs" USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public."auditLogs" USING btree ("createdAt");


--
-- Name: idx_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity_id ON public."auditLogs" USING btree ("entityId");


--
-- Name: idx_audit_logs_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity_type ON public."auditLogs" USING btree ("entityType");


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public."auditLogs" USING btree ("userId");


--
-- Name: idx_autosaves_case_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autosaves_case_uuid ON public."autoSaves" USING btree (case_id);


--
-- Name: idx_background_sync_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_background_sync_queue_status ON public."backgroundSyncQueue" USING btree (status);


--
-- Name: idx_background_sync_queue_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_background_sync_queue_user_id ON public."backgroundSyncQueue" USING btree ("userId");


--
-- Name: idx_builder_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_reports_task_id ON public."builderVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_builder_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_case_id ON public."builderVerificationReports" USING btree (case_id);


--
-- Name: idx_builder_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_customer_name ON public."builderVerificationReports" USING btree (customer_name);


--
-- Name: idx_builder_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_customer_phone ON public."builderVerificationReports" USING btree (customer_phone);


--
-- Name: idx_builder_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_final_status ON public."builderVerificationReports" USING btree (final_status);


--
-- Name: idx_builder_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_form_type ON public."builderVerificationReports" USING btree (form_type);


--
-- Name: idx_builder_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_legacy_case_id ON public."builderVerificationReports" USING btree ("caseId");


--
-- Name: idx_builder_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_locality ON public."builderVerificationReports" USING btree (locality);


--
-- Name: idx_builder_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_outcome ON public."builderVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_builder_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_verification_date ON public."builderVerificationReports" USING btree (verification_date);


--
-- Name: idx_builder_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builder_verification_verified_by ON public."builderVerificationReports" USING btree (verified_by);


--
-- Name: idx_business_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_reports_task_id ON public."businessVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_business_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_case_id ON public."businessVerificationReports" USING btree (case_id);


--
-- Name: idx_business_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_customer_name ON public."businessVerificationReports" USING btree (customer_name);


--
-- Name: idx_business_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_customer_phone ON public."businessVerificationReports" USING btree (customer_phone);


--
-- Name: idx_business_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_final_status ON public."businessVerificationReports" USING btree (final_status);


--
-- Name: idx_business_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_form_type ON public."businessVerificationReports" USING btree (form_type);


--
-- Name: idx_business_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_legacy_case_id ON public."businessVerificationReports" USING btree ("caseId");


--
-- Name: idx_business_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_locality ON public."businessVerificationReports" USING btree (locality);


--
-- Name: idx_business_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_outcome ON public."businessVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_business_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_verification_date ON public."businessVerificationReports" USING btree (verification_date);


--
-- Name: idx_business_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_verification_verified_by ON public."businessVerificationReports" USING btree (verified_by);


--
-- Name: idx_case_assignment_conflicts_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_conflicts_case_id ON public.case_assignment_conflicts USING btree ("caseId");


--
-- Name: idx_case_assignment_conflicts_detected_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_conflicts_detected_at ON public.case_assignment_conflicts USING btree ("detectedAt");


--
-- Name: idx_case_assignment_conflicts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_conflicts_status ON public.case_assignment_conflicts USING btree (status);


--
-- Name: idx_case_assignment_history_assigned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_history_assigned_at ON public.case_assignment_history USING btree ("assignedAt");


--
-- Name: idx_case_assignment_history_assigned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_history_assigned_by ON public.case_assignment_history USING btree ("assignedById");


--
-- Name: idx_case_assignment_history_batch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_history_batch_id ON public.case_assignment_history USING btree ("batchId") WHERE ("batchId" IS NOT NULL);


--
-- Name: idx_case_assignment_history_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_history_case_id ON public.case_assignment_history USING btree ("caseId");


--
-- Name: idx_case_assignment_history_case_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_history_case_uuid ON public.case_assignment_history USING btree (case_id);


--
-- Name: idx_case_assignment_history_from_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_history_from_user ON public.case_assignment_history USING btree ("fromUserId");


--
-- Name: idx_case_assignment_history_to_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_history_to_user ON public.case_assignment_history USING btree ("toUserId");


--
-- Name: idx_case_assignment_queue_status_batch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_queue_status_batch_id ON public.case_assignment_queue_status USING btree ("batchId");


--
-- Name: idx_case_assignment_queue_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_queue_status_created_at ON public.case_assignment_queue_status USING btree ("createdAt");


--
-- Name: idx_case_assignment_queue_status_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_queue_status_created_by ON public.case_assignment_queue_status USING btree ("createdById");


--
-- Name: idx_case_assignment_queue_status_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_queue_status_job_id ON public.case_assignment_queue_status USING btree ("jobId");


--
-- Name: idx_case_assignment_queue_status_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignment_queue_status_status ON public.case_assignment_queue_status USING btree (status);


--
-- Name: idx_case_config_errors_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_config_errors_case_id ON public.case_configuration_errors USING btree (case_id);


--
-- Name: idx_case_config_errors_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_config_errors_unresolved ON public.case_configuration_errors USING btree (case_id) WHERE (resolved_at IS NULL);


--
-- Name: idx_case_deduplication_audit_duplicates_found; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_deduplication_audit_duplicates_found ON public."caseDeduplicationAudit" USING gin ("duplicatesFound");


--
-- Name: idx_case_deduplication_audit_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_deduplication_audit_performed_at ON public."caseDeduplicationAudit" USING btree ("performedAt");


--
-- Name: idx_case_deduplication_audit_performed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_deduplication_audit_performed_by ON public."caseDeduplicationAudit" USING btree ("performedBy");


--
-- Name: idx_case_deduplication_audit_search_criteria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_deduplication_audit_search_criteria ON public."caseDeduplicationAudit" USING gin ("searchCriteria");


--
-- Name: idx_case_deduplication_audit_user_decision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_deduplication_audit_user_decision ON public."caseDeduplicationAudit" USING btree ("userDecision");


--
-- Name: idx_case_status_history_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_status_history_case_id ON public.case_status_history USING btree ("caseId");


--
-- Name: idx_case_status_history_case_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_status_history_case_uuid ON public.case_status_history USING btree (case_id);


--
-- Name: idx_case_status_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_status_history_status ON public.case_status_history USING btree (status);


--
-- Name: idx_case_status_history_transitioned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_status_history_transitioned_at ON public.case_status_history USING btree ("transitionedAt");


--
-- Name: idx_case_timeline_events_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_timeline_events_case_id ON public.case_timeline_events USING btree (case_id);


--
-- Name: idx_case_timeline_events_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_timeline_events_composite ON public.case_timeline_events USING btree (case_id, event_timestamp);


--
-- Name: idx_case_timeline_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_timeline_events_event_type ON public.case_timeline_events USING btree (event_type);


--
-- Name: idx_case_timeline_events_performed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_timeline_events_performed_by ON public.case_timeline_events USING btree (performed_by);


--
-- Name: idx_case_timeline_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_timeline_events_timestamp ON public.case_timeline_events USING btree (event_timestamp);


--
-- Name: idx_casededuplicationaudit_case_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_casededuplicationaudit_case_uuid ON public."caseDeduplicationAudit" USING btree (case_id);


--
-- Name: idx_cases_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_case_id ON public.cases USING btree ("caseId");


--
-- Name: idx_cases_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_client_id ON public.cases USING btree ("clientId");


--
-- Name: idx_cases_client_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_client_status ON public.cases USING btree ("clientId", status);


--
-- Name: idx_cases_completion_percentage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_completion_percentage ON public.cases USING btree (case_completion_percentage);


--
-- Name: idx_cases_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_created_at ON public.cases USING btree ("createdAt");


--
-- Name: idx_cases_created_by_backend_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_created_by_backend_user ON public.cases USING btree ("createdByBackendUser");


--
-- Name: idx_cases_created_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_created_status ON public.cases USING btree ("createdAt", status);


--
-- Name: idx_cases_customer_name_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_customer_name_gin ON public.cases USING gin (to_tsvector('english'::regconfig, ("customerName")::text));


--
-- Name: idx_cases_customer_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_customer_name_search ON public.cases USING gin (to_tsvector('english'::regconfig, ("customerName")::text));


--
-- Name: idx_cases_customer_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_customer_name_trgm ON public.cases USING gin ("customerName" public.gin_trgm_ops);


--
-- Name: idx_cases_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_customer_phone ON public.cases USING btree ("customerPhone") WHERE ("customerPhone" IS NOT NULL);


--
-- Name: idx_cases_deduplication_fields; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_deduplication_fields ON public.cases USING btree ("panNumber", "customerPhone");


--
-- Name: idx_cases_form_completion_percentage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_form_completion_percentage ON public.cases USING btree (form_completion_percentage);


--
-- Name: idx_cases_has_multiple_tasks; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_has_multiple_tasks ON public.cases USING btree (has_multiple_tasks);


--
-- Name: idx_cases_last_form_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_last_form_submitted_at ON public.cases USING btree (last_form_submitted_at);


--
-- Name: idx_cases_pan_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_pan_number ON public.cases USING btree ("panNumber") WHERE ("panNumber" IS NOT NULL);


--
-- Name: idx_cases_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_priority ON public.cases USING btree (priority);


--
-- Name: idx_cases_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_product_id ON public.cases USING btree ("productId");


--
-- Name: idx_cases_quality_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_quality_score ON public.cases USING btree (quality_score);


--
-- Name: idx_cases_rate_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_rate_type_id ON public.cases USING btree ("rateTypeId");


--
-- Name: idx_cases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_status ON public.cases USING btree (status);


--
-- Name: idx_cases_total_tasks_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_total_tasks_count ON public.cases USING btree (total_tasks_count);


--
-- Name: idx_cases_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_updated_at ON public.cases USING btree ("updatedAt");


--
-- Name: idx_cases_verification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_verification_type ON public.cases USING btree ("verificationType") WHERE ("verificationType" IS NOT NULL);


--
-- Name: idx_cases_verification_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_verification_type_id ON public.cases USING btree ("verificationTypeId");


--
-- Name: idx_cities_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cities_name ON public.cities USING btree (name);


--
-- Name: idx_cities_state_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cities_state_id ON public.cities USING btree ("stateId");


--
-- Name: idx_client_document_types_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_document_types_active ON public."clientDocumentTypes" USING btree (is_active);


--
-- Name: idx_client_document_types_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_document_types_client ON public."clientDocumentTypes" USING btree ("clientId");


--
-- Name: idx_client_document_types_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_document_types_document ON public."clientDocumentTypes" USING btree ("documentTypeId");


--
-- Name: idx_client_products_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_products_client_id ON public."clientProducts" USING btree ("clientId");


--
-- Name: idx_client_products_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_products_product_id ON public."clientProducts" USING btree ("productId");


--
-- Name: idx_clients_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_code ON public.clients USING btree (code);


--
-- Name: idx_clients_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_name_search ON public.clients USING gin (to_tsvector('english'::regconfig, (name)::text));


--
-- Name: idx_commission_batch_items_batch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_batch_items_batch_id ON public.commission_batch_items USING btree (batch_id);


--
-- Name: idx_commission_batch_items_commission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_batch_items_commission_id ON public.commission_batch_items USING btree (commission_id);


--
-- Name: idx_commission_calc_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_calc_task_id ON public.commission_calculations USING btree (verification_task_id);


--
-- Name: idx_commission_calculations_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_calculations_case_id ON public.commission_calculations USING btree (case_id);


--
-- Name: idx_commission_calculations_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_calculations_client_id ON public.commission_calculations USING btree (client_id);


--
-- Name: idx_commission_calculations_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_calculations_completed_at ON public.commission_calculations USING btree (case_completed_at);


--
-- Name: idx_commission_calculations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_calculations_status ON public.commission_calculations USING btree (status);


--
-- Name: idx_commission_calculations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_calculations_user_id ON public.commission_calculations USING btree (user_id);


--
-- Name: idx_commission_calculations_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_calculations_user_status ON public.commission_calculations USING btree (user_id, status);


--
-- Name: idx_commission_payment_batches_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_payment_batches_created_by ON public.commission_payment_batches USING btree (created_by);


--
-- Name: idx_commission_payment_batches_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_payment_batches_payment_date ON public.commission_payment_batches USING btree (payment_date);


--
-- Name: idx_commission_payment_batches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_payment_batches_status ON public.commission_payment_batches USING btree (status);


--
-- Name: idx_commission_rate_types_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_rate_types_active ON public.commission_rate_types USING btree (is_active);


--
-- Name: idx_commission_rate_types_rate_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_rate_types_rate_type_id ON public.commission_rate_types USING btree (rate_type_id);


--
-- Name: idx_countries_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_countries_code ON public.countries USING btree (code);


--
-- Name: idx_countries_continent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_countries_continent ON public.countries USING btree (continent);


--
-- Name: idx_dedup_audit_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dedup_audit_performed_at ON public."caseDeduplicationAudit" USING btree ("performedAt");


--
-- Name: idx_dedup_audit_performed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dedup_audit_performed_by ON public."caseDeduplicationAudit" USING btree ("performedBy");


--
-- Name: idx_departments_head; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_head ON public.departments USING btree ("departmentHeadId");


--
-- Name: idx_departments_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_is_active ON public.departments USING btree ("isActive");


--
-- Name: idx_departments_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_name ON public.departments USING btree (name);


--
-- Name: idx_designations_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designations_is_active ON public.designations USING btree ("isActive");


--
-- Name: idx_designations_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designations_name ON public.designations USING btree (name);


--
-- Name: idx_document_type_rates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_type_rates_active ON public."documentTypeRates" USING btree ("isActive");


--
-- Name: idx_document_type_rates_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_type_rates_client ON public."documentTypeRates" USING btree ("clientId");


--
-- Name: idx_document_type_rates_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_type_rates_created_by ON public."documentTypeRates" USING btree ("createdBy");


--
-- Name: idx_document_type_rates_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_type_rates_document_type ON public."documentTypeRates" USING btree ("documentTypeId");


--
-- Name: idx_document_type_rates_effective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_type_rates_effective ON public."documentTypeRates" USING btree ("effectiveFrom", "effectiveTo");


--
-- Name: idx_document_type_rates_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_type_rates_lookup ON public."documentTypeRates" USING btree ("clientId", "productId", "documentTypeId", "isActive");


--
-- Name: idx_document_type_rates_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_type_rates_product ON public."documentTypeRates" USING btree ("productId");


--
-- Name: idx_document_types_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_types_category ON public."documentTypes" USING btree (category);


--
-- Name: idx_document_types_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_types_code ON public."documentTypes" USING btree (code);


--
-- Name: idx_document_types_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_types_is_active ON public."documentTypes" USING btree (is_active);


--
-- Name: idx_document_types_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_types_sort_order ON public."documentTypes" USING btree (sort_order);


--
-- Name: idx_dsa_connector_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_reports_task_id ON public."dsaConnectorVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_dsa_connector_verification_business_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_business_name ON public."dsaConnectorVerificationReports" USING btree (business_name);


--
-- Name: idx_dsa_connector_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_case_id ON public."dsaConnectorVerificationReports" USING btree (case_id);


--
-- Name: idx_dsa_connector_verification_connector_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_connector_code ON public."dsaConnectorVerificationReports" USING btree (connector_code);


--
-- Name: idx_dsa_connector_verification_connector_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_connector_name ON public."dsaConnectorVerificationReports" USING btree (connector_name);


--
-- Name: idx_dsa_connector_verification_connector_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_connector_type ON public."dsaConnectorVerificationReports" USING btree (connector_type);


--
-- Name: idx_dsa_connector_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_customer_name ON public."dsaConnectorVerificationReports" USING btree (customer_name);


--
-- Name: idx_dsa_connector_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_customer_phone ON public."dsaConnectorVerificationReports" USING btree (customer_phone);


--
-- Name: idx_dsa_connector_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_final_status ON public."dsaConnectorVerificationReports" USING btree (final_status);


--
-- Name: idx_dsa_connector_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_form_type ON public."dsaConnectorVerificationReports" USING btree (form_type);


--
-- Name: idx_dsa_connector_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_legacy_case_id ON public."dsaConnectorVerificationReports" USING btree ("caseId");


--
-- Name: idx_dsa_connector_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_locality ON public."dsaConnectorVerificationReports" USING btree (locality);


--
-- Name: idx_dsa_connector_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_outcome ON public."dsaConnectorVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_dsa_connector_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_verification_date ON public."dsaConnectorVerificationReports" USING btree (verification_date);


--
-- Name: idx_dsa_connector_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dsa_connector_verification_verified_by ON public."dsaConnectorVerificationReports" USING btree (verified_by);


--
-- Name: idx_error_logs_error_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_error_type ON public.error_logs USING btree (error_type);


--
-- Name: idx_error_logs_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_request_id ON public.error_logs USING btree (request_id);


--
-- Name: idx_error_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_timestamp ON public.error_logs USING btree ("timestamp");


--
-- Name: idx_error_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_user_id ON public.error_logs USING btree (user_id);


--
-- Name: idx_field_user_commission_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_user_commission_active ON public.field_user_commission_assignments USING btree (is_active);


--
-- Name: idx_field_user_commission_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_user_commission_client_id ON public.field_user_commission_assignments USING btree (client_id);


--
-- Name: idx_field_user_commission_effective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_user_commission_effective ON public.field_user_commission_assignments USING btree (effective_from, effective_to);


--
-- Name: idx_field_user_commission_rate_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_user_commission_rate_type_id ON public.field_user_commission_assignments USING btree (rate_type_id);


--
-- Name: idx_field_user_commission_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_user_commission_user_id ON public.field_user_commission_assignments USING btree (user_id);


--
-- Name: idx_form_quality_metrics_calculated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_quality_metrics_calculated_at ON public.form_quality_metrics USING btree (calculated_at);


--
-- Name: idx_form_quality_metrics_overall_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_quality_metrics_overall_score ON public.form_quality_metrics USING btree (overall_quality_score);


--
-- Name: idx_form_quality_metrics_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_quality_metrics_submission_id ON public.form_quality_metrics USING btree (form_submission_id);


--
-- Name: idx_form_submissions_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_case_id ON public.form_submissions USING btree (case_id);


--
-- Name: idx_form_submissions_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_composite ON public.form_submissions USING btree (form_type, validation_status, submitted_at);


--
-- Name: idx_form_submissions_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_form_type ON public.form_submissions USING btree (form_type);


--
-- Name: idx_form_submissions_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_submitted_at ON public.form_submissions USING btree (submitted_at);


--
-- Name: idx_form_submissions_submitted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_submitted_by ON public.form_submissions USING btree (submitted_by);


--
-- Name: idx_form_submissions_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_task_id ON public.form_submissions USING btree (verification_task_id);


--
-- Name: idx_form_submissions_validation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_validation_status ON public.form_submissions USING btree (validation_status);


--
-- Name: idx_form_submissions_verification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_verification_type ON public.form_submissions USING btree (verification_type_id);


--
-- Name: idx_form_validation_logs_field_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_validation_logs_field_name ON public.form_validation_logs USING btree (field_name);


--
-- Name: idx_form_validation_logs_is_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_validation_logs_is_valid ON public.form_validation_logs USING btree (is_valid);


--
-- Name: idx_form_validation_logs_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_validation_logs_submission_id ON public.form_validation_logs USING btree (form_submission_id);


--
-- Name: idx_form_validation_logs_validated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_validation_logs_validated_at ON public.form_validation_logs USING btree (validated_at);


--
-- Name: idx_locations_case_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_case_uuid ON public.locations USING btree (case_id);


--
-- Name: idx_locations_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_task_id ON public.locations USING btree (verification_task_id);


--
-- Name: idx_mobile_device_sync_last_sync; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_device_sync_last_sync ON public.mobile_device_sync USING btree ("lastSyncAt");


--
-- Name: idx_mobile_device_sync_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_device_sync_platform ON public.mobile_device_sync USING btree (platform);


--
-- Name: idx_mobile_device_sync_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_device_sync_user_id ON public.mobile_device_sync USING btree ("userId");


--
-- Name: idx_mobile_notification_audit_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_audit_case_id ON public.mobile_notification_audit USING btree ("caseId");


--
-- Name: idx_mobile_notification_audit_case_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_audit_case_uuid ON public.mobile_notification_audit USING btree (case_id);


--
-- Name: idx_mobile_notification_audit_notification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_audit_notification_id ON public.mobile_notification_audit USING btree ("notificationId");


--
-- Name: idx_mobile_notification_audit_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_audit_sent_at ON public.mobile_notification_audit USING btree ("sentAt");


--
-- Name: idx_mobile_notification_audit_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_audit_status ON public.mobile_notification_audit USING btree ("deliveryStatus");


--
-- Name: idx_mobile_notification_audit_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_audit_type ON public.mobile_notification_audit USING btree ("notificationType");


--
-- Name: idx_mobile_notification_audit_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_audit_user_id ON public.mobile_notification_audit USING btree ("userId");


--
-- Name: idx_mobile_notification_queue_notification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_queue_notification_type ON public.mobile_notification_queue USING btree ("notificationType");


--
-- Name: idx_mobile_notification_queue_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_queue_scheduled_at ON public.mobile_notification_queue USING btree ("scheduledAt");


--
-- Name: idx_mobile_notification_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_queue_status ON public.mobile_notification_queue USING btree (status);


--
-- Name: idx_mobile_notification_queue_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_notification_queue_user_id ON public.mobile_notification_queue USING btree ("userId");


--
-- Name: idx_noc_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_reports_task_id ON public."nocVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_noc_verification_builder_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_builder_name ON public."nocVerificationReports" USING btree (builder_name);


--
-- Name: idx_noc_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_case_id ON public."nocVerificationReports" USING btree (case_id);


--
-- Name: idx_noc_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_customer_name ON public."nocVerificationReports" USING btree (customer_name);


--
-- Name: idx_noc_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_customer_phone ON public."nocVerificationReports" USING btree (customer_phone);


--
-- Name: idx_noc_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_final_status ON public."nocVerificationReports" USING btree (final_status);


--
-- Name: idx_noc_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_form_type ON public."nocVerificationReports" USING btree (form_type);


--
-- Name: idx_noc_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_legacy_case_id ON public."nocVerificationReports" USING btree ("caseId");


--
-- Name: idx_noc_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_locality ON public."nocVerificationReports" USING btree (locality);


--
-- Name: idx_noc_verification_noc_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_noc_number ON public."nocVerificationReports" USING btree (noc_number);


--
-- Name: idx_noc_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_outcome ON public."nocVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_noc_verification_project_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_project_name ON public."nocVerificationReports" USING btree (project_name);


--
-- Name: idx_noc_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_verification_date ON public."nocVerificationReports" USING btree (verification_date);


--
-- Name: idx_noc_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noc_verification_verified_by ON public."nocVerificationReports" USING btree (verified_by);


--
-- Name: idx_notification_batches_batch_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_batches_batch_type ON public.notification_batches USING btree (batch_type);


--
-- Name: idx_notification_batches_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_batches_created_by ON public.notification_batches USING btree (created_by);


--
-- Name: idx_notification_batches_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_batches_scheduled_at ON public.notification_batches USING btree (scheduled_at);


--
-- Name: idx_notification_batches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_batches_status ON public.notification_batches USING btree (status);


--
-- Name: idx_notification_delivery_log_attempted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_delivery_log_attempted_at ON public.notification_delivery_log USING btree (attempted_at DESC);


--
-- Name: idx_notification_delivery_log_delivery_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_delivery_log_delivery_method ON public.notification_delivery_log USING btree (delivery_method);


--
-- Name: idx_notification_delivery_log_delivery_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_delivery_log_delivery_status ON public.notification_delivery_log USING btree (delivery_status);


--
-- Name: idx_notification_delivery_log_notification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_delivery_log_notification_id ON public.notification_delivery_log USING btree (notification_id);


--
-- Name: idx_notification_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_notification_tokens_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_tokens_active ON public.notification_tokens USING btree (is_active);


--
-- Name: idx_notification_tokens_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_tokens_platform ON public.notification_tokens USING btree (platform);


--
-- Name: idx_notification_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_tokens_user_id ON public."notificationTokens" USING btree ("userId");


--
-- Name: idx_notifications_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_case_id ON public.notifications USING btree (case_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_delivery_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_delivery_status ON public.notifications USING btree (delivery_status);


--
-- Name: idx_notifications_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_expires_at ON public.notifications USING btree (expires_at);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_priority ON public.notifications USING btree (priority);


--
-- Name: idx_notifications_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_task_id ON public.notifications USING btree (task_id);


--
-- Name: idx_notifications_task_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_task_number ON public.notifications USING btree (task_number);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_office_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_reports_task_id ON public."officeVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_office_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_case_id ON public."officeVerificationReports" USING btree (case_id);


--
-- Name: idx_office_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_customer_name ON public."officeVerificationReports" USING btree (customer_name);


--
-- Name: idx_office_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_customer_phone ON public."officeVerificationReports" USING btree (customer_phone);


--
-- Name: idx_office_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_final_status ON public."officeVerificationReports" USING btree (final_status);


--
-- Name: idx_office_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_form_type ON public."officeVerificationReports" USING btree (form_type);


--
-- Name: idx_office_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_legacy_case_id ON public."officeVerificationReports" USING btree ("caseId");


--
-- Name: idx_office_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_locality ON public."officeVerificationReports" USING btree (locality);


--
-- Name: idx_office_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_outcome ON public."officeVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_office_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_verification_date ON public."officeVerificationReports" USING btree (verification_date);


--
-- Name: idx_office_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_verification_verified_by ON public."officeVerificationReports" USING btree (verified_by);


--
-- Name: idx_performance_metrics_response_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_response_time ON public.performance_metrics USING btree (response_time);


--
-- Name: idx_performance_metrics_status_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_status_code ON public.performance_metrics USING btree (status_code);


--
-- Name: idx_performance_metrics_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_timestamp ON public.performance_metrics USING btree ("timestamp");


--
-- Name: idx_performance_metrics_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_url ON public.performance_metrics USING btree (url);


--
-- Name: idx_performance_metrics_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_user_id ON public.performance_metrics USING btree (user_id);


--
-- Name: idx_pincode_areas_area_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pincode_areas_area_id ON public."pincodeAreas" USING btree ("areaId");


--
-- Name: idx_pincode_areas_pincode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pincode_areas_pincode_id ON public."pincodeAreas" USING btree ("pincodeId");


--
-- Name: idx_pincodes_city_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pincodes_city_id ON public.pincodes USING btree ("cityId");


--
-- Name: idx_pincodes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pincodes_code ON public.pincodes USING btree (code);


--
-- Name: idx_product_document_types_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_document_types_active ON public."productDocumentTypes" USING btree (is_active);


--
-- Name: idx_product_document_types_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_document_types_document ON public."productDocumentTypes" USING btree ("documentTypeId");


--
-- Name: idx_product_document_types_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_document_types_product ON public."productDocumentTypes" USING btree ("productId");


--
-- Name: idx_product_verification_types_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_verification_types_product_id ON public."productVerificationTypes" USING btree ("productId");


--
-- Name: idx_product_verification_types_verification_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_verification_types_verification_type_id ON public."productVerificationTypes" USING btree ("verificationTypeId");


--
-- Name: idx_property_apf_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_reports_task_id ON public."propertyApfVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_property_apf_verification_apf_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_apf_number ON public."propertyApfVerificationReports" USING btree (apf_number);


--
-- Name: idx_property_apf_verification_builder_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_builder_name ON public."propertyApfVerificationReports" USING btree (builder_name);


--
-- Name: idx_property_apf_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_case_id ON public."propertyApfVerificationReports" USING btree (case_id);


--
-- Name: idx_property_apf_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_customer_name ON public."propertyApfVerificationReports" USING btree (customer_name);


--
-- Name: idx_property_apf_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_customer_phone ON public."propertyApfVerificationReports" USING btree (customer_phone);


--
-- Name: idx_property_apf_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_final_status ON public."propertyApfVerificationReports" USING btree (final_status);


--
-- Name: idx_property_apf_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_form_type ON public."propertyApfVerificationReports" USING btree (form_type);


--
-- Name: idx_property_apf_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_legacy_case_id ON public."propertyApfVerificationReports" USING btree ("caseId");


--
-- Name: idx_property_apf_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_locality ON public."propertyApfVerificationReports" USING btree (locality);


--
-- Name: idx_property_apf_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_outcome ON public."propertyApfVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_property_apf_verification_project_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_project_name ON public."propertyApfVerificationReports" USING btree (project_name);


--
-- Name: idx_property_apf_verification_property_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_property_type ON public."propertyApfVerificationReports" USING btree (property_type);


--
-- Name: idx_property_apf_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_verification_date ON public."propertyApfVerificationReports" USING btree (verification_date);


--
-- Name: idx_property_apf_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_apf_verification_verified_by ON public."propertyApfVerificationReports" USING btree (verified_by);


--
-- Name: idx_property_individual_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_reports_task_id ON public."propertyIndividualVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_property_individual_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_case_id ON public."propertyIndividualVerificationReports" USING btree (case_id);


--
-- Name: idx_property_individual_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_customer_name ON public."propertyIndividualVerificationReports" USING btree (customer_name);


--
-- Name: idx_property_individual_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_customer_phone ON public."propertyIndividualVerificationReports" USING btree (customer_phone);


--
-- Name: idx_property_individual_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_final_status ON public."propertyIndividualVerificationReports" USING btree (final_status);


--
-- Name: idx_property_individual_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_form_type ON public."propertyIndividualVerificationReports" USING btree (form_type);


--
-- Name: idx_property_individual_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_legacy_case_id ON public."propertyIndividualVerificationReports" USING btree ("caseId");


--
-- Name: idx_property_individual_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_locality ON public."propertyIndividualVerificationReports" USING btree (locality);


--
-- Name: idx_property_individual_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_outcome ON public."propertyIndividualVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_property_individual_verification_owner_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_owner_name ON public."propertyIndividualVerificationReports" USING btree (owner_name);


--
-- Name: idx_property_individual_verification_property_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_property_type ON public."propertyIndividualVerificationReports" USING btree (property_type);


--
-- Name: idx_property_individual_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_verification_date ON public."propertyIndividualVerificationReports" USING btree (verification_date);


--
-- Name: idx_property_individual_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_individual_verification_verified_by ON public."propertyIndividualVerificationReports" USING btree (verified_by);


--
-- Name: idx_query_performance_execution_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_performance_execution_time ON public.query_performance USING btree (execution_time);


--
-- Name: idx_query_performance_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_performance_hash ON public.query_performance USING btree (query_hash);


--
-- Name: idx_query_performance_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_query_performance_timestamp ON public.query_performance USING btree ("timestamp");


--
-- Name: idx_rate_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_history_changed_at ON public."rateHistory" USING btree ("changedAt");


--
-- Name: idx_rates_effective_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rates_effective_from ON public.rates USING btree ("effectiveFrom");


--
-- Name: idx_rates_effective_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rates_effective_to ON public.rates USING btree ("effectiveTo");


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public."refreshTokens" USING btree ("userId");


--
-- Name: idx_res_cum_office_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_case_id ON public."residenceCumOfficeVerificationReports" USING btree (case_id);


--
-- Name: idx_res_cum_office_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_customer_name ON public."residenceCumOfficeVerificationReports" USING btree (customer_name);


--
-- Name: idx_res_cum_office_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_customer_phone ON public."residenceCumOfficeVerificationReports" USING btree (customer_phone);


--
-- Name: idx_res_cum_office_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_final_status ON public."residenceCumOfficeVerificationReports" USING btree (final_status);


--
-- Name: idx_res_cum_office_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_form_type ON public."residenceCumOfficeVerificationReports" USING btree (form_type);


--
-- Name: idx_res_cum_office_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_legacy_case_id ON public."residenceCumOfficeVerificationReports" USING btree ("caseId");


--
-- Name: idx_res_cum_office_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_locality ON public."residenceCumOfficeVerificationReports" USING btree (locality);


--
-- Name: idx_res_cum_office_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_outcome ON public."residenceCumOfficeVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_res_cum_office_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_verification_date ON public."residenceCumOfficeVerificationReports" USING btree (verification_date);


--
-- Name: idx_res_cum_office_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_res_cum_office_verification_verified_by ON public."residenceCumOfficeVerificationReports" USING btree (verified_by);


--
-- Name: idx_residence_cum_office_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_cum_office_reports_task_id ON public."residenceCumOfficeVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_residence_reports_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_reports_task_id ON public."residenceVerificationReports" USING btree (verification_task_id);


--
-- Name: idx_residence_verification_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_case_id ON public."residenceVerificationReports" USING btree (case_id);


--
-- Name: idx_residence_verification_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_customer_name ON public."residenceVerificationReports" USING btree (customer_name);


--
-- Name: idx_residence_verification_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_customer_phone ON public."residenceVerificationReports" USING btree (customer_phone);


--
-- Name: idx_residence_verification_final_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_final_status ON public."residenceVerificationReports" USING btree (final_status);


--
-- Name: idx_residence_verification_form_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_form_type ON public."residenceVerificationReports" USING btree (form_type);


--
-- Name: idx_residence_verification_legacy_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_legacy_case_id ON public."residenceVerificationReports" USING btree ("caseId");


--
-- Name: idx_residence_verification_locality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_locality ON public."residenceVerificationReports" USING btree (locality);


--
-- Name: idx_residence_verification_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_outcome ON public."residenceVerificationReports" USING btree (verification_outcome);


--
-- Name: idx_residence_verification_verification_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_verification_date ON public."residenceVerificationReports" USING btree (verification_date);


--
-- Name: idx_residence_verification_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_residence_verification_verified_by ON public."residenceVerificationReports" USING btree (verified_by);


--
-- Name: idx_roles_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_is_active ON public.roles USING btree ("isActive");


--
-- Name: idx_roles_is_system_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_is_system_role ON public.roles USING btree ("isSystemRole");


--
-- Name: idx_roles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_name ON public.roles USING btree (name);


--
-- Name: idx_roles_permissions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_permissions ON public.roles USING gin (permissions);


--
-- Name: idx_scheduled_reports_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_active ON public.scheduled_reports USING btree (is_active);


--
-- Name: idx_scheduled_reports_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_created_by ON public.scheduled_reports USING btree (created_by);


--
-- Name: idx_scheduled_reports_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_next_run ON public.scheduled_reports USING btree (next_run);


--
-- Name: idx_schema_migrations_executed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schema_migrations_executed_at ON public.schema_migrations USING btree (executed_at);


--
-- Name: idx_security_audit_events_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_audit_events_severity ON public.security_audit_events USING btree (severity, created_at DESC);


--
-- Name: idx_security_audit_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_audit_events_type ON public.security_audit_events USING btree (event_type, created_at DESC);


--
-- Name: idx_security_audit_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_audit_events_user ON public.security_audit_events USING btree (user_id, created_at DESC);


--
-- Name: idx_states_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_states_code ON public.states USING btree (code);


--
-- Name: idx_states_country_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_states_country_id ON public.states USING btree ("countryId");


--
-- Name: idx_states_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_states_name ON public.states USING btree (name);


--
-- Name: idx_system_health_metrics_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_health_metrics_name ON public.system_health_metrics USING btree (metric_name);


--
-- Name: idx_system_health_metrics_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_health_metrics_timestamp ON public.system_health_metrics USING btree ("timestamp");


--
-- Name: idx_sz_rules_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sz_rules_lookup ON public.service_zone_rules USING btree (client_id, product_id, pincode_id, area_id);


--
-- Name: idx_task_assignment_assigned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignment_assigned_at ON public.task_assignment_history USING btree (assigned_at);


--
-- Name: idx_task_assignment_assigned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignment_assigned_by ON public.task_assignment_history USING btree (assigned_by);


--
-- Name: idx_task_assignment_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignment_assigned_to ON public.task_assignment_history USING btree (assigned_to);


--
-- Name: idx_task_assignment_verification_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignment_verification_task ON public.task_assignment_history USING btree (verification_task_id);


--
-- Name: idx_task_commission_calculation_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_commission_calculation_date ON public.task_commission_calculations USING btree (calculation_date);


--
-- Name: idx_task_commission_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_commission_case ON public.task_commission_calculations USING btree (case_id);


--
-- Name: idx_task_commission_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_commission_status ON public.task_commission_calculations USING btree (status);


--
-- Name: idx_task_commission_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_commission_user ON public.task_commission_calculations USING btree (user_id);


--
-- Name: idx_task_commission_verification_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_commission_verification_task ON public.task_commission_calculations USING btree (verification_task_id);


--
-- Name: idx_task_form_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_form_case ON public.task_form_submissions USING btree (case_id);


--
-- Name: idx_task_form_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_form_submission ON public.task_form_submissions USING btree (form_submission_id);


--
-- Name: idx_task_form_submissions_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_form_submissions_task_id ON public.task_form_submissions USING btree (verification_task_id);


--
-- Name: idx_task_form_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_form_submitted_at ON public.task_form_submissions USING btree (submitted_at);


--
-- Name: idx_task_form_verification_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_form_verification_task ON public.task_form_submissions USING btree (verification_task_id);


--
-- Name: idx_task_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_templates_category ON public.verification_task_templates USING btree (category);


--
-- Name: idx_task_templates_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_templates_is_active ON public.verification_task_templates USING btree (is_active);


--
-- Name: idx_task_templates_usage_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_templates_usage_count ON public.verification_task_templates USING btree (usage_count);


--
-- Name: idx_task_types_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_types_category ON public.verification_task_types USING btree (category);


--
-- Name: idx_task_types_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_types_code ON public.verification_task_types USING btree (code);


--
-- Name: idx_task_types_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_types_is_active ON public.verification_task_types USING btree (is_active);


--
-- Name: idx_template_reports_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reports_case_id ON public.template_reports USING btree (case_id);


--
-- Name: idx_template_reports_case_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reports_case_submission ON public.template_reports USING btree (case_id, submission_id);


--
-- Name: idx_template_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reports_created_at ON public.template_reports USING btree (created_at);


--
-- Name: idx_template_reports_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reports_created_by ON public.template_reports USING btree (created_by);


--
-- Name: idx_template_reports_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reports_outcome ON public.template_reports USING btree (outcome);


--
-- Name: idx_template_reports_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reports_submission_id ON public.template_reports USING btree (submission_id);


--
-- Name: idx_template_reports_verification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reports_verification_type ON public.template_reports USING btree (verification_type);


--
-- Name: idx_territory_assignment_audit_assignment_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_territory_assignment_audit_assignment_type ON public."territoryAssignmentAudit" USING btree ("assignmentType");


--
-- Name: idx_territory_assignment_audit_new_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_territory_assignment_audit_new_data ON public."territoryAssignmentAudit" USING gin ("newData");


--
-- Name: idx_territory_assignment_audit_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_territory_assignment_audit_performed_at ON public."territoryAssignmentAudit" USING btree ("performedAt");


--
-- Name: idx_territory_assignment_audit_previous_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_territory_assignment_audit_previous_data ON public."territoryAssignmentAudit" USING gin ("previousData");


--
-- Name: idx_territory_assignment_audit_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_territory_assignment_audit_user_id ON public."territoryAssignmentAudit" USING btree ("userId");


--
-- Name: idx_trusted_devices_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trusted_devices_blocked ON public.trusted_devices USING btree (is_blocked) WHERE (is_blocked = true);


--
-- Name: idx_trusted_devices_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trusted_devices_user_id ON public.trusted_devices USING btree (user_id);


--
-- Name: idx_user_area_assignments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_area_assignments_active ON public."userAreaAssignments" USING btree ("isActive") WHERE ("isActive" = true);


--
-- Name: idx_user_area_assignments_area_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_area_assignments_area_id ON public."userAreaAssignments" USING btree ("areaId");


--
-- Name: idx_user_area_assignments_pincode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_area_assignments_pincode_id ON public."userAreaAssignments" USING btree ("pincodeId");


--
-- Name: idx_user_area_assignments_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_area_assignments_user_active ON public."userAreaAssignments" USING btree ("userId", "isActive") WHERE ("isActive" = true);


--
-- Name: idx_user_area_assignments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_area_assignments_user_id ON public."userAreaAssignments" USING btree ("userId");


--
-- Name: idx_user_area_assignments_user_pincode_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_area_assignments_user_pincode_active ON public."userAreaAssignments" USING btree ("userId", "pincodeId", "isActive") WHERE ("isActive" = true);


--
-- Name: idx_user_area_assignments_user_pincode_assignment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_area_assignments_user_pincode_assignment_id ON public."userAreaAssignments" USING btree ("userPincodeAssignmentId");


--
-- Name: idx_user_client_assignments_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_client_assignments_client_id ON public."userClientAssignments" USING btree ("clientId");


--
-- Name: idx_user_client_assignments_user_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_client_assignments_user_client ON public."userClientAssignments" USING btree ("userId", "clientId");


--
-- Name: idx_user_client_assignments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_client_assignments_user_id ON public."userClientAssignments" USING btree ("userId");


--
-- Name: idx_user_pincode_assignments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pincode_assignments_active ON public."userPincodeAssignments" USING btree ("isActive") WHERE ("isActive" = true);


--
-- Name: idx_user_pincode_assignments_pincode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pincode_assignments_pincode_id ON public."userPincodeAssignments" USING btree ("pincodeId");


--
-- Name: idx_user_pincode_assignments_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pincode_assignments_user_active ON public."userPincodeAssignments" USING btree ("userId", "isActive") WHERE ("isActive" = true);


--
-- Name: idx_user_pincode_assignments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pincode_assignments_user_id ON public."userPincodeAssignments" USING btree ("userId");


--
-- Name: idx_user_product_assignments_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_product_assignments_product_id ON public."userProductAssignments" USING btree ("productId");


--
-- Name: idx_user_product_assignments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_product_assignments_user_id ON public."userProductAssignments" USING btree ("userId");


--
-- Name: idx_user_product_assignments_user_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_product_assignments_user_product ON public."userProductAssignments" USING btree ("userId", "productId");


--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree ("deletedAt");


--
-- Name: idx_users_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_department_id ON public.users USING btree ("departmentId");


--
-- Name: idx_users_designation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_designation_id ON public.users USING btree ("designationId");


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_employee_id ON public.users USING btree ("employeeId");


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_active ON public.users USING btree ("isActive");


--
-- Name: idx_users_last_active_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_active_at ON public.users USING btree (last_active_at);


--
-- Name: idx_users_last_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_login ON public.users USING btree ("lastLogin");


--
-- Name: idx_users_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_name_search ON public.users USING gin (to_tsvector('english'::regconfig, (name)::text));


--
-- Name: idx_users_performance_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_performance_rating ON public.users USING btree (performance_rating);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_role_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_active ON public.users USING btree (role, "isActive");


--
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_id ON public.users USING btree ("roleId");


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_verification_attachments_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_case_id ON public.verification_attachments USING btree (case_id);


--
-- Name: idx_verification_attachments_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_deleted ON public.verification_attachments USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_verification_attachments_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_device_id ON public.verification_attachments USING btree (device_id);


--
-- Name: idx_verification_attachments_gps_validation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_gps_validation ON public.verification_attachments USING btree (gps_validation_status) WHERE ((gps_validation_status)::text = 'MISMATCH'::text);


--
-- Name: idx_verification_attachments_hash_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_hash_verified ON public.verification_attachments USING btree (hash_verified) WHERE (hash_verified = false);


--
-- Name: idx_verification_attachments_photo_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_photo_type ON public.verification_attachments USING btree ("photoType");


--
-- Name: idx_verification_attachments_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_submission_id ON public.verification_attachments USING btree ("submissionId");


--
-- Name: idx_verification_attachments_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_task_id ON public.verification_attachments USING btree (verification_task_id);


--
-- Name: idx_verification_attachments_verification_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_verification_task_id ON public.verification_attachments USING btree (verification_task_id);


--
-- Name: idx_verification_attachments_verification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_attachments_verification_type ON public.verification_attachments USING btree (verification_type);


--
-- Name: idx_verification_tasks_applicant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_applicant_type ON public.verification_tasks USING btree (applicant_type);


--
-- Name: idx_verification_tasks_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_assigned_to ON public.verification_tasks USING btree (assigned_to);


--
-- Name: idx_verification_tasks_cancelled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_cancelled_at ON public.verification_tasks USING btree (cancelled_at) WHERE (cancelled_at IS NOT NULL);


--
-- Name: idx_verification_tasks_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_case_id ON public.verification_tasks USING btree (case_id);


--
-- Name: idx_verification_tasks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_created_at ON public.verification_tasks USING btree (created_at);


--
-- Name: idx_verification_tasks_is_saved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_is_saved ON public.verification_tasks USING btree (is_saved) WHERE (is_saved = true);


--
-- Name: idx_verification_tasks_parent_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_parent_task_id ON public.verification_tasks USING btree (parent_task_id);


--
-- Name: idx_verification_tasks_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_priority ON public.verification_tasks USING btree (priority);


--
-- Name: idx_verification_tasks_reviewer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_reviewer_id ON public.verification_tasks USING btree (reviewer_id);


--
-- Name: idx_verification_tasks_revoked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_revoked_at ON public.verification_tasks USING btree (revoked_at) WHERE (revoked_at IS NOT NULL);


--
-- Name: idx_verification_tasks_revoked_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_revoked_by ON public.verification_tasks USING btree (revoked_by) WHERE (revoked_by IS NOT NULL);


--
-- Name: idx_verification_tasks_saved_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_saved_at ON public.verification_tasks USING btree (saved_at) WHERE (saved_at IS NOT NULL);


--
-- Name: idx_verification_tasks_service_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_service_zone_id ON public.verification_tasks USING btree (service_zone_id);


--
-- Name: idx_verification_tasks_sla_monitoring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_sla_monitoring ON public.verification_tasks USING btree (status, first_assigned_at, service_zone_id) WHERE (((status)::text = ANY ((ARRAY['ASSIGNED'::character varying, 'IN_PROGRESS'::character varying])::text[])) AND (first_assigned_at IS NOT NULL) AND (service_zone_id IS NOT NULL));


--
-- Name: INDEX idx_verification_tasks_sla_monitoring; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_verification_tasks_sla_monitoring IS 'Partial index for SLA risk monitoring queries. Only indexes active tasks with SLA tracking data.';


--
-- Name: idx_verification_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_status ON public.verification_tasks USING btree (status);


--
-- Name: idx_verification_tasks_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_submitted ON public.verification_tasks USING btree (status, submitted_at) WHERE ((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'UNDER_REVIEW'::character varying])::text[]));


--
-- Name: idx_verification_tasks_task_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_task_type ON public.verification_tasks USING btree (task_type);


--
-- Name: idx_verification_tasks_verification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_tasks_verification_type ON public.verification_tasks USING btree (verification_type_id);


--
-- Name: idx_zone_rate_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zone_rate_mapping ON public.zone_rate_type_mapping USING btree (client_id, product_id, verification_type_id, service_zone_id);


--
-- Name: uk_user_area_assignments_active_only; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_user_area_assignments_active_only ON public."userAreaAssignments" USING btree ("userId", "pincodeId", "areaId") WHERE ("isActive" = true);


--
-- Name: uk_user_pincode_assignments_active_only; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_user_pincode_assignments_active_only ON public."userPincodeAssignments" USING btree ("userId", "pincodeId") WHERE ("isActive" = true);


--
-- Name: uniq_locations_verification_task; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_locations_verification_task ON public.locations USING btree (verification_task_id) WHERE (verification_task_id IS NOT NULL);


--
-- Name: userAreaAssignments audit_user_area_assignments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_user_area_assignments AFTER INSERT OR UPDATE ON public."userAreaAssignments" FOR EACH ROW EXECUTE FUNCTION public.audit_territory_assignment_changes();


--
-- Name: userPincodeAssignments audit_user_pincode_assignments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_user_pincode_assignments AFTER INSERT OR UPDATE ON public."userPincodeAssignments" FOR EACH ROW EXECUTE FUNCTION public.audit_territory_assignment_changes();


--
-- Name: rates rate_history_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rate_history_trigger AFTER UPDATE ON public.rates FOR EACH ROW EXECUTE FUNCTION public.create_rate_history();


--
-- Name: users trigger_create_notification_preferences; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_create_notification_preferences AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();


--
-- Name: verification_tasks trigger_generate_task_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_task_number BEFORE INSERT ON public.verification_tasks FOR EACH ROW EXECUTE FUNCTION public.generate_task_number();


--
-- Name: notification_batches trigger_notification_batches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notification_batches_updated_at BEFORE UPDATE ON public.notification_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_preferences trigger_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_tokens trigger_notification_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notification_tokens_updated_at BEFORE UPDATE ON public.notification_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications trigger_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_reports trigger_update_ai_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_ai_reports_updated_at BEFORE UPDATE ON public.ai_reports FOR EACH ROW EXECUTE FUNCTION public.update_ai_reports_updated_at();


--
-- Name: verification_tasks trigger_update_case_completion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_case_completion AFTER INSERT OR UPDATE OF status ON public.verification_tasks FOR EACH ROW EXECUTE FUNCTION public.update_case_completion_percentage();


--
-- Name: task_commission_calculations trigger_update_commission_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_commission_updated_at BEFORE UPDATE ON public.task_commission_calculations FOR EACH ROW EXECUTE FUNCTION public.update_task_updated_at();


--
-- Name: documentTypeRates trigger_update_document_type_rates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_document_type_rates_updated_at BEFORE UPDATE ON public."documentTypeRates" FOR EACH ROW EXECUTE FUNCTION public.update_document_type_rates_updated_at();


--
-- Name: mobile_notification_audit trigger_update_mobile_notification_audit_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_mobile_notification_audit_updated_at BEFORE UPDATE ON public.mobile_notification_audit FOR EACH ROW EXECUTE FUNCTION public.update_mobile_notification_audit_updated_at();


--
-- Name: verification_tasks trigger_update_task_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_task_updated_at BEFORE UPDATE ON public.verification_tasks FOR EACH ROW EXECUTE FUNCTION public.update_task_updated_at();


--
-- Name: template_reports trigger_update_template_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_template_reports_updated_at BEFORE UPDATE ON public.template_reports FOR EACH ROW EXECUTE FUNCTION public.update_template_reports_updated_at();


--
-- Name: builderVerificationReports update_builder_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_builder_verification_updated_at BEFORE UPDATE ON public."builderVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_builder_verification_updated_at();


--
-- Name: businessVerificationReports update_business_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_business_verification_updated_at BEFORE UPDATE ON public."businessVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_business_verification_updated_at();


--
-- Name: case_assignment_queue_status update_case_assignment_queue_status_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_case_assignment_queue_status_updated_at BEFORE UPDATE ON public.case_assignment_queue_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: caseDeduplicationAudit update_case_deduplication_audit_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_case_deduplication_audit_updated_at BEFORE UPDATE ON public."caseDeduplicationAudit" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cases update_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_cases_updated_at();


--
-- Name: cities update_cities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: commission_calculations update_commission_calculations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_commission_calculations_updated_at BEFORE UPDATE ON public.commission_calculations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: commission_payment_batches update_commission_payment_batches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_commission_payment_batches_updated_at BEFORE UPDATE ON public.commission_payment_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: commission_rate_types update_commission_rate_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_commission_rate_types_updated_at BEFORE UPDATE ON public.commission_rate_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: countries update_countries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: departments update_departments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_departments_updated_at();


--
-- Name: designations update_designations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_designations_updated_at BEFORE UPDATE ON public.designations FOR EACH ROW EXECUTE FUNCTION public.update_designations_updated_at();


--
-- Name: dsaConnectorVerificationReports update_dsa_connector_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_dsa_connector_verification_updated_at BEFORE UPDATE ON public."dsaConnectorVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_dsa_connector_verification_updated_at();


--
-- Name: field_user_commission_assignments update_field_user_commission_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_field_user_commission_assignments_updated_at BEFORE UPDATE ON public.field_user_commission_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mobile_device_sync update_mobile_device_sync_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_mobile_device_sync_updated_at BEFORE UPDATE ON public.mobile_device_sync FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mobile_notification_queue update_mobile_notification_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_mobile_notification_queue_updated_at BEFORE UPDATE ON public.mobile_notification_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: nocVerificationReports update_noc_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_noc_verification_updated_at BEFORE UPDATE ON public."nocVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_noc_verification_updated_at();


--
-- Name: officeVerificationReports update_office_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_office_verification_updated_at BEFORE UPDATE ON public."officeVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_office_verification_updated_at();


--
-- Name: pincodeAreas update_pincode_areas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pincode_areas_updated_at BEFORE UPDATE ON public."pincodeAreas" FOR EACH ROW EXECUTE FUNCTION public.update_pincode_areas_updated_at();


--
-- Name: propertyApfVerificationReports update_property_apf_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_property_apf_verification_updated_at BEFORE UPDATE ON public."propertyApfVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_property_apf_verification_updated_at();


--
-- Name: propertyIndividualVerificationReports update_property_individual_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_property_individual_verification_updated_at BEFORE UPDATE ON public."propertyIndividualVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_property_individual_verification_updated_at();


--
-- Name: residenceCumOfficeVerificationReports update_residence_cum_office_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_residence_cum_office_verification_updated_at BEFORE UPDATE ON public."residenceCumOfficeVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_residence_cum_office_verification_updated_at();


--
-- Name: residenceVerificationReports update_residence_verification_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_residence_verification_updated_at BEFORE UPDATE ON public."residenceVerificationReports" FOR EACH ROW EXECUTE FUNCTION public.update_residence_verification_updated_at();


--
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_roles_updated_at();


--
-- Name: states update_states_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_states_updated_at BEFORE UPDATE ON public.states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: userAreaAssignments update_user_area_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_area_assignments_updated_at BEFORE UPDATE ON public."userAreaAssignments" FOR EACH ROW EXECUTE FUNCTION public.update_camel_case_updated_at();


--
-- Name: userClientAssignments update_user_client_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_client_assignments_updated_at BEFORE UPDATE ON public."userClientAssignments" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: userPincodeAssignments update_user_pincode_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_pincode_assignments_updated_at BEFORE UPDATE ON public."userPincodeAssignments" FOR EACH ROW EXECUTE FUNCTION public.update_camel_case_updated_at();


--
-- Name: userProductAssignments update_user_product_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_product_assignments_updated_at BEFORE UPDATE ON public."userProductAssignments" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_updated_at();


--
-- Name: agent_performance_daily agent_performance_daily_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_performance_daily
    ADD CONSTRAINT agent_performance_daily_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY ("uploadedBy") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: attachments attachments_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_verification_task_id_fkey FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: auditLogs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."auditLogs"
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: autoSaves auto_saves_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."autoSaves"
    ADD CONSTRAINT auto_saves_user_id_fkey FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: backgroundSyncQueue background_sync_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."backgroundSyncQueue"
    ADD CONSTRAINT background_sync_queue_user_id_fkey FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: builderVerificationReports builderVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."builderVerificationReports"
    ADD CONSTRAINT "builderVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: businessVerificationReports businessVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."businessVerificationReports"
    ADD CONSTRAINT "businessVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: case_assignment_conflicts case_assignment_conflicts_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_conflicts
    ADD CONSTRAINT "case_assignment_conflicts_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_assignment_conflicts case_assignment_conflicts_clientAssignedTo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_conflicts
    ADD CONSTRAINT "case_assignment_conflicts_clientAssignedTo_fkey" FOREIGN KEY ("clientAssignedTo") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: case_assignment_conflicts case_assignment_conflicts_resolvedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_conflicts
    ADD CONSTRAINT "case_assignment_conflicts_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: case_assignment_conflicts case_assignment_conflicts_serverAssignedTo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_conflicts
    ADD CONSTRAINT "case_assignment_conflicts_serverAssignedTo_fkey" FOREIGN KEY ("serverAssignedTo") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: case_assignment_history case_assignment_history_assignedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT "case_assignment_history_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: case_assignment_history case_assignment_history_assignedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT "case_assignment_history_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES public.users(id);


--
-- Name: case_assignment_history case_assignment_history_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT "case_assignment_history_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public.cases("caseId") ON DELETE CASCADE;


--
-- Name: case_assignment_history case_assignment_history_fromUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT "case_assignment_history_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: case_assignment_history case_assignment_history_newAssignee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT "case_assignment_history_newAssignee_fkey" FOREIGN KEY ("newAssignee") REFERENCES public.users(id);


--
-- Name: case_assignment_history case_assignment_history_previousAssignee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT "case_assignment_history_previousAssignee_fkey" FOREIGN KEY ("previousAssignee") REFERENCES public.users(id);


--
-- Name: case_assignment_history case_assignment_history_toUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT "case_assignment_history_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: case_assignment_queue_status case_assignment_queue_status_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_queue_status
    ADD CONSTRAINT "case_assignment_queue_status_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: case_assignment_queue_status case_assignment_queue_status_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_queue_status
    ADD CONSTRAINT "case_assignment_queue_status_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: case_configuration_errors case_configuration_errors_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_configuration_errors
    ADD CONSTRAINT case_configuration_errors_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_configuration_errors case_configuration_errors_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_configuration_errors
    ADD CONSTRAINT case_configuration_errors_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: caseDeduplicationAudit case_deduplication_audit_performedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."caseDeduplicationAudit"
    ADD CONSTRAINT "case_deduplication_audit_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: case_timeline_events case_timeline_events_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_timeline_events
    ADD CONSTRAINT case_timeline_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_timeline_events case_timeline_events_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_timeline_events
    ADD CONSTRAINT case_timeline_events_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: clientDocumentTypes clientDocumentTypes_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientDocumentTypes"
    ADD CONSTRAINT "clientDocumentTypes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clientDocumentTypes clientDocumentTypes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientDocumentTypes"
    ADD CONSTRAINT "clientDocumentTypes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: clientDocumentTypes clientDocumentTypes_documentTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientDocumentTypes"
    ADD CONSTRAINT "clientDocumentTypes_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES public."documentTypes"(id) ON DELETE CASCADE;


--
-- Name: commission_batch_items commission_batch_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_batch_items
    ADD CONSTRAINT commission_batch_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.commission_payment_batches(id) ON DELETE CASCADE;


--
-- Name: commission_batch_items commission_batch_items_commission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_batch_items
    ADD CONSTRAINT commission_batch_items_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES public.commission_calculations(id) ON DELETE CASCADE;


--
-- Name: commission_calculations commission_calculations_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: commission_calculations commission_calculations_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: commission_calculations commission_calculations_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: commission_calculations commission_calculations_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id);


--
-- Name: commission_calculations commission_calculations_rate_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_rate_type_id_fkey FOREIGN KEY (rate_type_id) REFERENCES public."rateTypes"(id) ON DELETE CASCADE;


--
-- Name: commission_calculations commission_calculations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: commission_payment_batches commission_payment_batches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payment_batches
    ADD CONSTRAINT commission_payment_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: commission_payment_batches commission_payment_batches_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payment_batches
    ADD CONSTRAINT commission_payment_batches_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id);


--
-- Name: commission_rate_types commission_rate_types_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rate_types
    ADD CONSTRAINT commission_rate_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: commission_rate_types commission_rate_types_rate_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rate_types
    ADD CONSTRAINT commission_rate_types_rate_type_id_fkey FOREIGN KEY (rate_type_id) REFERENCES public."rateTypes"(id) ON DELETE CASCADE;


--
-- Name: designations designations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_created_by_fkey FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: designations designations_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_updated_by_fkey FOREIGN KEY ("updatedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: documentTypeRates documentTypeRates_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypeRates"
    ADD CONSTRAINT "documentTypeRates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: documentTypeRates documentTypeRates_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypeRates"
    ADD CONSTRAINT "documentTypeRates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id);


--
-- Name: documentTypeRates documentTypeRates_documentTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypeRates"
    ADD CONSTRAINT "documentTypeRates_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES public."documentTypes"(id) ON DELETE CASCADE;


--
-- Name: documentTypeRates documentTypeRates_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypeRates"
    ADD CONSTRAINT "documentTypeRates_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: documentTypes documentTypes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."documentTypes"
    ADD CONSTRAINT "documentTypes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: dsaConnectorVerificationReports dsaConnectorVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."dsaConnectorVerificationReports"
    ADD CONSTRAINT "dsaConnectorVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: error_logs error_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: field_user_commission_assignments field_user_commission_assignments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_user_commission_assignments
    ADD CONSTRAINT field_user_commission_assignments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: field_user_commission_assignments field_user_commission_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_user_commission_assignments
    ADD CONSTRAINT field_user_commission_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: field_user_commission_assignments field_user_commission_assignments_rate_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_user_commission_assignments
    ADD CONSTRAINT field_user_commission_assignments_rate_type_id_fkey FOREIGN KEY (rate_type_id) REFERENCES public."rateTypes"(id) ON DELETE CASCADE;


--
-- Name: field_user_commission_assignments field_user_commission_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_user_commission_assignments
    ADD CONSTRAINT field_user_commission_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_reports fk_ai_reports_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reports
    ADD CONSTRAINT fk_ai_reports_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: ai_reports fk_ai_reports_generated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reports
    ADD CONSTRAINT fk_ai_reports_generated_by FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attachments fk_attachments_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT fk_attachments_case_id FOREIGN KEY ("caseId") REFERENCES public.cases("caseId") ON DELETE CASCADE;


--
-- Name: attachments fk_attachments_case_uuid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT fk_attachments_case_uuid FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: autoSaves fk_autoSaves_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."autoSaves"
    ADD CONSTRAINT "fk_autoSaves_case_id" FOREIGN KEY ("caseId") REFERENCES public.cases("caseId") ON DELETE CASCADE;


--
-- Name: autoSaves fk_autosaves_case_uuid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."autoSaves"
    ADD CONSTRAINT fk_autosaves_case_uuid FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: builderVerificationReports fk_builder_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."builderVerificationReports"
    ADD CONSTRAINT fk_builder_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: builderVerificationReports fk_builder_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."builderVerificationReports"
    ADD CONSTRAINT fk_builder_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: businessVerificationReports fk_business_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."businessVerificationReports"
    ADD CONSTRAINT fk_business_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: businessVerificationReports fk_business_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."businessVerificationReports"
    ADD CONSTRAINT fk_business_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: caseDeduplicationAudit fk_caseDeduplicationAudit_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."caseDeduplicationAudit"
    ADD CONSTRAINT "fk_caseDeduplicationAudit_case_id" FOREIGN KEY ("caseId") REFERENCES public.cases("caseId") ON DELETE CASCADE;


--
-- Name: case_assignment_history fk_case_assignment_history_case_uuid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignment_history
    ADD CONSTRAINT fk_case_assignment_history_case_uuid FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_status_history fk_case_status_history_case; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_history
    ADD CONSTRAINT fk_case_status_history_case FOREIGN KEY ("caseId") REFERENCES public.cases("caseId") ON DELETE CASCADE;


--
-- Name: case_status_history fk_case_status_history_case_uuid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_history
    ADD CONSTRAINT fk_case_status_history_case_uuid FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_status_history fk_case_status_history_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_history
    ADD CONSTRAINT fk_case_status_history_user FOREIGN KEY ("transitionedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: caseDeduplicationAudit fk_casededuplicationaudit_case_uuid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."caseDeduplicationAudit"
    ADD CONSTRAINT fk_casededuplicationaudit_case_uuid FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: cases fk_cases_city_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_cases_city_id FOREIGN KEY ("cityId") REFERENCES public.cities(id) ON DELETE SET NULL;


--
-- Name: cases fk_cases_client_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_cases_client_id FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON DELETE RESTRICT;


--
-- Name: cases fk_cases_created_by_backend_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_cases_created_by_backend_user FOREIGN KEY ("createdByBackendUser") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cases fk_cases_product_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_cases_product_id FOREIGN KEY ("productId") REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: cases fk_cases_rate_type_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_cases_rate_type_id FOREIGN KEY ("rateTypeId") REFERENCES public."rateTypes"(id) ON DELETE SET NULL;


--
-- Name: cases fk_cases_verification_type_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_cases_verification_type_id FOREIGN KEY ("verificationTypeId") REFERENCES public."verificationTypes"(id) ON DELETE RESTRICT;


--
-- Name: cities fk_cities_country; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT fk_cities_country FOREIGN KEY ("countryId") REFERENCES public.countries(id);


--
-- Name: cities fk_cities_state; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT fk_cities_state FOREIGN KEY ("stateId") REFERENCES public.states(id);


--
-- Name: clientProducts fk_client_products_client; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientProducts"
    ADD CONSTRAINT fk_client_products_client FOREIGN KEY ("clientId") REFERENCES public.clients(id);


--
-- Name: clientProducts fk_client_products_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."clientProducts"
    ADD CONSTRAINT fk_client_products_product FOREIGN KEY ("productId") REFERENCES public.products(id);


--
-- Name: commission_calculations fk_commission_verification_task; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT fk_commission_verification_task FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id);


--
-- Name: departments fk_departments_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_created_by FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments fk_departments_head; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_head FOREIGN KEY ("departmentHeadId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments fk_departments_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_parent FOREIGN KEY ("parentDepartmentId") REFERENCES public.departments(id);


--
-- Name: departments fk_departments_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_updated_by FOREIGN KEY ("updatedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: designations fk_designations_department; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT fk_designations_department FOREIGN KEY ("departmentId") REFERENCES public.departments(id);


--
-- Name: dsaConnectorVerificationReports fk_dsa_connector_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."dsaConnectorVerificationReports"
    ADD CONSTRAINT fk_dsa_connector_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: dsaConnectorVerificationReports fk_dsa_connector_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."dsaConnectorVerificationReports"
    ADD CONSTRAINT fk_dsa_connector_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: locations fk_locations_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_locations_case_id FOREIGN KEY ("caseId") REFERENCES public.cases("caseId") ON DELETE CASCADE;


--
-- Name: locations fk_locations_case_uuid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_locations_case_uuid FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: locations fk_locations_task_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_locations_task_id FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE RESTRICT;


--
-- Name: mobile_notification_audit fk_mobile_notification_audit_case_uuid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_notification_audit
    ADD CONSTRAINT fk_mobile_notification_audit_case_uuid FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: nocVerificationReports fk_noc_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."nocVerificationReports"
    ADD CONSTRAINT fk_noc_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: nocVerificationReports fk_noc_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."nocVerificationReports"
    ADD CONSTRAINT fk_noc_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: officeVerificationReports fk_office_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."officeVerificationReports"
    ADD CONSTRAINT fk_office_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: officeVerificationReports fk_office_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."officeVerificationReports"
    ADD CONSTRAINT fk_office_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: pincodeAreas fk_pincode_areas_area; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."pincodeAreas"
    ADD CONSTRAINT fk_pincode_areas_area FOREIGN KEY ("areaId") REFERENCES public.areas(id);


--
-- Name: pincodeAreas fk_pincode_areas_pincode; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."pincodeAreas"
    ADD CONSTRAINT fk_pincode_areas_pincode FOREIGN KEY ("pincodeId") REFERENCES public.pincodes(id);


--
-- Name: pincodes fk_pincodes_city; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pincodes
    ADD CONSTRAINT fk_pincodes_city FOREIGN KEY ("cityId") REFERENCES public.cities(id);


--
-- Name: productVerificationTypes fk_product_verification_types_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productVerificationTypes"
    ADD CONSTRAINT fk_product_verification_types_product FOREIGN KEY ("productId") REFERENCES public.products(id);


--
-- Name: productVerificationTypes fk_product_verification_types_verification_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productVerificationTypes"
    ADD CONSTRAINT fk_product_verification_types_verification_type FOREIGN KEY ("verificationTypeId") REFERENCES public."verificationTypes"(id);


--
-- Name: propertyApfVerificationReports fk_property_apf_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."propertyApfVerificationReports"
    ADD CONSTRAINT fk_property_apf_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: propertyApfVerificationReports fk_property_apf_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."propertyApfVerificationReports"
    ADD CONSTRAINT fk_property_apf_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: propertyIndividualVerificationReports fk_property_individual_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."propertyIndividualVerificationReports"
    ADD CONSTRAINT fk_property_individual_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: propertyIndividualVerificationReports fk_property_individual_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."propertyIndividualVerificationReports"
    ADD CONSTRAINT fk_property_individual_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rateHistory fk_rate_history_rate; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateHistory"
    ADD CONSTRAINT fk_rate_history_rate FOREIGN KEY ("rateId") REFERENCES public.rates(id);


--
-- Name: rateTypeAssignments fk_rate_type_assignments_client; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypeAssignments"
    ADD CONSTRAINT fk_rate_type_assignments_client FOREIGN KEY ("clientId") REFERENCES public.clients(id);


--
-- Name: rateTypeAssignments fk_rate_type_assignments_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypeAssignments"
    ADD CONSTRAINT fk_rate_type_assignments_product FOREIGN KEY ("productId") REFERENCES public.products(id);


--
-- Name: rateTypeAssignments fk_rate_type_assignments_rate_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypeAssignments"
    ADD CONSTRAINT fk_rate_type_assignments_rate_type FOREIGN KEY ("rateTypeId") REFERENCES public."rateTypes"(id);


--
-- Name: rateTypeAssignments fk_rate_type_assignments_verification_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateTypeAssignments"
    ADD CONSTRAINT fk_rate_type_assignments_verification_type FOREIGN KEY ("verificationTypeId") REFERENCES public."verificationTypes"(id);


--
-- Name: rates fk_rates_client; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rates
    ADD CONSTRAINT fk_rates_client FOREIGN KEY ("clientId") REFERENCES public.clients(id);


--
-- Name: rates fk_rates_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rates
    ADD CONSTRAINT fk_rates_product FOREIGN KEY ("productId") REFERENCES public.products(id);


--
-- Name: rates fk_rates_rate_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rates
    ADD CONSTRAINT fk_rates_rate_type FOREIGN KEY ("rateTypeId") REFERENCES public."rateTypes"(id);


--
-- Name: rates fk_rates_verification_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rates
    ADD CONSTRAINT fk_rates_verification_type FOREIGN KEY ("verificationTypeId") REFERENCES public."verificationTypes"(id);


--
-- Name: residenceCumOfficeVerificationReports fk_res_cum_office_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."residenceCumOfficeVerificationReports"
    ADD CONSTRAINT fk_res_cum_office_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: residenceCumOfficeVerificationReports fk_res_cum_office_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."residenceCumOfficeVerificationReports"
    ADD CONSTRAINT fk_res_cum_office_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: residenceVerificationReports fk_residence_verification_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."residenceVerificationReports"
    ADD CONSTRAINT fk_residence_verification_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: residenceVerificationReports fk_residence_verification_verified_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."residenceVerificationReports"
    ADD CONSTRAINT fk_residence_verification_verified_by FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: roles fk_roles_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT fk_roles_created_by FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: roles fk_roles_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT fk_roles_updated_by FOREIGN KEY ("updatedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: states fk_states_country; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT fk_states_country FOREIGN KEY ("countryId") REFERENCES public.countries(id);


--
-- Name: task_assignment_history fk_task_assignment_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignment_history
    ADD CONSTRAINT fk_task_assignment_assigned_by FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: task_assignment_history fk_task_assignment_assigned_to; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignment_history
    ADD CONSTRAINT fk_task_assignment_assigned_to FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: task_assignment_history fk_task_assignment_case; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignment_history
    ADD CONSTRAINT fk_task_assignment_case FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: task_assignment_history fk_task_assignment_verification_task; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignment_history
    ADD CONSTRAINT fk_task_assignment_verification_task FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: task_commission_calculations fk_task_commission_case; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_commission_calculations
    ADD CONSTRAINT fk_task_commission_case FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: task_commission_calculations fk_task_commission_rate_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_commission_calculations
    ADD CONSTRAINT fk_task_commission_rate_type FOREIGN KEY (rate_type_id) REFERENCES public."rateTypes"(id);


--
-- Name: task_commission_calculations fk_task_commission_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_commission_calculations
    ADD CONSTRAINT fk_task_commission_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: task_commission_calculations fk_task_commission_verification_task; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_commission_calculations
    ADD CONSTRAINT fk_task_commission_verification_task FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: task_form_submissions fk_task_form_case; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_form_submissions
    ADD CONSTRAINT fk_task_form_case FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: task_form_submissions fk_task_form_submitted_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_form_submissions
    ADD CONSTRAINT fk_task_form_submitted_by FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: task_form_submissions fk_task_form_verification_task; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_form_submissions
    ADD CONSTRAINT fk_task_form_verification_task FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: territoryAssignmentAudit fk_territory_assignment_audit_performed_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."territoryAssignmentAudit"
    ADD CONSTRAINT fk_territory_assignment_audit_performed_by FOREIGN KEY ("performedBy") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: territoryAssignmentAudit fk_territory_assignment_audit_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."territoryAssignmentAudit"
    ADD CONSTRAINT fk_territory_assignment_audit_user FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userAreaAssignments fk_user_area_assignments_area; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userAreaAssignments"
    ADD CONSTRAINT fk_user_area_assignments_area FOREIGN KEY ("areaId") REFERENCES public.areas(id) ON DELETE CASCADE;


--
-- Name: userAreaAssignments fk_user_area_assignments_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userAreaAssignments"
    ADD CONSTRAINT fk_user_area_assignments_assigned_by FOREIGN KEY ("assignedBy") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: userAreaAssignments fk_user_area_assignments_pincode; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userAreaAssignments"
    ADD CONSTRAINT fk_user_area_assignments_pincode FOREIGN KEY ("pincodeId") REFERENCES public.pincodes(id) ON DELETE CASCADE;


--
-- Name: userAreaAssignments fk_user_area_assignments_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userAreaAssignments"
    ADD CONSTRAINT fk_user_area_assignments_user FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userAreaAssignments fk_user_area_assignments_user_pincode; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userAreaAssignments"
    ADD CONSTRAINT fk_user_area_assignments_user_pincode FOREIGN KEY ("userPincodeAssignmentId") REFERENCES public."userPincodeAssignments"(id) ON DELETE CASCADE;


--
-- Name: userClientAssignments fk_user_client_assignments_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userClientAssignments"
    ADD CONSTRAINT fk_user_client_assignments_assigned_by FOREIGN KEY ("assignedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: userClientAssignments fk_user_client_assignments_client; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userClientAssignments"
    ADD CONSTRAINT fk_user_client_assignments_client FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: userClientAssignments fk_user_client_assignments_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userClientAssignments"
    ADD CONSTRAINT fk_user_client_assignments_user FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userPincodeAssignments fk_user_pincode_assignments_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userPincodeAssignments"
    ADD CONSTRAINT fk_user_pincode_assignments_assigned_by FOREIGN KEY ("assignedBy") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: userPincodeAssignments fk_user_pincode_assignments_pincode; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userPincodeAssignments"
    ADD CONSTRAINT fk_user_pincode_assignments_pincode FOREIGN KEY ("pincodeId") REFERENCES public.pincodes(id) ON DELETE CASCADE;


--
-- Name: userPincodeAssignments fk_user_pincode_assignments_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userPincodeAssignments"
    ADD CONSTRAINT fk_user_pincode_assignments_user FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userProductAssignments fk_user_product_assignments_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userProductAssignments"
    ADD CONSTRAINT fk_user_product_assignments_assigned_by FOREIGN KEY ("assignedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: userProductAssignments fk_user_product_assignments_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userProductAssignments"
    ADD CONSTRAINT fk_user_product_assignments_product FOREIGN KEY ("productId") REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: userProductAssignments fk_user_product_assignments_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userProductAssignments"
    ADD CONSTRAINT fk_user_product_assignments_user FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users fk_users_department_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department_id FOREIGN KEY ("departmentId") REFERENCES public.departments(id);


--
-- Name: users fk_users_designation_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_designation_id FOREIGN KEY ("designationId") REFERENCES public.designations(id);


--
-- Name: users fk_users_role_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_role_id FOREIGN KEY ("roleId") REFERENCES public.roles(id);


--
-- Name: verification_attachments fk_verification_attachments_case_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_attachments
    ADD CONSTRAINT fk_verification_attachments_case_id FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: verification_attachments fk_verification_attachments_task_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_attachments
    ADD CONSTRAINT fk_verification_attachments_task_id FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT fk_verification_attachments_task_id ON verification_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT fk_verification_attachments_task_id ON public.verification_attachments IS 'Stage-1: Links photo evidence to a specific verification task. NULL for legacy records. RESTRICT deletion.';


--
-- Name: verification_attachments fk_verification_attachments_uploaded_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_attachments
    ADD CONSTRAINT fk_verification_attachments_uploaded_by FOREIGN KEY ("uploadedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: verification_tasks fk_verification_tasks_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT fk_verification_tasks_assigned_by FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: verification_tasks fk_verification_tasks_assigned_to; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT fk_verification_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: verification_tasks fk_verification_tasks_case; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT fk_verification_tasks_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: verification_tasks fk_verification_tasks_rate_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT fk_verification_tasks_rate_type FOREIGN KEY (rate_type_id) REFERENCES public."rateTypes"(id);


--
-- Name: verification_tasks fk_verification_tasks_verification_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT fk_verification_tasks_verification_type FOREIGN KEY (verification_type_id) REFERENCES public."verificationTypes"(id);


--
-- Name: form_quality_metrics form_quality_metrics_form_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_quality_metrics
    ADD CONSTRAINT form_quality_metrics_form_submission_id_fkey FOREIGN KEY (form_submission_id) REFERENCES public.form_submissions(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: form_submissions form_submissions_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id);


--
-- Name: form_submissions form_submissions_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_verification_task_id_fkey FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_verification_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_verification_type_id_fkey FOREIGN KEY (verification_type_id) REFERENCES public."verificationTypes"(id);


--
-- Name: form_validation_logs form_validation_logs_form_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_validation_logs
    ADD CONSTRAINT form_validation_logs_form_submission_id_fkey FOREIGN KEY (form_submission_id) REFERENCES public.form_submissions(id) ON DELETE CASCADE;


--
-- Name: locations locations_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_recorded_by_fkey FOREIGN KEY ("recordedBy") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: mobile_device_sync mobile_device_sync_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_device_sync
    ADD CONSTRAINT "mobile_device_sync_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mobile_notification_audit mobile_notification_audit_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_notification_audit
    ADD CONSTRAINT "mobile_notification_audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mobile_notification_queue mobile_notification_queue_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_notification_queue
    ADD CONSTRAINT "mobile_notification_queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nocVerificationReports nocVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."nocVerificationReports"
    ADD CONSTRAINT "nocVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: notification_batches notification_batches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_batches
    ADD CONSTRAINT notification_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notification_delivery_log notification_delivery_log_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_delivery_log
    ADD CONSTRAINT notification_delivery_log_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notificationTokens notification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."notificationTokens"
    ADD CONSTRAINT notification_tokens_user_id_fkey FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_tokens notification_tokens_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: officeVerificationReports officeVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."officeVerificationReports"
    ADD CONSTRAINT "officeVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: performance_metrics performance_metrics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_metrics
    ADD CONSTRAINT performance_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: productDocumentTypes productDocumentTypes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productDocumentTypes"
    ADD CONSTRAINT "productDocumentTypes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: productDocumentTypes productDocumentTypes_documentTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productDocumentTypes"
    ADD CONSTRAINT "productDocumentTypes_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES public."documentTypes"(id) ON DELETE CASCADE;


--
-- Name: productDocumentTypes productDocumentTypes_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."productDocumentTypes"
    ADD CONSTRAINT "productDocumentTypes_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: propertyApfVerificationReports propertyApfVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."propertyApfVerificationReports"
    ADD CONSTRAINT "propertyApfVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: propertyIndividualVerificationReports propertyIndividualVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."propertyIndividualVerificationReports"
    ADD CONSTRAINT "propertyIndividualVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: rateHistory rateHistory_changedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateHistory"
    ADD CONSTRAINT "rateHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rates rates_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rates
    ADD CONSTRAINT "rates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: refreshTokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."refreshTokens"
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: residenceCumOfficeVerificationReports residenceCumOfficeVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."residenceCumOfficeVerificationReports"
    ADD CONSTRAINT "residenceCumOfficeVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: residenceVerificationReports residenceVerificationReports_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."residenceVerificationReports"
    ADD CONSTRAINT "residenceVerificationReports_verification_task_id_fkey" FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: scheduled_reports scheduled_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: security_audit_events security_audit_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_events
    ADD CONSTRAINT security_audit_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: service_zone_rules service_zone_rules_service_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_zone_rules
    ADD CONSTRAINT service_zone_rules_service_zone_id_fkey FOREIGN KEY (service_zone_id) REFERENCES public.service_zones(id);


--
-- Name: template_reports template_reports_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_reports
    ADD CONSTRAINT template_reports_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: template_reports template_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_reports
    ADD CONSTRAINT template_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: trusted_devices trusted_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: userAreaAssignments userAreaAssignments_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userAreaAssignments"
    ADD CONSTRAINT "userAreaAssignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userClientAssignments userClientAssignments_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userClientAssignments"
    ADD CONSTRAINT "userClientAssignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userPincodeAssignments userPincodeAssignments_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userPincodeAssignments"
    ADD CONSTRAINT "userPincodeAssignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userProductAssignments userProductAssignments_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."userProductAssignments"
    ADD CONSTRAINT "userProductAssignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_attachments verification_attachments_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_attachments
    ADD CONSTRAINT verification_attachments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: verification_attachments verification_attachments_verification_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_attachments
    ADD CONSTRAINT verification_attachments_verification_task_id_fkey FOREIGN KEY (verification_task_id) REFERENCES public.verification_tasks(id) ON DELETE CASCADE;


--
-- Name: verification_tasks verification_tasks_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT verification_tasks_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: verification_tasks verification_tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT verification_tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.verification_tasks(id);


--
-- Name: verification_tasks verification_tasks_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT verification_tasks_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: verification_tasks verification_tasks_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT verification_tasks_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- Name: verification_tasks verification_tasks_service_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tasks
    ADD CONSTRAINT verification_tasks_service_zone_id_fkey FOREIGN KEY (service_zone_id) REFERENCES public.service_zones(id);


--
-- Name: zone_rate_type_mapping zone_rate_type_mapping_rate_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_rate_type_mapping
    ADD CONSTRAINT zone_rate_type_mapping_rate_type_id_fkey FOREIGN KEY (rate_type_id) REFERENCES public."rateTypes"(id);


--
-- Name: zone_rate_type_mapping zone_rate_type_mapping_service_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_rate_type_mapping
    ADD CONSTRAINT zone_rate_type_mapping_service_zone_id_fkey FOREIGN KEY (service_zone_id) REFERENCES public.service_zones(id);


--
-- PostgreSQL database dump complete
--

\unrestrict JdCR0PQe0KQxptrIgAfVfgwzzJ9AV9iWjLmO1bonHCZzjOpQJoJlCGFVNp1Kefb

