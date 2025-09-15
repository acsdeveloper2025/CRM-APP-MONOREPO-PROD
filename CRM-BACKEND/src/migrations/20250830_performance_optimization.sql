-- Performance Optimization Migration
-- Date: 2025-08-30
-- Purpose: Add indexes and performance monitoring tables

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Users table indexes for frequently queried columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_id ON users("roleId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_department_id ON users("departmentId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_designation_id ON users("designationId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_employee_id ON users("employeeId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active ON users("isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users("lastLogin");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);

-- Cases table indexes for case management queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_client_id ON cases("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_assigned_to ON cases("assignedTo");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_priority ON cases(priority);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_created_at ON cases("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_updated_at ON cases("updatedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_verification_type_id ON cases("verificationTypeId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_product_id ON cases("productId");

-- Geographic indexes for location-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pincodes_city_id ON pincodes("cityId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cities_state_id ON cities("stateId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_states_country_id ON states("countryId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pincodes_code ON pincodes(code);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cities_name ON cities(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_states_name ON states(name);

-- Junction table indexes for many-to-many relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_products_client_id ON "clientProducts"("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_products_product_id ON "clientProducts"("productId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pincode_areas_pincode_id ON "pincodeAreas"("pincodeId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pincode_areas_area_id ON "pincodeAreas"("areaId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_pincode_assignments_user_id ON "userPincodeAssignments"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_pincode_assignments_pincode_id ON "userPincodeAssignments"("pincodeId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_area_assignments_user_id ON "userAreaAssignments"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_area_assignments_area_id ON "userAreaAssignments"("areaId");

-- Product and verification type indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_client_id ON products("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_verification_types_product_id ON "productVerificationTypes"("productId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_verification_types_verification_type_id ON "productVerificationTypes"("verificationTypeId");

-- Attachment and file indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attachments_case_id ON attachments("caseId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attachments_uploaded_by ON attachments("uploadedBy");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attachments_created_at ON attachments("createdAt");

-- Audit log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id ON "auditLogs"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity_type ON "auditLogs"("entityType");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity_id ON "auditLogs"("entityId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at ON "auditLogs"("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action ON "auditLogs"(action);

-- Full-text search indexes for better search performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_search ON users USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_name_search ON clients USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_customer_name_search ON cases USING gin(to_tsvector('english', "customerName"));

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_status_assigned_to ON cases(status, "assignedTo");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_client_status ON cases("clientId", status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active ON users(role, "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_created_status ON cases("createdAt", status);

-- ============================================================================
-- PERFORMANCE MONITORING TABLES
-- ============================================================================

-- Performance metrics table for request monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time DECIMAL(10,2) NOT NULL,
    memory_usage JSONB,
    user_id UUID REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Query performance table for database monitoring
CREATE TABLE IF NOT EXISTS query_performance (
    id BIGSERIAL PRIMARY KEY,
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    execution_time DECIMAL(10,2) NOT NULL,
    rows_returned INTEGER,
    rows_examined INTEGER,
    query_plan JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Error tracking table for centralized error logging
CREATE TABLE IF NOT EXISTS error_logs (
    id BIGSERIAL PRIMARY KEY,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    request_id VARCHAR(255),
    user_id UUID REFERENCES users(id),
    url TEXT,
    additional_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System health metrics table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PERFORMANCE MONITORING INDEXES
-- ============================================================================

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_response_time ON performance_metrics(response_time);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_url ON performance_metrics(url);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_status_code ON performance_metrics(status_code);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_query_performance_timestamp ON query_performance(timestamp);
CREATE INDEX IF NOT EXISTS idx_query_performance_execution_time ON query_performance(execution_time);
CREATE INDEX IF NOT EXISTS idx_query_performance_hash ON query_performance(query_hash);

-- Error logs indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_request_id ON error_logs(request_id);

-- System health metrics indexes
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_timestamp ON system_health_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_name ON system_health_metrics(metric_name);

-- ============================================================================
-- ENABLE POSTGRESQL EXTENSIONS FOR MONITORING
-- ============================================================================

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enable pg_buffercache for buffer cache monitoring
CREATE EXTENSION IF NOT EXISTS pg_buffercache;

-- ============================================================================
-- PERFORMANCE VIEWS
-- ============================================================================

-- View for slow queries analysis
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query_hash,
    query_text,
    AVG(execution_time) as avg_execution_time,
    MAX(execution_time) as max_execution_time,
    COUNT(*) as execution_count,
    MAX(timestamp) as last_execution
FROM query_performance 
WHERE execution_time > 100 -- Queries slower than 100ms
GROUP BY query_hash, query_text
ORDER BY avg_execution_time DESC;

-- View for error frequency analysis
CREATE OR REPLACE VIEW error_frequency AS
SELECT 
    error_type,
    COUNT(*) as error_count,
    MAX(timestamp) as last_occurrence,
    COUNT(DISTINCT user_id) as affected_users
FROM error_logs 
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY error_count DESC;

-- View for performance trends
CREATE OR REPLACE VIEW performance_trends AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(response_time) as avg_response_time,
    MAX(response_time) as max_response_time,
    COUNT(*) as request_count,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
FROM performance_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION analyze_table_stats(table_name TEXT)
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    index_size TEXT,
    total_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        table_name::TEXT,
        (SELECT reltuples::BIGINT FROM pg_class WHERE relname = table_name),
        pg_size_pretty(pg_total_relation_size(table_name::regclass) - pg_indexes_size(table_name::regclass)),
        pg_size_pretty(pg_indexes_size(table_name::regclass)),
        pg_size_pretty(pg_total_relation_size(table_name::regclass));
END;
$$ LANGUAGE plpgsql;

-- Function to get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT
) AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP AND MAINTENANCE
-- ============================================================================

-- Function to cleanup old performance data
CREATE OR REPLACE FUNCTION cleanup_performance_data(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE performance_metrics IS 'Stores HTTP request performance metrics for monitoring';
COMMENT ON TABLE query_performance IS 'Stores database query performance data for optimization';
COMMENT ON TABLE error_logs IS 'Centralized error logging for application monitoring';
COMMENT ON TABLE system_health_metrics IS 'System-level health and performance metrics';

COMMENT ON FUNCTION cleanup_performance_data IS 'Cleans up old performance monitoring data to prevent table bloat';
COMMENT ON FUNCTION analyze_table_stats IS 'Provides table size and row count statistics for performance analysis';
COMMENT ON FUNCTION get_index_usage IS 'Returns index usage statistics to identify unused indexes';

-- Migration completed successfully
SELECT 'Performance optimization migration completed successfully' as status;
