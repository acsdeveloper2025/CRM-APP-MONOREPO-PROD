-- =====================================================
-- MIGRATION 003: CREATE VIEWS AND ANALYTICS
-- =====================================================
-- This migration creates analytical views and reporting functions
-- for the multi-verification task system.

-- Comprehensive case overview with task summary
CREATE OR REPLACE VIEW case_task_summary AS
SELECT 
    c.id as case_id,
    c."caseId" as case_number,
    c."customerName",
    c.status as case_status,
    c."createdAt" as case_created_at,
    c.has_multiple_tasks,
    c.total_tasks_count,
    c.completed_tasks_count,
    c.case_completion_percentage,
    
    -- Task statistics
    COUNT(vt.id) as actual_tasks_count,
    COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN vt.status = 'PENDING' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN vt.status = 'ASSIGNED' THEN 1 END) as assigned_tasks,
    COUNT(CASE WHEN vt.status = 'CANCELLED' THEN 1 END) as cancelled_tasks,
    
    -- Financial summary
    COALESCE(SUM(vt.estimated_amount), 0) as total_estimated_amount,
    COALESCE(SUM(vt.actual_amount), 0) as total_actual_amount,
    COALESCE(SUM(CASE WHEN vt.status = 'COMPLETED' THEN vt.actual_amount ELSE 0 END), 0) as completed_amount,
    
    -- Commission summary
    COALESCE(SUM(tcc.calculated_commission), 0) as total_commission,
    COALESCE(SUM(CASE WHEN tcc.status = 'PAID' THEN tcc.calculated_commission ELSE 0 END), 0) as paid_commission,
    
    -- Timing
    MIN(vt.assigned_at) as first_task_assigned,
    MAX(vt.completed_at) as last_task_completed
    
FROM cases c
LEFT JOIN verification_tasks vt ON c.id = vt.case_id
LEFT JOIN task_commission_calculations tcc ON vt.id = tcc.verification_task_id
GROUP BY c.id, c."caseId", c."customerName", c.status, c."createdAt", 
         c.has_multiple_tasks, c.total_tasks_count, c.completed_tasks_count, c.case_completion_percentage;

-- Field user task workload view
CREATE OR REPLACE VIEW field_user_task_workload AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u."employeeId",
    
    -- Task counts
    COUNT(vt.id) as total_assigned_tasks,
    COUNT(CASE WHEN vt.status = 'PENDING' OR vt.status = 'ASSIGNED' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN vt.status = 'CANCELLED' THEN 1 END) as cancelled_tasks,
    
    -- Performance metrics
    ROUND(
        CASE 
            WHEN COUNT(vt.id) = 0 THEN 0
            ELSE COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END)::DECIMAL / 
                 COUNT(vt.id) * 100
        END, 2
    ) as completion_rate_percentage,
    
    -- Financial metrics
    COALESCE(SUM(CASE WHEN vt.status = 'COMPLETED' THEN vt.actual_amount ELSE 0 END), 0) as total_completed_amount,
    COALESCE(SUM(tcc.calculated_commission), 0) as total_commission_earned,
    COALESCE(SUM(CASE WHEN tcc.status = 'PAID' THEN tcc.calculated_commission ELSE 0 END), 0) as paid_commission,
    
    -- Timing metrics
    ROUND(
        AVG(
            CASE WHEN vt.status = 'COMPLETED' AND vt.started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.started_at))/3600 
            END
        )::NUMERIC, 2
    ) as avg_completion_time_hours,
    
    -- Recent activity
    MAX(vt.completed_at) as last_task_completed,
    COUNT(CASE WHEN vt.status = 'COMPLETED' AND DATE(vt.completed_at) = CURRENT_DATE THEN 1 END) as completed_today
    
FROM users u
LEFT JOIN verification_tasks vt ON u.id = vt.assigned_to
LEFT JOIN task_commission_calculations tcc ON vt.id = tcc.verification_task_id
WHERE u.role = 'FIELD_USER'
GROUP BY u.id, u.name, u."employeeId";

-- Task type performance analytics
CREATE OR REPLACE VIEW task_type_analytics AS
SELECT 
    vtt.name as task_type_name,
    vtt.code as task_type_code,
    vtt.category,
    
    -- Volume metrics
    COUNT(vt.id) as total_tasks,
    COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN vt.status = 'PENDING' OR vt.status = 'ASSIGNED' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN vt.status = 'CANCELLED' THEN 1 END) as cancelled_tasks,
    
    -- Performance metrics
    ROUND(
        CASE 
            WHEN COUNT(vt.id) = 0 THEN 0
            ELSE COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END)::DECIMAL / 
                 COUNT(vt.id) * 100
        END, 2
    ) as completion_rate_percentage,
    
    -- Financial metrics
    ROUND(AVG(vt.estimated_amount)::NUMERIC, 2) as avg_estimated_amount,
    ROUND(AVG(vt.actual_amount)::NUMERIC, 2) as avg_actual_amount,
    COALESCE(SUM(vt.actual_amount), 0) as total_revenue,
    
    -- Timing metrics
    ROUND(
        AVG(
            CASE WHEN vt.status = 'COMPLETED' AND vt.started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.started_at))/3600 
            END
        )::NUMERIC, 2
    ) as avg_completion_time_hours,
    
    -- Recent trends
    COUNT(CASE WHEN vt.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as tasks_last_7_days,
    COUNT(CASE WHEN vt.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as tasks_last_30_days
    
FROM verification_task_types vtt
LEFT JOIN verification_tasks vt ON vtt.id = vt.verification_type_id
GROUP BY vtt.id, vtt.name, vtt.code, vtt.category;

-- Client task analytics view
CREATE OR REPLACE VIEW client_task_analytics AS
SELECT 
    c."clientId",
    cl.name as client_name,
    
    -- Case and task counts
    COUNT(DISTINCT c.id) as total_cases,
    COUNT(DISTINCT CASE WHEN c.has_multiple_tasks THEN c.id END) as multi_task_cases,
    COUNT(vt.id) as total_tasks,
    
    -- Task status breakdown
    COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN vt.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN vt.status = 'PENDING' OR vt.status = 'ASSIGNED' THEN 1 END) as pending_tasks,
    
    -- Financial metrics
    COALESCE(SUM(vt.estimated_amount), 0) as total_estimated_amount,
    COALESCE(SUM(vt.actual_amount), 0) as total_actual_amount,
    COALESCE(SUM(CASE WHEN vt.status = 'COMPLETED' THEN vt.actual_amount ELSE 0 END), 0) as completed_amount,
    
    -- Performance metrics
    ROUND(
        CASE 
            WHEN COUNT(vt.id) = 0 THEN 0
            ELSE COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END)::DECIMAL / 
                 COUNT(vt.id) * 100
        END, 2
    ) as task_completion_rate,
    
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT c.id) = 0 THEN 0
            ELSE COUNT(DISTINCT CASE WHEN c.status = 'COMPLETED' THEN c.id END)::DECIMAL / 
                 COUNT(DISTINCT c.id) * 100
        END, 2
    ) as case_completion_rate,
    
    -- Timing metrics
    ROUND(
        AVG(
            CASE WHEN c.status = 'COMPLETED' AND c."completedAt" IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (c."completedAt" - c."createdAt"))/86400 
            END
        )::NUMERIC, 2
    ) as avg_case_completion_days
    
FROM cases c
LEFT JOIN verification_tasks vt ON c.id = vt.case_id
LEFT JOIN clients cl ON c."clientId" = cl.id
GROUP BY c."clientId", cl.name;

-- Daily task performance view
CREATE OR REPLACE VIEW daily_task_performance AS
SELECT 
    DATE(vt.created_at) as task_date,
    
    -- Task creation metrics
    COUNT(*) as tasks_created,
    COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END) as tasks_completed,
    COUNT(CASE WHEN vt.assigned_to IS NOT NULL THEN 1 END) as tasks_assigned,
    
    -- Performance metrics
    ROUND(
        CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE COUNT(CASE WHEN vt.status = 'COMPLETED' THEN 1 END)::DECIMAL / 
                 COUNT(*) * 100
        END, 2
    ) as completion_rate,
    
    -- Financial metrics
    COALESCE(SUM(vt.estimated_amount), 0) as total_estimated_value,
    COALESCE(SUM(CASE WHEN vt.status = 'COMPLETED' THEN vt.actual_amount ELSE 0 END), 0) as total_completed_value,
    
    -- Timing metrics
    ROUND(
        AVG(
            CASE WHEN vt.status = 'COMPLETED' AND vt.started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (vt.completed_at - vt.started_at))/3600 
            END
        )::NUMERIC, 2
    ) as avg_completion_hours,
    
    -- Task type breakdown
    COUNT(CASE WHEN vtt.category = 'ADDRESS' THEN 1 END) as address_tasks,
    COUNT(CASE WHEN vtt.category = 'DOCUMENT' THEN 1 END) as document_tasks,
    COUNT(CASE WHEN vtt.category = 'BUSINESS' THEN 1 END) as business_tasks,
    COUNT(CASE WHEN vtt.category = 'IDENTITY' THEN 1 END) as identity_tasks
    
FROM verification_tasks vt
LEFT JOIN verification_task_types vtt ON vt.verification_type_id = vtt.id
WHERE vt.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(vt.created_at)
ORDER BY task_date DESC;

-- Commission analytics view
CREATE OR REPLACE VIEW commission_analytics AS
SELECT 
    DATE(tcc.calculation_date) as calculation_date,
    
    -- Commission metrics
    COUNT(*) as total_commissions,
    COUNT(CASE WHEN tcc.status = 'PAID' THEN 1 END) as paid_commissions,
    COUNT(CASE WHEN tcc.status = 'PENDING' OR tcc.status = 'CALCULATED' THEN 1 END) as pending_commissions,
    
    -- Financial metrics
    COALESCE(SUM(tcc.calculated_commission), 0) as total_commission_amount,
    COALESCE(SUM(CASE WHEN tcc.status = 'PAID' THEN tcc.calculated_commission ELSE 0 END), 0) as paid_commission_amount,
    COALESCE(SUM(CASE WHEN tcc.status = 'PENDING' OR tcc.status = 'CALCULATED' THEN tcc.calculated_commission ELSE 0 END), 0) as pending_commission_amount,
    
    -- Average metrics
    ROUND(AVG(tcc.calculated_commission)::NUMERIC, 2) as avg_commission_amount,
    ROUND(AVG(tcc.base_amount)::NUMERIC, 2) as avg_base_amount,
    
    -- User metrics
    COUNT(DISTINCT tcc.user_id) as unique_users,
    COUNT(DISTINCT tcc.case_id) as unique_cases
    
FROM task_commission_calculations tcc
WHERE tcc.calculation_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(tcc.calculation_date)
ORDER BY calculation_date DESC;
