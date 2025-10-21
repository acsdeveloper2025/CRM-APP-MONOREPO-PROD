-- =====================================================
-- MIGRATION 007: FIX TRIGGER FUNCTION COLUMN NAMES
-- =====================================================
-- This migration fixes the trigger function to use correct column names
-- for the cases table (camelCase instead of snake_case).

-- Drop and recreate the trigger function with correct column names
DROP FUNCTION IF EXISTS update_case_completion_percentage() CASCADE;

CREATE OR REPLACE FUNCTION update_case_completion_percentage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cases 
    SET 
        completed_tasks_count = (
            SELECT COUNT(*) 
            FROM verification_tasks 
            WHERE case_id = NEW.case_id AND status = 'COMPLETED'
        ),
        case_completion_percentage = (
            SELECT 
                CASE 
                    WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND(
                        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::DECIMAL / 
                        COUNT(*)::DECIMAL * 100, 2
                    )
                END
            FROM verification_tasks 
            WHERE case_id = NEW.case_id
        ),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = NEW.case_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_case_completion ON verification_tasks;
CREATE TRIGGER trigger_update_case_completion
    AFTER INSERT OR UPDATE OF status ON verification_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_case_completion_percentage();

-- Also fix the update_task_updated_at function to handle both tables correctly
DROP FUNCTION IF EXISTS update_task_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers for task tables (these use snake_case)
DROP TRIGGER IF EXISTS trigger_update_task_updated_at ON verification_tasks;
CREATE TRIGGER trigger_update_task_updated_at
    BEFORE UPDATE ON verification_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_updated_at();

DROP TRIGGER IF EXISTS trigger_update_commission_updated_at ON task_commission_calculations;
CREATE TRIGGER trigger_update_commission_updated_at
    BEFORE UPDATE ON task_commission_calculations
    FOR EACH ROW
    EXECUTE FUNCTION update_task_updated_at();
