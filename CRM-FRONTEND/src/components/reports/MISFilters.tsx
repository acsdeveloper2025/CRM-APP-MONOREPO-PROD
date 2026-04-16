import { useState, useEffect } from 'react';
import { X, Filter } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import type { MISFilters } from '@/types/mis';
import { apiService } from '@/services/api';
import { isBackendScopedUser, isFieldAgentUser } from '@/utils/userPermissionProfiles';
import { logger } from '@/utils/logger';

interface MISFiltersProps {
  filters: MISFilters;
  onFiltersChange: (filters: MISFilters) => void;
  onReset: () => void;
}

export function MISFiltersComponent({ filters, onFiltersChange, onReset }: MISFiltersProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [verificationTypes, setVerificationTypes] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fieldAgents, setFieldAgents] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [backendUsers, setBackendUsers] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const [clientsRes, productsRes, verificationTypesRes, usersRes] = await Promise.all([
        apiService.get('/clients'),
        apiService.get('/products'),
        apiService.get('/verification-types'),
        apiService.get('/users'),
      ]);

      setClients((clientsRes.data as unknown[]) || []);
      setProducts((productsRes.data as unknown[]) || []);
      setVerificationTypes((verificationTypesRes.data as unknown[]) || []);

      const users = (usersRes.data as unknown[]) || [];
      setFieldAgents(users.filter((u: unknown) => isFieldAgentUser(u as never)));
      setBackendUsers(users.filter((u: unknown) => isBackendScopedUser(u as never)));
    } catch (error) {
      logger.error('Failed to load filter options:', error);
    }
  };

  const handleFilterChange = (key: keyof MISFilters, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) => key !== 'page' && key !== 'limit' && filters[key as keyof MISFilters]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          {hasActiveFilters && <Badge variant="secondary">Active</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button onClick={onReset} variant="ghost" size="sm">
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm">
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label htmlFor="dateFrom">From Date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateTo">To Date</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Select
              value={filters.clientId?.toString() || 'all'}
              onValueChange={(value) =>
                handleFilterChange('clientId', value !== 'all' ? parseInt(value) : undefined)
              }
            >
              <SelectTrigger id="client">
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

          {/* Product */}
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Select
              value={filters.productId?.toString() || 'all'}
              onValueChange={(value) =>
                handleFilterChange('productId', value !== 'all' ? parseInt(value) : undefined)
              }
            >
              <SelectTrigger id="product">
                <SelectValue placeholder="All Products" />
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

          {/* Verification Type */}
          <div className="space-y-2">
            <Label htmlFor="verificationType">Verification Type</Label>
            <Select
              value={filters.verificationTypeId?.toString() || 'all'}
              onValueChange={(value) =>
                handleFilterChange(
                  'verificationTypeId',
                  value !== 'all' ? parseInt(value) : undefined
                )
              }
            >
              <SelectTrigger id="verificationType">
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

          {/* Case Status */}
          <div className="space-y-2">
            <Label htmlFor="caseStatus">Case Status</Label>
            <Select
              value={filters.caseStatus || 'all'}
              onValueChange={(value) =>
                handleFilterChange('caseStatus', value !== 'all' ? value : undefined)
              }
            >
              <SelectTrigger id="caseStatus">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={filters.priority || 'all'}
              onValueChange={(value) =>
                handleFilterChange('priority', value !== 'all' ? value : undefined)
              }
            >
              <SelectTrigger id="priority">
                <SelectValue placeholder="All Priorities" />
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

          {/* Field Agent */}
          <div className="space-y-2">
            <Label htmlFor="fieldAgent">Field Agent</Label>
            <Select
              value={filters.fieldAgentId || 'all'}
              onValueChange={(value) =>
                handleFilterChange('fieldAgentId', value !== 'all' ? value : undefined)
              }
            >
              <SelectTrigger id="fieldAgent">
                <SelectValue placeholder="All Field Agents" />
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

          {/* Backend User */}
          <div className="space-y-2">
            <Label htmlFor="backendUser">Backend User</Label>
            <Select
              value={filters.backendUserId || 'all'}
              onValueChange={(value) =>
                handleFilterChange('backendUserId', value !== 'all' ? value : undefined)
              }
            >
              <SelectTrigger id="backendUser">
                <SelectValue placeholder="All Backend Users" />
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
        </div>
      )}
    </div>
  );
}
