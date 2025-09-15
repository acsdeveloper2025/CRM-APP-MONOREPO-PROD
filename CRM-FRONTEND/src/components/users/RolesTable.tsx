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
import { MoreHorizontal, Edit, Trash2, Shield, Users, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { rolesService } from '@/services/roles';
import { RoleData } from '@/types/user';
import { formatDistanceToNow } from 'date-fns';
import { getRoleIcon } from '@/utils/roleUtils';

interface RolesTableProps {
  onEditRole?: (role: RoleData) => void;
}

export function RolesTable({ onEditRole }: RolesTableProps) {
  const { searchValue, debouncedSearchValue, setSearchValue, isSearching } = useDebouncedSearch('', 300);
  const [deleteRole, setDeleteRole] = useState<RoleData | null>(null);
  const queryClient = useQueryClient();

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles', { search: debouncedSearchValue }],
    queryFn: () => rolesService.getRoles({ search: debouncedSearchValue, limit: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => rolesService.deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role deleted successfully');
      setDeleteRole(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete role');
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

  const getPermissionCount = (permissions: any) => {
    if (!permissions) return 0;
    let count = 0;
    Object.values(permissions).forEach((resource: any) => {
      if (resource && typeof resource === 'object') {
        Object.values(resource).forEach((permission) => {
          if (permission === true) count++;
        });
      }
    });
    return count;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-muted-foreground">Loading roles...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roles..."
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="text-muted-foreground">
                    {debouncedSearchValue ? `No roles found matching "${debouncedSearchValue}"` : 'No roles found'}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(role.name, 'md')}
                      <div>
                        <div className="font-medium">{role.name}</div>
                        {role.isSystemRole && (
                          <div className="text-xs text-muted-foreground">System Role</div>
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
                    <Badge variant={role.isSystemRole ? 'default' : 'secondary'}>
                      {role.isSystemRole ? 'System' : 'Custom'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{role.userCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getPermissionCount(role.permissions)} permissions
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.isActive ? 'default' : 'secondary'}>
                      {role.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(role.createdAt), { addSuffix: true })}
                    </div>
                    {role.createdByName && (
                      <div className="text-xs text-muted-foreground">
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

      <AlertDialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{deleteRole?.name}"? This action cannot be undone.
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
    </div>
  );
}
