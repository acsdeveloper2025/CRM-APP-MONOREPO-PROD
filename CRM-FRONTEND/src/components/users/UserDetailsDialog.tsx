import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { User, Shield, Calendar, Activity, Award, FileCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usersService } from '@/services/users';
import { User as UserType } from '@/types/user';
import { getRoleBadge } from '@/utils/roleUtils';
import { getPrimaryRoleLabel } from '@/utils/userPermissionProfiles';
import { resolveAssetUrl } from '@/utils/assetUrl';

interface UserDetailsDialogProps {
  user: UserType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailsDialog({ user, open, onOpenChange }: UserDetailsDialogProps) {
  const { data: userProfileData, isLoading: _isLoading } = useQuery({
    queryKey: ['user-profile', user.id],
    queryFn: () => usersService.getUserById(user.id),
    enabled: open,
  });

  const profile = userProfileData?.data;

  // 2026-05-13: Field Executive Acknowledgement history. Loaded on
  // dialog open (same gate as the profile query). Empty list = agent
  // has never accepted, which is a compliance red flag in production
  // — the rendered card calls it out.
  const { data: consentsResponse } = useQuery({
    queryKey: ['user-consents', user.id],
    queryFn: () => usersService.getUserConsents(user.id),
    enabled: open,
  });
  const consents = consentsResponse?.data ?? [];
  const latestConsent = consents[0];

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Active' : 'Inactive'}</Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>User Details</span>
          </DialogTitle>
          <DialogDescription>Comprehensive user information and activity summary</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={resolveAssetUrl(user.profilePhotoUrl)} alt={user.name} />
                  <AvatarFallback className="text-lg">
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="text-lg font-semibold">{user.name}</h3>
                    <p className="text-gray-600 case-sensitive">{user.username}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getRoleBadge(getPrimaryRoleLabel(user))}
                    {getStatusBadge(user.isActive ?? false)}
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-600">Contact Information</h4>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm case-sensitive">{user.email}</p>
                    <p className="text-sm">Employee ID: {user.employeeId}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-600">Work Information</h4>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">{user.designation}</p>
                    <p className="text-sm">{user.department}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          {profile?.stats && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                  <Activity className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{profile.stats.totalCases}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <Shield className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {profile.stats.completedCases}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                  <Award className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {Number(profile.stats.averageRating || 0).toFixed(1)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Commissions</CardTitle>
                  <Calendar className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{Number(profile.stats.totalCommissions || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-600">Account Created</h4>
                  <p className="text-sm mt-1">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-600">Last Login</h4>
                  <p className="text-sm mt-1">
                    {user.lastLogin || user.lastLoginAt
                      ? new Date(user.lastLogin || user.lastLoginAt || '').toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field Executive Acknowledgement (consent audit trail) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-gray-600" />
                Field Executive Acknowledgement
              </CardTitle>
              <CardDescription>
                Code of Conduct / Anti-bribery / NDA / Privacy consent — recorded for compliance
                review and dispute resolution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestConsent ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Accepted (v{latestConsent.policyVersion})
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Accepted at</span>
                    <span className="text-sm font-medium">
                      {format(new Date(latestConsent.acceptedAt), 'd MMM yyyy, HH:mm:ss')}
                    </span>
                  </div>
                  {latestConsent.ipAddress && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">IP address</span>
                      <span className="text-sm font-mono">{latestConsent.ipAddress}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Source</span>
                    <span className="text-sm">{latestConsent.source}</span>
                  </div>
                  {latestConsent.userAgent && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Device</p>
                      <p className="text-xs font-mono break-all">{latestConsent.userAgent}</p>
                    </div>
                  )}
                  {consents.length > 1 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">
                        Prior versions ({consents.length - 1})
                      </p>
                      <div className="space-y-1">
                        {consents.slice(1).map((c) => (
                          <div key={c.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">v{c.policyVersion}</span>
                            <span>{format(new Date(c.acceptedAt), 'd MMM yyyy, HH:mm')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
                  <span className="text-sm text-yellow-900 dark:text-yellow-200">
                    No acknowledgement on record. This user has not yet accepted the current Field
                    Executive Acknowledgement.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          {profile?.recentActivity && profile.recentActivity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest user actions and system interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.recentActivity.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center space-x-3 p-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/50"
                    >
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-gray-600">{activity.description}</p>
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
