import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CaseFilters } from '@/components/cases/CaseFilters';
import { CaseTable } from '@/components/cases/CaseTable';
import { CasePagination } from '@/components/cases/CasePagination';
import { useCases, useUpdateCaseStatus, useAssignCase, useRefreshCases } from '@/hooks/useCases';
import { Download, Plus, RefreshCw } from 'lucide-react';
import type { CaseListQuery } from '@/services/cases';
import { casesService } from '@/services/cases';
import { useSearchInput } from '@/components/ui/search-input';

export const CasesPage: React.FC = () => {
  const navigate = useNavigate();

  // Use standardized search with debouncing
  const { debouncedSearchValue, setSearchValue } = useSearchInput('', 400);

  const [filters, setFilters] = useState<CaseListQuery>({
    page: 1,
    limit: 20,
    sortBy: 'caseId',
    sortOrder: 'desc', // Changed to desc for newest cases first
  });

  // Merge search with other filters for the query
  const queryFilters = {
    ...filters,
    search: debouncedSearchValue || undefined,
  };

  // Add error handling
  const { data: casesData, isLoading, error, refetch } = useCases(queryFilters);
  const updateStatusMutation = useUpdateCaseStatus();
  const assignCaseMutation = useAssignCase();
  const { refreshCases } = useRefreshCases();

  const cases = casesData?.data || [];
  const pagination = casesData?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };

  const handleFiltersChange = (newFilters: CaseListQuery) => {
    console.log('🔍 Cases Page - Filters changed:', newFilters); // Debug log
    setFilters({
      ...newFilters,
      page: 1, // Reset to first page when filters change
    });
  };

  const handleClearFilters = () => {
    console.log('🧹 Cases Page - Clearing filters'); // Debug log
    setSearchValue(''); // Clear search
    setFilters({
      page: 1,
      limit: filters.limit,
      sortBy: 'caseId',
      sortOrder: 'desc',
    });
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit: number) => {
    setFilters(prev => ({ ...prev, limit, page: 1 }));
  };

  const handleUpdateStatus = async (caseId: string, status: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id: caseId, status });
      refetch();
    } catch (error) {
      console.error('Failed to update case status:', error);
    }
  };

  const handleAssignCase = async (caseId: string, userId: string) => {
    try {
      await assignCaseMutation.mutateAsync({ id: caseId, assignedToId: userId });
      refetch();
    } catch (error) {
      console.error('Failed to assign case:', error);
    }
  };

  const handleExport = async () => {
    try {
      const { blob, filename } = await casesService.exportCases({
        exportType: 'all',
        status: filters.status !== 'all' ? filters.status : undefined,
        search: filters.search,
        assignedTo: filters.assignedTo,
        clientId: filters.clientId,
        priority: filters.priority,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo
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

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">Cases</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-muted-foreground">
            Manage and track all verification cases
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading} className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleNewCase} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Case
          </Button>
        </div>
      </div>

      {/* Filters */}
      <CaseFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        isLoading={isLoading}
        searchValue={debouncedSearchValue}
        onSearchChange={setSearchValue}
      />

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cases</CardTitle>
              <CardDescription>
                {pagination.total > 0 
                  ? `Showing ${pagination.total} case${pagination.total === 1 ? '' : 's'}`
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
            onUpdateStatus={handleUpdateStatus}
            onAssignCase={handleAssignCase}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.total > 0 && (
        <CasePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};
