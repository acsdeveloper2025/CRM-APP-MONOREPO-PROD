import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
import {
  FileText,
  Clock,
  PlayCircle,
  CheckCircle,
  Download,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  useKYCTasks,
  useKYCDocumentTypes,
  useAssignKYCTask,
  useStartKYCTask,
  useRevokeKYCTask,
  useRecheckKYCTask,
} from '@/hooks/useKYC';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiService } from '@/services/api';
import { revokeReasonsService } from '@/services/revokeReasons';
import { extractEditBlockedError } from '@/utils/editLock';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { useScopePageReset } from '@/hooks/useScopePageReset';
import { kycService } from '@/services/kyc';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const SORT_OPTIONS: Array<{
  value: string;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}> = [
  { value: 'createdAt_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'createdAt_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'verifiedAt_desc', label: 'Recently verified', sortBy: 'verifiedAt', sortOrder: 'desc' },
  { value: 'customerName_asc', label: 'Customer A → Z', sortBy: 'customerName', sortOrder: 'asc' },
  {
    value: 'caseNumber_desc',
    label: 'Case # (high → low)',
    sortBy: 'caseNumber',
    sortOrder: 'desc',
  },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ASSIGNED: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 border-purple-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  REVOKED: 'bg-red-100 text-red-800 border-red-200',
};

const CATEGORY_COLORS: Record<string, string> = {
  IDENTITY: 'bg-blue-100 text-blue-700',
  FINANCIAL: 'bg-emerald-100 text-emerald-700',
  BUSINESS: 'bg-violet-100 text-violet-700',
  ADDRESS: 'bg-orange-100 text-orange-700',
  PROPERTY: 'bg-teal-100 text-teal-700',
  LEGAL: 'bg-red-100 text-red-700',
  VERIFICATION: 'bg-indigo-100 text-indigo-700',
  MEDICAL: 'bg-pink-100 text-pink-700',
  OTHER: 'bg-muted text-foreground',
};

interface KYCDashboardPageProps {
  /** Route-default status filter override. Accepts 'PENDING' / 'IN_PROGRESS' /
   *  'REVOKED' / 'COMPLETED' (completed page maps to statusNot=PENDING). */
  defaultStatus?: string;
  pageTitle?: string;
  pageSubtitle?: string;
  /** F9.1: restrict list to rows with recheck_count > 0 (Recheck KYC page). */
  recheckedOnly?: boolean;
}

export const KYCDashboardPage: React.FC<KYCDashboardPageProps> = ({
  defaultStatus,
  pageTitle = 'KYC Verification',
  pageSubtitle = 'Verify identity, financial, and address documents',
  recheckedOnly,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  // Reassign dialog state — surfaces the existing /api/kyc/tasks/:id/assign
  // endpoint at the row level so admins can reroute a REVOKED or
  // mis-assigned KYC doc without leaving the dashboard.
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');
  const { mutateAsync: assignKyc, isPending: isReassigning } = useAssignKYCTask();

  // F9.1: KYC state-transition state + mutations
  const { mutateAsync: startKyc, isPending: isStarting } = useStartKYCTask();
  const { mutateAsync: revokeKyc, isPending: isRevoking } = useRevokeKYCTask();
  const { mutateAsync: recheckKyc, isPending: isRechecking } = useRecheckKYCTask();
  const [revokeTask, setRevokeTask] = useState<{ id: string; taskNumber: string } | null>(null);
  const [revokeReasonCode, setRevokeReasonCode] = useState<string>('');
  const [revokeOtherReason, setRevokeOtherReason] = useState<string>('');
  const [recheckTask, setRecheckTask] = useState<{
    id: string;
    taskNumber: string;
  } | null>(null);
  const { data: revokeReasonsResp } = useQuery({
    queryKey: ['revoke-reasons', 'active'],
    queryFn: () => revokeReasonsService.listActive(),
    staleTime: 5 * 60 * 1000,
    enabled: revokeTask !== null,
  });
  const activeRevokeReasons = revokeReasonsResp?.data ?? [];
  const { data: kycVerifiersData } = useQuery({
    queryKey: ['users-kyc-verifier-assignable'],
    queryFn: async () => {
      const res = await apiService.get('/users/assignable-by-role', { role: 'KYC_VERIFIER' });
      return res.data as Array<{ id: string; name: string; employeeId: string }>;
    },
    staleTime: 5 * 60 * 1000,
    enabled: reassignTaskId !== null,
  });
  const kycVerifiers = kycVerifiersData || [];
  const handleReassignSubmit = async () => {
    if (!reassignTaskId || !reassignTo) {
      return;
    }
    try {
      await assignKyc({ taskId: reassignTaskId, assignedTo: reassignTo });
      toast.success('KYC document reassigned');
      setReassignTaskId(null);
      setReassignTo('');
    } catch (error) {
      const blocked = extractEditBlockedError(error);
      toast.error(
        blocked?.message ||
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to reassign'
      );
    }
  };

  // F9.1: Start + Verify composite — if state isn't IN_PROGRESS, call /start
  // first then route to the verify page. One click for the verifier.
  const handleStartAndVerify = async (task: { id: string; verificationStatus: string }) => {
    try {
      if (task.verificationStatus !== 'IN_PROGRESS') {
        await startKyc(task.id);
      }
      navigate(`/kyc-verification/verify/${task.id}`);
    } catch (error) {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to start verification'
      );
    }
  };

  const handleRevokeSubmit = async () => {
    if (!revokeTask) {
      return;
    }
    const matched = activeRevokeReasons.find((r) => r.code === revokeReasonCode);
    const reason =
      revokeReasonCode === 'OTHER' ? revokeOtherReason.trim() : matched?.label || revokeReasonCode;
    if (!reason) {
      toast.error('Please pick or enter a revoke reason.');
      return;
    }
    try {
      await revokeKyc({ taskId: revokeTask.id, revokeReason: reason });
      toast.success('KYC document revoked');
      setRevokeTask(null);
      setRevokeReasonCode('');
      setRevokeOtherReason('');
    } catch (error) {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to revoke'
      );
    }
  };

  const handleRecheckSubmit = async () => {
    if (!recheckTask) {
      return;
    }
    try {
      await recheckKyc(recheckTask.id);
      toast.success('KYC document moved back to Pending');
      setRecheckTask(null);
    } catch (error) {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to recheck'
      );
    }
  };

  // URL state — every filter survives reload + is shareable.
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '20');
  const status = searchParams.get('status') || defaultStatus || 'ALL';
  const docType = searchParams.get('documentType') || 'ALL';
  const sort = searchParams.get('sort') || 'createdAt_desc';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const sortPair = useMemo(
    () => SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0],
    [sort]
  );

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '' || value === 'ALL') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: false });
  };

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  // Reset to page 1 on filter/sort change.
  useEffect(() => {
    if (page !== 1 && searchParams.get('page')) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue, status, docType, sort, dateFrom, dateTo, pageSize]);

  useScopePageReset(() => updateParam('page', null));

  const { data: docTypes = [] } = useKYCDocumentTypes();

  // The Completed-KYC route maps to `statusNot=PENDING` (everything that
  // is no longer pending). When defaultStatus='COMPLETED' AND the user
  // hasn't picked a specific status in the dropdown, hand statusNot to BE.
  const isCompletedPage = defaultStatus === 'COMPLETED';
  const effectiveStatus = status !== 'ALL' && !isCompletedPage ? status : undefined;
  const effectiveStatusNot = isCompletedPage && status === 'ALL' ? 'PENDING' : undefined;

  const queryFilters = {
    page,
    limit: pageSize,
    search: debouncedSearchValue || undefined,
    status: effectiveStatus,
    statusNot: effectiveStatusNot,
    documentType: docType !== 'ALL' ? docType : undefined,
    sortBy: sortPair.sortBy,
    sortOrder: sortPair.sortOrder,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    recheckedOnly: recheckedOnly || undefined,
  };

  const { data: taskData, isLoading, refetch } = useKYCTasks(queryFilters);

  // 5-card stats from new /kyc/tasks/stats endpoint. Ignores route status
  // narrowing so counters cover the full in-scope KYC pool.
  const { data: stats } = useQuery({
    queryKey: ['kyc-tasks-stats'],
    queryFn: () => kycService.getStats(),
  });

  const tasks = taskData?.data || [];
  const pagination = taskData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const activeFilterCount =
    (status !== 'ALL' ? 1 : 0) +
    (docType !== 'ALL' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['status', 'documentType', 'dateFrom', 'dateTo', 'sort', 'page'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: false });
    clearSearch();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      toast.info('Generating Excel export...');
      const blob = await kycService.exportToExcel({
        status: effectiveStatus,
        statusNot: effectiveStatusNot,
        documentType: docType !== 'ALL' ? docType : undefined,
        search: debouncedSearchValue || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortPair.sortBy,
        sortOrder: sortPair.sortOrder,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kyc-verifications-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded successfully');
    } catch (err) {
      logger.error('KYC export failed:', err);
      toast.error('Failed to export KYC tasks');
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = pagination.totalPages || 1;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
        </div>
      </div>

      {/* 5-card stats grid (shared across all 3 routes — reflects full
          in-scope KYC pool regardless of route status narrowing). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total KYC</p>
                <p className="text-2xl font-bold">{stats?.total ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-amber-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">
                  {(stats?.pending ?? 0) + (stats?.assigned ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Pending + Assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <PlayCircle className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats?.inProgress ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats?.completed ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Revoked</p>
                <p className="text-2xl font-bold">{stats?.revoked ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Needs recheck</p>
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
        searchPlaceholder="Search by customer name, document number, holder name..."
        hasActiveFilters={activeFilterCount > 0}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
        filterContent={
          <FilterGrid columns={4}>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => updateParam('status', v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="REVOKED">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="documentType">Document Type</Label>
              <Select value={docType} onValueChange={(v) => updateParam('documentType', v)}>
                <SelectTrigger id="documentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {docTypes.map((dt) => (
                    <SelectItem key={dt.code} value={dt.code}>
                      {dt.name}
                    </SelectItem>
                  ))}
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
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || isLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting…' : 'Export'}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No KYC tasks found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task #</TableHead>
                  <TableHead>Case #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Doc Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const status = task.verificationStatus;
                  const canStartVerify =
                    status === 'PENDING' || status === 'ASSIGNED' || status === 'IN_PROGRESS';
                  const canRevoke =
                    status === 'PENDING' || status === 'ASSIGNED' || status === 'IN_PROGRESS';
                  // F9.1 Gap B: BE supports reassign on any non-COMPLETED state.
                  // Expose Reassign on PENDING/ASSIGNED/IN_PROGRESS/REVOKED so admins
                  // can hand off mid-verification or re-route a revoked doc in one click.
                  const canAssign =
                    status === 'PENDING' ||
                    status === 'ASSIGNED' ||
                    status === 'IN_PROGRESS' ||
                    status === 'REVOKED';
                  // F9.1: COMPLETED rows can also be rechecked (re-open a verified doc).
                  const canRecheck = status === 'REVOKED' || status === 'COMPLETED';
                  const isCompleted = status === 'COMPLETED';
                  return (
                    <TableRow key={task.id} className="hover:bg-muted">
                      <TableCell>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/task-management/${task.taskNumber || task.verificationTaskId}`
                            )
                          }
                          className="inline-flex items-center rounded-md bg-green-600 px-2.5 py-0.5 text-xs font-medium uppercase text-white hover:bg-green-700 transition-colors"
                          title="Open task details"
                        >
                          {task.taskNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-primary hover:underline font-medium"
                          onClick={() => navigate(`/case-management/${task.caseId}`)}
                        >
                          {task.caseNumber}
                        </Button>
                      </TableCell>
                      <TableCell>{task.customerName}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[task.documentCategory] || 'bg-muted text-foreground'}`}
                        >
                          {task.documentCategory}
                        </span>
                      </TableCell>
                      <TableCell>{task.documentTypeName}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {task.documentNumber || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[status] || ''}>{status}</Badge>
                      </TableCell>
                      <TableCell>
                        {task.assignedToName || (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(task.createdAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {canStartVerify && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isStarting}
                              onClick={() => handleStartAndVerify(task)}
                              title={
                                status === 'IN_PROGRESS'
                                  ? 'Open verify page'
                                  : 'Start and open verify page'
                              }
                            >
                              <PlayCircle className="h-4 w-4 mr-1" />
                              {status === 'IN_PROGRESS' ? 'Verify' : 'Start + Verify'}
                            </Button>
                          )}
                          {isCompleted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/kyc-verification/verify/${task.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          )}
                          {canAssign && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReassignTaskId(task.id);
                                setReassignTo('');
                              }}
                              title={
                                status === 'PENDING'
                                  ? 'Assign this KYC document to a verifier'
                                  : 'Hand off this KYC document to a different verifier'
                              }
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              {status === 'PENDING' ? 'Assign' : 'Reassign'}
                            </Button>
                          )}
                          {canRevoke && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRevokeTask({ id: task.id, taskNumber: task.taskNumber });
                                setRevokeReasonCode('');
                                setRevokeOtherReason('');
                              }}
                              title="Revoke this KYC document"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Revoke
                            </Button>
                          )}
                          {canRecheck && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setRecheckTask({ id: task.id, taskNumber: task.taskNumber })
                              }
                              title="Move back to Pending for a fresh verification"
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Recheck
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, pagination.total)} of{' '}
                {pagination.total}
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
                  disabled={page <= 1}
                  onClick={() => updateParam('page', page <= 2 ? null : String(page - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => updateParam('page', String(page + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reassign KYC dialog — wraps existing /api/kyc/tasks/:id/assign */}
      <Dialog
        open={reassignTaskId !== null}
        onOpenChange={(open) => {
          if (!open && !isReassigning) {
            setReassignTaskId(null);
            setReassignTo('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign KYC document</DialogTitle>
            <DialogDescription>Pick a KYC verifier to take over this document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="kyc-reassign-to">Verifier</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger id="kyc-reassign-to">
                <SelectValue placeholder="Select a verifier" />
              </SelectTrigger>
              <SelectContent>
                {kycVerifiers.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    No verifiers available
                  </SelectItem>
                ) : (
                  kycVerifiers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} {u.employeeId ? `(${u.employeeId})` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              disabled={isReassigning}
              onClick={() => {
                setReassignTaskId(null);
                setReassignTo('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleReassignSubmit} disabled={isReassigning || !reassignTo}>
              {isReassigning ? 'Reassigning…' : 'Reassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F9.1: Revoke KYC dialog — picks from revoke_reasons master with
          OTHER → free-text fallback. BE writes kyc_revocations audit row. */}
      <Dialog
        open={revokeTask !== null}
        onOpenChange={(open) => {
          if (!open && !isRevoking) {
            setRevokeTask(null);
            setRevokeReasonCode('');
            setRevokeOtherReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke KYC document?</DialogTitle>
            <DialogDescription>
              This sends <strong>{revokeTask?.taskNumber || 'this document'}</strong> to the Revoke
              KYC queue. The verifier&apos;s assignment is cleared. A reviewer can later recheck it
              to move it back to Pending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="kyc-revoke-reason">Reason *</Label>
              <Select value={revokeReasonCode} onValueChange={setRevokeReasonCode}>
                <SelectTrigger id="kyc-revoke-reason">
                  <SelectValue placeholder="Pick a reason" />
                </SelectTrigger>
                <SelectContent>
                  {activeRevokeReasons.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      No revoke reasons configured
                    </SelectItem>
                  ) : (
                    activeRevokeReasons.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {revokeReasonCode === 'OTHER' && (
              <div className="space-y-2">
                <Label htmlFor="kyc-revoke-other">Specify reason *</Label>
                <Textarea
                  id="kyc-revoke-other"
                  value={revokeOtherReason}
                  onChange={(e) => setRevokeOtherReason(e.target.value)}
                  placeholder="Explain why this KYC document should be revoked"
                  rows={3}
                  maxLength={500}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              disabled={isRevoking}
              onClick={() => {
                setRevokeTask(null);
                setRevokeReasonCode('');
                setRevokeOtherReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeSubmit}
              disabled={
                isRevoking ||
                !revokeReasonCode ||
                (revokeReasonCode === 'OTHER' && revokeOtherReason.trim().length === 0)
              }
            >
              {isRevoking ? 'Revoking…' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F9.1: Recheck confirm dialog */}
      <Dialog
        open={recheckTask !== null}
        onOpenChange={(open) => {
          if (!open && !isRechecking) {
            setRecheckTask(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recheck KYC document?</DialogTitle>
            <DialogDescription>
              <strong>{recheckTask?.taskNumber || 'This document'}</strong> goes back to Pending for
              a fresh verification. Previous revoke metadata is cleared and the recheck count
              increments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" disabled={isRechecking} onClick={() => setRecheckTask(null)}>
              Cancel
            </Button>
            <Button onClick={handleRecheckSubmit} disabled={isRechecking}>
              {isRechecking ? 'Rechecking…' : 'Recheck'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
