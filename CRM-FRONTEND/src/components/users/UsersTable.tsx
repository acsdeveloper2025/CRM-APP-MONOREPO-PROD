import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { MoreHorizontal, Edit, Trash2, UserCheck, UserX, Eye, Shield, Key, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/DropdownMenu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/Table';
import {
  MobileTableCard,
  MobileTableField,
} from '@/ui/components/ResponsiveTable';
import { Badge } from '@/ui/components/Badge';
import { LoadingState } from '@/ui/components/Loading';
import { Checkbox } from '@/ui/components/Checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/avatar';
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
import { toast } from 'sonner';
import { usersService } from '@/services/users';
import { authService } from '@/services/auth';
import { User } from '@/types/user';
import { EditUserDialog } from './EditUserDialog';
import { UserDetailsDialog } from './UserDetailsDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

import { getRoleBadge } from '@/utils/roleUtils';
import { getPrimaryRoleLabel, isBackendScopedUser, isFieldAgentUser } from '@/utils/userPermissionProfiles';

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

  const activateUserMutation = useStandardizedMutation({
    mutationFn: (id: string) => usersService.activateUser(id),
    successMessage: 'User activated successfully',
    errorContext: 'User Activation',
    errorFallbackMessage: 'Failed to activate user',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deactivateUserMutation = useStandardizedMutation({
    mutationFn: (id: string) => usersService.deactivateUser(id),
    successMessage: 'User deactivated successfully',
    errorContext: 'User Deactivation',
    errorFallbackMessage: 'Failed to deactivate user',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteUserMutation = useStandardizedMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    successMessage: 'User deleted successfully',
    errorContext: 'User Deletion',
    errorFallbackMessage: 'Failed to delete user',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowDeleteDialog(false);
      setUserToDelete(null);
    },
    onErrorCallback: () => {
      setShowDeleteDialog(false);
      setUserToDelete(null);
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
    return <LoadingState message="Loading users..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div {...{ className: "text-center py-12" }}>
        <Shield {...{ className: "mx-auto h-12 w-12 text-gray-600" }} />
        <h3 {...{ className: "mt-4 text-lg font-semibold" }}>No users found</h3>
        <p {...{ className: "text-gray-600" }}>
          Get started by adding your first user.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div {...{ className: "flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800/60 rounded-lg mb-4" }}>
          <span {...{ className: "text-sm font-medium" }}>
            {selectedUsers.length} user(s) selected
          </span>
          <div {...{ className: "flex items-center space-x-2" }}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                selectedUsers.forEach(id => activateUserMutation.mutate(id));
                setSelectedUsers([]);
              }}
            >
              <UserCheck {...{ className: "h-4 w-4 mr-2" }} />
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
              <UserX {...{ className: "h-4 w-4 mr-2" }} />
              Deactivate
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div {...{ className: "hidden md:block rounded-md border overflow-auto" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead {...{ className: "w-12" }}>
                <Checkbox
                  checked={selectedUsers.length === data.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead {...{ className: "hidden lg:table-cell" }}>Department</TableHead>
              <TableHead {...{ className: "hidden lg:table-cell" }}>Assignments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead {...{ className: "hidden xl:table-cell" }}>Last Login</TableHead>
              <TableHead {...{ className: "hidden xl:table-cell" }}>Created</TableHead>
              <TableHead {...{ className: "text-right" }}>Actions</TableHead>
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
                  <div {...{ className: "flex items-center space-x-3" }}>
                    <Avatar {...{ className: "h-8 w-8" }}>
                      <AvatarImage src={user.profilePhotoUrl} alt={user.name} />
                      <AvatarFallback>
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div {...{ className: "font-medium" }}>{user.name}</div>
                      <div {...{ className: "text-sm text-gray-600" }}>
                        {user.username} • {user.employeeId}
                      </div>
                      <div {...{ className: "text-sm text-gray-600" }}>{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div {...{ className: "flex items-center gap-2" }}>
                    {getUserRoleBadge(getPrimaryRoleLabel(user))}
                  </div>
                </TableCell>
                <TableCell {...{ className: "hidden lg:table-cell" }}>
                  <div>
                    <div {...{ className: "font-medium" }}>{user.departmentName || 'No Department'}</div>
                    <div {...{ className: "text-sm text-gray-600" }}>{user.designationName || user.designation}</div>
                  </div>
                </TableCell>
                <TableCell {...{ className: "hidden lg:table-cell" }}>
                  {isBackendScopedUser(user) ? (
                    <div {...{ className: "text-sm" }}>
                      <div {...{ className: "flex items-center gap-1" }}>
                        <span {...{ className: "font-medium text-green-700" }}>{user.assignedClientsCount || 0}</span>
                        <span {...{ className: "text-gray-600" }}>clients</span>
                      </div>
                      <div {...{ className: "flex items-center gap-1" }}>
                        <span {...{ className: "font-medium text-green-700" }}>{user.assignedProductsCount || 0}</span>
                        <span {...{ className: "text-gray-600" }}>products</span>
                      </div>
                    </div>
                  ) : isFieldAgentUser(user) ? (
                    <div {...{ className: "text-sm" }}>
                      <div {...{ className: "flex items-center gap-1" }}>
                        <span {...{ className: "font-medium text-green-700" }}>{user.assignedPincodesCount || 0}</span>
                        <span {...{ className: "text-gray-600" }}>pincodes</span>
                      </div>
                      <div {...{ className: "flex items-center gap-1" }}>
                        <span {...{ className: "font-medium text-green-700" }}>{user.assignedAreasCount || 0}</span>
                        <span {...{ className: "text-gray-600" }}>areas</span>
                      </div>
                    </div>
                  ) : (
                    <span {...{ className: "text-sm text-gray-400" }}>N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(user.isActive ?? false)}
                </TableCell>
                <TableCell {...{ className: "hidden xl:table-cell" }}>
                  {(user.lastLogin || user.lastLoginAt) ? (
                    <div {...{ className: "text-sm" }}>
                      {new Date(user.lastLogin || user.lastLoginAt || '').toLocaleString()}
                    </div>
                  ) : (
                    <span {...{ className: "text-sm text-gray-600" }}>Never</span>
                  )}
                </TableCell>
                <TableCell {...{ className: "hidden xl:table-cell" }}>
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell {...{ className: "text-right" }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" {...{ className: "h-8 w-8 p-0" }}>
                        <span {...{ className: "sr-only" }}>Open menu</span>
                        <MoreHorizontal {...{ className: "h-4 w-4" }} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                        <Eye {...{ className: "mr-2 h-4 w-4" }} />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(user)}>
                        <Edit {...{ className: "mr-2 h-4 w-4" }} />
                        Edit User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                        <Key {...{ className: "mr-2 h-4 w-4" }} />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResetRateLimit(user)}>
                        <RefreshCw {...{ className: "mr-2 h-4 w-4" }} />
                        Clear Rate Limit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/users/${user.id}/permissions`)}>
                        <Shield {...{ className: "mr-2 h-4 w-4" }} />
                        Manage Permissions
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />
                      {user.isActive ? (
                        <DropdownMenuItem
                          onClick={() => deactivateUserMutation.mutate(user.id)}
                        >
                          <UserX {...{ className: "mr-2 h-4 w-4" }} />
                          Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => activateUserMutation.mutate(user.id)}
                        >
                          <UserCheck {...{ className: "mr-2 h-4 w-4" }} />
                          Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(user)}
                        {...{ className: "text-destructive" }}
                      >
                        <Trash2 {...{ className: "mr-2 h-4 w-4" }} />
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

      {/* Mobile Card Layout */}
      <div {...{ className: "md:hidden space-y-4" }}>
        {data.map((user) => (
          <MobileTableCard key={user.id}>
            <div {...{ className: "flex items-start justify-between mb-3" }}>
              <div {...{ className: "flex items-center space-x-3 flex-1 min-w-0" }}>
                <Checkbox
                  checked={selectedUsers.includes(user.id)}
                  onCheckedChange={(checked) =>
                    handleSelectUser(user.id, checked as boolean)
                  }
                />
                <Avatar {...{ className: "h-10 w-10 shrink-0" }}>
                  <AvatarImage src={user.profilePhotoUrl} alt={user.name} />
                  <AvatarFallback>
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div {...{ className: "flex-1 min-w-0" }}>
                  <div {...{ className: "font-medium truncate" }}>{user.name}</div>
                  <div {...{ className: "text-sm text-gray-600 truncate" }}>
                    {user.username} • {user.employeeId}
                  </div>
                  <div {...{ className: "text-sm text-gray-600 truncate" }}>{user.email}</div>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" {...{ className: "h-8 w-8 p-0 shrink-0" }}>
                    <span {...{ className: "sr-only" }}>Open menu</span>
                    <MoreHorizontal {...{ className: "h-4 w-4" }} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                    <Eye {...{ className: "mr-2 h-4 w-4" }} />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEdit(user)}>
                    <Edit {...{ className: "mr-2 h-4 w-4" }} />
                    Edit User
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                    <Key {...{ className: "mr-2 h-4 w-4" }} />
                    Reset Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleResetRateLimit(user)}>
                    <RefreshCw {...{ className: "mr-2 h-4 w-4" }} />
                    Clear Rate Limit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/users/${user.id}/permissions`)}>
                    <Shield {...{ className: "mr-2 h-4 w-4" }} />
                    Manage Permissions
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  {user.isActive ? (
                    <DropdownMenuItem
                      onClick={() => deactivateUserMutation.mutate(user.id)}
                    >
                      <UserX {...{ className: "mr-2 h-4 w-4" }} />
                      Deactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => activateUserMutation.mutate(user.id)}
                    >
                      <UserCheck {...{ className: "mr-2 h-4 w-4" }} />
                      Activate
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(user)}
                    {...{ className: "text-destructive" }}
                  >
                    <Trash2 {...{ className: "mr-2 h-4 w-4" }} />
                    Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div {...{ className: "grid grid-cols-2 gap-3" }}>
              <MobileTableField
                label="Role"
                value={getUserRoleBadge(getPrimaryRoleLabel(user))}
              />
              <MobileTableField
                label="Status"
                value={getStatusBadge(user.isActive ?? false)}
              />
              <MobileTableField
                label="Department"
                value={
                  <div>
                    <div {...{ className: "font-medium" }}>{user.departmentName || 'No Department'}</div>
                    {user.designation && (
                      <div {...{ className: "text-sm text-gray-600" }}>{user.designationName || user.designation}</div>
                    )}
                  </div>
                }
              />
              {isBackendScopedUser(user) && (
                <MobileTableField
                  label="Assignments"
                  value={
                    <div {...{ className: "text-sm" }}>
                      <div {...{ className: "flex items-center gap-1" }}>
                        <span {...{ className: "font-medium text-green-700" }}>{user.assignedClientsCount || 0}</span>
                        <span {...{ className: "text-gray-600" }}>clients</span>
                      </div>
                      <div {...{ className: "flex items-center gap-1" }}>
                        <span {...{ className: "font-medium text-green-700" }}>{user.assignedProductsCount || 0}</span>
                        <span {...{ className: "text-gray-600" }}>products</span>
                      </div>
                    </div>
                  }
                />
              )}
              {isFieldAgentUser(user) && (
                <MobileTableField
                  label="Territory Assignments"
                  value={
                    <div {...{ className: "text-sm" }}>
                      <div {...{ className: "flex items-center gap-1" }}>
                        <span {...{ className: "font-medium text-green-700" }}>{user.assignedPincodesCount || 0}</span>
                        <span {...{ className: "text-gray-600" }}>pincodes</span>
                      </div>
                      <div {...{ className: "flex items-center gap-1" }}>
                        <span {...{ className: "font-medium text-green-700" }}>{user.assignedAreasCount || 0}</span>
                        <span {...{ className: "text-gray-600" }}>areas</span>
                      </div>
                    </div>
                  }
                />
              )}
              <MobileTableField
                label="Last Login"
                value={
                  (user.lastLogin || user.lastLoginAt) ? (
                    <div {...{ className: "text-sm" }}>
                      {new Date(user.lastLogin || user.lastLoginAt || '').toLocaleDateString()}
                    </div>
                  ) : (
                    <span {...{ className: "text-sm text-gray-600" }}>Never</span>
                  )
                }
              />
            </div>

            <MobileTableField
              label="Created"
              {...{ className: "mt-3" }}
              value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            />
          </MobileTableCard>
        ))}
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
              &quot;{userToDelete?.name}&quot; and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              {...{ className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" }}
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
