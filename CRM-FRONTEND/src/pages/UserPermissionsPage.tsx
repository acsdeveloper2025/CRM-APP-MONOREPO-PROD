import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, User, Shield, Building2, Package, MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { usersService } from '@/services/users';
import { territoryAssignmentService } from '@/services/territoryAssignments';
import { ClientAssignmentSection } from '@/components/users/ClientAssignmentSection';
import { ProductAssignmentSection } from '@/components/users/ProductAssignmentSection';
import { TerritoryAssignmentDropdown as TerritoryAssignmentSection } from '@/components/users/TerritoryAssignmentDropdown';
import { toast } from 'sonner';
import type { User as UserType } from '@/types/user';

export function UserPermissionsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State for confirmation dialog
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    pincodeId: number | null;
    pincodeCode: string;
  }>({
    isOpen: false,
    pincodeId: null,
    pincodeCode: ''
  });

  // Fetch user details
  const { data: userData, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersService.getUserById(userId!),
    enabled: !!userId,
  });

  // Fetch client assignments
  const { data: clientAssignments, isLoading: clientAssignmentsLoading } = useQuery({
    queryKey: ['user-client-assignments', userId],
    queryFn: () => usersService.getUserClientAssignments(userId!),
    enabled: !!userId,
  });

  // Fetch product assignments
  const { data: productAssignments, isLoading: productAssignmentsLoading } = useQuery({
    queryKey: ['user-product-assignments', userId],
    queryFn: () => usersService.getUserProductAssignments(userId!),
    enabled: !!userId,
  });

  // Fetch territory assignments for field agents
  const { data: territoryAssignments, isLoading: territoryAssignmentsLoading } = useQuery({
    queryKey: ['user-territory-assignments', userId],
    queryFn: () => territoryAssignmentService.getFieldAgentTerritoryById(userId!),
    enabled: !!userId && userData?.data?.role === 'FIELD_AGENT',
  });

  // Mutation for individual pincode deletion
  const deletePincodeMutation = useMutation({
    mutationFn: (pincodeId: number) => territoryAssignmentService.removePincodeAssignment(userId!, pincodeId),
    onSuccess: () => {
      toast.success('Pincode assignment removed successfully');
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            (Array.isArray(queryKey) && queryKey.includes(userId)) ||
            (Array.isArray(queryKey) && queryKey[0] === 'user-territory-assignments')
          );
        }
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove pincode assignment');
    },
  });

  // Handle individual pincode deletion with confirmation
  const handleDeletePincode = (pincodeId: number, pincodeCode: string) => {
    setDeleteConfirmation({
      isOpen: true,
      pincodeId,
      pincodeCode
    });
  };

  // Confirm deletion
  const confirmDeletePincode = () => {
    if (deleteConfirmation.pincodeId) {
      deletePincodeMutation.mutate(deleteConfirmation.pincodeId);
      setDeleteConfirmation({ isOpen: false, pincodeId: null, pincodeCode: '' });
    }
  };

  // Cancel deletion
  const cancelDeletePincode = () => {
    setDeleteConfirmation({ isOpen: false, pincodeId: null, pincodeCode: '' });
  };

  if (userLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Loading User Permissions...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (userError || !userData?.data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load user details. The user may not exist or you may not have permission to view it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const user: UserType = userData.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Permissions</h1>
            <p className="text-muted-foreground">
              Manage access control and permissions for {user.name}
            </p>
          </div>
        </div>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>User Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-lg font-semibold">{user.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-lg">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Role</p>
              <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                {user.role}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={user.isActive ? 'default' : 'destructive'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-based Access Control Info */}
      {user.role === 'SUPER_ADMIN' && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>SUPER_ADMIN Access:</strong> This user has unrestricted access to all clients and products. 
            Client and product assignments do not apply to SUPER_ADMIN users.
          </AlertDescription>
        </Alert>
      )}

      {user.role !== 'BACKEND_USER' && user.role !== 'SUPER_ADMIN' && (
        <Alert>
          <AlertDescription>
            <strong>Role-based Access:</strong> Client and product access control only applies to BACKEND_USER users.
            This user's role ({user.role}) has different permission structures.
          </AlertDescription>
        </Alert>
      )}

      {/* Client Assignment Section */}
      {user.role === 'BACKEND_USER' && (
        <>
          <ClientAssignmentSection user={user} />
          <ProductAssignmentSection user={user} />
        </>
      )}

      {/* Territory Assignment Section */}
      {user.role === 'FIELD_AGENT' && (
        <TerritoryAssignmentSection user={user} />
      )}

      {/* Additional Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Permission Summary</span>
          </CardTitle>
          <CardDescription>
            Overview of this user's access levels and restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Field Agent - Show only territory information */}
          {user.role === 'FIELD_AGENT' ? (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3 flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>Territory Assignments</span>
                </h4>
                {territoryAssignmentsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading territory assignments...</p>
                ) : territoryAssignments?.data?.territoryAssignments && territoryAssignments.data.territoryAssignments.length > 0 ? (
                  <div className="space-y-4">
                    {/* Pincode Assignments */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-muted-foreground">Assigned Pincodes</h5>
                        <Badge variant="secondary" className="text-xs">
                          {territoryAssignments.data.territoryAssignments.length} pincode{territoryAssignments.data.territoryAssignments.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {territoryAssignments.data.territoryAssignments.map((assignment: any) => (
                          <div key={assignment.pincodeId} className="p-3 border rounded-lg bg-muted/30 relative group">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{assignment.pincodeCode}</div>
                                <div className="text-xs text-muted-foreground">{assignment.cityName}, {assignment.stateName}</div>
                                {assignment.assignedAreas && assignment.assignedAreas.length > 0 ? (
                                  <div className="text-xs text-blue-600 mt-1">
                                    {assignment.assignedAreas.length} area{assignment.assignedAreas.length !== 1 ? 's' : ''}: {assignment.assignedAreas.map((area: any) => area.areaName).join(', ')}
                                  </div>
                                ) : (
                                  <div className="text-xs text-green-600 mt-1">
                                    Entire pincode assigned
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePincode(assignment.pincodeId, assignment.pincodeCode)}
                                disabled={deletePincodeMutation.isPending}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Area Assignments */}
                    {(() => {
                      const allAreas = territoryAssignments.data.territoryAssignments.flatMap((assignment: any) =>
                        assignment.assignedAreas?.map((area: any) => ({
                          ...area,
                          pincodeCode: assignment.pincodeCode
                        })) || []
                      );

                      return allAreas.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-muted-foreground">Assigned Areas</h5>
                            <Badge variant="secondary" className="text-xs">
                              {allAreas.length} area{allAreas.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                            {allAreas.map((area: any, index: number) => (
                              <div key={`${area.areaId}-${index}`} className="p-2 border rounded bg-blue-50 dark:bg-blue-950/30">
                                <div className="font-medium text-sm">{area.areaName}</div>
                                <div className="text-xs text-muted-foreground">in {area.pincodeCode}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/30">
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            📍 Pincodes assigned but no specific areas selected. Field agent has access to entire pincode areas.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      ⚠️ No territories assigned - field agent has no coverage area and cannot access cases.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Non-Field Agent - Show standard permission summary */
            <div className={`grid grid-cols-1 gap-6 ${
              user.role === 'BACKEND_USER' ? 'md:grid-cols-2' : 'md:grid-cols-1'
            }`}>
              <div>
                <h4 className="font-medium mb-2 flex items-center space-x-2">
                  <Building2 className="h-4 w-4" />
                  <span>Client Access</span>
                </h4>
                {user.role === 'SUPER_ADMIN' ? (
                  <p className="text-sm text-muted-foreground">Full access to all clients</p>
                ) : user.role === 'BACKEND_USER' ? (
                  <div className="space-y-2">
                    {clientAssignmentsLoading ? (
                      <p className="text-sm text-muted-foreground">Loading assignments...</p>
                    ) : clientAssignments?.data && clientAssignments.data.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Assigned to {clientAssignments.data.length} client(s):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {clientAssignments.data.map((assignment: any) => (
                            <Badge key={assignment.id} variant="outline" className="text-xs">
                              {assignment.clientName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600">
                        No clients assigned - user has no access
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Role-based access (not client-specific)
                  </p>
                )}
              </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center space-x-2">
                <Package className="h-4 w-4" />
                <span>Product Access</span>
              </h4>
              {user.role === 'SUPER_ADMIN' ? (
                <p className="text-sm text-muted-foreground">Full access to all products</p>
              ) : user.role === 'BACKEND_USER' ? (
                <div className="space-y-2">
                  {productAssignmentsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading assignments...</p>
                  ) : productAssignments?.data && productAssignments.data.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Assigned to {productAssignments.data.length} product(s):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {productAssignments.data.map((assignment: any) => (
                          <Badge key={assignment.id} variant="outline" className="text-xs">
                            {assignment.productName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-600">
                      No products assigned - user has no access
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Role-based access (not product-specific)
                </p>
              )}
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Pincode Deletion */}
      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={cancelDeletePincode}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Pincode Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove pincode <strong>{deleteConfirmation.pincodeCode}</strong> and all its area assignments?
              This action cannot be undone and will remove the field agent's access to this territory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeletePincode}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePincode}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePincodeMutation.isPending}
            >
              {deletePincodeMutation.isPending ? 'Removing...' : 'Remove Assignment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
