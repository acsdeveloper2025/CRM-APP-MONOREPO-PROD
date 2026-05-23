import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { useScopePageReset } from '@/hooks/useScopePageReset';
import { useActiveScope } from '@/hooks/useActiveScope';
import { useRevisitTaskAction } from '@/hooks/useRevisitTaskAction';
import { VerificationTasksService } from '@/services/verificationTasks';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import {
  CheckCircle,
  Calendar,
  CalendarDays,
  Timer,
  Repeat2,
  Download,
  RefreshCw,
} from 'lucide-react';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const SORT_OPTIONS: Array<{
  value: string;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}> = [
  {
    value: 'completedAt_desc',
    label: 'Recently completed',
    sortBy: 'completedAt',
    sortOrder: 'desc',
  },
  {
    value: 'completedAt_asc',
    label: 'Earliest completed',
    sortBy: 'completedAt',
    sortOrder: 'asc',
  },
  { value: 'createdAt_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'priority_desc', label: 'Priority (high → low)', sortBy: 'priority', sortOrder: 'desc' },
  { value: 'taskNumber_asc', label: 'Task # (A → Z)', sortBy: 'taskNumber', sortOrder: 'asc' },
];

const COMPLETED_STATUS = 'COMPLETED';

export const CompletedTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const { selectedClientId, selectedProductId } = useActiveScope();

  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '20');
  const priority = searchParams.get('priority') || 'all';
  const sort = searchParams.get('sort') || 'completedAt_desc';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const sortPair = useMemo(
    () => SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0],
    [sort]
  );

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '' || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: false });
  };

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  useEffect(() => {
    if (page !== 1 && searchParams.get('page')) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue, priority, sort, dateFrom, dateTo, pageSize]);

  useScopePageReset(() => updateParam('page', null));

  const baseFilters = {
    status: COMPLETED_STATUS,
    priority: priority === 'all' ? undefined : priority,
    search: debouncedSearchValue || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const queryFilters = {
    ...baseFilters,
    page,
    limit: pageSize,
    sortBy: sortPair.sortBy,
    sortOrder: sortPair.sortOrder,
  };

  const { tasks, loading, error, pagination, refreshTasks } = useAllVerificationTasks(queryFilters);

  const { data: stats } = useQuery({
    queryKey: [
      'verification-tasks-stats',
      'completed-tasks',
      baseFilters,
      { c: selectedClientId, p: selectedProductId },
    ],
    queryFn: () => VerificationTasksService.getStats({ ...baseFilters, excludeTaskType: 'KYC' }),
  });

  const activeFilterCount = (priority !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['priority', 'dateFrom', 'dateTo', 'sort', 'page'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: false });
    clearSearch();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      toast.info('Generating Excel export...');
      const blob = await VerificationTasksService.exportToExcel({
        ...baseFilters,
        excludeTaskType: 'KYC',
        sortBy: sortPair.sortBy,
        sortOrder: sortPair.sortOrder,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `completed_tasks_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded successfully');
    } catch (err) {
      logger.error('Export failed:', err);
      toast.error('Failed to export tasks');
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewTask = (taskId: string) => {
    navigate(`/task-management/${taskId}`);
  };
  const handleViewCase = (caseId: string) => {
    if (caseId) {
      navigate(`/case-management/${caseId}`);
    }
  };
  const handleEditCase = (caseId: string, taskId?: string) => {
    if (!caseId) {
      return;
    }
    const url = taskId
      ? `/case-management/create-new-case?edit=${caseId}&taskId=${taskId}`
      : `/case-management/create-new-case?edit=${caseId}`;
    navigate(url);
  };

  const { requestRevisit, dialog: revisitDialog } = useRevisitTaskAction({ navigateAfter: true });
  const handleRevisitTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    requestRevisit({ id: taskId, taskNumber: task?.taskNumber });
  };

  const totalPages = pagination.totalPages || 1;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Completed Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Verification tasks that have been completed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Completed</p>
                <p className="text-2xl font-bold">{stats?.total ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold">{stats?.completedToday ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CalendarDays className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{stats?.completedThisWeek ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Timer className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Turnaround</p>
                <p className="text-2xl font-bold">
                  {stats?.avgTurnaroundDays ? stats.avgTurnaroundDays.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Days to completion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Repeat2 className="h-8 w-8 text-amber-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Reassigned</p>
                <p className="text-2xl font-bold">{stats?.reassigned ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Revoked → replacement</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search by task #, case #, customer, title, address..."
        hasActiveFilters={activeFilterCount > 0}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
        filterContent={
          <FilterGrid columns={4}>
            <div className="space-y-1">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => updateParam('priority', v)}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sort">Sort by</Label>
              <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
                <SelectTrigger id="sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => updateParam('dateFrom', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => updateParam('dateTo', e.target.value)}
              />
            </div>
          </FilterGrid>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || loading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting…' : 'Export'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refreshTasks()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-destructive">
              Could not load tasks. Check your connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshTasks()}
              className="border-destructive text-destructive hover:bg-destructive/20"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <TasksListFlat
        tasks={tasks}
        loading={loading}
        onAssignTask={() => {}}
        onViewTask={handleViewTask}
        onViewCase={handleViewCase}
        onEditCase={handleEditCase}
        onRevisitTask={handleRevisitTask}
      />

      {pagination.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, pagination.total)}{' '}
                of {pagination.total} tasks
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pageSize" className="text-sm">
                    Rows
                  </Label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => updateParam('pageSize', v === '20' ? null : v)}
                  >
                    <SelectTrigger id="pageSize" className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateParam('page', page <= 2 ? null : String(page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateParam('page', String(page + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {revisitDialog}
    </div>
  );
};
