import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User, Shield, Building2, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/ui/components/Alert';
import { usersService } from '@/services/users';
import { ClientAssignmentSection } from '@/components/users/ClientAssignmentSection';
import { ProductAssignmentSection } from '@/components/users/ProductAssignmentSection';
import { TerritoryAssignmentSection } from '@/components/users/TerritoryAssignmentSection';
import type { User as UserType, UserClientAssignment, UserProductAssignment } from '@/types/user';
import {
  getPrimaryRoleLabel,
  isAdminLikeUser,
  isBackendScopedUser,
  isFieldAgentUser,
} from '@/utils/userPermissionProfiles';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { LoadingSkeleton } from '@/ui/components/Loading';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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
      <Page
        title="User Permissions"
        subtitle="Review access control and assignment scope."
        shell
        actions={(
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => navigate('/users')}>
            Back to Users
          </Button>
        )}
      >
        <Section>
          <Card tone="strong" staticCard>
            <Stack gap={3}>
              <Text as="h2" variant="headline">Loading User Permissions...</Text>
              <LoadingSkeleton variant="text" lines={3} />
            </Stack>
          </Card>
        </Section>
      </Page>
    );
  }

  if (userError || !userData?.data) {
    return (
      <Page
        title="User Permissions"
        subtitle="Review access control and assignment scope."
        shell
        actions={(
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => navigate('/users')}>
            Back to Users
          </Button>
        )}
      >
        <Section>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load user details. The user may not exist or you may not have permission to view it.
          </AlertDescription>
        </Alert>
        </Section>
      </Page>
    );
  }

  const user: UserType = userData.data;
  const adminLike = isAdminLikeUser(user);
  const backendScoped = isBackendScopedUser(user);
  const fieldAgent = isFieldAgentUser(user);
  const roleLabel = getPrimaryRoleLabel(user);

  return (
    <Page
      title="User Permissions"
      subtitle={`Manage access control and operational scope for ${user.name}.`}
      shell
      actions={(
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => navigate('/users')}>
            Back to Users
        </Button>
      )}
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Identity & Scope</Badge>
          <Text as="h2" variant="headline">Keep role scope, assignment access, and territory coverage visible in one place.</Text>
          <Text variant="body-sm" tone="muted">
            This page now uses the shared shell while preserving all assignment queries and permission logic.
          </Text>
        </Stack>
      </Section>

      <Section>
        <MetricCardGrid
          items={[
            {
              title: 'User',
              value: user.name,
              detail: user.email,
              icon: User,
              tone: 'neutral',
            },
            {
              title: 'Role',
              value: roleLabel,
              detail: adminLike ? 'Elevated access' : backendScoped ? 'Backend scoped' : fieldAgent ? 'Field scoped' : 'Standard access',
              icon: Shield,
              tone: adminLike ? 'accent' : backendScoped ? 'warning' : 'neutral',
            },
            {
              title: 'Client Access',
              value: adminLike ? 'Full' : backendScoped ? (clientAssignments?.data?.length || 0) : 'Role-based',
              detail: adminLike ? 'Not assignment restricted' : backendScoped ? 'Assigned clients' : 'Not client scoped',
              icon: Building2,
              tone: adminLike ? 'accent' : backendScoped ? 'warning' : 'neutral',
            },
            {
              title: 'Product Access',
              value: adminLike ? 'Full' : backendScoped ? (productAssignments?.data?.length || 0) : 'Role-based',
              detail: adminLike ? 'Not assignment restricted' : backendScoped ? 'Assigned products' : 'Not product scoped',
              icon: Package,
              tone: user.isActive ? 'positive' : 'danger',
            },
          ]}
        />
      </Section>

      {adminLike ? (
        <Section>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Administrative Access:</strong> This user has elevated access and is not restricted by client/product assignment scoping.
          </AlertDescription>
        </Alert>
        </Section>
      ) : null}

      {!backendScoped && !adminLike ? (
        <Section>
        <Alert>
          <AlertDescription>
            <strong>Permission-based Access:</strong> Client and product assignment scoping applies only to users with case assignment permissions.
          </AlertDescription>
        </Alert>
        </Section>
      ) : null}

      {backendScoped ? (
        <Section>
          <ClientAssignmentSection user={user} />
          <ProductAssignmentSection user={user} />
        </Section>
      ) : null}

      {fieldAgent ? (
        <Section>
          <TerritoryAssignmentSection user={user} />
        </Section>
      ) : null}

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={4}>
            <Stack gap={1}>
              <Text as="h3" variant="headline">Permission Summary</Text>
              <Text variant="body-sm" tone="muted">Overview of this user&apos;s access levels and operational restrictions.</Text>
            </Stack>
          <div className={`grid grid-cols-1 gap-6 ${backendScoped ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              <div>
                <h4 className="font-medium mb-2 flex items-center space-x-2">
                  <Building2 className="h-4 w-4" />
                  <span>Client Access</span>
                </h4>
                {adminLike ? (
                  <p className="text-sm text-gray-600">Full/elevated access to clients</p>
                ) : backendScoped ? (
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
              {adminLike ? (
                <p className="text-sm text-gray-600">Full/elevated access to products</p>
              ) : backendScoped ? (
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
          </Stack>
        </Card>
      </Section>
    </Page>
  );
}
