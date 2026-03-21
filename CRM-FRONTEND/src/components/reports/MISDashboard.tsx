import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { reportsService } from '@/services/reports';
import { useUnifiedFilters, useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { useClients, useProducts } from '@/hooks/useClients';
import { useVerificationTypes } from '@/hooks/useVerificationTypes';
import { useUsers } from '@/hooks/useUsers';
import { isBackendScopedUser, isFieldAgentUser } from '@/utils/userPermissionProfiles';
import type { MISDataResponse, MISFilters } from '@/types/mis';
import type { VerificationType } from '@/types/client';
import { Button } from '@/ui/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Input } from '@/ui/components/Input';
import { Label } from '@/ui/components/Label';
import { LoadingState } from '@/ui/components/Loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/Select';
import { FilterGrid, UnifiedSearchFilterLayout } from '@/ui/components/UnifiedSearchFilterLayout';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { MISDataTable } from './MISDataTable';
import { MISSummaryCards } from './MISSummaryCards';

interface MISFilterValues {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  productId?: string;
  verificationTypeId?: string;
  caseStatus?: string;
  priority?: string;
  fieldAgentId?: string;
  backendUserId?: string;
  [key: string]: string | undefined;
}

export function MISDashboard() {
  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } = useUnifiedSearch({ syncWithUrl: true });
  const { filters: activeFilters, setFilter, clearFilters, hasActiveFilters } = useUnifiedFilters<MISFilterValues>({
    syncWithUrl: true,
    initialFilters: {
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dateTo: new Date().toISOString().split('T')[0],
    },
  });

  const [pagination, setPagination] = useState({ page: 1, limit: 50 });
  const [data, setData] = useState<MISDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: clientsData } = useClients({ page: 1, limit: 100 });
  const { data: productsData } = useProducts({ page: 1, limit: 100 });
  const { data: verificationTypesData } = useVerificationTypes({ page: 1, limit: 100 });
  const { data: usersData } = useUsers({ page: 1, limit: 100 });

  const clients = clientsData?.data || [];
  const products = productsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];
  const users = usersData || [];
  const fieldAgents = users.filter((user) => isFieldAgentUser(user));
  const backendUsers = users.filter((user) => isBackendScopedUser(user));

  const buildFilters = useCallback((): MISFilters => ({
    search: debouncedSearchValue || undefined,
    dateFrom: activeFilters.dateFrom,
    dateTo: activeFilters.dateTo,
    clientId: activeFilters.clientId ? parseInt(activeFilters.clientId, 10) : undefined,
    productId: activeFilters.productId ? parseInt(activeFilters.productId, 10) : undefined,
    verificationTypeId: activeFilters.verificationTypeId ? parseInt(activeFilters.verificationTypeId, 10) : undefined,
    caseStatus: activeFilters.caseStatus as MISFilters['caseStatus'],
    priority: activeFilters.priority as MISFilters['priority'],
    fieldAgentId: activeFilters.fieldAgentId,
    backendUserId: activeFilters.backendUserId,
    page: pagination.page,
    limit: pagination.limit,
  }), [activeFilters, debouncedSearchValue, pagination]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await reportsService.getMISDashboardData(buildFilters());
      setData(response);
    } catch (error) {
      console.error('Failed to load MIS data:', error);
      toast.error('Failed to load MIS data');
    } finally {
      setIsLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async (format: 'EXCEL' | 'CSV') => {
    setIsExporting(true);
    try {
      const blob = await reportsService.exportMISDashboardData(buildFilters(), format);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `MIS_Report_${new Date().toISOString().split('T')[0]}.${format === 'EXCEL' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
      toast.success(`MIS data exported successfully as ${format}`);
    } catch (error) {
      console.error('Failed to export MIS data:', error);
      toast.error('Failed to export MIS data');
    } finally {
      setIsExporting(false);
    }
  };

  const activeFilterCount = Object.keys(activeFilters).filter(
    (key) => key !== 'dateFrom' && key !== 'dateTo' && activeFilters[key as keyof MISFilterValues] !== undefined,
  ).length;

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Text as="h2" variant="headline">MIS Dashboard</Text>
        <Text variant="body-sm" tone="muted">
          Comprehensive Management Information System with case and task details.
        </Text>
      </Stack>

      {data ? <MISSummaryCards summary={data.summary} isLoading={isLoading} /> : null}

      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search by case number, customer name, or phone..."
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        filterContent={
          <FilterGrid columns={4}>
            <Stack gap={2}>
              <Label htmlFor="dateFrom">Date From</Label>
              <Input id="dateFrom" type="date" value={activeFilters.dateFrom || ''} onChange={(e) => setFilter('dateFrom', e.target.value || undefined)} />
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="dateTo">Date To</Label>
              <Input id="dateTo" type="date" value={activeFilters.dateTo || ''} onChange={(e) => setFilter('dateTo', e.target.value || undefined)} />
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="client">Client</Label>
              <Select value={activeFilters.clientId || 'all'} onValueChange={(value) => setFilter('clientId', value === 'all' ? undefined : value)}>
                <SelectTrigger id="client"><SelectValue placeholder="All clients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="product">Product</Label>
              <Select value={activeFilters.productId || 'all'} onValueChange={(value) => setFilter('productId', value === 'all' ? undefined : value)}>
                <SelectTrigger id="product"><SelectValue placeholder="All products" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((product) => <SelectItem key={product.id} value={product.id.toString()}>{product.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="verificationType">Verification Type</Label>
              <Select value={activeFilters.verificationTypeId || 'all'} onValueChange={(value) => setFilter('verificationTypeId', value === 'all' ? undefined : value)}>
                <SelectTrigger id="verificationType"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {verificationTypes.map((type: VerificationType) => <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="caseStatus">Task Status</Label>
              <Select value={activeFilters.caseStatus || 'all'} onValueChange={(value) => setFilter('caseStatus', value === 'all' ? undefined : value)}>
                <SelectTrigger id="caseStatus"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="REVOKED">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="priority">Priority</Label>
              <Select value={activeFilters.priority || 'all'} onValueChange={(value) => setFilter('priority', value === 'all' ? undefined : value)}>
                <SelectTrigger id="priority"><SelectValue placeholder="All priorities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="fieldAgent">Field Agent</Label>
              <Select value={activeFilters.fieldAgentId || 'all'} onValueChange={(value) => setFilter('fieldAgentId', value === 'all' ? undefined : value)}>
                <SelectTrigger id="fieldAgent"><SelectValue placeholder="All field agents" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Field Agents</SelectItem>
                  {fieldAgents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name} ({agent.employeeId})</SelectItem>)}
                </SelectContent>
              </Select>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="backendUser">Backend User</Label>
              <Select value={activeFilters.backendUserId || 'all'} onValueChange={(value) => setFilter('backendUserId', value === 'all' ? undefined : value)}>
                <SelectTrigger id="backendUser"><SelectValue placeholder="All backend users" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Backend Users</SelectItem>
                  {backendUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} ({user.employeeId})</SelectItem>)}
                </SelectContent>
              </Select>
            </Stack>
          </FilterGrid>
        }
        actions={
          <>
            <Button variant="outline" onClick={loadData} disabled={isLoading} icon={<RefreshCw size={16} style={isLoading ? { animation: 'spin 1s linear infinite' } : undefined} />}>
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('EXCEL')}
              disabled={isExporting || !data || !data.data || data.data.length === 0}
              icon={<Download size={16} />}
            >
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('CSV')}
              disabled={isExporting || !data || !data.data || data.data.length === 0}
              icon={<Download size={16} />}
            >
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>MIS Data</CardTitle>
          <CardDescription>
            {data?.pagination
              ? `Showing ${((data.pagination.page - 1) * data.pagination.limit) + 1} to ${Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of ${data.pagination.total} records`
              : 'Loading data...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.data && data.data.length > 0 ? (
            <MISDataTable
              data={data.data}
              pagination={data.pagination}
              onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
              isLoading={isLoading}
            />
          ) : !isLoading ? (
            <Stack gap={2} align="center" style={{ textAlign: 'center', padding: '2rem 0' }}>
              <Text tone="muted">No data available. Please adjust your filters and try again.</Text>
            </Stack>
          ) : (
            <LoadingState message="Generating report..." size="lg" />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
