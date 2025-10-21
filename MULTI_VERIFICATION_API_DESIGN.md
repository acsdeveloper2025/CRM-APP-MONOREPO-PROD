# Multi-Verification API Design

## Overview
This document outlines the API design for the enhanced multi-verification feature that allows multiple verification tasks per case while maintaining backward compatibility.

## Core Concepts

### 1. Verification Tasks
- Each case can have multiple verification tasks
- Each task is independently assigned, tracked, and billed
- Tasks can be of different types (document, address, business, etc.)
- Each task has its own lifecycle and status

### 2. Backward Compatibility
- Existing single-verification cases continue to work
- Legacy API endpoints remain functional
- Automatic migration of existing data

## API Endpoints

### 1. Verification Tasks Management

#### 1.1 Create Multiple Verification Tasks for a Case
```http
POST /api/cases/{caseId}/verification-tasks
```

**Request Body:**
```json
{
  "tasks": [
    {
      "verification_type_id": 1,
      "task_title": "Verify Residential Address",
      "task_description": "Verify the applicant's residential address and occupancy status",
      "priority": "HIGH",
      "assigned_to": "user-uuid-123",
      "rate_type_id": 2,
      "estimated_amount": 500.00,
      "address": "123 Main Street, City",
      "pincode": "123456",
      "estimated_completion_date": "2024-01-15"
    },
    {
      "verification_type_id": 3,
      "task_title": "Verify Identity Documents",
      "task_description": "Verify Aadhaar and PAN card authenticity",
      "priority": "HIGH",
      "assigned_to": "user-uuid-456",
      "rate_type_id": 1,
      "estimated_amount": 300.00,
      "document_type": "IDENTITY_DOCUMENTS",
      "document_details": {
        "aadhaar_number": "XXXX-XXXX-1234",
        "pan_number": "ABCDE1234F"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "case_id": "case-uuid-789",
    "tasks_created": 2,
    "tasks": [
      {
        "id": "task-uuid-001",
        "task_number": "VT-000001",
        "verification_type_id": 1,
        "task_title": "Verify Residential Address",
        "status": "PENDING",
        "assigned_to": "user-uuid-123",
        "estimated_amount": 500.00,
        "created_at": "2024-01-10T10:00:00Z"
      },
      {
        "id": "task-uuid-002",
        "task_number": "VT-000002",
        "verification_type_id": 3,
        "task_title": "Verify Identity Documents",
        "status": "PENDING",
        "assigned_to": "user-uuid-456",
        "estimated_amount": 300.00,
        "created_at": "2024-01-10T10:00:00Z"
      }
    ],
    "total_estimated_amount": 800.00
  },
  "message": "Verification tasks created successfully"
}
```

#### 1.2 Get All Tasks for a Case
```http
GET /api/cases/{caseId}/verification-tasks
```

**Query Parameters:**
- `status` (optional): Filter by task status
- `assigned_to` (optional): Filter by assigned user
- `verification_type_id` (optional): Filter by verification type

**Response:**
```json
{
  "success": true,
  "data": {
    "case_id": "case-uuid-789",
    "case_number": "CASE-2024-001",
    "customer_name": "John Doe",
    "total_tasks": 2,
    "completed_tasks": 1,
    "completion_percentage": 50.0,
    "tasks": [
      {
        "id": "task-uuid-001",
        "task_number": "VT-000001",
        "verification_type_id": 1,
        "verification_type_name": "Address Verification",
        "task_title": "Verify Residential Address",
        "task_description": "Verify the applicant's residential address and occupancy status",
        "status": "COMPLETED",
        "priority": "HIGH",
        "assigned_to": "user-uuid-123",
        "assigned_to_name": "Field Agent 1",
        "verification_outcome": "POSITIVE",
        "estimated_amount": 500.00,
        "actual_amount": 500.00,
        "address": "123 Main Street, City",
        "assigned_at": "2024-01-10T10:00:00Z",
        "started_at": "2024-01-10T14:00:00Z",
        "completed_at": "2024-01-11T16:30:00Z",
        "commission_status": "CALCULATED"
      },
      {
        "id": "task-uuid-002",
        "task_number": "VT-000002",
        "verification_type_id": 3,
        "verification_type_name": "Document Verification",
        "task_title": "Verify Identity Documents",
        "task_description": "Verify Aadhaar and PAN card authenticity",
        "status": "IN_PROGRESS",
        "priority": "HIGH",
        "assigned_to": "user-uuid-456",
        "assigned_to_name": "Field Agent 2",
        "estimated_amount": 300.00,
        "document_type": "IDENTITY_DOCUMENTS",
        "assigned_at": "2024-01-10T10:00:00Z",
        "started_at": "2024-01-11T09:00:00Z",
        "commission_status": "PENDING"
      }
    ]
  },
  "message": "Verification tasks retrieved successfully"
}
```

#### 1.3 Update Verification Task
```http
PUT /api/verification-tasks/{taskId}
```

**Request Body:**
```json
{
  "status": "IN_PROGRESS",
  "verification_outcome": "POSITIVE",
  "actual_amount": 450.00,
  "notes": "Task completed successfully with minor address discrepancy"
}
```

#### 1.4 Assign/Reassign Verification Task
```http
POST /api/verification-tasks/{taskId}/assign
```

**Request Body:**
```json
{
  "assigned_to": "user-uuid-789",
  "assignment_reason": "Original agent unavailable",
  "priority": "URGENT"
}
```

#### 1.5 Complete Verification Task
```http
POST /api/verification-tasks/{taskId}/complete
```

**Request Body:**
```json
{
  "verification_outcome": "POSITIVE",
  "actual_amount": 500.00,
  "completion_notes": "Address verified successfully, all documents authentic",
  "form_submission_id": "form-uuid-123"
}
```

### 2. Task Templates Management

#### 2.1 Get Available Task Templates
```http
GET /api/verification-task-templates
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Standard Individual KYC",
      "description": "Complete KYC verification for individual customers",
      "category": "INDIVIDUAL",
      "estimated_total_cost": 1500.00,
      "estimated_duration_days": 3,
      "tasks": [
        {
          "task_type": "RESIDENCE_ADDR",
          "priority": "HIGH",
          "title": "Verify Residential Address"
        },
        {
          "task_type": "DOCUMENT",
          "priority": "HIGH",
          "title": "Verify Identity Documents"
        },
        {
          "task_type": "IDENTITY",
          "priority": "MEDIUM",
          "title": "Verify Personal Identity"
        }
      ]
    }
  ]
}
```

#### 2.2 Create Tasks from Template
```http
POST /api/cases/{caseId}/verification-tasks/from-template
```

**Request Body:**
```json
{
  "template_id": 1,
  "customizations": {
    "default_assigned_to": "user-uuid-123",
    "priority_override": "HIGH",
    "address": "123 Main Street, City",
    "pincode": "123456"
  }
}
```

### 3. Commission Management for Tasks

#### 3.1 Calculate Commission for Completed Task
```http
POST /api/verification-tasks/{taskId}/calculate-commission
```

**Response:**
```json
{
  "success": true,
  "data": {
    "task_id": "task-uuid-001",
    "task_number": "VT-000001",
    "commission_calculation": {
      "id": "commission-uuid-001",
      "base_amount": 500.00,
      "commission_amount": 50.00,
      "calculated_commission": 50.00,
      "calculation_method": "FIXED_AMOUNT",
      "status": "CALCULATED",
      "user_id": "user-uuid-123",
      "user_name": "Field Agent 1"
    }
  },
  "message": "Commission calculated successfully"
}
```

#### 3.2 Get Task Commission History
```http
GET /api/verification-tasks/{taskId}/commission-history
```

#### 3.3 Bulk Commission Calculation
```http
POST /api/cases/{caseId}/calculate-all-commissions
```

### 4. Enhanced Case Management

#### 4.1 Create Case with Multiple Tasks (Enhanced)
```http
POST /api/cases/with-multiple-tasks
```

**Request Body:**
```json
{
  "case_details": {
    "customerName": "John Doe",
    "customerPhone": "+91-9876543210",
    "customerEmail": "john.doe@email.com",
    "clientId": 1,
    "productId": 2,
    "priority": "HIGH",
    "address": "123 Main Street, City",
    "pincode": "123456"
  },
  "verification_tasks": [
    {
      "verification_type_id": 1,
      "task_title": "Verify Residential Address",
      "assigned_to": "user-uuid-123",
      "rate_type_id": 2,
      "estimated_amount": 500.00
    },
    {
      "verification_type_id": 3,
      "task_title": "Verify Identity Documents",
      "assigned_to": "user-uuid-456",
      "rate_type_id": 1,
      "estimated_amount": 300.00
    }
  ]
}
```

#### 4.2 Get Case Summary with Tasks
```http
GET /api/cases/{caseId}/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "case": {
      "id": "case-uuid-789",
      "case_number": "CASE-2024-001",
      "customer_name": "John Doe",
      "status": "IN_PROGRESS",
      "has_multiple_tasks": true,
      "total_tasks_count": 2,
      "completed_tasks_count": 1,
      "case_completion_percentage": 50.0,
      "created_at": "2024-01-10T10:00:00Z"
    },
    "task_summary": {
      "total_tasks": 2,
      "pending_tasks": 0,
      "in_progress_tasks": 1,
      "completed_tasks": 1,
      "cancelled_tasks": 0
    },
    "financial_summary": {
      "total_estimated_amount": 800.00,
      "total_actual_amount": 500.00,
      "completed_amount": 500.00,
      "pending_amount": 300.00,
      "total_commission": 50.00,
      "paid_commission": 0.00
    },
    "recent_activities": [
      {
        "type": "TASK_COMPLETED",
        "task_id": "task-uuid-001",
        "task_title": "Verify Residential Address",
        "user_name": "Field Agent 1",
        "timestamp": "2024-01-11T16:30:00Z"
      }
    ]
  }
}
```

### 5. Mobile API Enhancements

#### 5.1 Get Assigned Tasks for Field User
```http
GET /api/mobile/my-verification-tasks
```

**Query Parameters:**
- `status` (optional): Filter by task status
- `priority` (optional): Filter by priority

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-uuid-001",
        "task_number": "VT-000001",
        "case_id": "case-uuid-789",
        "case_number": "CASE-2024-001",
        "customer_name": "John Doe",
        "task_title": "Verify Residential Address",
        "verification_type": "Address Verification",
        "status": "ASSIGNED",
        "priority": "HIGH",
        "address": "123 Main Street, City",
        "estimated_amount": 500.00,
        "assigned_at": "2024-01-10T10:00:00Z",
        "estimated_completion_date": "2024-01-15T00:00:00Z"
      }
    ],
    "summary": {
      "total_assigned": 5,
      "pending": 2,
      "in_progress": 2,
      "completed_today": 1
    }
  }
}
```

#### 5.2 Start Verification Task
```http
POST /api/mobile/verification-tasks/{taskId}/start
```

#### 5.3 Submit Task Verification
```http
POST /api/mobile/verification-tasks/{taskId}/submit
```

**Request Body:**
```json
{
  "verification_outcome": "POSITIVE",
  "form_data": {
    "address_confirmed": true,
    "person_met": "APPLICANT",
    "documents_verified": ["AADHAAR", "PAN"],
    "verification_notes": "All details verified successfully"
  },
  "attachments": ["attachment-uuid-1", "attachment-uuid-2"],
  "geo_location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "accuracy": 10
  }
}
```

## Implementation Notes

### 1. Backward Compatibility
- All existing API endpoints continue to work
- Legacy cases are automatically migrated to have a single verification task
- Existing commission calculations are linked to the migrated tasks

### 2. Database Transactions
- Task creation, assignment, and completion operations use database transactions
- Commission calculations are atomic operations
- Case completion percentage is automatically updated via triggers

### 3. Error Handling
- Comprehensive validation for task assignments
- Proper error codes for different failure scenarios
- Rollback mechanisms for failed multi-task operations

### 4. Performance Considerations
- Indexed queries for task lookups
- Efficient joins for case-task relationships
- Pagination for large task lists
- Caching for frequently accessed data

### 5. Security
- Role-based access control for task management
- Field users can only access their assigned tasks
- Audit logging for all task operations
- Secure handling of sensitive document information
