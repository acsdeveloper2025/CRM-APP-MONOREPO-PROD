# Territory Assignment Option 4 - Complete Implementation Plan

## Executive Summary

This document provides a comprehensive, step-by-step implementation plan for **Option 4: Two-Tab Interface with Combined Summary** for territory assignment management in the CRM application.

**Implementation Timeline:** 3-4 days  
**Complexity Level:** Simple to Moderate  
**Risk Level:** Low (uses existing database schema, no migrations needed)

---

## 1. DATABASE AUDIT

### 1.1 Existing Schema Verification ✅

**Status:** All required tables exist and are properly configured.

#### Core Tables:

**`pincodes` Table:**
```sql
- id: integer (PK)
- code: varchar(10) (UNIQUE, NOT NULL)
- cityId: integer (FK -> cities.id)
- createdAt: timestamp
- updatedAt: timestamp

Indexes:
- PRIMARY KEY (id)
- UNIQUE (code)
- INDEX (cityId)
- INDEX (code)
```

**`areas` Table:**
```sql
- id: integer (PK)
- name: varchar(255) (NOT NULL)
- createdAt: timestamp
- updatedAt: timestamp

Indexes:
- PRIMARY KEY (id)
```

**`pincodeAreas` Table (Junction):**
```sql
- id: integer (PK)
- pincodeId: integer (FK -> pincodes.id)
- areaId: integer (FK -> areas.id)
- displayOrder: integer (1-50)
- createdAt: timestamp
- updatedAt: timestamp

Indexes:
- PRIMARY KEY (id)
- INDEX (pincodeId)
- INDEX (areaId)

Foreign Keys:
- pincodeId -> pincodes.id
- areaId -> areas.id
```

**`userPincodeAssignments` Table:**
```sql
- id: integer (PK)
- userId: uuid (FK -> users.id, NOT NULL)
- pincodeId: integer (FK -> pincodes.id, NOT NULL)
- assignedBy: uuid (FK -> users.id, NOT NULL)
- assignedAt: timestamp (DEFAULT CURRENT_TIMESTAMP)
- isActive: boolean (DEFAULT true)
- createdAt: timestamp
- updatedAt: timestamp

Indexes:
- PRIMARY KEY (id)
- UNIQUE (userId, pincodeId, isActive) DEFERRABLE
- INDEX (userId)
- INDEX (pincodeId)
- INDEX (userId, isActive) WHERE isActive = true
- INDEX (isActive) WHERE isActive = true

Foreign Keys:
- userId -> users.id ON DELETE CASCADE
- pincodeId -> pincodes.id ON DELETE CASCADE
- assignedBy -> users.id ON DELETE RESTRICT

Triggers:
- audit_user_pincode_assignments (audit trail)
- update_user_pincode_assignments_updated_at
```

**`userAreaAssignments` Table:**
```sql
- id: integer (PK)
- userId: uuid (FK -> users.id, NOT NULL)
- pincodeId: integer (FK -> pincodes.id, NOT NULL)
- areaId: integer (FK -> areas.id, NOT NULL)
- userPincodeAssignmentId: integer (FK -> userPincodeAssignments.id, NOT NULL)
- assignedBy: uuid (FK -> users.id, NOT NULL)
- assignedAt: timestamp (DEFAULT CURRENT_TIMESTAMP)
- isActive: boolean (DEFAULT true)
- createdAt: timestamp
- updatedAt: timestamp

Indexes:
- PRIMARY KEY (id)
- UNIQUE (userId, pincodeId, areaId, isActive) DEFERRABLE
- INDEX (userId)
- INDEX (pincodeId)
- INDEX (areaId)
- INDEX (userPincodeAssignmentId)
- INDEX (userId, isActive) WHERE isActive = true
- INDEX (userId, pincodeId, isActive) WHERE isActive = true

Foreign Keys:
- userId -> users.id ON DELETE CASCADE
- pincodeId -> pincodes.id ON DELETE CASCADE
- areaId -> areas.id ON DELETE CASCADE
- userPincodeAssignmentId -> userPincodeAssignments.id ON DELETE CASCADE
- assignedBy -> users.id ON DELETE RESTRICT

Triggers:
- audit_user_area_assignments (audit trail)
- update_user_area_assignments_updated_at
```

### 1.2 Performance Optimization Assessment

**Current Indexes:** ✅ Adequate for Option 4 requirements

**Recommended Additional Indexes:** None required. Existing indexes cover:
- User lookups: `INDEX (userId)`
- Pincode lookups: `INDEX (pincodeId)`
- Area lookups: `INDEX (areaId)`
- Active assignment filtering: `INDEX (userId, isActive) WHERE isActive = true`
- Composite lookups: `INDEX (userId, pincodeId, isActive) WHERE isActive = true`

**Query Performance Expectations:**
- Fetch user assignments: < 50ms (indexed on userId)
- Fetch pincodes with city/state: < 100ms (joins on indexed foreign keys)
- Fetch areas by multiple pincodes: < 100ms (batch query with IN clause)
- Bulk save operation: < 500ms (transaction with 5-10 assignments)

### 1.3 Schema Modifications Required

**Status:** ✅ NO SCHEMA CHANGES NEEDED

The existing database schema perfectly supports Option 4 requirements:
- ✅ Pincode-to-area relationships via `pincodeAreas` junction table
- ✅ User-to-pincode assignments via `userPincodeAssignments`
- ✅ User-to-area assignments via `userAreaAssignments`
- ✅ Parent-child relationship via `userPincodeAssignmentId` foreign key
- ✅ Soft delete support via `isActive` flag
- ✅ Audit trail via triggers
- ✅ Cascade delete behavior properly configured

---

## 2. BACKEND AUDIT & IMPLEMENTATION

### 2.1 Existing Backend Services (Reusable)

**Already Available:**
- ✅ `GET /api/pincodes` - List pincodes with pagination, search, city/state joins
- ✅ `GET /api/pincodes/:id` - Get single pincode with areas
- ✅ `GET /api/pincodes/:id/areas` - Get areas for a specific pincode
- ✅ `GET /api/areas` - List all areas
- ✅ `GET /api/areas/standalone` - Get areas for dropdowns

**Existing Controllers:**
- ✅ `CRM-BACKEND/src/controllers/pincodesController.ts`
- ✅ `CRM-BACKEND/src/controllers/areasController.ts`

**Existing Routes:**
- ✅ `CRM-BACKEND/src/routes/pincodes.ts`
- ✅ `CRM-BACKEND/src/routes/areas.ts`

### 2.2 New Backend Endpoints Required

#### Endpoint 1: Get Pincodes with City/State for Territory Assignment
```typescript
GET /api/pincodes?include=city,state&limit=1000
```
**Status:** ✅ Already exists (uses existing getPincodes controller)

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "400001",
      "cityId": 10,
      "cityName": "Mumbai",
      "state": "Maharashtra",
      "country": "India",
      "areas": [
        { "id": 1, "name": "Andheri", "displayOrder": 1 },
        { "id": 2, "name": "Bandra", "displayOrder": 2 }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 1000, "total": 215 }
}
```

#### Endpoint 2: Get Areas for Multiple Pincodes (Batch)
```typescript
GET /api/areas/by-pincodes?pincodeIds=1,2,3,4,5
```
**Status:** ❌ NEW - Needs to be created

**Controller:** `CRM-BACKEND/src/controllers/areasController.ts`

**Implementation:**
```typescript
export const getAreasByPincodes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pincodeIds } = req.query;
    
    if (!pincodeIds || typeof pincodeIds !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'pincodeIds query parameter is required',
        error: { code: 'VALIDATION_ERROR' }
      });
    }
    
    const pincodeIdArray = pincodeIds.split(',').map(id => parseInt(id.trim(), 10));
    
    if (pincodeIdArray.some(isNaN)) {
      return res.status(400).json({
        success: false,
        message: 'All pincodeIds must be valid integers',
        error: { code: 'VALIDATION_ERROR' }
      });
    }
    
    // Fetch areas grouped by pincode
    const result = await query(`
      SELECT 
        pa."pincodeId",
        a.id,
        a.name,
        pa."displayOrder"
      FROM "pincodeAreas" pa
      JOIN areas a ON pa."areaId" = a.id
      WHERE pa."pincodeId" = ANY($1::int[])
      ORDER BY pa."pincodeId", pa."displayOrder"
    `, [pincodeIdArray]);
    
    // Group areas by pincodeId
    const areasByPincode: Record<number, Array<{ id: number; name: string }>> = {};
    
    result.rows.forEach(row => {
      if (!areasByPincode[row.pincodeId]) {
        areasByPincode[row.pincodeId] = [];
      }
      areasByPincode[row.pincodeId].push({
        id: row.id,
        name: row.name
      });
    });
    
    res.json({
      success: true,
      data: areasByPincode
    });
  } catch (error) {
    logger.error('Error fetching areas by pincodes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch areas',
      error: { code: 'INTERNAL_ERROR' }
    });
  }
};
```

#### Endpoint 3: Get User Territory Assignments
```typescript
GET /api/users/:userId/territory-assignments
```
**Status:** ❌ NEW - Needs to be created

**File:** `CRM-BACKEND/src/controllers/userTerritoryController.ts` (NEW FILE)

**Implementation:**
```typescript
import type { Response } from 'express';
import { logger } from '@/config/logger';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { query } from '@/config/database';

export const getUserTerritoryAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Fetch pincode assignments with areas
    const result = await query(`
      SELECT 
        upa.id as "assignmentId",
        upa."pincodeId",
        p.code as "pincodeCode",
        c.name as "cityName",
        s.name as "stateName",
        upa."assignedAt",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', uaa.id,
              'areaId', uaa."areaId",
              'areaName', a.name,
              'assignedAt', uaa."assignedAt"
            ) ORDER BY a.name
          ) FILTER (WHERE uaa.id IS NOT NULL),
          '[]'::json
        ) as "areaAssignments"
      FROM "userPincodeAssignments" upa
      JOIN pincodes p ON upa."pincodeId" = p.id
      JOIN cities c ON p."cityId" = c.id
      JOIN states s ON c."stateId" = s.id
      LEFT JOIN "userAreaAssignments" uaa 
        ON upa.id = uaa."userPincodeAssignmentId" 
        AND uaa."isActive" = true
      LEFT JOIN areas a ON uaa."areaId" = a.id
      WHERE upa."userId" = $1 AND upa."isActive" = true
      GROUP BY upa.id, upa."pincodeId", p.code, c.name, s.name, upa."assignedAt"
      ORDER BY p.code
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        pincodeAssignments: result.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching user territory assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch territory assignments',
      error: { code: 'INTERNAL_ERROR' }
    });
  }
};
```

#### Endpoint 4: Bulk Save Territory Assignments
```typescript
POST /api/users/:userId/territory-assignments/bulk
Body: {
  assignments: [
    { pincodeId: 1, areaIds: [1, 2, 3] },
    { pincodeId: 2, areaIds: [4, 5] }
  ]
}
```
**Status:** ❌ NEW - Needs to be created

**File:** `CRM-BACKEND/src/controllers/userTerritoryController.ts`

**Implementation:** (See detailed implementation in Section 2.3)

#### Endpoint 5: Get Available Field Users (Filtered by Pincode + Area)
```typescript
GET /api/users/field-agents/available?pincodeId=1&areaId=2
```
**Status:** ❌ NEW - Needs to be created

**File:** `CRM-BACKEND/src/controllers/usersController.ts`

**Implementation:**
```typescript
export const getAvailableFieldAgents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pincodeId, areaId } = req.query;
    
    if (!pincodeId) {
      return res.status(400).json({
        success: false,
        message: 'pincodeId is required',
        error: { code: 'VALIDATION_ERROR' }
      });
    }
    
    let sql: string;
    let params: any[];
    
    if (areaId) {
      // Filter by both pincode AND area
      sql = `
        SELECT DISTINCT 
          u.id, 
          u.name, 
          u.email, 
          u."employeeId"
        FROM users u
        INNER JOIN "userPincodeAssignments" upa 
          ON u.id = upa."userId" 
          AND upa."pincodeId" = $1 
          AND upa."isActive" = true
        INNER JOIN "userAreaAssignments" uaa 
          ON u.id = uaa."userId" 
          AND uaa."pincodeId" = $1 
          AND uaa."areaId" = $2 
          AND uaa."isActive" = true
        WHERE u.role = 'FIELD_AGENT' 
          AND u."isActive" = true
        ORDER BY u.name
      `;
      params = [pincodeId, areaId];
    } else {
      // Filter by pincode only
      sql = `
        SELECT DISTINCT 
          u.id, 
          u.name, 
          u.email, 
          u."employeeId"
        FROM users u
        INNER JOIN "userPincodeAssignments" upa 
          ON u.id = upa."userId" 
          AND upa."pincodeId" = $1 
          AND upa."isActive" = true
        WHERE u.role = 'FIELD_AGENT' 
          AND u."isActive" = true
        ORDER BY u.name
      `;
      params = [pincodeId];
    }
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching available field agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch field agents',
      error: { code: 'INTERNAL_ERROR' }
    });
  }
};
```

### 2.3 Bulk Save Implementation (Detailed)

**File:** `CRM-BACKEND/src/controllers/userTerritoryController.ts`

```typescript
export const bulkSaveTerritoryAssignments = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { assignments } = req.body;
    const assignedBy = req.user!.id;
    
    // Validation
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'assignments array is required',
        error: { code: 'VALIDATION_ERROR' }
      });
    }
    
    // Verify user exists and is a FIELD_AGENT
    const userCheck = await client.query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' }
      });
    }
    
    if (userCheck.rows[0].role !== 'FIELD_AGENT') {
      return res.status(400).json({
        success: false,
        message: 'Territory assignments can only be made for FIELD_AGENT users',
        error: { code: 'INVALID_ROLE' }
      });
    }
    
    await client.query('BEGIN');
    
    // Step 1: Deactivate all existing assignments (soft delete)
    await client.query(`
      UPDATE "userPincodeAssignments" 
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND "isActive" = true
    `, [userId]);
    
    await client.query(`
      UPDATE "userAreaAssignments" 
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND "isActive" = true
    `, [userId]);
    
    let pincodeCount = 0;
    let areaCount = 0;
    
    // Step 2: Create new assignments
    for (const assignment of assignments) {
      const { pincodeId, areaIds } = assignment;
      
      // Insert pincode assignment
      const pincodeResult = await client.query(`
        INSERT INTO "userPincodeAssignments" 
        ("userId", "pincodeId", "assignedBy", "isActive")
        VALUES ($1, $2, $3, true)
        RETURNING id
      `, [userId, pincodeId, assignedBy]);
      
      const userPincodeAssignmentId = pincodeResult.rows[0].id;
      pincodeCount++;
      
      // Insert area assignments
      if (areaIds && areaIds.length > 0) {
        for (const areaId of areaIds) {
          await client.query(`
            INSERT INTO "userAreaAssignments" 
            ("userId", "pincodeId", "areaId", "userPincodeAssignmentId", "assignedBy", "isActive")
            VALUES ($1, $2, $3, $4, $5, true)
          `, [userId, pincodeId, areaId, userPincodeAssignmentId, assignedBy]);
          
          areaCount++;
        }
      }
    }
    
    await client.query('COMMIT');
    
    logger.info(`Bulk saved territory assignments for user ${userId}`, {
      userId,
      assignedBy,
      pincodeCount,
      areaCount
    });
    
    res.json({
      success: true,
      data: {
        pincodeAssignmentsCreated: pincodeCount,
        areaAssignmentsCreated: areaCount,
        message: 'Territory assignments saved successfully'
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error bulk saving territory assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save territory assignments',
      error: { code: 'INTERNAL_ERROR' }
    });
  } finally {
    client.release();
  }
};
```

### 2.4 New Routes Required

**File:** `CRM-BACKEND/src/routes/userTerritory.ts` (NEW FILE)

```typescript
import express from 'express';
import { param, body, query } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  getUserTerritoryAssignments,
  bulkSaveTerritoryAssignments
} from '@/controllers/userTerritoryController';

const router = express.Router();

// Apply authentication
router.use(authenticateToken);

// GET /api/users/:userId/territory-assignments
router.get(
  '/:userId/territory-assignments',
  [param('userId').isUUID().withMessage('Valid user ID is required')],
  validate,
  getUserTerritoryAssignments
);

// POST /api/users/:userId/territory-assignments/bulk
router.post(
  '/:userId/territory-assignments/bulk',
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('assignments')
      .isArray({ min: 1 })
      .withMessage('assignments array is required'),
    body('assignments.*.pincodeId')
      .isInt({ min: 1 })
      .withMessage('Each assignment must have a valid pincodeId'),
    body('assignments.*.areaIds')
      .isArray()
      .withMessage('Each assignment must have an areaIds array'),
    body('assignments.*.areaIds.*')
      .isInt({ min: 1 })
      .withMessage('Each areaId must be a valid integer')
  ],
  validate,
  bulkSaveTerritoryAssignments
);

export default router;
```

**Update:** `CRM-BACKEND/src/routes/areas.ts`

Add the batch endpoint:
```typescript
// GET /api/areas/by-pincodes?pincodeIds=1,2,3
router.get('/by-pincodes', getAreasByPincodes);
```

**Update:** `CRM-BACKEND/src/routes/users.ts`

Add the field agents endpoint:
```typescript
// GET /api/users/field-agents/available?pincodeId=1&areaId=2
router.get('/field-agents/available', getAvailableFieldAgents);
```

**Update:** `CRM-BACKEND/src/app.ts`

Register the new route:
```typescript
import userTerritoryRoutes from '@/routes/userTerritory';

// ... existing routes ...
app.use('/api/users', userTerritoryRoutes);
```

---

## 3. FRONTEND AUDIT & IMPLEMENTATION

### 3.1 Existing Frontend Services (Reusable)

**Already Available:**
- ✅ `locationsService.getPincodes()` - Fetch pincodes with pagination
- ✅ `locationsService.getAreasByPincode()` - Fetch areas for a pincode
- ✅ `usePincodes()` hook - React Query hook for pincodes
- ✅ `useAreasByPincode()` hook - React Query hook for areas

**Existing UI Components:**
- ✅ `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- ✅ `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- ✅ `Checkbox`
- ✅ `Button`
- ✅ `Badge`
- ✅ `Input` (for search)
- ✅ `Pagination` components
- ✅ `LoadingSpinner` (from `@/components/ui/loading`)

### 3.2 New Frontend Services Required

**File:** `CRM-FRONTEND/src/services/territoryAssignments.ts` (NEW FILE)

```typescript
import { apiService } from './api';
import type { ApiResponse } from '@/types/api';

export interface TerritoryAssignment {
  pincodeId: number;
  areaIds: number[];
}

export interface PincodeAssignment {
  assignmentId: number;
  pincodeId: number;
  pincodeCode: string;
  cityName: string;
  stateName: string;
  assignedAt: string;
  areaAssignments: AreaAssignment[];
}

export interface AreaAssignment {
  id: number;
  areaId: number;
  areaName: string;
  assignedAt: string;
}

export interface UserTerritoryAssignments {
  pincodeAssignments: PincodeAssignment[];
}

export class TerritoryAssignmentsService {
  // Get areas for multiple pincodes (batch)
  async getAreasByPincodes(pincodeIds: number[]): Promise<ApiResponse<Record<number, Array<{ id: number; name: string }>>>> {
    return apiService.get('/areas/by-pincodes', {
      pincodeIds: pincodeIds.join(',')
    });
  }
  
  // Get user territory assignments
  async getUserTerritoryAssignments(userId: string): Promise<ApiResponse<UserTerritoryAssignments>> {
    return apiService.get(`/users/${userId}/territory-assignments`);
  }
  
  // Bulk save territory assignments
  async bulkSaveTerritoryAssignments(
    userId: string,
    assignments: TerritoryAssignment[]
  ): Promise<ApiResponse<{ pincodeAssignmentsCreated: number; areaAssignmentsCreated: number; message: string }>> {
    return apiService.post(`/users/${userId}/territory-assignments/bulk`, {
      assignments
    });
  }
  
  // Get available field agents filtered by pincode + area
  async getAvailableFieldAgents(pincodeId: number, areaId?: number): Promise<ApiResponse<Array<{ id: string; name: string; employeeId: string; email: string }>>> {
    return apiService.get('/users/field-agents/available', {
      pincodeId,
      ...(areaId && { areaId })
    });
  }
}

export const territoryAssignmentsService = new TerritoryAssignmentsService();
```

### 3.3 New Frontend Hooks Required

**File:** `CRM-FRONTEND/src/hooks/useTerritoryAssignments.ts` (NEW FILE)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { territoryAssignmentsService, type TerritoryAssignment } from '@/services/territoryAssignments';

export const useUserTerritoryAssignments = (userId?: string) => {
  return useQuery({
    queryKey: ['user-territory-assignments', userId],
    queryFn: () => territoryAssignmentsService.getUserTerritoryAssignments(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAreasByPincodes = (pincodeIds: number[]) => {
  return useQuery({
    queryKey: ['areas-by-pincodes', pincodeIds.sort().join(',')],
    queryFn: () => territoryAssignmentsService.getAreasByPincodes(pincodeIds),
    enabled: pincodeIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useBulkSaveTerritoryAssignments = (userId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assignments: TerritoryAssignment[]) =>
      territoryAssignmentsService.bulkSaveTerritoryAssignments(userId, assignments),
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['user-territory-assignments', userId] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    }
  });
};

export const useAvailableFieldAgents = (pincodeId?: number, areaId?: number) => {
  return useQuery({
    queryKey: ['available-field-agents', pincodeId, areaId],
    queryFn: () => territoryAssignmentsService.getAvailableFieldAgents(pincodeId!, areaId),
    enabled: !!pincodeId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
```

### 3.4 TypeScript Interfaces Required

**File:** `CRM-FRONTEND/src/types/territoryAssignment.ts` (NEW FILE)

```typescript
export interface TerritoryAssignment {
  pincodeId: number;
  areaIds: number[];
}

export interface PincodeAssignment {
  assignmentId: number;
  pincodeId: number;
  pincodeCode: string;
  cityName: string;
  stateName: string;
  assignedAt: string;
  areaAssignments: AreaAssignment[];
}

export interface AreaAssignment {
  id: number;
  areaId: number;
  areaName: string;
  assignedAt: string;
}

export interface UserTerritoryAssignments {
  pincodeAssignments: PincodeAssignment[];
}

export interface PincodeWithCity {
  id: number;
  code: string;
  cityId: number;
  cityName: string;
  state: string;
  country: string;
  areas: Array<{ id: number; name: string; displayOrder: number }>;
}

export interface AssignmentSummaryItem {
  pincodeId: number;
  pincodeCode: string;
  cityName: string;
  stateName: string;
  areas: string[]; // Array of area names
}
```

---

## 4. REACT COMPONENTS IMPLEMENTATION

### 4.1 Component Hierarchy

```
TerritoryAssignmentSection (Main Container)
├── Tabs Component
│   ├── Tab 1: PincodeSelectionTab
│   │   ├── Search Input
│   │   ├── Selected Count Badge
│   │   ├── Pincode Checkbox List
│   │   └── Pagination
│   └── Tab 2: AreaSelectionTab
│       ├── Search Input
│       ├── Selected Count Badge
│       ├── Grouped Area Checkboxes (by pincode)
│       └── Bulk Action Buttons
└── AssignmentSummary
    ├── Summary List
    ├── Remove Buttons
    └── Save All Button
```

### 4.2 Main Component: TerritoryAssignmentSection

**File:** `CRM-FRONTEND/src/components/users/TerritoryAssignmentSection.tsx` (NEW FILE)

This component will be created in the next section with full implementation details.

### 4.3 Sub-Components

**Files to Create:**
1. `CRM-FRONTEND/src/components/users/PincodeSelectionTab.tsx`
2. `CRM-FRONTEND/src/components/users/AreaSelectionTab.tsx`
3. `CRM-FRONTEND/src/components/users/AssignmentSummary.tsx`

---

## 5. IMPLEMENTATION CHECKLIST

### Phase 1: Backend Setup (Day 1)

- [ ] **Task 1.1:** Create `CRM-BACKEND/src/controllers/userTerritoryController.ts`
  - [ ] Implement `getUserTerritoryAssignments`
  - [ ] Implement `bulkSaveTerritoryAssignments`
  
- [ ] **Task 1.2:** Update `CRM-BACKEND/src/controllers/areasController.ts`
  - [ ] Add `getAreasByPincodes` function
  
- [ ] **Task 1.3:** Update `CRM-BACKEND/src/controllers/usersController.ts`
  - [ ] Add `getAvailableFieldAgents` function
  
- [ ] **Task 1.4:** Create `CRM-BACKEND/src/routes/userTerritory.ts`
  - [ ] Define routes with validation
  
- [ ] **Task 1.5:** Update `CRM-BACKEND/src/routes/areas.ts`
  - [ ] Add `/by-pincodes` route
  
- [ ] **Task 1.6:** Update `CRM-BACKEND/src/routes/users.ts`
  - [ ] Add `/field-agents/available` route
  
- [ ] **Task 1.7:** Update `CRM-BACKEND/src/app.ts`
  - [ ] Register `userTerritoryRoutes`
  
- [ ] **Task 1.8:** Test all backend endpoints with Postman/curl

### Phase 2: Frontend Services & Hooks (Day 2 Morning)

- [ ] **Task 2.1:** Create `CRM-FRONTEND/src/types/territoryAssignment.ts`
  - [ ] Define all TypeScript interfaces
  
- [ ] **Task 2.2:** Create `CRM-FRONTEND/src/services/territoryAssignments.ts`
  - [ ] Implement `TerritoryAssignmentsService` class
  
- [ ] **Task 2.3:** Create `CRM-FRONTEND/src/hooks/useTerritoryAssignments.ts`
  - [ ] Implement all React Query hooks
  
- [ ] **Task 2.4:** Test services and hooks with console logging

### Phase 3: UI Components (Day 2 Afternoon - Day 3)

- [ ] **Task 3.1:** Create `CRM-FRONTEND/src/components/users/PincodeSelectionTab.tsx`
  - [ ] Implement search functionality
  - [ ] Implement checkbox selection
  - [ ] Implement pagination
  - [ ] Add "Select All" / "Clear All" buttons
  
- [ ] **Task 3.2:** Create `CRM-FRONTEND/src/components/users/AreaSelectionTab.tsx`
  - [ ] Implement grouped area display
  - [ ] Implement checkbox selection
  - [ ] Implement search filtering
  - [ ] Add bulk action buttons
  
- [ ] **Task 3.3:** Create `CRM-FRONTEND/src/components/users/AssignmentSummary.tsx`
  - [ ] Display summary list
  - [ ] Implement remove functionality
  - [ ] Implement save button with loading state
  
- [ ] **Task 3.4:** Create `CRM-FRONTEND/src/components/users/TerritoryAssignmentSection.tsx`
  - [ ] Integrate all sub-components
  - [ ] Implement state management
  - [ ] Handle tab switching logic
  - [ ] Connect to React Query hooks

### Phase 4: Integration (Day 3 Afternoon)

- [ ] **Task 4.1:** Update `CRM-FRONTEND/src/pages/UserPermissionsPage.tsx`
  - [ ] Import `TerritoryAssignmentSection`
  - [ ] Add conditional rendering for FIELD_AGENT role
  - [ ] Position after ProductAssignmentSection
  
- [ ] **Task 4.2:** Update Permission Summary section
  - [ ] Add territory information display
  - [ ] Show assigned pincodes and areas

### Phase 5: Testing & Refinement (Day 4)

- [ ] **Task 5.1:** End-to-end testing
  - [ ] Test pincode selection
  - [ ] Test area selection
  - [ ] Test summary display
  - [ ] Test save functionality
  - [ ] Test error handling
  
- [ ] **Task 5.2:** UI/UX refinement
  - [ ] Verify responsive design
  - [ ] Check color scheme consistency
  - [ ] Test loading states
  - [ ] Verify toast notifications
  
- [ ] **Task 5.3:** Performance testing
  - [ ] Test with large datasets (200+ pincodes)
  - [ ] Verify pagination performance
  - [ ] Check search responsiveness
  
- [ ] **Task 5.4:** Edge case testing
  - [ ] Test with no assignments
  - [ ] Test with all pincodes selected
  - [ ] Test deselecting pincode with areas
  - [ ] Test concurrent edits

### Phase 6: Documentation & Deployment (Day 4 Afternoon)

- [ ] **Task 6.1:** Update API documentation
- [ ] **Task 6.2:** Create user guide for territory assignment
- [ ] **Task 6.3:** Git commit with detailed message
- [ ] **Task 6.4:** Deploy to production

---

## 6. DEPENDENCIES & PACKAGES

### Backend Dependencies
**Status:** ✅ All required packages already installed
- `express` - Web framework
- `express-validator` - Request validation
- `pg` - PostgreSQL client
- `winston` - Logging

### Frontend Dependencies
**Status:** ✅ All required packages already installed
- `react` - UI library
- `react-router-dom` - Routing
- `@tanstack/react-query` - Data fetching
- `@radix-ui/react-tabs` - Tab component
- `@radix-ui/react-checkbox` - Checkbox component
- `lucide-react` - Icons
- `react-hot-toast` - Toast notifications
- `tailwindcss` - Styling

**No new packages need to be installed!**

---

## 7. ERROR HANDLING & VALIDATION

### Backend Validation Rules

1. **User ID Validation:**
   - Must be valid UUID
   - User must exist
   - User must be FIELD_AGENT role

2. **Pincode ID Validation:**
   - Must be positive integer
   - Pincode must exist in database

3. **Area ID Validation:**
   - Must be positive integer
   - Area must exist in database
   - Area must belong to the specified pincode

4. **Assignments Array Validation:**
   - Must be non-empty array
   - Each assignment must have pincodeId
   - Each assignment must have areaIds array
   - No duplicate pincode IDs

### Frontend Validation Rules

1. **Tab Switching:**
   - Tab 2 disabled if no pincodes selected
   - Warning message shown in Tab 2 if no pincodes

2. **Save Button:**
   - Disabled if no assignments
   - Disabled during save operation
   - Shows loading state

3. **Search Input:**
   - Debounced (300ms)
   - Case-insensitive
   - Trims whitespace

4. **Checkbox Selection:**
   - Prevents selecting areas for deselected pincodes
   - Auto-deselects areas when pincode is deselected

---

## 8. TESTING REQUIREMENTS

### Unit Tests

**Backend:**
- [ ] Test `getUserTerritoryAssignments` with valid userId
- [ ] Test `getUserTerritoryAssignments` with invalid userId
- [ ] Test `bulkSaveTerritoryAssignments` with valid data
- [ ] Test `bulkSaveTerritoryAssignments` with invalid data
- [ ] Test `getAreasByPincodes` with multiple pincodes
- [ ] Test `getAvailableFieldAgents` with pincode only
- [ ] Test `getAvailableFieldAgents` with pincode + area

**Frontend:**
- [ ] Test `TerritoryAssignmentSection` renders correctly
- [ ] Test pincode selection/deselection
- [ ] Test area selection/deselection
- [ ] Test tab switching logic
- [ ] Test summary generation
- [ ] Test save mutation

### Integration Tests

- [ ] Test complete flow: select pincodes → select areas → save
- [ ] Test loading existing assignments
- [ ] Test removing assignments
- [ ] Test field agent filtering in task assignment

### Manual Testing Checklist

- [ ] Select 5 pincodes, assign 3 areas each, save
- [ ] Edit existing assignments
- [ ] Remove all assignments
- [ ] Test with 100+ pincodes (pagination)
- [ ] Test search functionality
- [ ] Test on mobile devices
- [ ] Test with slow network (throttling)

---

## 9. ROLLBACK PLAN

### If Issues Arise:

1. **Backend Issues:**
   - Remove route registration from `app.ts`
   - Delete new controller file
   - Revert changes to existing controllers

2. **Frontend Issues:**
   - Remove `TerritoryAssignmentSection` from `UserPermissionsPage`
   - Delete new component files
   - Clear browser cache

3. **Database Issues:**
   - No schema changes made, so no rollback needed
   - Soft delete allows recovery of assignments

### Rollback Commands:

```bash
# Revert last commit
git revert HEAD

# Or reset to previous commit
git reset --hard <commit-hash>

# Restart backend
pm2 restart crm-backend

# Clear frontend build
cd CRM-FRONTEND && npm run build
```

---

## 10. SUCCESS CRITERIA

### Functional Requirements ✅

- [ ] Field agents can be assigned to multiple pincodes
- [ ] Field agents can be assigned to specific areas within pincodes
- [ ] Assignments are saved in a single transaction
- [ ] Existing assignments load correctly
- [ ] Field user dropdown in task assignment filters by pincode + area
- [ ] Audit trail captures all changes

### Performance Requirements ✅

- [ ] Page loads in < 2 seconds
- [ ] Search responds in < 300ms
- [ ] Save operation completes in < 1 second
- [ ] Handles 200+ pincodes without lag

### UX Requirements ✅

- [ ] Intuitive two-tab workflow
- [ ] Clear visual feedback for selections
- [ ] Responsive design works on all devices
- [ ] Error messages are user-friendly
- [ ] Loading states are clear

---

## 11. DETAILED COMPONENT SPECIFICATIONS

### 11.1 TerritoryAssignmentSection Component

**File:** `CRM-FRONTEND/src/components/users/TerritoryAssignmentSection.tsx`

**Props:**
```typescript
interface TerritoryAssignmentSectionProps {
  user: User; // User object with id, name, role
}
```

**State Management:**
```typescript
// Selected pincode IDs (Set for O(1) lookup)
const [selectedPincodeIds, setSelectedPincodeIds] = useState<Set<number>>(new Set());

// Selected area IDs per pincode (Map<pincodeId, Set<areaId>>)
const [selectedAreasByPincode, setSelectedAreasByPincode] = useState<Map<number, Set<number>>>(new Map());

// Active tab
const [activeTab, setActiveTab] = useState<'pincodes' | 'areas'>('pincodes');

// Search queries
const [pincodeSearchQuery, setPincodeSearchQuery] = useState('');
const [areaSearchQuery, setAreaSearchQuery] = useState('');

// Pagination
const [pincodePage, setPincodePage] = useState(1);
const PINCODES_PER_PAGE = 20;
```

**React Query Hooks:**
```typescript
// Fetch all pincodes
const { data: pincodesData, isLoading: pincodesLoading } = usePincodes({
  limit: 1000,
  search: pincodeSearchQuery
});

// Fetch areas for selected pincodes (batch)
const { data: areasData, isLoading: areasLoading } = useAreasByPincodes(
  Array.from(selectedPincodeIds)
);

// Fetch existing assignments
const { data: assignmentsData, isLoading: assignmentsLoading } = useUserTerritoryAssignments(user.id);

// Save mutation
const saveMutation = useBulkSaveTerritoryAssignments(user.id);
```

**Key Functions:**
```typescript
// Initialize selections from existing assignments
useEffect(() => {
  if (assignmentsData?.data?.pincodeAssignments) {
    const pincodeIds = new Set<number>();
    const areasByPincode = new Map<number, Set<number>>();

    assignmentsData.data.pincodeAssignments.forEach(assignment => {
      pincodeIds.add(assignment.pincodeId);

      const areaIds = new Set(
        assignment.areaAssignments.map(a => a.areaId)
      );
      areasByPincode.set(assignment.pincodeId, areaIds);
    });

    setSelectedPincodeIds(pincodeIds);
    setSelectedAreasByPincode(areasByPincode);
  }
}, [assignmentsData]);

// Handle pincode selection
const handlePincodeToggle = (pincodeId: number, checked: boolean) => {
  const newSelected = new Set(selectedPincodeIds);

  if (checked) {
    newSelected.add(pincodeId);
  } else {
    newSelected.delete(pincodeId);
    // Also remove all area selections for this pincode
    const newAreasByPincode = new Map(selectedAreasByPincode);
    newAreasByPincode.delete(pincodeId);
    setSelectedAreasByPincode(newAreasByPincode);
  }

  setSelectedPincodeIds(newSelected);
};

// Handle area selection
const handleAreaToggle = (pincodeId: number, areaId: number, checked: boolean) => {
  const newAreasByPincode = new Map(selectedAreasByPincode);
  const currentAreas = newAreasByPincode.get(pincodeId) || new Set<number>();

  if (checked) {
    currentAreas.add(areaId);
  } else {
    currentAreas.delete(areaId);
  }

  newAreasByPincode.set(pincodeId, currentAreas);
  setSelectedAreasByPincode(newAreasByPincode);
};

// Generate assignments for save
const generateAssignments = (): TerritoryAssignment[] => {
  const assignments: TerritoryAssignment[] = [];

  selectedPincodeIds.forEach(pincodeId => {
    const areaIds = Array.from(selectedAreasByPincode.get(pincodeId) || []);
    assignments.push({ pincodeId, areaIds });
  });

  return assignments;
};

// Handle save
const handleSave = async () => {
  const assignments = generateAssignments();

  if (assignments.length === 0) {
    toast.error('Please select at least one pincode');
    return;
  }

  try {
    await saveMutation.mutateAsync(assignments);
    toast.success('Territory assignments saved successfully');
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to save assignments');
  }
};

// Remove assignment from summary
const handleRemoveAssignment = (pincodeId: number) => {
  const newSelected = new Set(selectedPincodeIds);
  newSelected.delete(pincodeId);
  setSelectedPincodeIds(newSelected);

  const newAreasByPincode = new Map(selectedAreasByPincode);
  newAreasByPincode.delete(pincodeId);
  setSelectedAreasByPincode(newAreasByPincode);
};
```

**JSX Structure:**
```tsx
return (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Territory Assignments
      </CardTitle>
      <CardDescription>
        Assign pincodes and areas to this field agent
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pincodes' | 'areas')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pincodes">
            Select Pincodes ({selectedPincodeIds.size})
          </TabsTrigger>
          <TabsTrigger value="areas" disabled={selectedPincodeIds.size === 0}>
            Select Areas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pincodes">
          <PincodeSelectionTab
            pincodes={pincodesData?.data || []}
            selectedPincodeIds={selectedPincodeIds}
            onPincodeToggle={handlePincodeToggle}
            searchQuery={pincodeSearchQuery}
            onSearchChange={setPincodeSearchQuery}
            currentPage={pincodePage}
            onPageChange={setPincodePage}
            itemsPerPage={PINCODES_PER_PAGE}
            isLoading={pincodesLoading}
          />
        </TabsContent>

        <TabsContent value="areas">
          <AreaSelectionTab
            selectedPincodeIds={selectedPincodeIds}
            areasData={areasData?.data || {}}
            selectedAreasByPincode={selectedAreasByPincode}
            onAreaToggle={handleAreaToggle}
            searchQuery={areaSearchQuery}
            onSearchChange={setAreaSearchQuery}
            isLoading={areasLoading}
            pincodes={pincodesData?.data || []}
          />
        </TabsContent>
      </Tabs>

      {/* Summary */}
      <AssignmentSummary
        selectedPincodeIds={selectedPincodeIds}
        selectedAreasByPincode={selectedAreasByPincode}
        pincodes={pincodesData?.data || []}
        areasData={areasData?.data || {}}
        onRemove={handleRemoveAssignment}
        onSave={handleSave}
        isSaving={saveMutation.isPending}
      />
    </CardContent>
  </Card>
);
```

### 11.2 PincodeSelectionTab Component

**File:** `CRM-FRONTEND/src/components/users/PincodeSelectionTab.tsx`

**Props:**
```typescript
interface PincodeSelectionTabProps {
  pincodes: PincodeWithCity[];
  selectedPincodeIds: Set<number>;
  onPincodeToggle: (pincodeId: number, checked: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  isLoading: boolean;
}
```

**Implementation:**
```tsx
export function PincodeSelectionTab({
  pincodes,
  selectedPincodeIds,
  onPincodeToggle,
  searchQuery,
  onSearchChange,
  currentPage,
  onPageChange,
  itemsPerPage,
  isLoading
}: PincodeSelectionTabProps) {
  // Filter pincodes by search query
  const filteredPincodes = useMemo(() => {
    if (!searchQuery.trim()) return pincodes;

    const query = searchQuery.toLowerCase();
    return pincodes.filter(p =>
      p.code.toLowerCase().includes(query) ||
      p.cityName.toLowerCase().includes(query) ||
      p.state.toLowerCase().includes(query)
    );
  }, [pincodes, searchQuery]);

  // Paginate filtered pincodes
  const paginatedPincodes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPincodes.slice(startIndex, endIndex);
  }, [filteredPincodes, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPincodes.length / itemsPerPage);

  // Select all on current page
  const handleSelectAll = () => {
    paginatedPincodes.forEach(p => {
      if (!selectedPincodeIds.has(p.id)) {
        onPincodeToggle(p.id, true);
      }
    });
  };

  // Clear all on current page
  const handleClearAll = () => {
    paginatedPincodes.forEach(p => {
      if (selectedPincodeIds.has(p.id)) {
        onPincodeToggle(p.id, false);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search by pincode, city, or state..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isLoading}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={isLoading}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Selected Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {paginatedPincodes.length} of {filteredPincodes.length} pincodes
        </p>
        <Badge variant="secondary">
          {selectedPincodeIds.size} selected
        </Badge>
      </div>

      {/* Pincode List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : paginatedPincodes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No pincodes found
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto border rounded-md p-4">
          {paginatedPincodes.map(pincode => (
            <div
              key={pincode.id}
              className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded"
            >
              <Checkbox
                id={`pincode-${pincode.id}`}
                checked={selectedPincodeIds.has(pincode.id)}
                onCheckedChange={(checked) =>
                  onPincodeToggle(pincode.id, checked as boolean)
                }
              />
              <label
                htmlFor={`pincode-${pincode.id}`}
                className="flex-1 cursor-pointer text-sm"
              >
                <span className="font-medium text-green-600">{pincode.code}</span>
                {' - '}
                <span className="text-gray-900">{pincode.cityName}</span>
                {', '}
                <span className="text-gray-600">{pincode.state}</span>
              </label>
              <Badge variant="outline" className="text-xs">
                {pincode.areas.length} areas
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 11.3 AreaSelectionTab Component

**File:** `CRM-FRONTEND/src/components/users/AreaSelectionTab.tsx`

**Props:**
```typescript
interface AreaSelectionTabProps {
  selectedPincodeIds: Set<number>;
  areasData: Record<number, Array<{ id: number; name: string }>>;
  selectedAreasByPincode: Map<number, Set<number>>;
  onAreaToggle: (pincodeId: number, areaId: number, checked: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  pincodes: PincodeWithCity[];
}
```

**Implementation:**
```tsx
export function AreaSelectionTab({
  selectedPincodeIds,
  areasData,
  selectedAreasByPincode,
  onAreaToggle,
  searchQuery,
  onSearchChange,
  isLoading,
  pincodes
}: AreaSelectionTabProps) {
  // Get pincode details for selected pincodes
  const selectedPincodes = useMemo(() => {
    return pincodes.filter(p => selectedPincodeIds.has(p.id));
  }, [pincodes, selectedPincodeIds]);

  // Filter areas by search query
  const filteredAreasData = useMemo(() => {
    if (!searchQuery.trim()) return areasData;

    const query = searchQuery.toLowerCase();
    const filtered: Record<number, Array<{ id: number; name: string }>> = {};

    Object.entries(areasData).forEach(([pincodeId, areas]) => {
      const matchingAreas = areas.filter(area =>
        area.name.toLowerCase().includes(query)
      );
      if (matchingAreas.length > 0) {
        filtered[Number(pincodeId)] = matchingAreas;
      }
    });

    return filtered;
  }, [areasData, searchQuery]);

  // Calculate total selected areas
  const totalSelectedAreas = useMemo(() => {
    let count = 0;
    selectedAreasByPincode.forEach(areas => {
      count += areas.size;
    });
    return count;
  }, [selectedAreasByPincode]);

  // Select all areas for a pincode
  const handleSelectAllForPincode = (pincodeId: number) => {
    const areas = areasData[pincodeId] || [];
    areas.forEach(area => {
      onAreaToggle(pincodeId, area.id, true);
    });
  };

  // Clear all areas for a pincode
  const handleClearAllForPincode = (pincodeId: number) => {
    const areas = areasData[pincodeId] || [];
    areas.forEach(area => {
      onAreaToggle(pincodeId, area.id, false);
    });
  };

  if (selectedPincodeIds.size === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium">No pincodes selected</p>
        <p className="text-sm mt-2">
          Please select pincodes in the previous tab first
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search areas..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>
        <Badge variant="secondary">
          {totalSelectedAreas} areas selected
        </Badge>
      </div>

      {/* Areas Grouped by Pincode */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {selectedPincodes.map(pincode => {
            const areas = filteredAreasData[pincode.id] || [];
            const selectedAreas = selectedAreasByPincode.get(pincode.id) || new Set();

            if (areas.length === 0 && searchQuery.trim()) {
              return null; // Skip if no matching areas
            }

            return (
              <div key={pincode.id} className="border rounded-lg p-4">
                {/* Pincode Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {pincode.code} - {pincode.cityName}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {selectedAreas.size} of {areas.length} areas selected
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAllForPincode(pincode.id)}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClearAllForPincode(pincode.id)}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Area Checkboxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {areas.map(area => (
                    <div
                      key={area.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                    >
                      <Checkbox
                        id={`area-${pincode.id}-${area.id}`}
                        checked={selectedAreas.has(area.id)}
                        onCheckedChange={(checked) =>
                          onAreaToggle(pincode.id, area.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`area-${pincode.id}-${area.id}`}
                        className="flex-1 cursor-pointer text-sm text-gray-900"
                      >
                        {area.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### 11.4 AssignmentSummary Component

**File:** `CRM-FRONTEND/src/components/users/AssignmentSummary.tsx`

**Props:**
```typescript
interface AssignmentSummaryProps {
  selectedPincodeIds: Set<number>;
  selectedAreasByPincode: Map<number, Set<number>>;
  pincodes: PincodeWithCity[];
  areasData: Record<number, Array<{ id: number; name: string }>>;
  onRemove: (pincodeId: number) => void;
  onSave: () => void;
  isSaving: boolean;
}
```

**Implementation:**
```tsx
export function AssignmentSummary({
  selectedPincodeIds,
  selectedAreasByPincode,
  pincodes,
  areasData,
  onRemove,
  onSave,
  isSaving
}: AssignmentSummaryProps) {
  // Generate summary items
  const summaryItems = useMemo(() => {
    const items: AssignmentSummaryItem[] = [];

    selectedPincodeIds.forEach(pincodeId => {
      const pincode = pincodes.find(p => p.id === pincodeId);
      if (!pincode) return;

      const selectedAreas = selectedAreasByPincode.get(pincodeId) || new Set();
      const areas = areasData[pincodeId] || [];

      const areaNames = areas
        .filter(a => selectedAreas.has(a.id))
        .map(a => a.name);

      items.push({
        pincodeId,
        pincodeCode: pincode.code,
        cityName: pincode.cityName,
        stateName: pincode.state,
        areas: areaNames
      });
    });

    return items.sort((a, b) => a.pincodeCode.localeCompare(b.pincodeCode));
  }, [selectedPincodeIds, selectedAreasByPincode, pincodes, areasData]);

  const totalPincodes = selectedPincodeIds.size;
  const totalAreas = useMemo(() => {
    let count = 0;
    selectedAreasByPincode.forEach(areas => {
      count += areas.size;
    });
    return count;
  }, [selectedAreasByPincode]);

  if (totalPincodes === 0) {
    return (
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Assignment Summary</h3>
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <p>No assignments selected</p>
          <p className="text-sm mt-2">
            Select pincodes and areas to create assignments
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Assignment Summary</h3>
        <div className="flex gap-2">
          <Badge variant="secondary">
            {totalPincodes} pincodes
          </Badge>
          <Badge variant="secondary">
            {totalAreas} areas
          </Badge>
        </div>
      </div>

      {/* Summary List */}
      <div className="space-y-3 max-h-64 overflow-y-auto mb-4 border rounded-lg p-4 bg-gray-50">
        {summaryItems.map(item => (
          <div
            key={item.pincodeId}
            className="flex items-start justify-between p-3 bg-white rounded-lg border"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-green-600">
                  {item.pincodeCode}
                </span>
                <span className="text-gray-900">
                  {item.cityName}, {item.stateName}
                </span>
              </div>
              {item.areas.length > 0 ? (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Areas:</span>{' '}
                  {item.areas.join(', ')}
                </p>
              ) : (
                <p className="text-sm text-amber-600">
                  No areas selected for this pincode
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(item.pincodeId)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={isSaving || totalPincodes === 0}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isSaving ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save All Assignments
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
```

---

## NEXT STEPS

After reviewing this implementation plan, proceed with:

1. **Confirm approval** of the plan
2. **Start with Phase 1** (Backend Setup)
3. **Create a new git branch** for this feature
4. **Follow the checklist** step by step
5. **Test thoroughly** at each phase
6. **Request code review** before merging

**Estimated Total Time:** 3-4 days for complete implementation and testing.

