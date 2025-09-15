import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import {
  Edit,
  Trash2,
  Search,
  Filter,
  Building2,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { designationsService } from '@/services/designations';
import { departmentsService } from '@/services/departments';
import { Designation } from '@/types/user';
import { formatDate } from '@/lib/utils';

interface DesignationListProps {
  onEdit: (designation: Designation) => void;
}

export function DesignationList({ onEdit }: DesignationListProps) {
  const { searchValue, debouncedSearchValue, setSearchValue, isSearching } = useDebouncedSearch('', 300);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<Designation | null>(null);
  const queryClient = useQueryClient();

  // Fetch designations
  const { data: designationsData, isLoading } = useQuery({
    queryKey: ['designations', debouncedSearchValue, departmentFilter, statusFilter],
    queryFn: () => designationsService.getDesignations({
      search: debouncedSearchValue || undefined,
      departmentId: departmentFilter === '__all__' || departmentFilter === '__none__' || !departmentFilter ? undefined : departmentFilter,
      isActive: statusFilter === '__all__' || !statusFilter ? undefined : statusFilter === 'active',
      limit: 50,
    }),
  });

  // Fetch departments for filter
  const { data: departmentsData } = useQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsService.getActiveDepartments(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => designationsService.deleteDesignation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      toast.success('Designation deleted successfully');
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete designation');
    },
  });

  const handleDelete = (designation: Designation) => {
    setDeleteConfirm(designation);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
    }
  };

  const designations = designationsData?.data || [];
  const departments = departmentsData?.data || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search designations..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All departments</SelectItem>
                <SelectItem value="__none__">No department</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Designations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Designations ({designations.length})</CardTitle>
          <CardDescription>
            Manage organizational designations and their department associations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {designations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No designations found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {debouncedSearchValue || departmentFilter || statusFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by creating a new designation'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designations.map((designation) => (
                    <TableRow key={designation.id}>
                      <TableCell className="font-medium">
                        {designation.name}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={designation.description}>
                          {designation.description || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {designation.departmentName ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {designation.departmentName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">All departments</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={designation.isActive ? 'default' : 'secondary'}>
                          {designation.isActive ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {designation.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(designation.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(designation)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(designation)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Designation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
