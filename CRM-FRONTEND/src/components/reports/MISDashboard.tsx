import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MISSummaryCards } from './MISSummaryCards';
import { MISDataTable } from './MISDataTable';
import { reportsService } from '@/services/reports';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/components/ui/unified-search-filter-layout';
import type { MISFilters, MISDataResponse } from '@/types/mis';
import { toast } from 'react-hot-toast';
import type { VerificationType } from '@/types/client';
import { USER_ROLES } from '@/types/constants';
import { useClients, useProducts } from '@/hooks/useClients';
import { useVerificationTypes } from '@/hooks/useVerificationTypes';
import { useUsers } from '@/hooks/useUsers';
import { LoadingState } from '@/components/ui/loading';

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
  // Unified search with 800ms debounce
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Unified filters with URL sync
  const {
    filters: activeFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useUnifiedFilters<MISFilterValues>({
    syncWithUrl: true,
    initialFilters: {
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dateTo: new Date().toISOString().split('T')[0],
    },
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
  });

  const [data, setData] = useState<MISDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Load dropdown data (backend max limit is 100)
  const { data: clientsData } = useClients({ page: 1, limit: 100 });
  const { data: productsData } = useProducts({ page: 1, limit: 100 });
  const { data: verificationTypesData } = useVerificationTypes({ page: 1, limit: 100 });
  const { data: usersData } = useUsers({ page: 1, limit: 100 });

  const clients = clientsData?.data || [];
  const products = productsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];
  const users = usersData || [];
  const fieldAgents = users.filter(u => u.role === USER_ROLES.FIELD_AGENT);
  const backendUsers = users.filter(u => u.role === USER_ROLES.BACKEND_USER || u.role === USER_ROLES.ADMIN || u.role === USER_ROLES.SUPER_ADMIN);

  // Build query with search and filters
  const buildFilters = useCallback((): MISFilters => {
    return {
      search: debouncedSearchValue || undefined,
      dateFrom: activeFilters.dateFrom,
      dateTo: activeFilters.dateTo,
      clientId: activeFilters.clientId ? parseInt(activeFilters.clientId) : undefined,
      productId: activeFilters.productId ? parseInt(activeFilters.productId) : undefined,
      verificationTypeId: activeFilters.verificationTypeId ? parseInt(activeFilters.verificationTypeId) : undefined,
      caseStatus: activeFilters.caseStatus as MISFilters['caseStatus'],
      priority: activeFilters.priority as MISFilters['priority'],
      fieldAgentId: activeFilters.fieldAgentId,
      backendUserId: activeFilters.backendUserId,
      page: pagination.page,
      limit: pagination.limit,
    };
  }, [debouncedSearchValue, activeFilters, pagination]);



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

  const handlePageChange = (page: number) => {
    setPagination({ ...pagination, page });
  };

  const handleExport = async (format: 'EXCEL' | 'CSV') => {
    setIsExporting(true);
    try {
      const blob = await reportsService.exportMISDashboardData(buildFilters(), format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MIS_Report_${new Date().toISOString().split('T')[0]}.${format === 'EXCEL' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`MIS data exported successfully as ${format}`);
    } catch (error) {
      console.error('Failed to export MIS data:', error);
      toast.error('Failed to export MIS data');
    } finally {
      setIsExporting(false);
    }
  };

  // Count active filters (excluding dateFrom and dateTo which are default)
  const activeFilterCount = Object.keys(activeFilters).filter(
    key => key !== 'dateFrom' && key !== 'dateTo' && activeFilters[key as keyof MISFilterValues] !== undefined
  ).length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">MIS Dashboard</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Comprehensive Management Information System with case and task details
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <MISSummaryCards summary={data.summary} isLoading={isLoading} />
      )}

      {/* Unified Search and Filter Layout */}
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
            {/* Date From Filter */}
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={activeFilters.dateFrom || ''}
                onChange={(e) => setFilter('dateFrom', e.target.value || undefined)}
              />
            </div>

            {/* Date To Filter */}
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={activeFilters.dateTo || ''}
                onChange={(e) => setFilter('dateTo', e.target.value || undefined)}
              />
            </div>

            {/* Client Filter */}
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select
                value={activeFilters.clientId || 'all'}
                onValueChange={(value) => setFilter('clientId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Filter */}
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={activeFilters.productId || 'all'}
                onValueChange={(value) => setFilter('productId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Verification Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="verificationType">Verification Type</Label>
              <Select
                value={activeFilters.verificationTypeId || 'all'}
                onValueChange={(value) => setFilter('verificationTypeId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="verificationType">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {verificationTypes.map((type: VerificationType) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="caseStatus">Task Status</Label>
              <Select
                value={activeFilters.caseStatus || 'all'}
                onValueChange={(value) => setFilter('caseStatus', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="caseStatus">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={activeFilters.priority || 'all'}
                onValueChange={(value) => setFilter('priority', value === 'all' ? undefined : value)}
              >
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

            {/* Field Agent Filter */}
            <div className="space-y-2">
              <Label htmlFor="fieldAgent">Field Agent</Label>
              <Select
                value={activeFilters.fieldAgentId || 'all'}
                onValueChange={(value) => setFilter('fieldAgentId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="fieldAgent">
                  <SelectValue placeholder="All field agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Field Agents</SelectItem>
                  {fieldAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Backend User Filter */}
            <div className="space-y-2">
              <Label htmlFor="backendUser">Backend User</Label>
              <Select
                value={activeFilters.backendUserId || 'all'}
                onValueChange={(value) => setFilter('backendUserId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="backendUser">
                  <SelectValue placeholder="All backend users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Backend Users</SelectItem>
                  {backendUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FilterGrid>
        }
        actions={
          <>
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('EXCEL')}
              disabled={isExporting || !data || !data.data || data.data.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('CSV')}
              disabled={isExporting || !data || !data.data || data.data.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </>
        }
      />

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>MIS Data</CardTitle>
          <CardDescription>
            {data?.pagination ? (
              <>
                Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
                {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
                {data.pagination.total} records
              </>
            ) : (
              'Loading data...'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.data && data.data.length > 0 ? (
            <MISDataTable
              data={data.data}
              pagination={data.pagination}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          ) : !isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                No data available. Please adjust your filters and try again.
              </p>
            </div>
          ) : (
            <LoadingState message="Generating report..." size="lg" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

