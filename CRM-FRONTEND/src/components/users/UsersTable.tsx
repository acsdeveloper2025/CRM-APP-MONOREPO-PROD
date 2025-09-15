import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Edit, Trash2, UserCheck, UserX, Eye, Shield, Key, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { toast } from 'sonner';
import { usersService } from '@/services/users';
import { authService } from '@/services/auth';
import { User } from '@/types/user';
import { EditUserDialog } from './EditUserDialog';
import { UserDetailsDialog } from './UserDetailsDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

import { getRoleBadge } from '@/utils/roleUtils';

interface UsersTableProps {
  data: User[];
  isLoading: boolean;
}

export function UsersTable({ data, isLoading }: UsersTableProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const queryClient = useQueryClient();

  const activateUserMutation = useMutation({
    mutationFn: (id: string) => usersService.activateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User activated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to activate user');
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: (id: string) => usersService.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to deactivate user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
      setShowDeleteDialog(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    },
  });

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(data.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setShowEditDialog(true);
  };

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setShowDetailsDialog(true);
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setShowResetPasswordDialog(true);
  };

  const handleResetRateLimit = async (user: User) => {
    try {
      const result = await authService.resetUserRateLimit(user.id);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      toast.error('Failed to reset rate limit for user');
    }
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  // Use the centralized role badge utility
  const getUserRoleBadge = (role: string) => {
    return getRoleBadge(role);
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? 'default' : 'secondary'}>
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No users found</h3>
        <p className="text-muted-foreground">
          Get started by adding your first user.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg mb-4">
          <span className="text-sm font-medium">
            {selectedUsers.length} user(s) selected
          </span>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                selectedUsers.forEach(id => activateUserMutation.mutate(id));
                setSelectedUsers([]);
              }}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                selectedUsers.forEach(id => deactivateUserMutation.mutate(id));
                setSelectedUsers([]);
              }}
            >
              <UserX className="h-4 w-4 mr-2" />
              Deactivate
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedUsers.length === data.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={(checked) => 
                      handleSelectUser(user.id, checked as boolean)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profilePhotoUrl} alt={user.name} />
                      <AvatarFallback>
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.username} • {user.employeeId}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getUserRoleBadge(user.roleName || user.role)}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{user.departmentName || 'No Department'}</div>
                    <div className="text-sm text-muted-foreground">{user.designation}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(user.isActive ?? false)}
                </TableCell>
                <TableCell>
                  {(user.lastLogin || user.lastLoginAt) ? (
                    <div className="text-sm">
                      {new Date(user.lastLogin || user.lastLoginAt!).toLocaleString()}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt!).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(user)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                        <Key className="mr-2 h-4 w-4" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResetRateLimit(user)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Clear Rate Limit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/users/${user.id}/permissions`)}>
                        <Shield className="mr-2 h-4 w-4" />
                        Manage Permissions
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />
                      {user.isActive ? (
                        <DropdownMenuItem 
                          onClick={() => deactivateUserMutation.mutate(user.id)}
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem 
                          onClick={() => activateUserMutation.mutate(user.id)}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(user)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {selectedUser && (
        <EditUserDialog
          user={selectedUser}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Details Dialog */}
      {selectedUser && (
        <UserDetailsDialog
          user={selectedUser}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}

      {/* Reset Password Dialog */}
      {selectedUser && (
        <ResetPasswordDialog
          user={selectedUser}
          open={showResetPasswordDialog}
          onOpenChange={setShowResetPasswordDialog}
        />
      )}



      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              "{userToDelete?.name}" and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
