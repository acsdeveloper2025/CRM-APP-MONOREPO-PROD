# Search & Filter Removal Plan

**Date:** 2025-10-30  
**Status:** Phase 0 - Cleanup Before Implementation  
**Purpose:** Remove all existing inconsistent search/filter implementations before implementing standardized solution

---

## Overview

Before implementing the new standardized search and filter architecture, we need to remove all existing inconsistent implementations. This ensures a clean slate and prevents conflicts between old and new code.

---

## Removal Strategy

### Approach
1. **Remove UI Components:** Remove search inputs, filter dropdowns, date pickers from page templates
2. **Remove State Management:** Remove useState hooks for search/filter state
3. **Remove Debounce Hooks:** Remove useDebounce, useDebouncedSearch, useSearchInput calls
4. **Simplify API Calls:** Remove filter parameters from API calls (temporarily fetch all data)
5. **Keep Table Display:** Keep table components and basic data display
6. **Keep Pagination:** Keep pagination components (will be integrated with new filters)

### What to Keep
- ✅ Table components (Table, TableHeader, TableBody, etc.)
- ✅ Card components for stats/summaries
- ✅ Pagination components
- ✅ Basic data fetching with React Query
- ✅ Tab navigation (Tabs, TabsList, TabsTrigger)
- ✅ Action buttons (Create, Export, etc.)

### What to Remove
- ❌ Search input fields
- ❌ Filter dropdown selects
- ❌ Date range pickers (for filtering)
- ❌ useDebounce hooks
- ❌ useDebouncedSearch hooks
- ❌ useSearchInput hooks
- ❌ CaseFilters component
- ❌ TaskFilters component
- ❌ Filter state (useState for filters)
- ❌ Filter parameters in API calls

---

## Pages to Clean Up

### 1. Cases Pages (4 pages)

#### CasesPage.tsx
**Remove:**
- `useSearchInput` hook
- `CaseFilters` component
- Search value state
- Filter change handlers
- `queryFilters` object (merge with filters)

**Keep:**
- `useCases` hook (simplified)
- `CaseTable` component
- Pagination
- "New Case" button

**Before:**
```typescript
const { debouncedSearchValue, setSearchValue } = useSearchInput('', 400);
const [filters, setFilters] = useState<CaseListQuery>({...});
const queryFilters = { ...filters, search: debouncedSearchValue };
const { data } = useCases(queryFilters);
```

**After:**
```typescript
const [filters, setFilters] = useState<CaseListQuery>({
  page: 1,
  limit: 20,
  sortBy: 'caseId',
  sortOrder: 'desc',
});
const { data } = useCases(filters);
```

#### PendingCasesPage.tsx
**Remove:**
- `searchTerm` state
- `useDebounce` hook
- Search input field
- Client filter dropdown
- Assigned user filter dropdown
- Filter change handlers

**Keep:**
- `useCases` hook with status preset
- `CaseTable` component
- Pagination

#### InProgressCasesPage.tsx
**Remove:** Same as PendingCasesPage

#### CompletedCasesPage.tsx
**Remove:** Same as PendingCasesPage + date range picker

---

### 2. Tasks Pages (4 pages)

#### AllTasksPage.tsx
**Remove:**
- `searchTerm` state
- `useDebounce` hook
- `TaskFilters` component
- Search input field
- All filter dropdowns

**Keep:**
- `useAllVerificationTasks` hook
- `TasksListFlat` or `TasksGroupedByCase` component
- Pagination
- Action buttons

#### PendingTasksPage.tsx, InProgressTasksPage.tsx, CompletedTasksPage.tsx
**Remove:** Same as AllTasksPage

---

### 3. Users Pages

#### UsersPage.tsx
**Remove:**
- `searchTerm` state
- `useDebounce` hook
- Search input field
- Role filter dropdown
- Department filter dropdown
- Status filter dropdown

**Keep:**
- `useUsers` hook
- `UsersTable` component
- Tabs (users, activities, sessions)
- "Create User" button

#### DepartmentsTable.tsx
**Remove:**
- `useDebouncedSearch` hook
- Search input field

**Keep:**
- `useQuery` for departments
- Table display
- Edit/Delete actions

#### RolesTable.tsx
**Remove:** Same as DepartmentsTable

---

### 4. Client Pages

#### ClientsPage.tsx
**Remove:**
- `useSearchInput` hook
- `clearSearch` function
- Search input field
- Tab-specific search clearing

**Keep:**
- Tab navigation
- `ClientsTable`, `ProductsTable`, `VerificationTypesTable`, `DocumentTypesTable`
- Create buttons

#### ProductsPage.tsx
**Remove:**
- `useSearchInput` hook
- Search input field

**Keep:**
- `useQuery` for products
- `ProductsTable`
- Stats cards

#### DocumentTypesPage.tsx, VerificationTypesPage.tsx
**Remove:** Same as ProductsPage

---

### 5. Reports & Billing Pages

#### ReportsPage.tsx
**Remove:**
- `searchQuery` state
- `selectedStatus` state
- `selectedClient` state
- `dateRange` state (for filtering)
- Search input field
- Status filter dropdown
- Client filter dropdown
- Date range picker (for filtering)

**Keep:**
- Tab navigation
- `BankBillsTable`, `MISReportsTable`
- Charts (TurnaroundTimeChart, CompletionRateChart)
- Summary cards
- Export buttons
- Date range picker for charts (if separate from filters)

#### BillingPage.tsx
**Remove:** Same as ReportsPage

---

### 6. Locations Page

#### LocationsPage.tsx
**Remove:**
- `useSearchInput` hook
- `selectedState`, `selectedCountry`, `selectedContinent` state
- Search input field
- Filter dropdowns

**Keep:**
- Tab navigation (with URL sync)
- Table components for each location type
- Create buttons
- Bulk import button

---

### 7. Components to Remove/Deprecate

#### CaseFilters.tsx
**Action:** Mark as deprecated or remove entirely
**Reason:** Will be replaced by new `FilterBar` component

#### TaskFilters.tsx
**Action:** Mark as deprecated or remove entirely
**Reason:** Will be replaced by new `FilterBar` component

---

## Implementation Steps

### Step 1: Cases Pages (HIGH PRIORITY)
1. Remove search/filter from CasesPage.tsx
2. Remove search/filter from PendingCasesPage.tsx
3. Remove search/filter from InProgressCasesPage.tsx
4. Remove search/filter from CompletedCasesPage.tsx
5. Test that pages still load and display data

### Step 2: Tasks Pages (HIGH PRIORITY)
1. Remove search/filter from AllTasksPage.tsx
2. Remove search/filter from PendingTasksPage.tsx
3. Remove search/filter from InProgressTasksPage.tsx
4. Remove search/filter from CompletedTasksPage.tsx
5. Test that pages still load and display data

### Step 3: Users Pages (MEDIUM PRIORITY)
1. Remove search/filter from UsersPage.tsx
2. Remove search from DepartmentsTable.tsx
3. Remove search from RolesTable.tsx
4. Test that pages still load and display data

### Step 4: Client Pages (MEDIUM PRIORITY)
1. Remove search from ClientsPage.tsx
2. Remove search from ProductsPage.tsx
3. Remove search from DocumentTypesPage.tsx
4. Remove search from VerificationTypesPage.tsx
5. Test that pages still load and display data

### Step 5: Reports & Billing (MEDIUM PRIORITY)
1. Remove search/filter from ReportsPage.tsx
2. Remove search/filter from BillingPage.tsx
3. Test that pages still load and display data

### Step 6: Locations Page (LOW PRIORITY)
1. Remove search/filter from LocationsPage.tsx
2. Test that pages still load and display data

### Step 7: Cleanup Components
1. Mark CaseFilters.tsx as deprecated
2. Mark TaskFilters.tsx as deprecated
3. Document that these will be replaced

---

## Testing Checklist

After each page cleanup:
- [ ] Page loads without errors
- [ ] Data is fetched and displayed
- [ ] Tables render correctly
- [ ] Pagination works
- [ ] Action buttons work (Create, Edit, Delete)
- [ ] Tab navigation works (if applicable)
- [ ] No console errors
- [ ] No TypeScript errors

---

## Expected Outcome

After this cleanup phase:
1. ✅ All pages will have consistent structure
2. ✅ No conflicting search/filter implementations
3. ✅ Clean slate for implementing standardized solution
4. ✅ All pages still functional (just without search/filter)
5. ✅ Easier to implement new standardized filters

---

## Next Phase

After cleanup is complete:
1. Implement standardized hooks (useFilters, useSearch, useTableState)
2. Implement standardized components (FilterBar, FilterChips)
3. Apply standardized solution to all pages systematically
4. Test thoroughly

---

## Notes

- This is a **temporary state** - pages will not have search/filter during cleanup
- Users will see all data (paginated) until new filters are implemented
- This cleanup should be done quickly (1-2 days max)
- Commit after each page cleanup for easy rollback if needed
- Keep commits small and focused


