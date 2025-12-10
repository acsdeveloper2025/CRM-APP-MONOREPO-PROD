import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PendingCasesTable } from '@/components/cases/PendingCasesTable';
import { useUpdateCaseStatus, useAssignCase, useRefreshCases } from '@/hooks/useCases';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { Download, RefreshCw, Clock, AlertTriangle, Flag, ArrowUp } from 'lucide-react';
import { casesService } from '@/services/cases';

interface PendingCaseFilters {
  priority?: string;
  client?: string;
  [key: string]: unknown;
}

export const PendingCasesPage: React.FC = () => {
  const [flagOverdueCases, setFlagOverdueCases] = useState(true);
  const [reviewUrgentFirst, setReviewUrgentFirst] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Unified search with 800ms debounce
  const {
    searchValue: _searchValue,
    debouncedSearchValue,
    setSearchValue: _setSearchValue,
    clearSearch: _clearSearch,
    isDebouncing: _isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters with URL sync
  const {
    filters: activeFilters,
    setFilter: _setFilter,
    clearFilters: _clearFilters,
    hasActiveFilters: _hasActiveFilters,
  } = useUnifiedFilters<PendingCaseFilters>({
    syncWithUrl: true,
  });

  // Reset to page 1 when search or filters change
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue, activeFilters]);

  const { data: casesData, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', 'pending', debouncedSearchValue, activeFilters, currentPage, pageSize],
    queryFn: () => casesService.getCases({
      status: 'PENDING',
      search: debouncedSearchValue || undefined,
      priority: activeFilters.priority || undefined,
      clientId: activeFilters.client || undefined,
      page: currentPage,
      limit: pageSize,
    }),
  });

  const updateStatusMutation = useUpdateCaseStatus();
  const assignCaseMutation = useAssignCase();
  const { refreshCases } = useRefreshCases();

  const rawCases = React.useMemo(() => casesData?.data || [], [casesData]);

  // Helper function to check if a case is overdue
  const isOverdue = React.useCallback((pendingDurationSeconds?: number) => {
    if (!pendingDurationSeconds) { return false; }
    return pendingDurationSeconds > 172800; // More than 2 days (48 hours * 3600 seconds)
  }, []);

  // Sort cases based on auto-highlight options
  const cases = React.useMemo(() => {
    const sortedCases = [...rawCases];

    if (reviewUrgentFirst || flagOverdueCases) {
      sortedCases.sort((a, b) => {
        // Check if cases are overdue
        const aOverdue = flagOverdueCases && isOverdue(a.pendingDurationSeconds);
        const bOverdue = flagOverdueCases && isOverdue(b.pendingDurationSeconds);

        // Check if cases are urgent (priority >= 3)
        const aUrgent = reviewUrgentFirst && Number(a.priority) >= 3;
        const bUrgent = reviewUrgentFirst && Number(b.priority) >= 3;

        // Priority order: Overdue + Urgent > Overdue > Urgent > Normal
        const aScore = (aOverdue ? 2 : 0) + (aUrgent ? 1 : 0);
        const bScore = (bOverdue ? 2 : 0) + (bUrgent ? 1 : 0);

        if (aScore !== bScore) {
          return bScore - aScore; // Higher score first
        }

        // If same priority, sort by priority number (higher first)
        if (reviewUrgentFirst && Number(a.priority) !== Number(b.priority)) {
          return Number(b.priority) - Number(a.priority);
        }

        // If same priority, sort by pending duration (longer first)
        if (a.pendingDurationSeconds && b.pendingDurationSeconds) {
          return (b.pendingDurationSeconds || 0) - (a.pendingDurationSeconds || 0);
        }

        return 0;
      });
    }

    return sortedCases;
  }, [rawCases, flagOverdueCases, reviewUrgentFirst, isOverdue]);

  // Calculate statistics
  const totalPending = rawCases.length;
  const pendingCases = rawCases.filter(c => c.status === 'PENDING').length;
  const inProgressCases = rawCases.filter(c => c.status === 'IN_PROGRESS').length;
  const urgentCases = rawCases.filter(c => Number(c.priority) >= 3).length;
  const oldCases = rawCases.filter(c => {
    return (c.pendingDurationSeconds || 0) > 172800; // More than 2 days
  }).length;

  const handleUpdateStatus = async (caseId: string, status: string) => {
    await updateStatusMutation.mutateAsync({ id: caseId, status });
    refetch();
  };

  const handleAssignCase = async (caseId: string, userId: string) => {
    await assignCaseMutation.mutateAsync({ id: caseId, assignedToId: userId });
    refetch();
  };

  const handleRefresh = async () => {
    await refreshCases({
      clearCache: true,
      preserveFilters: true,
      showToast: true
    });
  };

  const handleExport = async () => {
    try {
      const { blob, filename } = await casesService.exportCases({
        exportType: 'pending',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export pending cases:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pending Cases</h1>
          <p className="mt-2 text-gray-600">
            Cases that are assigned or in progress
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPending}</div>
            <p className="text-xs text-gray-600">
              All pending cases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Badge variant="secondary" className="text-xs">{pendingCases}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCases}</div>
            <p className="text-xs text-gray-600">
              Newly assigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Badge variant="default" className="text-xs">{inProgressCases}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCases}</div>
            <p className="text-xs text-gray-600">
              Being worked on
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{urgentCases}</div>
            <p className="text-xs text-gray-600">
              High priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{oldCases}</div>
            <p className="text-xs text-gray-600">
              &gt; 2 days old
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Auto-highlight Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Display Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Button
              variant={flagOverdueCases ? "default" : "outline"}
              size="sm"
              onClick={() => setFlagOverdueCases(!flagOverdueCases)}
              className={flagOverdueCases ? "bg-red-600 hover:bg-red-700" : ""}
            >
              <Flag className="h-4 w-4 mr-2" />
              Flag Overdue Cases
            </Button>
            <Button
              variant={reviewUrgentFirst ? "default" : "outline"}
              size="sm"
              onClick={() => setReviewUrgentFirst(!reviewUrgentFirst)}
              className={reviewUrgentFirst ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              <ArrowUp className="h-4 w-4 mr-2" />
              Review Urgent First
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load pending cases. Please try again.</span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Cases Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Cases</CardTitle>
              <CardDescription>
                {totalPending > 0 
                  ? `${totalPending} case${totalPending === 1 ? '' : 's'} pending completion`
                  : 'No pending cases found'
                }
              </CardDescription>
            </div>
            {urgentCases > 0 && (
              <Badge variant="destructive">
                {urgentCases} Urgent
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <PendingCasesTable
            cases={cases}
            isLoading={isLoading}
            onUpdateStatus={handleUpdateStatus}
            onAssignCase={handleAssignCase}
            flagOverdueCases={flagOverdueCases}
            reviewUrgentFirst={reviewUrgentFirst}
          />

          {/* Pagination Controls */}
          {casesData?.pagination && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
              <div className="text-sm text-gray-600">
                Showing {casesData.data?.length || 0} of {casesData.pagination.total} pending cases
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {casesData.pagination.totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage >= (casesData.pagination.totalPages || 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
