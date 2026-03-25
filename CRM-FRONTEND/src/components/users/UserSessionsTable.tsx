import { ApiErrorResponse } from '@/types/api';
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
import { LoadingState } from '@/components/ui/loading';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
    onError: (error: unknown) => {
      const apiError = error as ApiErrorResponse;
      toast.error(apiError.response?.data?.message || 'Failed to terminate session');
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
    if (userAgent.includes('Chrome')) {return 'Chrome';}
    if (userAgent.includes('Firefox')) {return 'Firefox';}
    if (userAgent.includes('Safari')) {return 'Safari';}
    if (userAgent.includes('Edge')) {return 'Edge';}
    return 'Unknown Browser';
  };

  if (isLoading) {
    return <LoadingState message="Loading sessions..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <Monitor className="mx-auto h-12 w-12 text-gray-600" />
        <h3 className="mt-4 text-lg font-semibold">No active sessions</h3>
        <p className="text-gray-600">
          User sessions will appear here when users are logged in.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Device</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Login Time</TableHead>
            <TableHead>Expiry Time</TableHead>
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
                      {(session.userName || 'U').split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{session.userName || 'Unknown User'}</div>
                    <div className="text-sm text-gray-600">{session.username}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  {getDeviceIcon(session.userAgent || '')}
                  <span className="text-sm">{getDeviceInfo(session.userAgent || '')}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm font-mono">{session.ipAddress || 'N/A'}</span>
              </TableCell>
              <TableCell>
                <Badge variant={session.isActive ? 'default' : 'secondary'}>
                  {session.isActive ? 'Active' : 'Expired'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-gray-600" />
                  <span className="text-sm">
                    {new Date(session.createdAt).toLocaleString()}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'N/A'}
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
