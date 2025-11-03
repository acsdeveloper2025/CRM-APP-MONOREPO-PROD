import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Case } from '../types/case';
import { CaseCard } from './CaseCard';
import { Loader2, Search, Filter, RefreshCw } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';

interface VirtualizedCaseListProps {
  cases: Case[];
  loading: boolean;
  onCaseSelect: (caseItem: Case) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  totalCount: number;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  onFilter: (filters: CaseFilters) => void;
  currentFilters: CaseFilters;
}

interface CaseFilters {
  status?: string;
  priority?: string;
  assignedTo?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

interface CaseItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    cases: Case[];
    onCaseSelect: (caseItem: Case) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    loading: boolean;
  };
}

// Memoized case item component for performance
const CaseItem: React.FC<CaseItemProps> = React.memo(({ index, style, data }) => {
  const { cases, onCaseSelect, onLoadMore, hasMore, loading } = data;
  
  // Load more when approaching end
  useEffect(() => {
    if (index >= cases.length - 5 && hasMore && !loading) {
      onLoadMore();
    }
  }, [index, cases.length, hasMore, loading, onLoadMore]);

  // Show loading placeholder at the end
  if (index >= cases.length) {
    return (
      <div style={style} className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-2 text-muted-foreground">Loading more cases...</span>
      </div>
    );
  }

  const caseItem = cases[index];
  if (!caseItem) return null;

  return (
    <div style={style} className="px-4 py-2">
      <CaseCard
        case={caseItem}
        onClick={() => onCaseSelect(caseItem)}
        className="hover:shadow-md transition-shadow duration-200"
      />
    </div>
  );
});

CaseItem.displayName = 'CaseItem';

export const VirtualizedCaseList: React.FC<VirtualizedCaseListProps> = ({
  cases,
  loading,
  onCaseSelect,
  onLoadMore,
  hasMore,
  totalCount,
  onRefresh,
  onSearch,
  onFilter,
  currentFilters,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<CaseFilters>(currentFilters);

  // Debounce search to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    onSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, onSearch]);

  // Memoize list data to prevent unnecessary re-renders
  const listData = useMemo(() => ({
    cases,
    onCaseSelect,
    onLoadMore,
    hasMore,
    loading,
  }), [cases, onCaseSelect, onLoadMore, hasMore, loading]);

  // Calculate item count (cases + loading indicator if needed)
  const itemCount = hasMore ? cases.length + 1 : cases.length;

  const handleFilterApply = useCallback(() => {
    onFilter(localFilters);
    setShowFilters(false);
  }, [localFilters, onFilter]);

  const handleFilterReset = useCallback(() => {
    const resetFilters: CaseFilters = {};
    setLocalFilters(resetFilters);
    onFilter(resetFilters);
    setShowFilters(false);
  }, [onFilter]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with search and controls */}
      <div className="flex-shrink-0 p-4 border-b border-border bg-muted">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">
            Cases ({totalCount.toLocaleString()})
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Refresh cases"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-md transition-colors ${
                showFilters || Object.keys(currentFilters).length > 0
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title="Filter cases"
            >
              <Filter className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cases by customer name, case ID, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-white border border-border rounded-md shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Status
                </label>
                <select
                  value={localFilters.status || ''}
                  onChange={(e) => setLocalFilters(prev => ({ 
                    ...prev, 
                    status: e.target.value || undefined 
                  }))}
                  className="w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Priority filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Priority
                </label>
                <select
                  value={localFilters.priority || ''}
                  onChange={(e) => setLocalFilters(prev => ({ 
                    ...prev, 
                    priority: e.target.value || undefined 
                  }))}
                  className="w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              {/* Assigned to filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Assigned To
                </label>
                <input
                  type="text"
                  placeholder="Field agent name"
                  value={localFilters.assignedTo || ''}
                  onChange={(e) => setLocalFilters(prev => ({ 
                    ...prev, 
                    assignedTo: e.target.value || undefined 
                  }))}
                  className="w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date range filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date Range
                </label>
                <div className="flex space-x-2">
                  <input
                    type="date"
                    value={localFilters.dateRange?.from?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setLocalFilters(prev => ({
                      ...prev,
                      dateRange: {
                        from: e.target.value ? new Date(e.target.value) : new Date(),
                        to: prev.dateRange?.to || new Date(),
                      }
                    }))}
                    className="flex-1 p-2 border border-border rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={localFilters.dateRange?.to?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setLocalFilters(prev => ({
                      ...prev,
                      dateRange: {
                        from: prev.dateRange?.from || new Date(),
                        to: e.target.value ? new Date(e.target.value) : new Date(),
                      }
                    }))}
                    className="flex-1 p-2 border border-border rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Filter actions */}
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={handleFilterReset}
                className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleFilterApply}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Active filters display */}
        {Object.keys(currentFilters).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {currentFilters.status && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Status: {currentFilters.status}
              </span>
            )}
            {currentFilters.priority && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Priority: {currentFilters.priority}
              </span>
            )}
            {currentFilters.assignedTo && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Assigned: {currentFilters.assignedTo}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Virtualized list */}
      <div className="flex-1 overflow-hidden">
        {cases.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Search className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-medium mb-2">No cases found</h3>
            <p className="text-center">
              {searchQuery || Object.keys(currentFilters).length > 0
                ? 'Try adjusting your search or filters'
                : 'No cases available at the moment'}
            </p>
          </div>
        ) : (
          <List
            height={600} // Will be dynamically calculated in real implementation
            itemCount={itemCount}
            itemSize={120} // Height of each case card
            itemData={listData}
            overscanCount={5} // Render 5 extra items for smooth scrolling
            className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          >
            {CaseItem}
          </List>
        )}
      </div>

      {/* Loading indicator */}
      {loading && cases.length === 0 && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-muted-foreground">Loading cases...</span>
        </div>
      )}
    </div>
  );
};
