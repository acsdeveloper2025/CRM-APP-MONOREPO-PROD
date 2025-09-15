-- =====================================================
-- CRM DATABASE COMPLETE SQL DUMP
-- Generated: 2025-09-15
-- Purpose: Complete PostgreSQL database structure for CRM system
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CORE SYSTEM TABLES
-- =====================================================

-- Migrations table
CREATE TABLE IF NOT EXISTS migrations (
    id VARCHAR(255) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    "executedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Countries table
CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(3) NOT NULL UNIQUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- States table
CREATE TABLE IF NOT EXISTS states (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10),
    "countryId" INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, "countryId")
);

-- Cities table
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    "stateId" INTEGER NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    "countryId" INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, "stateId")
);

-- Pincodes table
CREATE TABLE IF NOT EXISTS pincodes (
    id SERIAL PRIMARY KEY,
    pincode VARCHAR(6) NOT NULL UNIQUE,
    "cityId" INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Areas table
CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "pincodeId" INTEGER NOT NULL REFERENCES pincodes(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, "pincodeId")
);

-- Pincode Areas junction table
CREATE TABLE IF NOT EXISTS pincode_areas (
    id SERIAL PRIMARY KEY,
    "pincodeId" INTEGER NOT NULL REFERENCES pincodes(id) ON DELETE CASCADE,
    "areaId" INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    "displayOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("pincodeId", "areaId")
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Designations table
CREATE TABLE IF NOT EXISTS designations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    "departmentId" INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    "roleId" INTEGER NOT NULL REFERENCES roles(id),
    "departmentId" INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    "designationId" INTEGER REFERENCES designations(id) ON DELETE SET NULL,
    "deviceId" VARCHAR(255),
    "isActive" BOOLEAN DEFAULT true,
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    "contactPerson" VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "clientId" INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, "clientId")
);

-- Verification Types table
CREATE TABLE IF NOT EXISTS "verificationTypes" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product Verification Types junction table
CREATE TABLE IF NOT EXISTS product_verification_types (
    id SERIAL PRIMARY KEY,
    "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "verificationTypeId" INTEGER NOT NULL REFERENCES "verificationTypes"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("productId", "verificationTypeId")
);

-- Rate Types table
CREATE TABLE IF NOT EXISTS "rateTypes" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    "clientId" INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "verificationTypeId" INTEGER NOT NULL REFERENCES "verificationTypes"(id) ON DELETE CASCADE,
    "areaId" INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'INR',
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("clientId", "verificationTypeId", "areaId", name)
);

-- Cases table (main table)
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "caseId" SERIAL UNIQUE NOT NULL,
    "customerName" VARCHAR(255) NOT NULL,
    "customerPhone" VARCHAR(20),
    "customerEmail" VARCHAR(255),
    address TEXT NOT NULL,
    pincode VARCHAR(6),
    "verificationType" VARCHAR(100) NOT NULL,
    "applicantType" VARCHAR(50) NOT NULL DEFAULT 'APPLICANT',
    product VARCHAR(255),
    client VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD')),
    "assignedTo" UUID REFERENCES users(id) ON DELETE SET NULL,
    "assignedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "backendContactNumber" VARCHAR(20),
    trigger TEXT,
    "customerCallingCode" VARCHAR(10) DEFAULT '+91',
    "rateTypeId" INTEGER REFERENCES "rateTypes"(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "assignedAt" TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- INDEXES FOR CORE TABLES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases("assignedTo");
CREATE INDEX IF NOT EXISTS idx_cases_verification_type ON cases("verificationType");
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases("createdAt");
CREATE INDEX IF NOT EXISTS idx_cases_customer_name ON cases("customerName");
CREATE INDEX IF NOT EXISTS idx_cases_customer_phone ON cases("customerPhone");
CREATE INDEX IF NOT EXISTS idx_cases_pincode ON cases(pincode);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users("roleId");
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users("departmentId");
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users("isActive");

CREATE INDEX IF NOT EXISTS idx_rate_types_client_verification_area ON "rateTypes"("clientId", "verificationTypeId", "areaId");
CREATE INDEX IF NOT EXISTS idx_rate_types_active ON "rateTypes"("isActive");

-- =====================================================
-- INITIAL DATA INSERTS
-- =====================================================

-- Insert default country
INSERT INTO countries (name, code) VALUES ('India', 'IN') ON CONFLICT (code) DO NOTHING;

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES 
('SUPER_ADMIN', 'Super Administrator with full access', '["*"]'),
('ADMIN', 'Administrator with management access', '["cases:*", "users:read", "reports:*"]'),
('BACKEND_USER', 'Backend user for case management', '["cases:*", "reports:read"]'),
('FIELD_USER', 'Field executive for verification', '["cases:read", "cases:update", "forms:*"]'),
('CLIENT_USER', 'Client user with limited access', '["cases:read", "reports:read"]')
ON CONFLICT (name) DO NOTHING;

-- Insert default departments
INSERT INTO departments (name, description) VALUES 
('Operations', 'Operations and case management'),
('Field Operations', 'Field verification team'),
('Quality Assurance', 'Quality control and review'),
('Administration', 'Administrative functions'),
('IT', 'Information Technology')
ON CONFLICT (name) DO NOTHING;

-- Insert default designations
INSERT INTO designations (name, description, "departmentId") VALUES 
('Manager', 'Department Manager', 1),
('Team Lead', 'Team Leader', 1),
('Executive', 'Executive level', 1),
('Field Executive', 'Field verification executive', 2),
('Senior Field Executive', 'Senior field verification executive', 2),
('QA Analyst', 'Quality Assurance Analyst', 3),
('Admin Officer', 'Administrative Officer', 4),
('System Administrator', 'System Administrator', 5)
ON CONFLICT (name) DO NOTHING;

-- Insert default verification types
INSERT INTO "verificationTypes" (name, description) VALUES 
('RESIDENCE', 'Residence verification'),
('OFFICE', 'Office verification'),
('BUSINESS', 'Business verification'),
('BUILDER', 'Builder verification'),
('RESIDENCE_CUM_OFFICE', 'Residence cum office verification'),
('DSA_CONNECTOR', 'DSA connector verification'),
('PROPERTY_INDIVIDUAL', 'Property individual verification'),
('PROPERTY_APF', 'Property APF verification'),
('NOC', 'NOC verification')
ON CONFLICT (name) DO NOTHING;

-- Insert default admin user (password: CHANGE_ME_PASSWORD)
INSERT INTO users (username, email, password, "firstName", "lastName", "roleId") VALUES 
('admin', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlG.', 'System', 'Administrator', 1)
ON CONFLICT (username) DO NOTHING;

-- Insert sample client
INSERT INTO clients (name, "contactPerson", email, phone) VALUES
('HDFC BANK LTD', 'Contact Person', 'contact@hdfc.com', '9876543210')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- VERIFICATION AND FORM TABLES
-- =====================================================

-- Verification Attachments table
CREATE TABLE IF NOT EXISTS verification_attachments (
    id SERIAL PRIMARY KEY,
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    verification_type VARCHAR(50) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "thumbnailPath" VARCHAR(500),
    "uploadedBy" UUID NOT NULL,
    "geoLocation" JSONB,
    "photoType" VARCHAR(50) DEFAULT 'verification',
    "submissionId" VARCHAR(100),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_verification_attachments_case_id
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_verification_attachments_uploaded_by
        FOREIGN KEY ("uploadedBy") REFERENCES users(id) ON DELETE SET NULL
);

-- Attachments table (general case attachments)
CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    filename VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "uploadedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_attachments_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_attachments_uploaded_by
        FOREIGN KEY ("uploadedBy") REFERENCES users(id) ON DELETE SET NULL
);

-- Case Assignment History table
CREATE TABLE IF NOT EXISTS case_assignment_history (
    id SERIAL PRIMARY KEY,
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    "assignedTo" UUID NOT NULL,
    "assignedBy" UUID NOT NULL,
    "assignedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "previousAssignee" UUID,
    reason TEXT,

    CONSTRAINT fk_case_assignment_history_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_case_assignment_history_assigned_to
        FOREIGN KEY ("assignedTo") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_case_assignment_history_assigned_by
        FOREIGN KEY ("assignedBy") REFERENCES users(id) ON DELETE CASCADE
);

-- Case Status History table
CREATE TABLE IF NOT EXISTS case_status_history (
    id SERIAL PRIMARY KEY,
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    "previousStatus" VARCHAR(50),
    "newStatus" VARCHAR(50) NOT NULL,
    "changedBy" UUID NOT NULL,
    "changedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,

    CONSTRAINT fk_case_status_history_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_case_status_history_changed_by
        FOREIGN KEY ("changedBy") REFERENCES users(id) ON DELETE CASCADE
);

-- Locations table (GPS tracking)
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    "recordedBy" UUID NOT NULL,
    "recordedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_locations_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_locations_recorded_by
        FOREIGN KEY ("recordedBy") REFERENCES users(id) ON DELETE CASCADE
);

-- Auto Saves table (mobile app auto-save)
CREATE TABLE IF NOT EXISTS "autoSaves" (
    id SERIAL PRIMARY KEY,
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    "userId" UUID NOT NULL,
    "formData" JSONB NOT NULL,
    "savedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_autoSaves_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_autoSaves_user_id
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Case Deduplication Audit table
CREATE TABLE IF NOT EXISTS "caseDeduplicationAudit" (
    id SERIAL PRIMARY KEY,
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    "duplicateFields" JSONB NOT NULL,
    "similarCases" JSONB,
    "checkedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "checkedBy" UUID,

    CONSTRAINT fk_caseDeduplicationAudit_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_caseDeduplicationAudit_checked_by
        FOREIGN KEY ("checkedBy") REFERENCES users(id) ON DELETE SET NULL
);

-- Mobile Notification Audit table
CREATE TABLE IF NOT EXISTS mobile_notification_audit (
    id SERIAL PRIMARY KEY,
    case_id UUID,
    "caseId" INTEGER,
    "userId" UUID NOT NULL,
    "notificationType" VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    "sentAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deliveryStatus" VARCHAR(20) DEFAULT 'SENT',
    "fcmToken" VARCHAR(500),

    CONSTRAINT fk_mobile_notification_audit_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_mobile_notification_audit_user_id
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- COMPREHENSIVE VERIFICATION TABLES
-- =====================================================

-- Residence Verification Reports table
CREATE TABLE IF NOT EXISTS "residenceVerificationReports" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    "caseId" INTEGER,

    -- Form Type and Metadata
    form_type VARCHAR(50) NOT NULL DEFAULT 'POSITIVE',
    verification_outcome VARCHAR(50) NOT NULL,

    -- Customer Information
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),

    -- Address and Location Fields
    address_locatable VARCHAR(50),
    address_rating VARCHAR(50),
    full_address TEXT,
    locality VARCHAR(100),
    address_structure VARCHAR(10),
    address_floor VARCHAR(10),
    address_structure_color VARCHAR(50),
    door_color VARCHAR(50),
    door_nameplate_status VARCHAR(50),
    name_on_door_plate VARCHAR(255),
    society_nameplate_status VARCHAR(50),
    name_on_society_board VARCHAR(255),
    company_nameplate_status VARCHAR(50),
    name_on_company_board VARCHAR(255),
    landmark1 VARCHAR(255),
    landmark2 VARCHAR(255),
    landmark3 VARCHAR(255),
    landmark4 VARCHAR(255),

    -- Person Met and Relationship
    house_status VARCHAR(50),
    room_status VARCHAR(50),
    met_person_name VARCHAR(255),
    met_person_relation VARCHAR(50),
    met_person_status VARCHAR(50),
    staying_person_name VARCHAR(255),

    -- Family and Personal Details
    total_family_members INTEGER,
    total_earning DECIMAL(15,2),
    applicant_dob DATE,
    applicant_age INTEGER,
    working_status VARCHAR(50),
    company_name VARCHAR(255),
    staying_period VARCHAR(100),
    staying_status VARCHAR(50),
    approx_area INTEGER,

    -- Document Verification
    document_shown_status VARCHAR(50),
    document_type VARCHAR(50),

    -- Third Party Confirmation
    tpc_met_person1 VARCHAR(50),
    tpc_name1 VARCHAR(255),
    tpc_confirmation1 VARCHAR(50),
    tpc_met_person2 VARCHAR(50),
    tpc_name2 VARCHAR(255),
    tpc_confirmation2 VARCHAR(50),

    -- Shifted Form Specific Fields
    shifted_period VARCHAR(100),
    premises_status VARCHAR(50),

    -- Entry Restricted Form Specific Fields
    name_of_met_person VARCHAR(255),
    met_person_type VARCHAR(50),
    met_person_confirmation VARCHAR(50),
    applicant_staying_status VARCHAR(50),

    -- Untraceable Form Specific Fields
    call_remark VARCHAR(50),

    -- Area Assessment
    political_connection VARCHAR(100),
    dominated_area VARCHAR(100),
    feedback_from_neighbour VARCHAR(100),
    other_observation TEXT,

    -- Final Status and Outcome
    final_status VARCHAR(50) NOT NULL,
    hold_reason TEXT,
    recommendation_status VARCHAR(50),

    -- Verification Metadata
    verification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_time TIME NOT NULL DEFAULT CURRENT_TIME,
    "verifiedBy" UUID NOT NULL,
    "submissionId" VARCHAR(100) UNIQUE,
    "formData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_residenceVerificationReports_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_residenceVerificationReports_verified_by
        FOREIGN KEY ("verifiedBy") REFERENCES users(id) ON DELETE CASCADE
);

-- Business Verification Reports table
CREATE TABLE IF NOT EXISTS "businessVerificationReports" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    "caseId" INTEGER,

    -- Form Type and Metadata
    form_type VARCHAR(50) NOT NULL DEFAULT 'POSITIVE',
    verification_outcome VARCHAR(50) NOT NULL,

    -- Basic Information
    customer_name VARCHAR(255),
    met_person_name VARCHAR(255),
    designation VARCHAR(255),
    applicant_designation VARCHAR(255),

    -- Business Details
    business_status VARCHAR(50),
    business_type VARCHAR(100),
    nature_of_business VARCHAR(255),
    business_period VARCHAR(100),
    establishment_period VARCHAR(100),
    business_existence VARCHAR(50),
    business_activity VARCHAR(255),
    business_setup VARCHAR(255),
    business_approximate_area INTEGER,
    staff_strength INTEGER,
    staff_seen INTEGER,
    ownership_type VARCHAR(100),
    owner_name VARCHAR(255),
    business_owner_name VARCHAR(255),
    name_of_company_owners VARCHAR(255),

    -- Working Details
    working_period VARCHAR(100),
    working_status VARCHAR(50),
    applicant_working_premises VARCHAR(255),
    applicant_working_status VARCHAR(50),

    -- Document Verification
    document_shown VARCHAR(255),
    document_type VARCHAR(255),

    -- Location Details
    address_locatable VARCHAR(50),
    address_rating VARCHAR(50),
    locality_type VARCHAR(100),
    address_structure VARCHAR(10),
    address_floor VARCHAR(255),
    address_status VARCHAR(100),
    premises_status VARCHAR(50),
    company_nameplate_status VARCHAR(50),
    name_on_company_board VARCHAR(255),
    landmark1 VARCHAR(255),
    landmark2 VARCHAR(255),

    -- TPC Details
    tpc_met_person1 VARCHAR(50),
    tpc_name1 VARCHAR(255),
    tpc_confirmation1 VARCHAR(50),
    tpc_met_person2 VARCHAR(50),
    tpc_name2 VARCHAR(255),
    tpc_confirmation2 VARCHAR(50),
    name_of_tpc1 VARCHAR(255),
    name_of_tpc2 VARCHAR(255),

    -- Shifting Details
    shifted_period VARCHAR(100),
    old_business_shifted_period VARCHAR(100),
    current_company_name VARCHAR(255),
    current_company_period VARCHAR(100),

    -- Contact & Communication
    contact_person VARCHAR(255),
    call_remark VARCHAR(255),
    name_of_met_person VARCHAR(255),
    met_person_type VARCHAR(50),
    met_person_confirmation VARCHAR(50),

    -- Area Assessment
    political_connection VARCHAR(100),
    dominated_area VARCHAR(100),
    feedback_from_neighbour VARCHAR(100),
    other_observations TEXT,
    other_extra_remarks TEXT,
    final_status VARCHAR(50) NOT NULL,
    hold_reason TEXT,
    recommendation_status VARCHAR(50),

    -- Verification Metadata
    verification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_time TIME NOT NULL DEFAULT CURRENT_TIME,
    "verifiedBy" UUID NOT NULL,
    "submissionId" VARCHAR(100) UNIQUE,
    "formData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_businessVerificationReports_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_businessVerificationReports_verified_by
        FOREIGN KEY ("verifiedBy") REFERENCES users(id) ON DELETE CASCADE
);

-- Office Verification Reports table
CREATE TABLE IF NOT EXISTS "officeVerificationReports" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    "caseId" INTEGER,

    -- Basic Information
    customer_name VARCHAR(255),
    verification_outcome VARCHAR(50) NOT NULL,
    met_person_name VARCHAR(255),
    designation VARCHAR(255),

    -- Office Details
    office_status VARCHAR(50),
    company_name VARCHAR(255),
    nature_of_business VARCHAR(255),
    establishment_period VARCHAR(100),

    -- Location and Address
    address_locatable VARCHAR(50),
    address_rating VARCHAR(50),
    full_address TEXT,
    locality VARCHAR(100),

    -- Final Status
    final_status VARCHAR(50) NOT NULL,
    recommendation_status VARCHAR(50),

    -- Verification Metadata
    verification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_time TIME NOT NULL DEFAULT CURRENT_TIME,
    "verifiedBy" UUID NOT NULL,
    "submissionId" VARCHAR(100) UNIQUE,
    "formData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_officeVerificationReports_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_officeVerificationReports_verified_by
        FOREIGN KEY ("verifiedBy") REFERENCES users(id) ON DELETE CASCADE
);

-- Template Reports table
CREATE TABLE IF NOT EXISTS template_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    "caseId" INTEGER,
    verification_type VARCHAR(50) NOT NULL,
    verification_outcome VARCHAR(50) NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    report_content TEXT NOT NULL,
    generated_by UUID NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_template_reports_case_uuid
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_template_reports_generated_by
        FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- COMMISSION SYSTEM TABLES
-- =====================================================

-- Commission Rate Types table
CREATE TABLE IF NOT EXISTS commission_rate_types (
    id BIGSERIAL PRIMARY KEY,
    rate_type_id INTEGER NOT NULL REFERENCES "rateTypes"(id) ON DELETE CASCADE,
    commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
    commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_commission_rate_types_amount_or_percentage
    CHECK ((commission_amount IS NOT NULL AND commission_percentage IS NULL) OR
           (commission_amount IS NULL AND commission_percentage IS NOT NULL))
);

-- Field User Commission Assignments table
CREATE TABLE IF NOT EXISTS field_user_commission_assignments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rate_type_id INTEGER NOT NULL REFERENCES "rateTypes"(id) ON DELETE CASCADE,
    commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
    commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    currency VARCHAR(3) DEFAULT 'INR',
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_field_user_commission_amount_or_percentage
    CHECK ((commission_amount IS NOT NULL AND commission_percentage IS NULL) OR
           (commission_amount IS NULL AND commission_percentage IS NOT NULL)),

    CONSTRAINT uk_field_user_commission_assignments
    UNIQUE (user_id, rate_type_id, client_id, effective_from)
);

-- Commission Calculations table
CREATE TABLE IF NOT EXISTS commission_calculations (
    id BIGSERIAL PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    case_number INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    rate_type_id INTEGER NOT NULL REFERENCES "rateTypes"(id) ON DELETE CASCADE,
    base_amount DECIMAL(10,2) NOT NULL CHECK (base_amount >= 0),
    commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
    commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    calculated_commission DECIMAL(10,2) NOT NULL CHECK (calculated_commission >= 0),
    currency VARCHAR(3) DEFAULT 'INR',
    calculation_method VARCHAR(20) NOT NULL CHECK (calculation_method IN ('FIXED_AMOUNT', 'PERCENTAGE')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'REJECTED')),
    case_completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_by UUID REFERENCES users(id),
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Commission Payment Batches table
CREATE TABLE IF NOT EXISTS commission_payment_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    total_commissions INTEGER NOT NULL CHECK (total_commissions >= 0),
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    created_by UUID NOT NULL REFERENCES users(id),
    processed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Commission Batch Items table
CREATE TABLE IF NOT EXISTS commission_batch_items (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL REFERENCES commission_payment_batches(id) ON DELETE CASCADE,
    commission_id BIGINT NOT NULL REFERENCES commission_calculations(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_commission_batch_items_commission
    UNIQUE (commission_id)
);

-- =====================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- =====================================================

-- Verification attachments indexes
CREATE INDEX IF NOT EXISTS idx_verification_attachments_case_id ON verification_attachments(case_id);
CREATE INDEX IF NOT EXISTS idx_verification_attachments_verification_type ON verification_attachments(verification_type);
CREATE INDEX IF NOT EXISTS idx_verification_attachments_submission_id ON verification_attachments("submissionId");
CREATE INDEX IF NOT EXISTS idx_verification_attachments_photo_type ON verification_attachments("photoType");

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_attachments_case_uuid ON attachments(case_id);

-- Case assignment history indexes
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_case_uuid ON case_assignment_history(case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignment_history_assigned_to ON case_assignment_history("assignedTo");

-- Case status history indexes
CREATE INDEX IF NOT EXISTS idx_case_status_history_case_uuid ON case_status_history(case_id);
CREATE INDEX IF NOT EXISTS idx_case_status_history_new_status ON case_status_history("newStatus");

-- Locations indexes
CREATE INDEX IF NOT EXISTS idx_locations_case_uuid ON locations(case_id);

-- Auto saves indexes
CREATE INDEX IF NOT EXISTS idx_autoSaves_case_uuid ON "autoSaves"(case_id);
CREATE INDEX IF NOT EXISTS idx_autoSaves_user_id ON "autoSaves"("userId");

-- Verification reports indexes
CREATE INDEX IF NOT EXISTS idx_residenceVerificationReports_case_uuid ON "residenceVerificationReports"(case_id);
CREATE INDEX IF NOT EXISTS idx_residenceVerificationReports_submission_id ON "residenceVerificationReports"("submissionId");
CREATE INDEX IF NOT EXISTS idx_businessVerificationReports_case_uuid ON "businessVerificationReports"(case_id);
CREATE INDEX IF NOT EXISTS idx_businessVerificationReports_submission_id ON "businessVerificationReports"("submissionId");
CREATE INDEX IF NOT EXISTS idx_officeVerificationReports_case_uuid ON "officeVerificationReports"(case_id);

-- Commission system indexes
CREATE INDEX IF NOT EXISTS idx_commission_rate_types_rate_type_id ON commission_rate_types(rate_type_id);
CREATE INDEX IF NOT EXISTS idx_field_user_commission_user_id ON field_user_commission_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_field_user_commission_rate_type_id ON field_user_commission_assignments(rate_type_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_case_id ON commission_calculations(case_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_user_id ON commission_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_status ON commission_calculations(status);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT COLUMNS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for tables with updatedAt columns
CREATE TRIGGER update_countries_updated_at
    BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_states_updated_at
    BEFORE UPDATE ON states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cities_updated_at
    BEFORE UPDATE ON cities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pincodes_updated_at
    BEFORE UPDATE ON pincodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_areas_updated_at
    BEFORE UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_designations_updated_at
    BEFORE UPDATE ON designations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verification_types_updated_at
    BEFORE UPDATE ON "verificationTypes"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_types_updated_at
    BEFORE UPDATE ON "rateTypes"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verification_attachments_updated_at
    BEFORE UPDATE ON verification_attachments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attachments_updated_at
    BEFORE UPDATE ON attachments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_residence_verification_reports_updated_at
    BEFORE UPDATE ON "residenceVerificationReports"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_verification_reports_updated_at
    BEFORE UPDATE ON "businessVerificationReports"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_office_verification_reports_updated_at
    BEFORE UPDATE ON "officeVerificationReports"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR FORM SUBMISSIONS
-- =====================================================

-- Form Submissions View
CREATE OR REPLACE VIEW form_submissions_view AS
SELECT
    'RESIDENCE' as form_type,
    r.case_id,
    r."verifiedBy" as submitted_by,
    r."createdAt" as submitted_at,
    CASE
        WHEN r.final_status IS NOT NULL THEN 'VALID'
        ELSE 'PENDING'
    END as validation_status,
    jsonb_build_object(
        'customerName', r.customer_name,
        'address', r.full_address,
        'metPersonName', r.met_person_name,
        'relationship', r.met_person_relation,
        'finalStatus', r.final_status,
        'verificationOutcome', r.verification_outcome
    ) as submission_data,
    (SELECT COUNT(*) FROM verification_attachments va WHERE va.case_id = r.case_id AND va.verification_type = 'RESIDENCE') as photos_count
FROM "residenceVerificationReports" r

UNION ALL

SELECT
    'BUSINESS' as form_type,
    b.case_id,
    b."verifiedBy" as submitted_by,
    b."createdAt" as submitted_at,
    CASE
        WHEN b.final_status IS NOT NULL THEN 'VALID'
        ELSE 'PENDING'
    END as validation_status,
    jsonb_build_object(
        'customerName', b.customer_name,
        'businessName', b.company_name,
        'metPersonName', b.met_person_name,
        'designation', b.designation,
        'finalStatus', b.final_status,
        'verificationOutcome', b.verification_outcome
    ) as submission_data,
    (SELECT COUNT(*) FROM verification_attachments va WHERE va.case_id = b.case_id AND va.verification_type = 'BUSINESS') as photos_count
FROM "businessVerificationReports" b

UNION ALL

SELECT
    'OFFICE' as form_type,
    o.case_id,
    o."verifiedBy" as submitted_by,
    o."createdAt" as submitted_at,
    CASE
        WHEN o.final_status IS NOT NULL THEN 'VALID'
        ELSE 'PENDING'
    END as validation_status,
    jsonb_build_object(
        'customerName', o.customer_name,
        'companyName', o.company_name,
        'metPersonName', o.met_person_name,
        'designation', o.designation,
        'finalStatus', o.final_status,
        'verificationOutcome', o.verification_outcome
    ) as submission_data,
    (SELECT COUNT(*) FROM verification_attachments va WHERE va.case_id = o.case_id AND va.verification_type = 'OFFICE') as photos_count
FROM "officeVerificationReports" o;

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert sample states for India
INSERT INTO states (name, code, "countryId") VALUES
('Maharashtra', 'MH', 1),
('Karnataka', 'KA', 1),
('Tamil Nadu', 'TN', 1),
('Gujarat', 'GJ', 1),
('Delhi', 'DL', 1)
ON CONFLICT (name, "countryId") DO NOTHING;

-- Insert sample cities
INSERT INTO cities (name, "stateId", "countryId") VALUES
('Mumbai', 1, 1),
('Pune', 1, 1),
('Bangalore', 2, 1),
('Chennai', 3, 1),
('Ahmedabad', 4, 1),
('New Delhi', 5, 1)
ON CONFLICT (name, "stateId") DO NOTHING;

-- Insert sample pincodes
INSERT INTO pincodes (pincode, "cityId") VALUES
('400001', 1),
('400002', 1),
('411001', 2),
('560001', 3),
('600001', 4),
('380001', 5),
('110001', 6)
ON CONFLICT (pincode) DO NOTHING;

-- Insert sample areas
INSERT INTO areas (name, "pincodeId") VALUES
('Andheri West', 1),
('Bandra', 1),
('Koregaon Park', 3),
('MG Road', 3),
('T Nagar', 4),
('Connaught Place', 6)
ON CONFLICT (name, "pincodeId") DO NOTHING;

-- Insert sample products for HDFC
INSERT INTO products (name, description, "clientId") VALUES
('Personal Loan', 'Personal loan verification', 1),
('Home Loan', 'Home loan verification', 1),
('Credit Card', 'Credit card verification', 1),
('Business Loan', 'Business loan verification', 1)
ON CONFLICT (name, "clientId") DO NOTHING;

-- Insert sample rate types
INSERT INTO "rateTypes" (name, description, "clientId", "verificationTypeId", "areaId", amount) VALUES
('Standard Rate - Residence', 'Standard rate for residence verification', 1, 1, 1, 500.00),
('Standard Rate - Business', 'Standard rate for business verification', 1, 3, 1, 750.00),
('Standard Rate - Office', 'Standard rate for office verification', 1, 2, 1, 600.00)
ON CONFLICT ("clientId", "verificationTypeId", "areaId", name) DO NOTHING;

-- =====================================================
-- FINAL COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON DATABASE CURRENT_DATABASE() IS 'CRM Database - Complete structure for case management, verification, and commission system';

-- Table comments
COMMENT ON TABLE cases IS 'Main cases table with UUID primary key and business caseId';
COMMENT ON TABLE verification_attachments IS 'Verification images and documents from mobile submissions';
COMMENT ON TABLE "residenceVerificationReports" IS 'Comprehensive residence verification form data';
COMMENT ON TABLE "businessVerificationReports" IS 'Comprehensive business verification form data';
COMMENT ON TABLE commission_calculations IS 'Commission calculations for completed cases';
COMMENT ON TABLE field_user_commission_assignments IS 'Commission rate assignments for field users';

-- Column comments
COMMENT ON COLUMN cases.id IS 'UUID primary key for internal references';
COMMENT ON COLUMN cases."caseId" IS 'Sequential business identifier for display';
COMMENT ON COLUMN verification_attachments."geoLocation" IS 'GPS coordinates where photo was captured';
COMMENT ON COLUMN verification_attachments."photoType" IS 'Type: verification, selfie, document';

-- =====================================================
-- GRANT PERMISSIONS (Uncomment and modify as needed)
-- =====================================================
-- GRANT CONNECT ON DATABASE your_database TO your_app_user;
-- GRANT USAGE ON SCHEMA public TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- =====================================================
-- MIGRATION COMPLETION LOG
-- =====================================================
INSERT INTO migrations (id, filename, "executedAt") VALUES
('complete_database_setup', 'crm_database_complete.sql', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- END OF CRM DATABASE SETUP
-- =====================================================
