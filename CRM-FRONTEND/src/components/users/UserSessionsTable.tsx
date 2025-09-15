import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone, Tablet, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { usersService } from '@/services/users';
import { UserSession } from '@/types/user';

interface UserSessionsTableProps {
  data: UserSession[];
  isLoading: boolean;
}

export function UserSessionsTable({ data, isLoading }: UserSessionsTableProps) {
  const queryClient = useQueryClient();

  const terminateSessionMutation = useMutation({
    mutationFn: (sessionId: string) => usersService.terminateSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast.success('Session terminated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to terminate session');
    },
  });

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />;
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="h-4 w-4" />;
    } else {
      return <Monitor className="h-4 w-4" />;
    }
  };

  const getDeviceInfo = (userAgent: string) => {
    // Simple user agent parsing
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
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
        <Monitor className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No active sessions</h3>
        <p className="text-muted-foreground">
          User sessions will appear here when users are logged in.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Device</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Session Started</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {session.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{session.user.name}</div>
                    <div className="text-sm text-muted-foreground">{session.user.username}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  {getDeviceIcon(session.userAgent)}
                  <span className="text-sm">{getDeviceInfo(session.userAgent)}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm font-mono">{session.ipAddress}</span>
              </TableCell>
              <TableCell>
                <Badge variant={session.isActive ? 'default' : 'secondary'}>
                  {session.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(session.lastActivityAt).toLocaleString()}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {new Date(session.createdAt).toLocaleString()}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {session.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => terminateSessionMutation.mutate(session.id)}
                    disabled={terminateSessionMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Terminate
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
