import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, RefreshCw, Table2 } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { GoogleMarkerMap, type GoogleMarkerMapItem } from '@/components/maps/GoogleMarkerMap';
import { FieldMonitoringDetailCards } from '@/components/operations/FieldMonitoringDetailCards';
import { FieldMonitoringRosterTable } from '@/components/operations/FieldMonitoringRosterTable';
import { FieldMonitoringSummaryCards } from '@/components/operations/FieldMonitoringSummaryCards';
import { LoadingState } from '@/ui/components/Loading';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/ui/components/UnifiedSearchFilterLayout';
import { Label } from '@/ui/components/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import { useUnifiedFilters, useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { useAreas } from '@/hooks/useAreas';
import { usePincodes } from '@/hooks/useLocations';
import {
  fieldMonitoringService,
  type FieldMonitoringLiveStatus,
  type FieldMonitoringRosterItem,
} from '@/services/fieldMonitoring';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

const REFRESH_INTERVAL = 30_000;
const PAGE_SIZE = 20;
const MAP_PAGE_SIZE = 500;
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

function ViewToggle({
  activeView,
  onChange,
}: {
  activeView: 'table' | 'map';
  onChange: (value: 'table' | 'map') => void;
}) {
  return (
    <Stack direction="horizontal" gap={2}>
      <Button
        variant={activeView === 'table' ? 'primary' : 'secondary'}
        icon={<Table2 size={16} />}
        onClick={() => onChange('table')}
      >
        Table View
      </Button>
      <Button
        variant={activeView === 'map' ? 'primary' : 'secondary'}
        icon={<MapPin size={16} />}
        onClick={() => onChange('map')}
      >
        Map View
      </Button>
    </Stack>
  );
}

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
    <Page
      shell
      title="Field Executive Detail"
      subtitle="Current operational snapshot and recent field activity."
      actions={
        <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/operations/field-monitoring')}>
          Back
        </Button>
      }
    >
      <Section>
        {detailLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <LoadingState message="Loading executive details..." size="lg" />
          </div>
        ) : !detail ? (
          <Card staticCard>
            <div className="flex min-h-[240px] items-center justify-center">
              <Text variant="body-sm" tone="muted">No monitoring detail available for this user.</Text>
            </div>
          </Card>
        ) : (
          <FieldMonitoringDetailCards
            detail={detail}
            formatTimestamp={formatTimestamp}
            getMobileDisplay={getMobileDisplay}
            statusBadgeClassNames={statusBadgeClassNames}
          />
        )}
      </Section>
    </Page>
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
  }, [search.debouncedSearchValue, filters.filters.pincode, filters.filters.areaId, filters.filters.status]);

  const {
    data: statsResponse,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['field-monitoring', 'stats'],
    queryFn: () => fieldMonitoringService.getMonitoringStats(),
    staleTime: REFRESH_INTERVAL,
    refetchInterval: REFRESH_INTERVAL,
    placeholderData: keepPreviousData,
  });

  const { data: pincodesResponse } = usePincodes({ limit: 500 });
  const { data: areasResponse } = useAreas();

  const commonRosterFilters = useMemo(
    () => ({
      search: search.debouncedSearchValue || undefined,
      pincode: filters.filters.pincode || undefined,
      areaId: filters.filters.areaId ? Number(filters.filters.areaId) : undefined,
      status: filters.filters.status || undefined,
    }),
    [filters.filters.areaId, filters.filters.pincode, filters.filters.status, search.debouncedSearchValue]
  );

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
    refetchInterval: activeView === 'table' ? REFRESH_INTERVAL : false,
    enabled: activeView === 'table',
    placeholderData: keepPreviousData,
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
    placeholderData: keepPreviousData,
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
          (user) =>
            typeof user.lastLocation?.lat === 'number' &&
            typeof user.lastLocation?.lng === 'number'
        )
        .map((user) => ({
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

  const activeFilterCount = [filters.filters.pincode, filters.filters.areaId, filters.filters.status].filter(Boolean).length;

  const handleRefresh = () => {
    void refetchStats();
    if (activeView === 'map') {
      void refetchMapRoster();
      return;
    }
    void refetchRoster();
  };

  return (
    <Page
      shell
      title="Field Executive Monitoring"
      subtitle="Monitor field activity, territory coverage, and live operational status."
      actions={
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={handleRefresh}>
          Refresh
        </Button>
      }
    >
      <Section>
        <FieldMonitoringSummaryCards stats={stats} />
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={4}>
            <Stack gap={1}>
              <Text as="h2" variant="headline">Field executive roster</Text>
              <Text variant="body-sm" tone="muted">
                Search field executives, filter by territory, and review live work status.
              </Text>
            </Stack>

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
                        filters.setFilter('status', value === 'all' ? undefined : (value as FieldMonitoringLiveStatus));
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
                </FilterGrid>
              }
              actions={<ViewToggle activeView={activeView} onChange={setActiveView} />}
            />

            {activeView === 'table' ? (
              rosterLoading && !rosterResponse ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <LoadingState message="Loading field monitoring roster..." size="lg" />
                </div>
              ) : roster.length === 0 ? (
                <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                  <p className="text-sm text-gray-600">No field executives matched the current filters.</p>
                </div>
              ) : (
                <Stack gap={4}>
                  <FieldMonitoringRosterTable
                    roster={roster}
                    onView={(userId) => navigate(`/operations/field-monitoring/${userId}`)}
                    formatTimestamp={formatTimestamp}
                    getLastLocationDisplayTime={getLastLocationDisplayTime}
                    getMobileDisplay={getMobileDisplay}
                    statusBadgeClassNames={statusBadgeClassNames}
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Text variant="body-sm" tone="muted">
                      Showing {roster.length} of {pagination.total} field executives
                    </Text>
                    <Stack direction="horizontal" gap={2} align="center">
                      <Button
                        variant="secondary"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1}
                      >
                        Previous
                      </Button>
                      <Text variant="body-sm" tone="muted">
                        Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
                      </Text>
                      <Button
                        variant="secondary"
                        onClick={() => setPage((current) => current + 1)}
                        disabled={page >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </Stack>
                  </div>
                </Stack>
              )
            ) : mapRosterLoading && !mapRosterResponse ? (
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
          </Stack>
        </Card>
      </Section>

      {statsLoading && !statsResponse ? (
        <div className="sr-only" aria-live="polite">
          Loading field monitoring stats
        </div>
      ) : null}
    </Page>
  );
}

export function FieldMonitoringPage() {
  const { userId } = useParams<{ userId?: string }>();

  if (userId) {
    return <FieldMonitoringDetailView userId={userId} />;
  }

  return <FieldMonitoringRosterView />;
}
