# Territory Assignment Implementation Options

## Database Schema Documentation

### Current Database Structure (Local Development)

#### 1. **Core Location Tables**

**`pincodes` Table:**
```sql
- id: integer (PK)
- code: varchar(10) (UNIQUE, NOT NULL)
- cityId: integer (FK -> cities.id)
- createdAt: timestamp
- updatedAt: timestamp
```

**`areas` Table:**
```sql
- id: integer (PK)
- name: varchar(255) (NOT NULL)
- createdAt: timestamp
- updatedAt: timestamp
```

**`pincodeAreas` Table (Junction):**
```sql
- id: integer (PK)
- pincodeId: integer (FK -> pincodes.id)
- areaId: integer (FK -> areas.id)
- displayOrder: integer (1-50)
- createdAt: timestamp
- updatedAt: timestamp
```

#### 2. **Territory Assignment Tables**

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

**`territoryAssignmentAudit` Table:**
- Audit trail for all territory assignment changes
- Tracks who made changes and when

### Current Data Status
- **userPincodeAssignments**: 0 records
- **userAreaAssignments**: 0 records
- Database schema is intact and ready for use

---

## Implementation Options

### **Option 1: Simple Checkbox-Based Assignment (RECOMMENDED)**

#### **Complexity Level:** Simple

#### **Database Schema Approach:**
- ✅ Use existing `userPincodeAssignments` and `userAreaAssignments` tables
- No schema changes needed
- Leverage existing indexes and foreign keys

#### **Frontend UI/UX Design:**

**Manage Permissions Page (`/users/{userId}/permissions`):**

1. **Pincode Assignment Section:**
   - Card with title "Territory Assignments - Pincodes"
   - Paginated list of pincodes (20 per page) with search functionality
   - Each pincode shows: Code, City, State
   - Simple checkbox next to each pincode
   - "Save Pincode Assignments" button at bottom
   - Display currently assigned pincodes in a separate "Assigned Pincodes" section with individual delete buttons

2. **Area Assignment Section (appears after pincodes are assigned):**
   - For each assigned pincode, show a collapsible card
   - Card header: "Areas for Pincode {code} ({cityName})"
   - Inside card: List of areas belonging to that pincode with checkboxes
   - "Save Areas for {pincode}" button for each pincode
   - Display assigned areas as badges within each pincode card

**Visual Layout:**
```
┌─────────────────────────────────────────────┐
│ Territory Assignments - Pincodes            │
├─────────────────────────────────────────────┤
│ Search: [_____________]                     │
│                                             │
│ Available Pincodes:                         │
│ ☐ 400001 - Mumbai, Maharashtra              │
│ ☐ 400002 - Mumbai, Maharashtra              │
│ ☐ 110001 - Delhi, Delhi                     │
│ ...                                         │
│ [Pagination: 1 2 3 ... 10]                  │
│                                             │
│ [Save Pincode Assignments]                  │
│                                             │
│ Assigned Pincodes:                          │
│ ┌───────────────────────────────────────┐   │
│ │ 400001 - Mumbai [Delete]              │   │
│ │ ┌─ Areas for 400001 ─────────────┐    │   │
│ │ │ ☐ Andheri                       │    │   │
│ │ │ ☐ Bandra                        │    │   │
│ │ │ ☑ Juhu (assigned)               │    │   │
│ │ │ [Save Areas for 400001]         │    │   │
│ │ └─────────────────────────────────┘    │   │
│ └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

#### **Backend API Endpoints:**

```typescript
// 1. Get field agent's territory assignments
GET /api/users/:userId/territory-assignments
Response: {
  pincodeAssignments: [
    {
      id: number,
      pincodeId: number,
      pincodeCode: string,
      cityName: string,
      stateName: string,
      assignedAt: string,
      areaAssignments: [
        { id: number, areaId: number, areaName: string, assignedAt: string }
      ]
    }
  ]
}

// 2. Assign pincodes to field agent
POST /api/users/:userId/territory-assignments/pincodes
Body: { pincodeIds: number[] }
Response: { success: boolean, data: { assignedCount: number } }

// 3. Assign areas for a specific pincode
POST /api/users/:userId/territory-assignments/pincodes/:pincodeId/areas
Body: { areaIds: number[] }
Response: { success: boolean, data: { assignedCount: number } }

// 4. Remove pincode assignment (cascades to areas)
DELETE /api/users/:userId/territory-assignments/pincodes/:pincodeId
Response: { success: boolean }

// 5. Remove specific area assignment
DELETE /api/users/:userId/territory-assignments/areas/:areaId
Response: { success: boolean }

// 6. Get available field users for task assignment (filtered by pincode + area)
GET /api/users/field-agents/available?pincodeId={id}&areaId={id}
Response: {
  users: [
    { id: string, name: string, employeeId: string, email: string }
  ]
}
```

#### **Filtering Logic for Task Assignment:**

When backend user creates/assigns a verification task:

```sql
-- Get field users assigned to specific pincode AND area
SELECT DISTINCT u.id, u.name, u.email, u."employeeId"
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
ORDER BY u.name;
```

**Alternative: If no area is selected (entire pincode):**
```sql
-- Get field users assigned to pincode (regardless of specific areas)
SELECT DISTINCT u.id, u.name, u.email, u."employeeId"
FROM users u
INNER JOIN "userPincodeAssignments" upa 
  ON u.id = upa."userId" 
  AND upa."pincodeId" = $1 
  AND upa."isActive" = true
WHERE u.role = 'FIELD_AGENT' 
  AND u."isActive" = true
ORDER BY u.name;
```

#### **Pros:**
- ✅ Simple, intuitive UI
- ✅ No complex state management
- ✅ Uses existing database schema
- ✅ Clear separation between pincode and area assignment
- ✅ Easy to understand and maintain
- ✅ Proper filtering ensures only relevant field users are shown
- ✅ Audit trail built-in via database triggers

#### **Cons:**
- ⚠️ Requires multiple save operations (pincodes first, then areas)
- ⚠️ Slightly more clicks for users
- ⚠️ Need to handle pagination for large pincode lists

---

### **Option 2: Hierarchical Tree Selection**

#### **Complexity Level:** Moderate

#### **Database Schema Approach:**
- ✅ Use existing tables
- No changes needed

#### **Frontend UI/UX Design:**

**Tree Structure:**
```
Territory Assignments
├─ 📍 400001 - Mumbai, Maharashtra [☑]
│  ├─ Andheri [☐]
│  ├─ Bandra [☑]
│  └─ Juhu [☑]
├─ 📍 400002 - Mumbai, Maharashtra [☐]
│  ├─ Colaba [☐]
│  └─ Fort [☐]
└─ 📍 110001 - Delhi, Delhi [☑]
   ├─ Connaught Place [☑]
   └─ Karol Bagh [☐]

[Save All Assignments]
```

- Use a tree component (e.g., `react-checkbox-tree`)
- Parent checkbox (pincode) selects/deselects all child areas
- Individual area checkboxes for granular control
- Single "Save All Assignments" button
- Search/filter functionality

#### **Backend API Endpoints:**
```typescript
// 1. Get territory tree structure
GET /api/territory-assignments/tree
Response: { pincodes: [ { id, code, city, areas: [...] } ] }

// 2. Save all assignments at once
POST /api/users/:userId/territory-assignments/bulk
Body: {
  assignments: [
    { pincodeId: 1, areaIds: [1, 2, 3] },
    { pincodeId: 2, areaIds: [] } // Empty = entire pincode
  ]
}

// 3. Get available field users (same as Option 1)
GET /api/users/field-agents/available?pincodeId={id}&areaId={id}
```

#### **Filtering Logic:**
Same as Option 1

#### **Pros:**
- ✅ Visual hierarchy makes relationships clear
- ✅ Single save operation
- ✅ Parent-child selection is intuitive
- ✅ Good for users who need to assign many territories at once

#### **Cons:**
- ⚠️ More complex frontend component
- ⚠️ Requires additional npm package
- ⚠️ Can be overwhelming with many pincodes
- ⚠️ Harder to implement search/filter
- ⚠️ More complex state management

---

### **Option 3: Dual-List Transfer (Transfer List)**

#### **Complexity Level:** Moderate

#### **Database Schema Approach:**
- ✅ Use existing tables
- No changes needed

#### **Frontend UI/UX Design:**

```
Available Pincodes          Assigned Pincodes
┌─────────────────┐         ┌─────────────────┐
│ ☐ 400001        │         │ ☑ 110001        │
│ ☐ 400002        │  [>>]   │ ☑ 110002        │
│ ☐ 400003        │  [<<]   │                 │
│ ☐ 400004        │         │                 │
└─────────────────┘         └─────────────────┘

For each assigned pincode, show area transfer list below
```

- Two lists: Available vs Assigned
- Move items between lists with buttons
- Separate transfer lists for areas under each pincode
- Single save button

#### **Backend API Endpoints:**
Same as Option 1

#### **Filtering Logic:**
Same as Option 1

#### **Pros:**
- ✅ Clear visual separation of assigned vs available
- ✅ Familiar pattern for users
- ✅ Easy to see what's assigned at a glance

#### **Cons:**
- ⚠️ Takes more screen space
- ⚠️ Requires custom component or library
- ⚠️ Can be confusing with nested lists (pincodes + areas)
- ⚠️ More complex state management

---

### **Option 4: Two-Tab Interface with Combined Summary (RECOMMENDED)**

#### **Complexity Level:** Simple to Moderate

#### **Database Schema Approach:**
- ✅ Use existing `userPincodeAssignments` and `userAreaAssignments` tables
- No schema changes needed
- Leverage existing indexes and foreign keys
- Single transaction for saving all assignments

#### **Frontend UI/UX Design:**

**Location:** Manage User Permissions page (`/users/{userId}/permissions`)

**Component Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│ Territory Assignments for Field Agent                       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Tab 1: Select Pincodes] [Tab 2: Select Areas]         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ TAB 1: SELECT PINCODES ──────────────────────────────┐  │
│ │                                                        │  │
│ │ Search: [_____________] 🔍                            │  │
│ │                                                        │  │
│ │ 📌 5 pincodes selected                                │  │
│ │                                                        │  │
│ │ Available Pincodes:                                   │  │
│ │ ┌────────────────────────────────────────────────┐    │  │
│ │ │ ☑ 400001 - Mumbai, Maharashtra                 │    │  │
│ │ │ ☐ 400002 - Mumbai, Maharashtra                 │    │  │
│ │ │ ☑ 400003 - Mumbai, Maharashtra                 │    │  │
│ │ │ ☑ 110001 - Delhi, Delhi                        │    │  │
│ │ │ ☑ 110002 - Delhi, Delhi                        │    │  │
│ │ │ ☐ 560001 - Bangalore, Karnataka                │    │  │
│ │ │ ☑ 560002 - Bangalore, Karnataka                │    │  │
│ │ │ ...                                             │    │  │
│ │ └────────────────────────────────────────────────┘    │  │
│ │ [Pagination: 1 2 3 ... 10]                            │  │
│ │                                                        │  │
│ │ [Clear All] [Select All on Page]                      │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─ ASSIGNMENT SUMMARY ──────────────────────────────────┐  │
│ │                                                        │  │
│ │ Current Assignments:                                  │  │
│ │                                                        │  │
│ │ 📍 400001 - Mumbai: Andheri, Bandra, Juhu [Remove]   │  │
│ │ 📍 400003 - Mumbai: Colaba, Fort [Remove]            │  │
│ │ 📍 110001 - Delhi: Connaught Place [Remove]          │  │
│ │ 📍 110002 - Delhi: Karol Bagh, Rohini [Remove]       │  │
│ │ 📍 560002 - Bangalore: Koramangala [Remove]          │  │
│ │                                                        │  │
│ │ [Save All Assignments]                                │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Tab 1: Select Pincodes**
- Header shows count: "📌 X pincodes selected"
- Search box filters pincodes by code, city, or state
- Checkbox list of all available pincodes
- Each row shows: `{code} - {city}, {state}`
- Pagination (20 items per page)
- "Clear All" and "Select All on Page" buttons
- Selected pincodes are highlighted with green background
- Checkboxes remain checked even when navigating pages

**Tab 2: Select Areas**
```
┌─ TAB 2: SELECT AREAS ─────────────────────────────────┐
│                                                        │
│ Search: [_____________] 🔍                            │
│                                                        │
│ 📍 12 areas selected from 5 pincodes                  │
│                                                        │
│ ⚠️ Please select pincodes in Tab 1 first             │
│    (shown if no pincodes selected)                    │
│                                                        │
│ Areas from Selected Pincodes:                         │
│ ┌────────────────────────────────────────────────┐    │
│ │ 📍 Pincode: 400001 - Mumbai, Maharashtra       │    │
│ │    ☑ Andheri                                   │    │
│ │    ☑ Bandra                                    │    │
│ │    ☑ Juhu                                      │    │
│ │    ☐ Versova                                   │    │
│ │                                                 │    │
│ │ 📍 Pincode: 400003 - Mumbai, Maharashtra       │    │
│ │    ☑ Colaba                                    │    │
│ │    ☑ Fort                                      │    │
│ │    ☐ Gateway of India                          │    │
│ │                                                 │    │
│ │ 📍 Pincode: 110001 - Delhi, Delhi              │    │
│ │    ☑ Connaught Place                           │    │
│ │    ☐ Janpath                                   │    │
│ │                                                 │    │
│ │ 📍 Pincode: 110002 - Delhi, Delhi              │    │
│ │    ☑ Karol Bagh                                │    │
│ │    ☑ Rohini                                    │    │
│ │                                                 │    │
│ │ 📍 Pincode: 560002 - Bangalore, Karnataka      │    │
│ │    ☑ Koramangala                               │    │
│ │    ☐ HSR Layout                                │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
│ [Clear All Areas] [Select All Areas]                  │
└────────────────────────────────────────────────────────┘
```

**Tab 2: Select Areas**
- Only enabled if at least one pincode is selected in Tab 1
- Header shows count: "📍 X areas selected from Y pincodes"
- Search box filters areas by name
- Areas grouped by pincode with visual separators
- Each pincode group shows: `📍 Pincode: {code} - {city}, {state}`
- Checkboxes for each area under its pincode
- "Clear All Areas" and "Select All Areas" buttons
- Selected areas highlighted with green background
- If user deselects a pincode in Tab 1, its areas are automatically deselected

**Assignment Summary Section (Below Tabs)**
- Always visible below the tabs
- Shows final pincode-area combinations
- Format: `📍 {code} - {city}: {area1}, {area2}, {area3} [Remove]`
- Each row has a "Remove" button to delete that pincode's assignments
- "Save All Assignments" button (disabled if no selections)
- Shows loading state during save operation
- Success/error toast notifications

#### **State Management:**

```typescript
interface TerritoryAssignmentState {
  // Tab 1 state
  selectedPincodeIds: Set<number>;
  pincodeSearchQuery: string;
  pincodeCurrentPage: number;

  // Tab 2 state
  selectedAreasByPincode: Map<number, Set<number>>; // pincodeId -> Set of areaIds
  areaSearchQuery: string;

  // UI state
  activeTab: 'pincodes' | 'areas';
  isSaving: boolean;

  // Data
  allPincodes: Pincode[];
  areasByPincode: Map<number, Area[]>; // Fetched for selected pincodes only
}
```

#### **Backend API Endpoints:**

```typescript
// 1. Get all pincodes with city/state info
GET /api/pincodes?include=city,state
Response: {
  data: [
    {
      id: number,
      code: string,
      city: { id: number, name: string, state: { name: string } }
    }
  ]
}

// 2. Get areas for multiple pincodes (batch request)
GET /api/areas/by-pincodes?pincodeIds=1,2,3,4,5
Response: {
  data: {
    "1": [{ id: 1, name: "Andheri" }, { id: 2, name: "Bandra" }],
    "2": [{ id: 3, name: "Colaba" }],
    ...
  }
}

// 3. Get current territory assignments for a field agent
GET /api/users/:userId/territory-assignments
Response: {
  data: {
    pincodeAssignments: [
      {
        id: number,
        pincodeId: number,
        pincode: { code: string, city: { name: string, state: { name: string } } },
        assignedAt: string,
        areaAssignments: [
          { id: number, areaId: number, area: { name: string }, assignedAt: string }
        ]
      }
    ]
  }
}

// 4. Save all territory assignments (bulk operation)
POST /api/users/:userId/territory-assignments/bulk
Body: {
  assignments: [
    { pincodeId: 1, areaIds: [1, 2, 3] },
    { pincodeId: 2, areaIds: [4, 5] },
    { pincodeId: 3, areaIds: [6] }
  ]
}
Response: {
  success: true,
  data: {
    pincodeAssignmentsCreated: 3,
    areaAssignmentsCreated: 6,
    message: "Territory assignments saved successfully"
  }
}

// 5. Remove all territory assignments for a field agent
DELETE /api/users/:userId/territory-assignments
Response: { success: true }

// 6. Get available field users for task assignment (filtered by pincode + area)
GET /api/users/field-agents/available?pincodeId={id}&areaId={id}
Response: {
  data: [
    { id: string, name: string, employeeId: string, email: string }
  ]
}
```

#### **Backend Implementation Logic:**

**Bulk Save Endpoint (`POST /api/users/:userId/territory-assignments/bulk`):**

```typescript
async function bulkSaveAssignments(userId: string, assignments: Assignment[], assignedBy: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Deactivate all existing assignments (soft delete)
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

    // 2. Create new pincode and area assignments
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

      // Insert area assignments for this pincode
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

    return {
      pincodeAssignmentsCreated: pincodeCount,
      areaAssignmentsCreated: areaCount
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

#### **Filtering Logic for Task Assignment:**

Same SQL queries as Option 1:

```sql
-- Get field users assigned to specific pincode AND area
SELECT DISTINCT u.id, u.name, u.email, u."employeeId"
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
ORDER BY u.name;
```

#### **Frontend Component Structure:**

```typescript
// Main component
const TerritoryAssignmentSection: React.FC<{ userId: string }> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<'pincodes' | 'areas'>('pincodes');
  const [selectedPincodeIds, setSelectedPincodeIds] = useState<Set<number>>(new Set());
  const [selectedAreasByPincode, setSelectedAreasByPincode] = useState<Map<number, Set<number>>>(new Map());

  // Queries
  const { data: allPincodes } = useQuery(['pincodes'], fetchPincodes);
  const { data: currentAssignments } = useQuery(['territory-assignments', userId],
    () => fetchTerritoryAssignments(userId));

  // Fetch areas for selected pincodes
  const { data: areasByPincode } = useQuery(
    ['areas-by-pincodes', Array.from(selectedPincodeIds)],
    () => fetchAreasByPincodes(Array.from(selectedPincodeIds)),
    { enabled: selectedPincodeIds.size > 0 }
  );

  // Mutation
  const saveMutation = useMutation(
    (assignments: Assignment[]) => saveBulkAssignments(userId, assignments),
    {
      onSuccess: () => {
        toast.success('Territory assignments saved successfully');
        queryClient.invalidateQueries(['territory-assignments', userId]);
      }
    }
  );

  // Build summary data
  const assignmentSummary = useMemo(() => {
    const summary: SummaryItem[] = [];

    selectedPincodeIds.forEach(pincodeId => {
      const pincode = allPincodes?.find(p => p.id === pincodeId);
      const areaIds = selectedAreasByPincode.get(pincodeId) || new Set();
      const areas = areasByPincode?.[pincodeId]?.filter(a => areaIds.has(a.id)) || [];

      if (areas.length > 0) {
        summary.push({
          pincodeId,
          pincodeCode: pincode?.code || '',
          cityName: pincode?.city?.name || '',
          areas: areas.map(a => a.name)
        });
      }
    });

    return summary;
  }, [selectedPincodeIds, selectedAreasByPincode, allPincodes, areasByPincode]);

  const handleSave = () => {
    const assignments = Array.from(selectedPincodeIds).map(pincodeId => ({
      pincodeId,
      areaIds: Array.from(selectedAreasByPincode.get(pincodeId) || new Set())
    }));

    saveMutation.mutate(assignments);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Territory Assignments</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pincodes">
              Select Pincodes {selectedPincodeIds.size > 0 && `(${selectedPincodeIds.size})`}
            </TabsTrigger>
            <TabsTrigger value="areas" disabled={selectedPincodeIds.size === 0}>
              Select Areas {/* count */}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pincodes">
            <PincodeSelectionTab
              pincodes={allPincodes}
              selectedIds={selectedPincodeIds}
              onSelectionChange={setSelectedPincodeIds}
            />
          </TabsContent>

          <TabsContent value="areas">
            <AreaSelectionTab
              selectedPincodeIds={selectedPincodeIds}
              areasByPincode={areasByPincode}
              selectedAreasByPincode={selectedAreasByPincode}
              onSelectionChange={setSelectedAreasByPincode}
            />
          </TabsContent>
        </Tabs>

        <AssignmentSummary
          summary={assignmentSummary}
          onRemove={(pincodeId) => {
            setSelectedPincodeIds(prev => {
              const next = new Set(prev);
              next.delete(pincodeId);
              return next;
            });
            setSelectedAreasByPincode(prev => {
              const next = new Map(prev);
              next.delete(pincodeId);
              return next;
            });
          }}
          onSave={handleSave}
          isSaving={saveMutation.isLoading}
          disabled={assignmentSummary.length === 0}
        />
      </CardContent>
    </Card>
  );
};
```

#### **Pros:**
- ✅ **Intuitive workflow**: Select pincodes first, then areas from those pincodes
- ✅ **Clear visual organization**: Tabs separate the two-step process
- ✅ **Efficient area selection**: See all areas from multiple pincodes in one view
- ✅ **Summary preview**: Users can review before saving
- ✅ **Single save operation**: All assignments saved in one transaction
- ✅ **Bulk operations**: "Select All" and "Clear All" for efficiency
- ✅ **Search functionality**: Easy to find specific pincodes or areas
- ✅ **Visual feedback**: Selected count, highlighted items, disabled states
- ✅ **Error prevention**: Tab 2 disabled until pincodes selected
- ✅ **Flexible removal**: Can remove individual pincode-area groups before saving
- ✅ **Uses existing schema**: No database changes needed
- ✅ **Audit trail**: Built-in via database triggers

#### **Cons:**
- ⚠️ **Moderate complexity**: More complex than Option 1, simpler than Options 2-3
- ⚠️ **State management**: Need to manage two sets of selections (pincodes + areas)
- ⚠️ **Tab switching**: Users need to switch between tabs (but this is also a pro for clarity)
- ⚠️ **Memory usage**: Loading all areas for selected pincodes at once (mitigated by batch API)
- ⚠️ **Learning curve**: Users need to understand the two-step process

#### **When to Use This Option:**
- ✅ When field agents are typically assigned to multiple pincodes
- ✅ When you want to select areas across multiple pincodes efficiently
- ✅ When you need a clear, guided workflow
- ✅ When you want to preview assignments before saving
- ✅ When bulk operations are important

---

## Recommendation

**I recommend Option 4: Two-Tab Interface with Combined Summary**

### Reasons:
1. **Best User Experience**: Clear two-step workflow guides users naturally
2. **Efficient Bulk Operations**: Select multiple pincodes, then all their areas in one view
3. **Visual Clarity**: Tabs separate concerns, summary shows final result
4. **Error Prevention**: Disabled states and validation prevent mistakes
5. **Existing Schema**: Works perfectly with current database structure
6. **Single Transaction**: All assignments saved atomically
7. **Flexible**: Easy to add/remove assignments before saving
8. **Scalable**: Handles large datasets with search and pagination
9. **Audit Trail**: Built-in via database triggers
10. **Maintainable**: Clear component structure, moderate complexity

### Comparison with Other Options:
- **vs Option 1**: More efficient for bulk assignments, better UX for multiple pincodes
- **vs Option 2**: Simpler state management, no external tree library needed
- **vs Option 3**: Better use of screen space, clearer workflow

### Next Steps:
1. Create backend API endpoints (bulk save, batch area fetch)
2. Build tab-based UI components (PincodeSelectionTab, AreaSelectionTab, AssignmentSummary)
3. Implement state management with React hooks
4. Add search and pagination functionality
5. Implement filtering logic in task assignment
6. Test with real data
7. Deploy and iterate based on feedback

