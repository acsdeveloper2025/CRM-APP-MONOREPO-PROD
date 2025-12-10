
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User, Shield, Building2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usersService } from '@/services/users';
import { ClientAssignmentSection } from '@/components/users/ClientAssignmentSection';
import { ProductAssignmentSection } from '@/components/users/ProductAssignmentSection';
import { TerritoryAssignmentSection } from '@/components/users/TerritoryAssignmentSection';
import type { User as UserType, UserClientAssignment, UserProductAssignment } from '@/types/user';

export function UserPermissionsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  // Fetch user details
  const { data: userData, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersService.getUserById(userId || ''),
    enabled: !!userId,
  });

  // Fetch client assignments
  const { data: clientAssignments, isLoading: clientAssignmentsLoading } = useQuery({
    queryKey: ['user-client-assignments', userId],
    queryFn: () => usersService.getUserClientAssignments(userId || ''),
    enabled: !!userId,
  });

  // Fetch product assignments
  const { data: productAssignments, isLoading: productAssignmentsLoading } = useQuery({
    queryKey: ['user-product-assignments', userId],
    queryFn: () => usersService.getUserProductAssignments(userId || ''),
    enabled: !!userId,
  });

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
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Permissions</h1>
            <p className="text-gray-600">
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
              <p className="text-sm font-medium text-gray-600">Name</p>
              <p className="text-lg font-semibold">{user.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Email</p>
              <p className="text-lg">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Role</p>
              <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                {user.role}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
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
            This user&apos;s role ({user.role}) has different permission structures.
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
      {user.role === 'FIELD_AGENT' && <TerritoryAssignmentSection user={user} />}

      {/* Additional Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Permission Summary</span>
          </CardTitle>
          <CardDescription>
            Overview of this user&apos;s access levels and restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid grid-cols-1 gap-6 ${
            user.role === 'BACKEND_USER' ? 'md:grid-cols-2' : 'md:grid-cols-1'
          }`}>
              <div>
                <h4 className="font-medium mb-2 flex items-center space-x-2">
                  <Building2 className="h-4 w-4" />
                  <span>Client Access</span>
                </h4>
                {user.role === 'SUPER_ADMIN' ? (
                  <p className="text-sm text-gray-600">Full access to all clients</p>
                ) : user.role === 'BACKEND_USER' ? (
                  <div className="space-y-2">
                    {clientAssignmentsLoading ? (
                      <p className="text-sm text-gray-600">Loading assignments...</p>
                    ) : clientAssignments?.data && clientAssignments.data.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600">
                          Assigned to {clientAssignments.data.length} client(s):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(clientAssignments.data as UserClientAssignment[]).map((assignment) => (
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
                  <p className="text-sm text-gray-600">
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
                <p className="text-sm text-gray-600">Full access to all products</p>
              ) : user.role === 'BACKEND_USER' ? (
                <div className="space-y-2">
                  {productAssignmentsLoading ? (
                    <p className="text-sm text-gray-600">Loading assignments...</p>
                  ) : productAssignments?.data && productAssignments.data.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">
                        Assigned to {productAssignments.data.length} product(s):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(productAssignments.data as UserProductAssignment[]).map((assignment) => (
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
                <p className="text-sm text-gray-600">
                  Role-based access (not product-specific)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
