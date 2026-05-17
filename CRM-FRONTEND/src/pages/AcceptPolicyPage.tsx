import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentPolicyAcceptance } from '@/hooks/useCurrentPolicyAcceptance';
import { usersService } from '@/services/users';
import { useQueryClient } from '@tanstack/react-query';
import {
  CURRENT_POLICY_VERSION,
  FIELD_EXECUTIVE_ACKNOWLEDGEMENT,
} from '@/constants/fieldExecutiveAcknowledgement';
import { LoadingPage } from '@/components/ui/loading';

/**
 * Hard login-gate page (Phase D Option B, 2026-05-17).
 *
 * Reached by PolicyAcceptanceGuard when an authenticated user has not
 * accepted the current policy version. The user has exactly two
 * options here: Accept (proceeds to their intended destination) or
 * Log out (returns to /login).
 *
 * No sidebar, no header — full-screen takeover. Routed OUTSIDE the
 * AuthenticatedLayout to avoid an infinite guard → redirect loop.
 *
 * Requires authentication (redirects to /login if not signed in).
 */
export default function AcceptPolicyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { isAccepted, isLoading: consentLoading } = useCurrentPolicyAcceptance();

  // Resume to the path the user originally requested, falling back to dashboard.
  const fromState = location.state as { from?: { pathname?: string } } | null;
  const returnTo = fromState?.from?.pathname || '/dashboard';

  const acceptMutation = useStandardizedMutation({
    mutationFn: () => usersService.acceptConsent(CURRENT_POLICY_VERSION),
    successMessage: 'Acknowledgement recorded',
    errorContext: 'Accept Policy',
    onSuccess: () => {
      // Invalidate so the guard sees the fresh acceptance immediately.
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['my-consents', user.id] });
        queryClient.invalidateQueries({ queryKey: ['user-consents', user.id] });
      }
      navigate(returnTo, { replace: true });
    },
  });

  // If somehow the page is reached after acceptance (e.g. cache lag, user
  // typed the URL directly), bounce to dashboard.
  useEffect(() => {
    if (!consentLoading && isAccepted) {
      navigate(returnTo, { replace: true });
    }
  }, [consentLoading, isAccepted, navigate, returnTo]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  if (authLoading || consentLoading) {
    return <LoadingPage title="Loading" description="Preparing the acknowledgement…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        {/* Header strip */}
        <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-6 w-6 text-amber-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Acceptance Required</h1>
              <p className="text-sm text-muted-foreground">
                You must accept the Field Executive Acknowledgement (version{' '}
                {CURRENT_POLICY_VERSION}) to continue using this application.
              </p>
            </div>
          </div>
        </div>

        {/* Policy body — scrolls inside its container so the action bar stays in view */}
        <div className="flex-1 overflow-y-auto rounded-md border border-border bg-card p-4 shadow-sm sm:p-6">
          <pre className="whitespace-pre-wrap font-sans text-xs case-sensitive text-foreground sm:text-sm">
            {FIELD_EXECUTIVE_ACKNOWLEDGEMENT}
          </pre>
        </div>

        {/* Action bar — sticky-feel: always reachable at the bottom of the page */}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={acceptMutation.isPending}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
          <Button
            type="button"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            size="lg"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {acceptMutation.isPending ? 'Recording…' : 'I Accept'}
          </Button>
        </div>
      </div>
    </div>
  );
}
