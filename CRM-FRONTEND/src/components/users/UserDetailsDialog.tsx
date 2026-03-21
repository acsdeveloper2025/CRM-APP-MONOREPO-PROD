import { useQuery } from '@tanstack/react-query';
import { User, Shield, Calendar, Activity, Award } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import { Badge } from '@/ui/components/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Separator } from '@/ui/components/Separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/Avatar';
import { usersService } from '@/services/users';
import { User as UserType } from '@/types/user';
import { getRoleBadge } from '@/utils/roleUtils';
import { getPrimaryRoleLabel } from '@/utils/userPermissionProfiles';

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

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? 'default' : 'secondary'}>
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...{ className: "max-w-[95vw] sm:max-w-[700px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto" }}>
        <DialogHeader>
          <DialogTitle {...{ className: "flex items-center space-x-2" }}>
            <User {...{ className: "h-5 w-5" }} />
            <span>User Details</span>
          </DialogTitle>
          <DialogDescription>
            Comprehensive user information and activity summary
          </DialogDescription>
        </DialogHeader>

        <div {...{ className: "space-y-6" }}>
          {/* User Profile */}
          <Card>
            <CardHeader>
              <CardTitle {...{ className: "text-lg" }}>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div {...{ className: "flex items-start space-x-4" }}>
                <Avatar {...{ className: "h-16 w-16" }}>
                  <AvatarImage src={user.profilePhotoUrl} alt={user.name} />
                  <AvatarFallback {...{ className: "text-lg" }}>
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div {...{ className: "flex-1 space-y-2" }}>
                  <div>
                    <h3 {...{ className: "text-lg font-semibold" }}>{user.name}</h3>
                    <p {...{ className: "text-gray-600" }}>{user.username}</p>
                  </div>
                  <div {...{ className: "flex items-center space-x-2" }}>
                    {getRoleBadge(getPrimaryRoleLabel(user))}
                    {getStatusBadge(user.isActive ?? false)}
                  </div>
                </div>
              </div>

              <Separator {...{ className: "my-4" }} />

              <div {...{ className: "grid grid-cols-1 sm:grid-cols-2 gap-4" }}>
                <div>
                  <h4 {...{ className: "font-medium text-sm text-gray-600" }}>Contact Information</h4>
                  <div {...{ className: "mt-2 space-y-1" }}>
                    <p {...{ className: "text-sm" }}>{user.email}</p>
                    <p {...{ className: "text-sm" }}>Employee ID: {user.employeeId}</p>
                  </div>
                </div>
                <div>
                  <h4 {...{ className: "font-medium text-sm text-gray-600" }}>Work Information</h4>
                  <div {...{ className: "mt-2 space-y-1" }}>
                    <p {...{ className: "text-sm" }}>{user.designation}</p>
                    <p {...{ className: "text-sm" }}>{user.department}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          {profile?.stats && (
            <div {...{ className: "grid gap-4 md:grid-cols-4" }}>
              <Card>
                <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
                  <CardTitle {...{ className: "text-sm font-medium" }}>Total Cases</CardTitle>
                  <Activity {...{ className: "h-4 w-4 text-gray-600" }} />
                </CardHeader>
                <CardContent>
                  <div {...{ className: "text-2xl font-bold" }}>{profile.stats.totalCases}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
                  <CardTitle {...{ className: "text-sm font-medium" }}>Completed</CardTitle>
                  <Shield {...{ className: "h-4 w-4 text-green-600" }} />
                </CardHeader>
                <CardContent>
                  <div {...{ className: "text-2xl font-bold text-green-600" }}>{profile.stats.completedCases}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
                  <CardTitle {...{ className: "text-sm font-medium" }}>Avg Rating</CardTitle>
                  <Award {...{ className: "h-4 w-4 text-yellow-600" }} />
                </CardHeader>
                <CardContent>
                  <div {...{ className: "text-2xl font-bold text-yellow-600" }}>
                    {profile.stats.averageRating.toFixed(1)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader {...{ className: "flex flex-row items-center justify-between space-y-0 pb-2" }}>
                  <CardTitle {...{ className: "text-sm font-medium" }}>Commissions</CardTitle>
                  <Calendar {...{ className: "h-4 w-4 text-gray-600" }} />
                </CardHeader>
                <CardContent>
                  <div {...{ className: "text-2xl font-bold" }}>₹{profile.stats.totalCommissions.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle {...{ className: "text-lg" }}>Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div {...{ className: "grid grid-cols-1 sm:grid-cols-2 gap-4" }}>
                <div>
                  <h4 {...{ className: "font-medium text-sm text-gray-600" }}>Account Created</h4>
                  <p {...{ className: "text-sm mt-1" }}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <h4 {...{ className: "font-medium text-sm text-gray-600" }}>Last Login</h4>
                  <p {...{ className: "text-sm mt-1" }}>
                    {user.lastLogin || user.lastLoginAt ? new Date(user.lastLogin || user.lastLoginAt || '').toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          {profile?.recentActivity && profile.recentActivity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle {...{ className: "text-lg" }}>Recent Activity</CardTitle>
                <CardDescription>
                  Latest user actions and system interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div {...{ className: "space-y-3" }}>
                  {profile.recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} {...{ className: "flex items-center space-x-3 p-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/50" }}>
                      <div {...{ className: "h-2 w-2 rounded-full bg-primary" }} />
                      <div {...{ className: "flex-1" }}>
                        <p {...{ className: "text-sm font-medium" }}>{activity.action}</p>
                        <p {...{ className: "text-xs text-gray-600" }}>{activity.description}</p>
                      </div>
                      <div {...{ className: "text-xs text-gray-600" }}>
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
