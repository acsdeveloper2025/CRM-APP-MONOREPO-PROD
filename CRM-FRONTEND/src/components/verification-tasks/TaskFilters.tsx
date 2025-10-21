import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Filter, X, Search } from 'lucide-react';
import { VerificationTaskFilters, TaskStatus, TaskPriority } from '@/types/verificationTask';
import { useUsers } from '@/hooks/useUsers';
import { useVerificationTypes } from '@/hooks/useVerificationTypes';

interface TaskFiltersProps {
  onFiltersChange: (filters: Partial<VerificationTaskFilters>) => void;
  onClearFilters: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  onFiltersChange,
  onClearFilters
}) => {
  const [filters, setFilters] = useState<Partial<VerificationTaskFilters>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const { data: usersData } = useUsers();
  const { data: verificationTypesData } = useVerificationTypes();

  const fieldUsers = usersData?.data?.filter(user => user.role === 'FIELD_USER') || [];
  const verificationTypes = verificationTypesData?.data || [];

  const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'ON_HOLD', label: 'On Hold' }
  ];

  const priorityOptions: { value: TaskPriority; label: string }[] = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' }
  ];

  const updateFilter = (key: keyof VerificationTaskFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const removeFilter = (key: keyof VerificationTaskFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleClearAll = () => {
    setFilters({});
    setSearchTerm('');
    onClearFilters();
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      updateFilter('search', searchTerm.trim());
    } else {
      removeFilter('search');
    }
  };

  const getActiveFiltersCount = () => {
    return Object.keys(filters).length;
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </CardTitle>
          {getActiveFiltersCount() > 0 && (
            <Button
              onClick={handleClearAll}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search Tasks</Label>
          <div className="flex space-x-2">
            <Input
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by task title, description, or task number..."
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} size="sm">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={filters.status || ''}
              onValueChange={(value) => 
                value ? updateFilter('status', value as TaskStatus) : removeFilter('status')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={filters.priority || ''}
              onValueChange={(value) => 
                value ? updateFilter('priority', value as TaskPriority) : removeFilter('priority')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All priorities</SelectItem>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned To Filter */}
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assigned To</Label>
            <Select
              value={filters.assignedTo || ''}
              onValueChange={(value) => 
                value ? updateFilter('assignedTo', value) : removeFilter('assignedTo')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All users</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {fieldUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Verification Type Filter */}
          <div className="space-y-2">
            <Label htmlFor="verificationType">Verification Type</Label>
            <Select
              value={filters.verificationTypeId?.toString() || ''}
              onValueChange={(value) => 
                value ? updateFilter('verificationTypeId', parseInt(value)) : removeFilter('verificationTypeId')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                {verificationTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="createdAfter">Created After</Label>
            <Input
              id="createdAfter"
              type="date"
              value={filters.createdAfter || ''}
              onChange={(e) => 
                e.target.value ? updateFilter('createdAfter', e.target.value) : removeFilter('createdAfter')
              }
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="createdBefore">Created Before</Label>
            <Input
              id="createdBefore"
              type="date"
              value={filters.createdBefore || ''}
              onChange={(e) => 
                e.target.value ? updateFilter('createdBefore', e.target.value) : removeFilter('createdBefore')
              }
            />
          </div>
        </div>

        {/* Active Filters Display */}
        {getActiveFiltersCount() > 0 && (
          <div className="space-y-2">
            <Label>Active Filters</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(filters).map(([key, value]) => {
                if (!value) return null;
                
                let displayValue = value.toString();
                
                // Format display values
                if (key === 'assignedTo' && value === 'unassigned') {
                  displayValue = 'Unassigned';
                } else if (key === 'assignedTo' && value !== 'unassigned') {
                  const user = fieldUsers.find(u => u.id === value);
                  displayValue = user ? user.name : value.toString();
                } else if (key === 'verificationTypeId') {
                  const type = verificationTypes.find(t => t.id === value);
                  displayValue = type ? type.name : value.toString();
                }
                
                return (
                  <Badge
                    key={key}
                    variant="secondary"
                    className="flex items-center space-x-1 cursor-pointer hover:bg-gray-200"
                    onClick={() => removeFilter(key as keyof VerificationTaskFilters)}
                  >
                    <span className="text-xs">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}: {displayValue}
                    </span>
                    <X className="h-3 w-3" />
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
