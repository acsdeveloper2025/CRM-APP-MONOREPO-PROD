# CRM Database & Backend API Documentation

## 📊 Database Architecture Overview

### Database Configuration
```
Database: PostgreSQL 16.10
Database Name: acs_db
Connection Pool: Enterprise-scale (50-500 connections)
Scaling: 1 connection per 6 concurrent users
Extensions: pg_buffercache, pg_stat_statements, pg_trgm
```

### Connection Pool Configuration
```typescript
Max Connections: 50-500 (based on concurrent users)
Min Connections: 30-167 (33% of max)
Idle Timeout: 45 seconds
Connection Timeout: 3 seconds
Query Timeout: 20 seconds
Statement Timeout: 25 seconds
```

## 🗄️ Core Database Tables

### 1. Users & Authentication
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    passwordHash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    isActive BOOLEAN DEFAULT true,
    lastLogin TIMESTAMP WITH TIME ZONE,
    employeeId VARCHAR(50),
    designation VARCHAR(100),
    department VARCHAR(100),
    profilePhotoUrl VARCHAR(500),
    roleId INTEGER,
    departmentId INTEGER,
    designationId INTEGER,
    performance_rating NUMERIC(3,2),
    total_cases_handled INTEGER DEFAULT 0,
    avg_case_completion_days NUMERIC(6,2),
    last_active_at TIMESTAMP,
    preferred_form_types VARCHAR(100),
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE roles (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}' NOT NULL,
    isSystemRole BOOLEAN DEFAULT false NOT NULL,
    isActive BOOLEAN DEFAULT true NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    createdBy UUID,
    updatedBy UUID
);

-- Departments table
CREATE TABLE departments (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    departmentHeadId UUID,
    isActive BOOLEAN DEFAULT true NOT NULL,
    parentDepartmentId INTEGER,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    createdBy UUID,
    updatedBy UUID
);

-- Designations table
CREATE TABLE designations (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    departmentId INTEGER,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    createdBy UUID,
    updatedBy UUID
);

-- Refresh tokens
CREATE TABLE refreshTokens (
    id BIGINT PRIMARY KEY,
    userId UUID NOT NULL,
    token VARCHAR(500) NOT NULL,
    expiresAt TIMESTAMP WITH TIME ZONE NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Cases Management
```sql
-- Cases table (Main entity)
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caseId VARCHAR(50) UNIQUE NOT NULL, -- Business identifier
    customerName VARCHAR(255) NOT NULL,
    customerPhone VARCHAR(20),
    customerCallingCode VARCHAR(50), -- Auto-generated: CC-timestamp+random
    customerEmail VARCHAR(255),
    clientId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    verificationTypeId INTEGER NOT NULL,
    address TEXT,
    cityId INTEGER,
    pincode VARCHAR(10),
    status VARCHAR(20) DEFAULT 'PENDING',
    priority VARCHAR(10) DEFAULT 'MEDIUM',
    applicantType VARCHAR(50),
    trigger TEXT, -- Additional information or special instructions
    backendContactNumber VARCHAR(20),
    assignedTo UUID,
    assignedBy UUID,
    rateTypeId INTEGER,
    verificationOutcome VARCHAR(50),
    verificationType VARCHAR(100), -- Verification type name
    createdByBackendUser UUID,
    completedAt TIMESTAMP WITH TIME ZONE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case status history
CREATE TABLE case_status_history (
    id VARCHAR(255) PRIMARY KEY,
    caseId INTEGER NOT NULL,
    case_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    transitionedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    transitionedBy UUID,
    transitionReason TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case assignment history
CREATE TABLE case_assignment_history (
    id INTEGER PRIMARY KEY,
    caseId INTEGER,
    case_id UUID NOT NULL,
    previousAssignee UUID,
    newAssignee UUID NOT NULL,
    fromUserId UUID,
    reason TEXT,
    assignedBy UUID NOT NULL,
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case timeline events
CREATE TABLE case_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(30) DEFAULT 'GENERAL' NOT NULL,
    performed_by UUID,
    event_data JSONB DEFAULT '{}',
    previous_value TEXT,
    new_value TEXT,
    event_description TEXT,
    is_system_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
```

### 3. Form Submissions & Verification Reports
```sql
-- Form submissions (Generic)
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    form_type VARCHAR(50) NOT NULL, -- RESIDENCE, OFFICE, BUSINESS
    submitted_by UUID NOT NULL,
    submission_data JSONB DEFAULT '{}' NOT NULL,
    validation_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    validation_errors JSONB DEFAULT '[]',
    photos_count INTEGER DEFAULT 0,
    attachments_count INTEGER DEFAULT 0,
    geo_location JSONB,
    submission_score NUMERIC(5,2),
    time_spent_minutes INTEGER,
    device_info JSONB DEFAULT '{}',
    network_quality VARCHAR(20),
    submitted_at TIMESTAMP DEFAULT now() NOT NULL,
    validated_at TIMESTAMP,
    validated_by UUID,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Residence verification reports
CREATE TABLE residenceVerificationReports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    caseId INTEGER,
    form_type VARCHAR(50) DEFAULT 'POSITIVE' NOT NULL,
    verification_outcome VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    address_locatable VARCHAR(50),
    address_rating VARCHAR(50),
    locality VARCHAR(255),
    address_structure VARCHAR(100),
    address_floor VARCHAR(50),
    address_structure_color VARCHAR(100),
    door_color VARCHAR(100),
    door_nameplate_status VARCHAR(50),
    name_on_door_plate VARCHAR(255),
    society_nameplate_status VARCHAR(50),
    name_on_society_board VARCHAR(255),
    landmark1 VARCHAR(255),
    landmark2 VARCHAR(255),
    landmark3 VARCHAR(255),
    landmark4 VARCHAR(255),
    house_status VARCHAR(100),
    room_status VARCHAR(100),
    met_person_name VARCHAR(255),
    met_person_relation VARCHAR(100),
    met_person_status VARCHAR(100),
    staying_person_name VARCHAR(255),
    total_family_members INTEGER,
    total_earning NUMERIC(12,2),
    working_status VARCHAR(100),
    company_name VARCHAR(255),
    staying_period VARCHAR(100),
    staying_status VARCHAR(100),
    approx_area VARCHAR(100),
    document_shown_status VARCHAR(50),
    document_type VARCHAR(100),
    remarks TEXT,
    final_status VARCHAR(50),
    submitted_by UUID,
    submitted_at TIMESTAMP DEFAULT now(),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Office verification reports
CREATE TABLE officeVerificationReports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    caseId INTEGER,
    form_type VARCHAR(50) DEFAULT 'POSITIVE' NOT NULL,
    verification_outcome VARCHAR(50) NOT NULL,
    -- Similar structure to residence with office-specific fields
    company_nameplate_status VARCHAR(50),
    name_on_company_board VARCHAR(255),
    office_type VARCHAR(100),
    business_nature VARCHAR(255),
    employee_count INTEGER,
    office_area VARCHAR(100),
    office_status VARCHAR(100),
    -- ... (additional office-specific fields)
    submitted_by UUID,
    submitted_at TIMESTAMP DEFAULT now(),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Business verification reports
CREATE TABLE businessVerificationReports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    caseId INTEGER,
    form_type VARCHAR(50) DEFAULT 'POSITIVE' NOT NULL,
    verification_outcome VARCHAR(50) NOT NULL,
    -- Business-specific fields
    business_name VARCHAR(255),
    business_type VARCHAR(100),
    business_registration VARCHAR(255),
    business_license VARCHAR(255),
    business_area VARCHAR(100),
    business_status VARCHAR(100),
    -- ... (additional business-specific fields)
    submitted_by UUID,
    submitted_at TIMESTAMP DEFAULT now(),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
```

### 6. Clients & Products
```sql
-- Clients table
CREATE TABLE clients (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Verification types table
CREATE TABLE verificationTypes (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Client-Product mapping
CREATE TABLE clientProducts (
    id INTEGER PRIMARY KEY,
    clientId INTEGER,
    productId INTEGER,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product-VerificationType mapping
CREATE TABLE productVerificationTypes (
    id INTEGER PRIMARY KEY,
    productId INTEGER,
    verificationTypeId INTEGER,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 7. Rate Management & Commission
```sql
-- Rate types table
CREATE TABLE rateTypes (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rates table
CREATE TABLE rates (
    id BIGINT PRIMARY KEY,
    clientId INTEGER,
    productId INTEGER,
    verificationTypeId INTEGER,
    pincodeId INTEGER,
    areaId INTEGER,
    rateTypeId INTEGER,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    isActive BOOLEAN DEFAULT true,
    effectiveFrom TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effectiveTo TIMESTAMP WITH TIME ZONE,
    createdBy UUID,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rate history
CREATE TABLE rateHistory (
    id BIGINT PRIMARY KEY,
    rateId BIGINT,
    oldAmount NUMERIC(10,2),
    newAmount NUMERIC(10,2) NOT NULL,
    changeReason TEXT,
    changedBy UUID,
    changedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Commission calculations
CREATE TABLE commission_calculations (
    id BIGINT PRIMARY KEY,
    case_id UUID NOT NULL,
    case_number INTEGER NOT NULL,
    user_id UUID NOT NULL,
    client_id INTEGER NOT NULL,
    rate_type_id INTEGER NOT NULL,
    base_amount NUMERIC(10,2) NOT NULL,
    commission_amount NUMERIC(10,2) NOT NULL,
    calculated_commission NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Commission rate types
CREATE TABLE commission_rate_types (
    id BIGINT PRIMARY KEY,
    rate_type_id INTEGER NOT NULL,
    commission_amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 8. Territory & User Assignments
```sql
-- User pincode assignments
CREATE TABLE userPincodeAssignments (
    id INTEGER PRIMARY KEY,
    userId UUID NOT NULL,
    pincodeId INTEGER NOT NULL,
    assignedBy UUID NOT NULL,
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User area assignments
CREATE TABLE userAreaAssignments (
    id INTEGER PRIMARY KEY,
    userId UUID NOT NULL,
    pincodeId INTEGER NOT NULL,
    areaId INTEGER NOT NULL,
    userPincodeAssignmentId INTEGER NOT NULL,
    assignedBy UUID NOT NULL,
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    isActive BOOLEAN DEFAULT true,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User client assignments
CREATE TABLE userClientAssignments (
    id INTEGER PRIMARY KEY,
    userId UUID NOT NULL,
    clientId INTEGER NOT NULL,
    assignedBy UUID,
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User product assignments
CREATE TABLE userProductAssignments (
    id INTEGER PRIMARY KEY,
    userId UUID NOT NULL,
    productId INTEGER NOT NULL,
    assignedBy UUID,
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Territory assignment audit
CREATE TABLE territoryAssignmentAudit (
    id BIGINT PRIMARY KEY,
    userId UUID NOT NULL,
    assignmentType VARCHAR(20) NOT NULL, -- PINCODE, AREA
    assignmentId INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL, -- ASSIGNED, UNASSIGNED, MODIFIED
    previousData JSONB,
    newData JSONB NOT NULL,
    performedBy UUID NOT NULL,
    performedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);
```

### 9. Notifications & Communication
```sql
-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    case_id UUID,
    case_number VARCHAR(50),
    data JSONB DEFAULT '{}',
    action_url VARCHAR(500),
    action_type VARCHAR(50) DEFAULT 'NAVIGATE',
    priority VARCHAR(20) DEFAULT 'NORMAL',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Notification tokens (for push notifications)
CREATE TABLE notification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL, -- IOS, ANDROID, WEB
    push_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    case_assignment_enabled BOOLEAN DEFAULT true,
    case_assignment_push BOOLEAN DEFAULT true,
    case_assignment_websocket BOOLEAN DEFAULT true,
    case_reassignment_enabled BOOLEAN DEFAULT true,
    case_reassignment_push BOOLEAN DEFAULT true,
    case_reassignment_websocket BOOLEAN DEFAULT true,
    case_completion_enabled BOOLEAN DEFAULT true,
    case_completion_push BOOLEAN DEFAULT false,
    case_completion_websocket BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
```

### 10. Performance & Monitoring
```sql
-- Performance metrics
CREATE TABLE performance_metrics (
    id BIGINT PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time NUMERIC(10,2) NOT NULL,
    memory_usage JSONB,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Query performance tracking
CREATE TABLE query_performance (
    id BIGINT PRIMARY KEY,
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    execution_time NUMERIC(10,2) NOT NULL,
    rows_returned INTEGER,
    rows_examined INTEGER,
    query_plan JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Error logs
CREATE TABLE error_logs (
    id BIGINT PRIMARY KEY,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    request_id VARCHAR(255),
    user_id UUID,
    url TEXT,
    additional_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System health metrics
CREATE TABLE system_health_metrics (
    id BIGINT PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 11. Audit & Logging
```sql
-- Audit logs
CREATE TABLE auditLogs (
    id BIGINT PRIMARY KEY,
    userId UUID,
    action VARCHAR(50) NOT NULL,
    entityType VARCHAR(50) NOT NULL,
    entityId UUID,
    oldValues JSONB,
    newValues JSONB,
    details JSONB,
    ipAddress INET,
    userAgent TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case deduplication audit
CREATE TABLE caseDeduplicationAudit (
    id BIGINT PRIMARY KEY,
    caseId INTEGER,
    case_id UUID NOT NULL,
    searchCriteria JSONB NOT NULL,
    duplicatesFound JSONB,
    userDecision VARCHAR(20) NOT NULL, -- CREATE_NEW, USE_EXISTING, MERGE_CASES
    rationale TEXT,
    performedBy UUID NOT NULL,
    performedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 12. Mobile & Sync
```sql
-- Mobile device sync
CREATE TABLE mobile_device_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId UUID NOT NULL,
    deviceId VARCHAR(255) NOT NULL,
    lastSyncAt TIMESTAMP WITH TIME ZONE NOT NULL,
    appVersion VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL, -- iOS, Android
    syncCount INTEGER DEFAULT 0 NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Background sync queue
CREATE TABLE backgroundSyncQueue (
    id BIGINT PRIMARY KEY,
    userId UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    entityType VARCHAR(50) NOT NULL,
    entityData JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    retryCount INTEGER DEFAULT 0,
    errorMessage TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processedAt TIMESTAMP WITH TIME ZONE
);

-- Auto saves (for form data)
CREATE TABLE autoSaves (
    id BIGINT PRIMARY KEY,
    userId UUID NOT NULL,
    caseId INTEGER,
    case_id UUID NOT NULL,
    formData JSONB NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Backend API Architecture

### API Base Configuration
```typescript
Base URL Strategy (Priority Order):
1. http://localhost:3000/api (Development)
2. http://{staticIP}:3000/api (Local Network)
3. https://example.com/api (Production Domain)
4. http://{staticIP}:3000/api (External Access)

Timeout: 30 seconds
Authentication: Bearer Token (JWT)
Content-Type: application/json
```

### Authentication System
```typescript
// JWT Configuration
JWT_SECRET: Production secret key
JWT_EXPIRES_IN: 7 days
JWT_REFRESH_SECRET: Refresh token secret
JWT_REFRESH_EXPIRES_IN: 30 days

// Supported Roles
SUPER_ADMIN, ADMIN, BACKEND_USER, FIELD_AGENT, MANAGER, REPORT_PERSON

// Authentication Flow
1. POST /api/auth/login - Standard login
2. POST /api/auth/uuid-login - Mobile UUID login
3. POST /api/auth/refresh - Token refresh
4. POST /api/auth/logout - Logout and cleanup
```

## 📋 Core API Endpoints

### 1. Authentication APIs
```typescript
// Standard Login
POST /api/auth/login
Body: { username: string, password: string, deviceId?: string, macAddress?: string }
Response: { success: boolean, data: { user: User, tokens: TokenPair } }

// Mobile UUID Login
POST /api/auth/uuid-login
Body: { authUuid: string, deviceId: string, platform?: string, appVersion?: string }
Response: { success: boolean, data: { user: User, tokens: TokenPair } }

// Token Refresh
POST /api/auth/refresh
Body: { refreshToken: string }
Response: { success: boolean, data: { accessToken: string, expiresIn: number } }

// Logout
POST /api/auth/logout
Headers: Authorization: Bearer <token>
Response: { success: boolean, message: string }
```

### 2. Cases Management APIs
```typescript
// Get Cases (Paginated)
GET /api/cases?page=1&limit=20&status=PENDING&search=customer&assignedTo=uuid&clientId=1
Response: { success: boolean, data: { cases: Case[], pagination: PaginationInfo } }

// Get Case Details
GET /api/cases/:id
Response: { success: boolean, data: Case }

// Create Case
POST /api/cases
Body: {
  title: string,
  customerName: string,
  customerPhone: string,
  customerEmail?: string,
  address: string,
  pincode: string,
  clientId: string,
  productId?: string,
  verificationTypeId?: string,
  priority: number,
  assignedToId?: string
}
Response: { success: boolean, data: Case }

// Update Case
PUT /api/cases/:id
Body: Partial<Case>
Response: { success: boolean, data: Case }

// Delete Case
DELETE /api/cases/:id
Response: { success: boolean, message: string }

// Bulk Create Cases
POST /api/cases/bulk
Body: { cases: CaseData[], assignedTo?: string }
Response: { success: boolean, data: { created: Case[], failed: any[] } }

// Export Cases
GET /api/cases/export?format=excel&filters={}
Response: File download (Excel/CSV/PDF)
```

### 3. User Management APIs
```typescript
// Get Users (Paginated)
GET /api/users?page=1&limit=20&role=FIELD_AGENT&department=IT&search=john
Response: { success: boolean, data: { users: User[], pagination: PaginationInfo } }

// Get User Details
GET /api/users/:id
Response: { success: boolean, data: User }

// Create User
POST /api/users
Body: {
  name: string,
  username: string,
  email: string,
  password: string,
  role: Role,
  employeeId: string,
  designation: string,
  department: string,
  phone?: string
}
Response: { success: boolean, data: User }

// Update User
PUT /api/users/:id
Body: Partial<User>
Response: { success: boolean, data: User }

// Get Current User Profile
GET /api/user/profile
Headers: Authorization: Bearer <token>
Response: { success: boolean, data: User }

// Update User Profile
PUT /api/user/profile
Body: Partial<User>
Response: { success: boolean, data: User }
```

### 4. Form Submission APIs
```typescript
// Submit Form Data
POST /api/forms/submissions
Body: {
  caseId: string,
  formType: string, // RESIDENCE, OFFICE, BUSINESS
  formData: any,
  attachments?: File[],
  geoLocation?: { latitude: number, longitude: number, accuracy: number }
}
Response: { success: boolean, data: FormSubmission }

// Get Form Submissions
GET /api/forms/submissions?caseId=uuid&formType=RESIDENCE&status=PENDING
Response: { success: boolean, data: { submissions: FormSubmission[], pagination: PaginationInfo } }

// Validate Form Submission
POST /api/forms/submissions/:id/validate
Body: { validationStatus: string, validationErrors?: any[] }
Response: { success: boolean, data: FormSubmission }
```

### 5. Attachment Management APIs
```typescript
// Upload Attachment
POST /api/attachments/upload
Content-Type: multipart/form-data
Body: { file: File, caseId?: string, description?: string }
Response: { success: boolean, data: { id: string, filename: string, url: string, size: number, mimeType: string } }

// Get Attachment Details
GET /api/attachments/:id
Response: { success: boolean, data: Attachment }

// Delete Attachment
DELETE /api/attachments/:id
Response: { success: boolean, message: string }

// Get Case Attachments
GET /api/attachments/case/:caseId
Response: { success: boolean, data: Attachment[] }
```

### 6. Dashboard & Analytics APIs
```typescript
// Get Dashboard Statistics
GET /api/dashboard/stats?period=month&clientId=1&userId=uuid
Response: {
  success: boolean,
  data: {
    totalCases: number,
    pendingCases: number,
    completedCases: number,
    inProgressCases: number,
    totalRevenue: number,
    monthlyGrowth: number,
    caseStatusDistribution: StatusDistribution[],
    monthlyTrends: MonthlyTrend[]
  }
}

// Get Recent Activities
GET /api/dashboard/activities?limit=10&userId=uuid
Response: { success: boolean, data: RecentActivity[] }

// Get Performance Analytics
GET /api/analytics/performance?startDate=2024-01-01&endDate=2024-12-31&userId=uuid&clientId=1
Response: {
  success: boolean,
  data: {
    totalCases: number,
    completionRate: number,
    averageTime: number,
    trends: AnalyticsTrend[]
  }
}
```

### 7. Location & Geography APIs
```typescript
// Get Countries
GET /api/countries?page=1&limit=20&continent=Asia&search=india
Response: { success: boolean, data: { countries: Country[], pagination: PaginationInfo } }

// Get States
GET /api/states?page=1&limit=20&country=India&search=maharashtra
Response: { success: boolean, data: { states: State[], pagination: PaginationInfo } }

// Get Cities
GET /api/cities?page=1&limit=20&state=Maharashtra&search=mumbai
Response: { success: boolean, data: { cities: City[], pagination: PaginationInfo } }

// Get Pincodes
GET /api/pincodes?page=1&limit=20&city=Mumbai&search=400001
Response: { success: boolean, data: { pincodes: Pincode[], pagination: PaginationInfo } }

// Get Areas
GET /api/areas?page=1&limit=20&pincode=400001&search=andheri
Response: { success: boolean, data: { areas: Area[], pagination: PaginationInfo } }

// Get Pincode Details
GET /api/pincodes/:id
Response: { success: boolean, data: { pincode: Pincode, areas: Area[] } }
```

### 8. Client & Product Management APIs
```typescript
// Get Clients
GET /api/clients?page=1&limit=20&search=company&isActive=true
Response: { success: boolean, data: { clients: Client[], pagination: PaginationInfo } }

// Create Client
POST /api/clients
Body: { name: string, code: string, description?: string, contactPerson?: string, email?: string, phone?: string, address?: string }
Response: { success: boolean, data: Client }

// Get Products
GET /api/products?page=1&limit=20&search=verification&isActive=true
Response: { success: boolean, data: { products: Product[], pagination: PaginationInfo } }

// Get Verification Types
GET /api/verification-types?page=1&limit=20&search=residence&isActive=true
Response: { success: boolean, data: { verificationTypes: VerificationType[], pagination: PaginationInfo } }
```

## 🔍 Common Database Queries

### User Authentication Query
```sql
SELECT id, name, username, email, "passwordHash", role, "employeeId", designation, department, "profilePhotoUrl"
FROM users
WHERE username = $1 AND "isActive" = true;
```

### Case Listing with Filters
```sql
SELECT
  c."caseId" as case_id,
  c."customerName" as customer_name,
  c."customerPhone" as customer_phone,
  c.address,
  c.pincode,
  cl.name as client_name,
  p.name as product_name,
  vt.name as verification_type_name,
  c.status,
  c.priority,
  u.name as assigned_to_name,
  c."createdAt" as created_at,
  c."updatedAt" as updated_at
FROM cases c
LEFT JOIN clients cl ON c."clientId" = cl.id
LEFT JOIN products p ON c."productId" = p.id
LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
LEFT JOIN users u ON c."assignedTo" = u.id
WHERE ($1::text IS NULL OR c."customerName" ILIKE $1 OR c."customerPhone" ILIKE $1)
  AND ($2::text IS NULL OR c.status = $2)
  AND ($3::uuid IS NULL OR c."assignedTo" = $3)
  AND ($4::integer IS NULL OR c."clientId" = $4)
ORDER BY c."createdAt" DESC
LIMIT $5 OFFSET $6;
```

### User Performance Query
```sql
SELECT
  u.id, u.name, u.username, u.email, u.phone, u.role,
  u."employeeId", u."isActive", u."lastLogin", u."createdAt", u."updatedAt",
  r.name as "roleName", r.permissions as "rolePermissions",
  d.name as "departmentName", d.description as "departmentDescription",
  des.name as "designationName"
FROM users u
LEFT JOIN roles r ON u."roleId" = r.id
LEFT JOIN departments d ON u."departmentId" = d.id
LEFT JOIN designations des ON u."designationId" = des.id
WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.username ILIKE $1 OR u.email ILIKE $1)
  AND ($2::boolean IS NULL OR u."isActive" = $2)
  AND ($3::text IS NULL OR u.role = $3)
ORDER BY u.name
LIMIT $4 OFFSET $5;
```

### Form Submission Insert Query
```sql
INSERT INTO "residenceVerificationReports" (
  case_id, "caseId", form_type, verification_outcome, customer_name, customer_phone,
  address_locatable, address_rating, locality, address_structure, house_status,
  met_person_name, met_person_relation, staying_status, remarks, final_status,
  submitted_by, submitted_at, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), NOW());
```

### Territory Assignment Query
```sql
SELECT
  ta.id, ta."userId", ta."pincodeId", ta."areaId", ta."assignedBy", ta."assignedAt", ta."isActive",
  u.name as "userName", u."employeeId",
  p.code as "pincodeCode", c.name as "cityName", s.name as "stateName",
  a.name as "areaName"
FROM "userAreaAssignments" ta
JOIN users u ON ta."userId" = u.id
JOIN pincodes p ON ta."pincodeId" = p.id
JOIN cities c ON p."cityId" = c.id
JOIN states s ON c."stateId" = s.id
JOIN areas a ON ta."areaId" = a.id
WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u."employeeId" ILIKE $1)
  AND ($2::integer IS NULL OR ta."pincodeId" = $2)
  AND ($3::integer IS NULL OR ta."areaId" = $3)
  AND ($4::boolean IS NULL OR ta."isActive" = $4)
ORDER BY u.name, p.code, a.name
LIMIT $5 OFFSET $6;
```

## 📊 Database Statistics & Performance

### Table Statistics
```sql
-- Get table sizes and row counts
SELECT
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### Index Usage Statistics
```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename, indexname;
```

### Connection Statistics
```sql
-- Monitor database connections
SELECT
  state,
  COUNT(*) as connection_count
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;
```

## 🔧 Database Functions & Triggers

### Rate Change Logging Function
```sql
CREATE OR REPLACE FUNCTION log_rate_changes() RETURNS TRIGGER AS $$
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
        IF OLD."rateAmount" != NEW."rateAmount" THEN
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
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### Territory Assignment Audit Function
```sql
CREATE OR REPLACE FUNCTION audit_territory_assignment_changes() RETURNS TRIGGER AS $$
BEGIN
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
    ELSIF TG_OP = 'UPDATE' THEN
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
$$ LANGUAGE plpgsql;
```

## 📈 Key Performance Metrics

### Database Performance
- **Connection Pool**: 50-500 connections (enterprise scale)
- **Query Timeout**: 20 seconds
- **Statement Timeout**: 25 seconds
- **Slow Query Threshold**: 1.5 seconds
- **Average Response Time**: < 1.5 seconds

### API Performance
- **Total Endpoints**: 50+ documented endpoints
- **Authentication**: JWT with 7-day expiry
- **Rate Limiting**: 100 requests per 15 minutes
- **Error Rate**: < 1%
- **Uptime**: 99.9%

### Data Volume
- **Core Tables**: 73 tables
- **Verification Reports**: 8 specialized tables
- **Audit Tables**: 5 audit/logging tables
- **Performance Tables**: 4 monitoring tables
- **Mobile Sync**: 3 offline sync tables

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Password hashing with bcrypt (12 rounds)
- Session management with Redis
- Device-based authentication for mobile

### Data Protection
- SQL injection prevention with parameterized queries
- XSS protection with input sanitization
- CORS configuration for cross-origin requests
- Rate limiting to prevent abuse
- Audit logging for all critical operations

### Database Security
- Row-level security policies
- Encrypted connections (SSL/TLS)
- Regular security updates
- Backup encryption
- Access logging and monitoring

### 4. Attachments & Files
```sql
-- Attachments table
CREATE TABLE attachments (
    id BIGINT PRIMARY KEY,
    caseId INTEGER,
    case_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    originalName VARCHAR(255) NOT NULL,
    filePath VARCHAR(500) NOT NULL,
    fileSize INTEGER NOT NULL,
    mimeType VARCHAR(100) NOT NULL,
    uploadedBy UUID NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Verification attachments (specific to verification forms)
CREATE TABLE verification_attachments (
    id INTEGER PRIMARY KEY,
    case_id UUID NOT NULL,
    caseId INTEGER,
    verification_type VARCHAR(50) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    originalName VARCHAR(255) NOT NULL,
    mimeType VARCHAR(100) NOT NULL,
    fileSize INTEGER NOT NULL,
    filePath VARCHAR(500) NOT NULL,
    thumbnailPath VARCHAR(500),
    uploadedBy UUID NOT NULL,
    uploadedAt TIMESTAMP DEFAULT now(),
    createdAt TIMESTAMP DEFAULT now(),
    updatedAt TIMESTAMP DEFAULT now()
);
```

### 5. Location & Geography
```sql
-- Countries table
CREATE TABLE countries (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(3) NOT NULL,
    continent VARCHAR(50) NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- States table
CREATE TABLE states (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    countryId INTEGER,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cities table
CREATE TABLE cities (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    stateId INTEGER,
    countryId INTEGER,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pincodes table
CREATE TABLE pincodes (
    id INTEGER PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    cityId INTEGER,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Areas table
CREATE TABLE areas (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pincode-Area mapping
CREATE TABLE pincodeAreas (
    id INTEGER PRIMARY KEY,
    pincodeId INTEGER,
    areaId INTEGER,
    displayOrder INTEGER DEFAULT 1,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Location tracking
CREATE TABLE locations (
    id BIGINT PRIMARY KEY,
    caseId INTEGER,
    case_id UUID NOT NULL,
    latitude NUMERIC(10,8) NOT NULL,
    longitude NUMERIC(11,8) NOT NULL,
    accuracy NUMERIC(8,2),
    recordedBy UUID NOT NULL,
    recordedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
