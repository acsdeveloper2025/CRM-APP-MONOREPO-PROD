import React, { ReactNode } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface UnifiedFilterPanelProps {
  /**
   * Filter content (form fields, selects, etc.)
   */
  children: ReactNode;

  /**
   * Whether filters are currently active
   */
  hasActiveFilters?: boolean;

  /**
   * Number of active filters (shown in badge)
   */
  activeFilterCount?: number;

  /**
   * Callback when clear filters is clicked
   */
  onClearFilters?: () => void;

  /**
   * Whether the panel is collapsible
   * @default true
   */
  collapsible?: boolean;

  /**
   * Initial collapsed state
   * @default false
   */
  defaultCollapsed?: boolean;

  /**
   * Panel title
   * @default "Filters"
   */
  title?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Whether to show the filter icon in the title
   * @default true
   */
  showIcon?: boolean;
}

/**
 * Unified filter panel component with standardized styling and behavior
 *
 * Features:
 * - Collapsible panel
 * - Active filter count badge
 * - Clear filters button
 * - Consistent styling across the application
 *
 * @example
 * ```tsx
 * const { filters, setFilter, clearFilters, hasActiveFilters } = useUnifiedFilters();
 *
 * <UnifiedFilterPanel
 *   hasActiveFilters={hasActiveFilters}
 *   activeFilterCount={Object.keys(filters).length}
 *   onClearFilters={clearFilters}
 * >
 *   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 *     <Select value={filters.status} onValueChange={(v) => setFilter('status', v)}>
 *       ...
 *     </Select>
 *   </div>
 * </UnifiedFilterPanel>
 * ```
 */
export const UnifiedFilterPanel: React.FC<UnifiedFilterPanelProps> = ({
  children,
  hasActiveFilters = false,
  activeFilterCount = 0,
  onClearFilters,
  collapsible = true,
  defaultCollapsed = false,
  title = 'Filters',
  className,
  showIcon = true,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <Card className={cn('border-muted', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              'flex items-center gap-2',
              collapsible && 'cursor-pointer select-none',
              'transition-colors duration-200'
            )}
            onClick={toggleCollapse}
          >
            {showIcon && <Filter className="h-5 w-5 text-gray-600" />}

            <CardTitle className="text-lg font-semibold">{title}</CardTitle>

            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 bg-primary/10 text-primary hover:bg-primary/20"
              >
                {activeFilterCount}
              </Badge>
            )}

            {collapsible && (
              <div className="ml-2">
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-gray-600" />
                )}
              </div>
            )}
          </div>

          {hasActiveFilters && onClearFilters && !isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-8 px-3 text-gray-600 hover:text-gray-900"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>

      {!isCollapsed && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
};

/**
 * Filter section component for organizing filters into groups
 */
export interface FilterSectionProps {
  /**
   * Section title
   */
  title?: string;

  /**
   * Section content
   */
  children: ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ title, children, className }) => {
  return (
    <div className={cn('space-y-3', className)}>
      {title && <h4 className="text-sm font-medium text-gray-600">{title}</h4>}
      <div className="space-y-3">{children}</div>
    </div>
  );
};

/**
 * Filter grid component for laying out filter fields
 */
export interface FilterGridProps {
  /**
   * Grid content
   */
  children: ReactNode;

  /**
   * Number of columns
   * @default { sm: 1, md: 2, lg: 4 }
   */
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };

  /**
   * Additional CSS classes
   */
  className?: string;
}

export const FilterGrid: React.FC<FilterGridProps> = ({
  children,
  columns = { sm: 1, md: 2, lg: 4 },
  className,
}) => {
  const gridClasses = cn(
    'grid gap-4',
    columns.sm === 1 && 'grid-cols-1',
    columns.sm === 2 && 'grid-cols-2',
    columns.sm === 3 && 'grid-cols-3',
    columns.sm === 4 && 'grid-cols-4',
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`,
    className
  );

  return <div className={gridClasses}>{children}</div>;
};

/**
 * Active filters display component
 */
export interface ActiveFiltersDisplayProps {
  /**
   * Active filters as key-value pairs
   */
  filters: Record<string, unknown>;

  /**
   * Callback to remove a specific filter
   */
  onRemoveFilter: (key: string) => void;

  /**
   * Optional label formatter for filter keys
   */
  formatLabel?: (key: string) => string;

  /**
   * Optional value formatter for filter values
   */
  formatValue?: (key: string, value: unknown) => string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export const ActiveFiltersDisplay: React.FC<ActiveFiltersDisplayProps> = ({
  filters,
  onRemoveFilter,
  formatLabel = (key) => key.charAt(0).toUpperCase() + key.slice(1),
  formatValue = (_, value) => String(value),
  className,
}) => {
  const activeFilters = Object.entries(filters).filter(
    ([_, value]) => value !== undefined && value !== null && value !== ''
  );

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-gray-600">Active Filters:</p>
      <div className="flex flex-wrap gap-2">
        {activeFilters.map(([key, value]) => (
          <Badge
            key={key}
            variant="secondary"
            className="pl-3 pr-1 py-1 gap-1 bg-primary/10 text-primary hover:bg-primary/20"
          >
            <span className="text-xs">
              {formatLabel(key)}: {formatValue(key, value)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFilter(key)}
              className="h-4 w-4 p-0 hover:bg-primary/30 ml-1"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Remove {formatLabel(key)} filter</span>
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
};
