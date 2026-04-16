import React, { ReactNode } from 'react';
import { UnifiedSearchInput } from './unified-search-input';
import { UnifiedFilterPanel } from './unified-filter-panel';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UnifiedSearchFilterLayoutProps {
  /**
   * Search value
   */
  searchValue: string;

  /**
   * Callback when search value changes
   */
  onSearchChange: (value: string) => void;

  /**
   * Callback when search is cleared
   */
  onSearchClear?: () => void;

  /**
   * Whether search is loading/debouncing
   */
  isSearchLoading?: boolean;

  /**
   * Search placeholder
   */
  searchPlaceholder?: string;

  /**
   * Filter panel content
   */
  filterContent?: ReactNode;

  /**
   * Whether filters are active
   */
  hasActiveFilters?: boolean;

  /**
   * Number of active filters
   */
  activeFilterCount?: number;

  /**
   * Callback when clear filters is clicked
   */
  onClearFilters?: () => void;

  /**
   * Action buttons (e.g., Add, Export, Refresh)
   */
  actions?: ReactNode;

  /**
   * Whether to show the filter panel
   * @default true
   */
  showFilters?: boolean;

  /**
   * Whether filters are collapsible
   * @default true
   */
  filtersCollapsible?: boolean;

  /**
   * Initial collapsed state for filters
   * @default false
   */
  filtersDefaultCollapsed?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Layout variant
   * @default "stacked" - Search on top, filters below
   * "inline" - Search and filter toggle inline
   */
  variant?: 'stacked' | 'inline';
}

/**
 * Unified search and filter layout component
 *
 * Provides a standardized layout for search input, filters, and action buttons
 *
 * @example
 * ```tsx
 * const { searchValue, setSearchValue, clearSearch, isDebouncing } = useUnifiedSearch();
 * const { filters, setFilter, clearFilters, hasActiveFilters } = useUnifiedFilters();
 *
 * <UnifiedSearchFilterLayout
 *   searchValue={searchValue}
 *   onSearchChange={setSearchValue}
 *   onSearchClear={clearSearch}
 *   isSearchLoading={isDebouncing}
 *   searchPlaceholder="Search cases..."
 *   filterContent={
 *     <FilterGrid>
 *       <Select value={filters.status} onValueChange={(v) => setFilter('status', v)}>
 *         ...
 *       </Select>
 *     </FilterGrid>
 *   }
 *   hasActiveFilters={hasActiveFilters}
 *   activeFilterCount={Object.keys(filters).length}
 *   onClearFilters={clearFilters}
 *   actions={
 *     <>
 *       <Button onClick={handleRefresh}>Refresh</Button>
 *       <Button onClick={handleExport}>Export</Button>
 *       <Button onClick={handleCreate}>Add New</Button>
 *     </>
 *   }
 * />
 * ```
 */
export const UnifiedSearchFilterLayout: React.FC<UnifiedSearchFilterLayoutProps> = ({
  searchValue,
  onSearchChange,
  onSearchClear,
  isSearchLoading = false,
  searchPlaceholder = 'Search...',
  filterContent,
  hasActiveFilters = false,
  activeFilterCount = 0,
  onClearFilters,
  actions,
  showFilters = true,
  filtersCollapsible = true,
  filtersDefaultCollapsed = false,
  className,
  variant = 'stacked',
}) => {
  const [showFilterPanel, setShowFilterPanel] = React.useState(!filtersDefaultCollapsed);

  if (variant === 'inline') {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Search and Actions Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <UnifiedSearchInput
              value={searchValue}
              onChange={onSearchChange}
              onClear={onSearchClear}
              isLoading={isSearchLoading}
              placeholder={searchPlaceholder}
            />
          </div>

          {/* Filter Toggle and Actions */}
          <div className="flex items-center gap-2">
            {filterContent && showFilters && (
              <Button
                variant={hasActiveFilters ? 'default' : 'outline'}
                size="default"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            )}

            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>

        {/* Filter Panel */}
        {filterContent && showFilters && showFilterPanel && (
          <UnifiedFilterPanel
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={onClearFilters}
            collapsible={filtersCollapsible}
            defaultCollapsed={false}
          >
            {filterContent}
          </UnifiedFilterPanel>
        )}
      </div>
    );
  }

  // Stacked variant (default)
  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and Actions Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <UnifiedSearchInput
            value={searchValue}
            onChange={onSearchChange}
            onClear={onSearchClear}
            isLoading={isSearchLoading}
            placeholder={searchPlaceholder}
          />
        </div>

        {/* Actions */}
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {/* Filter Panel */}
      {filterContent && showFilters && (
        <UnifiedFilterPanel
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onClearFilters={onClearFilters}
          collapsible={filtersCollapsible}
          defaultCollapsed={filtersDefaultCollapsed}
        >
          {filterContent}
        </UnifiedFilterPanel>
      )}
    </div>
  );
};

/**
 * Simplified search-only layout (no filters)
 */
export interface SearchOnlyLayoutProps {
  /**
   * Search value
   */
  searchValue: string;

  /**
   * Callback when search value changes
   */
  onSearchChange: (value: string) => void;

  /**
   * Callback when search is cleared
   */
  onSearchClear?: () => void;

  /**
   * Whether search is loading/debouncing
   */
  isSearchLoading?: boolean;

  /**
   * Search placeholder
   */
  searchPlaceholder?: string;

  /**
   * Action buttons
   */
  actions?: ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export const SearchOnlyLayout: React.FC<SearchOnlyLayoutProps> = ({
  searchValue,
  onSearchChange,
  onSearchClear,
  isSearchLoading = false,
  searchPlaceholder = 'Search...',
  actions,
  className,
}) => {
  return (
    <div className={cn('flex flex-col sm:flex-row gap-4', className)}>
      {/* Search Input */}
      <div className="flex-1">
        <UnifiedSearchInput
          value={searchValue}
          onChange={onSearchChange}
          onClear={onSearchClear}
          isLoading={isSearchLoading}
          placeholder={searchPlaceholder}
        />
      </div>

      {/* Actions */}
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
};

/**
 * Filter grid layout component for organizing filter controls
 */
export interface FilterGridProps {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export const FilterGrid: React.FC<FilterGridProps> = ({ children, className, columns = 3 }) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return <div className={cn('grid gap-4', gridCols[columns], className)}>{children}</div>;
};
