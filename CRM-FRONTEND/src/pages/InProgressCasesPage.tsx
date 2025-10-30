import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CaseTable } from '@/components/cases/CaseTable';
import { CasePagination } from '@/components/cases/CasePagination';
import { useCases, useRefreshCases } from '@/hooks/useCases';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/components/ui/unified-search-filter-layout';
import { Download, RefreshCw, PlayCircle } from 'lucide-react';
import type { CaseListQuery } from '@/services/cases';
import { casesService } from '@/services/cases';

interface InProgressCaseFilters {
  priority?: string;
  clientId?: string;
}

export const InProgressCasesPage: React.FC = () => {
  // Unified search with 800ms debounce
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters with URL sync
  const {
    filters: activeFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useUnifiedFilters<InProgressCaseFilters>({
    syncWithUrl: true,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    sortBy: 'pendingDuration',
    sortOrder: 'desc' as const,
  });

  // Build query with search and filters
  const query: CaseListQuery = {
    ...pagination,
    status: 'IN_PROGRESS',
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority ? parseInt(activeFilters.priority) : undefined,
    clientId: activeFilters.clientId || undefined,
  };

  const { data: casesData, isLoading, refetch } = useCases(query);
  const { refreshCases } = useRefreshCases();

  const cases = casesData?.data || [];
  const paginationData = casesData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  const activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof InProgressCaseFilters] !== undefined
  ).length;

  const handleExport = async () => {
    try {
      const { blob, filename } = await casesService.exportCases({
        exportType: 'in-progress',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export in progress cases:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">In Progress Cases</h1>
          <p className="mt-2 text-muted-foreground">
            View and manage all cases currently being worked on
          </p>
        </div>
      </div>

      {/* Unified Search and Filter Layout */}
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search in-progress cases..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterContent={
          <FilterGrid columns={{ sm: 1, md: 2 }}>
            {/* Priority Filter */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={activeFilters.priority || 'all'}
                onValueChange={(value) => setFilter('priority', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="1">Low</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="3">High</SelectItem>
                  <SelectItem value="4">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Filter */}
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select
                value={activeFilters.clientId || 'all'}
                onValueChange={(value) => setFilter('clientId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FilterGrid>
        }
        actions={
          <>
            <Button variant="outline" onClick={async () => {
              await refreshCases({
                clearCache: true,
                preserveFilters: true,
                showToast: true
              });
            }} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <PlayCircle className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total In Progress</p>
                <p className="text-2xl font-bold text-foreground">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 font-semibold">⏱️</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Long Running</p>
                <p className="text-2xl font-bold text-foreground">
                  {cases.filter(c => {
                    const duration = (c as any).pendingDurationSeconds || 0;
                    return duration > 172800; // More than 2 days
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 font-semibold">⚡</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-foreground">
                  {cases.filter(c => c.priority >= 4).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-semibold">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Agents</p>
                <p className="text-2xl font-bold text-foreground">
                  {new Set(cases.map(c => c.assignedToId)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Cases Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>In Progress Cases</CardTitle>
              <CardDescription>
                {paginationData.total > 0
                  ? `Showing ${paginationData.total} in progress case${paginationData.total === 1 ? '' : 's'}`
                  : 'No in progress cases found'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <CaseTable
            cases={cases}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {paginationData.total > 0 && (
        <CasePagination
          currentPage={paginationData.page}
          totalPages={paginationData.totalPages}
          totalItems={paginationData.total}
          itemsPerPage={paginationData.limit}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};
