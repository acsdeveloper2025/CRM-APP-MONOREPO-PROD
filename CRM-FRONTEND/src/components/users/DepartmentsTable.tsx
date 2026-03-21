import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/Table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/DropdownMenu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/AlertDialog';
import { Button } from '@/ui/components/Button';
import { Badge } from '@/ui/components/Badge';
import { MoreHorizontal, Edit, Trash2, Users, Building, Crown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { departmentsService } from '@/services/departments';
import { Department } from '@/types/user';
import { formatDistanceToNow } from 'date-fns';

interface DepartmentsTableProps {
  onEditDepartment?: (department: Department) => void;
}

export function DepartmentsTable({ onEditDepartment }: DepartmentsTableProps) {
  const [deleteDepartment, setDeleteDepartment] = useState<Department | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data: departmentsData, isLoading, error: _error } = useQuery({
    queryKey: ['departments', currentPage, pageSize],
    queryFn: () => departmentsService.getDepartments({
      page: currentPage,
      limit: pageSize,
    }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Manual refresh function
  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    queryClient.refetchQueries({ queryKey: ['departments'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (departmentId: string | number) => departmentsService.deleteDepartment(departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deleted successfully');
      setDeleteDepartment(null);
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || 'Failed to delete department'
        : 'Failed to delete department';
      toast.error(message);
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
      <div {...{ className: "flex items-center justify-center h-32" }}>
        <div {...{ className: "text-sm text-gray-600" }}>Loading departments...</div>
      </div>
    );
  }

  return (
    <div {...{ className: "space-y-4" }}>
      <div {...{ className: "flex items-center justify-end space-x-2" }}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          disabled={isLoading}
          {...{ className: "flex items-center gap-2" }}
        >
          <RefreshCw {...{ className: `h-4 w-4 ${isLoading ? 'animate-spin' : ''}` }} />
          Refresh
        </Button>
      </div>

      <div {...{ className: "border rounded-lg overflow-hidden" }}>
        <Table>
          <TableHeader {...{ className: "bg-gray-50 border-b border-gray-200" }}>
            <TableRow>
              <TableHead {...{ className: "px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" }}>Department</TableHead>
              <TableHead {...{ className: "px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" }}>Description</TableHead>
              <TableHead {...{ className: "px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" }}>Head</TableHead>
              <TableHead {...{ className: "px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" }}>Users</TableHead>
              <TableHead {...{ className: "px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" }}>Status</TableHead>
              <TableHead {...{ className: "px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" }}>Created</TableHead>
              <TableHead {...{ className: "px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[70px]" }} />
            </TableRow>
          </TableHeader>
          <TableBody {...{ className: "bg-white divide-y divide-gray-200" }}>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} {...{ className: "text-center py-8" }}>
                  <div {...{ className: "text-gray-600" }}>
                    No departments found
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              departments.map((department) => (
                <TableRow key={department.id} {...{ className: "hover:bg-green-50 transition-colors" }}>
                  <TableCell>
                    <div {...{ className: "flex items-center space-x-2" }}>
                      <Building {...{ className: "h-4 w-4 text-gray-600" }} />
                      <div>
                        <div {...{ className: "font-medium" }}>{department.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div {...{ className: "max-w-xs truncate" }} title={department.description}>
                      {department.description || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {department.departmentHeadName ? (
                      <div {...{ className: "flex items-center space-x-1" }}>
                        <Crown {...{ className: "h-4 w-4 text-yellow-500" }} />
                        <span {...{ className: "text-sm" }}>{department.departmentHeadName}</span>
                      </div>
                    ) : (
                      <span {...{ className: "text-gray-600 text-sm" }}>No head assigned</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div {...{ className: "flex items-center space-x-1" }}>
                      <Users {...{ className: "h-4 w-4 text-gray-600" }} />
                      <span>{department.userCount}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={department.isActive ? 'default' : 'secondary'}>
                      {department.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div {...{ className: "text-sm text-gray-600" }}>
                      {formatDistanceToNow(new Date(department.createdAt), { addSuffix: true })}
                    </div>
                    {department.createdByName && (
                      <div {...{ className: "text-xs text-gray-600" }}>
                        by {department.createdByName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" {...{ className: "h-8 w-8 p-0" }}>
                          <MoreHorizontal {...{ className: "h-4 w-4" }} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEditDepartment?.(department)}>
                          <Edit {...{ className: "mr-2 h-4 w-4" }} />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteDepartment(department)}
                          {...{ className: "text-destructive" }}
                          disabled={department.userCount > 0}
                        >
                          <Trash2 {...{ className: "mr-2 h-4 w-4" }} />
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

      {/* Pagination Controls */}
      {departmentsData?.pagination && (
        <div {...{ className: "flex flex-col sm:flex-row items-center justify-between gap-4 pt-4" }}>
          <div {...{ className: "text-sm text-gray-600" }}>
            Showing {departmentsData.data?.length || 0} of {departmentsData.pagination.total} departments
          </div>
          <div {...{ className: "flex items-center gap-2" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div {...{ className: "text-sm" }}>
              Page {currentPage} of {departmentsData.pagination.totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage >= (departmentsData.pagination.totalPages || 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteDepartment} onOpenChange={() => setDeleteDepartment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the department &quot;{deleteDepartment?.name}&quot;? This action cannot be undone.
              {deleteDepartment && deleteDepartment.userCount > 0 && (
                <div {...{ className: "mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm" }}>
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
              {...{ className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" }}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
