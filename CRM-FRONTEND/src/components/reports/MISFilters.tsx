import { useEffect, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { apiService } from '@/services/api';
import { isBackendScopedUser, isFieldAgentUser } from '@/utils/userPermissionProfiles';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Label } from '@/ui/components/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/Select';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import type { MISFilters } from '@/types/mis';

interface MISFiltersProps {
  filters: MISFilters;
  onFiltersChange: (filters: MISFilters) => void;
  onReset: () => void;
}

export function MISFiltersComponent({ filters, onFiltersChange, onReset }: MISFiltersProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [verificationTypes, setVerificationTypes] = useState<any[]>([]);
  const [fieldAgents, setFieldAgents] = useState<any[]>([]);
  const [backendUsers, setBackendUsers] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
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
        setFieldAgents(users.filter((item: unknown) => isFieldAgentUser(item as never)));
        setBackendUsers(users.filter((item: unknown) => isBackendScopedUser(item as never)));
      } catch (error) {
        console.error('Failed to load filter options:', error);
      }
    };

    loadFilterOptions();
  }, []);

  const handleFilterChange = (key: keyof MISFilters, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) => key !== 'page' && key !== 'limit' && filters[key as keyof MISFilters],
  );

  const fieldStyle = { minWidth: 0 } as const;

  return (
    <Stack gap={4}>
      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
          <Filter size={18} style={{ color: 'var(--ui-text-muted)' }} />
          <Text as="h3" variant="title">Filters</Text>
          {hasActiveFilters ? <Badge variant="warning">Active</Badge> : null}
        </Stack>
        <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
          {hasActiveFilters ? (
            <Button onClick={onReset} variant="ghost" icon={<X size={14} />}>
              Clear All
            </Button>
          ) : null}
          <Button onClick={() => setShowFilters((value) => !value)} variant="outline">
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </Stack>
      </Box>

      {showFilters ? (
        <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="dateFrom">From Date</Label>
            <Input id="dateFrom" type="date" value={filters.dateFrom || ''} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
          </Stack>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="dateTo">To Date</Label>
            <Input id="dateTo" type="date" value={filters.dateTo || ''} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
          </Stack>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="client">Client</Label>
            <Select value={filters.clientId?.toString() || 'all'} onValueChange={(value) => handleFilterChange('clientId', value !== 'all' ? parseInt(value, 10) : undefined)}>
              <SelectTrigger id="client"><SelectValue placeholder="All Clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Stack>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="product">Product</Label>
            <Select value={filters.productId?.toString() || 'all'} onValueChange={(value) => handleFilterChange('productId', value !== 'all' ? parseInt(value, 10) : undefined)}>
              <SelectTrigger id="product"><SelectValue placeholder="All Products" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((product) => <SelectItem key={product.id} value={product.id.toString()}>{product.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Stack>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="verificationType">Verification Type</Label>
            <Select value={filters.verificationTypeId?.toString() || 'all'} onValueChange={(value) => handleFilterChange('verificationTypeId', value !== 'all' ? parseInt(value, 10) : undefined)}>
              <SelectTrigger id="verificationType"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {verificationTypes.map((type) => <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Stack>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="caseStatus">Case Status</Label>
            <Select value={filters.caseStatus || 'all'} onValueChange={(value) => handleFilterChange('caseStatus', value !== 'all' ? value : undefined)}>
              <SelectTrigger id="caseStatus"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </Stack>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="priority">Priority</Label>
            <Select value={filters.priority || 'all'} onValueChange={(value) => handleFilterChange('priority', value !== 'all' ? value : undefined)}>
              <SelectTrigger id="priority"><SelectValue placeholder="All Priorities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </Stack>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="fieldAgent">Field Agent</Label>
            <Select value={filters.fieldAgentId || 'all'} onValueChange={(value) => handleFilterChange('fieldAgentId', value !== 'all' ? value : undefined)}>
              <SelectTrigger id="fieldAgent"><SelectValue placeholder="All Field Agents" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Field Agents</SelectItem>
                {fieldAgents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name} ({agent.employeeId})</SelectItem>)}
              </SelectContent>
            </Select>
          </Stack>
          <Stack gap={2} style={fieldStyle}>
            <Label htmlFor="backendUser">Backend User</Label>
            <Select value={filters.backendUserId || 'all'} onValueChange={(value) => handleFilterChange('backendUserId', value !== 'all' ? value : undefined)}>
              <SelectTrigger id="backendUser"><SelectValue placeholder="All Backend Users" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backend Users</SelectItem>
                {backendUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} ({user.employeeId})</SelectItem>)}
              </SelectContent>
            </Select>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
