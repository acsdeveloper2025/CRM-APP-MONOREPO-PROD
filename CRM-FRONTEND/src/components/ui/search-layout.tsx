import React from 'react';
import { cn } from '@/lib/utils';
import { SearchInput } from './search-input';
import { Button } from './button';
interface SearchLayoutProps {
    /**
     * Search input props
     */
    searchProps: {
        value?: string;
        onSearch: (value: string) => void;
        onValueChange?: (value: string) => void;
        placeholder?: string;
        isLoading?: boolean;
        disabled?: boolean;
    };
    /**
     * Action buttons to display alongside search
     */
    actions?: React.ReactNode;
    /**
     * Additional filters or controls
     */
    filters?: React.ReactNode;
    /**
     * Whether to stack elements on mobile
     */
    stackOnMobile?: boolean;
    /**
     * Search input size
     */
    searchSize?: 'sm' | 'md' | 'lg';
    /**
     * Additional CSS classes
     */
    className?: string;
    /**
     * Whether to show clear filters button
     */
    showClearFilters?: boolean;
    /**
     * Clear filters handler
     */
    onClearFilters?: () => void;
    /**
     * Whether filters are active (for clear button state)
     */
    hasActiveFilters?: boolean;
}
/**
 * Standardized search layout component following established responsive patterns
 *
 * Features:
 * - Responsive layout that adapts to screen size
 * - Consistent spacing and alignment
 * - Touch-friendly button sizing
 * - Flexible action and filter placement
 * - Follows established Tailwind configuration patterns
 */
export const SearchLayout: React.FC<SearchLayoutProps> = ({ searchProps, actions, filters, stackOnMobile = true, searchSize = 'md', className, showClearFilters = false, onClearFilters, hasActiveFilters = false, }) => {
    return (<div {...{ className: cn("space-y-4", className) }}>
      {/* Main Search and Actions Row */}
      <div {...{ className: cn("flex gap-4", stackOnMobile
            ? "flex-col sm:flex-row sm:items-center sm:justify-between"
            : "flex-row items-center justify-between") }}>
        {/* Search Input */}
        <div {...{ className: cn("w-full", stackOnMobile ? "sm:w-auto sm:flex-1 sm:max-w-md" : "flex-1 max-w-md") }}>
          <SearchInput {...searchProps} size={searchSize} {...{ className: "w-full" }}/>
        </div>
        
        {/* Action Buttons */}
        {actions && (<div {...{ className: cn("flex gap-2", stackOnMobile ? "w-full sm:w-auto" : "w-auto") }}>
            {actions}
          </div>)}
      </div>
      
      {/* Filters Row */}
      {filters && (<div {...{ className: "flex flex-col sm:flex-row sm:items-center gap-4" }}>
          <div {...{ className: "flex-1" }}>
            {filters}
          </div>
          
          {/* Clear Filters Button */}
          {showClearFilters && hasActiveFilters && onClearFilters && (<Button variant="outline" size="sm" onClick={onClearFilters} {...{ className: "w-full sm:w-auto" }}>
              Clear Filters
            </Button>)}
        </div>)}
    </div>);
};
/**
 * Simplified search bar for basic use cases
 */
interface SimpleSearchBarProps {
    value?: string;
    onSearch: (value: string) => void;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}
export const SimpleSearchBar: React.FC<SimpleSearchBarProps> = ({ className, ...searchProps }) => {
    return (<div {...{ className: cn("w-full max-w-md", className) }}>
      <SearchInput {...searchProps} {...{ className: "w-full" }}/>
    </div>);
};
/**
 * Search bar with integrated action buttons (common pattern)
 */
interface SearchWithActionsProps extends SimpleSearchBarProps {
    actions: React.ReactNode;
    stackOnMobile?: boolean;
}
export const SearchWithActions: React.FC<SearchWithActionsProps> = ({ actions, stackOnMobile = true, className, ...searchProps }) => {
    return (<div {...{ className: cn("flex gap-4", stackOnMobile
            ? "flex-col sm:flex-row sm:items-center"
            : "flex-row items-center", className) }}>
      <div {...{ className: cn("w-full", stackOnMobile ? "sm:flex-1 sm:max-w-md" : "flex-1 max-w-md") }}>
        <SearchInput {...searchProps} {...{ className: "w-full" }}/>
      </div>
      
      <div {...{ className: cn("flex gap-2", stackOnMobile ? "w-full sm:w-auto" : "w-auto") }}>
        {actions}
      </div>
    </div>);
};
/**
 * Tab-based search layout (for pages with multiple tabs)
 */
interface TabSearchLayoutProps {
    searchProps: SimpleSearchBarProps;
    tabs: React.ReactNode;
    actions?: React.ReactNode;
    filters?: React.ReactNode;
    className?: string;
}
export const TabSearchLayout: React.FC<TabSearchLayoutProps> = ({ searchProps, tabs, actions, filters, className, }) => {
    return (<div {...{ className: cn("space-y-4", className) }}>
      {/* Tabs and Search/Actions Row */}
      <div {...{ className: "flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0" }}>
        {/* Tabs */}
        <div {...{ className: "w-full lg:w-auto overflow-x-auto" }}>
          {tabs}
        </div>
        
        {/* Search and Actions */}
        <div {...{ className: "flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2 w-full lg:w-auto" }}>
          <div {...{ className: "w-full sm:w-48 lg:w-64" }}>
            <SearchInput {...searchProps} {...{ className: "w-full" }}/>
          </div>
          
          {actions && (<div {...{ className: "flex flex-col sm:flex-row gap-2 w-full sm:w-auto" }}>
              {actions}
            </div>)}
        </div>
      </div>
      
      {/* Filters */}
      {filters && (<div {...{ className: "border-t pt-4" }}>
          {filters}
        </div>)}
    </div>);
};
