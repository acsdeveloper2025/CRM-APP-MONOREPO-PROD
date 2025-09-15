import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MoreHorizontal, Edit, Trash2, Users, Building, Search, Crown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { departmentsService } from '@/services/departments';
import { Department } from '@/types/user';
import { formatDistanceToNow } from 'date-fns';

interface DepartmentsTableProps {
  onEditDepartment?: (department: Department) => void;
}

export function DepartmentsTable({ onEditDepartment }: DepartmentsTableProps) {
  const { searchValue, debouncedSearchValue, setSearchValue, isSearching } = useDebouncedSearch('', 300);
  const [deleteDepartment, setDeleteDepartment] = useState<Department | null>(null);
  const queryClient = useQueryClient();

  const { data: departmentsData, isLoading, error } = useQuery({
    queryKey: ['departments', { search: debouncedSearchValue }],
    queryFn: () => departmentsService.getDepartments({ search: debouncedSearchValue, limit: 100 }),
    staleTime: 0, // Always refetch
    refetchOnWindowFocus: true,
  });

  // Manual refresh function
  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    queryClient.refetchQueries({ queryKey: ['departments'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (departmentId: string) => departmentsService.deleteDepartment(departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deleted successfully');
      setDeleteDepartment(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete department');
      setDeleteDepartment(null);
    },
  });

  const departments = departmentsData?.data || [];

  const handleDeleteDepartment = (department: Department) => {
    setDeleteDepartment(department);
  };

  const confirmDelete = () => {
    if (deleteDepartment) {
      deleteMutation.mutate(deleteDepartment.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-muted-foreground">Loading departments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-8"
          />
          {isSearching && (
            <div className="absolute right-2 top-2.5">
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Head</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="text-muted-foreground">
                    {debouncedSearchValue ? `No departments found matching "${debouncedSearchValue}"` : 'No departments found'}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{department.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={department.description}>
                      {department.description || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {department.departmentHeadName ? (
                      <div className="flex items-center space-x-1">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm">{department.departmentHeadName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No head assigned</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{department.userCount}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={department.isActive ? 'default' : 'secondary'}>
                      {department.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(department.createdAt), { addSuffix: true })}
                    </div>
                    {department.createdByName && (
                      <div className="text-xs text-muted-foreground">
                        by {department.createdByName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEditDepartment?.(department)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteDepartment(department)}
                          className="text-destructive"
                          disabled={department.userCount > 0}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteDepartment} onOpenChange={() => setDeleteDepartment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the department "{deleteDepartment?.name}"? This action cannot be undone.
              {deleteDepartment && deleteDepartment.userCount > 0 && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
                  This department cannot be deleted because it has:
                  {deleteDepartment.userCount > 0 && (
                    <div>• {deleteDepartment.userCount} assigned user(s)</div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={
                deleteMutation.isPending ||
                (deleteDepartment?.userCount || 0) > 0
              }
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
