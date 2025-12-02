-- Migration: Update trigger to sync case status based on tasks
-- Date: 2025-12-02
-- Purpose: Ensure case status transitions to COMPLETED/IN_PROGRESS/ASSIGNED based on task statuses

CREATE OR REPLACE FUNCTION update_case_completion_percentage()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;
