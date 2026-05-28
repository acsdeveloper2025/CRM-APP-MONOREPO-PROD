import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  ArrowLeft,
  CheckSquare,
  Download,
  ExternalLink,
  Eye,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
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
import { Input } from '@/components/ui/input';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { useAreas } from '@/hooks/useAreas';
import { usePincodes } from '@/hooks/useLocations';
import { useScopePageReset } from '@/hooks/useScopePageReset';
import {
  fieldMonitoringService,
  type FieldMonitoringLiveStatus,
  type FieldMonitoringRosterItem,
} from '@/services/fieldMonitoring';
import { frontendSocketService } from '@/services/socket';
import { logger } from '@/utils/logger';

// P9 truthful-sweep 2026-05-27: WS `field-monitoring:location-updated`
// is the primary refresh trigger (see useEffect ~line 432). Polling
// interval below is a safety net for WS-drop scenarios + routes that
// mutate roster state without emitting location-updated (status
// changes, assignments). Bumped 60s → 5 min — was 4 simultaneous
// polls/min hammering /roster + /map + /stats + /detail at every open
// admin session.
const WS_SAFETY_NET_INTERVAL = 5 * 60_000; // 5 min fallback
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const STATUS_OPTIONS: FieldMonitoringLiveStatus[] = ['Online', 'Offline'];

type SortOption = 'name_asc' | 'name_desc' | 'createdAt_desc' | 'createdAt_asc';
const SORT_OPTIONS: {
  value: SortOption;
  label: string;
  sortBy: 'name' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}[] = [
  { value: 'name_asc', label: 'Name A → Z', sortBy: 'name', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Name Z → A', sortBy: 'name', sortOrder: 'desc' },
  { value: 'createdAt_desc', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'createdAt_asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
];

type FieldMonitoringFilters = {
  pincode?: string;
  areaId?: string;
  status?: FieldMonitoringLiveStatus;
};

const statusBadgeClassNames: Record<FieldMonitoringLiveStatus, string> = {
  Online: 'bg-green-100 text-green-700 border-green-200',
  Offline: 'bg-muted text-foreground border-border',
};


const formatTimestamp = (value: string | null | undefined): string => {
  if (!value) {
    return '-';
  }

  try {
    return format(new Date(value), 'dd/MM/yyyy, HH:mm:ss');
  } catch {
    return '-';
  }
};

const getMobileDisplay = (
  user: Pick<FieldMonitoringRosterItem, 'phone' | 'employeeId' | 'username'>
): string => {
  if (user.phone?.trim()) {
    return user.phone;
  }

  if (user.employeeId?.trim()) {
    return `Employee ID: ${user.employeeId}`;
  }

  return user.username || 'Not available';
};

const getLastLocationDisplayTime = (
  user: Pick<FieldMonitoringRosterItem, 'lastLocation' | 'lastHeartbeatAt'>
): string => formatTimestamp(user.lastLocation?.time || user.lastHeartbeatAt);

const formatRelativeTime = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return '';
  }
};

// Roster "Location" cell: the executive's real current address resolved
// from their latest GPS fix, plus the raw coordinates and a maps link.
// Lazy per-row reverse-geocode keyed by 6dp coords so react-query dedupes
// identical positions; backend caches in Redis so repeats never hit Google.
function ExecutiveLocationCell({ user }: { user: FieldMonitoringRosterItem }) {
  const loc = user.lastLocation;
  const lat = loc?.lat ?? null;
  const lng = loc?.lng ?? null;
  const latKey = lat != null ? lat.toFixed(6) : null;
  const lngKey = lng != null ? lng.toFixed(6) : null;

  const { data: address, isLoading } = useQuery({
    queryKey: ['reverse-geocode', latKey, lngKey],
    queryFn: async () => {
      const res = await fieldMonitoringService.reverseGeocode(lat as number, lng as number);
      return res?.data?.address ?? null;
    },
    enabled: lat != null && lng != null,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  if (lat == null || lng == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="flex max-w-[260px] flex-col gap-0.5">
      <span className="flex items-start gap-1 text-sm">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="line-clamp-2">
          {isLoading ? 'Resolving…' : address || 'Address unavailable'}
        </span>
      </span>
      <span className="pl-[18px] font-mono text-xs text-muted-foreground">{coords}</span>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 pl-[18px] text-xs text-primary hover:underline"
      >
        Open in Maps
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function FieldMonitoringDetailView({ userId }: { userId: string }) {
  const navigate = useNavigate();

  const { data: detailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['field-monitoring', 'user-detail', userId],
    queryFn: () => fieldMonitoringService.getUserMonitoringDetail(userId),
    staleTime: WS_SAFETY_NET_INTERVAL,
    refetchInterval: WS_SAFETY_NET_INTERVAL,
  });

  const detail = detailResponse?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate('/operations/field-monitoring')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Field Executive Detail
            </h1>
            <p className="text-muted-foreground">
              Current operational snapshot and recent field activity
            </p>
          </div>
        </div>
      </div>

      {detailLoading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <LoadingState message="Loading executive details..." size="lg" />
        </div>
      ) : !detail ? (
        <Card>
          <CardContent className="flex min-h-[240px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No monitoring detail available for this user.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{detail.user.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {getMobileDisplay({
                      phone: detail.user.phone,
                      employeeId: detail.user.employeeId,
                      username: detail.user.username,
                    })}{' '}
                    · {detail.user.email || detail.user.username}
                  </p>
                </div>
                <Badge variant="outline" className={statusBadgeClassNames[detail.liveStatus]}>
                  {detail.liveStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Last Known Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-foreground">
                <p>Latitude: {detail.lastKnownLocation?.lat ?? '-'}</p>
                <p>Longitude: {detail.lastKnownLocation?.lng ?? '-'}</p>
                <p>
                  Recorded At:{' '}
                  {formatTimestamp(
                    detail.lastKnownLocation?.recordedAt || detail.activity.lastHeartbeatAt
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-foreground">
                <p>Last Heartbeat: {formatTimestamp(detail.activity.lastHeartbeatAt)}</p>
                <p>Last Task Activity: {formatTimestamp(detail.activity.lastTaskActivityAt)}</p>
                <p>
                  Last Location:{' '}
                  {formatTimestamp(
                    detail.activity.lastLocationAt || detail.activity.lastHeartbeatAt
                  )}
                </p>
                <p>Last Submission: {formatTimestamp(detail.activity.lastSubmissionAt)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operating Territory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-foreground">
                <p>Current Area: {detail.operatingTerritory.currentArea.name || '-'}</p>
                <p>Current Pincode: {detail.operatingTerritory.currentOperatingPincode || '-'}</p>
                <p>
                  Assigned Areas:{' '}
                  {detail.operatingTerritory.assignedTerritory.areas.length > 0
                    ? detail.operatingTerritory.assignedTerritory.areas
                        .map((area) => `${area.areaName} (${area.pincodeCode})`)
                        .join(', ')
                    : '-'}
                </p>
                <p>
                  Assigned Pincodes:{' '}
                  {detail.operatingTerritory.assignedTerritory.pincodes.length > 0
                    ? detail.operatingTerritory.assignedTerritory.pincodes
                        .map((pincode) => pincode.pincodeCode)
                        .join(', ')
                    : '-'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Open Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.openAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open assignments.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.openAssignments.map((assignment) => (
                      <div key={assignment.task.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-foreground">
                              Task {assignment.task.taskNumber}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Case #{assignment.case.caseNumber} · {assignment.case.customerName}
                            </p>
                          </div>
                          <Badge variant="outline">{assignment.task.status}</Badge>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-foreground sm:grid-cols-2">
                          <p>Priority: {assignment.task.priority || '-'}</p>
                          <p>Pincode: {assignment.task.pincode || '-'}</p>
                          <p>Assigned At: {formatTimestamp(assignment.task.assignedAt)}</p>
                          <p>Started At: {formatTimestamp(assignment.task.startedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function FieldMonitoringRosterView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  const page = Number(searchParams.get('page') || 1);
  const pageSize = Number(searchParams.get('pageSize') || 20);
  const sort = (searchParams.get('sort') || 'name_asc') as SortOption;
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value === null || value === '' || value === 'all') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const setPage = useCallback(
    (newPage: number) => {
      updateParam('page', newPage <= 1 ? null : String(newPage));
    },
    [updateParam]
  );
  // Reset roster pagination when scope toggles so a stale page index
  // from the prior tenant can't strand the user on an empty page.
  useScopePageReset(() => setPage(1));
  // Set of userIds with an in-flight location-ping request. UI shows
  // the row's Refresh button as a spinning loader while pending; cleared
  // on either the incoming WebSocket event (success) or the 20s
  // client-side timeout (fail). One row can ping concurrently with
  // others — each userId is independent.
  const [pendingPings, setPendingPings] = useState<Set<string>>(new Set());
  const search = useUnifiedSearch({
    debounceDelay: 500,
    syncWithUrl: true,
    urlParamName: 'search',
  });
  const filters = useUnifiedFilters<FieldMonitoringFilters>({
    syncWithUrl: true,
  });

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search.debouncedSearchValue,
    filters.filters.pincode,
    filters.filters.areaId,
    filters.filters.status,
    sort,
    dateFrom,
    dateTo,
    pageSize,
  ]);

  // 2026-05-13: subscribe to `field-monitoring:location-updated` WS
  // events emitted by BE when a new `locations` row INSERTs (both
  // ADMIN_PING and TASK source). On any event we invalidate the roster
  // query so the map + table reflect the new position. Additionally if
  // the userId matches a row currently in pendingPings (i.e., this
  // admin's own button click), clear that row's spinner.
  useEffect(() => {
    const unsubscribe = frontendSocketService.onFieldMonitoringLocationUpdated((payload) => {
      let wasMyPing = false;
      setPendingPings((current) => {
        if (!current.has(payload.userId)) {
          return current;
        }
        wasMyPing = true;
        const next = new Set(current);
        next.delete(payload.userId);
        return next;
      });
      // Surface a success toast only for THIS admin's own pings (not
      // for every TASK-source capture from every agent — that would
      // be a spam fire-hose at 1000 agents).
      if (wasMyPing && payload.source === 'ADMIN_PING') {
        toast.success('Fresh location received');
      }
      void queryClient.invalidateQueries({ queryKey: ['field-monitoring'] });
    });
    return () => {
      unsubscribe?.();
    };
  }, [queryClient]);

  // Trigger an FCM ping for one agent. BE sends silent FCM →
  // mobile responds → BE emits WS event → we clear pendingPings
  // and refresh the roster. If no event arrives within 20s, the
  // 20s-timeout below resolves the spinner + shows a "couldn't reach"
  // toast; the map keeps its existing last-known marker.
  const handleRefreshLocation = useCallback(
    async (userId: string) => {
      if (pendingPings.has(userId)) {
        return;
      }
      setPendingPings((current) => {
        const next = new Set(current);
        next.add(userId);
        return next;
      });

      const timeoutHandle = window.setTimeout(() => {
        setPendingPings((current) => {
          if (!current.has(userId)) {
            return current;
          }
          const next = new Set(current);
          next.delete(userId);
          return next;
        });
        toast.warning("Couldn't reach the agent — showing last known location");
      }, 20_000);

      try {
        const response = await fieldMonitoringService.requestUserLocation(userId);
        if (!response?.success) {
          window.clearTimeout(timeoutHandle);
          setPendingPings((current) => {
            const next = new Set(current);
            next.delete(userId);
            return next;
          });
          toast.error(response?.message || 'Failed to dispatch location request');
        }
      } catch (error) {
        window.clearTimeout(timeoutHandle);
        setPendingPings((current) => {
          const next = new Set(current);
          next.delete(userId);
          return next;
        });
        logger.error('requestUserLocation failed:', error);
        toast.error('Failed to dispatch location request');
      }
    },
    [pendingPings]
  );

  // 2026-05-13: bulk-refresh — fires one FCM ping per currently-visible
  // agent. Per Q4.A there's no rate-limit, but we serialize the dispatch
  // here client-side so we don't open N parallel HTTP requests for a full
  // page. One agent every ~30ms is plenty fast and stays kind to FCM quota.
  const handleBulkRefresh = useCallback(
    async (userIds: string[]) => {
      const targets = userIds.filter((id) => !pendingPings.has(id));
      if (targets.length === 0) {
        return;
      }
      toast.info(`Refreshing ${targets.length} agent${targets.length === 1 ? '' : 's'}…`);
      for (const userId of targets) {
        void handleRefreshLocation(userId);
        // Stagger to avoid spamming BE/FCM
        await new Promise((resolve) => window.setTimeout(resolve, 30));
      }
    },
    [pendingPings, handleRefreshLocation]
  );

  const {
    data: statsResponse,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['field-monitoring', 'stats'],
    queryFn: () => fieldMonitoringService.getMonitoringStats(),
    staleTime: WS_SAFETY_NET_INTERVAL,
    refetchInterval: WS_SAFETY_NET_INTERVAL,
  });

  const { data: pincodesResponse } = usePincodes({ limit: 500 });
  const { data: areasResponse } = useAreas();

  const sortOption = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];
  const commonRosterFilters = useMemo(
    () => ({
      search: search.debouncedSearchValue || undefined,
      pincode: filters.filters.pincode || undefined,
      areaId: filters.filters.areaId ? Number(filters.filters.areaId) : undefined,
      status: filters.filters.status || undefined,
      sortBy: sortOption.sortBy,
      sortOrder: sortOption.sortOrder,
      createdFrom: dateFrom || undefined,
      createdTo: dateTo || undefined,
    }),
    [
      search.debouncedSearchValue,
      filters.filters.pincode,
      filters.filters.areaId,
      filters.filters.status,
      sortOption.sortBy,
      sortOption.sortOrder,
      dateFrom,
      dateTo,
    ]
  );

  const {
    data: rosterResponse,
    isLoading: rosterLoading,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: ['field-monitoring', 'users', 'table', page, pageSize, commonRosterFilters],
    queryFn: () =>
      fieldMonitoringService.getMonitoringRoster({
        page,
        limit: pageSize,
        ...commonRosterFilters,
      }),
    staleTime: WS_SAFETY_NET_INTERVAL,
    refetchInterval: WS_SAFETY_NET_INTERVAL,
  });

  const stats = statsResponse?.data || {
    totalFieldUsers: 0,
    activeToday: 0,
    activeNow: 0,
    submissionsToday: 0,
    offlineCount: 0,
  };

  const rosterPayload = rosterResponse?.data;
  const roster = rosterPayload?.data || [];
  const pagination = rosterPayload?.pagination || {
    page,
    limit: pageSize,
    total: 0,
    totalPages: 0,
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await fieldMonitoringService.exportRoster(commonRosterFilters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `field_monitoring_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export field monitoring roster:', error);
      toast.error('Failed to export roster');
    } finally {
      setIsExporting(false);
    }
  }, [commonRosterFilters]);

  const pincodeOptions = pincodesResponse?.data || [];
  const areaOptions = areasResponse?.data || [];

  const activeFilterCount = [
    filters.filters.pincode,
    filters.filters.areaId,
    filters.filters.status,
    sort !== 'name_asc' ? sort : null,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  const handleClearFilters = useCallback(() => {
    filters.clearFilters();
    const next = new URLSearchParams(searchParams);
    ['sort', 'dateFrom', 'dateTo'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [filters, searchParams, setSearchParams]);

  const handleRefresh = () => {
    void refetchStats();
    void refetchRoster();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Field Executive Monitoring
          </h1>
          <p className="text-muted-foreground">
            Monitor field activity, territory coverage, and live operational status
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatsCard
          title="Total Field Users"
          value={stats.totalFieldUsers}
          description="Eligible field executives"
          icon={UserCheck}
          color="text-green-600"
        />
        <StatsCard
          title="Active Today"
          value={stats.activeToday}
          description="Operational activity today"
          icon={Activity}
          color="text-blue-600"
        />
        <StatsCard
          title="Active Now"
          value={stats.activeNow}
          description="Fresh activity in last 15 minutes"
          icon={Radio}
          color="text-amber-600"
        />
        <StatsCard
          title="Submissions Today"
          value={stats.submissionsToday}
          description="Form submissions today"
          icon={CheckSquare}
          color="text-purple-600"
        />
        <StatsCard
          title="Offline"
          value={stats.offlineCount}
          description="No recent operational activity"
          icon={Navigation}
          color="text-red-600"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Field Executive Roster</CardTitle>
          <CardDescription>
            Search field executives, filter by territory, and review live work status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <UnifiedSearchFilterLayout
            searchValue={search.searchValue}
            onSearchChange={search.setSearchValue}
            onSearchClear={search.clearSearch}
            isSearchLoading={search.isDebouncing}
            searchPlaceholder="Search by executive name or mobile number..."
            hasActiveFilters={activeFilterCount > 0}
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearFilters}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || rosterLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting…' : 'Export'}
              </Button>
            }
            filterContent={
              <FilterGrid columns={3}>
                <div className="space-y-2">
                  <Label htmlFor="field-monitoring-pincode">Pincode</Label>
                  <Select
                    value={filters.filters.pincode || 'all'}
                    onValueChange={(value) => {
                      filters.setFilter('pincode', value === 'all' ? undefined : value);
                    }}
                  >
                    <SelectTrigger id="field-monitoring-pincode">
                      <SelectValue placeholder="All pincodes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pincodes</SelectItem>
                      {pincodeOptions.map((pincode) => (
                        <SelectItem key={String(pincode.id)} value={pincode.code}>
                          {pincode.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-monitoring-area">Area</Label>
                  <Select
                    value={filters.filters.areaId || 'all'}
                    onValueChange={(value) => {
                      filters.setFilter('areaId', value === 'all' ? undefined : value);
                    }}
                  >
                    <SelectTrigger id="field-monitoring-area">
                      <SelectValue placeholder="All areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All areas</SelectItem>
                      {areaOptions.map((area) => (
                        <SelectItem key={String(area.id)} value={String(area.id)}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-monitoring-status">Status</Label>
                  <Select
                    value={filters.filters.status || 'all'}
                    onValueChange={(value) => {
                      filters.setFilter(
                        'status',
                        value === 'all' ? undefined : (value as FieldMonitoringLiveStatus)
                      );
                    }}
                  >
                    <SelectTrigger id="field-monitoring-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-monitoring-sort">Sort by</Label>
                  <Select
                    value={sort}
                    onValueChange={(value) =>
                      updateParam('sort', value === 'name_asc' ? null : value)
                    }
                  >
                    <SelectTrigger id="field-monitoring-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-monitoring-date-from">Date From</Label>
                  <Input
                    id="field-monitoring-date-from"
                    type="date"
                    placeholder="(YYYY-MM-DD)"
                    value={dateFrom}
                    onChange={(e) => updateParam('dateFrom', e.target.value || null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-monitoring-date-to">Date To</Label>
                  <Input
                    id="field-monitoring-date-to"
                    type="date"
                    placeholder="(YYYY-MM-DD)"
                    value={dateTo}
                    onChange={(e) => updateParam('dateTo', e.target.value || null)}
                  />
                </div>
              </FilterGrid>
            }
          />

          <div className="space-y-4">
            <div className="flex items-center justify-end">
              {roster.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={pendingPings.size > 0}
                  onClick={() => handleBulkRefresh(roster.map((u) => u.id))}
                  title={
                    pendingPings.size > 0
                      ? `${pendingPings.size} ping(s) in flight`
                      : 'Refresh all visible agents'
                  }
                >
                  <RefreshCw className={`h-4 w-4 ${pendingPings.size > 0 ? 'animate-spin' : ''}`} />
                  Refresh all visible
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {rosterLoading && !rosterResponse ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <LoadingState message="Loading field monitoring roster..." size="lg" />
                </div>
              ) : roster.length === 0 ? (
                <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-input bg-muted">
                  <p className="text-sm text-muted-foreground">
                    No field executives matched the current filters.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Live Status</TableHead>
                          <TableHead>Operating Area</TableHead>
                          <TableHead>Operating Pincode</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Last Activity Time</TableHead>
                          <TableHead>Last Location Time</TableHead>
                          <TableHead>Active Assignments</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roster.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{user.name}</div>
                                {user.currentCaseSummary && (
                                  <div className="text-xs text-muted-foreground">
                                    Case #{user.currentCaseSummary.caseNumber} ·{' '}
                                    {user.currentCaseSummary.customerName}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getMobileDisplay(user)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={statusBadgeClassNames[user.liveStatus]}
                              >
                                {user.liveStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>{user.operatingArea || '-'}</TableCell>
                            <TableCell>{user.operatingPincode || '-'}</TableCell>
                            <TableCell>
                              <ExecutiveLocationCell user={user} />
                            </TableCell>
                            <TableCell>{formatTimestamp(user.lastActivityAt)}</TableCell>
                            <TableCell>
                              {user.lastLocation?.time ? (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${
                                      user.lastLocation.freshness === 'fresh'
                                        ? 'bg-green-500'
                                        : 'bg-muted-foreground/40'
                                    }`}
                                    title={
                                      user.lastLocation.freshness === 'fresh'
                                        ? 'Fresh location'
                                        : 'Stale location'
                                    }
                                  />
                                  <div className="flex flex-col">
                                    <span>{formatTimestamp(user.lastLocation.time)}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatRelativeTime(user.lastLocation.time)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                getLastLocationDisplayTime(user)
                              )}
                            </TableCell>
                            <TableCell>{user.activeAssignmentCount}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  disabled={pendingPings.has(user.id)}
                                  title="Ping device for current location"
                                  onClick={() => handleRefreshLocation(user.id)}
                                >
                                  <RefreshCw
                                    className={`h-4 w-4 ${pendingPings.has(user.id) ? 'animate-spin' : ''}`}
                                  />
                                  {pendingPings.has(user.id) ? 'Locating…' : 'Refresh'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() =>
                                    navigate(`/operations/field-monitoring/${user.id}`)
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="text-sm text-muted-foreground">
                      {pagination.total > 0
                        ? `Showing ${roster.length} of ${pagination.total} field executives`
                        : 'No field executives to show'}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="field-monitoring-page-size">Rows</Label>
                        <Select
                          value={String(pageSize)}
                          onValueChange={(value) =>
                            updateParam('pageSize', value === '20' ? null : value)
                          }
                        >
                          <SelectTrigger id="field-monitoring-page-size" className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <SelectItem key={size} value={String(size)}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {statsLoading && !statsResponse && (
        <div className="sr-only" aria-live="polite">
          Loading field monitoring stats
        </div>
      )}
    </div>
  );
}

export function FieldMonitoringPage() {
  const { userId } = useParams<{ userId?: string }>();

  if (userId) {
    return <FieldMonitoringDetailView userId={userId} />;
  }

  return <FieldMonitoringRosterView />;
}
