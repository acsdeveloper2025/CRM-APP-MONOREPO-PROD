import { Navigate, useLocation } from 'react-router-dom';
import { LoadingPage } from '@/components/ui/loading';
import { useCurrentPolicyAcceptance } from '@/hooks/useCurrentPolicyAcceptance';

interface Props {
  children: React.ReactNode;
}

/**
 * Hard login gate (Phase D Option B, 2026-05-17): every authenticated
 * route is gated behind acceptance of the current policy version. Users
 * who have not accepted (OR whose acceptance can't be verified) are
 * redirected to /accept-policy.
 *
 * Mounted INSIDE AuthenticatedLayout, AFTER ProtectedRoute has confirmed
 * the user is logged in. /accept-policy itself sits OUTSIDE this layout
 * to avoid an infinite redirect loop.
 *
 * Fail-CLOSED on error: original design failed open ("transient outage
 * shouldn't lock org out"), but a pre-prod test (2026-05-17) revealed
 * that non-admin users hit 403 on the consent endpoint, which fail-open
 * silently bypassed the gate entirely. Correct posture for a compliance
 * gate is to assume unverified = unaccepted and route to /accept-policy
 * where the user can either accept (one button) or logout (other).
 */
export function PolicyAcceptanceGuard({ children }: Props) {
  const { isAccepted, isLoading } = useCurrentPolicyAcceptance();
  const location = useLocation();

  if (isLoading) {
    return (
      <LoadingPage
        title="Checking acknowledgements"
        description="Verifying your policy acceptance status…"
      />
    );
  }

  if (!isAccepted) {
    return <Navigate to="/accept-policy" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
