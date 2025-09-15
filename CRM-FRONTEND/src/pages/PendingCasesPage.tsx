import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PendingCasesTable } from '@/components/cases/PendingCasesTable';
import { CasePagination } from '@/components/cases/CasePagination';
import { usePendingCases, useUpdateCaseStatus, useAssignCase, useRefreshCases } from '@/hooks/useCases';
import { useFieldUsers } from '@/hooks/useUsers';
import { useClients } from '@/hooks/useClients';
import { Download, RefreshCw, Search, Filter, X, Clock, AlertTriangle, Flag, ArrowUp } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import type { CaseListQuery } from '@/services/cases';
import { casesService } from '@/services/cases';

export const PendingCasesPage: React.FC = () => {
  const [filters, setFilters] = useState<CaseListQuery>({
    page: 1,
    limit: 20,
    sortBy: 'pendingDuration',
    sortOrder: 'desc', // Longest pending first
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [flagOverdueCases, setFlagOverdueCases] = useState(true);
  const [reviewUrgentFirst, setReviewUrgentFirst] = useState(true);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Update filters when search term changes
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      search: debouncedSearchTerm || undefined,
      page: 1, // Reset to first page when searching
    }));
  }, [debouncedSearchTerm]);

  const { data: casesData, isLoading, error, refetch } = usePendingCases();
  const { data: fieldUsersData } = useFieldUsers();
  const { data: clientsData } = useClients();
  const updateStatusMutation = useUpdateCaseStatus();
  const assignCaseMutation = useAssignCase();
  const { refreshCases } = useRefreshCases();

  const rawCases = casesData?.data || [];
  const fieldUsers = fieldUsersData?.data || [];
  const clients = clientsData?.data || [];

  // Helper function to check if a case is overdue
  const isOverdue = React.useCallback((assignedAt?: string) => {
    if (!assignedAt) return false;
    const assigned = new Date(assignedAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60));
    return diffInHours > 48; // More than 2 days
  }, []);

  // Sort cases based on auto-highlight options
  const cases = React.useMemo(() => {
    let sortedCases = [...rawCases];

    if (reviewUrgentFirst || flagOverdueCases) {
      sortedCases.sort((a, b) => {
        // Check if cases are overdue
        const aOverdue = flagOverdueCases && isOverdue(a.assignedAt);
        const bOverdue = flagOverdueCases && isOverdue(b.assignedAt);

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

        // If same priority, sort by assigned date (older first)
        if (a.assignedAt && b.assignedAt) {
          return new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime();
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
    if (!c.assignedAt) return false;
    const assigned = new Date(c.assignedAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60));
    return diffInHours > 48; // More than 2 days
  }).length;

  const handleFiltersChange = (newFilters: Partial<CaseListQuery>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset to first page when filters change
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
    });
    setSearchTerm('');
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit: number) => {
    setFilters(prev => ({ ...prev, limit, page: 1 }));
  };

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
      console.error('Failed to export pending cases:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pending Cases</h1>
          <p className="mt-2 text-muted-foreground">
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
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPending}</div>
            <p className="text-xs text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">
              High priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{oldCases}</div>
            <p className="text-xs text-muted-foreground">
              &gt; 2 days old
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Search & Filters</CardTitle>
            <div className="flex items-center space-x-2">
              {/* Auto-highlight toggles */}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by case ID, customer name, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {(searchTerm || Object.keys(filters).length > 3) && (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select
                  value={filters.status || ''}
                  onValueChange={(value) => handleFiltersChange({ status: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Pending</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-filter">Client</Label>
                <Select
                  value={filters.clientId?.toString() || ''}
                  onValueChange={(value) => handleFiltersChange({ clientId: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority-filter">Priority</Label>
                <Select
                  value={filters.priority?.toString() || ''}
                  onValueChange={(value) => handleFiltersChange({ priority: value ? Number(value) : undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Low (1)</SelectItem>
                    <SelectItem value="2">Medium (2)</SelectItem>
                    <SelectItem value="3">High (3)</SelectItem>
                    <SelectItem value="4">Urgent (4)</SelectItem>
                    <SelectItem value="5">Critical (5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
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
        </CardContent>
      </Card>
    </div>
  );
};
