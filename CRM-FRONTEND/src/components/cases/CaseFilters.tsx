import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import type { CaseListQuery } from '@/services/cases';

interface CaseFiltersProps {
  filters: CaseListQuery;
  onFiltersChange: (filters: CaseListQuery) => void;
  onClearFilters: () => void;
  isLoading?: boolean;
}

export const CaseFilters: React.FC<CaseFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  isLoading,
}) => {
  // Local state for search input to prevent focus loss
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search value to prevent excessive API calls
  const debouncedSearchValue = useDebounce(searchValue, 300);

  // Update filters when debounced search value changes
  useEffect(() => {
    if (debouncedSearchValue !== filters.search) {
      onFiltersChange({
        ...filters,
        search: debouncedSearchValue || undefined,
      });
    }
  }, [debouncedSearchValue, filters.search]);

  // Memoize the filter change handler to prevent unnecessary re-renders
  const handleFilterChange = useCallback((key: keyof CaseListQuery, value: string | number | undefined) => {
    // Ensure Select components receive empty string instead of undefined
    let processedValue = value;
    if (value === '' || value === undefined || value === null) {
      processedValue = undefined; // Remove from filters object
    }

    onFiltersChange({
      ...filters,
      [key]: processedValue,
    });
  }, [filters, onFiltersChange]);

  // Update local search value when filters are cleared
  useEffect(() => {
    if (!filters.search && searchValue) {
      setSearchValue('');
    }
  }, [filters.search, searchValue]);

  // Handle search input change with focus preservation
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    // Ensure focus is maintained
    setTimeout(() => {
      if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);
  }, []);

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && value !== null
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Clear</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                id="search"
                placeholder="Search cases..."
                value={searchValue}
                onChange={handleSearchChange}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={filters.status || 'ALL'}
              onValueChange={(value) => handleFilterChange('status', value === 'ALL' ? undefined : value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={filters.priority?.toString() || 'ALL'}
              onValueChange={(value) => handleFilterChange('priority', value === 'ALL' ? undefined : parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All priorities</SelectItem>
                <SelectItem value="1">Low</SelectItem>
                <SelectItem value="2">Medium</SelectItem>
                <SelectItem value="3">High</SelectItem>
                <SelectItem value="4">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label>Client</Label>
            <Select
              value={filters.clientId || 'ALL'}
              onValueChange={(value) => handleFilterChange('clientId', value === 'ALL' ? undefined : value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All clients</SelectItem>
                {/* TODO: Load clients from API */}
                <SelectItem value="client1">Client 1</SelectItem>
                <SelectItem value="client2">Client 2</SelectItem>
                <SelectItem value="client3">Client 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">From Date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">To Date</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
