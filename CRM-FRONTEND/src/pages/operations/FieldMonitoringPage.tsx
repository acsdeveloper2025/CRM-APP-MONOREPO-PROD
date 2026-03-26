import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Eye,
  Navigation,
  Radio,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { useAreas } from '@/hooks/useAreas';
import { usePincodes } from '@/hooks/useLocations';
import { GoogleMarkerMap, type GoogleMarkerMapItem } from '@/components/maps/GoogleMarkerMap';
import {
  fieldMonitoringService,
  type FieldMonitoringLiveStatus,
  type FieldMonitoringRosterItem,
} from '@/services/fieldMonitoring';

const REFRESH_INTERVAL = 60_000; // 60s refresh for 1000+ field users (was 30s)
const PAGE_SIZE = 20;
const MAP_PAGE_SIZE = 200; // Reduced from 500 for better map performance at scale
const STATUS_OPTIONS: FieldMonitoringLiveStatus[] = [
  'Idle',
  'Travelling',
  'At Location',
  'Submitted',
  'Offline',
];

type FieldMonitoringFilters = {
  pincode?: string;
  areaId?: string;
  status?: FieldMonitoringLiveStatus;
};

const statusBadgeClassNames: Record<FieldMonitoringLiveStatus, string> = {
  Idle: 'bg-slate-100 text-slate-700 border-slate-200',
  Travelling: 'bg-amber-100 text-amber-700 border-amber-200',
  'At Location': 'bg-green-100 text-green-700 border-green-200',
  Submitted: 'bg-purple-100 text-purple-700 border-purple-200',
  Offline: 'bg-gray-100 text-gray-700 border-gray-200',
};

const markerColors: Record<FieldMonitoringLiveStatus, string> = {
  Offline: '#6b7280',
  Idle: '#2563eb',
  Travelling: '#f59e0b',
  'At Location': '#16a34a',
  Submitted: '#9333ea',
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

const getMobileDisplay = (user: Pick<FieldMonitoringRosterItem, 'phone' | 'employeeId' | 'username'>): string => {
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

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const createMarkerInfoWindowContent = (user: FieldMonitoringRosterItem): string => {
  const infoRows = [
    ['Mobile', getMobileDisplay(user)],
    ['Live Status', user.liveStatus],
    ['Operating Pincode', user.operatingPincode || '-'],
    ['Last Activity', formatTimestamp(user.lastActivityAt)],
    ['Last Location', getLastLocationDisplayTime(user)],
  ]
    .map(
      ([label, value]) =>
        `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;line-height:18px;">
          <span style="color:#6b7280;">${escapeHtml(label)}</span>
          <span style="color:#111827;font-weight:500;text-align:right;">${escapeHtml(value)}</span>
        </div>`
    )
    .join('');

  return `
    <div style="min-width:220px;padding:4px 2px;font-family:inherit;">
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">${escapeHtml(user.name)}</div>
      ${infoRows}
    </div>
  `;
};

function FieldMonitoringDetailView({ userId }: { userId: string }) {
  const navigate = useNavigate();

  const { data: detailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['field-monitoring', 'user-detail', userId],
    queryFn: () => fieldMonitoringService.getUserMonitoringDetail(userId),
    staleTime: REFRESH_INTERVAL,
    refetchInterval: REFRESH_INTERVAL,
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Field Executive Detail</h1>
            <p className="text-gray-600">Current operational snapshot and recent field activity</p>
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
            <p className="text-sm text-gray-600">No monitoring detail available for this user.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{detail.user.name}</h2>
                  <p className="text-sm text-gray-600">
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
              <CardContent className="space-y-2 text-sm text-gray-700">
                <p>Latitude: {detail.lastKnownLocation?.lat ?? '-'}</p>
                <p>Longitude: {detail.lastKnownLocation?.lng ?? '-'}</p>
                <p>
                  Recorded At:{' '}
                  {formatTimestamp(detail.lastKnownLocation?.recordedAt || detail.activity.lastHeartbeatAt)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-700">
                <p>Last Heartbeat: {formatTimestamp(detail.activity.lastHeartbeatAt)}</p>
                <p>Last Task Activity: {formatTimestamp(detail.activity.lastTaskActivityAt)}</p>
                <p>
                  Last Location:{' '}
                  {formatTimestamp(detail.activity.lastLocationAt || detail.activity.lastHeartbeatAt)}
                </p>
                <p>Last Submission: {formatTimestamp(detail.activity.lastSubmissionAt)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operating Territory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-700">
                <p>Current Area: {detail.operatingTerritory.currentArea.name || '-'}</p>
                <p>Current Pincode: {detail.operatingTerritory.currentOperatingPincode || '-'}</p>
                <p>
                  Assigned Areas:{' '}
                  {detail.operatingTerritory.assignedTerritory.areas.length > 0
                    ? detail.operatingTerritory.assignedTerritory.areas
                        .map(area => `${area.areaName} (${area.pincodeCode})`)
                        .join(', ')
                    : '-'}
                </p>
                <p>
                  Assigned Pincodes:{' '}
                  {detail.operatingTerritory.assignedTerritory.pincodes.length > 0
                    ? detail.operatingTerritory.assignedTerritory.pincodes
                        .map(pincode => pincode.pincodeCode)
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
                  <p className="text-sm text-gray-600">No open assignments.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.openAssignments.map(assignment => (
                      <div
                        key={assignment.task.id}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              Task {assignment.task.taskNumber}
                            </p>
                            <p className="text-sm text-gray-600">
                              Case #{assignment.case.caseNumber} · {assignment.case.customerName}
                            </p>
                          </div>
                          <Badge variant="outline">{assignment.task.status}</Badge>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
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
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState<'table' | 'map'>('table');
  const search = useUnifiedSearch({
    debounceDelay: 500,
    syncWithUrl: true,
    urlParamName: 'search',
  });
  const filters = useUnifiedFilters<FieldMonitoringFilters>({
    syncWithUrl: true,
  });

  useEffect(() => {
    setPage(1);
  }, [
    search.debouncedSearchValue,
    filters.filters.pincode,
    filters.filters.areaId,
    filters.filters.status,
  ]);

  const {
    data: statsResponse,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['field-monitoring', 'stats'],
    queryFn: () => fieldMonitoringService.getMonitoringStats(),
    staleTime: REFRESH_INTERVAL,
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: pincodesResponse } = usePincodes({ limit: 500 });
  const { data: areasResponse } = useAreas();

  const commonRosterFilters = {
    search: search.debouncedSearchValue || undefined,
    pincode: filters.filters.pincode || undefined,
    areaId: filters.filters.areaId ? Number(filters.filters.areaId) : undefined,
    status: filters.filters.status || undefined,
  };

  const {
    data: rosterResponse,
    isLoading: rosterLoading,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: ['field-monitoring', 'users', 'table', page, PAGE_SIZE, commonRosterFilters],
    queryFn: () =>
      fieldMonitoringService.getMonitoringRoster({
        page,
        limit: PAGE_SIZE,
        ...commonRosterFilters,
      }),
    staleTime: REFRESH_INTERVAL,
    refetchInterval: REFRESH_INTERVAL,
    enabled: activeView === 'table',
  });

  const {
    data: mapRosterResponse,
    isLoading: mapRosterLoading,
    refetch: refetchMapRoster,
  } = useQuery({
    queryKey: ['field-monitoring', 'users', 'map', MAP_PAGE_SIZE, commonRosterFilters],
    queryFn: () =>
      fieldMonitoringService.getMonitoringRoster({
        page: 1,
        limit: MAP_PAGE_SIZE,
        ...commonRosterFilters,
      }),
    staleTime: REFRESH_INTERVAL,
    refetchInterval: activeView === 'map' ? REFRESH_INTERVAL : false,
    enabled: activeView === 'map',
  });

  const stats = statsResponse?.data || {
    totalFieldUsers: 0,
    activeToday: 0,
    activeNow: 0,
    offlineCount: 0,
  };

  const rosterPayload = rosterResponse?.data;
  const roster = rosterPayload?.data || [];
  const pagination = rosterPayload?.pagination || {
    page,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  };

  const mapRoster = useMemo(() => mapRosterResponse?.data?.data || [], [mapRosterResponse]);
  const mapMarkers = useMemo<GoogleMarkerMapItem[]>(
    () =>
      mapRoster
        .filter(
          user =>
            typeof user.lastLocation?.lat === 'number' &&
            typeof user.lastLocation?.lng === 'number'
        )
        .map(user => ({
          id: user.id,
          title: user.name,
          lat: user.lastLocation?.lat as number,
          lng: user.lastLocation?.lng as number,
          color: markerColors[user.liveStatus],
          infoHtml: createMarkerInfoWindowContent(user),
        })),
    [mapRoster]
  );

  const pincodeOptions = pincodesResponse?.data || [];
  const areaOptions = areasResponse?.data || [];

  const activeFilterCount = [
    filters.filters.pincode,
    filters.filters.areaId,
    filters.filters.status,
  ].filter(Boolean).length;

  const handleRefresh = () => {
    void refetchStats();
    if (activeView === 'map') {
      void refetchMapRoster();
      return;
    }
    void refetchRoster();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Field Executive Monitoring
          </h1>
          <p className="text-gray-600">
            Monitor field activity, territory coverage, and live operational status
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          title="Offline"
          value={stats.offlineCount}
          description="No recent heartbeat"
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
            onClearFilters={filters.clearFilters}
            filterContent={
              <FilterGrid columns={3}>
                <div className="space-y-2">
                  <Label htmlFor="field-monitoring-pincode">Pincode</Label>
                  <Select
                    value={filters.filters.pincode || 'all'}
                    onValueChange={value => {
                      filters.setFilter('pincode', value === 'all' ? undefined : value);
                    }}
                  >
                    <SelectTrigger id="field-monitoring-pincode">
                      <SelectValue placeholder="All pincodes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pincodes</SelectItem>
                      {pincodeOptions.map(pincode => (
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
                    onValueChange={value => {
                      filters.setFilter('areaId', value === 'all' ? undefined : value);
                    }}
                  >
                    <SelectTrigger id="field-monitoring-area">
                      <SelectValue placeholder="All areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All areas</SelectItem>
                      {areaOptions.map(area => (
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
                    onValueChange={value => {
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
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FilterGrid>
            }
          />

          <Tabs
            value={activeView}
            onValueChange={value => setActiveView(value as 'table' | 'map')}
            className="space-y-4"
          >
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="map">Map View</TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="space-y-4">
              {rosterLoading && !rosterResponse ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <LoadingState message="Loading field monitoring roster..." size="lg" />
                </div>
              ) : roster.length === 0 ? (
                <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                  <p className="text-sm text-gray-600">
                    No field executives matched the current filters.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Live Status</TableHead>
                          <TableHead>Operating Area</TableHead>
                          <TableHead>Operating Pincode</TableHead>
                          <TableHead>Last Activity Time</TableHead>
                          <TableHead>Last Location Time</TableHead>
                          <TableHead>Active Assignments</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roster.map(user => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{user.name}</div>
                                {user.currentCaseSummary && (
                                  <div className="text-xs text-gray-500">
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
                            <TableCell>{formatTimestamp(user.lastActivityAt)}</TableCell>
                            <TableCell>{getLastLocationDisplayTime(user)}</TableCell>
                            <TableCell>{user.activeAssignmentCount}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => navigate(`/operations/field-monitoring/${user.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">
                      Showing {roster.length} of {pagination.total} field executives
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(current => Math.max(1, current - 1))}
                        disabled={page <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(current => current + 1)}
                        disabled={page >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="map" className="space-y-4">
              {mapRosterLoading && !mapRosterResponse ? (
                <div className="flex min-h-[520px] items-center justify-center">
                  <LoadingState message="Loading field locations..." size="lg" />
                </div>
              ) : (
                <GoogleMarkerMap
                  items={mapMarkers}
                  emptyTitle="No mappable field executives"
                  emptyDescription="No valid last known coordinates available for the current filters."
                  markerSummary={`Showing ${mapMarkers.length} field executives with valid last known coordinates.`}
                />
              )}
            </TabsContent>
          </Tabs>
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
