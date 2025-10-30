# Standardized Search and Filter Architecture

**Version:** 1.0  
**Date:** 2025-10-30  
**Status:** Design Proposal

---

## Overview

This document defines the standardized architecture for search and filter functionality across the CRM frontend application. The goal is to create a consistent, reusable, and maintainable system that follows industry best practices.

---

## Design Principles

1. **Consistency:** All pages use the same patterns and components
2. **Reusability:** Components and hooks are generic and composable
3. **Type Safety:** Full TypeScript support with proper typing
4. **Performance:** Debouncing, memoization, and efficient re-renders
5. **User Experience:** Responsive, accessible, and intuitive
6. **State Management:** URL-based state for shareability and persistence
7. **Flexibility:** Easy to customize per page while maintaining consistency

---

## Architecture Components

### 1. Type Definitions

```typescript
// CRM-FRONTEND/src/types/filters.ts

/**
 * Base filter configuration
 */
export interface FilterConfig<T = any> {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'boolean';
  placeholder?: string;
  options?: FilterOption[];
  defaultValue?: T;
  validation?: (value: T) => boolean;
}

export interface FilterOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
}

/**
 * Filter state
 */
export interface FilterState {
  [key: string]: any;
}

/**
 * Search configuration
 */
export interface SearchConfig {
  placeholder?: string;
  debounceDelay?: number;
  minLength?: number;
  searchFields?: string[]; // Fields to search in
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Complete filter query
 */
export interface FilterQuery extends FilterState, SortConfig {
  search?: string;
  page?: number;
  limit?: number;
}
```

### 2. Custom Hooks

#### 2.1 useFilters Hook

```typescript
// CRM-FRONTEND/src/hooks/useFilters.ts

/**
 * Main hook for managing filter state
 * Handles URL sync, state management, and filter operations
 */
export function useFilters<T extends FilterQuery>(
  initialFilters: Partial<T>,
  options?: {
    syncWithURL?: boolean;
    debounceDelay?: number;
    onFiltersChange?: (filters: T) => void;
  }
) {
  // State management
  // URL synchronization
  // Filter operations (set, clear, reset)
  // Active filters tracking
  
  return {
    filters,
    setFilter,
    setFilters,
    clearFilter,
    clearAllFilters,
    resetFilters,
    activeFiltersCount,
    hasActiveFilters,
  };
}
```

#### 2.2 useSearch Hook

```typescript
// CRM-FRONTEND/src/hooks/useSearch.ts

/**
 * Dedicated search hook with debouncing
 */
export function useSearch(
  initialValue: string = '',
  options?: {
    debounceDelay?: number;
    minLength?: number;
    onSearch?: (value: string) => void;
  }
) {
  return {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isSearching,
    hasActiveSearch,
  };
}
```

#### 2.3 usePagination Hook

```typescript
// CRM-FRONTEND/src/hooks/usePagination.ts

/**
 * Pagination state management
 */
export function usePagination(
  initialPage: number = 1,
  initialLimit: number = 20,
  options?: {
    syncWithURL?: boolean;
    onPageChange?: (page: number) => void;
  }
) {
  return {
    page,
    limit,
    setPage,
    setLimit,
    nextPage,
    prevPage,
    goToPage,
    resetPagination,
  };
}
```

#### 2.4 useSort Hook

```typescript
// CRM-FRONTEND/src/hooks/useSort.ts

/**
 * Sorting state management
 */
export function useSort(
  initialSortBy?: string,
  initialSortOrder: 'asc' | 'desc' = 'desc',
  options?: {
    syncWithURL?: boolean;
    onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  }
) {
  return {
    sortBy,
    sortOrder,
    setSort,
    toggleSort,
    clearSort,
  };
}
```

#### 2.5 useTableState Hook (Composite)

```typescript
// CRM-FRONTEND/src/hooks/useTableState.ts

/**
 * Composite hook combining search, filters, pagination, and sorting
 * This is the main hook most pages will use
 */
export function useTableState<T extends FilterQuery>(
  config: {
    initialFilters?: Partial<T>;
    initialPage?: number;
    initialLimit?: number;
    initialSortBy?: string;
    initialSortOrder?: 'asc' | 'desc';
    searchConfig?: SearchConfig;
    syncWithURL?: boolean;
  }
) {
  const search = useSearch(config.searchConfig?.placeholder, {
    debounceDelay: config.searchConfig?.debounceDelay,
  });
  
  const filters = useFilters(config.initialFilters, {
    syncWithURL: config.syncWithURL,
  });
  
  const pagination = usePagination(config.initialPage, config.initialLimit, {
    syncWithURL: config.syncWithURL,
  });
  
  const sort = useSort(config.initialSortBy, config.initialSortOrder, {
    syncWithURL: config.syncWithURL,
  });
  
  // Combine all into single query object
  const query = useMemo(() => ({
    ...filters.filters,
    search: search.debouncedSearchValue || undefined,
    page: pagination.page,
    limit: pagination.limit,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  }), [filters.filters, search.debouncedSearchValue, pagination, sort]);
  
  return {
    query,
    search,
    filters,
    pagination,
    sort,
    resetAll: () => {
      search.clearSearch();
      filters.clearAllFilters();
      pagination.resetPagination();
      sort.clearSort();
    },
  };
}
```

### 3. Reusable Components

#### 3.1 FilterBar Component

```typescript
// CRM-FRONTEND/src/components/common/FilterBar.tsx

interface FilterBarProps {
  searchConfig?: SearchConfig;
  filterConfigs: FilterConfig[];
  filters: FilterState;
  onFilterChange: (key: string, value: any) => void;
  onClearFilters: () => void;
  showClearButton?: boolean;
  activeFiltersCount?: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({...}) => {
  // Renders search input + filter dropdowns in a responsive grid
  // Shows active filter count badge
  // Clear all filters button
};
```

#### 3.2 FilterChips Component

```typescript
// CRM-FRONTEND/src/components/common/FilterChips.tsx

interface FilterChipsProps {
  filters: FilterState;
  filterConfigs: FilterConfig[];
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
}

export const FilterChips: React.FC<FilterChipsProps> = ({...}) => {
  // Displays active filters as removable chips/badges
  // Shows formatted filter values
  // Clear all button
};
```

#### 3.3 TableHeader Component

```typescript
// CRM-FRONTEND/src/components/common/TableHeader.tsx

interface TableHeaderProps {
  title: string;
  description?: string;
  totalCount?: number;
  actions?: React.ReactNode;
  filterBar?: React.ReactNode;
  filterChips?: React.ReactNode;
}

export const TableHeader: React.FC<TableHeaderProps> = ({...}) => {
  // Standardized table header with title, count, actions
  // Includes filter bar and chips
};
```

---

## Usage Examples

### Example 1: Simple Page with Search Only

```typescript
// CRM-FRONTEND/src/pages/SimpleListPage.tsx

export const SimpleListPage: React.FC = () => {
  const { query, search, pagination } = useTableState({
    initialLimit: 20,
    searchConfig: {
      placeholder: 'Search items...',
      debounceDelay: 400,
    },
    syncWithURL: true,
  });
  
  const { data, isLoading } = useQuery({
    queryKey: ['items', query],
    queryFn: () => itemsService.getItems(query),
  });
  
  return (
    <div>
      <SearchInput
        value={search.searchValue}
        onChange={search.setSearchValue}
        onClear={search.clearSearch}
        placeholder="Search items..."
        isSearching={search.isSearching}
      />
      
      <Table data={data?.data} loading={isLoading} />
      
      <Pagination {...pagination} total={data?.pagination.total} />
    </div>
  );
};
```

### Example 2: Complex Page with Filters

```typescript
// CRM-FRONTEND/src/pages/CasesPage.tsx

export const CasesPage: React.FC = () => {
  const filterConfigs: FilterConfig[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'PENDING', label: 'Pending' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'COMPLETED', label: 'Completed' },
      ],
    },
    {
      key: 'clientId',
      label: 'Client',
      type: 'select',
      options: clients.map(c => ({ value: c.id, label: c.name })),
    },
    {
      key: 'dateRange',
      label: 'Date Range',
      type: 'daterange',
    },
  ];
  
  const { query, search, filters, pagination, sort } = useTableState({
    initialFilters: { status: 'PENDING' },
    initialLimit: 20,
    initialSortBy: 'createdAt',
    initialSortOrder: 'desc',
    searchConfig: {
      placeholder: 'Search cases...',
      debounceDelay: 400,
    },
    syncWithURL: true,
  });
  
  const { data, isLoading } = useCases(query);
  
  return (
    <div>
      <TableHeader
        title="Cases"
        description={`${data?.pagination.total || 0} cases found`}
        actions={<Button>New Case</Button>}
        filterBar={
          <FilterBar
            searchConfig={{ placeholder: 'Search cases...' }}
            filterConfigs={filterConfigs}
            filters={filters.filters}
            onFilterChange={filters.setFilter}
            onClearFilters={filters.clearAllFilters}
            activeFiltersCount={filters.activeFiltersCount}
          />
        }
        filterChips={
          filters.hasActiveFilters && (
            <FilterChips
              filters={filters.filters}
              filterConfigs={filterConfigs}
              onRemoveFilter={filters.clearFilter}
              onClearAll={filters.clearAllFilters}
            />
          )
        }
      />
      
      <CaseTable
        cases={data?.data}
        loading={isLoading}
        sortBy={sort.sortBy}
        sortOrder={sort.sortOrder}
        onSort={sort.setSort}
      />
      
      <Pagination
        page={pagination.page}
        limit={pagination.limit}
        total={data?.pagination.total}
        onPageChange={pagination.setPage}
        onLimitChange={pagination.setLimit}
      />
    </div>
  );
};
```

---

## URL State Management

### URL Structure
```
/cases?search=john&status=PENDING&clientId=123&page=2&limit=20&sortBy=createdAt&sortOrder=desc
```

### Implementation
- Use `useSearchParams` from react-router-dom
- Serialize/deserialize filter state to/from URL
- Support deep linking and sharing filtered views
- Preserve state on page refresh

---

## Performance Optimizations

1. **Debouncing:** 400ms for search inputs
2. **Memoization:** Use `useMemo` for derived values
3. **Lazy Loading:** Load filter options on demand
4. **Virtual Scrolling:** For large datasets
5. **Request Cancellation:** Cancel pending requests on filter change

---

## Accessibility

1. **Keyboard Navigation:** Full keyboard support
2. **ARIA Labels:** Proper labeling for screen readers
3. **Focus Management:** Logical focus order
4. **Loading States:** Clear loading indicators
5. **Error States:** Accessible error messages

---

## Migration Strategy

### Phase 1: Create Utilities (Week 1)
- Implement all hooks
- Create reusable components
- Write comprehensive tests

### Phase 2: High Priority Pages (Week 2-3)
- CasesPage
- PendingCasesPage
- InProgressCasesPage
- CompletedCasesPage
- AllTasksPage

### Phase 3: Medium Priority Pages (Week 4-5)
- UsersPage
- ClientsPage
- CommissionCalculationsTab
- Other commission tabs

### Phase 4: Remaining Pages (Week 6)
- All other pages with tables/lists

---

## Testing Strategy

1. **Unit Tests:** Test hooks in isolation
2. **Integration Tests:** Test components with hooks
3. **E2E Tests:** Test complete user flows
4. **Performance Tests:** Measure debounce effectiveness
5. **Accessibility Tests:** Automated a11y testing

---

## Next Steps

1. Review and approve this architecture
2. Implement core utilities and hooks
3. Create reusable components
4. Apply to first page (CasesPage) as proof of concept
5. Iterate based on feedback
6. Roll out to all pages systematically


