-- Migration: Add composite indexes for enterprise-scale query performance
-- Safe to run: CREATE INDEX IF NOT EXISTS is idempotent (won't fail if index exists)
-- Impact: Read performance improvement on high-traffic queries, minimal write overhead

-- Cases: Most frequently queried table
CREATE INDEX IF NOT EXISTS idx_cases_status_updated ON cases(status, "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_cases_client_product ON cases("clientId", "productId");
CREATE INDEX IF NOT EXISTS idx_cases_assigned_user_status ON cases("assignedUserId", status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_cases_priority_status ON cases(priority, status);

-- Verification Tasks: Joined with cases on nearly every case detail query
CREATE INDEX IF NOT EXISTS idx_verification_tasks_case_status ON verification_tasks("caseId", status);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_assigned_user ON verification_tasks("assignedUserId", status);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_updated ON verification_tasks("updatedAt" DESC);

-- Users: Auth lookups and user listings
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users("isActive");

-- Audit Logs: Frequently filtered by entity type, action, and date
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_action ON "auditLogs"("entityType", action, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON "auditLogs"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON "auditLogs"("createdAt" DESC);

-- User Assignments: Frequently joined for data scoping
CREATE INDEX IF NOT EXISTS idx_user_client_assignments_user ON "userClientAssignments"("userId");
CREATE INDEX IF NOT EXISTS idx_user_product_assignments_user ON "userProductAssignments"("userId");
CREATE INDEX IF NOT EXISTS idx_user_pincode_assignments_user ON "userPincodeAssignments"("userId");
CREATE INDEX IF NOT EXISTS idx_user_area_assignments_user ON "userAreaAssignments"("userId");

-- Role Permissions: Checked on every authenticated request
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions("roleId");
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles("userId");

-- Notifications: Frequently queried by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications("userId", "isRead", "createdAt" DESC);

-- Performance Metrics: Queried for monitoring dashboards
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_url_timestamp ON performance_metrics(url, timestamp DESC);

-- System Health Metrics: Queried for monitoring
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_name_ts ON system_health_metrics(metric_name, timestamp DESC);

-- Refresh Tokens: Looked up on every token refresh
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON "refreshTokens"(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON "refreshTokens"("userId");

-- Geographic data: Frequently used in location-based queries
CREATE INDEX IF NOT EXISTS idx_pincodes_pincode ON pincodes(pincode);
CREATE INDEX IF NOT EXISTS idx_pincode_areas_pincode ON "pincodeAreas"("pincodeId");
CREATE INDEX IF NOT EXISTS idx_pincode_areas_area ON "pincodeAreas"("areaId");
