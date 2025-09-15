import React from 'react';
import { Activity, User, Clock } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserActivity } from '@/types/user';

interface UserActivitiesTableProps {
  data: UserActivity[];
  isLoading: boolean;
}

export function UserActivitiesTable({ data, isLoading }: UserActivitiesTableProps) {
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
        <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No activities found</h3>
        <p className="text-muted-foreground">
          User activities will appear here as they interact with the system.
        </p>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    const actionConfig: Record<string, { variant: any; label: string }> = {
      LOGIN: { variant: 'default', label: 'Login' },
      LOGOUT: { variant: 'secondary', label: 'Logout' },
      CREATE: { variant: 'default', label: 'Create' },
      UPDATE: { variant: 'outline', label: 'Update' },
      DELETE: { variant: 'destructive', label: 'Delete' },
      VIEW: { variant: 'secondary', label: 'View' },
    };
    
    const config = actionConfig[action] || { variant: 'outline', label: action };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {activity.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{activity.user.name}</div>
                    <div className="text-sm text-muted-foreground">{activity.user.username}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {getActionBadge(activity.action)}
              </TableCell>
              <TableCell>
                <span className="text-sm">{activity.description}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm font-mono">{activity.ipAddress || 'N/A'}</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
