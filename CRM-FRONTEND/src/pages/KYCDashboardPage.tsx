import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
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
  FileCheck,
  Clock,
  CheckCircle,
  PlayCircle,
  Download,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import {
  useKYCTasks,
  useKYCDocumentTypes,
  useAssignKYCTask,
  useRecheckCloneKYC,
  useKYCMis,
} from '@/hooks/useKYC';
import { usePermission } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiService } from '@/services/api';
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

// KYC redesign (2026-06-02): users see only two states — Pending / Completed.
// Every non-completed engine state (PENDING/ASSIGNED/IN_PROGRESS/REVOKED) is
// presented as "Pending"; COMPLETED is "Completed".
const kycDisplayStatus = (status: string): { label: string; color: string } =>
  status === 'COMPLETED'
    ? { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' }
    : { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };

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

  // KYC state-transition mutations. P3 (2026-06-02): Reverify + Revoke retired
  // from the UI — Recheck = clone-to-new-task is the single re-open path.
  const { mutateAsync: recheckClone, isPending: isRechecking } = useRecheckCloneKYC();
  // KYC Verifier read-only model (2026-06-02): action controls are permission-
  // gated. The read-only verifier (none of these) sees only View + navigation.
  // NOTE: each usePermission() is a hook (reads auth context) — call them all
  // UNCONDITIONALLY and combine with plain booleans. Never chain hook calls with
  // `||` (short-circuit would skip hook calls → Rules-of-Hooks violation/crash).
  const canComplete = usePermission('kyc.complete');
  const canReverifyPerm = usePermission('kyc.reverify');
  const canRevokePerm = usePermission('kyc.revoke');
  const canAssignKyc = usePermission('kyc.assign');
  const canCaseCreate = usePermission('case.create');
  const canCaseAssign = usePermission('case.assign');
  const canCaseReassign = usePermission('case.reassign');
  const canAssignPerm = canAssignKyc || canCaseCreate || canCaseAssign || canCaseReassign;
  // KYC summary cards — report viewers only. (analytics.view is not a real
  // permission — report.generate is the only gate.)
  const canViewMis = usePermission('report.generate');
  const { data: mis } = useKYCMis(canViewMis);
  // Read-only KYC Verifier portal (2026-06-02): a viewer holding none of the
  // KYC workflow permissions. They get a simplified "My KYC" view — only the
  // documents assigned to them, a single count card, no workflow-status cards
  // (the workflow tabs are likewise hidden in navigation.ts).
  const { user } = useAuth();
  const isReadOnlyKyc =
    !canComplete && !canAssignPerm && !canRevokePerm && !canReverifyPerm;
  // Recheck-clone dialog (P3): clone a completed KYC doc into a new editable
  // Pending task. Pre-filled from the row; user edits + picks a verifier.
  const [recheckTask, setRecheckTask] = useState<{ id: string; taskNumber: string } | null>(null);
  const [recheckDocType, setRecheckDocType] = useState<string>('');
  const [recheckNumber, setRecheckNumber] = useState<string>('');
  const [recheckHolder, setRecheckHolder] = useState<string>('');
  const [recheckVerifier, setRecheckVerifier] = useState<string>('');
  // Per-document-type custom field values (e.g. PAN-specific fields). Pre-filled
  // from the original, editable; keyed by the doc type's customFields schema.
  const [recheckDetails, setRecheckDetails] = useState<Record<string, string>>({});
  const { data: kycVerifiersData } = useQuery({
    queryKey: ['users-kyc-verifier-assignable'],
    queryFn: async () => {
      const res = await apiService.get('/users/assignable-by-role', { role: 'KYC_VERIFIER' });
      return res.data as Array<{ id: string; name: string; employeeId: string }>;
    },
    staleTime: 5 * 60 * 1000,
    enabled: reassignTaskId !== null || recheckTask !== null,
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

  // KYC redesign (2026-06-02): no /start step. The backend user opens the
  // completion screen directly and records the outcome there.
  const handleComplete = (task: { id: string }) => {
    navigate(`/kyc-verification/verify/${task.id}`);
  };

  const openRecheck = (task: {
    id: string;
    taskNumber: string;
    documentType: string;
    documentNumber: string | null;
    documentHolderName: string | null;
    documentDetails?: Record<string, string> | null;
    assignedTo: string | null;
  }) => {
    setRecheckTask({ id: task.id, taskNumber: task.taskNumber });
    setRecheckDocType(task.documentType || '');
    setRecheckNumber(task.documentNumber || '');
    setRecheckHolder(task.documentHolderName || '');
    setRecheckVerifier(task.assignedTo || '');
    setRecheckDetails({ ...(task.documentDetails || {}) });
  };

  const handleRecheckSubmit = async () => {
    if (!recheckTask) {
      return;
    }
    if (!recheckVerifier) {
      toast.error('Please select a KYC verifier.');
      return;
    }
    const selType = docTypes.find((d) => d.code === recheckDocType);
    const fields = selType?.customFields || [];
    const missing = fields.filter((f) => f.required && !(recheckDetails[f.key] || '').trim());
    if (missing.length > 0) {
      toast.error(`Please fill: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }
    const documentDetails: Record<string, string> = {};
    fields.forEach((f) => {
      const v = (recheckDetails[f.key] || '').trim();
      if (v) {
        documentDetails[f.key] = v;
      }
    });
    try {
      await recheckClone({
        taskId: recheckTask.id,
        payload: {
          documentTypeId: selType?.id,
          documentNumber: recheckNumber.trim() || undefined,
          documentHolderName: recheckHolder.trim() || undefined,
          documentDetails: Object.keys(documentDetails).length > 0 ? documentDetails : undefined,
          assignedTo: recheckVerifier,
        },
      });
      toast.success('Recheck created — a new KYC task is pending with the verifier.');
      setRecheckTask(null);
    } catch (error) {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to create recheck'
      );
    }
  };

  // URL state — every filter survives reload + is shareable.
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '20');
  // Read-only verifier lands on their open queue (Pending) by default — their
  // job is to download + work what's still assigned. They can switch the Status
  // filter (or the Completed tab) to see finished docs.
  const status =
    searchParams.get('status') || defaultStatus || (isReadOnlyKyc ? 'PENDING' : 'ALL');
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

  // KYC redesign (2026-06-02): the only user-facing statuses are Pending and
  // Completed. "Completed" → status=COMPLETED; "Pending" → everything else
  // (statusNot=COMPLETED). `defaultStatus` is no longer routed (single page).
  const effectiveStatus = status === 'COMPLETED' ? 'COMPLETED' : undefined;
  const effectiveStatusNot = status === 'PENDING' ? 'COMPLETED' : undefined;

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
    assignedTo: isReadOnlyKyc ? user?.id : undefined,
  };

  const { data: taskData, isLoading, isError, refetch } = useKYCTasks(queryFilters);

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isReadOnlyKyc
              ? status === 'COMPLETED'
                ? 'My KYC — Completed'
                : status === 'PENDING'
                  ? 'My KYC — To Download'
                  : 'My KYC'
              : pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isReadOnlyKyc
              ? status === 'COMPLETED'
                ? 'Documents you were assigned that the back office has completed'
                : status === 'PENDING'
                  ? 'Documents assigned to you — download and verify with the source'
                  : 'All documents assigned to you — view & download'
              : pageSubtitle}
          </p>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-destructive">
              Could not load KYC tasks. Check your connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-destructive text-destructive hover:bg-destructive/20"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Read-only KYC Verifier: single "Assigned to me" count. Workflow
          operators (backend/admin) get the KYC MIS row below instead — the
          old per-status card grid was redundant with MIS + the Status filter. */}
      {isReadOnlyKyc && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    {status === 'COMPLETED'
                      ? 'Completed'
                      : status === 'PENDING'
                        ? 'To download'
                        : 'Assigned to me'}
                  </p>
                  <p className="text-2xl font-bold">{pagination.total ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {status === 'COMPLETED'
                      ? 'Completed by the back office'
                      : 'Documents assigned to you'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* KYC summary cards — cycle-based counts (Pending + Completed model).
          Sourced from kyc_verification_cycles via /api/kyc/mis. */}
      {!isReadOnlyKyc && canViewMis && mis && (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-3">
          <StatsCard
            title="Total KYC"
            value={mis.totalAssigned}
            description="All documents"
            icon={FileCheck}
            color="text-blue-600"
            onClick={() => navigate('/kyc-verification/all-kyc')}
            className="cursor-pointer"
          />
          <StatsCard
            title="Pending"
            value={mis.pendingWithVerifier}
            description="Awaiting verification"
            icon={Clock}
            color="text-amber-600"
            onClick={() => navigate('/kyc-verification/pending-kyc')}
            className="cursor-pointer"
          />
          <StatsCard
            title="Completed"
            value={mis.completed}
            description="Verification completed"
            icon={CheckCircle}
            color="text-green-600"
            onClick={() => navigate('/kyc-verification/completed-kyc')}
            className="cursor-pointer"
          />
        </div>
      )}

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
                  <SelectItem value="COMPLETED">Completed</SelectItem>
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
                  // Each control requires BOTH a valid state AND the matching
                  // permission. The read-only KYC Verifier holds none of these.
                  // No /start step — the backend user completes directly from
                  // any non-terminal state.
                  const canCompleteTask =
                    canComplete &&
                    (status === 'PENDING' || status === 'ASSIGNED' || status === 'IN_PROGRESS');
                  // Assign on a first-time PENDING (no assignee yet) or a REVOKED row.
                  const canAssign =
                    canAssignPerm &&
                    ((status === 'PENDING' && !task.assignedTo) || status === 'REVOKED');
                  // P3 (2026-06-02): Recheck = clone-to-new-task on a COMPLETED doc
                  // (replaces Reverify). Revoke removed from the UI.
                  const canRecheck = canReverifyPerm && status === 'COMPLETED';
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
                        <Badge className={kycDisplayStatus(status).color}>
                          {kycDisplayStatus(status).label}
                        </Badge>
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
                          {canCompleteTask && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleComplete(task)}
                              title="Record findings and complete this KYC document"
                            >
                              <PlayCircle className="h-4 w-4 mr-1" />
                              Complete
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
                          {canRecheck && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRecheck(task)}
                              title="Recheck — clone this into a new editable KYC task and reassign"
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

      {/* P3 (2026-06-02): Recheck dialog — clone a completed KYC doc into a new
          editable Pending task, then reassign to a verifier. Bills as fresh. */}
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
            <DialogTitle>Recheck KYC document</DialogTitle>
            <DialogDescription>
              Creates a NEW KYC task (copied from <strong>{recheckTask?.taskNumber || 'this one'}</strong>)
              in Pending. Edit the details if needed, pick a verifier, and it&apos;s billed as a fresh
              KYC. The original stays completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="kyc-recheck-doctype">Document Type</Label>
              <Select value={recheckDocType} onValueChange={setRecheckDocType}>
                <SelectTrigger id="kyc-recheck-doctype">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {docTypes.map((dt) => (
                    <SelectItem key={dt.code} value={dt.code}>
                      {dt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kyc-recheck-number">Document Number</Label>
              <Input
                id="kyc-recheck-number"
                value={recheckNumber}
                onChange={(e) => setRecheckNumber(e.target.value)}
                placeholder="Document number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kyc-recheck-holder">Document Holder Name</Label>
              <Input
                id="kyc-recheck-holder"
                value={recheckHolder}
                onChange={(e) => setRecheckHolder(e.target.value)}
                placeholder="Holder name"
              />
            </div>
            {/* P3: per-document-type custom fields (e.g. PAN-specific). Rendered
                from the selected type's schema, pre-filled from the original. */}
            {(docTypes.find((d) => d.code === recheckDocType)?.customFields || []).map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`kyc-recheck-${f.key}`}>
                  {f.label}
                  {f.required ? ' *' : ''}
                </Label>
                <Input
                  id={`kyc-recheck-${f.key}`}
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={recheckDetails[f.key] || ''}
                  onChange={(e) =>
                    setRecheckDetails((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  placeholder={f.label}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="kyc-recheck-verifier">Assign to Verifier *</Label>
              <Select value={recheckVerifier} onValueChange={setRecheckVerifier}>
                <SelectTrigger id="kyc-recheck-verifier">
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
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" disabled={isRechecking} onClick={() => setRecheckTask(null)}>
              Cancel
            </Button>
            <Button onClick={handleRecheckSubmit} disabled={isRechecking || !recheckVerifier}>
              {isRechecking ? 'Creating…' : 'Create Recheck'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
