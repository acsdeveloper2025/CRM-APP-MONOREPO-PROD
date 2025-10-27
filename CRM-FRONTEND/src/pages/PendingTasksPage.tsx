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
import { TasksListFlat } from '@/components/verification-tasks/TasksListFlat';
import { TaskAssignmentModal } from '@/components/verification-tasks/TaskAssignmentModal';
import { useAllVerificationTasks } from '@/hooks/useVerificationTasks';
import { useFieldUsers } from '@/hooks/useUsers';
import { useClients } from '@/hooks/useClients';
import { useVerificationTypes } from '@/hooks/useVerificationTypes';
import { 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Filter, 
  X,
  Package,
  UserCheck,
  TrendingUp
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useNavigate } from 'react-router-dom';

export const PendingTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    sortBy: 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc',
    status: 'PENDING,ASSIGNED', // Show both PENDING and ASSIGNED tasks
    priority: undefined as string | undefined,
    assignedTo: undefined as string | undefined,
    verificationTypeId: undefined as number | undefined,
    clientId: undefined as number | undefined,
  });

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch tasks with filters
  const { tasks, loading, error, pagination, statistics, refreshTasks } = useAllVerificationTasks({
    ...filters,
    search: debouncedSearchTerm || undefined,
  });

  // Fetch reference data
  const { data: fieldUsersData } = useFieldUsers();
  const { data: clientsData } = useClients();
  const { data: verificationTypesData } = useVerificationTypes();

  const fieldUsers = fieldUsersData || [];
  const clients = clientsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];

  const handleAssignTask = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleViewTask = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  const handleViewCase = (caseId: string) => {
    if (caseId) {
      navigate(`/cases/${caseId}`);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      sortBy: 'created_at',
      sortOrder: 'desc',
      status: 'PENDING,ASSIGNED',
      priority: undefined,
      assignedTo: undefined,
      verificationTypeId: undefined,
      clientId: undefined,
    });
    setSearchTerm('');
  };

  const hasActiveFilters = 
    filters.priority || 
    filters.assignedTo || 
    filters.verificationTypeId || 
    filters.clientId || 
    searchTerm;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Verification tasks that need assignment or are waiting to be started
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshTasks()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.pending + statistics.assigned}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.pending} unassigned, {statistics.assigned} assigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.pending}</div>
            <p className="text-xs text-muted-foreground">
              Need field agent assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.assigned}</div>
            <p className="text-xs text-muted-foreground">
              Waiting to be started
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.urgent}</div>
            <p className="text-xs text-muted-foreground">
              High priority tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Search & Filter</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, task title, address, or task number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={filters.priority || 'all'}
                  onValueChange={(value) => handleFilterChange('priority', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Select
                  value={filters.assignedTo || 'all'}
                  onValueChange={(value) => handleFilterChange('assignedTo', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {fieldUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Verification Type</Label>
                <Select
                  value={filters.verificationTypeId?.toString() || 'all'}
                  onValueChange={(value) => handleFilterChange('verificationTypeId', value === 'all' ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {verificationTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={filters.clientId?.toString() || 'all'}
                  onValueChange={(value) => handleFilterChange('clientId', value === 'all' ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Clients" />
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
            </div>
          )}

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex items-center space-x-2 pt-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks List */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-600">Error loading tasks: {error}</p>
          </CardContent>
        </Card>
      )}

      <TasksListFlat
        tasks={tasks}
        loading={loading}
        onAssignTask={handleAssignTask}
        onViewTask={handleViewTask}
        onViewCase={handleViewCase}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tasks
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('page', pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('page', pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Assignment Modal */}
      {selectedTaskId && (
        <TaskAssignmentModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onSuccess={() => {
            setSelectedTaskId(null);
            refreshTasks();
          }}
        />
      )}
    </div>
  );
};

