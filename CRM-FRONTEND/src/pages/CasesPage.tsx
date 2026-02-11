import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Download, Plus, RefreshCw, FileText, Clock, CheckCircle, PlayCircle, AlertTriangle } from 'lucide-react';
import { casesService, type CaseListQuery } from '@/services/cases';

interface CaseFilters {
  status?: string;
  priority?: string;
  clientId?: string;
  [key: string]: string | undefined;
}

export const CasesPage: React.FC = () => {
  const navigate = useNavigate();

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
  } = useUnifiedFilters<CaseFilters>({
    syncWithUrl: true,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    sortBy: 'caseId',
    sortOrder: 'desc' as const,
  });

  // Build query with search and filters
  const query: CaseListQuery = {
    ...pagination,
    search: debouncedSearchValue || undefined,
    status: activeFilters.status || undefined,
    priority: activeFilters.priority || undefined,
    clientId: activeFilters.clientId || undefined,
  };

  const { data: casesData, isLoading, error: _error } = useCases(query);

  const { refreshCases } = useRefreshCases();

  const cases = casesData?.data || [];
  const paginationData = casesData?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };



  const handleExport = async () => {
    try {
      const { blob, filename } = await casesService.exportCases({
        exportType: 'all',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export cases:', error);
    }
  };

  const handleRefresh = async () => {
    await refreshCases({
      clearCache: true,
      preserveFilters: true,
      showToast: true
    });
  };

  const handleNewCase = () => {
    navigate('/cases/new');
  };

  // Count active filters
  const activeFilterCount = Object.keys(activeFilters).filter(
    key => activeFilters[key as keyof CaseFilters] !== undefined
  ).length;

  // Calculate statistics
  const totalCases = paginationData.total;
  const pendingCases = cases.filter(c => c.status === 'PENDING').length;
  const inProgressCases = cases.filter(c => c.status === 'IN_PROGRESS').length;
  const completedCases = cases.filter(c => c.status === 'COMPLETED').length;
  const overdueCases = cases.filter(c => {
    if (!c.createdAt) {return false;}
    const created = new Date(c.createdAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    return diffInHours > 48 && c.status !== 'COMPLETED'; // More than 2 days and not completed
  }).length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">Cases</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Manage and track all verification cases
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCases}</div>
            <p className="text-xs text-gray-600">
              All verification cases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCases}</div>
            <p className="text-xs text-gray-600">
              Awaiting action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <PlayCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCases}</div>
            <p className="text-xs text-gray-600">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCases}</div>
            <p className="text-xs text-gray-600">
              Successfully done
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueCases}</div>
            <p className="text-xs text-gray-600">
              More than 2 days old
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Unified Search and Filter Layout */}
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search cases by ID, customer name, or description..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterContent={
          <FilterGrid columns={3}>
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={activeFilters.status || 'all'}
                onValueChange={(value) => setFilter('status', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                  {/* TODO: Load clients from API */}
                </SelectContent>
              </Select>
            </div>
          </FilterGrid>
        }
        actions={
          <>
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleNewCase}>
              <Plus className="h-4 w-4 mr-2" />
            New Case
          </Button>
        </>
        }
      />

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cases</CardTitle>
              <CardDescription>
                {paginationData.total > 0
                  ? `Showing ${paginationData.total} case${paginationData.total === 1 ? '' : 's'}`
                  : 'No cases found'
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
