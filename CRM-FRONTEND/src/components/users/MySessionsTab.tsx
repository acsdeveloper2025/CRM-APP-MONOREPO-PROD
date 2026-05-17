import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Lock, Smartphone, Monitor, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { Badge } from '@/components/ui/badge';
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
import { apiService } from '@/services/api';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { logger } from '@/utils/logger';

interface MySession {
  sessionId: string;
  deviceId: string | null;
  deviceLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
}

interface Props {
  userId: string;
}

const isMobileUA = (ua: string | null): boolean => /mobile|android|iphone|ipad/i.test(ua ?? '');

const formatWhen = (iso: string): string => {
  try {
    return format(new Date(iso), 'dd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
};

export function MySessionsTab({ userId }: Props) {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<MySession | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-sessions', userId],
    queryFn: async () => {
      const res = await apiService.get<MySession[]>(`/users/${userId}/sessions`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const revokeMutation = useStandardizedMutation({
    mutationFn: (sessionId: string) =>
      apiService.delete<void>(`/users/${userId}/sessions/${sessionId}`),
    successMessage: 'Session revoked. That device will be signed out on its next request.',
    errorContext: 'Revoke Session',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sessions', userId] });
      setRevokeTarget(null);
    },
  });

  const sessions = data ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Devices currently signed in to your account. Revoke any you don&apos;t recognise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <TableSkeleton headers={['Device', 'IP / Last activity', 'Action']} count={3} />
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-destructive">Failed to load your sessions.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !isError && sessions.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No active sessions found.
            </p>
          )}

          {!isLoading && !isError && sessions.length > 0 && (
            <ul className="divide-y divide-border">
              {sessions.map((session) => {
                const Icon = isMobileUA(session.userAgent) ? Smartphone : Monitor;
                return (
                  <li
                    key={session.sessionId}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {session.deviceLabel || 'Unknown device'}
                          </span>
                          {session.isCurrentSession && <Badge variant="default">This device</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {session.ipAddress && (
                            <span className="flex items-center gap-1 case-sensitive">
                              <MapPin className="h-3 w-3" />
                              {session.ipAddress}
                            </span>
                          )}
                          <span>Signed in {formatWhen(session.createdAt)}</span>
                          <span>Expires {formatWhen(session.expiresAt)}</span>
                        </div>
                        {session.userAgent && (
                          <p className="text-xs text-muted-foreground case-sensitive break-words">
                            {session.userAgent}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start text-destructive hover:text-destructive sm:self-center"
                      disabled={session.isCurrentSession || revokeMutation.isPending}
                      onClick={() => setRevokeTarget(session)}
                    >
                      {session.isCurrentSession ? 'Current' : 'Revoke'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revokeMutation.isPending) {
            setRevokeTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The device labelled{' '}
              <strong className="case-sensitive">
                {revokeTarget?.deviceLabel || 'Unknown device'}
              </strong>{' '}
              will be signed out on its next request. The user will need to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (revokeTarget) {
                  logger.info('Revoking own session', { sessionId: revokeTarget.sessionId });
                  revokeMutation.mutate(revokeTarget.sessionId);
                }
              }}
            >
              {revokeMutation.isPending ? 'Revoking…' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
