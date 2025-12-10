import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { MoreHorizontal, Edit, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { rolesService } from '@/services/roles';
import { RoleData } from '@/types/user';
import { formatDistanceToNow } from 'date-fns';
import { getRoleIcon } from '@/utils/roleUtils';
import { baseBadgeStyle } from '@/lib/badgeStyles';

interface RolesTableProps {
  onEditRole?: (role: RoleData) => void;
}

export function RolesTable({ onEditRole }: RolesTableProps) {
  const [deleteRole, setDeleteRole] = useState<RoleData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles', currentPage, pageSize],
    queryFn: () => rolesService.getRoles({
      page: currentPage,
      limit: pageSize,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => rolesService.deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role deleted successfully');
      setDeleteRole(null);
    },
    onError: (error: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || 'Failed to delete role');
      setDeleteRole(null);
    },
  });

  const roles = rolesData?.data || [];

  const handleDeleteRole = (role: RoleData) => {
    setDeleteRole(role);
  };

  const confirmDelete = () => {
    if (deleteRole) {
      deleteMutation.mutate(deleteRole.id);
    }
  };

  const getPermissionCount = (permissions: unknown) => {
    if (!permissions) {return 0;}
    let count = 0;
    Object.values(permissions).forEach((resource: unknown) => {
      if (resource && typeof resource === 'object') {
        Object.values(resource).forEach((permission) => {
          if (permission === true) {count++;}
        });
      }
    });
    return count;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-gray-600">Loading roles...</div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 border-b border-gray-200">
            <TableRow>
              <TableHead className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Description</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Users</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Permissions</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="text-gray-600">
                    No roles found
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id} className="hover:bg-green-50 transition-colors">
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(role.name, 'md')}
                      <div>
                        <div className="font-medium">{role.name}</div>
                        {role.isSystemRole && (
                          <div className="text-xs text-gray-600">System Role</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={role.description}>
                      {role.description || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={baseBadgeStyle}>
                      {role.isSystemRole ? 'SYSTEM' : 'CUSTOM'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4 text-gray-600" />
                      <span>{role.userCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={baseBadgeStyle}>
                      {getPermissionCount(role.permissions)} PERMISSIONS
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={baseBadgeStyle}>
                      {role.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-600">
                      {formatDistanceToNow(new Date(role.createdAt), { addSuffix: true })}
                    </div>
                    {role.createdByName && (
                      <div className="text-xs text-gray-600">
                        by {role.createdByName}
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
                        <DropdownMenuItem onClick={() => onEditRole?.(role)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {!role.isSystemRole && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteRole(role)}
                              className="text-destructive"
                              disabled={role.userCount > 0}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
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
      {rolesData?.pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="text-sm text-gray-600">
            Showing {rolesData.data?.length || 0} of {rolesData.pagination.total} roles
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of {rolesData.pagination.totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage >= (rolesData.pagination.totalPages || 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role &quot;{deleteRole?.name}&quot;? This action cannot be undone.
              {deleteRole?.userCount && deleteRole.userCount > 0 && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
                  This role is assigned to {deleteRole.userCount} user(s) and cannot be deleted.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending || (deleteRole?.userCount || 0) > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
