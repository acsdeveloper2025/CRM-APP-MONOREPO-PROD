import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { apiService } from '@/services/api';

interface DataEntryDashboardRow {
  id: string;
  caseId: number;
  customerName: string;
  caseStatus: string;
  clientName: string;
  productName: string;
  totalTasks: number;
  completedTasks: number;
  dataEntryInstances: number;
  dataEntryCompleted: number;
  dataEntryLastUpdated: string | null;
  dataEntryStatus: 'not_started' | 'in_progress' | 'completed';
  createdAt: string;
}

interface DashboardResponse {
  data: DataEntryDashboardRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  /* eslint-disable camelcase -- keys match the backend's SQL CASE alias */
  not_started: { label: 'Not Started', className: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800' },
  /* eslint-enable camelcase */
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
};

export function DataEntryDashboardPage() {
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({ syncWithUrl: true });

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue, statusFilter]);

  const { data: dashboardRes, isLoading } = useQuery({
    queryKey: ['data-entry-dashboard', debouncedSearchValue, statusFilter, currentPage, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: pageSize,
      };
      if (debouncedSearchValue) {
        params.search = debouncedSearchValue;
      }
      if (statusFilter !== 'all') {
        params.dataEntryStatus = statusFilter;
      }
      const res = await apiService.get<DashboardResponse>('/case-data-entries/dashboard', params);
      return res;
    },
  });

  const rows: DataEntryDashboardRow[] = useMemo(() => {
    const raw = dashboardRes?.data;
    if (!raw) {
      return [];
    }
    if (typeof raw === 'object' && 'data' in (raw as Record<string, unknown>)) {
      return (raw as DashboardResponse).data ?? [];
    }
    return [];
  }, [dashboardRes]);

  const pagination = useMemo(() => {
    const raw = dashboardRes?.data;
    if (raw && typeof raw === 'object' && 'pagination' in (raw as Record<string, unknown>)) {
      return (raw as DashboardResponse).pagination;
    }
    return { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  }, [dashboardRes, pageSize]);

  // Stats — derived from the current page. For a true count, the backend
  // could expose /stats, but for MVP the page-local counts suffice.
  const notStarted = rows.filter((r) => r.dataEntryStatus === 'not_started').length;
  const inProgress = rows.filter((r) => r.dataEntryStatus === 'in_progress').length;
  const completed = rows.filter((r) => r.dataEntryStatus === 'completed').length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Entry Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Track data entry progress across all cases
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card
          className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
            statusFilter === 'not_started' ? 'ring-2 ring-gray-400' : ''
          }`}
          onClick={() => setStatusFilter(statusFilter === 'not_started' ? 'all' : 'not_started')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Started</CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{notStarted}</div>
          </CardContent>
        </Card>
        <Card
          className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
            statusFilter === 'in_progress' ? 'ring-2 ring-yellow-400' : ''
          }`}
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{inProgress}</div>
          </CardContent>
        </Card>
        <Card
          className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
            statusFilter === 'completed' ? 'ring-2 ring-green-400' : ''
          }`}
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + filter */}
      <UnifiedSearchFilterLayout
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearchClear={clearSearch}
        isSearchLoading={isDebouncing}
        searchPlaceholder="Search by customer name, case ID, client, or product..."
        filterContent={
          <div className="flex gap-3">
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Data Entry Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        hasActiveFilters={statusFilter !== 'all'}
        activeFilterCount={statusFilter !== 'all' ? 1 : 0}
        onClearFilters={() => setStatusFilter('all')}
      />

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {debouncedSearchValue || statusFilter !== 'all'
                ? 'No cases match your filters'
                : 'No cases found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead>Case Status</TableHead>
                      <TableHead>Data Entry</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const de = STATUS_LABELS[r.dataEntryStatus] ?? STATUS_LABELS.not_started;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.caseId}</TableCell>
                          <TableCell>{r.customerName}</TableCell>
                          <TableCell>{r.clientName}</TableCell>
                          <TableCell>{r.productName}</TableCell>
                          <TableCell>
                            <span
                              className={
                                r.completedTasks === r.totalTasks && r.totalTasks > 0
                                  ? 'text-green-600 font-medium'
                                  : ''
                              }
                            >
                              {r.completedTasks}/{r.totalTasks}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={r.caseStatus === 'COMPLETED' ? 'default' : 'secondary'}
                            >
                              {r.caseStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={de.className}>{de.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={`/cases/${r.caseId}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= pagination.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
