import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CaseTable } from '@/components/cases/CaseTable';
import { CasePagination } from '@/components/cases/CasePagination';
import { useCases, useRefreshCases } from '@/hooks/useCases';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { Download, RefreshCw, Activity, Users, AlertTriangle, Clock } from 'lucide-react';
import { casesService, type CaseListQuery } from '@/services/cases';
import { logger } from '@/utils/logger';

interface InProgressCaseFilters {
  [key: string]: unknown;
  priority?: string;
  clientId?: string;
}

export const InProgressCasesPage: React.FC = () => {
  // Unified search with 800ms debounce
  const { debouncedSearchValue } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters with URL sync
  const { filters: activeFilters } = useUnifiedFilters<InProgressCaseFilters>({
    syncWithUrl: true,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    sortBy: 'updatedAt',
    sortOrder: 'desc' as const,
  });

  // Build query — case-status formula: case = IN_PROGRESS when ANY task is
  // PENDING / ASSIGNED / IN_PROGRESS (per caseStatusSyncService).
  const query: CaseListQuery = {
    ...pagination,
    status: 'IN_PROGRESS',
    search: debouncedSearchValue || undefined,
    priority: activeFilters.priority || undefined,
    clientId: (activeFilters.clientId as string) || undefined,
  };

  const { data: casesData, isLoading } = useCases(query);
  const { refreshCases } = useRefreshCases();

  const cases = casesData?.data?.data || [];
  const statistics = casesData?.data?.statistics;
  const paginationData = casesData?.data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  };

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
      logger.error('Failed to export in-progress cases:', error);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">In Progress Cases</h1>
          <p className="mt-2 text-muted-foreground">
            View and manage all cases currently being worked on
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={async () => {
              await refreshCases({
                clearCache: true,
                preserveFilters: true,
                showToast: true,
              });
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-foreground">{statistics?.inProgress || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold text-foreground">{statistics?.pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Field Users</p>
                <p className="text-2xl font-bold text-foreground">
                  {statistics?.activeAgentsInProgress || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-foreground">{statistics?.overdue || 0}</p>
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
                  ? `Showing ${(paginationData.page - 1) * paginationData.limit + 1} to ${Math.min(paginationData.page * paginationData.limit, paginationData.total)} of ${paginationData.total} case${paginationData.total === 1 ? '' : 's'}`
                  : 'No in-progress cases found'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <CaseTable cases={cases} isLoading={isLoading} />
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
